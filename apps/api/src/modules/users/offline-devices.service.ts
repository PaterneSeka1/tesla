import { randomBytes } from 'node:crypto';
import { ConflictException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import {
  OFFLINE_DEVICE_MAX_ACTIVE,
  type OfflineDevice,
  type OfflineDeviceKey,
  type OfflineDeviceList,
  registerOfflineDeviceInputSchema,
} from '@tesla/shared';
import { parseInput } from '../../common/validation.js';
import { type OfflineDevice as OfflineDeviceRow } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const notFound = () =>
  new NotFoundException({ code: 'OFFLINE_DEVICE_NOT_FOUND', message: 'Appareil introuvable.' });

/**
 * Appareils préparés pour l'usage hors connexion (D180). Le serveur conserve, par appareil, une clé
 * aléatoire qui protège une copie de la clé du coffre local ; il ne la remet qu'au titulaire dont la
 * session est valide (donc après une connexion avec le mot de passe actuel). Le mot de passe et la
 * clé du coffre ne transitent jamais. Révocation : la clé n'est plus jamais remise.
 */
@Injectable()
export class OfflineDevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<OfflineDeviceList> {
    const rows = await this.prisma.offlineDevice.findMany({
      where: { userId },
      orderBy: [{ revokedAt: { sort: 'desc', nulls: 'first' } }, { lastSeenAt: 'desc' }],
      take: 50,
    });
    return { items: rows.map(toDevice) };
  }

  async register(userId: string, input: unknown): Promise<OfflineDeviceKey> {
    const { label } = parseInput(registerOfflineDeviceInputSchema, input);
    return this.prisma.$transaction(async (tx) => {
      // Verrou du compte : deux préparations simultanées ne dépassent pas la limite.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
      const active = await tx.offlineDevice.count({ where: { userId, revokedAt: null } });
      if (active >= OFFLINE_DEVICE_MAX_ACTIVE) {
        throw new ConflictException({
          code: 'OFFLINE_DEVICE_LIMIT',
          message: `${OFFLINE_DEVICE_MAX_ACTIVE} appareils sont déjà préparés : retirez-en un depuis « Cet appareil ».`,
        });
      }
      const keyMaterial = randomBytes(32);
      const device = await tx.offlineDevice.create({
        data: { userId, label, keyMaterial },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'offline_device.registered',
          entityType: 'OfflineDevice',
          entityId: device.id,
        },
      });
      return { deviceId: device.id, key: keyMaterial.toString('base64') };
    });
  }

  /** Clé d'un appareil actif du titulaire ; `410` si l'appareil a été retiré. */
  async key(userId: string, deviceId: string): Promise<OfflineDeviceKey> {
    const device = await this.prisma.offlineDevice.findFirst({ where: { id: deviceId, userId } });
    if (!device) throw notFound();
    if (device.revokedAt) {
      throw new GoneException({
        code: 'OFFLINE_DEVICE_REVOKED',
        message: 'Cet appareil a été retiré : préparez-le de nouveau.',
      });
    }
    await this.prisma.offlineDevice.update({
      where: { id: deviceId },
      data: { lastSeenAt: new Date() },
    });
    return { deviceId, key: Buffer.from(device.keyMaterial).toString('base64') };
  }

  async revoke(userId: string, deviceId: string): Promise<void> {
    const { count } = await this.prisma.offlineDevice.updateMany({
      where: { id: deviceId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) {
      const exists = await this.prisma.offlineDevice.count({ where: { id: deviceId, userId } });
      if (!exists) throw notFound();
      return; // Déjà retiré : idempotent.
    }
    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'offline_device.revoked',
        entityType: 'OfflineDevice',
        entityId: deviceId,
      },
    });
  }
}

function toDevice(row: OfflineDeviceRow): OfflineDevice {
  return {
    id: row.id,
    label: row.label,
    createdAt: row.createdAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
  };
}

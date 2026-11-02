import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  deleteMedicalRecordInputSchema,
  type MedicalHolder,
  type MedicalRecord,
  medicalRecordDataSchema,
  saveMedicalRecordInputSchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan } from '../../common/permissions.js';
import { parseInput } from '../../common/validation.js';
import { ENV } from '../../config/config.module.js';
import { type Env } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { openMedicalData, parseMedicalKey, sealMedicalData } from './medical-crypto.js';

const recordChanged = () =>
  new ConflictException({
    code: 'MEDICAL_RECORD_CHANGED',
    message:
      'Votre fiche médicale a été modifiée entre-temps (autre appareil ou autre onglet). Rechargez-la avant de reprendre vos changements.',
  });

/**
 * Fiche médicale personnelle (D135–D137). Toutes les opérations portent sur le compte de l'acteur :
 * aucune route ne prend l'identifiant d'une autre personne, aucune permission pédagogique ou
 * administrative n'ouvre l'accès à la fiche d'autrui. Le compte administrateur n'a pas de fiche (D142). Le journal d'audit ne retient que l'action et
 * la révision, jamais le contenu.
 */
@Injectable()
export class MedicalRecordsService {
  private readonly logger = new Logger(MedicalRecordsService.name);
  private readonly key: Buffer | null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) env: Env,
  ) {
    this.key = env.MEDICAL_DATA_KEY ? parseMedicalKey(env.MEDICAL_DATA_KEY) : null;
  }

  /** Titulaire habilité (pas le compte administrateur) et clé configurée. */
  private requireKey(actor: Actor): Buffer {
    assertCan(actor, 'medicalRecord.own');
    if (!this.key) {
      throw new ServiceUnavailableException({
        code: 'MEDICAL_RECORDS_UNAVAILABLE',
        message: 'Les fiches médicales ne sont pas encore disponibles sur cette installation.',
      });
    }
    return this.key;
  }

  async read(actor: Actor): Promise<MedicalRecord> {
    const key = this.requireKey(actor);
    const [holder, row] = await Promise.all([
      this.holder(actor.userId),
      this.prisma.medicalRecord.findUnique({ where: { userId: actor.userId } }),
    ]);
    if (!row) return { holder, record: null };
    let data;
    try {
      data = medicalRecordDataSchema.parse(openMedicalData(key, actor.userId, row));
    } catch {
      // Clé erronée ou contenu altéré : aucun détail dans le journal applicatif.
      this.logger.error(`Fiche médicale illisible (enregistrement ${row.id}).`);
      throw new InternalServerErrorException({
        code: 'MEDICAL_RECORD_UNREADABLE',
        message: 'Votre fiche médicale ne peut pas être lue pour le moment.',
      });
    }
    return {
      holder,
      record: {
        data,
        revision: row.revision,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    };
  }

  /** Création (révision attendue nulle) ou modification, sans limite de nombre. */
  async save(actor: Actor, input: unknown): Promise<MedicalRecord> {
    const key = this.requireKey(actor);
    const { expectedRevision, data } = parseInput(saveMedicalRecordInputSchema, input);
    const sealed = sealMedicalData(key, actor.userId, data);
    await this.prisma.$transaction(async (tx) => {
      if (expectedRevision === null) {
        const created = await tx.medicalRecord.createManyAndReturn({
          data: [{ userId: actor.userId, ...sealed }],
          skipDuplicates: true,
          select: { id: true, revision: true },
        });
        if (created.length === 0) throw recordChanged();
        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            action: 'medical.created',
            entityType: 'MedicalRecord',
            entityId: created[0]!.id,
            metadata: { revision: 1 },
          },
        });
        return;
      }
      // Mise à jour conditionnelle : aucune écriture si la révision lue n'est plus la dernière.
      const updated = await tx.medicalRecord.updateManyAndReturn({
        where: { userId: actor.userId, revision: expectedRevision },
        data: { ...sealed, revision: { increment: 1 } },
        select: { id: true, revision: true },
      });
      if (updated.length === 0) throw recordChanged();
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: 'medical.updated',
          entityType: 'MedicalRecord',
          entityId: updated[0]!.id,
          metadata: { revision: updated[0]!.revision },
        },
      });
    });
    return this.read(actor);
  }

  /** Suppression à la demande du titulaire (droit à l'effacement) : aucune copie conservée. */
  async remove(actor: Actor, input: unknown): Promise<void> {
    this.requireKey(actor);
    const { expectedRevision } = parseInput(deleteMedicalRecordInputSchema, input);
    await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.medicalRecord.deleteMany({
        where: { userId: actor.userId, revision: expectedRevision },
      });
      if (deleted.count === 0) throw recordChanged();
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: 'medical.deleted',
          entityType: 'MedicalRecord',
          entityId: actor.userId,
        },
      });
    });
  }

  /** Fiche à imprimer : existante seulement ; l'export est journalisé (sans contenu). */
  async printable(
    actor: Actor,
  ): Promise<MedicalRecord & { record: NonNullable<MedicalRecord['record']> }> {
    const current = await this.read(actor);
    if (!current.record) {
      throw new NotFoundException({
        code: 'MEDICAL_RECORD_NOT_FOUND',
        message: 'Enregistrez d’abord votre fiche médicale.',
      });
    }
    await this.prisma.auditLog.create({
      data: {
        actorId: actor.userId,
        action: 'medical.exported',
        entityType: 'MedicalRecord',
        entityId: actor.userId,
        metadata: { revision: current.record.revision },
      },
    });
    return { holder: current.holder, record: current.record };
  }

  /** Identité affichée : compte, et fiche routier rattachée s'il y en a une (jamais recopiée). */
  private async holder(userId: string): Promise<MedicalHolder> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        scoutProfile: {
          select: {
            firstName: true,
            lastName: true,
            birthDate: true,
            matricule: true,
            teamAssignments: {
              where: { endedAt: null },
              select: { team: { select: { name: true } } },
              take: 1,
            },
          },
        },
      },
    });
    const profile = user.scoutProfile;
    return {
      firstName: profile?.firstName ?? user.firstName,
      lastName: profile?.lastName ?? user.lastName,
      birthDate: profile?.birthDate ? profile.birthDate.toISOString().slice(0, 10) : null,
      matricule: profile?.matricule ?? null,
      team: profile?.teamAssignments[0]?.team.name ?? null,
    };
  }
}

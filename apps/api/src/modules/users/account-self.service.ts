import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  changePasswordInputSchema,
  type SessionList,
  updateProfileInputSchema,
} from '@tesla/shared';
import { parseInput } from '../../common/validation.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { LoginRateLimiter } from '../auth/login-rate-limiter.js';
import { hashPassword, verifyPassword } from '../auth/password.js';

/** Opérations de l'utilisateur connecté sur son propre compte (aucune permission métier requise). */
@Injectable()
export class AccountSelfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly limiter: LoginRateLimiter,
  ) {}

  /**
   * Changement de mot de passe : vérifie l'actuel (tentatives limitées), révoque les autres sessions
   * et les liens de réinitialisation en attente ; la session courante reste ouverte.
   */
  async changePassword(userId: string, sessionId: string, input: unknown): Promise<void> {
    const { currentPassword, newPassword } = parseInput(changePasswordInputSchema, input);
    const keys = this.limiter.passwordKeys(userId);
    await this.limiter.assertAllowed(keys);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!(await verifyPassword(user.passwordHash, currentPassword))) {
      await this.limiter.recordFailure(keys);
      throw new BadRequestException({
        code: 'INVALID_CURRENT_PASSWORD',
        message: 'Le mot de passe actuel est incorrect.',
      });
    }
    await this.limiter.recordSuccess(keys[0]!);
    const passwordHash = await hashPassword(newPassword);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.prisma.session.updateMany({
        where: { userId, revokedAt: null, id: { not: sessionId } },
        data: { revokedAt: now },
      }),
      this.prisma.accountToken.updateMany({
        where: { userId, usedAt: null, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: userId,
          action: 'account.password_changed',
          entityType: 'User',
          entityId: userId,
        },
      }),
    ]);
  }

  async updateProfile(userId: string, input: unknown): Promise<void> {
    const data = parseInput(updateProfileInputSchema, input);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data }),
      this.prisma.auditLog.create({
        data: {
          actorId: userId,
          action: 'account.profile_updated',
          entityType: 'User',
          entityId: userId,
          metadata: { fields: Object.keys(data) },
        },
      }),
    ]);
  }

  /** Sessions ouvertes (non révoquées, non expirées) du compte. */
  async listSessions(userId: string, currentSessionId: string): Promise<SessionList> {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    return {
      items: sessions.map((session) => ({
        id: session.id,
        userAgent: session.userAgent,
        createdAt: session.createdAt.toISOString(),
        lastUsedAt: session.lastUsedAt?.toISOString() ?? null,
        expiresAt: session.expiresAt.toISOString(),
        current: session.id === currentSessionId,
      })),
    };
  }

  /** Ferme une de ses propres sessions (autre appareil). */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const { count } = await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) {
      throw new NotFoundException({ code: 'SESSION_NOT_FOUND', message: 'Session introuvable.' });
    }
  }

  /** Ferme toutes ses sessions sauf la courante. */
  async revokeOtherSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<{ revoked: number }> {
    const { count } = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null, id: { not: currentSessionId } },
      data: { revokedAt: new Date() },
    });
    return { revoked: count };
  }
}

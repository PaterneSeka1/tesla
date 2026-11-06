import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  changePasswordInputSchema,
  elapsedYearsMonths,
  type MyProfile,
  type MyScoutProfile,
  type SessionList,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { parseInput } from '../../common/validation.js';
import { type Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { stillRequiredModuleWhere } from '../progression/age-rules.js';
import {
  computedStageOf,
  loadStageContext,
  type StageContext,
} from '../progression/computed-stage.js';
import { toIsoDate, toStageSummary } from '../scouts/presenters.js';
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

  /**
   * « Mon profil » (D173) : données administratives et valeurs calculées par l'API, en lecture
   * seule. Rien ici n'est modifiable par le titulaire ; l'étape provient du calcul selon l'âge.
   */
  async profile(actor: Actor): Promise<MyProfile> {
    const [user, scout, context] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: actor.userId },
        select: { firstName: true, lastName: true, email: true },
      }),
      this.prisma.scoutProfile.findUnique({
        where: { userId: actor.userId },
        include: {
          teamAssignments: { where: { endedAt: null }, include: { team: true }, take: 1 },
        },
      }),
      loadStageContext(this.prisma),
    ]);
    return {
      firstName: scout?.firstName ?? user.firstName,
      lastName: scout?.lastName ?? user.lastName,
      email: user.email,
      leaderFunction: actor.leaderFunction,
      scout: scout && (await this.scoutPart(scout, context)),
    };
  }

  private async scoutPart(
    scout: Prisma.ScoutProfileGetPayload<{
      include: { teamAssignments: { include: { team: true } } };
    }>,
    context: StageContext,
  ): Promise<MyScoutProfile> {
    const { stage, reason, progression } = computedStageOf(scout, context);
    const joinedAt = scout.joinedAt && toIsoDate(scout.joinedAt);
    const [open, acquired] = await Promise.all([
      this.prisma.catchUpObligation.count({
        where: { scoutProfileId: scout.id, decision: null, module: stillRequiredModuleWhere },
      }),
      this.prisma.catchUpObligation.count({
        where: { scoutProfileId: scout.id, decision: 'ACQUIS' },
      }),
    ]);
    const team = scout.teamAssignments[0]?.team ?? null;
    const milestone = progression.nextMilestone;
    const stageOf = (code: string | null) =>
      toStageSummary(context.stages.find((row) => row.code === code) ?? null);
    return {
      matricule: scout.matricule,
      team: team && { id: team.id, name: team.name },
      birthDate: scout.birthDate && toIsoDate(scout.birthDate),
      age: progression.age,
      joinedAt,
      seniority: joinedAt ? elapsedYearsMonths(joinedAt, context.today) : null,
      stage: toStageSummary(stage),
      stageReason: reason,
      // Détail interne du calcul : jamais transmis au titulaire (D176).
      ruleSetVersion: null,
      nextMilestone:
        reason === 'SORTI' || !milestone
          ? null
          : { kind: milestone.kind, stage: stageOf(milestone.stageCode), date: milestone.date },
      branchExitOn: progression.branchExitOn,
      membership: scout.membershipStatus === 'SORTI' ? 'SORTI' : progression.membership,
      catchUps: { open, acquired },
    };
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

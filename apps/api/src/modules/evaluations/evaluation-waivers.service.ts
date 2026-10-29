import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  type AttemptReasonInput,
  attemptReasonInputSchema,
  type GrantWaiverInput,
  grantWaiverInputSchema,
  type Paginated,
  type Waiver,
  type WaiverListQuery,
  waiverListQuerySchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan } from '../../common/permissions.js';
import { parseInput } from '../../common/validation.js';
import { type EvaluationWaiver, type Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { toUserSummary, userSummarySelect } from '../scouts/presenters.js';
import { scoutProfileNotFound } from '../scouts/scout-profiles.service.js';
import { isWaiverActive } from './eligibility.js';
import { formatEvaluationCode } from './evaluation-common.js';

const waiverInclude = {
  scoutProfile: {
    select: { id: true, firstName: true, lastName: true, matricule: true, userId: true },
  },
  evaluation: { select: { id: true, number: true, title: true } },
  grantedBy: userSummarySelect,
  revokedBy: userSummarySelect,
  _count: { select: { attempts: true } },
} as const satisfies Prisma.EvaluationWaiverInclude;

/** Dérogations individuelles (déblocages) : responsable uniquement, motivées, tracées, révocables (RM-009). */
@Injectable()
export class EvaluationWaiversService {
  constructor(private readonly prisma: PrismaService) {}

  /** Dérogations (actives : ni révoquées ni expirées), les plus récentes d'abord. */
  async list(actor: Actor, query: WaiverListQuery): Promise<Paginated<Waiver>> {
    assertCan(actor, 'waiver.manage');
    const { page, pageSize, search, status } = parseInput(waiverListQuerySchema, query);
    const now = new Date();
    const active: Prisma.EvaluationWaiverWhereInput = {
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    };
    const filters: Prisma.EvaluationWaiverWhereInput[] = [];
    if (status === 'active') filters.push(active);
    else if (status === 'inactive') filters.push({ NOT: active });
    if (search) {
      filters.push({
        OR: [
          { scoutProfile: { lastName: { contains: search, mode: 'insensitive' } } },
          { scoutProfile: { firstName: { contains: search, mode: 'insensitive' } } },
          { evaluation: { title: { contains: search, mode: 'insensitive' } } },
        ],
      });
    }
    const where: Prisma.EvaluationWaiverWhereInput = { AND: filters };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.evaluationWaiver.count({ where }),
      this.prisma.evaluationWaiver.findMany({
        where,
        include: waiverInclude,
        orderBy: { grantedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        scout: {
          id: row.scoutProfile.id,
          firstName: row.scoutProfile.firstName,
          lastName: row.scoutProfile.lastName,
          matricule: row.scoutProfile.matricule,
          hasAccount: row.scoutProfile.userId !== null,
        },
        evaluation: {
          id: row.evaluation.id,
          code: formatEvaluationCode(row.evaluation.number),
          title: row.evaluation.title,
        },
        reason: row.reason,
        grantedBy: toUserSummary(row.grantedBy)!,
        grantedAt: row.grantedAt.toISOString(),
        expiresAt: row.expiresAt?.toISOString() ?? null,
        revokedAt: row.revokedAt?.toISOString() ?? null,
        revokedBy: toUserSummary(row.revokedBy),
        revocationReason: row.revocationReason,
        active: isWaiverActive(row, now),
        attemptCount: row._count.attempts,
      })),
      page,
      pageSize,
      total,
    };
  }

  async grant(actor: Actor, input: GrantWaiverInput): Promise<EvaluationWaiver> {
    assertCan(actor, 'waiver.manage');
    const data = parseInput(grantWaiverInputSchema, input);
    const now = new Date();
    const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    if (expiresAt && expiresAt <= now) {
      throw new UnprocessableEntityException({
        code: 'INVALID_EXPIRY',
        message: 'La date d’expiration doit être future.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.scoutProfile.findUnique({ where: { id: data.scoutProfileId } });
      if (!profile) throw scoutProfileNotFound();
      const evaluation = await tx.evaluation.findUnique({ where: { id: data.evaluationId } });
      if (!evaluation) {
        throw new NotFoundException({
          code: 'EVALUATION_NOT_FOUND',
          message: 'Évaluation introuvable.',
        });
      }
      const waiver = await tx.evaluationWaiver.create({
        data: {
          scoutProfileId: data.scoutProfileId,
          evaluationId: data.evaluationId,
          reason: data.reason,
          grantedById: actor.userId,
          grantedAt: now,
          expiresAt,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: 'evaluation_waiver.granted',
          entityType: 'EvaluationWaiver',
          entityId: waiver.id,
          metadata: { scoutProfileId: data.scoutProfileId, evaluationId: data.evaluationId },
        },
      });
      return waiver;
    });
  }

  async revoke(
    actor: Actor,
    waiverId: string,
    input: AttemptReasonInput,
  ): Promise<EvaluationWaiver> {
    assertCan(actor, 'waiver.manage');
    const { reason } = parseInput(attemptReasonInputSchema, input);
    return this.prisma.$transaction(async (tx) => {
      const waiver = await tx.evaluationWaiver.findUnique({ where: { id: waiverId } });
      if (!waiver) {
        throw new NotFoundException({
          code: 'WAIVER_NOT_FOUND',
          message: 'Dérogation introuvable.',
        });
      }
      if (waiver.revokedAt) {
        throw new ConflictException({
          code: 'WAIVER_ALREADY_REVOKED',
          message: 'Dérogation déjà révoquée.',
        });
      }
      const revoked = await tx.evaluationWaiver.update({
        where: { id: waiverId },
        data: { revokedAt: new Date(), revokedById: actor.userId, revocationReason: reason },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: 'evaluation_waiver.revoked',
          entityType: 'EvaluationWaiver',
          entityId: waiverId,
        },
      });
      return revoked;
    });
  }
}

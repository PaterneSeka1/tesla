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
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan } from '../../common/permissions.js';
import { parseInput } from '../../common/validation.js';
import { type EvaluationWaiver } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { scoutProfileNotFound } from '../scouts/scout-profiles.service.js';

/** Dérogations individuelles (déblocages) : responsable uniquement, motivées, tracées, révocables (RM-009). */
@Injectable()
export class EvaluationWaiversService {
  constructor(private readonly prisma: PrismaService) {}

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

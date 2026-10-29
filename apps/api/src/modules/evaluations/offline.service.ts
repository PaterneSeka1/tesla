import { createHash, randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type OfflineEvaluationPackage,
  type OfflineStatus,
  type OfflineSyncInput,
  offlineSyncInputSchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan } from '../../common/permissions.js';
import { parseInput } from '../../common/validation.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { issueAttemptCode } from './attempt-code.js';
import {
  gradeObjectiveQuestions,
  loadEligibility,
  loadVersionQuestions,
  normalizeAnswers,
  upsertAnswers,
} from './attempt-answers.js';
import { isWaiverActive } from './eligibility.js';
import { EvaluationSessionsService } from './evaluation-sessions.service.js';

@Injectable()
export class OfflineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: EvaluationSessionsService,
  ) {}

  async prepare(actor: Actor, evaluationId: string): Promise<OfflineEvaluationPackage> {
    assertCan(actor, 'evaluation.take');
    const id = await this.prisma.$transaction(async (tx) => {
      // Sérialise aussi les préparations concurrentes sur ce profil.
      await tx.$queryRaw`SELECT id FROM scout_profiles WHERE user_id = ${actor.userId}::uuid FOR UPDATE`;
      const profile = await tx.scoutProfile.findUnique({ where: { userId: actor.userId } });
      const evaluation = await tx.evaluation.findUnique({
        where: { id: evaluationId },
        include: { publishedVersion: true },
      });
      if (!evaluation?.publishedVersion)
        throw new NotFoundException('Évaluation publiée introuvable.');
      const now = new Date();
      const eligibility = await loadEligibility(tx, {
        profile,
        evaluation,
        maxAttempts: evaluation.publishedVersion.maxAttempts,
        now,
      });
      if (!eligibility.allowed || !profile)
        throw new ForbiddenException({
          code: 'EVALUATION_NOT_ELIGIBLE',
          message: 'Votre profil ou votre progression ne permet pas cette évaluation.',
        });
      if (eligibility.openAttempt) {
        const open = await tx.evaluationAttempt.findUniqueOrThrow({
          where: { id: eligibility.openAttempt.id },
        });
        if (
          open.mode === 'HORS_LIGNE' &&
          open.status === 'EN_COURS' &&
          open.createdById === actor.userId &&
          open.offlineExpiresAt &&
          open.offlineExpiresAt > now
        )
          return open.id;
        throw new ConflictException({
          code: 'ATTEMPT_ALREADY_OPEN',
          message: 'Une tentative existe déjà. Consultez son état avant de recommencer.',
        });
      }
      const attempt = await tx.evaluationAttempt.create({
        data: {
          code: await issueAttemptCode(tx, now),
          scoutProfileId: profile.id,
          evaluationId,
          evaluationVersionId: evaluation.publishedVersion.id,
          mode: 'HORS_LIGNE',
          status: 'EN_COURS',
          startedAt: now,
          createdById: actor.userId,
          waiverId: eligibility.waiver?.id,
          offlineAuthorization: randomUUID(),
          offlineIssuedAt: now,
          offlineExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        },
      });
      await tx.evaluationAttemptEvent.create({
        data: {
          attemptId: attempt.id,
          actorId: actor.userId,
          fromStatus: null,
          toStatus: 'EN_COURS',
          snapshot: { offline: true, policy: 'RECEIVE_BEFORE_EXPIRY_RECHECK_RIGHTS' },
        },
      });
      return attempt.id;
    });
    const attempt = await this.own(actor, id);
    return {
      ownerId: actor.userId,
      scoutProfileId: attempt.scoutProfileId,
      versionId: attempt.evaluationVersionId,
      authorization: attempt.offlineAuthorization!,
      issuedAt: attempt.offlineIssuedAt!.toISOString(),
      expiresAt: attempt.offlineExpiresAt!.toISOString(),
      policy: 'RECEIVE_BEFORE_EXPIRY_RECHECK_RIGHTS',
      session: await this.sessions.session(actor, id),
    };
  }

  private async own(actor: Actor, id: string) {
    assertCan(actor, 'evaluation.take');
    const attempt = await this.prisma.evaluationAttempt.findFirst({
      where: {
        id,
        mode: 'HORS_LIGNE',
        createdById: actor.userId,
        scoutProfile: { userId: actor.userId },
      },
    });
    if (!attempt)
      throw new NotFoundException({
        code: 'OFFLINE_ATTEMPT_NOT_FOUND',
        message: 'Tentative hors ligne introuvable pour ce compte.',
      });
    return attempt;
  }

  async status(actor: Actor, id: string): Promise<OfflineStatus> {
    return toOfflineStatus(await this.own(actor, id));
  }

  async sync(actor: Actor, id: string, input: OfflineSyncInput): Promise<OfflineStatus> {
    await this.own(actor, id);
    const data = parseInput(offlineSyncInputSchema, input);
    const hash = createHash('sha256').update(JSON.stringify(data)).digest('hex');
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM evaluation_attempts WHERE id = ${id}::uuid FOR UPDATE`;
      const a = await tx.evaluationAttempt.findUniqueOrThrow({
        where: { id },
        include: { scoutProfile: true, evaluation: true, version: true, waiver: true },
      });
      if (a.createdById !== actor.userId || a.scoutProfile.userId !== actor.userId)
        throw new ForbiddenException('Compte incompatible.');
      if (a.offlineAuthorization !== data.authorization || a.evaluationVersionId !== data.versionId)
        throw new ConflictException({
          code: 'OFFLINE_PACKAGE_CONFLICT',
          message: 'Autorisation ou version incompatible. Conservez la copie locale.',
        });
      if (a.offlineOperationId) {
        if (a.offlineOperationId !== data.operationId || a.offlinePayloadHash !== hash)
          throw new ConflictException({
            code: 'OFFLINE_ALREADY_RECEIVED',
            message: 'Une autre copie a déjà été reçue. Vos réponses officielles sont conservées.',
          });
        return;
      }
      const now = new Date();
      const eligibility = await loadEligibility(tx, {
        profile: a.scoutProfile,
        evaluation: a.evaluation,
        maxAttempts: a.version.maxAttempts,
        now,
      });
      const rejection =
        a.status !== 'EN_COURS'
          ? 'ATTEMPT_CLOSED'
          : !a.offlineExpiresAt || now > a.offlineExpiresAt
            ? 'AUTHORIZATION_EXPIRED'
            : !eligibility.allowed || (a.waiver && !isWaiverActive(a.waiver, now))
              ? 'AUTHORIZATION_REVOKED'
              : !a.evaluation.publishedVersionId ||
                  !['PUBLIE', 'ARCHIVE'].includes(a.version.status)
                ? 'VERSION_UNAVAILABLE'
                : null;
      const metadata = {
        offlineOperationId: data.operationId,
        offlinePayloadHash: hash,
        offlineDeviceSubmittedAt: new Date(data.deviceSubmittedAt),
        offlineReceivedAt: now,
        offlineDecidedAt: now,
        offlineDecisionCode: rejection ?? 'ACCEPTED',
      };
      if (rejection) {
        await tx.evaluationAttempt.update({
          where: { id },
          data: {
            ...metadata,
            ...(a.status === 'EN_COURS' && {
              status: 'ANNULEE',
              cancelledAt: now,
              cancelReason: rejection,
            }),
          },
        });
        await tx.evaluationAttemptEvent.create({
          data: {
            attemptId: id,
            actorId: actor.userId,
            fromStatus: a.status,
            toStatus: a.status === 'EN_COURS' ? 'ANNULEE' : a.status,
            snapshot: { offlineRejection: rejection },
          },
        });
        return;
      }
      const questions = await loadVersionQuestions(tx, a.evaluationVersionId);
      const answers = normalizeAnswers(questions, data.answers);
      if (answers.length !== questions.length)
        throw new ConflictException({
          code: 'OFFLINE_INCOMPLETE',
          message: 'La copie doit référencer toutes les questions, même sans réponse.',
        });
      await upsertAnswers(tx, id, answers);
      const total = await gradeObjectiveQuestions(tx, id, questions);
      await tx.evaluationAttempt.update({
        where: { id },
        data: {
          ...metadata,
          status: 'A_CORRIGER',
          submittedAt: now,
          completedAt: now,
          score: total.score,
          maxScore: total.maxScore > 0 ? total.maxScore : null,
        },
      });
      await tx.evaluationAttemptEvent.create({
        data: {
          attemptId: id,
          actorId: actor.userId,
          fromStatus: 'EN_COURS',
          toStatus: 'A_CORRIGER',
          snapshot: { offline: true, operationId: data.operationId },
        },
      });
    });
    return this.status(actor, id);
  }

  async summary(actor: Actor): Promise<OfflineStatus[]> {
    assertCan(actor, 'evaluation.take');
    const attempts = await this.prisma.evaluationAttempt.findMany({
      where: {
        mode: 'HORS_LIGNE',
        createdById: actor.userId,
        scoutProfile: { userId: actor.userId },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return attempts.map(toOfflineStatus);
  }
}

/** Statut affichable : seule une décision serveur enregistrée vaut synchronisation. */
function toOfflineStatus(a: {
  id: string;
  status: string;
  offlineDecisionCode: string | null;
  offlineReceivedAt: Date | null;
  offlineDecidedAt: Date | null;
}): OfflineStatus {
  const accepted = a.offlineDecisionCode === 'ACCEPTED';
  return {
    id: a.id,
    status: a.status,
    syncStatus: accepted ? 'SYNCHRONISE' : a.offlineDecisionCode ? 'REJETE' : 'LOCAL',
    code: a.offlineDecisionCode,
    message: accepted
      ? 'Réponses reçues par le serveur ; correction et examen humain à suivre.'
      : a.offlineDecisionCode
        ? 'Réponses refusées : autorisation expirée, révoquée ou tentative clôturée. Conservez votre copie et contactez un chef.'
        : 'Aucune réponse hors ligne acceptée par le serveur.',
    receivedAt: a.offlineReceivedAt?.toISOString() ?? null,
    decidedAt: a.offlineDecidedAt?.toISOString() ?? null,
  };
}

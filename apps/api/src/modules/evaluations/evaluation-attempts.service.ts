import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  type AttemptReasonInput,
  attemptCodeSchema,
  attemptReasonInputSchema,
  type AttemptStatus,
  type DecideAttemptInput,
  decideAttemptInputSchema,
  OPEN_ATTEMPT_STATUSES,
  type PreparePaperAttemptInput,
  preparePaperAttemptInputSchema,
  type RecordPaperResultInput,
  recordPaperResultInputSchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan, can } from '../../common/permissions.js';
import { isRecordNotFound, isUniqueViolation } from '../../common/prisma-errors.js';
import { parseInput } from '../../common/validation.js';
import { type EvaluationAttempt, type Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { scoutProfileNotFound } from '../scouts/scout-profiles.service.js';
import { TeamsService } from '../scouts/teams.service.js';
import { issueAttemptCode } from './attempt-code.js';
import { assertTransition } from './attempt-workflow.js';
import { isStageEligible, isWaiverActive } from './eligibility.js';

/** Vue d'une tentative (sans corrigé). */
const ATTEMPT_VIEW = {
  id: true,
  code: true,
  mode: true,
  status: true,
  plannedFor: true,
  completedAt: true,
  recordedAt: true,
  answers: true,
  score: true,
  maxScore: true,
  observations: true,
  decidedAt: true,
  decisionComment: true,
  cancelledAt: true,
  createdAt: true,
  scoutProfile: {
    select: { id: true, firstName: true, lastName: true, matricule: true, userId: true },
  },
  evaluation: { select: { id: true, title: true } },
  version: { select: { id: true, version: true } },
} satisfies Prisma.EvaluationAttemptSelect;

export type AttemptView = Prisma.EvaluationAttemptGetPayload<{ select: typeof ATTEMPT_VIEW }>;

/** Données d'une feuille papier nominative (RM-006). Ne contient jamais le corrigé. */
export interface PaperSheet {
  code: string;
  evaluationTitle: string;
  version: number;
  scout: { firstName: string; lastName: string; matricule: string | null };
  /** Équipe à la date de préparation (historique des affectations). */
  teamName: string | null;
  plannedFor: Date | null;
  preparedAt: Date;
  questions: Prisma.JsonValue;
}

/**
 * Tentatives d'évaluation, en particulier le circuit papier (RM-006 à RM-012).
 * Aucune méthode ne modifie l'étape de progression du routier (validation officielle exclusivement humaine).
 */
@Injectable()
export class EvaluationAttemptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teams: TeamsService,
  ) {}

  /**
   * Prépare une tentative papier : contrôle d'éligibilité, code attribué par le backend, statut PREPAREE.
   * Refusée si une tentative non clôturée existe déjà pour ce routier et cette évaluation.
   */
  async preparePaper(actor: Actor, input: PreparePaperAttemptInput): Promise<EvaluationAttempt> {
    assertCan(actor, 'attempt.preparePaper');
    const data = parseInput(preparePaperAttemptInputSchema, input);
    const now = new Date();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const profile = await tx.scoutProfile.findUnique({ where: { id: data.scoutProfileId } });
        if (!profile) throw scoutProfileNotFound();

        const version = await tx.evaluationVersion.findFirst({
          where: { id: data.evaluationVersionId, evaluationId: data.evaluationId },
          include: { evaluation: true },
        });
        if (!version) {
          throw new NotFoundException({
            code: 'EVALUATION_NOT_FOUND',
            message: 'Évaluation ou version introuvable.',
          });
        }
        if (version.publishedAt === null) {
          throw new UnprocessableEntityException({
            code: 'EVALUATION_VERSION_NOT_PUBLISHED',
            message: 'Cette version du questionnaire n’est pas publiée.',
          });
        }

        let waiverId: string | null = null;
        if (!isStageEligible(profile.currentStageId, version.evaluation.stageId)) {
          const waivers = await tx.evaluationWaiver.findMany({
            where: { scoutProfileId: profile.id, evaluationId: data.evaluationId, revokedAt: null },
            orderBy: { grantedAt: 'desc' },
          });
          const active = waivers.find((waiver) => isWaiverActive(waiver, now));
          if (!active) {
            throw new ForbiddenException({
              code: 'EVALUATION_NOT_ELIGIBLE',
              message:
                'Cette évaluation ne correspond pas à l’étape du routier et aucune dérogation n’est active.',
            });
          }
          waiverId = active.id;
        }

        const open = await tx.evaluationAttempt.findFirst({
          where: {
            scoutProfileId: profile.id,
            evaluationId: data.evaluationId,
            status: { in: [...OPEN_ATTEMPT_STATUSES] },
          },
          select: { id: true },
        });
        if (open) throw attemptAlreadyOpen();

        const attempt = await tx.evaluationAttempt.create({
          data: {
            code: await issueAttemptCode(tx, now),
            scoutProfileId: profile.id,
            evaluationId: data.evaluationId,
            evaluationVersionId: version.id,
            mode: 'PAPIER',
            status: 'PREPAREE',
            plannedFor: data.plannedFor ? new Date(data.plannedFor) : null,
            waiverId,
            createdById: actor.userId,
          },
        });
        await tx.evaluationAttemptEvent.create({
          data: {
            attemptId: attempt.id,
            actorId: actor.userId,
            fromStatus: null,
            toStatus: 'PREPAREE',
          },
        });
        return attempt;
      });
    } catch (error) {
      // Filet de sécurité concurrentiel : index unique partiel « une tentative ouverte ».
      if (isUniqueViolation(error)) throw attemptAlreadyOpen();
      throw error;
    }
  }

  /**
   * Recherche par code (RM-007). Le code n'est pas un secret : chefs et responsable uniquement,
   * ou le routier titulaire via son compte. Sinon « introuvable », sans révéler l'existence.
   */
  async findByCode(actor: Actor, rawCode: string): Promise<AttemptView> {
    const code = parseInput(attemptCodeSchema, rawCode);
    const attempt = await this.prisma.evaluationAttempt.findUnique({
      where: { code },
      select: ATTEMPT_VIEW,
    });
    if (!attempt) throw attemptNotFound();
    const isOwner = actor.role === 'ROUTIER' && attempt.scoutProfile.userId === actor.userId;
    if (!can(actor, 'attempt.readAny') && !isOwner) throw attemptNotFound();
    return attempt;
  }

  /**
   * Données d'impression d'une feuille préparée. Lecture seule : réimprimer ou retélécharger
   * ne crée jamais de nouvelle tentative.
   */
  async getPaperSheet(actor: Actor, rawCode: string): Promise<PaperSheet> {
    assertCan(actor, 'attempt.preparePaper');
    const code = parseInput(attemptCodeSchema, rawCode);
    const attempt = await this.prisma.evaluationAttempt.findUnique({
      where: { code },
      include: {
        scoutProfile: true,
        evaluation: { select: { title: true } },
        version: { select: { version: true, questions: true } },
      },
    });
    if (!attempt) throw attemptNotFound();
    if (attempt.mode !== 'PAPIER' || attempt.status !== 'PREPAREE') {
      throw new ConflictException({
        code: 'ATTEMPT_NOT_PRINTABLE',
        message: 'Seule une tentative papier en statut « Préparée » peut être imprimée.',
      });
    }
    const team = await this.teams.teamAt(attempt.scoutProfileId, attempt.createdAt);
    return {
      code: attempt.code,
      evaluationTitle: attempt.evaluation.title,
      version: attempt.version.version,
      scout: {
        firstName: attempt.scoutProfile.firstName,
        lastName: attempt.scoutProfile.lastName,
        matricule: attempt.scoutProfile.matricule,
      },
      teamName: team?.name ?? null,
      plannedFor: attempt.plannedFor,
      preparedAt: attempt.createdAt,
      questions: attempt.version.questions,
    };
  }

  /**
   * Saisie du résultat papier par un chef ou le responsable (RM-008) → statut A_CORRIGER.
   * Chaque saisie est historisée (les réponses originales restent dans l'historique) ;
   * après soumission, un motif est obligatoire et la tentative repasse en A_CORRIGER.
   */
  async recordPaperResult(
    actor: Actor,
    attemptId: string,
    input: RecordPaperResultInput,
  ): Promise<EvaluationAttempt> {
    assertCan(actor, 'attempt.record');
    const data = parseInput(recordPaperResultInputSchema, input);
    return this.transition(actor, attemptId, 'A_CORRIGER', (attempt) => {
      if (attempt.mode !== 'PAPIER') {
        throw new ConflictException({
          code: 'ATTEMPT_NOT_PAPER',
          message: 'Cette tentative n’a pas été passée sur papier.',
        });
      }
      // Un résultat déjà décidé n'est modifiable qu'après réouverture par le responsable.
      if (attempt.status === 'VALIDEE' || attempt.status === 'REFUSEE') {
        throw new ConflictException({
          code: 'ATTEMPT_ALREADY_DECIDED',
          message:
            'Ce résultat a déjà été examiné par le responsable : une réouverture est nécessaire.',
        });
      }
      if (attempt.status === 'SOUMISE' && !data.reason) throw reasonRequired();
      const values = {
        completedAt: new Date(data.completedAt),
        answers: data.answers,
        score: data.score ?? null,
        maxScore: data.maxScore ?? null,
        observations: data.observations ?? null,
        evidenceFileKey: data.evidenceFileKey ?? null,
      };
      return {
        data: { ...values, recordedAt: new Date(), recordedById: actor.userId },
        reason: data.reason,
        snapshot: { ...values, completedAt: data.completedAt },
      };
    });
  }

  /** Soumission au responsable pédagogique. */
  async submit(actor: Actor, attemptId: string): Promise<EvaluationAttempt> {
    assertCan(actor, 'attempt.submit');
    return this.transition(actor, attemptId, 'SOUMISE', (attempt) => {
      if (attempt.recordedAt === null) {
        throw new UnprocessableEntityException({
          code: 'ATTEMPT_RESULT_MISSING',
          message: 'Le résultat doit être saisi avant la soumission.',
        });
      }
      return { data: {} };
    });
  }

  /**
   * Décision pédagogique du responsable sur un résultat soumis (RM-010).
   * Ne valide jamais une étape et ne modifie pas la progression du routier.
   */
  async decide(
    actor: Actor,
    attemptId: string,
    input: DecideAttemptInput,
  ): Promise<EvaluationAttempt> {
    assertCan(actor, 'attempt.decide');
    const data = parseInput(decideAttemptInputSchema, input);
    return this.transition(
      actor,
      attemptId,
      data.decision,
      () => ({
        data: {
          decidedById: actor.userId,
          decidedAt: new Date(),
          decisionComment: data.comment ?? null,
        },
        reason: data.comment,
      }),
      'evaluation_attempt.decided',
    );
  }

  /** Annulation : la tentative et son code restent dans l'historique. */
  async cancel(
    actor: Actor,
    attemptId: string,
    input: AttemptReasonInput,
  ): Promise<EvaluationAttempt> {
    assertCan(actor, 'attempt.cancel');
    const { reason } = parseInput(attemptReasonInputSchema, input);
    return this.transition(
      actor,
      attemptId,
      'ANNULEE',
      () => ({ data: { cancelledAt: new Date(), cancelReason: reason }, reason }),
      'evaluation_attempt.cancelled',
    );
  }

  /** Réouverture administrative d'une tentative déjà décidée (responsable, motif obligatoire). */
  async reopen(
    actor: Actor,
    attemptId: string,
    input: AttemptReasonInput,
  ): Promise<EvaluationAttempt> {
    assertCan(actor, 'attempt.reopen');
    const { reason } = parseInput(attemptReasonInputSchema, input);
    return this.transition(
      actor,
      attemptId,
      'A_CORRIGER',
      (attempt) => {
        if (attempt.status !== 'VALIDEE' && attempt.status !== 'REFUSEE') {
          throw new ConflictException({
            code: 'INVALID_ATTEMPT_TRANSITION',
            message: 'Seule une tentative déjà décidée peut être rouverte.',
          });
        }
        return {
          data: { decidedById: null, decidedAt: null, decisionComment: null },
          reason,
          snapshot: {
            previousDecision: attempt.status,
            previousDecidedById: attempt.decidedById,
            previousDecidedAt: attempt.decidedAt?.toISOString() ?? null,
            previousComment: attempt.decisionComment,
          },
        };
      },
      'evaluation_attempt.reopened',
    );
  }

  /**
   * Changement d'état transactionnel : contrôle de la transition, mise à jour conditionnée au statut lu
   * (une modification concurrente provoque un conflit), événement d'historique et, si demandé, AuditLog.
   */
  private async transition(
    actor: Actor,
    attemptId: string,
    to: AttemptStatus,
    prepare: (attempt: EvaluationAttempt) => {
      data: Prisma.EvaluationAttemptUncheckedUpdateInput;
      reason?: string | undefined;
      snapshot?: Prisma.InputJsonValue;
    },
    auditAction?: string,
  ): Promise<EvaluationAttempt> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const attempt = await tx.evaluationAttempt.findUnique({ where: { id: attemptId } });
        if (!attempt) throw attemptNotFound();
        assertTransition(attempt.status, to);
        const { data, reason, snapshot } = prepare(attempt);

        const updated = await tx.evaluationAttempt.update({
          where: { id: attemptId, status: attempt.status },
          data: { ...data, status: to },
        });
        await tx.evaluationAttemptEvent.create({
          data: {
            attemptId,
            actorId: actor.userId,
            fromStatus: attempt.status,
            toStatus: to,
            reason: reason ?? null,
            ...(snapshot === undefined ? {} : { snapshot }),
          },
        });
        if (auditAction) {
          await tx.auditLog.create({
            data: {
              actorId: actor.userId,
              action: auditAction,
              entityType: 'EvaluationAttempt',
              entityId: attemptId,
              metadata: { code: attempt.code, from: attempt.status, to },
            },
          });
        }
        return updated;
      });
    } catch (error) {
      if (isRecordNotFound(error)) {
        throw new ConflictException({
          code: 'ATTEMPT_STATE_CHANGED',
          message: 'La tentative a été modifiée entre-temps. Rechargez-la puis recommencez.',
        });
      }
      // Réouverture alors qu'une nouvelle tentative est déjà ouverte pour cette évaluation.
      if (isUniqueViolation(error)) throw attemptAlreadyOpen();
      throw error;
    }
  }
}

function attemptNotFound(): NotFoundException {
  return new NotFoundException({ code: 'ATTEMPT_NOT_FOUND', message: 'Tentative introuvable.' });
}

function attemptAlreadyOpen(): ConflictException {
  return new ConflictException({
    code: 'ATTEMPT_ALREADY_OPEN',
    message: 'Une tentative non clôturée existe déjà pour ce routier et cette évaluation.',
  });
}

function reasonRequired(): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code: 'REASON_REQUIRED',
    message: 'Un motif est obligatoire pour corriger un résultat déjà soumis.',
  });
}

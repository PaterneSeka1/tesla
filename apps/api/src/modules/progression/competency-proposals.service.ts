import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  type AddEvidenceInput,
  addEvidenceInputSchema,
  type CompetencyValidation,
  type CreateProposalInput,
  createProposalInputSchema,
  type EvidenceInput,
  type Paginated,
  type Proposal,
  type ProposalAction,
  type ProposalAuthorActionInput,
  proposalAuthorActionInputSchema,
  type ProposalDecisionInput,
  proposalDecisionInputSchema,
  type ProposalListQuery,
  proposalListQuerySchema,
  type ProposalStatus,
  type RevokeValidationInput,
  revokeValidationInputSchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan, can } from '../../common/permissions.js';
import { isUniqueViolation } from '../../common/prisma-errors.js';
import { parseInput } from '../../common/validation.js';
import { type Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { toStageSummary, toUserSummary, userSummarySelect } from '../scouts/presenters.js';
import {
  describeEvidence,
  evidenceInclude,
  revisionConflict,
  scoutProfileNotFound,
  scoutRefInclude,
  toEvidence,
  toScoutRef,
  toValidation,
  validationInclude,
} from './progression-common.js';

type Tx = Prisma.TransactionClient;

const proposalInclude = {
  scoutProfile: { include: { ...scoutRefInclude, currentStage: true } },
  competency: { include: { stage: true } },
  proposedBy: userSummarySelect,
  decidedBy: userSummarySelect,
  evidences: { include: evidenceInclude, orderBy: { createdAt: 'asc' } },
  events: { include: { actor: userSummarySelect }, orderBy: { createdAt: 'asc' } },
  validation: { select: { id: true, decision: true, revokedAt: true } },
} as const satisfies Prisma.CompetencyProposalInclude;

type ProposalRow = Prisma.CompetencyProposalGetPayload<{ include: typeof proposalInclude }>;

const OPEN_STATUSES: ProposalStatus[] = ['EN_ATTENTE', 'COMPLEMENT_DEMANDE'];
const CLOSED_STATUSES: ProposalStatus[] = ['APPROUVEE', 'REFUSEE', 'RETIREE'];

function proposalNotFound(): NotFoundException {
  return new NotFoundException({ code: 'PROPOSAL_NOT_FOUND', message: 'Proposition introuvable.' });
}

function invalidProposalStatus(status: ProposalStatus): ConflictException {
  return new ConflictException({
    code: 'INVALID_PROPOSAL_STATUS',
    message: `Action impossible : la proposition est à l’état « ${status} ».`,
  });
}

function invalidEvidence(message: string): UnprocessableEntityException {
  return new UnprocessableEntityException({ code: 'INVALID_EVIDENCE', message });
}

/**
 * Circuit de validation des compétences : un chef observe et propose (preuves à l'appui) ; seul le
 * responsable décide (acquis, complément, refus) et peut révoquer une décision avec motif. Aucune
 * proposition ni validation n'est créée automatiquement (un quiz réussi ne suffit jamais).
 */
@Injectable()
export class CompetencyProposalsService {
  constructor(private readonly prisma: PrismaService) {}

  private toProposal(actor: Actor, row: ProposalRow): Proposal {
    const isOpen = OPEN_STATUSES.includes(row.status);
    return {
      id: row.id,
      status: row.status,
      scout: {
        ...toScoutRef(row.scoutProfile),
        stage: toStageSummary(row.scoutProfile.currentStage),
      },
      competency: {
        id: row.competency.id,
        code: row.competency.code,
        name: row.competency.name,
        minEvidenceCount: row.competency.minEvidenceCount,
        stage: toStageSummary(row.competency.stage),
        observableCriteria: row.competency.observableCriteria,
      },
      proposedBy: toUserSummary(row.proposedBy)!,
      justification: row.justification,
      decisionComment: row.decisionComment,
      decidedBy: toUserSummary(row.decidedBy),
      decidedAt: row.decidedAt?.toISOString() ?? null,
      revision: row.revision,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      evidences: row.evidences.map(toEvidence),
      events: row.events.map((event) => ({
        id: event.id,
        action: event.action,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        comment: event.comment,
        actor: toUserSummary(event.actor)!,
        createdAt: event.createdAt.toISOString(),
      })),
      validation: row.validation && {
        id: row.validation.id,
        decision: row.validation.decision,
        revokedAt: row.validation.revokedAt?.toISOString() ?? null,
      },
      canDecide: row.status === 'EN_ATTENTE' && can(actor, 'competency.decide'),
      canEdit: isOpen && (row.proposedById === actor.userId || can(actor, 'competency.decide')),
    };
  }

  async list(actor: Actor, query: ProposalListQuery): Promise<Paginated<Proposal>> {
    assertCan(actor, 'competency.propose');
    const { page, pageSize, status, scoutProfileId, competencyId, mine } = parseInput(
      proposalListQuerySchema,
      query,
    );
    const statuses =
      status === 'open'
        ? OPEN_STATUSES
        : status === 'closed'
          ? CLOSED_STATUSES
          : status === 'all'
            ? null
            : [status];
    const where: Prisma.CompetencyProposalWhereInput = {
      ...(statuses && { status: { in: statuses } }),
      ...(scoutProfileId && { scoutProfileId }),
      ...(competencyId && { competencyId }),
      ...(mine === 'true' && { proposedById: actor.userId }),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.competencyProposal.count({ where }),
      this.prisma.competencyProposal.findMany({
        where,
        include: proposalInclude,
        // Les plus anciennes en premier : file d'attente chronologique, sans classement des routiers.
        orderBy: status === 'open' ? { createdAt: 'asc' } : { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items: rows.map((row) => this.toProposal(actor, row)), page, pageSize, total };
  }

  async get(actor: Actor, id: string): Promise<Proposal> {
    assertCan(actor, 'competency.propose');
    const row = await this.prisma.competencyProposal.findUnique({
      where: { id },
      include: proposalInclude,
    });
    if (!row) throw proposalNotFound();
    return this.toProposal(actor, row);
  }

  /** Vérifie que chaque élément existe, concerne ce routier et est consultable par l'auteur. */
  private async createEvidences(
    tx: Tx,
    actor: Actor,
    proposalId: string,
    scoutProfileId: string,
    evidences: EvidenceInput[],
  ): Promise<void> {
    for (const evidence of evidences) {
      const base = { proposalId, kind: evidence.kind, addedById: actor.userId };
      switch (evidence.kind) {
        case 'OBSERVATION': {
          const observation = await tx.scoutObservation.findUnique({
            where: { id: evidence.observationId },
          });
          const readable =
            observation &&
            (observation.visibility === 'ENCADREMENT' ||
              observation.authorId === actor.userId ||
              can(actor, 'observation.readRestricted'));
          if (!observation || observation.scoutProfileId !== scoutProfileId || !readable) {
            throw invalidEvidence('Observation introuvable pour ce routier.');
          }
          await tx.competencyEvidence.create({ data: { ...base, observationId: observation.id } });
          break;
        }
        case 'EVALUATION': {
          const attempt = await tx.evaluationAttempt.findUnique({
            where: { id: evidence.attemptId },
          });
          if (!attempt || attempt.scoutProfileId !== scoutProfileId) {
            throw invalidEvidence('Tentative d’évaluation introuvable pour ce routier.');
          }
          if (attempt.status === 'ANNULEE') {
            throw invalidEvidence('Une tentative annulée ne peut pas servir de justificatif.');
          }
          await tx.competencyEvidence.create({ data: { ...base, attemptId: attempt.id } });
          break;
        }
        case 'ACTIVITE': {
          const attendance = await tx.activityAttendance.findUnique({
            where: {
              activityId_scoutProfileId: { activityId: evidence.activityId, scoutProfileId },
            },
          });
          if (attendance?.status !== 'PRESENT') {
            throw invalidEvidence('Le routier n’est pas enregistré présent à cette activité.');
          }
          await tx.competencyEvidence.create({
            data: { ...base, activityId: evidence.activityId },
          });
          break;
        }
        case 'ETUDE_MODULE': {
          const study = await tx.moduleStudy.findUnique({ where: { id: evidence.moduleStudyId } });
          if (!study || study.scoutProfileId !== scoutProfileId || study.cancelledAt) {
            throw invalidEvidence('Étude de module introuvable pour ce routier.');
          }
          await tx.competencyEvidence.create({ data: { ...base, moduleStudyId: study.id } });
          break;
        }
        case 'AUTRE':
          await tx.competencyEvidence.create({
            data: { ...base, description: evidence.description },
          });
          break;
      }
    }
  }

  private async assertEnoughEvidence(tx: Tx, proposalId: string, minimum: number): Promise<void> {
    const count = await tx.competencyEvidence.count({ where: { proposalId } });
    if (count < minimum) {
      throw new UnprocessableEntityException({
        code: 'NOT_ENOUGH_EVIDENCE',
        message: `Cette compétence exige au moins ${minimum} élément${minimum > 1 ? 's' : ''} justificatif${minimum > 1 ? 's' : ''} (actuellement ${count}).`,
      });
    }
  }

  private recordEvent(
    tx: Tx,
    actor: Actor,
    proposalId: string,
    action: ProposalAction,
    fromStatus: ProposalStatus | null,
    toStatus: ProposalStatus,
    comment: string | null,
  ) {
    return tx.competencyProposalEvent.create({
      data: { proposalId, actorId: actor.userId, action, fromStatus, toStatus, comment },
    });
  }

  /** Verrouille la proposition et contrôle la révision lue (concurrence optimiste). */
  private async lock(tx: Tx, id: string, revision: number) {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM competency_proposals WHERE id = ${id}::uuid FOR UPDATE`;
    if (rows.length === 0) throw proposalNotFound();
    const proposal = await tx.competencyProposal.findUniqueOrThrow({
      where: { id },
      include: { competency: true },
    });
    if (proposal.revision !== revision) throw revisionConflict();
    return proposal;
  }

  private assertAuthor(actor: Actor, proposal: { proposedById: string }): void {
    if (proposal.proposedById !== actor.userId && !can(actor, 'competency.decide')) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Seul l’auteur de la proposition ou le responsable peut la modifier.',
      });
    }
  }

  async create(actor: Actor, input: CreateProposalInput): Promise<Proposal> {
    assertCan(actor, 'competency.propose');
    const data = parseInput(createProposalInputSchema, input);
    try {
      const id = await this.prisma.$transaction(async (tx) => {
        const scout = await tx.scoutProfile.findUnique({ where: { id: data.scoutProfileId } });
        if (!scout) throw scoutProfileNotFound();
        if (!scout.isActive) {
          throw new ConflictException({
            code: 'SCOUT_INACTIVE',
            message: 'Ce profil est désactivé.',
          });
        }
        const competency = await tx.competency.findUnique({ where: { id: data.competencyId } });
        if (!competency?.isActive) {
          throw new UnprocessableEntityException({
            code: 'COMPETENCY_NOT_AVAILABLE',
            message: 'Compétence introuvable ou désactivée.',
          });
        }
        const acquired = await tx.competencyValidation.findFirst({
          where: {
            scoutProfileId: scout.id,
            competencyId: competency.id,
            decision: 'ACQUIS',
            revokedAt: null,
          },
        });
        if (acquired) {
          throw new ConflictException({
            code: 'COMPETENCY_ALREADY_ACQUIRED',
            message: 'Cette compétence est déjà officiellement validée pour ce routier.',
          });
        }
        const proposal = await tx.competencyProposal.create({
          data: {
            scoutProfileId: scout.id,
            competencyId: competency.id,
            proposedById: actor.userId,
            justification: data.justification,
          },
        });
        await this.createEvidences(tx, actor, proposal.id, scout.id, data.evidences);
        await this.assertEnoughEvidence(tx, proposal.id, competency.minEvidenceCount);
        await this.recordEvent(tx, actor, proposal.id, 'SOUMISE', null, 'EN_ATTENTE', null);
        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            action: 'competency.proposed',
            entityType: 'CompetencyProposal',
            entityId: proposal.id,
            metadata: { scoutProfileId: scout.id, competencyId: competency.id },
          },
        });
        return proposal.id;
      });
      return this.get(actor, id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'PROPOSAL_ALREADY_OPEN',
          message: 'Une proposition est déjà en cours pour ce routier et cette compétence.',
        });
      }
      throw error;
    }
  }

  async addEvidence(actor: Actor, id: string, input: AddEvidenceInput): Promise<Proposal> {
    assertCan(actor, 'competency.propose');
    const data = parseInput(addEvidenceInputSchema, input);
    await this.prisma.$transaction(async (tx) => {
      const proposal = await this.lock(tx, id, data.revision);
      this.assertAuthor(actor, proposal);
      if (!OPEN_STATUSES.includes(proposal.status)) throw invalidProposalStatus(proposal.status);
      await this.createEvidences(tx, actor, id, proposal.scoutProfileId, data.evidences);
      await tx.competencyProposal.update({ where: { id }, data: { revision: { increment: 1 } } });
      await this.recordEvent(
        tx,
        actor,
        id,
        'PREUVE_AJOUTEE',
        proposal.status,
        proposal.status,
        `${data.evidences.length} élément(s) ajouté(s)`,
      );
    });
    return this.get(actor, id);
  }

  /** Après une demande de complément : nouvelle soumission au responsable. */
  async resubmit(actor: Actor, id: string, input: ProposalAuthorActionInput): Promise<Proposal> {
    assertCan(actor, 'competency.propose');
    const data = parseInput(proposalAuthorActionInputSchema, input);
    await this.prisma.$transaction(async (tx) => {
      const proposal = await this.lock(tx, id, data.revision);
      this.assertAuthor(actor, proposal);
      if (proposal.status !== 'COMPLEMENT_DEMANDE') throw invalidProposalStatus(proposal.status);
      await this.assertEnoughEvidence(tx, id, proposal.competency.minEvidenceCount);
      await tx.competencyProposal.update({
        where: { id },
        data: { status: 'EN_ATTENTE', revision: { increment: 1 } },
      });
      await this.recordEvent(
        tx,
        actor,
        id,
        'RESOUMISE',
        proposal.status,
        'EN_ATTENTE',
        data.comment ?? null,
      );
    });
    return this.get(actor, id);
  }

  async withdraw(actor: Actor, id: string, input: ProposalAuthorActionInput): Promise<Proposal> {
    assertCan(actor, 'competency.propose');
    const data = parseInput(proposalAuthorActionInputSchema, input);
    await this.prisma.$transaction(async (tx) => {
      const proposal = await this.lock(tx, id, data.revision);
      this.assertAuthor(actor, proposal);
      if (!OPEN_STATUSES.includes(proposal.status)) throw invalidProposalStatus(proposal.status);
      await tx.competencyProposal.update({
        where: { id },
        data: { status: 'RETIREE', revision: { increment: 1 } },
      });
      await this.recordEvent(
        tx,
        actor,
        id,
        'RETIREE',
        proposal.status,
        'RETIREE',
        data.comment ?? null,
      );
    });
    return this.get(actor, id);
  }

  /**
   * Décision officielle du responsable. `APPROUVEE` crée la validation ACQUIS ; `REFUSEE` crée une
   * décision « à retravailler » ; `COMPLEMENT_DEMANDE` renvoie la proposition à son auteur. Tout est
   * écrit dans une seule transaction avec l'historique et le journal d'audit.
   */
  async decide(
    actor: Actor,
    id: string,
    decision: 'APPROUVEE' | 'REFUSEE' | 'COMPLEMENT_DEMANDE',
    input: ProposalDecisionInput,
  ): Promise<Proposal> {
    assertCan(actor, 'competency.decide');
    const data = parseInput(proposalDecisionInputSchema, input);
    try {
      await this.prisma.$transaction(async (tx) => {
        const proposal = await this.lock(tx, id, data.revision);
        if (proposal.status !== 'EN_ATTENTE') throw invalidProposalStatus(proposal.status);
        const now = new Date();
        await tx.competencyProposal.update({
          where: { id },
          data: {
            status: decision,
            decisionComment: data.comment,
            decidedById: actor.userId,
            decidedAt: now,
            revision: { increment: 1 },
          },
        });
        if (decision !== 'COMPLEMENT_DEMANDE') {
          const evidences = await tx.competencyEvidence.findMany({
            where: { proposalId: id },
            include: evidenceInclude,
          });
          await tx.competencyValidation.create({
            data: {
              scoutProfileId: proposal.scoutProfileId,
              competencyId: proposal.competencyId,
              proposalId: id,
              decision: decision === 'APPROUVEE' ? 'ACQUIS' : 'A_RETRAVAILLER',
              justification: data.comment,
              examinedEvidence: evidences.map((row) => ({
                id: row.id,
                kind: row.kind,
                ...describeEvidence(row),
              })),
              decidedById: actor.userId,
              decidedAt: now,
            },
          });
        }
        const action: ProposalAction =
          decision === 'APPROUVEE'
            ? 'APPROUVEE'
            : decision === 'REFUSEE'
              ? 'REFUSEE'
              : 'COMPLEMENT_DEMANDE';
        await this.recordEvent(tx, actor, id, action, 'EN_ATTENTE', decision, data.comment);
        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            action:
              decision === 'APPROUVEE'
                ? 'competency.validated'
                : decision === 'REFUSEE'
                  ? 'competency.rejected'
                  : 'competency.complement_requested',
            entityType: 'CompetencyProposal',
            entityId: id,
            metadata: {
              scoutProfileId: proposal.scoutProfileId,
              competencyId: proposal.competencyId,
            },
          },
        });
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'COMPETENCY_ALREADY_ACQUIRED',
          message: 'Cette compétence est déjà officiellement validée pour ce routier.',
        });
      }
      throw error;
    }
    return this.get(actor, id);
  }

  /** Révocation motivée d'une décision officielle (correction tracée ; la décision reste visible). */
  async revokeValidation(
    actor: Actor,
    validationId: string,
    input: RevokeValidationInput,
  ): Promise<CompetencyValidation> {
    assertCan(actor, 'competency.decide');
    const { reason } = parseInput(revokeValidationInputSchema, input);
    return this.prisma.$transaction(async (tx) => {
      const validation = await tx.competencyValidation.findUnique({ where: { id: validationId } });
      if (!validation) {
        throw new NotFoundException({
          code: 'VALIDATION_NOT_FOUND',
          message: 'Décision introuvable.',
        });
      }
      const { count } = await tx.competencyValidation.updateMany({
        where: { id: validationId, revokedAt: null },
        data: { revokedAt: new Date(), revokedById: actor.userId, revocationReason: reason },
      });
      if (count === 0) {
        throw new ConflictException({
          code: 'VALIDATION_ALREADY_REVOKED',
          message: 'Cette décision est déjà révoquée.',
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: 'competency.validation_revoked',
          entityType: 'CompetencyValidation',
          entityId: validationId,
          metadata: {
            scoutProfileId: validation.scoutProfileId,
            competencyId: validation.competencyId,
            decision: validation.decision,
            reason,
          },
        },
      });
      return toValidation(
        await tx.competencyValidation.findUniqueOrThrow({
          where: { id: validationId },
          include: validationInclude,
        }),
      );
    });
  }
}

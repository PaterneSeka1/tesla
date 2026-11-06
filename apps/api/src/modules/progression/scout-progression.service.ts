import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  type CancelModuleStudyInput,
  cancelModuleStudyInputSchema,
  computeCompetencyStatus,
  type DeclareModuleStudyInput,
  declareModuleStudyInputSchema,
  type ModuleStudy,
  type MyProgression,
  type RecordModuleStudyInput,
  recordModuleStudyInputSchema,
  type ScoutCompetencyItem,
  type ScoutProgression,
  type ScoutTimeline,
  STAGE_CHANGE_KIND_LABELS,
  STUDY_MODE_LABELS,
  type TimelineKind,
  type UserSummary,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan, can } from '../../common/permissions.js';
import { isUniqueViolation } from '../../common/prisma-errors.js';
import { parseInput } from '../../common/validation.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  toIsoDate,
  toStageSummary,
  toUserSummary,
  userSummarySelect,
} from '../scouts/presenters.js';
import {
  isoToDate,
  moduleStudyInclude,
  scoutProfileNotFound,
  scoutProfileNotLinked,
  scoutRefInclude,
  stageChangeInclude,
  todayIso,
  toModuleRef,
  toModuleStudy,
  toScoutRef,
  toStageChange,
  toValidation,
  validationInclude,
  moduleRefSelect,
} from './progression-common.js';
import { computedStageOf, loadStageContext } from './computed-stage.js';

const toNumber = (value: { toNumber(): number } | null) =>
  value === null ? null : value.toNumber();

/**
 * Dossier de progression d'un routier (avec ou sans compte) : étapes, compétences, études de
 * modules, évaluations, présences. L'étape est calculée selon l'âge (D173) ; aucune action ne la
 * modifie. Les décisions d'étape antérieures restent consultables.
 */
@Injectable()
export class ScoutProgressionService {
  constructor(private readonly prisma: PrismaService) {}

  // Le changement manuel d'étape est supprimé (D173) : l'étape est calculée selon l'âge
  // (`computed-stage.ts`) ; l'historique des décisions antérieures reste consultable.

  // ─── Études de modules ────────────────────────────────────────────────────

  /** Étude enregistrée par l'encadrement (routier avec ou sans compte). Jamais une validation. */
  async recordStudy(
    actor: Actor,
    scoutProfileId: string,
    input: RecordModuleStudyInput,
  ): Promise<ModuleStudy> {
    assertCan(actor, 'moduleStudy.record');
    const data = parseInput(recordModuleStudyInputSchema, input);
    if (data.studiedOn > todayIso()) {
      throw new UnprocessableEntityException({
        code: 'STUDY_DATE_IN_FUTURE',
        message: 'La date d’étude ne peut pas être postérieure à aujourd’hui.',
      });
    }
    const profile = await this.prisma.scoutProfile.findUnique({ where: { id: scoutProfileId } });
    if (!profile) throw scoutProfileNotFound();
    if (data.activityId) {
      const activity = await this.prisma.activity.findUnique({ where: { id: data.activityId } });
      if (!activity) {
        throw new NotFoundException({
          code: 'ACTIVITY_NOT_FOUND',
          message: 'Activité introuvable.',
        });
      }
    }
    return this.createStudy({
      scoutProfileId,
      moduleId: data.moduleId,
      mode: data.mode,
      studiedOn: data.studiedOn,
      activityId: data.activityId ?? null,
      observation: data.observation ?? null,
      recordedById: actor.userId,
    });
  }

  /** Déclaration par le routier de sa lecture numérique (version publiée, date du jour). */
  async declareStudy(actor: Actor, input: DeclareModuleStudyInput): Promise<ModuleStudy> {
    assertCan(actor, 'moduleStudy.declare');
    const data = parseInput(declareModuleStudyInputSchema, input);
    const profile = await this.prisma.scoutProfile.findUnique({ where: { userId: actor.userId } });
    if (!profile) throw scoutProfileNotLinked();
    return this.createStudy({
      scoutProfileId: profile.id,
      moduleId: data.moduleId,
      mode: 'LECTURE_NUMERIQUE',
      studiedOn: todayIso(),
      activityId: null,
      observation: null,
      recordedById: actor.userId,
    });
  }

  private async createStudy(data: {
    scoutProfileId: string;
    moduleId: string;
    mode: ModuleStudy['mode'];
    studiedOn: string;
    activityId: string | null;
    observation: string | null;
    recordedById: string;
  }): Promise<ModuleStudy> {
    const module = await this.prisma.pedagogicalModule.findUnique({
      where: { id: data.moduleId },
      select: { publishedVersionId: true },
    });
    if (!module) {
      throw new NotFoundException({ code: 'MODULE_NOT_FOUND', message: 'Module introuvable.' });
    }
    if (!module.publishedVersionId) {
      throw new UnprocessableEntityException({
        code: 'MODULE_NOT_PUBLISHED',
        message: 'Seul un module publié peut être enregistré comme étudié.',
      });
    }
    try {
      const study = await this.prisma.moduleStudy.create({
        data: {
          ...data,
          moduleVersionId: module.publishedVersionId,
          studiedOn: isoToDate(data.studiedOn),
        },
        include: moduleStudyInclude,
      });
      return toModuleStudy(study);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'STUDY_ALREADY_RECORDED',
          message: 'Cette étude est déjà enregistrée pour cette date et cette modalité.',
        });
      }
      throw error;
    }
  }

  /** Annulation motivée d'une saisie erronée (auteur ou responsable) ; la ligne est conservée. */
  async cancelStudy(
    actor: Actor,
    studyId: string,
    input: CancelModuleStudyInput,
  ): Promise<ModuleStudy> {
    assertCan(actor, 'moduleStudy.record');
    const { reason } = parseInput(cancelModuleStudyInputSchema, input);
    return this.prisma.$transaction(async (tx) => {
      const study = await tx.moduleStudy.findUnique({ where: { id: studyId } });
      if (!study) {
        throw new NotFoundException({ code: 'STUDY_NOT_FOUND', message: 'Étude introuvable.' });
      }
      if (study.recordedById !== actor.userId && !can(actor, 'scout.update')) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'Seul l’auteur de la saisie ou le responsable peut l’annuler.',
        });
      }
      const { count } = await tx.moduleStudy.updateMany({
        where: { id: studyId, cancelledAt: null },
        data: { cancelledAt: new Date(), cancelledById: actor.userId, cancelReason: reason },
      });
      if (count === 0) {
        throw new ConflictException({
          code: 'STUDY_ALREADY_CANCELLED',
          message: 'Cette étude est déjà annulée.',
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: 'module_study.cancelled',
          entityType: 'ScoutProfile',
          entityId: study.scoutProfileId,
          metadata: { studyId, reason },
        },
      });
      return toModuleStudy(
        await tx.moduleStudy.findUniqueOrThrow({
          where: { id: studyId },
          include: moduleStudyInclude,
        }),
      );
    });
  }

  // ─── Dossier complet ──────────────────────────────────────────────────────

  async progression(actor: Actor, scoutProfileId: string): Promise<ScoutProgression> {
    const scoresVisible = (status: string) =>
      status === 'VALIDEE' || can(actor, 'attempt.answerKey');
    assertCan(actor, 'progression.read');
    const profile = await this.prisma.scoutProfile.findUnique({
      where: { id: scoutProfileId },
      include: scoutRefInclude,
    });
    if (!profile) throw scoutProfileNotFound();
    const computed = computedStageOf(profile, await loadStageContext(this.prisma));

    const [stageChanges, competencies, validations, proposals, studies, attempts, attendances] =
      await Promise.all([
        this.prisma.scoutStageChange.findMany({
          where: { scoutProfileId },
          include: stageChangeInclude,
          orderBy: { decidedAt: 'desc' },
        }),
        this.loadCompetencyItems(scoutProfileId),
        this.prisma.competencyValidation.findMany({
          where: { scoutProfileId },
          include: validationInclude,
          orderBy: { decidedAt: 'desc' },
        }),
        this.prisma.competencyProposal.findMany({
          where: { scoutProfileId },
          include: {
            competency: { select: { id: true, code: true, name: true } },
            proposedBy: userSummarySelect,
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.moduleStudy.findMany({
          where: { scoutProfileId },
          include: moduleStudyInclude,
          orderBy: [{ studiedOn: 'desc' }, { createdAt: 'desc' }],
        }),
        this.prisma.evaluationAttempt.findMany({
          where: { scoutProfileId },
          include: { evaluation: { select: { title: true } } },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.activityAttendance.findMany({
          where: { scoutProfileId },
          include: {
            activity: { select: { id: true, title: true, plannedOn: true, heldOn: true } },
          },
        }),
      ]);

    const sortedAttendances = attendances.sort(
      (a, b) =>
        (b.activity.heldOn ?? b.activity.plannedOn).getTime() -
        (a.activity.heldOn ?? a.activity.plannedOn).getTime(),
    );
    const countStatus = (status: 'PRESENT' | 'ABSENT' | 'EXCUSE') =>
      attendances.filter((row) => row.status === status).length;

    return {
      scout: {
        ...toScoutRef(profile),
        isActive: profile.isActive,
        hasAccount: profile.userId !== null,
        stage: toStageSummary(computed.stage),
        stageSince: computed.stage ? (computed.progression.period?.startsOn ?? null) : null,
      },
      stageChanges: stageChanges.map(toStageChange),
      competencies,
      validations: validations.map(toValidation),
      proposals: proposals.map((proposal) => ({
        id: proposal.id,
        status: proposal.status,
        competency: proposal.competency,
        proposedBy: toUserSummary(proposal.proposedBy)!,
        createdAt: proposal.createdAt.toISOString(),
        decidedAt: proposal.decidedAt?.toISOString() ?? null,
      })),
      moduleStudies: studies.map(toModuleStudy),
      attempts: attempts.map((attempt) => ({
        id: attempt.id,
        code: attempt.code,
        evaluationTitle: attempt.evaluation.title,
        mode: attempt.mode,
        status: attempt.status,
        // Note non publiée : responsable plein seulement (D161).
        score: scoresVisible(attempt.status) ? toNumber(attempt.score) : null,
        maxScore: scoresVisible(attempt.status) ? toNumber(attempt.maxScore) : null,
        completedAt: attempt.completedAt?.toISOString() ?? null,
        createdAt: attempt.createdAt.toISOString(),
      })),
      attendance: {
        present: countStatus('PRESENT'),
        absent: countStatus('ABSENT'),
        excused: countStatus('EXCUSE'),
        recent: sortedAttendances.slice(0, 20).map((row) => ({
          activity: {
            id: row.activity.id,
            title: row.activity.title,
            plannedOn: toIsoDate(row.activity.plannedOn),
            heldOn: row.activity.heldOn ? toIsoDate(row.activity.heldOn) : null,
          },
          status: row.status,
          note: row.note,
        })),
      },
      canDecide: can(actor, 'competency.decide'),
    };
  }

  /**
   * Statut de chaque compétence pertinente : compétences actives du référentiel et toute compétence
   * ayant déjà fait l'objet d'une proposition ou d'une décision pour ce routier.
   */
  private async loadCompetencyItems(scoutProfileId: string): Promise<ScoutCompetencyItem[]> {
    const [competencies, validations, proposals, studies, attendances] = await Promise.all([
      this.prisma.competency.findMany({
        where: {
          OR: [
            { isActive: true },
            { proposals: { some: { scoutProfileId } } },
            { validations: { some: { scoutProfileId } } },
          ],
        },
        include: {
          stage: true,
          modules: { select: { moduleId: true } },
          activities: { select: { activityId: true } },
        },
        orderBy: [{ position: 'asc' }, { code: 'asc' }],
      }),
      this.prisma.competencyValidation.findMany({
        where: { scoutProfileId, revokedAt: null },
        orderBy: { decidedAt: 'desc' },
      }),
      this.prisma.competencyProposal.findMany({
        where: { scoutProfileId },
        select: { id: true, competencyId: true, status: true },
      }),
      this.prisma.moduleStudy.findMany({
        where: { scoutProfileId, cancelledAt: null },
        select: { moduleId: true },
      }),
      this.prisma.activityAttendance.findMany({
        where: { scoutProfileId, status: 'PRESENT' },
        select: { activityId: true },
      }),
    ]);
    const studiedModules = new Set(studies.map((study) => study.moduleId));
    const attendedActivities = new Set(attendances.map((row) => row.activityId));

    return competencies.map((competency) => {
      const own = validations.filter((row) => row.competencyId === competency.id);
      const acquired = own.find((row) => row.decision === 'ACQUIS');
      const open = proposals.find(
        (row) =>
          row.competencyId === competency.id &&
          (row.status === 'EN_ATTENTE' || row.status === 'COMPLEMENT_DEMANDE'),
      );
      const hasWork =
        competency.modules.some((link) => studiedModules.has(link.moduleId)) ||
        competency.activities.some((link) => attendedActivities.has(link.activityId)) ||
        proposals.some((row) => row.competencyId === competency.id && row.status === 'RETIREE');
      return {
        competency: {
          id: competency.id,
          code: competency.code,
          name: competency.name,
          domain: competency.domain,
          stage: toStageSummary(competency.stage),
          isActive: competency.isActive,
        },
        status: computeCompetencyStatus({
          hasActiveAcquired: acquired !== undefined,
          openProposal: open ? (open.status as 'EN_ATTENTE' | 'COMPLEMENT_DEMANDE') : null,
          latestDecision: own[0]?.decision ?? null,
          hasWork,
        }),
        validatedAt: acquired?.decidedAt.toISOString() ?? null,
        openProposal: open ? { id: open.id, status: open.status } : null,
      };
    });
  }

  // ─── Chronologie ──────────────────────────────────────────────────────────

  /** Historique unifié : équipes, étapes, validations, propositions, études, évaluations, compte. */
  async timeline(actor: Actor, scoutProfileId: string): Promise<ScoutTimeline> {
    assertCan(actor, 'progression.read');
    const profile = await this.prisma.scoutProfile.findUnique({
      where: { id: scoutProfileId },
      select: { id: true },
    });
    if (!profile) throw scoutProfileNotFound();

    const [assignments, changes, validations, proposals, studies, attempts, accountLogs] =
      await Promise.all([
        this.prisma.teamAssignment.findMany({
          where: { scoutProfileId },
          include: { team: true, assignedBy: userSummarySelect, endedBy: userSummarySelect },
        }),
        this.prisma.scoutStageChange.findMany({
          where: { scoutProfileId },
          include: stageChangeInclude,
        }),
        this.prisma.competencyValidation.findMany({
          where: { scoutProfileId },
          include: validationInclude,
        }),
        this.prisma.competencyProposal.findMany({
          where: { scoutProfileId },
          include: {
            competency: { select: { code: true, name: true } },
            proposedBy: userSummarySelect,
          },
        }),
        this.prisma.moduleStudy.findMany({
          where: { scoutProfileId },
          include: moduleStudyInclude,
        }),
        this.prisma.evaluationAttempt.findMany({
          where: { scoutProfileId },
          include: { evaluation: { select: { title: true } }, decidedBy: userSummarySelect },
        }),
        this.prisma.auditLog.findMany({
          where: {
            entityType: 'ScoutProfile',
            entityId: scoutProfileId,
            action: {
              in: [
                'scout_profile.created',
                'scout_profile.account_linked',
                'scout_profile.deactivated',
                'scout_profile.activated',
              ],
            },
          },
          include: { actor: userSummarySelect },
        }),
      ]);

    const items: ScoutTimeline['items'] = [];
    const push = (
      at: Date,
      kind: TimelineKind,
      title: string,
      detail: string | null,
      by: UserSummary | null,
    ) => items.push({ at: at.toISOString(), kind, title, detail, by });

    for (const row of assignments) {
      push(
        row.startedAt,
        'EQUIPE',
        `Affectation : ${row.team.name}`,
        null,
        toUserSummary(row.assignedBy),
      );
      if (row.endedAt) {
        push(
          row.endedAt,
          'EQUIPE',
          `Fin d’affectation : ${row.team.name}`,
          null,
          toUserSummary(row.endedBy),
        );
      }
    }
    for (const row of changes.map(toStageChange)) {
      push(
        new Date(row.decidedAt),
        'ETAPE',
        `${STAGE_CHANGE_KIND_LABELS[row.kind]} : ${row.from?.name ?? 'aucune'} → ${row.to?.name ?? 'aucune'}`,
        `Effet le ${row.effectiveOn}. ${row.reason}`,
        row.decidedBy,
      );
    }
    for (const row of validations) {
      const label = row.decision === 'ACQUIS' ? 'Acquis validé' : 'À retravailler';
      push(
        row.decidedAt,
        'VALIDATION',
        `${label} : ${row.competency.code} ${row.competency.name}`,
        row.justification,
        toUserSummary(row.decidedBy),
      );
      if (row.revokedAt) {
        push(
          row.revokedAt,
          'VALIDATION',
          `Décision révoquée : ${row.competency.code}`,
          row.revocationReason,
          toUserSummary(row.revokedBy),
        );
      }
    }
    for (const row of proposals) {
      push(
        row.createdAt,
        'PROPOSITION',
        `Proposition : ${row.competency.code} ${row.competency.name}`,
        row.justification,
        toUserSummary(row.proposedBy),
      );
    }
    for (const row of studies) {
      const study = toModuleStudy(row);
      push(
        row.createdAt,
        'ETUDE',
        `${study.module.code} ${study.module.title} (${STUDY_MODE_LABELS[study.mode]})`,
        study.cancelledAt ? `Annulée : ${study.cancelReason}` : `Étudié le ${study.studiedOn}`,
        study.recordedBy,
      );
    }
    for (const row of attempts) {
      push(
        row.createdAt,
        'EVALUATION',
        `${row.evaluation.title} (${row.code})`,
        `Statut : ${row.status}`,
        null,
      );
    }
    const accountTitles: Record<string, string> = {
      'scout_profile.created': 'Fiche créée',
      'scout_profile.account_linked': 'Compte rattaché',
      'scout_profile.deactivated': 'Profil désactivé',
      'scout_profile.activated': 'Profil réactivé',
    };
    for (const log of accountLogs) {
      push(
        log.createdAt,
        'COMPTE',
        accountTitles[log.action] ?? log.action,
        null,
        toUserSummary(log.actor),
      );
    }
    items.sort((a, b) => b.at.localeCompare(a.at));
    return { items };
  }

  // ─── Vue du routier ───────────────────────────────────────────────────────

  /** Progression du routier connecté : décisions officielles, jamais les observations ni les motifs internes. */
  async mine(actor: Actor): Promise<MyProgression> {
    assertCan(actor, 'progression.readOwn');
    const profile = await this.prisma.scoutProfile.findUnique({
      where: { userId: actor.userId },
      include: scoutRefInclude,
    });
    if (!profile) throw scoutProfileNotLinked();
    const computed = computedStageOf(profile, await loadStageContext(this.prisma));
    const [changes, validations, stageCompetencies, studies] = await Promise.all([
      this.prisma.scoutStageChange.findMany({
        where: { scoutProfileId: profile.id },
        include: stageChangeInclude,
        orderBy: { decidedAt: 'desc' },
      }),
      this.prisma.competencyValidation.findMany({
        where: { scoutProfileId: profile.id, decision: 'ACQUIS', revokedAt: null },
        include: { competency: { select: { id: true, code: true, name: true, domain: true } } },
        orderBy: { decidedAt: 'desc' },
      }),
      computed.stage
        ? this.prisma.competency.findMany({
            where: { isActive: true, stageId: computed.stage.id },
            orderBy: [{ position: 'asc' }, { code: 'asc' }],
          })
        : Promise.resolve([]),
      this.prisma.moduleStudy.findMany({
        where: { scoutProfileId: profile.id, cancelledAt: null },
        include: moduleStudyInclude,
        orderBy: { studiedOn: 'desc' },
      }),
    ]);
    const acquiredIds = new Set(validations.map((row) => row.competencyId));
    const ref = toScoutRef(profile);
    return {
      scout: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        team: ref.team,
        stage: toStageSummary(computed.stage),
        stageSince: computed.stage ? (computed.progression.period?.startsOn ?? null) : null,
      },
      stageChanges: changes
        .filter((row) => !row.correctedBy)
        .map((row) => ({
          id: row.id,
          from: toStageSummary(row.fromStage),
          to: toStageSummary(row.toStage),
          effectiveOn: toIsoDate(row.effectiveOn),
        })),
      acquired: validations.map((row) => ({
        competency: row.competency,
        validatedAt: row.decidedAt.toISOString(),
      })),
      stageCompetencies: stageCompetencies.map((competency) => ({
        competency: {
          id: competency.id,
          code: competency.code,
          name: competency.name,
          description: competency.description,
          observableCriteria: competency.observableCriteria,
        },
        acquired: acquiredIds.has(competency.id),
      })),
      moduleStudies: studies.map((row) => {
        // L'auteur de la saisie n'est pas communiqué au routier.
        const { recordedBy, ...study } = toModuleStudy(row);
        void recordedBy;
        return study;
      }),
    };
  }

  /** Modules publiés (référence pour les formulaires d'étude). */
  async publishedModules(actor: Actor): Promise<{ id: string; code: string; title: string }[]> {
    assertCan(actor, 'module.read');
    const modules = await this.prisma.pedagogicalModule.findMany({
      where: { publishedVersionId: { not: null } },
      ...moduleRefSelect,
      orderBy: { number: 'asc' },
    });
    return modules.map(toModuleRef);
  }
}

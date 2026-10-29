import { Injectable } from '@nestjs/common';
import {
  type ActivitySummary,
  type AttendanceCounts,
  type ChefDashboard,
  FOLLOW_UP_ABSENCE_STREAK,
  type FollowUpItem,
  type FollowUpReason,
  formatModuleCode,
  type MyActivities,
  type MyDashboard,
  type ResponsableDashboard,
  type Statistics,
  type StatisticsQuery,
  statisticsQuerySchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan } from '../../common/permissions.js';
import { parseInput } from '../../common/validation.js';
import { type Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { editableModulesWhere } from '../pedagogy/module-common.js';
import { scoutRefInclude, toScoutRef } from '../progression/progression-common.js';
import {
  activitySummaryInclude,
  attendanceMissingWhere,
  startOfTodayUtc,
  toActivitySummary,
} from '../programmes/activity-common.js';
import {
  toIsoDate,
  toStageSummary,
  toUserSummary,
  userSummarySelect,
} from '../scouts/presenters.js';

const toNumber = (value: { toNumber(): number } | null) =>
  value === null ? null : value.toNumber();

function countsOf(rows: { status: string }[]): AttendanceCounts {
  return {
    present: rows.filter((row) => row.status === 'PRESENT').length,
    absent: rows.filter((row) => row.status === 'ABSENT').length,
    excused: rows.filter((row) => row.status === 'EXCUSE').length,
  };
}

/**
 * Indicateurs et tableaux de bord par rôle. Toutes les valeurs sont calculées à partir des données
 * enregistrées ; aucun classement entre routiers, aucune décision automatique.
 */
@Injectable()
export class DashboardsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Statistiques ─────────────────────────────────────────────────────────

  async statistics(actor: Actor, query: StatisticsQuery): Promise<Statistics> {
    assertCan(actor, 'statistics.read');
    const filters = parseInput(statisticsQuerySchema, query);
    const inPeriod = (date: Date) => {
      const day = toIsoDate(date);
      return (!filters.from || day >= filters.from) && (!filters.to || day <= filters.to);
    };

    const [profiles, stages, competencyCount, validations, proposals, activities, studies] =
      await Promise.all([
        this.prisma.scoutProfile.findMany({
          include: { ...scoutRefInclude, currentStage: true },
        }),
        this.prisma.progressionStage.findMany({ orderBy: { position: 'asc' } }),
        this.prisma.competency.count({ where: { isActive: true } }),
        this.prisma.competencyValidation.findMany({
          where: { revokedAt: null },
          select: { scoutProfileId: true, competencyId: true, decision: true, decidedAt: true },
        }),
        this.prisma.competencyProposal.findMany({
          where: { status: { in: ['EN_ATTENTE', 'COMPLEMENT_DEMANDE'] } },
          select: { scoutProfileId: true, status: true },
        }),
        this.prisma.activity.findMany({
          select: { id: true, status: true, origin: true, plannedOn: true, heldOn: true },
        }),
        this.prisma.moduleStudy.findMany({
          where: { cancelledAt: null },
          select: { scoutProfileId: true, studiedOn: true },
        }),
      ]);

    // Population : filtrée par équipe actuelle et étape actuelle si demandé.
    const population = profiles.filter((profile) => {
      const teamId = profile.teamAssignments[0]?.teamId ?? null;
      return (
        (!filters.teamId || teamId === filters.teamId) &&
        (!filters.stageId || profile.currentStageId === filters.stageId)
      );
    });
    const populationIds = new Set(population.map((profile) => profile.id));
    const active = population.filter((profile) => profile.isActive);

    const periodActivities = activities.filter((activity) =>
      inPeriod(activity.heldOn ?? activity.plannedOn),
    );
    const activityDate = new Map(
      activities.map((activity) => [activity.id, activity.heldOn ?? activity.plannedOn]),
    );
    const attendances = (
      await this.prisma.activityAttendance.findMany({
        where: { activityId: { in: periodActivities.map((activity) => activity.id) } },
        select: { activityId: true, scoutProfileId: true, status: true },
      })
    ).filter((row) => populationIds.has(row.scoutProfileId));

    const acquired = validations.filter(
      (row) =>
        row.decision === 'ACQUIS' &&
        populationIds.has(row.scoutProfileId) &&
        inPeriod(row.decidedAt),
    );
    const acquiredKeys = new Set(
      validations
        .filter((row) => row.decision === 'ACQUIS')
        .map((row) => `${row.scoutProfileId}|${row.competencyId}`),
    );
    const toRework = validations.filter(
      (row) =>
        row.decision === 'A_RETRAVAILLER' &&
        !acquiredKeys.has(`${row.scoutProfileId}|${row.competencyId}`) &&
        populationIds.has(row.scoutProfileId) &&
        inPeriod(row.decidedAt),
    );
    const acquiredByScout = new Map<string, number>();
    for (const row of acquired) {
      acquiredByScout.set(row.scoutProfileId, (acquiredByScout.get(row.scoutProfileId) ?? 0) + 1);
    }
    const sumAcquired = (ids: string[]) =>
      ids.reduce((sum, id) => sum + (acquiredByScout.get(id) ?? 0), 0);

    // Par équipe (routiers actifs), puis par étape.
    const teams = new Map<string | null, typeof active>();
    for (const profile of active) {
      const team = profile.teamAssignments[0]?.team ?? null;
      const key = team?.id ?? null;
      teams.set(key, [...(teams.get(key) ?? []), profile]);
    }
    const stageKeys = [...stages.map((stage) => stage.id), null];
    const byTeam = [...teams.entries()]
      .map(([, members]) => {
        const team = members[0]!.teamAssignments[0]?.team ?? null;
        const memberIds = new Set(members.map((member) => member.id));
        return {
          team: team && { id: team.id, name: team.name },
          active: members.length,
          byStage: stageKeys
            .map((stageId) => ({
              stage: toStageSummary(stages.find((stage) => stage.id === stageId) ?? null),
              count: members.filter((member) => member.currentStageId === stageId).length,
            }))
            .filter((entry) => entry.count > 0),
          acquiredCompetencies: sumAcquired([...memberIds]),
          attendance: countsOf(attendances.filter((row) => memberIds.has(row.scoutProfileId))),
        };
      })
      .sort((a, b) => (a.team?.name ?? '￿').localeCompare(b.team?.name ?? '￿', 'fr'));

    const byStage = stageKeys
      .map((stageId) => {
        const members = active.filter((profile) => profile.currentStageId === stageId);
        return {
          stage: toStageSummary(stages.find((stage) => stage.id === stageId) ?? null),
          active: members.length,
          acquiredCompetencies: sumAcquired(members.map((member) => member.id)),
        };
      })
      .filter((entry) => entry.stage !== null || entry.active > 0);

    const today = startOfTodayUtc();
    const withAttendance = new Set(
      (
        await this.prisma.activityAttendance.findMany({
          where: { activityId: { in: periodActivities.map((activity) => activity.id) } },
          distinct: ['activityId'],
          select: { activityId: true },
        })
      ).map((row) => row.activityId),
    );
    const attendanceMissing = periodActivities.filter(
      (activity) =>
        !withAttendance.has(activity.id) &&
        (activity.status === 'REALISEE' ||
          (activity.status !== 'ANNULEE' && activity.plannedOn <= today)),
    ).length;

    const totals = countsOf(attendances);
    const recorded = totals.present + totals.absent + totals.excused;
    const trend = new Map<string, AttendanceCounts>();
    for (const row of attendances) {
      const month = toIsoDate(activityDate.get(row.activityId)!).slice(0, 7);
      const counts = trend.get(month) ?? { present: 0, absent: 0, excused: 0 };
      if (row.status === 'PRESENT') counts.present += 1;
      else if (row.status === 'ABSENT') counts.absent += 1;
      else counts.excused += 1;
      trend.set(month, counts);
    }

    return {
      generatedAt: new Date().toISOString(),
      filters: {
        from: filters.from ?? null,
        to: filters.to ?? null,
        teamId: filters.teamId ?? null,
        stageId: filters.stageId ?? null,
      },
      scouts: {
        total: population.length,
        active: active.length,
        withAccount: active.filter((profile) => profile.userId !== null).length,
        withoutAccount: active.filter((profile) => profile.userId === null).length,
        withoutTeam: active.filter((profile) => profile.teamAssignments.length === 0).length,
        withoutStage: active.filter((profile) => profile.currentStageId === null).length,
      },
      byTeam,
      byStage,
      competencies: {
        activeInReferential: competencyCount,
        acquired: acquired.length,
        toRework: new Set(toRework.map((row) => `${row.scoutProfileId}|${row.competencyId}`)).size,
        pendingProposals: proposals.filter(
          (row) => row.status === 'EN_ATTENTE' && populationIds.has(row.scoutProfileId),
        ).length,
        complementRequested: proposals.filter(
          (row) => row.status === 'COMPLEMENT_DEMANDE' && populationIds.has(row.scoutProfileId),
        ).length,
      },
      activities: {
        planned: periodActivities.filter((activity) => activity.status === 'PLANIFIEE').length,
        postponed: periodActivities.filter((activity) => activity.status === 'REPORTEE').length,
        realised: periodActivities.filter((activity) => activity.status === 'REALISEE').length,
        cancelled: periodActivities.filter((activity) => activity.status === 'ANNULEE').length,
        programme: periodActivities.filter((activity) => activity.origin === 'PROGRAMME').length,
        supplementary: periodActivities.filter((activity) => activity.origin === 'SUPPLEMENTAIRE')
          .length,
        attendanceMissing,
      },
      attendance: { ...totals, rate: recorded === 0 ? null : totals.present / recorded },
      attendanceTrend: [...trend.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, counts]) => ({ month, ...counts })),
      moduleStudies: studies.filter(
        (study) => populationIds.has(study.scoutProfileId) && inPeriod(study.studiedOn),
      ).length,
    };
  }

  // ─── Signaux d'accompagnement ─────────────────────────────────────────────

  /** Faits enregistrés signalant un besoin d'accompagnement (jamais une sanction ni une décision). */
  private async followUp(): Promise<FollowUpItem[]> {
    const [profiles, toRework, attendances] = await Promise.all([
      this.prisma.scoutProfile.findMany({
        where: { isActive: true },
        include: { ...scoutRefInclude, currentStage: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      this.prisma.competencyValidation.findMany({
        where: { decision: 'A_RETRAVAILLER', revokedAt: null },
        select: { scoutProfileId: true, competencyId: true },
      }),
      this.prisma.activityAttendance.findMany({
        include: { activity: { select: { plannedOn: true, heldOn: true } } },
      }),
    ]);
    const acquired = await this.prisma.competencyValidation.findMany({
      where: { decision: 'ACQUIS', revokedAt: null },
      select: { scoutProfileId: true, competencyId: true },
    });
    const acquiredKeys = new Set(
      acquired.map((row) => `${row.scoutProfileId}|${row.competencyId}`),
    );
    const reworkScouts = new Set(
      toRework
        .filter((row) => !acquiredKeys.has(`${row.scoutProfileId}|${row.competencyId}`))
        .map((row) => row.scoutProfileId),
    );
    const byScout = new Map<string, typeof attendances>();
    for (const row of attendances) {
      byScout.set(row.scoutProfileId, [...(byScout.get(row.scoutProfileId) ?? []), row]);
    }

    const items: FollowUpItem[] = [];
    for (const profile of profiles) {
      const reasons: FollowUpReason[] = [];
      if (reworkScouts.has(profile.id)) reasons.push('COMPETENCE_A_RETRAVAILLER');
      const recent = (byScout.get(profile.id) ?? [])
        .sort(
          (a, b) =>
            (b.activity.heldOn ?? b.activity.plannedOn).getTime() -
            (a.activity.heldOn ?? a.activity.plannedOn).getTime(),
        )
        .slice(0, FOLLOW_UP_ABSENCE_STREAK);
      if (
        recent.length === FOLLOW_UP_ABSENCE_STREAK &&
        recent.every((row) => row.status === 'ABSENT')
      ) {
        reasons.push('ABSENCES_RECENTES');
      }
      if (!profile.currentStageId) reasons.push('SANS_ETAPE');
      if (profile.teamAssignments.length === 0) reasons.push('SANS_EQUIPE');
      if (reasons.length > 0) {
        items.push({
          scout: { ...toScoutRef(profile), stage: toStageSummary(profile.currentStage) },
          reasons,
        });
      }
    }
    return items;
  }

  private async upcomingActivities(
    where: Prisma.ActivityWhereInput = {},
    take = 5,
  ): Promise<ActivitySummary[]> {
    const rows = await this.prisma.activity.findMany({
      where: {
        status: { in: ['PLANIFIEE', 'REPORTEE'] },
        plannedOn: { gte: startOfTodayUtc() },
        ...where,
      },
      include: activitySummaryInclude,
      orderBy: { plannedOn: 'asc' },
      take,
    });
    return rows.map((row) => toActivitySummary(row));
  }

  // ─── Tableaux de bord par rôle ────────────────────────────────────────────

  async responsable(actor: Actor): Promise<ResponsableDashboard> {
    assertCan(actor, 'dashboard.responsable');
    const [
      statistics,
      modulesToApprove,
      evaluationsToApprove,
      resultsToReview,
      proposalsPending,
      complementRequested,
      correctionsInProgress,
      followUp,
      upcomingActivities,
    ] = await Promise.all([
      this.statistics(actor, {}),
      this.prisma.moduleVersion.count({ where: { status: 'SOUMIS' } }),
      this.prisma.evaluationVersion.count({ where: { status: 'SOUMIS' } }),
      this.prisma.evaluationAttempt.count({ where: { status: 'SOUMISE' } }),
      this.prisma.competencyProposal.count({ where: { status: 'EN_ATTENTE' } }),
      this.prisma.competencyProposal.count({ where: { status: 'COMPLEMENT_DEMANDE' } }),
      this.prisma.evaluationAttempt.count({ where: { status: 'A_CORRIGER' } }),
      this.followUp(),
      this.upcomingActivities(),
    ]);
    return {
      statistics,
      contentQueue: { modulesToApprove, evaluationsToApprove },
      pedagogyQueue: {
        resultsToReview,
        proposalsPending,
        complementRequested,
        correctionsInProgress,
      },
      followUp,
      upcomingActivities,
    };
  }

  async chef(actor: Actor): Promise<ChefDashboard> {
    assertCan(actor, 'statistics.read');
    const today = startOfTodayUtc();
    const [
      activeScouts,
      upcomingActivities,
      missingRows,
      observations,
      pending,
      complementRequested,
      decided,
      modulesInProgress,
      correctionsToDo,
      followUp,
    ] = await Promise.all([
      this.prisma.scoutProfile.count({ where: { isActive: true } }),
      this.upcomingActivities(),
      this.prisma.activity.findMany({
        where: attendanceMissingWhere(today),
        include: activitySummaryInclude,
        orderBy: { plannedOn: 'desc' },
        take: 10,
      }),
      this.prisma.scoutObservation.findMany({
        where: { authorId: actor.userId },
        include: { scoutProfile: { include: scoutRefInclude } },
        orderBy: [{ observedOn: 'desc' }, { createdAt: 'desc' }],
        take: 5,
      }),
      this.prisma.competencyProposal.count({
        where: { proposedById: actor.userId, status: 'EN_ATTENTE' },
      }),
      this.prisma.competencyProposal.count({
        where: { proposedById: actor.userId, status: 'COMPLEMENT_DEMANDE' },
      }),
      this.prisma.competencyProposal.findMany({
        where: { proposedById: actor.userId, status: { in: ['APPROUVEE', 'REFUSEE'] } },
        include: {
          scoutProfile: { include: scoutRefInclude },
          competency: { select: { id: true, code: true, name: true } },
          decidedBy: userSummarySelect,
        },
        orderBy: { decidedAt: 'desc' },
        take: 5,
      }),
      this.prisma.pedagogicalModule.count({
        where: {
          ...editableModulesWhere(actor),
          versions: { some: { status: { in: ['BROUILLON', 'A_CORRIGER'] } } },
        },
      }),
      this.prisma.evaluationAttempt.count({ where: { status: 'A_CORRIGER' } }),
      this.followUp(),
    ]);
    return {
      activeScouts,
      upcomingActivities,
      attendanceToRecord: missingRows.map((row) => toActivitySummary(row)),
      recentObservations: observations.map((row) => ({
        id: row.id,
        scout: toScoutRef(row.scoutProfile),
        observedOn: toIsoDate(row.observedOn),
        category: row.category,
        excerpt: row.content.length > 160 ? `${row.content.slice(0, 157)}…` : row.content,
      })),
      myProposals: {
        pending,
        complementRequested,
        recentlyDecided: decided.map((row) => ({
          id: row.id,
          status: row.status as 'APPROUVEE' | 'REFUSEE',
          scout: toScoutRef(row.scoutProfile),
          competency: row.competency,
          decidedAt: (row.decidedAt ?? row.updatedAt).toISOString(),
          decidedBy: toUserSummary(row.decidedBy),
        })),
      },
      modulesInProgress,
      correctionsToDo,
      followUp,
    };
  }

  // ─── Espace routier ───────────────────────────────────────────────────────

  /**
   * Activités pertinentes pour une étape : sans catégorie, rattachées à une catégorie dont la
   * correspondance confirmée désigne cette étape, ou dont aucune catégorie n'a de correspondance
   * confirmée (on ne peut pas exclure sans règle validée).
   */
  private relevantForStage(stageId: string | null): Prisma.ActivityWhereInput {
    return {
      OR: [
        { categories: { none: {} } },
        { categories: { none: { category: { correspondenceValidated: true } } } },
        ...(stageId
          ? [{ categories: { some: { category: { correspondenceValidated: true, stageId } } } }]
          : []),
      ],
    };
  }

  async me(actor: Actor): Promise<MyDashboard> {
    assertCan(actor, 'progression.readOwn');
    const profile = await this.prisma.scoutProfile.findUnique({
      where: { userId: actor.userId },
      include: { ...scoutRefInclude, currentStage: true },
    });
    if (!profile) {
      return {
        linked: false,
        stage: null,
        stageSince: null,
        team: null,
        recommendedModules: [],
        studiedModules: 0,
        acquiredCompetencies: [],
        recentResults: [],
        upcomingActivities: [],
      };
    }
    const [studies, recommended, validations, results, upcoming] = await Promise.all([
      this.prisma.moduleStudy.findMany({
        where: { scoutProfileId: profile.id, cancelledAt: null },
        select: { moduleId: true },
      }),
      profile.currentStageId
        ? this.prisma.pedagogicalModule.findMany({
            where: { publishedVersion: { stageId: profile.currentStageId } },
            include: { publishedVersion: { select: { title: true } } },
            orderBy: { number: 'asc' },
          })
        : Promise.resolve([]),
      this.prisma.competencyValidation.findMany({
        where: { scoutProfileId: profile.id, decision: 'ACQUIS', revokedAt: null },
        include: { competency: { select: { id: true, code: true, name: true } } },
        orderBy: { decidedAt: 'desc' },
      }),
      // Résultats communiqués après acceptation par le responsable (D61).
      this.prisma.evaluationAttempt.findMany({
        where: { scoutProfileId: profile.id, status: 'VALIDEE' },
        include: { evaluation: { select: { title: true } } },
        orderBy: { decidedAt: 'desc' },
        take: 5,
      }),
      this.upcomingActivities(this.relevantForStage(profile.currentStageId)),
    ]);
    const studied = new Set(studies.map((study) => study.moduleId));
    return {
      linked: true,
      stage: toStageSummary(profile.currentStage),
      stageSince: profile.currentStageSince ? toIsoDate(profile.currentStageSince) : null,
      team: toScoutRef(profile).team,
      recommendedModules: recommended
        .filter((module) => !studied.has(module.id))
        .slice(0, 5)
        .map((module) => ({
          id: module.id,
          slug: module.slug,
          code: formatModuleCode(module.number),
          title: module.publishedVersion?.title ?? module.slug,
        })),
      studiedModules: studied.size,
      acquiredCompetencies: validations.map((row) => ({
        ...row.competency,
        validatedAt: row.decidedAt.toISOString(),
      })),
      recentResults: results.map((attempt) => ({
        code: attempt.code,
        evaluationTitle: attempt.evaluation.title,
        score: toNumber(attempt.score),
        maxScore: toNumber(attempt.maxScore),
        decidedAt: attempt.decidedAt?.toISOString() ?? null,
      })),
      upcomingActivities: upcoming,
    };
  }

  async myActivities(actor: Actor): Promise<MyActivities> {
    assertCan(actor, 'progression.readOwn');
    const profile = await this.prisma.scoutProfile.findUnique({ where: { userId: actor.userId } });
    if (!profile) return { upcoming: [], attended: [] };
    const [upcoming, attendances] = await Promise.all([
      this.upcomingActivities(this.relevantForStage(profile.currentStageId), 20),
      this.prisma.activityAttendance.findMany({
        where: { scoutProfileId: profile.id },
        include: { activity: { include: activitySummaryInclude } },
      }),
    ]);
    const strip = ({ attendance, ...summary }: ActivitySummary) => {
      void attendance;
      return summary;
    };
    return {
      upcoming: upcoming.map(strip),
      attended: attendances
        .sort(
          (a, b) =>
            (b.activity.heldOn ?? b.activity.plannedOn).getTime() -
            (a.activity.heldOn ?? a.activity.plannedOn).getTime(),
        )
        .slice(0, 30)
        .map((row) => ({ activity: strip(toActivitySummary(row.activity)), status: row.status })),
    };
  }
}

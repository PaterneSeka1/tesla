import { z } from 'zod';
import { userSummarySchema } from './api.js';
import { activitySummarySchema, attendanceCountsSchema } from './programmes.js';
import { competencyRefSchema, scoutRefSchema } from './progression.js';
import { stageSummarySchema, teamRefSchema } from './scouts.js';

// Indicateurs calculés exclusivement à partir des données PostgreSQL (docs/FEATURES/DASHBOARDS.md).
// Aucun classement entre routiers ; les signaux d'accompagnement sont des faits, pas des jugements.

const calendarDate = z.iso.date({ error: 'Date invalide (AAAA-MM-JJ).' });

export const statisticsQuerySchema = z
  .object({
    from: calendarDate.optional(),
    to: calendarDate.optional(),
    teamId: z.uuid().optional(),
    stageId: z.uuid().optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: 'La date de début doit précéder la date de fin.',
  });

export type StatisticsQuery = z.input<typeof statisticsQuerySchema>;

const countByStageSchema = z.object({
  stage: stageSummarySchema.nullable(),
  count: z.number().int(),
});

export const statisticsSchema = z.object({
  generatedAt: z.iso.datetime(),
  filters: z.object({
    from: z.iso.date().nullable(),
    to: z.iso.date().nullable(),
    teamId: z.uuid().nullable(),
    stageId: z.uuid().nullable(),
  }),
  /** Routiers (filtrés par équipe actuelle et étape actuelle si demandé). */
  scouts: z.object({
    total: z.number().int(),
    active: z.number().int(),
    withAccount: z.number().int(),
    withoutAccount: z.number().int(),
    withoutTeam: z.number().int(),
    withoutStage: z.number().int(),
  }),
  /** Répartition des routiers actifs par équipe actuelle, puis par étape. */
  byTeam: z.array(
    z.object({
      team: teamRefSchema.nullable(),
      active: z.number().int(),
      byStage: z.array(countByStageSchema),
      acquiredCompetencies: z.number().int(),
      attendance: attendanceCountsSchema,
    }),
  ),
  byStage: z.array(
    z.object({
      stage: stageSummarySchema.nullable(),
      active: z.number().int(),
      acquiredCompetencies: z.number().int(),
    }),
  ),
  competencies: z.object({
    activeInReferential: z.number().int(),
    /** Validations officielles ACQUIS actives (décidées dans la période si filtrée). */
    acquired: z.number().int(),
    toRework: z.number().int(),
    pendingProposals: z.number().int(),
    complementRequested: z.number().int(),
  }),
  activities: z.object({
    planned: z.number().int(),
    postponed: z.number().int(),
    realised: z.number().int(),
    cancelled: z.number().int(),
    programme: z.number().int(),
    supplementary: z.number().int(),
    /** Réalisées (ou planifiées passées) sans aucune présence enregistrée. */
    attendanceMissing: z.number().int(),
  }),
  attendance: attendanceCountsSchema.extend({
    /** Présents ÷ présences renseignées ; null si aucune présence renseignée. */
    rate: z.number().nullable(),
  }),
  /** Participation par mois (date effective ou prévue de l'activité). */
  attendanceTrend: z.array(attendanceCountsSchema.extend({ month: z.string() })),
  moduleStudies: z.number().int(),
});

export type Statistics = z.infer<typeof statisticsSchema>;

/** Signaux factuels d'accompagnement (aucun n'entraîne de décision automatique). */
export const FOLLOW_UP_REASONS = [
  'COMPETENCE_A_RETRAVAILLER',
  'ABSENCES_RECENTES',
  'SANS_ETAPE',
  'SANS_EQUIPE',
] as const;

export type FollowUpReason = (typeof FOLLOW_UP_REASONS)[number];

/**
 * Nombre de dernières présences renseignées, toutes « absent » (non excusé), qui signalent un besoin
 * d'accompagnement. Valeur d'affichage **provisoire, à arbitrer** par le responsable (D74).
 */
export const FOLLOW_UP_ABSENCE_STREAK = 2;

export const FOLLOW_UP_REASON_LABELS: Record<FollowUpReason, string> = {
  COMPETENCE_A_RETRAVAILLER: 'Compétence à retravailler',
  ABSENCES_RECENTES: `Absent (non excusé) aux ${FOLLOW_UP_ABSENCE_STREAK} dernières activités renseignées`,
  SANS_ETAPE: 'Étape non renseignée',
  SANS_EQUIPE: 'Sans équipe',
};

export const followUpItemSchema = z.object({
  scout: scoutRefSchema.extend({ stage: stageSummarySchema.nullable() }),
  reasons: z.array(z.enum(FOLLOW_UP_REASONS)),
});

export type FollowUpItem = z.infer<typeof followUpItemSchema>;

/**
 * Éléments concrets à traiter, affichés en tête des tableaux de bord de l'encadrement. Chaque type
 * renvoie vers l'écran existant qui porte l'action ; aucune décision n'est prise depuis la liste.
 */
export const DASHBOARD_TASK_KINDS = [
  'MODULE_A_APPROUVER',
  'QUESTIONNAIRE_A_APPROUVER',
  'RESULTAT_A_EXAMINER',
  'PROPOSITION_A_DECIDER',
  'COPIE_A_CORRIGER',
  'COPIE_PAPIER_A_CORRIGER',
  'MODULE_A_REPRENDRE',
  'QUESTIONNAIRE_A_REPRENDRE',
  'COMPLEMENT_A_APPORTER',
  'PRESENCES_A_RENSEIGNER',
] as const;

export type DashboardTaskKind = (typeof DASHBOARD_TASK_KINDS)[number];

export const DASHBOARD_TASK_LABELS: Record<DashboardTaskKind, string> = {
  MODULE_A_APPROUVER: 'Module à approuver',
  QUESTIONNAIRE_A_APPROUVER: 'Questionnaire à approuver',
  RESULTAT_A_EXAMINER: 'Résultat à examiner',
  PROPOSITION_A_DECIDER: 'Proposition de compétence',
  COPIE_A_CORRIGER: 'Copie à corriger',
  COPIE_PAPIER_A_CORRIGER: 'Copie papier à corriger',
  MODULE_A_REPRENDRE: 'Module renvoyé pour correction',
  QUESTIONNAIRE_A_REPRENDRE: 'Questionnaire renvoyé pour correction',
  COMPLEMENT_A_APPORTER: 'Complément demandé',
  PRESENCES_A_RENSEIGNER: 'Présences à renseigner',
};

/** Nombre maximal d'éléments renvoyés ; `taskTotal` donne le volume réel. */
export const DASHBOARD_TASK_LIMIT = 12;

export const dashboardTaskSchema = z.object({
  kind: z.enum(DASHBOARD_TASK_KINDS),
  /** Identifiant de la cible : module, questionnaire, tentative, proposition, activité ou code de copie. */
  targetId: z.string(),
  title: z.string(),
  detail: z.string().nullable(),
  /** Début de l'attente (soumission, renvoi, date d'activité) : tri du plus ancien au plus récent. */
  since: z.iso.datetime(),
});

export type DashboardTask = z.infer<typeof dashboardTaskSchema>;

/** Avancement de l'année : programme en cours et jalons (activités du programme). */
export const yearOverviewSchema = z.object({
  programme: z
    .object({
      id: z.uuid(),
      title: z.string(),
      startsOn: z.iso.date().nullable(),
      endsOn: z.iso.date().nullable(),
    })
    .nullable(),
  milestones: z.array(
    activitySummarySchema.pick({ id: true, title: true, status: true, plannedOn: true }),
  ),
  nextActivity: activitySummarySchema.nullable(),
});

export type YearOverview = z.infer<typeof yearOverviewSchema>;

export const responsableDashboardSchema = z.object({
  statistics: statisticsSchema,
  /** File 1 : contenus à approuver (modules et questionnaires). */
  contentQueue: z.object({
    modulesToApprove: z.number().int(),
    evaluationsToApprove: z.number().int(),
  }),
  /** File 2 : décisions pédagogiques sur les personnes. */
  pedagogyQueue: z.object({
    resultsToReview: z.number().int(),
    proposalsPending: z.number().int(),
    complementRequested: z.number().int(),
    correctionsInProgress: z.number().int(),
  }),
  followUp: z.array(followUpItemSchema),
  upcomingActivities: z.array(activitySummarySchema),
  tasks: z.array(dashboardTaskSchema),
  taskTotal: z.number().int(),
  year: yearOverviewSchema,
});

export type ResponsableDashboard = z.infer<typeof responsableDashboardSchema>;

export const chefDashboardSchema = z.object({
  activeScouts: z.number().int(),
  upcomingActivities: z.array(activitySummarySchema),
  attendanceToRecord: z.array(activitySummarySchema),
  recentObservations: z.array(
    z.object({
      id: z.uuid(),
      scout: scoutRefSchema,
      observedOn: z.iso.date(),
      category: z.string().nullable(),
      excerpt: z.string(),
    }),
  ),
  myProposals: z.object({
    pending: z.number().int(),
    complementRequested: z.number().int(),
    recentlyDecided: z.array(
      z.object({
        id: z.uuid(),
        status: z.enum(['APPROUVEE', 'REFUSEE']),
        scout: scoutRefSchema,
        competency: competencyRefSchema,
        decidedAt: z.iso.datetime(),
        decidedBy: userSummarySchema.nullable(),
      }),
    ),
  }),
  /** Modules dont le chef est auteur ou collaborateur et dont une version de travail est en cours. */
  modulesInProgress: z.number().int(),
  correctionsToDo: z.number().int(),
  followUp: z.array(followUpItemSchema),
  tasks: z.array(dashboardTaskSchema),
  taskTotal: z.number().int(),
  year: yearOverviewSchema,
});

export type ChefDashboard = z.infer<typeof chefDashboardSchema>;

export const myDashboardSchema = z.object({
  /** Le compte est rattaché à un profil routier. */
  linked: z.boolean(),
  stage: stageSummarySchema.nullable(),
  stageSince: z.iso.date().nullable(),
  team: teamRefSchema.nullable(),
  /** Modules publiés recommandés pour l'étape courante et non encore étudiés. */
  recommendedModules: z.array(
    z.object({ id: z.uuid(), slug: z.string(), code: z.string(), title: z.string() }),
  ),
  studiedModules: z.number().int(),
  acquiredCompetencies: z.array(competencyRefSchema.extend({ validatedAt: z.iso.datetime() })),
  recentResults: z.array(
    z.object({
      code: z.string(),
      evaluationTitle: z.string(),
      score: z.number().nullable(),
      maxScore: z.number().nullable(),
      decidedAt: z.iso.datetime().nullable(),
    }),
  ),
  upcomingActivities: z.array(activitySummarySchema),
});

export type MyDashboard = z.infer<typeof myDashboardSchema>;

/** Activités du routier : à venir (pertinentes pour son étape) et présences enregistrées. */
export const myActivitiesSchema = z.object({
  upcoming: z.array(activitySummarySchema.omit({ attendance: true })),
  attended: z.array(
    z.object({
      activity: activitySummarySchema.omit({ attendance: true }),
      status: z.enum(['PRESENT', 'ABSENT', 'EXCUSE']),
    }),
  ),
});

export type MyActivities = z.infer<typeof myActivitiesSchema>;

import { z } from 'zod';
import { practiceActivitySchema, practiceAnswersSchema, PRACTICE_KINDS } from './practice.js';

/**
 * Progression ludique (D196) et révisions (D197). Distincte de tout parcours officiel : aucun XP,
 * badge ou révision ne change une étape, un acquis, un rattrapage ou un résultat d'évaluation, et
 * aucun ne bloque un contenu publié. Toutes les valeurs sont calculées par l'API.
 */

/** Barème ludique (réglable ici, sans effet officiel). Une seule attribution par référence. */
export const XP_RULES = {
  LECON_LUE: 10,
  ACTIVITE_TERMINEE: 5,
  ACTIVITE_MAITRISEE: 15,
  /** Révision réussie qui fait monter l'activité d'une boîte (au plus une fois par boîte). */
  REVISION: 5,
} as const;

/** Intervalles de révision (jours) par boîte de Leitner, 1 à 5. */
export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30] as const;

export const BADGES = [
  {
    key: 'premier-pas',
    title: 'Premier pas',
    description: 'Une première leçon lue jusqu’au bout.',
  },
  {
    key: 'curiosite',
    title: 'Curiosité',
    description: 'Des leçons lues dans trois modules différents.',
  },
  {
    key: 'explorateur',
    title: 'Explorateur',
    description: 'Dix leçons lues jusqu’au bout.',
  },
  {
    key: 'memoire-de-la-route',
    title: 'Mémoire de la Route',
    description: 'Dix activités réussies sans erreur.',
  },
  {
    key: 'maitre-des-reperes',
    title: 'Maître des repères',
    description: 'Trois remises en ordre réussies sans erreur.',
  },
  {
    key: 'perseverance',
    title: 'Persévérance',
    description: 'Une activité réussie après au moins trois essais.',
  },
  {
    key: 'retour-sur-les-traces',
    title: 'Retour sur les traces',
    description: 'Une notion révisée assez souvent pour être bien ancrée.',
  },
] as const;

export type BadgeKey = (typeof BADGES)[number]['key'];

export const earnedBadgeSchema = z.object({
  key: z.string(),
  title: z.string(),
  description: z.string(),
  earnedAt: z.iso.datetime().nullable(),
});
export type EarnedBadge = z.infer<typeof earnedBadgeSchema>;

// ─── Banque d'entraînement ───────────────────────────────────────────────

export const bankActivitySchema = z.object({
  key: z.string(),
  lessonId: z.uuid(),
  lessonTitle: z.string(),
  origin: z.enum(['authored', 'derived']),
  reverent: z.boolean().optional(),
  activity: practiceActivitySchema,
});

export const practiceBankSchema = z.object({
  modules: z.array(
    z.object({
      slug: z.string(),
      code: z.string(),
      title: z.string(),
      theme: z.string().nullable(),
      version: z.number().int(),
      activities: z.array(bankActivitySchema),
    }),
  ),
});
export type PracticeBank = z.infer<typeof practiceBankSchema>;
export type PracticeBankModule = PracticeBank['modules'][number];

// ─── Écritures (rejouables hors ligne, idempotentes) ─────────────────────

export const practiceResultInputSchema = z.object({
  moduleSlug: z.string().min(1).max(120),
  activityKey: z.string().regex(/^[a-z0-9-]{6,40}$/),
  answers: practiceAnswersSchema,
});
export type PracticeResultInput = z.infer<typeof practiceResultInputSchema>;

export const rewardSummarySchema = z.object({
  xpAwarded: z.number().int().nonnegative(),
  newBadges: z.array(earnedBadgeSchema),
});
export type RewardSummary = z.infer<typeof rewardSummarySchema>;

export const practiceResultSchema = rewardSummarySchema.extend({
  correct: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  mastered: z.boolean(),
  nextReviewOn: z.iso.date(),
});
export type PracticeResult = z.infer<typeof practiceResultSchema>;

export const lessonReadInputSchema = z.object({
  moduleSlug: z.string().min(1).max(120),
  lessonId: z.uuid(),
});
export type LessonReadInput = z.infer<typeof lessonReadInputSchema>;

// ─── Carnet et révisions ─────────────────────────────────────────────────

export const dueReviewSchema = z.object({
  moduleSlug: z.string(),
  activityKey: z.string(),
  activityKind: z.enum(PRACTICE_KINDS),
  dueOn: z.iso.date(),
  box: z.number().int(),
});
export type DueReview = z.infer<typeof dueReviewSchema>;

export const learningJournalSchema = z.object({
  xp: z.number().int().nonnegative(),
  lessonsRead: z.number().int().nonnegative(),
  activitiesMastered: z.number().int().nonnegative(),
  badges: z.array(earnedBadgeSchema),
  /** Activités à revoir aujourd'hui (au plus 20, les plus anciennes d'abord). */
  dueReviews: z.array(dueReviewSchema),
  /** Leçons lues (référence stable `module:empreinte du titre`), pour marquer le sentier. */
  readLessons: z.array(z.string()),
  /** Activités déjà pratiquées (`module:activité`), pour varier les parties. */
  practiced: z.array(z.string()),
});
export type LearningJournal = z.infer<typeof learningJournalSchema>;

/** Référence stable d'une leçon lue : le titre survit aux nouvelles versions (identifiants recréés). */
export function lessonReadRef(moduleSlug: string, lessonTitle: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < lessonTitle.length; index++) {
    hash ^= lessonTitle.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${moduleSlug}:${hash.toString(16).padStart(8, '0')}`;
}

/** Prochaine boîte et date de révision (calcul pur, partagé et testé). */
export function nextReview(
  box: number,
  mastered: boolean,
  today: Date,
): { box: number; dueOn: string } {
  const next = mastered ? Math.min(box + 1, REVIEW_INTERVALS_DAYS.length) : 1;
  const due = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  due.setUTCDate(due.getUTCDate() + REVIEW_INTERVALS_DAYS[next - 1]!);
  return { box: next, dueOn: due.toISOString().slice(0, 10) };
}

/** Données minimales du calcul des badges (événements et suivi du compte). */
export interface BadgeFacts {
  events: { kind: string; moduleSlug: string; createdAt: Date }[];
  progress: { activityKind: string; attempts: number; box: number; masteredAt: Date | null }[];
}

/** Badges obtenus et date d'obtention (événement qui a rempli la condition), calcul déterministe. */
export function computeBadges(facts: BadgeFacts): EarnedBadge[] {
  const reads = facts.events
    .filter((event) => event.kind === 'LECON_LUE')
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const mastered = facts.events
    .filter((event) => event.kind === 'ACTIVITE_MAITRISEE')
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const nth = (rows: { createdAt: Date }[], n: number) => rows[n - 1]?.createdAt ?? null;

  let curiosity: Date | null = null;
  const modules = new Set<string>();
  for (const read of reads) {
    modules.add(read.moduleSlug);
    if (modules.size === 3) {
      curiosity = read.createdAt;
      break;
    }
  }
  const orders = facts.progress
    .filter((row) => row.activityKind === 'order' && row.masteredAt)
    .map((row) => ({ createdAt: row.masteredAt! }))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const persevered = facts.progress
    .filter((row) => row.masteredAt && row.attempts >= 3)
    .map((row) => row.masteredAt!)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  const anchored = facts.events
    .filter((event) => event.kind === 'REVISION')
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const anchoredAt = facts.progress.some((row) => row.box >= 4)
    ? (anchored.at(-1)?.createdAt ?? null)
    : null;

  const dates: Record<BadgeKey, Date | null> = {
    'premier-pas': nth(reads, 1),
    curiosite: curiosity,
    explorateur: nth(reads, 10),
    'memoire-de-la-route': nth(mastered, 10),
    'maitre-des-reperes': nth(orders, 3),
    perseverance: persevered ?? null,
    'retour-sur-les-traces': anchoredAt,
  };
  return BADGES.map((badge) => ({
    key: badge.key,
    title: badge.title,
    description: badge.description,
    earnedAt: dates[badge.key]?.toISOString() ?? null,
  }));
}

// ─── Indicateur pour l'encadrement (agrégé, jamais nominatif) ────────────

/** En dessous de ce nombre d'apprenants, une activité n'est pas affichée (confidentialité). */
export const INSIGHT_MIN_LEARNERS = 3;

export const practiceInsightsSchema = z.object({
  /** Activités les moins réussies au dernier essai, au plus 5 (aucun nom d'apprenant). */
  items: z.array(
    z.object({
      moduleSlug: z.string(),
      moduleTitle: z.string(),
      lessonTitle: z.string(),
      title: z.string(),
      learners: z.number().int(),
      successRate: z.number().min(0).max(1),
    }),
  ),
});
export type PracticeInsights = z.infer<typeof practiceInsightsSchema>;

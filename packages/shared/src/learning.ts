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
    description: 'Une activité enfin réussie après au moins deux essais manqués.',
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
  /** Empreinte du contenu de l'activité : un résultat n'est compté que sur ce même contenu. */
  fingerprint: z.string(),
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

/**
 * Façon dont l'activité a été jouée :
 * - `activity` : activité complète (lecteur, défis en séquence) ;
 * - `ascension` : une seule question à choix (`item`) de L'Ascension ;
 * - `memory` : jeu de mémoire sur des associations (aucune note : trouver les paires est garanti).
 */
export const PRACTICE_PLAY_MODES = ['activity', 'ascension', 'memory'] as const;
export type PracticePlayMode = (typeof PRACTICE_PLAY_MODES)[number];

export const practiceResultInputSchema = z.object({
  /**
   * Identifiant unique de la tentative, créé sur l'appareil au début de la partie : un même
   * identifiant rejoué (réseau, file hors ligne, double envoi, deux appareils) ne compte qu'une fois.
   * Facultatif pour les envois mis en file par une ancienne version de l'application.
   */
  attemptId: z.uuid().optional(),
  moduleSlug: z.string().min(1).max(120),
  activityKey: z.string().regex(/^[a-z0-9-]{6,40}$/),
  /** Empreinte du contenu joué (`BankActivity.fingerprint`) : jamais de recorrection silencieuse. */
  fingerprint: z
    .string()
    .regex(/^[0-9a-f]{8}$/)
    .optional(),
  mode: z.enum(PRACTICE_PLAY_MODES).default('activity'),
  /** Ascension : rang de la question dans l'activité. */
  item: z.number().int().min(0).max(99).optional(),
  /** Réponse obtenue avec une aide (indice, joker) : jamais comptée comme maîtrisée. */
  assisted: z.boolean().default(false),
  answers: practiceAnswersSchema,
});
export type PracticeResultInput = z.input<typeof practiceResultInputSchema>;

export const rewardSummarySchema = z.object({
  xpAwarded: z.number().int().nonnegative(),
  newBadges: z.array(earnedBadgeSchema),
});
export type RewardSummary = z.infer<typeof rewardSummarySchema>;

export const practiceResultSchema = rewardSummarySchema.extend({
  /**
   * `counted` : résultat pris en compte. `stale` : l'activité a changé (ou a été retirée) depuis
   * la partie ; la tentative est conservée dans l'historique, sans recorrection ni récompense.
   */
  status: z.enum(['counted', 'stale']).default('counted'),
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
  /**
   * Activités à revoir aujourd'hui, **encore présentes** dans la version publiée (au plus 20, les
   * plus anciennes d'abord). Une activité retirée n'est plus proposée ; son historique est conservé.
   */
  dueReviews: z.array(dueReviewSchema),
  /** Leçons lues (références d'événement), conservées pour les anciens clients. */
  readLessons: z.array(z.string()),
  /** Leçons de la version publiée actuelle déjà lues (identité stable, renommage compris). */
  readLessonIds: z.array(z.string()).default([]),
  /** Activités déjà pratiquées (`module:activité`), pour varier les parties. */
  practiced: z.array(z.string()),
  /** Activités réussies sans erreur au moins une fois (`module:activité`). */
  mastered: z.array(z.string()).default([]),
});
export type LearningJournal = z.infer<typeof learningJournalSchema>;

/**
 * Référence d'une leçon lue par son identité stable (`lesson_key`, recopiée de version en version,
 * conservée en cas de renommage).
 */
export function lessonKeyReadRef(moduleSlug: string, lessonKey: string): string {
  return `${moduleSlug}:k:${lessonKey}`;
}

/** Ancienne référence d'une leçon lue (empreinte du titre), encore reconnue pour l'historique. */
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
  events: { kind: string; moduleSlug: string; createdAt: Date; ref?: string }[];
  progress: {
    activityKind: string;
    masteredAt: Date | null;
    /** Essais manqués avant la première réussite complète (figé ensuite). */
    failuresBeforeMastery?: number;
  }[];
}

/** Boîte de révision à partir de laquelle une notion est « bien ancrée ». */
export const ANCHORED_BOX = 4;

/**
 * Conditions des badges et date à laquelle chacune a été remplie, calcul déterministe à partir de
 * faits en ajout seul : une erreur ultérieure ne peut pas faire disparaître une condition remplie.
 * Les badges obtenus sont en outre enregistrés (`learning_badges`) et restent acquis.
 */
export function computeBadges(facts: BadgeFacts): EarnedBadge[] {
  const byDate = <T extends { createdAt: Date }>(rows: T[]) =>
    [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const reads = byDate(facts.events.filter((event) => event.kind === 'LECON_LUE'));
  const mastered = byDate(facts.events.filter((event) => event.kind === 'ACTIVITE_MAITRISEE'));
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
  const orders = byDate(
    facts.progress
      .filter((row) => row.activityKind === 'order' && row.masteredAt)
      .map((row) => ({ createdAt: row.masteredAt! })),
  );
  // Persévérance : réussite complète obtenue après de vraies difficultés (≥ 2 essais manqués).
  const persevered = byDate(
    facts.progress
      .filter((row) => row.masteredAt && (row.failuresBeforeMastery ?? 0) >= 2)
      .map((row) => ({ createdAt: row.masteredAt! })),
  )[0];
  // Retour sur les traces : première révision réussie qui a fait atteindre la boîte d'ancrage
  // (événement en ajout seul, référence `module:activité:boîte`).
  const anchored = byDate(
    facts.events.filter((event) => {
      if (event.kind !== 'REVISION' || !event.ref) return false;
      const box = Number(event.ref.split(':').at(-1));
      return Number.isInteger(box) && box >= ANCHORED_BOX;
    }),
  )[0];

  const dates: Record<BadgeKey, Date | null> = {
    'premier-pas': nth(reads, 1),
    curiosite: curiosity,
    explorateur: nth(reads, 10),
    'memoire-de-la-route': nth(mastered, 10),
    'maitre-des-reperes': nth(orders, 3),
    perseverance: persevered?.createdAt ?? null,
    'retour-sur-les-traces': anchored?.createdAt ?? null,
  };
  return BADGES.map((badge) => ({
    key: badge.key,
    title: badge.title,
    description: badge.description,
    earnedAt: dates[badge.key]?.toISOString() ?? null,
  }));
}

/**
 * Badges affichés : un badge enregistré reste acquis avec sa date réelle d'obtention, même si sa
 * condition n'est plus vérifiable ; un badge dont la condition est remplie mais pas encore
 * enregistrée apparaît avec la date calculée.
 */
export function mergeBadges(
  computed: readonly EarnedBadge[],
  stored: readonly { badgeKey: string; earnedAt: Date }[],
): EarnedBadge[] {
  const kept = new Map(stored.map((row) => [row.badgeKey, row.earnedAt.toISOString()]));
  return computed.map((badge) => ({ ...badge, earnedAt: kept.get(badge.key) ?? badge.earnedAt }));
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

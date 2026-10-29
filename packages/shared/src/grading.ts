/**
 * Moteur de correction déterministe des questions objectives (aucune IA, aucune correction du texte libre).
 * Utilisé par l'API à la remise ou à la saisie d'une copie ; partagé pour que l'aperçu et les tests
 * appliquent exactement la même règle.
 */

/** Types de questions. Doit rester synchronisé avec l'enum Prisma `QuestionType` (vérifié par un test). */
export const QUESTION_TYPES = [
  'CHOIX_UNIQUE',
  'CHOIX_MULTIPLE',
  'VRAI_FAUX',
  'REPONSE_COURTE',
  'REPONSE_DEVELOPPEE',
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  CHOIX_UNIQUE: 'Choix unique',
  CHOIX_MULTIPLE: 'Choix multiples',
  VRAI_FAUX: 'Vrai ou faux',
  REPONSE_COURTE: 'Réponse courte',
  REPONSE_DEVELOPPEE: 'Réponse développée',
};

/** Questions corrigées automatiquement (propositions). */
export const OBJECTIVE_QUESTION_TYPES = ['CHOIX_UNIQUE', 'CHOIX_MULTIPLE', 'VRAI_FAUX'] as const;

export function isObjectiveQuestion(type: QuestionType): boolean {
  return (OBJECTIVE_QUESTION_TYPES as readonly string[]).includes(type);
}

/** Notation des choix multiples. Doit rester synchronisé avec l'enum Prisma `ScoringPolicy`. */
export const SCORING_POLICIES = ['TOUT_OU_RIEN', 'CREDIT_PARTIEL'] as const;

export type ScoringPolicy = (typeof SCORING_POLICIES)[number];

export const SCORING_POLICY_LABELS: Record<ScoringPolicy, string> = {
  TOUT_OU_RIEN: 'Tout ou rien',
  CREDIT_PARTIEL: 'Crédit partiel',
};

export interface GradableQuestion {
  type: QuestionType;
  points: number;
  scoringPolicy: ScoringPolicy;
  options: readonly { id: string; isCorrect: boolean }[];
}

/** Arrondi au centième (les barèmes sont stockés en DECIMAL(6,2)). */
export function roundPoints(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Points d'une question objective pour les propositions choisies ; `null` pour une question ouverte
 * (correction humaine obligatoire).
 * - Choix unique, vrai/faux : tous les points si une seule proposition est choisie et qu'elle est correcte.
 * - Choix multiples « tout ou rien » : tous les points si l'ensemble choisi est exactement l'ensemble correct.
 * - Choix multiples « crédit partiel » : (bonnes cochées − mauvaises cochées) ÷ nombre de bonnes, borné à 0,
 *   multiplié par le barème. Formule provisoire, à confirmer par le responsable (docs/DECISIONS.md, D60).
 * Les identifiants inconnus sont ignorés ; une proposition cochée deux fois ne compte qu'une fois.
 */
export function gradeObjectiveAnswer(
  question: GradableQuestion,
  selectedOptionIds: readonly string[],
): number | null {
  if (!isObjectiveQuestion(question.type)) return null;
  const known = new Set(question.options.map((option) => option.id));
  const selected = new Set(selectedOptionIds.filter((id) => known.has(id)));
  const correct = new Set(question.options.filter((o) => o.isCorrect).map((o) => o.id));
  if (correct.size === 0) return 0;

  const correctSelected = [...selected].filter((id) => correct.has(id)).length;
  const wrongSelected = selected.size - correctSelected;

  if (question.type !== 'CHOIX_MULTIPLE' || question.scoringPolicy === 'TOUT_OU_RIEN') {
    const exact = wrongSelected === 0 && correctSelected === correct.size;
    return exact ? question.points : 0;
  }
  const ratio = Math.max(0, (correctSelected - wrongSelected) / correct.size);
  return roundPoints(ratio * question.points);
}

/** Somme des barèmes et des points attribués ; `complete` = toutes les questions ont une note. */
export function totalScore(items: readonly { points: number; awardedPoints: number | null }[]): {
  score: number;
  maxScore: number;
  complete: boolean;
} {
  let score = 0;
  let maxScore = 0;
  let complete = true;
  for (const item of items) {
    maxScore += item.points;
    if (item.awardedPoints === null) complete = false;
    else score += item.awardedPoints;
  }
  return { score: roundPoints(score), maxScore: roundPoints(maxScore), complete };
}

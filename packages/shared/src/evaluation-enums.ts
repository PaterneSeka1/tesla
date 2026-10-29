// Énumérations des tentatives, sans dépendance (importées par scouts.ts et evaluations.ts).

/** Modes de passation. Doit rester synchronisé avec l'enum Prisma `EvaluationMode` (vérifié par un test). */
export const EVALUATION_MODES = ['EN_LIGNE', 'HORS_LIGNE', 'PAPIER'] as const;

export type EvaluationMode = (typeof EVALUATION_MODES)[number];

export const EVALUATION_MODE_LABELS: Record<EvaluationMode, string> = {
  EN_LIGNE: 'En ligne',
  HORS_LIGNE: 'Hors ligne',
  PAPIER: 'Papier',
};

/** Statuts d'une tentative. Doit rester synchronisé avec l'enum Prisma `AttemptStatus` (vérifié par un test). */
export const ATTEMPT_STATUSES = [
  'PREPAREE',
  'EN_COURS',
  'A_CORRIGER',
  'SOUMISE',
  'VALIDEE',
  'REFUSEE',
  'ANNULEE',
] as const;

export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

/** Statuts « non clôturés » : au plus une tentative de ce type par routier et par évaluation (RM-012). */
export const OPEN_ATTEMPT_STATUSES = ['PREPAREE', 'EN_COURS', 'A_CORRIGER', 'SOUMISE'] as const;

/**
 * Libellés affichés. VALIDEE/REFUSEE = examen du résultat corrigé par le responsable (« examinée ») :
 * ce n'est jamais la validation officielle d'un acquis ni un changement d'étape (RM-EVAL-004).
 */
export const ATTEMPT_STATUS_LABELS: Record<AttemptStatus, string> = {
  PREPAREE: 'Préparée',
  EN_COURS: 'En cours',
  A_CORRIGER: 'À corriger',
  SOUMISE: 'Soumise au responsable',
  VALIDEE: 'Résultat accepté',
  REFUSEE: 'Résultat non retenu',
  ANNULEE: 'Annulée',
};

/** Statuts dans lesquels la correction peut être saisie ou reprise par un chef. */
export const CORRECTABLE_ATTEMPT_STATUSES = ['PREPAREE', 'A_CORRIGER', 'SOUMISE'] as const;

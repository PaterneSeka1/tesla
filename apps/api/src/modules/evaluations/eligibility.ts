/**
 * Éligibilité pédagogique à une évaluation (RM-009), identique avec ou sans compte.
 * Règle provisoire, à confirmer par le responsable (docs/DECISIONS.md) : l'évaluation doit relever
 * de l'étape courante du routier. Hors de ce cas, seule une dérogation active du responsable l'autorise.
 */
export function isStageEligible(currentStageId: string | null, evaluationStageId: string): boolean {
  return currentStageId !== null && currentStageId === evaluationStageId;
}

export function isWaiverActive(
  waiver: { revokedAt: Date | null; expiresAt: Date | null },
  now: Date,
): boolean {
  return waiver.revokedAt === null && (waiver.expiresAt === null || waiver.expiresAt > now);
}

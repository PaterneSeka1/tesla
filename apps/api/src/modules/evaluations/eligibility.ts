import {
  type AttemptStatus,
  type Eligibility,
  type EvaluationMode,
  OPEN_ATTEMPT_STATUSES,
} from '@tesla/shared';

/**
 * Éligibilité pédagogique à une évaluation (RM-009, RM-EVAL-002), identique avec ou sans compte.
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

export interface EligibilityFacts {
  /** Profil routier ; null pour un compte routier sans profil rattaché. */
  profile: { isActive: boolean; currentStageId: string | null } | null;
  /** Appartenance effective à la branche (sortie à l'âge limite, D95) ; ACTIF si inconnue. */
  membership?: 'ACTIF' | 'SORTI';
  /** Obligation de rattrapage ouverte sur le module de l'évaluation (D98). */
  openCatchUp?: boolean;
  evaluationStageId: string;
  maxAttempts: number | null;
  /** Tentatives du routier pour cette évaluation (tous statuts). */
  attempts: readonly { id: string; code: string; mode: EvaluationMode; status: AttemptStatus }[];
  /** Dérogations du routier pour cette évaluation. */
  waivers: readonly {
    id: string;
    reason: string;
    grantedAt: Date;
    revokedAt: Date | null;
    expiresAt: Date | null;
  }[];
  now: Date;
}

/**
 * Décision d'éligibilité calculée côté serveur, dans la transaction qui crée la tentative.
 * Ordre : profil, appartenance à la branche, étape (ou rattrapage ouvert, ou dérogation active la plus
 * récente), limite de tentatives non annulées.
 * Une dérogation lève la condition d'étape, jamais la limite de tentatives. Une tentative ouverte
 * est signalée (à reprendre) sans rendre le routier inéligible.
 */
export function computeEligibility(facts: EligibilityFacts): Eligibility {
  const open = facts.attempts.find((attempt) =>
    (OPEN_ATTEMPT_STATUSES as readonly string[]).includes(attempt.status),
  );
  const attemptsUsed = facts.attempts.filter((attempt) => attempt.status !== 'ANNULEE').length;
  const base = {
    attemptsUsed,
    maxAttempts: facts.maxAttempts,
    openAttempt: open
      ? { id: open.id, code: open.code, mode: open.mode, status: open.status }
      : null,
    waiver: null,
  };
  if (!facts.profile) return { ...base, status: 'SANS_PROFIL', allowed: false };
  if (!facts.profile.isActive) return { ...base, status: 'PROFIL_INACTIF', allowed: false };
  if (facts.membership === 'SORTI') return { ...base, status: 'SORTI_BRANCHE', allowed: false };

  let waiver: Eligibility['waiver'] = null;
  const stageEligible = isStageEligible(facts.profile.currentStageId, facts.evaluationStageId);
  const catchUp = !stageEligible && facts.openCatchUp === true;
  if (!stageEligible && !catchUp) {
    const active = [...facts.waivers]
      .sort((a, b) => b.grantedAt.getTime() - a.grantedAt.getTime())
      .find((candidate) => isWaiverActive(candidate, facts.now));
    if (!active) return { ...base, status: 'ETAPE_NON_CORRESPONDANTE', allowed: false };
    waiver = {
      id: active.id,
      reason: active.reason,
      expiresAt: active.expiresAt?.toISOString() ?? null,
    };
  }
  // Une tentative ouverte se reprend : elle ne compte pas contre la limite pour l'accès.
  if (!open && facts.maxAttempts !== null && attemptsUsed >= facts.maxAttempts) {
    return { ...base, waiver, status: 'LIMITE_ATTEINTE', allowed: false };
  }
  const status = waiver ? 'ELIGIBLE_DEROGATION' : catchUp ? 'ELIGIBLE_RATTRAPAGE' : 'ELIGIBLE';
  return { ...base, waiver, status, allowed: true };
}

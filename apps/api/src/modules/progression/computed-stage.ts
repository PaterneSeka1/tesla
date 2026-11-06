import {
  type AgeProgression,
  type AgeRuleSetSnapshot,
  type MembershipStatus,
  type TheoreticalStageReason,
} from '@tesla/shared';
import { type Prisma, type ProgressionStage } from '../../generated/prisma/client.js';
import {
  ageProgressionOf,
  loadRuleSetRow,
  type RuleSetRow,
  todayCivil,
  toSnapshot,
} from './age-rules.js';

// Étape actuelle d'un routier (D173) : **seule** étape de l'application, calculée à chaque lecture à
// partir de la date de naissance, du référentiel d'âge en vigueur et de la date civile du jour à
// Abidjan. Jamais stockée, jamais saisie : l'ancienne étape officielle (`currentStageId`) n'est plus
// lue pour une décision. Une donnée manquante donne une étape non déterminée, jamais une étape de
// substitution.

type StageReader = Pick<Prisma.TransactionClient, 'ageRuleSet' | 'progressionStage'>;

/** Contexte de calcul partagé par une requête : référentiel du jour et étapes connues. */
export interface StageContext {
  today: string;
  ruleSet: RuleSetRow | null;
  rules: AgeRuleSetSnapshot | null;
  stages: ProgressionStage[];
}

export async function loadStageContext(
  db: StageReader,
  today: string = todayCivil(),
): Promise<StageContext> {
  // Requêtes successives : utilisable dans une transaction interactive.
  const ruleSet = await loadRuleSetRow(db, today);
  const stages = await db.progressionStage.findMany({ orderBy: { position: 'asc' } });
  return { today, ruleSet, rules: ruleSet && toSnapshot(ruleSet), stages };
}

export interface ComputedStage {
  stage: ProgressionStage | null;
  reason: TheoreticalStageReason;
  progression: AgeProgression;
}

/** Profil minimal nécessaire au calcul (avec ou sans compte). */
export interface StageSubject {
  birthDate: Date | null;
  membershipStatus?: MembershipStatus;
}

export function computedStageOf(profile: StageSubject, context: StageContext): ComputedStage {
  const progression = ageProgressionOf(profile, context.rules, context.today);
  // Une sortie enregistrée fait foi, même si une correction ultérieure la rendrait plus tardive.
  if (profile.membershipStatus === 'SORTI') {
    return { stage: null, reason: 'SORTI', progression };
  }
  const stage =
    progression.theoreticalStageCode === null
      ? null
      : (context.stages.find((row) => row.code === progression.theoreticalStageCode) ?? null);
  return { stage, reason: stage ? progression.reason : notDetermined(progression), progression };
}

export function computedStageIdOf(profile: StageSubject, context: StageContext): string | null {
  return computedStageOf(profile, context).stage?.id ?? null;
}

function notDetermined(progression: AgeProgression): TheoreticalStageReason {
  return progression.reason === 'REGLE' ? 'AUCUNE_REGLE' : progression.reason;
}

/**
 * Filtre en mémoire par étape calculée (`null` = étape non déterminée). L'effectif d'une communauté
 * (quelques dizaines de routiers) rend ce calcul négligeable ; il évite toute seconde vérité en base.
 */
export function withComputedStage<T extends StageSubject>(
  profiles: readonly T[],
  context: StageContext,
  stageId: string | null,
): T[] {
  return profiles.filter((profile) => computedStageIdOf(profile, context) === stageId);
}

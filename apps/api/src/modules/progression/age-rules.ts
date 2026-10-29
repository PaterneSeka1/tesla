import {
  type AgeProgression,
  type AgeRuleSetSnapshot,
  civilDateAt,
  computeAgeProgression,
  type MembershipStatus,
} from '@tesla/shared';
import { type Prisma } from '../../generated/prisma/client.js';

// Accès au référentiel d'âge en vigueur, partagé par la progression, les rattrapages,
// l'appartenance à la branche et l'éligibilité aux évaluations (lecture dans la transaction appelante).

type RuleSetReader = Pick<Prisma.TransactionClient, 'ageRuleSet'>;

const iso = (date: Date): string => date.toISOString().slice(0, 10);

export const ruleSetInclude = {
  stages: { include: { stage: { select: { code: true, name: true, position: true } } } },
} as const satisfies Prisma.AgeRuleSetInclude;

export type RuleSetRow = Prisma.AgeRuleSetGetPayload<{ include: typeof ruleSetInclude }>;

export function toSnapshot(row: RuleSetRow): AgeRuleSetSnapshot {
  return {
    version: row.version,
    branchExitAgeYears: row.branchExitAgeYears,
    catchUpDelayMonths: row.catchUpDelayMonths,
    exitAlertMonths: row.exitAlertMonths,
    stages: row.stages.map((rule) => ({
      stageCode: rule.stage.code,
      start: { years: rule.startYears, months: rule.startMonths },
      end: rule.endYears === null ? null : { years: rule.endYears, months: rule.endMonths ?? 0 },
    })),
  };
}

/** Référentiel applicable à une date civile : en vigueur, entré en vigueur le plus récemment. */
export async function loadRuleSetRow(db: RuleSetReader, date: string): Promise<RuleSetRow | null> {
  return db.ageRuleSet.findFirst({
    where: { status: 'EN_VIGUEUR', effectiveFrom: { lte: new Date(`${date}T00:00:00Z`) } },
    orderBy: { effectiveFrom: 'desc' },
    include: ruleSetInclude,
  });
}

export function todayCivil(now: Date = new Date()): string {
  return civilDateAt(now);
}

export function ageProgressionOf(
  profile: { birthDate: Date | null },
  rules: AgeRuleSetSnapshot | null,
  referenceDate: string,
): AgeProgression {
  return computeAgeProgression({
    birthDate: profile.birthDate ? iso(profile.birthDate) : null,
    referenceDate,
    rules,
  });
}

/**
 * Appartenance effective : la sortie enregistrée fait foi ; à défaut, la sortie calculée à la date
 * du jour s'applique immédiatement, même si le traitement quotidien n'a pas encore tourné.
 */
export function effectiveMembership(
  profile: { birthDate: Date | null; membershipStatus: MembershipStatus },
  rules: AgeRuleSetSnapshot | null,
  referenceDate: string,
): MembershipStatus {
  if (profile.membershipStatus === 'SORTI') return 'SORTI';
  return ageProgressionOf(profile, rules, referenceDate).membership === 'SORTI' ? 'SORTI' : 'ACTIF';
}

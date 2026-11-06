import {
  activeStageOverride,
  addCalendarDays,
  type AgeProgression,
  type AgeRuleSetSnapshot,
  compareCivilDates,
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

type StageReader = Pick<
  Prisma.TransactionClient,
  'ageRuleSet' | 'progressionStage' | 'stageOverride'
>;

/** Exception d'étape non levée, susceptible de s'appliquer (procédure de secours, D176). */
export interface OverrideRow {
  id: string;
  scoutProfileId: string;
  stageId: string;
  startsOn: string;
  /** Dernier jour d'application (inclus). */
  endsOn: string;
  liftedAt: null;
}

/** Contexte de calcul partagé par une requête : référentiel du jour, étapes, exceptions en cours. */
export interface StageContext {
  today: string;
  ruleSet: RuleSetRow | null;
  rules: AgeRuleSetSnapshot | null;
  stages: ProgressionStage[];
  /** Exceptions non levées couvrant la date du jour, par routier. */
  overrides: ReadonlyMap<string, readonly OverrideRow[]>;
}

const iso = (date: Date): string => date.toISOString().slice(0, 10);
const toDate = (value: string): Date => new Date(`${value}T00:00:00Z`);

export async function loadStageContext(
  db: StageReader,
  today: string = todayCivil(),
): Promise<StageContext> {
  // Requêtes successives : utilisable dans une transaction interactive.
  const ruleSet = await loadRuleSetRow(db, today);
  const stages = await db.progressionStage.findMany({ orderBy: { position: 'asc' } });
  // Quelques lignes au plus (procédure exceptionnelle) : chargées une fois par requête.
  const rows = await db.stageOverride.findMany({
    where: { liftedAt: null, startsOn: { lte: toDate(today) }, endsOn: { gte: toDate(today) } },
    select: { id: true, scoutProfileId: true, stageId: true, startsOn: true, endsOn: true },
  });
  const overrides = new Map<string, OverrideRow[]>();
  for (const row of rows) {
    const list = overrides.get(row.scoutProfileId) ?? [];
    list.push({
      ...row,
      startsOn: iso(row.startsOn),
      endsOn: iso(row.endsOn),
      liftedAt: null,
    });
    overrides.set(row.scoutProfileId, list);
  }
  return { today, ruleSet, rules: ruleSet && toSnapshot(ruleSet), stages, overrides };
}

export interface ComputedStage {
  /**
   * Étape **effectivement appliquée** (`effectiveStage`) : étape normale, sauf exception de secours
   * en cours. C'est elle que lisent l'éligibilité, le catalogue, les listes et les statistiques.
   */
  stage: ProgressionStage | null;
  reason: TheoreticalStageReason;
  /** Calendrier présenté au parcours (période de l'exception lorsqu'elle s'applique). */
  progression: AgeProgression;
  /** Étape normale selon l'âge (`computedStage`), jamais modifiée par une exception. */
  computedStage: ProgressionStage | null;
  computedReason: TheoreticalStageReason;
  /** Calcul par l'âge, brut (supervision du responsable plein). */
  normalProgression: AgeProgression;
  /** Exception appliquée aujourd'hui (`activeStageOverride`), nulle sinon. */
  override: OverrideRow | null;
}

/** Profil minimal nécessaire au calcul (avec ou sans compte). */
export interface StageSubject {
  /** Identifiant du profil : nul pour une simulation (aperçu d'une date de naissance). */
  id: string | null;
  birthDate: Date | null;
  membershipStatus?: MembershipStatus;
}

/**
 * Politique centrale (D176) : `effectiveStage` = exception en cours si elle est valide, sinon étape
 * normale selon l'âge. Une exception ne s'applique jamais à une personne sortie de la branche (21e
 * anniversaire) ni sans date de naissance ; à son expiration, l'étape normale reprend d'elle-même.
 */
export function computedStageOf(profile: StageSubject, context: StageContext): ComputedStage {
  const normal = ageProgressionOf(profile, context.rules, context.today);
  const exited = profile.membershipStatus === 'SORTI' || normal.membership === 'SORTI';
  // Une sortie enregistrée fait foi, même si une correction ultérieure la rendrait plus tardive.
  if (exited) {
    return {
      stage: null,
      reason: 'SORTI',
      progression: normal,
      computedStage: null,
      computedReason: 'SORTI',
      normalProgression: normal,
      override: null,
    };
  }
  const computedStage =
    normal.theoreticalStageCode === null
      ? null
      : (context.stages.find((row) => row.code === normal.theoreticalStageCode) ?? null);
  const computedReason = computedStage ? normal.reason : notDetermined(normal);
  const override =
    profile.id && profile.birthDate
      ? activeStageOverride(
          context.overrides.get(profile.id) ?? [],
          context.today,
          normal.branchExitOn,
        )
      : null;
  const overrideStage = override
    ? (context.stages.find((row) => row.id === override.stageId) ?? null)
    : null;
  if (!override || !overrideStage) {
    return {
      stage: computedStage,
      reason: computedReason,
      progression: normal,
      computedStage,
      computedReason,
      normalProgression: normal,
      override: null,
    };
  }
  return {
    stage: overrideStage,
    reason: 'REGLE',
    progression: effectiveProgression(normal, override, overrideStage.code),
    computedStage,
    computedReason,
    normalProgression: normal,
    override,
  };
}

/**
 * Calendrier cohérent avec l'étape appliquée : période de l'exception (fin exclue = lendemain du
 * dernier jour) et prochaine échéance = fin de l'exception si elle précède l'échéance normale.
 * L'âge, la date de sortie et le référentiel ne changent pas.
 */
function effectiveProgression(
  normal: AgeProgression,
  override: OverrideRow,
  stageCode: string,
): AgeProgression {
  const endsOn = addCalendarDays(override.endsOn, 1);
  const end = { kind: 'FIN_ETAPE' as const, stageCode, date: endsOn };
  const nextMilestone =
    normal.nextMilestone && compareCivilDates(normal.nextMilestone.date, endsOn) < 0
      ? normal.nextMilestone
      : end;
  return {
    ...normal,
    theoreticalStageCode: stageCode,
    reason: 'REGLE',
    period: { stageCode, startsOn: override.startsOn, endsOn },
    nextMilestone,
  };
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

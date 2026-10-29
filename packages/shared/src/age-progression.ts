import { z } from 'zod';

// Progression théorique par l'âge (docs/FEATURES/PROGRESSION_PAR_AGE.md).
// Fonctions pures et déterministes sur des dates civiles « AAAA-MM-JJ » : aucune heure, aucun fuseau
// sauf pour obtenir la date civile du jour à Abidjan. Aucune valeur pédagogique n'est codée ici :
// les âges et durées proviennent d'un référentiel versionné (`AgeRuleSet`) validé par le responsable.

/** Fuseau de référence des dates civiles (Côte d'Ivoire, UTC+0 sans heure d'été). */
export const CIVIL_TIME_ZONE = 'Africa/Abidjan';

/**
 * Anniversaire d'une personne née un 29 février les années non bissextiles : le 1er mars
 * (l'âge est atteint une fois le 28 février entièrement écoulé). Choix technique explicite, à
 * confirmer par le responsable (D97).
 */
export const LEAP_DAY_ANNIVERSARY = 'MAR_1' as const;

const CIVIL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

interface CivilParts {
  year: number;
  month: number;
  day: number;
}

function parse(date: string): CivilParts {
  const match = CIVIL_DATE_PATTERN.exec(date);
  if (!match) throw new RangeError(`Date civile invalide : ${date}`);
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  if (parts.month < 1 || parts.month > 12 || parts.day < 1) {
    throw new RangeError(`Date civile invalide : ${date}`);
  }
  if (parts.day > daysInMonth(parts.year, parts.month)) {
    throw new RangeError(`Date civile invalide : ${date}`);
  }
  return parts;
}

function format({ year, month, day }: CivilParts): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** Comparaison lexicographique : valable pour des dates « AAAA-MM-JJ » valides. */
export function compareCivilDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Date civile du jour à Abidjan pour un instant donné (jamais la date UTC ni celle du navigateur). */
export function civilDateAt(instant: Date, timeZone: string = CIVIL_TIME_ZONE): string {
  // « en-CA » formate en AAAA-MM-JJ.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/** Ajoute des mois calendaires ; le jour est ramené au dernier jour du mois s'il n'existe pas (31 → 30). */
export function addCalendarMonths(date: string, months: number): string {
  const { year, month, day } = parse(date);
  const index = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(index / 12);
  const targetMonth = (index % 12) + 1;
  return format({
    year: targetYear,
    month: targetMonth,
    day: Math.min(day, daysInMonth(targetYear, targetMonth)),
  });
}

export function addCalendarDays(date: string, days: number): string {
  const { year, month, day } = parse(date);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return format({
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  });
}

/** Nombre de jours entre deux dates civiles (`to` − `from`). */
export function daysBetween(from: string, to: string): number {
  const a = parse(from);
  const b = parse(to);
  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000,
  );
}

/** Date du N-ième anniversaire (règle du 29 février : {@link LEAP_DAY_ANNIVERSARY}). */
export function anniversaryOf(birthDate: string, years: number): string {
  const birth = parse(birthDate);
  const year = birth.year + years;
  if (birth.month === 2 && birth.day === 29 && !isLeapYear(year)) {
    return format({ year, month: 3, day: 1 });
  }
  return format({ year, month: birth.month, day: birth.day });
}

/** Âge révolu à une date : nombre d'anniversaires atteints (0 avant le premier). */
export function ageOn(birthDate: string, date: string): number {
  const birth = parse(birthDate);
  const target = parse(date);
  let years = target.year - birth.year;
  if (years > 0 && compareCivilDates(anniversaryOf(birthDate, years), date) > 0) years -= 1;
  return Math.max(years, 0);
}

/** Point d'âge : N années révolues puis M mois calendaires (ex. 18 ans + 1 mois). */
export interface AgePoint {
  years: number;
  months: number;
}

export function dateAtAge(birthDate: string, point: AgePoint): string {
  return addCalendarMonths(anniversaryOf(birthDate, point.years), point.months);
}

// ─── Référentiel versionné ──────────────────────────────────────────────────

/** Période d'étape théorique : [début, fin[ ; fin nulle = jusqu'à la sortie de la branche. */
export interface AgeStageRuleSnapshot {
  stageCode: string;
  start: AgePoint;
  end: AgePoint | null;
}

/** Référentiel en vigueur à une date. Toute valeur nulle signifie « non arbitrée » (jamais une valeur par défaut). */
export interface AgeRuleSetSnapshot {
  version: string;
  /** Âge de sortie de la branche (21 ans selon la règle fournie par le responsable). */
  branchExitAgeYears: number | null;
  /** Délai de rattrapage en mois calendaires ; nul tant qu'aucune durée officielle n'est validée. */
  catchUpDelayMonths: number | null;
  /** Seuil d'alerte avant la sortie, en mois ; nul tant qu'il n'est pas validé. */
  exitAlertMonths: number | null;
  stages: readonly AgeStageRuleSnapshot[];
}

export const THEORETICAL_STAGE_REASONS = [
  'REGLE',
  'DATE_NAISSANCE_MANQUANTE',
  'AUCUN_REFERENTIEL',
  'AUCUNE_REGLE',
  'SORTI',
] as const;

export type TheoreticalStageReason = (typeof THEORETICAL_STAGE_REASONS)[number];

export const THEORETICAL_STAGE_REASON_LABELS: Record<TheoreticalStageReason, string> = {
  REGLE: 'Déterminée par l’âge',
  DATE_NAISSANCE_MANQUANTE: 'Date de naissance non renseignée',
  AUCUN_REFERENTIEL: 'Aucun référentiel d’âge en vigueur',
  AUCUNE_REGLE: 'Aucune règle validée pour cet âge',
  SORTI: 'Sorti de la branche (limite d’âge atteinte)',
};

export const MEMBERSHIP_STATUSES = ['ACTIF', 'SORTI'] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const MEMBERSHIP_STATUS_LABELS: Record<MembershipStatus, string> = {
  ACTIF: 'Membre actif de la branche',
  SORTI: 'Sorti de la branche',
};

export interface StagePeriod {
  stageCode: string;
  startsOn: string;
  /** Date d'échéance (exclue de la période) ; nulle = jusqu'à la sortie ou non déterminée. */
  endsOn: string | null;
}

export interface AgeProgression {
  referenceDate: string;
  ruleSetVersion: string | null;
  age: number | null;
  theoreticalStageCode: string | null;
  reason: TheoreticalStageReason;
  period: StagePeriod | null;
  nextMilestone: {
    kind: 'DEBUT_ETAPE' | 'FIN_ETAPE' | 'SORTIE_BRANCHE';
    stageCode: string | null;
    date: string;
  } | null;
  /** Jour du N-ième anniversaire de sortie (le routier n'est plus membre actif ce jour-là). */
  branchExitOn: string | null;
  /** Nul si la sortie ne peut pas être calculée (date de naissance ou âge de sortie inconnus). */
  membership: MembershipStatus | null;
  daysUntilExit: number | null;
  /** Nul tant que le seuil d'alerte n'est pas validé. */
  approachingExit: boolean | null;
}

export function stagePeriods(birthDate: string, rules: AgeRuleSetSnapshot): StagePeriod[] {
  const exitOn =
    rules.branchExitAgeYears === null ? null : anniversaryOf(birthDate, rules.branchExitAgeYears);
  return rules.stages
    .map((rule) => ({
      stageCode: rule.stageCode,
      startsOn: dateAtAge(birthDate, rule.start),
      endsOn: rule.end ? dateAtAge(birthDate, rule.end) : exitOn,
    }))
    .sort((a, b) => compareCivilDates(a.startsOn, b.startsOn));
}

/**
 * Calcul central : étape théorique, période en cours, prochaine échéance, sortie à l'âge limite.
 * Ne décide jamais d'une étape officielle ni d'une validation.
 */
export function computeAgeProgression(input: {
  birthDate: string | null;
  referenceDate: string;
  rules: AgeRuleSetSnapshot | null;
}): AgeProgression {
  const { birthDate, referenceDate, rules } = input;
  const base: AgeProgression = {
    referenceDate,
    ruleSetVersion: rules?.version ?? null,
    age: birthDate ? ageOn(birthDate, referenceDate) : null,
    theoreticalStageCode: null,
    reason: 'DATE_NAISSANCE_MANQUANTE',
    period: null,
    nextMilestone: null,
    branchExitOn: null,
    membership: null,
    daysUntilExit: null,
    approachingExit: null,
  };
  if (!birthDate) return base;
  if (!rules) return { ...base, reason: 'AUCUN_REFERENTIEL' };

  const exitOn =
    rules.branchExitAgeYears === null ? null : anniversaryOf(birthDate, rules.branchExitAgeYears);
  const exited = exitOn !== null && compareCivilDates(referenceDate, exitOn) >= 0;
  const result: AgeProgression = {
    ...base,
    reason: 'AUCUNE_REGLE',
    branchExitOn: exitOn,
    membership: exitOn === null ? null : exited ? 'SORTI' : 'ACTIF',
    daysUntilExit: exitOn === null || exited ? null : daysBetween(referenceDate, exitOn),
    approachingExit:
      exitOn === null || exited || rules.exitAlertMonths === null
        ? null
        : compareCivilDates(referenceDate, addCalendarMonths(exitOn, -rules.exitAlertMonths)) >= 0,
  };
  if (exited) return { ...result, reason: 'SORTI' };

  const periods = stagePeriods(birthDate, rules);
  const current = periods.find(
    (period) =>
      compareCivilDates(period.startsOn, referenceDate) <= 0 &&
      (period.endsOn === null || compareCivilDates(referenceDate, period.endsOn) < 0),
  );
  const upcoming = periods.find((period) => compareCivilDates(period.startsOn, referenceDate) > 0);

  const milestones: NonNullable<AgeProgression['nextMilestone']>[] = [];
  if (current?.endsOn && current.endsOn !== exitOn) {
    milestones.push({ kind: 'FIN_ETAPE', stageCode: current.stageCode, date: current.endsOn });
  }
  if (upcoming) {
    milestones.push({
      kind: 'DEBUT_ETAPE',
      stageCode: upcoming.stageCode,
      date: upcoming.startsOn,
    });
  }
  if (exitOn) milestones.push({ kind: 'SORTIE_BRANCHE', stageCode: null, date: exitOn });
  milestones.sort((a, b) => compareCivilDates(a.date, b.date));

  return {
    ...result,
    theoreticalStageCode: current?.stageCode ?? null,
    reason: current ? 'REGLE' : 'AUCUNE_REGLE',
    period: current ?? null,
    nextMilestone: milestones[0] ?? null,
  };
}

/**
 * Date limite d'une obligation de rattrapage : nulle tant qu'aucun délai officiel n'est validé ;
 * jamais au-delà du dernier jour d'appartenance à la branche.
 */
export function catchUpDueOn(
  createdOn: string,
  delayMonths: number | null,
  branchExitOn: string | null,
): string | null {
  if (delayMonths === null) return null;
  const due = addCalendarMonths(createdOn, delayMonths);
  if (branchExitOn === null) return due;
  const lastDay = addCalendarDays(branchExitOn, -1);
  return compareCivilDates(due, lastDay) > 0 ? lastDay : due;
}

// ─── Contrats d'API ─────────────────────────────────────────────────────────

const civilDate = z.iso.date();

export const agePointSchema = z.object({
  years: z.number().int().min(0).max(40),
  months: z.number().int().min(0).max(11),
});

export const ageProgressionSchema = z.object({
  referenceDate: civilDate,
  ruleSetVersion: z.string().nullable(),
  age: z.number().int().nullable(),
  theoreticalStageCode: z.string().nullable(),
  reason: z.enum(THEORETICAL_STAGE_REASONS),
  period: z
    .object({ stageCode: z.string(), startsOn: civilDate, endsOn: civilDate.nullable() })
    .nullable(),
  nextMilestone: z
    .object({
      kind: z.enum(['DEBUT_ETAPE', 'FIN_ETAPE', 'SORTIE_BRANCHE']),
      stageCode: z.string().nullable(),
      date: civilDate,
    })
    .nullable(),
  branchExitOn: civilDate.nullable(),
  membership: z.enum(MEMBERSHIP_STATUSES).nullable(),
  daysUntilExit: z.number().int().nullable(),
  approachingExit: z.boolean().nullable(),
});

export const AGE_RULE_SET_STATUSES = ['BROUILLON', 'EN_VIGUEUR'] as const;
export type AgeRuleSetStatus = (typeof AGE_RULE_SET_STATUSES)[number];

/** Référentiel d'âge tel qu'exposé à l'encadrement (consultation et traçabilité). */
export const ageRuleSetSchema = z.object({
  id: z.uuid(),
  version: z.string(),
  status: z.enum(AGE_RULE_SET_STATUSES),
  effectiveFrom: civilDate.nullable(),
  sourceReference: z.string(),
  notes: z.string().nullable(),
  branchExitAgeYears: z.number().int().nullable(),
  catchUpDelayMonths: z.number().int().nullable(),
  exitAlertMonths: z.number().int().nullable(),
  stages: z.array(
    z.object({
      stageCode: z.string(),
      stageName: z.string(),
      start: agePointSchema,
      end: agePointSchema.nullable(),
      sourceReference: z.string(),
    }),
  ),
  activatedAt: z.iso.datetime().nullable(),
});

export type AgeRuleSet = z.infer<typeof ageRuleSetSchema>;

const sourceText = z
  .string()
  .trim()
  .min(3, { error: 'La source est obligatoire (3 caractères au minimum).' })
  .max(500, { error: '500 caractères au maximum.' });

const nullableCount = (max: number) => z.number().int().min(1).max(max).nullable();

/**
 * Nouveau référentiel (brouillon). Seules les règles confirmées sont saisies, chacune avec sa source ;
 * une valeur absente reste nulle (« non arbitrée »), jamais remplacée par une valeur par défaut.
 */
export const createAgeRuleSetInputSchema = z.object({
  version: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9._-]{1,30}$/, {
      error: 'Version : 1 à 30 caractères (lettres, chiffres, . _ -).',
    }),
  sourceReference: sourceText,
  notes: z.string().trim().max(3000).nullable().optional(),
  branchExitAgeYears: nullableCount(40),
  catchUpDelayMonths: nullableCount(120),
  exitAlertMonths: nullableCount(60),
  stages: z
    .array(
      z.object({
        stageCode: z.string().trim().min(1),
        start: agePointSchema,
        end: agePointSchema.nullable(),
        sourceReference: sourceText,
      }),
    )
    .max(10),
});

export type CreateAgeRuleSetInput = z.input<typeof createAgeRuleSetInputSchema>;

export const activateAgeRuleSetInputSchema = z.object({
  effectiveFrom: z.iso.date({ error: 'Date invalide (AAAA-MM-JJ).' }),
  confirm: z.literal(true, { error: 'Confirmation explicite requise.' }),
});

export type ActivateAgeRuleSetInput = z.input<typeof activateAgeRuleSetInputSchema>;

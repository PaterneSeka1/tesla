import { UnprocessableEntityException } from '@nestjs/common';
import { compareCivilDates, SCOUT_ADMIN_FIELDS, type ScoutAdminField } from '@tesla/shared';

// Complétion et correction des données administratives protégées d'un routier (D173).

export type AdminValue = string | null;

export interface AdminChange {
  field: ScoutAdminField;
  /** COMPLETION : valeur absente renseignée ; CORRECTION : valeur présente remplacée ou retirée. */
  kind: 'COMPLETION' | 'CORRECTION';
  previous: AdminValue;
  next: AdminValue;
}

export type AdminSnapshot = Record<ScoutAdminField, AdminValue>;

/**
 * Compare la fiche et la saisie, champ par champ. Retirer une valeur présente (`null`) est une
 * correction : impossible de contourner le motif en vidant d'abord le champ.
 */
export function diffAdminFields(
  previous: AdminSnapshot,
  input: Partial<Record<ScoutAdminField, AdminValue | undefined>>,
): AdminChange[] {
  return SCOUT_ADMIN_FIELDS.flatMap((field) => {
    const next = input[field];
    if (next === undefined || next === previous[field]) return [];
    return [
      {
        field,
        kind: previous[field] === null ? ('COMPLETION' as const) : ('CORRECTION' as const),
        previous: previous[field],
        next,
      },
    ];
  });
}

/** Une correction exige un motif et une confirmation explicite (422 sinon, rien n'est écrit). */
export function assertCorrectionJustified(
  changes: readonly AdminChange[],
  justification: { reason?: string; confirmCorrection?: true },
): void {
  if (!changes.some((change) => change.kind === 'CORRECTION')) return;
  if (!justification.reason) {
    throw new UnprocessableEntityException({
      code: 'CORRECTION_REASON_REQUIRED',
      message: 'Cette modification corrige une information déjà renseignée : indiquez le motif.',
    });
  }
  if (!justification.confirmCorrection) {
    throw new UnprocessableEntityException({
      code: 'CORRECTION_NOT_CONFIRMED',
      message: 'Confirmez la correction avant de l’enregistrer.',
    });
  }
}

/**
 * Cohérence des dates civiles : ni naissance ni entrée dans le futur, entrée postérieure à la
 * naissance. Aucune autre règle (âge d'entrée…) n'est présumée.
 */
export function assertAdminDates(
  dates: { birthDate: string | null; joinedAt: string | null },
  today: string,
): void {
  const invalid = (message: string) =>
    new UnprocessableEntityException({ code: 'INVALID_DATE', message });
  if (dates.birthDate && compareCivilDates(dates.birthDate, today) > 0) {
    throw invalid('La date de naissance ne peut pas être dans le futur.');
  }
  if (dates.joinedAt && compareCivilDates(dates.joinedAt, today) > 0) {
    throw invalid('La date d’entrée à la Route ne peut pas être dans le futur.');
  }
  if (dates.birthDate && dates.joinedAt && compareCivilDates(dates.joinedAt, dates.birthDate) < 0) {
    throw invalid('La date d’entrée à la Route précède la date de naissance.');
  }
}

/**
 * L'étape ne se saisit jamais (D173) : un champ d'étape transmis, par un ancien client ou un appel
 * direct, est refusé explicitement plutôt qu'ignoré.
 */
export function rejectStageInput(input: unknown): void {
  if (
    typeof input === 'object' &&
    input !== null &&
    ('currentStageId' in input || 'stageId' in input)
  ) {
    throw new UnprocessableEntityException({
      code: 'STAGE_IS_COMPUTED',
      message: 'L’étape est calculée automatiquement selon l’âge : elle ne se modifie pas.',
    });
  }
}

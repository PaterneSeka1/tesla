import { type UnprocessableEntityException } from '@nestjs/common';
import {
  type AdminSnapshot,
  assertAdminDates,
  assertCorrectionJustified,
  diffAdminFields,
  rejectStageInput,
} from './admin-changes.js';

const fiche: AdminSnapshot = {
  lastName: 'Fictif',
  firstName: 'Routier',
  matricule: null,
  birthDate: '2008-05-10',
  joinedAt: null,
};

const code = (fn: () => void) => {
  try {
    fn();
  } catch (error) {
    return ((error as UnprocessableEntityException).getResponse() as { code: string }).code;
  }
  return null;
};

describe('Complétion et correction des données administratives (D173)', () => {
  it('renseigner une valeur absente est une complétion', () => {
    expect(diffAdminFields(fiche, { matricule: '0000001A', joinedAt: '2026-09-05' })).toEqual([
      { field: 'matricule', kind: 'COMPLETION', previous: null, next: '0000001A' },
      { field: 'joinedAt', kind: 'COMPLETION', previous: null, next: '2026-09-05' },
    ]);
  });

  it('remplacer ou retirer une valeur présente est une correction', () => {
    expect(diffAdminFields(fiche, { birthDate: '2008-06-10' })[0]?.kind).toBe('CORRECTION');
    // Vider d'abord le champ ne contourne pas le motif.
    expect(diffAdminFields(fiche, { birthDate: null })[0]).toMatchObject({
      kind: 'CORRECTION',
      previous: '2008-05-10',
      next: null,
    });
  });

  it('une valeur identique ou absente de la saisie n’est pas un changement', () => {
    expect(diffAdminFields(fiche, { lastName: 'Fictif', firstName: undefined })).toEqual([]);
  });

  it('une correction exige motif puis confirmation ; une complétion non', () => {
    const correction = diffAdminFields(fiche, { lastName: 'Autre' });
    expect(code(() => assertCorrectionJustified(correction, {}))).toBe(
      'CORRECTION_REASON_REQUIRED',
    );
    expect(code(() => assertCorrectionJustified(correction, { reason: 'Erreur de saisie' }))).toBe(
      'CORRECTION_NOT_CONFIRMED',
    );
    expect(
      code(() =>
        assertCorrectionJustified(correction, {
          reason: 'Erreur de saisie',
          confirmCorrection: true,
        }),
      ),
    ).toBeNull();
    const completion = diffAdminFields(fiche, { matricule: '0000001A' });
    expect(code(() => assertCorrectionJustified(completion, {}))).toBeNull();
  });

  it('dates : ni futur, ni entrée avant la naissance', () => {
    const today = '2026-11-05';
    expect(code(() => assertAdminDates({ birthDate: '2026-11-06', joinedAt: null }, today))).toBe(
      'INVALID_DATE',
    );
    expect(code(() => assertAdminDates({ birthDate: null, joinedAt: '2026-11-06' }, today))).toBe(
      'INVALID_DATE',
    );
    expect(
      code(() => assertAdminDates({ birthDate: '2008-05-10', joinedAt: '2008-05-09' }, today)),
    ).toBe('INVALID_DATE');
    expect(
      code(() => assertAdminDates({ birthDate: '2008-05-10', joinedAt: '2026-09-05' }, today)),
    ).toBeNull();
  });

  it('l’étape transmise par un ancien client ou un appel direct est refusée', () => {
    expect(code(() => rejectStageInput({ currentStageId: null }))).toBe('STAGE_IS_COMPUTED');
    expect(code(() => rejectStageInput({ stageId: 'x' }))).toBe('STAGE_IS_COMPUTED');
    expect(code(() => rejectStageInput({ lastName: 'Fictif' }))).toBeNull();
  });
});

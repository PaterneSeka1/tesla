import { catchUpReminderKind, stageAnnouncementDue, summarizeOpenCatchUps } from '@tesla/shared';
import { describe, expect, it } from 'vitest';

// Indicateurs « Parcours de la communauté » : mêmes critères que la fiche et le verrou D177.

const base = {
  today: '2026-11-23',
  endedStageCodes: new Map([
    ['r1', new Set(['NOVICIAT', 'APPRENTISSAGE'])],
    ['r2', new Set(['NOVICIAT'])],
  ]),
  requiredModuleIds: new Set(['m1', 'm2', 'm3']),
  recognizedStageKeys: new Set<string>(),
  acceptedKeys: new Set<string>(),
};

const obligation = (
  scoutProfileId: string,
  moduleId: string,
  originStageCode: string,
  dueOn: string | null,
) => ({ scoutProfileId, moduleId, originStageId: `s-${originStageCode}`, originStageCode, dueOn });

describe('summarizeOpenCatchUps', () => {
  it('compte ouvertes, en retard et sans échéance', () => {
    const summary = summarizeOpenCatchUps({
      ...base,
      obligations: [
        obligation('r1', 'm1', 'NOVICIAT', '2026-11-01'),
        obligation('r1', 'm2', 'APPRENTISSAGE', '2026-12-10'),
        obligation('r2', 'm1', 'NOVICIAT', null),
      ],
    });
    expect(summary).toEqual({
      open: 3,
      overdue: 1,
      awaitingValidation: 0,
      withoutDeadline: 1,
      toReview: 0,
    });
  });

  it('ignore les routiers non membres (sortis, désactivés, hors équipe)', () => {
    const summary = summarizeOpenCatchUps({
      ...base,
      obligations: [obligation('sorti', 'm1', 'NOVICIAT', '2026-01-01')],
    });
    expect(summary.open).toBe(0);
    expect(summary.overdue).toBe(0);
  });

  it('ignore un module devenu facultatif et une étape reconnue (D181)', () => {
    const summary = summarizeOpenCatchUps({
      ...base,
      recognizedStageKeys: new Set(['r1:s-NOVICIAT']),
      obligations: [
        obligation('r1', 'm1', 'NOVICIAT', '2026-01-01'),
        obligation('r2', 'retire', 'NOVICIAT', '2026-01-01'),
      ],
    });
    expect(summary.open).toBe(0);
  });

  it('classe « à réexaminer » une étape d’origine plus échue (D173)', () => {
    const summary = summarizeOpenCatchUps({
      ...base,
      obligations: [obligation('r2', 'm2', 'APPRENTISSAGE', '2026-01-01')],
    });
    expect(summary).toMatchObject({ open: 0, overdue: 0, toReview: 1 });
  });

  it('un résultat accepté attend la validation et sort du retard', () => {
    const summary = summarizeOpenCatchUps({
      ...base,
      acceptedKeys: new Set(['r1:m1']),
      obligations: [obligation('r1', 'm1', 'NOVICIAT', '2026-01-01')],
    });
    expect(summary).toMatchObject({ open: 1, overdue: 0, awaitingValidation: 1 });
  });
});

describe('catchUpReminderKind (D192)', () => {
  const today = '2026-11-23';
  it('aucun rappel sans échéance', () => {
    expect(catchUpReminderKind(null, today, 7)).toBeNull();
  });
  it('en retard dès le lendemain de l’échéance, même sans fenêtre arbitrée', () => {
    expect(catchUpReminderKind('2026-11-22', today, null)).toBe('RATTRAPAGE_EN_RETARD');
    expect(catchUpReminderKind('2026-11-23', today, null)).toBeNull();
  });
  it('échéance proche dans la fenêtre, bornes incluses', () => {
    expect(catchUpReminderKind('2026-11-30', today, 7)).toBe('RATTRAPAGE_ECHEANCE_PROCHE');
    expect(catchUpReminderKind('2026-11-23', today, 7)).toBe('RATTRAPAGE_ECHEANCE_PROCHE');
    expect(catchUpReminderKind('2026-12-01', today, 7)).toBeNull();
  });
  it('fenêtre non arbitrée : aucun rappel préalable', () => {
    expect(catchUpReminderKind('2026-11-25', today, null)).toBeNull();
  });
});

describe('stageAnnouncementDue (D193)', () => {
  const today = '2026-11-24';
  it('annonce le jour même et jusqu’à 7 jours après le début de la période', () => {
    expect(stageAnnouncementDue('2026-11-24', today)).toBe(true);
    expect(stageAnnouncementDue('2026-11-17', today)).toBe(true);
    expect(stageAnnouncementDue('2026-11-16', today)).toBe(false);
  });
  it('jamais pour une période future ou inconnue', () => {
    expect(stageAnnouncementDue('2026-11-25', today)).toBe(false);
    expect(stageAnnouncementDue(null, today)).toBe(false);
  });
});

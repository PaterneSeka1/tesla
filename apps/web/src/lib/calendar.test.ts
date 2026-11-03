import { describe, expect, it } from 'vitest';
import { addMonths, monthGrid, monthsBetween, programmeOverview } from './calendar';

describe('calendrier', () => {
  it('décale les mois, y compris d’une année à l’autre', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2027-01', -1)).toBe('2026-12');
    expect(addMonths('2026-01', 0)).toBe('2026-01');
  });

  it('grille du lundi au dimanche couvrant tout le mois', () => {
    // 1er novembre 2026 : un dimanche.
    const weeks = monthGrid('2026-11');
    expect(weeks[0]?.[0]).toEqual({ date: '2026-10-26', day: 26, inMonth: false });
    expect(weeks[0]?.[6]).toEqual({ date: '2026-11-01', day: 1, inMonth: true });
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks.flat().filter((day) => day.inMonth)).toHaveLength(30);
    expect(weeks.at(-1)?.at(-1)?.date).toBe('2026-12-06');
  });

  it('n’ajoute pas de semaine vide quand le mois finit un dimanche', () => {
    // Février 2027 : du lundi 1er au dimanche 28.
    expect(monthGrid('2027-02')).toHaveLength(4);
  });

  it('liste les mois d’une période', () => {
    expect(monthsBetween('2026-09-01', '2027-01-31')).toEqual([
      '2026-09',
      '2026-10',
      '2026-11',
      '2026-12',
      '2027-01',
    ]);
  });
});

describe('synthèse du programme', () => {
  const sessions = [
    { plannedOn: '2026-09-12', status: 'REALISEE' as const },
    { plannedOn: '2026-10-10', status: 'PLANIFIEE' as const },
    { plannedOn: '2026-10-24', status: 'ANNULEE' as const },
    { plannedOn: '2026-11-03', status: 'PLANIFIEE' as const },
    { plannedOn: '2026-11-14', status: 'REPORTEE' as const },
  ];

  it('compte à venir, réalisées et en retard sans rien déduire', () => {
    expect(programmeOverview(sessions, '2026-11-03')).toEqual({
      upcoming: 2,
      realised: 1,
      overdue: 1,
      postponed: 1,
      cancelled: 1,
      monthsWithoutSession: [],
    });
  });

  it('signale les mois de la période sans séance (une séance annulée ne compte pas)', () => {
    const overview = programmeOverview(
      [{ plannedOn: '2026-10-24', status: 'ANNULEE' }],
      '2026-11-03',
      { startsOn: '2026-09-01', endsOn: '2026-11-30' },
    );
    expect(overview.monthsWithoutSession).toEqual(['2026-09', '2026-10', '2026-11']);
  });
});

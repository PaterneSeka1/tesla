import {
  addCalendarMonths,
  ageOn,
  type AgeRuleSetSnapshot,
  anniversaryOf,
  catchUpDueOn,
  catchUpStatus,
  civilDateAt,
  computeAgeProgression,
  stageGap,
} from '@tesla/shared';
import { expectedCatchUps } from './pathway.service.js';

// Référentiel de test : seules les deux règles fournies par le responsable (noviciat d'un mois
// à 18 ans, sortie à 21 ans). Aucune autre période n'est inventée.
const RULES: AgeRuleSetSnapshot = {
  version: 'test-1',
  branchExitAgeYears: 21,
  catchUpDelayMonths: null,
  exitAlertMonths: null,
  stages: [
    { stageCode: 'NOVICIAT', start: { years: 18, months: 0 }, end: { years: 18, months: 1 } },
  ],
};

const at = (
  birthDate: string | null,
  referenceDate: string,
  rules: AgeRuleSetSnapshot | null = RULES,
) => computeAgeProgression({ birthDate, referenceDate, rules });

describe('Calcul de l’âge (dates civiles)', () => {
  it('compte les anniversaires atteints, sans approximation en jours', () => {
    expect(ageOn('2008-05-10', '2026-05-09')).toBe(17);
    expect(ageOn('2008-05-10', '2026-05-10')).toBe(18);
    expect(ageOn('2008-05-10', '2008-05-10')).toBe(0);
  });

  it('29 février : anniversaire le 1er mars les années non bissextiles (D97)', () => {
    expect(anniversaryOf('2008-02-29', 18)).toBe('2026-03-01');
    expect(anniversaryOf('2008-02-29', 16)).toBe('2024-02-29');
    expect(ageOn('2008-02-29', '2026-02-28')).toBe(17);
    expect(ageOn('2008-02-29', '2026-03-01')).toBe(18);
  });

  it('ajoute des mois calendaires en ramenant au dernier jour du mois', () => {
    expect(addCalendarMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addCalendarMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addCalendarMonths('2026-12-15', 1)).toBe('2027-01-15');
    expect(addCalendarMonths('2027-01-15', -1)).toBe('2026-12-15');
  });

  it('date civile à Abidjan, indépendante de l’heure UTC du serveur', () => {
    expect(civilDateAt(new Date('2026-10-29T23:59:59Z'))).toBe('2026-10-29');
    expect(civilDateAt(new Date('2026-10-30T00:00:00Z'))).toBe('2026-10-30');
  });

  it('refuse une date civile inexistante', () => {
    expect(() => ageOn('2026-02-30', '2026-03-01')).toThrow(RangeError);
  });
});

describe('Étape théorique selon l’âge', () => {
  it('avant 18 ans : aucune règle validée, rien n’est inventé', () => {
    const result = at('2008-05-10', '2026-05-09');
    expect(result.theoreticalStageCode).toBeNull();
    expect(result.reason).toBe('AUCUNE_REGLE');
    expect(result.nextMilestone).toEqual({
      kind: 'DEBUT_ETAPE',
      stageCode: 'NOVICIAT',
      date: '2026-05-10',
    });
    expect(result.membership).toBe('ACTIF');
  });

  it('le jour des 18 ans : entrée en période de noviciat, échéance un mois calendaire plus tard', () => {
    const result = at('2008-05-10', '2026-05-10');
    expect(result.theoreticalStageCode).toBe('NOVICIAT');
    expect(result.period).toEqual({
      stageCode: 'NOVICIAT',
      startsOn: '2026-05-10',
      endsOn: '2026-06-10',
    });
    expect(result.nextMilestone).toEqual({
      kind: 'FIN_ETAPE',
      stageCode: 'NOVICIAT',
      date: '2026-06-10',
    });
  });

  it('pendant le premier mois puis à l’échéance', () => {
    expect(at('2008-05-10', '2026-06-09').theoreticalStageCode).toBe('NOVICIAT');
    const afterward = at('2008-05-10', '2026-06-10');
    expect(afterward.theoreticalStageCode).toBeNull();
    expect(afterward.reason).toBe('AUCUNE_REGLE');
    expect(afterward.nextMilestone?.kind).toBe('SORTIE_BRANCHE');
  });

  it('18 ans un 31 janvier : échéance au dernier jour de février', () => {
    expect(at('2008-01-31', '2026-01-31').period?.endsOn).toBe('2026-02-28');
  });

  it('né un 29 février : noviciat à partir du 1er mars en année non bissextile', () => {
    expect(at('2008-02-29', '2026-02-28').theoreticalStageCode).toBeNull();
    expect(at('2008-02-29', '2026-03-01').period).toEqual({
      stageCode: 'NOVICIAT',
      startsOn: '2026-03-01',
      endsOn: '2026-04-01',
    });
  });

  it('sans date de naissance ou sans référentiel : non déterminée', () => {
    expect(at(null, '2026-10-29').reason).toBe('DATE_NAISSANCE_MANQUANTE');
    expect(at('2008-05-10', '2026-10-29', null).reason).toBe('AUCUN_REFERENTIEL');
    expect(at('2008-05-10', '2026-10-29', null).membership).toBeNull();
  });

  it('déterministe : mêmes données, même date, même résultat', () => {
    expect(at('2007-03-15', '2026-10-29')).toEqual(at('2007-03-15', '2026-10-29'));
  });

  it('applique un changement de référentiel sans modifier le précédent', () => {
    const next: AgeRuleSetSnapshot = { ...RULES, version: 'test-2', stages: [] };
    expect(at('2008-05-10', '2026-05-20', next).theoreticalStageCode).toBeNull();
    expect(at('2008-05-10', '2026-05-20').theoreticalStageCode).toBe('NOVICIAT');
  });
});

describe('Sortie de la branche à 21 ans', () => {
  it('la veille : encore actif ; le jour même : sorti', () => {
    const eve = at('2005-11-03', '2026-11-02');
    expect(eve.membership).toBe('ACTIF');
    expect(eve.daysUntilExit).toBe(1);
    expect(eve.branchExitOn).toBe('2026-11-03');
    const day = at('2005-11-03', '2026-11-03');
    expect(day.membership).toBe('SORTI');
    expect(day.reason).toBe('SORTI');
    expect(day.theoreticalStageCode).toBeNull();
  });

  it('29 février : sortie le 1er mars en année non bissextile', () => {
    expect(at('2004-02-29', '2025-02-28').membership).toBe('ACTIF');
    expect(at('2004-02-29', '2025-03-01').membership).toBe('SORTI');
  });

  it('alerte avant la sortie seulement si un seuil est validé', () => {
    expect(at('2005-11-03', '2026-10-01').approachingExit).toBeNull();
    const withAlert = { ...RULES, exitAlertMonths: 3 };
    expect(at('2005-11-03', '2026-08-02', withAlert).approachingExit).toBe(false);
    expect(at('2005-11-03', '2026-08-03', withAlert).approachingExit).toBe(true);
  });
});

describe('Échéance de rattrapage', () => {
  it('reste non déterminée tant qu’aucun délai officiel n’est validé', () => {
    expect(catchUpDueOn('2026-10-29', null, '2027-01-01')).toBeNull();
  });

  it('ne dépasse jamais le dernier jour dans la branche', () => {
    expect(catchUpDueOn('2026-10-29', 2, '2027-06-01')).toBe('2026-12-29');
    expect(catchUpDueOn('2026-10-29', 6, '2027-01-15')).toBe('2027-01-14');
  });
});

describe('Statut d’une obligation de rattrapage', () => {
  const base = {
    decision: null,
    dueOn: null,
    today: '2026-10-29',
    studies: 0,
    attempts: 0,
    acceptedAttempts: 0,
  };

  it('n’est jamais « acquis » sans décision humaine', () => {
    expect(catchUpStatus({ ...base, studies: 3, attempts: 2, acceptedAttempts: 1 })).toBe(
      'EN_ATTENTE_VALIDATION',
    );
    expect(catchUpStatus({ ...base, decision: 'ACQUIS' })).toBe('ACQUIS');
    expect(catchUpStatus({ ...base, decision: 'NON_APPLICABLE' })).toBe('NON_APPLICABLE');
  });

  it('à faire, en cours, en retard selon l’échéance validée', () => {
    expect(catchUpStatus(base)).toBe('A_FAIRE');
    expect(catchUpStatus({ ...base, studies: 1 })).toBe('EN_COURS');
    expect(catchUpStatus({ ...base, studies: 1, dueOn: '2026-10-28' })).toBe('EN_RETARD');
    expect(catchUpStatus({ ...base, dueOn: '2026-10-29' })).toBe('A_FAIRE');
  });
});

describe('Obligations de rattrapage attendues', () => {
  const mandatory = [
    { moduleId: 'm-novice', stageId: 's1', stageCode: 'NOVICIAT' },
    { moduleId: 'm-appr', stageId: 's2', stageCode: 'APPRENTISSAGE' },
  ];

  it('seules les étapes dont la période est échue produisent des obligations', () => {
    expect(expectedCatchUps('2008-05-10', RULES, '2026-06-09', mandatory)).toEqual([]);
    expect(expectedCatchUps('2008-05-10', RULES, '2026-06-10', mandatory)).toEqual([
      { module: mandatory[0], endedOn: '2026-06-10' },
    ]);
  });
});

describe('Écart entre étape officielle et théorique', () => {
  it('information d’accompagnement uniquement', () => {
    expect(stageGap(1, 1)).toBe('ALIGNEE');
    expect(stageGap(1, 2)).toBe('EN_AVANCE');
    expect(stageGap(2, 1)).toBe('EN_RETARD');
    expect(stageGap(null, 1)).toBe('INDETERMINE');
  });
});

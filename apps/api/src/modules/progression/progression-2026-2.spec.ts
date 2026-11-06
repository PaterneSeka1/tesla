import {
  type AgeRuleSetSnapshot,
  addCalendarDays,
  addCalendarMonths,
  anniversaryOf,
  catchUpDueOn,
  catchUpReferenceDate,
  catchUpStageSchedule,
  civilDateAt,
  computeAgeProgression,
  stageOverrideStatus,
} from '@tesla/shared';
import { AGE_RULE_SET_2026_2 } from '../../../prisma/seeds/age-rules.seed.js';
import { computedStageOf, type OverrideRow, type StageContext } from './computed-stage.js';
import { expectedCatchUps } from './pathway.service.js';

// Chronologie Tesla 2026.2 (D176), testée sur les valeurs exactes du seed : 18 ans → noviciat,
// 18 ans + 1 mois → apprentissage, 19 ans → compagnonnage, 20 ans → préparation au Départ,
// 21 ans → sortie de la branche. Aucune tâche planifiée : tout est calculé à la date de référence.

const RULES: AgeRuleSetSnapshot = {
  version: AGE_RULE_SET_2026_2.version,
  branchExitAgeYears: AGE_RULE_SET_2026_2.branchExitAgeYears,
  catchUpDelayMonths: null,
  exitAlertMonths: null,
  stages: AGE_RULE_SET_2026_2.stages.map((rule) => ({
    stageCode: rule.code,
    start: { years: rule.startYears, months: rule.startMonths },
    end: { years: rule.endYears, months: rule.endMonths },
  })),
};

const stageAt = (birthDate: string, referenceDate: string) =>
  computeAgeProgression({ birthDate, referenceDate, rules: RULES });

const STAGES = [
  { id: 'n', code: 'NOVICIAT', name: 'Noviciat', position: 1 },
  { id: 'a', code: 'APPRENTISSAGE', name: 'Apprentissage', position: 2 },
  { id: 'c', code: 'COMPAGNONNAGE', name: 'Compagnonnage', position: 3 },
  { id: 'd', code: 'DEPART_ROUTIER', name: 'Préparation au Départ routier', position: 4 },
] as unknown as StageContext['stages'];

const context = (today: string, overrides: OverrideRow[] = []): StageContext => ({
  today,
  ruleSet: null,
  rules: RULES,
  stages: STAGES,
  overrides: new Map([['p', overrides]]),
});

const override = (stageId: string, startsOn: string, endsOn: string): OverrideRow => ({
  id: 'o',
  scoutProfileId: 'p',
  stageId,
  startsOn,
  endsOn,
  liftedAt: null,
});

const born = (date: string) => ({ id: 'p', birthDate: new Date(`${date}T00:00:00Z`) });

describe('Chronologie 2026.2 : transitions automatiques', () => {
  const birth = '2008-10-27';
  const cases: [string, string, string | null][] = [
    ['1. jour des 18 ans', '2026-10-27', 'NOVICIAT'],
    ['2. 18 ans + 15 jours', '2026-11-11', 'NOVICIAT'],
    ['   veille de 18 ans + 1 mois', '2026-11-26', 'NOVICIAT'],
    ['3. 18 ans + 1 mois', '2026-11-27', 'APPRENTISSAGE'],
    ['4. 18 ans + 11 mois', '2027-09-27', 'APPRENTISSAGE'],
    ['   veille des 19 ans', '2027-10-26', 'APPRENTISSAGE'],
    ['5. jour des 19 ans', '2027-10-27', 'COMPAGNONNAGE'],
    ['6. 19 ans + 11 mois', '2028-09-27', 'COMPAGNONNAGE'],
    ['7. jour des 20 ans', '2028-10-27', 'DEPART_ROUTIER'],
    ['8. 20 ans + 11 mois', '2029-09-27', 'DEPART_ROUTIER'],
    ['9. veille des 21 ans', '2029-10-26', 'DEPART_ROUTIER'],
    ['10. jour des 21 ans', '2029-10-27', null],
    ['11. lendemain des 21 ans', '2029-10-28', null],
  ];
  it.each(cases)('%s (%s)', (_label, date, expected) => {
    expect(stageAt(birth, date).theoreticalStageCode).toBe(expected);
  });

  it('exemple obligatoire : né le 27 octobre 2008', () => {
    expect(stageAt(birth, '2029-10-26').membership).toBe('ACTIF');
    const exit = stageAt(birth, '2029-10-27');
    expect(exit.membership).toBe('SORTI');
    expect(exit.reason).toBe('SORTI');
    expect(exit.branchExitOn).toBe('2029-10-27');
    expect(stageAt(birth, '2029-10-28').membership).toBe('SORTI');
  });

  it('12. calcul à la lecture : aucune dépendance à une tâche quotidienne', () => {
    // Même routier, aucune écriture : seule la date de référence change.
    expect(computedStageOf(born(birth), context('2026-11-26')).stage?.code).toBe('NOVICIAT');
    expect(computedStageOf(born(birth), context('2026-11-27')).stage?.code).toBe('APPRENTISSAGE');
    expect(computedStageOf(born(birth), context('2029-10-27')).reason).toBe('SORTI');
  });

  it('sortie à 00 h 00 heure d’Abidjan (UTC+0, sans heure d’été)', () => {
    expect(civilDateAt(new Date('2029-10-26T23:59:59Z'))).toBe('2029-10-26');
    expect(civilDateAt(new Date('2029-10-27T00:00:00Z'))).toBe('2029-10-27');
  });

  it('46. fins de mois : 31 janvier + 1 mois = dernier jour de février', () => {
    expect(addCalendarMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(stageAt('2008-01-31', '2026-02-27').theoreticalStageCode).toBe('NOVICIAT');
    expect(stageAt('2008-01-31', '2026-02-28').theoreticalStageCode).toBe('APPRENTISSAGE');
    // Année bissextile : 29 février existe.
    expect(stageAt('2010-01-31', '2028-02-28').theoreticalStageCode).toBe('NOVICIAT');
    expect(stageAt('2010-01-31', '2028-02-29').theoreticalStageCode).toBe('APPRENTISSAGE');
  });

  it('47. né un 29 février : anniversaire au 1er mars les années non bissextiles', () => {
    expect(anniversaryOf('2008-02-29', 18)).toBe('2026-03-01');
    expect(stageAt('2008-02-29', '2026-02-28').theoreticalStageCode).toBeNull();
    expect(stageAt('2008-02-29', '2026-03-01').theoreticalStageCode).toBe('NOVICIAT');
    expect(stageAt('2008-02-29', '2026-04-01').theoreticalStageCode).toBe('APPRENTISSAGE');
    // 21 ans en 2029 (non bissextile) : sortie le 1er mars, encore membre le 28 février.
    expect(stageAt('2008-02-29', '2029-02-28').membership).toBe('ACTIF');
    expect(stageAt('2008-02-29', '2029-03-01').membership).toBe('SORTI');
    // 20 ans en 2028 (bissextile) : le 29 février même.
    expect(stageAt('2008-02-29', '2028-02-29').theoreticalStageCode).toBe('DEPART_ROUTIER');
  });

  it('jamais une approximation en jours (21 × 365)', () => {
    expect(addCalendarDays('2008-10-27', 21 * 365)).not.toBe('2029-10-27');
    expect(stageAt('2008-10-27', addCalendarDays('2008-10-27', 21 * 365)).membership).toBe('ACTIF');
  });
});

describe('Arrivée tardive et rattrapages', () => {
  const mandatory = [
    { moduleId: 'm-n', stageId: 'n', stageCode: 'NOVICIAT' },
    { moduleId: 'm-a', stageId: 'a', stageCode: 'APPRENTISSAGE' },
    { moduleId: 'm-c', stageId: 'c', stageCode: 'COMPAGNONNAGE' },
  ];

  it('13. arrivée à 19 ans : Compagnonnage, noviciat et apprentissage à rattraper', () => {
    expect(computedStageOf(born('2007-10-27'), context('2026-11-06')).stage?.code).toBe(
      'COMPAGNONNAGE',
    );
    expect(
      expectedCatchUps('2007-10-27', RULES, '2026-11-06', mandatory).map((e) => e.module.moduleId),
    ).toEqual(['m-n', 'm-a']);
  });

  it('14. arrivée à 20 ans : préparation au Départ, trois étapes à rattraper', () => {
    expect(computedStageOf(born('2006-10-27'), context('2026-11-06')).stage?.code).toBe(
      'DEPART_ROUTIER',
    );
    expect(expectedCatchUps('2006-10-27', RULES, '2026-11-06', mandatory)).toHaveLength(3);
  });

  it('18. même âge, dates d’entrée différentes : même étape (la date d’entrée n’intervient pas)', () => {
    const a = computedStageOf({ ...born('2007-03-01') }, context('2026-11-06'));
    const b = computedStageOf({ ...born('2007-03-01') }, context('2026-11-06'));
    expect(a.stage?.code).toBe(b.stage?.code);
  });

  it('délai non rétroactif : arrivée, publication et référentiel postérieurs repoussent le départ', () => {
    const base = {
      stageEndedOn: '2026-01-10',
      joinedOn: '2026-09-05',
      createdOn: '2026-11-06',
      modulePublishedOn: '2026-03-01',
      ruleSetEffectiveFrom: '2026-11-06',
    };
    // Nouveau référentiel du jour : délai à partir de sa mise en vigueur.
    expect(catchUpReferenceDate(base)).toBe('2026-11-06');
    // Nouvel arrivant : à partir de son arrivée.
    expect(catchUpReferenceDate({ ...base, ruleSetEffectiveFrom: '2026-01-01' })).toBe(
      '2026-09-05',
    );
    // Module publié après l'arrivée : à partir de sa publication.
    expect(
      catchUpReferenceDate({
        ...base,
        ruleSetEffectiveFrom: '2026-01-01',
        modulePublishedOn: '2026-10-01',
      }),
    ).toBe('2026-10-01');
    // Date d'entrée inconnue : à partir de la création de l'obligation.
    expect(
      catchUpReferenceDate({ ...base, joinedOn: null, ruleSetEffectiveFrom: '2026-01-01' }),
    ).toBe('2026-11-06');
  });

  it('17. échéance jamais au-delà de la veille des 21 ans ; nulle sans délai validé', () => {
    expect(catchUpDueOn('2029-09-01', 3, '2029-10-27')).toBe('2029-10-26');
    expect(catchUpDueOn('2029-09-01', null, '2029-10-27')).toBeNull();
  });
});

describe('Exception de secours (étape appliquée)', () => {
  const birth = '2007-10-27'; // Compagnonnage du 2026-10-27 au 2027-10-26.

  it('sans exception : étape appliquée = étape normale', () => {
    const computed = computedStageOf(born(birth), context('2026-11-06'));
    expect(computed.stage?.code).toBe('COMPAGNONNAGE');
    expect(computed.computedStage?.code).toBe('COMPAGNONNAGE');
    expect(computed.override).toBeNull();
  });

  it('exception en cours : étape appliquée, étape normale inchangée, calendrier cohérent', () => {
    const computed = computedStageOf(
      born(birth),
      context('2026-11-06', [override('a', '2026-11-01', '2026-12-31')]),
    );
    expect(computed.stage?.code).toBe('APPRENTISSAGE');
    expect(computed.computedStage?.code).toBe('COMPAGNONNAGE');
    expect(computed.normalProgression.theoreticalStageCode).toBe('COMPAGNONNAGE');
    expect(computed.progression.period).toEqual({
      stageCode: 'APPRENTISSAGE',
      startsOn: '2026-11-01',
      endsOn: '2027-01-01',
    });
    expect(computed.progression.nextMilestone).toEqual({
      kind: 'FIN_ETAPE',
      stageCode: 'APPRENTISSAGE',
      date: '2027-01-01',
    });
    // L'âge et la sortie ne bougent pas.
    expect(computed.progression.age).toBe(19);
    expect(computed.progression.branchExitOn).toBe('2028-10-27');
  });

  it('28. exception expirée ou à venir : retour automatique à l’étape normale', () => {
    const rows = [override('a', '2026-11-01', '2026-12-31')];
    expect(computedStageOf(born(birth), context('2027-01-01', rows)).stage?.code).toBe(
      'COMPAGNONNAGE',
    );
    expect(computedStageOf(born(birth), context('2026-10-31', rows)).stage?.code).toBe(
      'COMPAGNONNAGE',
    );
    expect(stageOverrideStatus({ ...rows[0]! }, '2027-01-01', '2028-10-27')).toBe('EXPIREE');
  });

  it('29. exception levée : sans effet', () => {
    expect(
      stageOverrideStatus(
        { startsOn: '2026-11-01', endsOn: '2026-12-31', liftedAt: '2026-11-05T10:00:00Z' },
        '2026-11-06',
        '2028-10-27',
      ),
    ).toBe('LEVEE');
  });

  it('32. exception active le jour des 21 ans : sortie appliquée, aucune prolongation', () => {
    const rows = [override('d', '2028-10-01', '2028-12-31')];
    const computed = computedStageOf(born(birth), context('2028-10-27', rows));
    expect(computed.reason).toBe('SORTI');
    expect(computed.stage).toBeNull();
    expect(computed.override).toBeNull();
    expect(stageOverrideStatus({ ...rows[0]! }, '2028-10-27', '2028-10-27')).toBe('INOPERANTE');
    // La veille, l'exception s'applique encore.
    expect(computedStageOf(born(birth), context('2028-10-26', rows)).stage?.code).toBe(
      'DEPART_ROUTIER',
    );
  });

  it('31. date de naissance corrigée : l’exception reste bornée par la nouvelle sortie', () => {
    const rows = [override('d', '2026-11-01', '2027-06-30')];
    // Nouvelle date de naissance : 21 ans le 2026-12-01.
    const corrected = born('2005-12-01');
    expect(computedStageOf(corrected, context('2026-11-30', rows)).stage?.code).toBe(
      'DEPART_ROUTIER',
    );
    expect(computedStageOf(corrected, context('2026-12-01', rows)).reason).toBe('SORTI');
  });

  it('sortie enregistrée : aucune exception ne s’applique', () => {
    const computed = computedStageOf(
      { ...born(birth), membershipStatus: 'SORTI' },
      context('2026-11-06', [override('a', '2026-11-01', '2026-12-31')]),
    );
    expect(computed.stage).toBeNull();
    expect(computed.override).toBeNull();
  });

  it('sans date de naissance : aucune étape, même avec une exception', () => {
    const computed = computedStageOf(
      { id: 'p', birthDate: null },
      context('2026-11-06', [override('a', '2026-11-01', '2026-12-31')]),
    );
    expect(computed.stage).toBeNull();
    expect(computed.reason).toBe('DATE_NAISSANCE_MANQUANTE');
  });
});

describe('Rattrapages étape par étape (D177)', () => {
  const rules = { catchUpDelayMonths: null, catchUpDelayDays: 21 };

  it('délai de 21 jours : échéance le 21e jour (J + 20)', () => {
    expect(catchUpDueOn('2026-11-06', null, '2028-10-27', 21)).toBe('2026-11-26');
    // Les jours priment sur les mois.
    expect(catchUpDueOn('2026-11-06', 2, '2028-10-27', 21)).toBe('2026-11-26');
  });

  it('étapes enchaînées dans l’ordre : chacune 21 jours après la précédente', () => {
    const schedule = catchUpStageSchedule(
      ['NOVICIAT', 'APPRENTISSAGE', 'COMPAGNONNAGE'].map((stageCode) => ({
        stageCode,
        reference: '2026-11-06',
        existingDueOn: null,
      })),
      rules,
      '2028-10-27',
    );
    expect([...schedule.values()]).toEqual(['2026-11-26', '2026-12-17', '2027-01-07']);
  });

  it('échéance existante conservée ; la suite repart d’elle', () => {
    const schedule = catchUpStageSchedule(
      [
        { stageCode: 'NOVICIAT', reference: '2026-10-01', existingDueOn: '2026-10-21' },
        { stageCode: 'APPRENTISSAGE', reference: '2026-11-06', existingDueOn: null },
      ],
      rules,
      '2028-10-27',
    );
    // Référence postérieure à l'échéance précédente : le délai part de la référence.
    expect(schedule.get('NOVICIAT')).toBe('2026-10-21');
    expect(schedule.get('APPRENTISSAGE')).toBe('2026-11-26');
  });

  it('jamais au-delà de la veille des 21 ans', () => {
    const schedule = catchUpStageSchedule(
      ['NOVICIAT', 'APPRENTISSAGE'].map((stageCode) => ({
        stageCode,
        reference: '2026-10-01',
        existingDueOn: null,
      })),
      rules,
      '2026-10-30',
    );
    expect([...schedule.values()]).toEqual(['2026-10-21', '2026-10-29']);
  });

  it('sans délai validé : échéances nulles', () => {
    const schedule = catchUpStageSchedule(
      [{ stageCode: 'NOVICIAT', reference: '2026-11-06', existingDueOn: null }],
      { catchUpDelayMonths: null, catchUpDelayDays: null },
      '2028-10-27',
    );
    expect(schedule.get('NOVICIAT')).toBeNull();
  });
});

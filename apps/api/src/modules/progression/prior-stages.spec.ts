import {
  type AgeRuleSetSnapshot,
  catchUpStatus,
  computeAgeProgression,
  pathwayTimeline,
  priorStageIssue,
  stageAdmissionIssue,
} from '@tesla/shared';
import { describe, expect, it } from 'vitest';

// D181 : invariant « routier actif = étape déterminée », parcours antérieur reconnu, frise.

const RULES: AgeRuleSetSnapshot = {
  version: 'fictif',
  branchExitAgeYears: 21,
  catchUpDelayMonths: null,
  catchUpDelayDays: 21,
  exitAlertMonths: null,
  stages: [
    { stageCode: 'NOVICIAT', start: { years: 18, months: 0 }, end: { years: 18, months: 1 } },
    { stageCode: 'APPRENTISSAGE', start: { years: 18, months: 1 }, end: { years: 19, months: 0 } },
    { stageCode: 'COMPAGNONNAGE', start: { years: 19, months: 0 }, end: { years: 20, months: 0 } },
    { stageCode: 'DEPART_ROUTIER', start: { years: 20, months: 0 }, end: { years: 21, months: 0 } },
  ],
};

const STAGES = [
  { id: '00000000-0000-7000-8000-000000000001', code: 'NOVICIAT', name: 'Noviciat', position: 1 },
  {
    id: '00000000-0000-7000-8000-000000000002',
    code: 'APPRENTISSAGE',
    name: 'Apprentissage',
    position: 2,
  },
  {
    id: '00000000-0000-7000-8000-000000000003',
    code: 'COMPAGNONNAGE',
    name: 'Compagnonnage',
    position: 3,
  },
  {
    id: '00000000-0000-7000-8000-000000000004',
    code: 'DEPART_ROUTIER',
    name: 'Départ',
    position: 4,
  },
];
const [NOV, APP, COMP, DEP] = STAGES as [
  (typeof STAGES)[0],
  (typeof STAGES)[0],
  (typeof STAGES)[0],
  (typeof STAGES)[0],
];

const TODAY = '2026-11-15';
const issueFor = (birthDate: string | null, rules: AgeRuleSetSnapshot | null = RULES) =>
  stageAdmissionIssue(
    computeAgeProgression({ birthDate, referenceDate: TODAY, rules }),
    birthDate,
    rules,
  );

describe('Admission d’un routier actif (D181)', () => {
  it('accepte toute date de naissance donnant une étape', () => {
    expect(issueFor('2008-11-15')).toBeNull(); // 18 ans le jour même : noviciat
    expect(issueFor('2007-01-10')).toBeNull(); // 19 ans : compagnonnage
    expect(issueFor('2005-11-16')).toBeNull(); // veille du 21e anniversaire
  });

  it('refuse sans date de naissance, sans référentiel ou hors de la branche', () => {
    expect(issueFor(null)).toBe('BIRTH_DATE_REQUIRED');
    expect(issueFor('2008-01-01', null)).toBe('NO_AGE_RULE_SET');
    expect(issueFor('2008-11-16')).toBe('BELOW_ROUTE_AGE'); // 18 ans demain
    expect(issueFor('2005-11-15')).toBe('ABOVE_ROUTE_AGE'); // 21e anniversaire aujourd'hui
  });

  it('distingue une lacune du référentiel d’un âge trop jeune', () => {
    const partial = { ...RULES, stages: RULES.stages.slice(0, 1) }; // noviciat seul
    expect(issueFor('2007-01-10', partial)).toBe('NO_AGE_RULE');
    expect(issueFor('2009-01-10', partial)).toBe('BELOW_ROUTE_AGE');
  });
});

describe('Reconnaissance du parcours antérieur (D181)', () => {
  const base = {
    stages: STAGES,
    currentStage: COMP,
    alreadyRecognized: new Set<string>(),
    birthDate: '2007-01-10',
    today: TODAY,
  };

  it('accepte les étapes antérieures, date de fin facultative', () => {
    expect(
      priorStageIssue({
        ...base,
        requested: [{ stageId: NOV.id }, { stageId: APP.id, completedOn: '2026-01-09' }],
      }),
    ).toBeNull();
  });

  it('refuse l’étape actuelle, une étape future, un doublon, une étape déjà reconnue', () => {
    expect(priorStageIssue({ ...base, requested: [{ stageId: COMP.id }] })?.code).toBe(
      'NOT_PRIOR_STAGE',
    );
    expect(priorStageIssue({ ...base, requested: [{ stageId: DEP.id }] })?.code).toBe(
      'NOT_PRIOR_STAGE',
    );
    expect(
      priorStageIssue({ ...base, requested: [{ stageId: NOV.id }, { stageId: NOV.id }] })?.code,
    ).toBe('DUPLICATE_STAGE');
    expect(
      priorStageIssue({
        ...base,
        alreadyRecognized: new Set([NOV.id]),
        requested: [{ stageId: NOV.id }],
      })?.code,
    ).toBe('ALREADY_RECOGNIZED');
    expect(
      priorStageIssue({ ...base, requested: [{ stageId: '00000000-0000-7000-8000-00000000000f' }] })
        ?.code,
    ).toBe('UNKNOWN_STAGE');
  });

  it('refuse une date de fin future ou antérieure à la naissance', () => {
    for (const completedOn of ['2026-11-16', '2007-01-10', '2000-01-01']) {
      expect(
        priorStageIssue({ ...base, requested: [{ stageId: NOV.id, completedOn }] })?.code,
      ).toBe('COMPLETED_ON_INVALID');
    }
  });

  it('refuse tout tant que l’étape actuelle n’est pas déterminée', () => {
    expect(
      priorStageIssue({ ...base, currentStage: null, requested: [{ stageId: NOV.id }] })?.code,
    ).toBe('STAGE_UNDETERMINED');
    expect(
      priorStageIssue({ ...base, birthDate: null, requested: [{ stageId: NOV.id }] })?.code,
    ).toBe('STAGE_UNDETERMINED');
  });

  it('un rattrapage d’étape reconnue ne retient plus, sans jamais devenir « acquis »', () => {
    const facts = { decision: null, dueOn: '2026-01-01', today: TODAY, studies: 0, attempts: 0 };
    expect(catchUpStatus({ ...facts, acceptedAttempts: 0, priorStageRecognized: true })).toBe(
      'PARCOURS_ANTERIEUR',
    );
    expect(catchUpStatus({ ...facts, acceptedAttempts: 0 })).toBe('EN_RETARD');
    // La décision humaine prime toujours.
    expect(
      catchUpStatus({
        ...facts,
        decision: 'ACQUIS',
        acceptedAttempts: 1,
        priorStageRecognized: true,
      }),
    ).toBe('ACQUIS');
  });
});

describe('Frise du parcours (D181)', () => {
  it('sépare reconnu, période terminée, en cours et à venir', () => {
    const timeline = pathwayTimeline({
      stages: [...STAGES].reverse(),
      currentStageId: COMP.id,
      endedStageCodes: new Set(['NOVICIAT', 'APPRENTISSAGE']),
      recognitions: [{ id: 'r1', stageId: NOV.id, completedOn: null }],
    });
    expect(timeline.map((step) => [step.stage.code, step.status])).toEqual([
      ['NOVICIAT', 'RECONNUE'],
      ['APPRENTISSAGE', 'TERMINEE'],
      ['COMPAGNONNAGE', 'EN_COURS'],
      ['DEPART_ROUTIER', 'A_VENIR'],
    ]);
    expect(timeline[0]!.recognition).toEqual({ id: 'r1', completedOn: null });
  });

  it('sans étape déterminée, aucune étape n’est « en cours »', () => {
    const timeline = pathwayTimeline({
      stages: STAGES,
      currentStageId: null,
      endedStageCodes: new Set(),
      recognitions: [],
    });
    expect(timeline.every((step) => step.status === 'A_VENIR')).toBe(true);
  });
});

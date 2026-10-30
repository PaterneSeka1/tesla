import { createQuestionInputSchema } from '@tesla/shared';
import { ROUTE_CATALOG, ROUTE_MODULES } from './route-bibliotheque.seed.js';
import { ROUTE_QUIZZES } from './route-questionnaires.js';
import { SCOUTISME_BASE_MODULES } from './scoutisme-base.seed.js';

const VERSION_ID = '0190f0c4-0000-7000-8000-000000000001';

describe('Questionnaires du catalogue', () => {
  it('couvre chaque module du catalogue et les modules « Bases du scoutisme », une seule fois', () => {
    const keys = ROUTE_QUIZZES.map((quiz) => quiz.moduleKey);
    expect(new Set(keys).size).toBe(keys.length);
    const expected = new Set([
      ...ROUTE_CATALOG.map((entry) => entry.key),
      ...SCOUTISME_BASE_MODULES.map((module) => module.key),
    ]);
    expect(new Set(keys)).toEqual(expected);
    // Aucun questionnaire pour un texte fondamental (pas d'étape, pas d'évaluation).
    expect(keys.some((key) => key.startsWith('NT-TXT'))).toBe(false);
    expect(ROUTE_MODULES.every((module) => keys.includes(module.key))).toBe(true);
  });

  it('ne contient que des questions objectives valides (correction automatique)', () => {
    for (const quiz of ROUTE_QUIZZES) {
      expect(quiz.questions.length).toBeGreaterThanOrEqual(4);
      for (const question of quiz.questions) {
        expect(['CHOIX_UNIQUE', 'CHOIX_MULTIPLE', 'VRAI_FAUX']).toContain(question.type);
        const parsed = createQuestionInputSchema.safeParse({ ...question, versionId: VERSION_ID });
        expect(parsed.success, `${quiz.moduleKey} : ${question.prompt}`).toBe(true);
        const labels = question.options!.map((option) => option.label);
        expect(new Set(labels).size).toBe(labels.length);
      }
    }
  });
});

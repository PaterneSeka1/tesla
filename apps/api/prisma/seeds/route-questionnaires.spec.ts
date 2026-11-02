import { createQuestionInputSchema } from '@tesla/shared';
import { auditQuizQuestions, definitionQuestions } from './pedagogy-audit.js';
import { ROUTE_CATALOG, ROUTE_MODULES } from './route-bibliotheque.seed.js';
import { quizQuestionInput, ROUTE_QUIZZES } from './route-questionnaires.js';
import { SCOUTISME_BASE_MODULES } from './scoutisme-base.seed.js';

const VERSION_ID = '0190f0c4-0000-7000-8000-000000000001';
const MODULES = [...SCOUTISME_BASE_MODULES, ...ROUTE_MODULES];
const titlesOf = (key: string) =>
  MODULES.find((module) => module.key === key)!.lessons.map((lesson) => lesson.title);

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

  it('propose 8 à 12 questions à correction automatique, valides pour l’API', () => {
    for (const quiz of ROUTE_QUIZZES) {
      expect(quiz.questions.length, quiz.moduleKey).toBeGreaterThanOrEqual(8);
      expect(quiz.questions.length, quiz.moduleKey).toBeLessThanOrEqual(12);
      const titles = titlesOf(quiz.moduleKey);
      for (const item of quiz.questions) {
        expect(['CHOIX_UNIQUE', 'CHOIX_MULTIPLE', 'VRAI_FAUX', 'REPONSE_COURTE']).toContain(
          item.question.type,
        );
        const input = quizQuestionInput(item, titles);
        const parsed = createQuestionInputSchema.safeParse({ ...input, versionId: VERSION_ID });
        expect(parsed.success, `${quiz.moduleKey} : ${item.question.prompt}`).toBe(true);
        // Corrigé : leçon de référence, niveau et explication.
        expect(input.guidance).toMatch(
          /^Leçon \d+ « .+ » — difficulté (facile|moyen|difficile)\. .+/,
        );
        if (item.question.type === 'REPONSE_COURTE') {
          expect(item.question.acceptedAnswers!.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('passe le vérificateur : corrigé cohérent, aucun doublon, renvois aux leçons existantes', () => {
    for (const quiz of ROUTE_QUIZZES) {
      const result = definitionQuestions(quiz.moduleKey, titlesOf(quiz.moduleKey))!;
      expect(result.issues, quiz.moduleKey).toEqual([]);
    }
  });

  it('détecte un corrigé ambigu, une question répétée et un renvoi invalide', () => {
    const base = { acceptedAnswers: [], lesson: 1 };
    const issues = auditQuizQuestions(
      [
        {
          ...base,
          type: 'CHOIX_UNIQUE',
          prompt: 'A ?',
          options: [
            { label: 'x', isCorrect: true },
            { label: 'y', isCorrect: true },
          ],
        },
        {
          ...base,
          type: 'VRAI_FAUX',
          prompt: 'a ?',
          options: [
            { label: 'Vrai', isCorrect: true },
            { label: 'Faux', isCorrect: false },
          ],
        },
        {
          ...base,
          type: 'CHOIX_MULTIPLE',
          prompt: 'B ?',
          options: [
            { label: 'x', isCorrect: true },
            { label: 'X', isCorrect: false },
          ],
        },
        { ...base, type: 'REPONSE_COURTE', prompt: 'C ?', options: [], lesson: 9 },
      ],
      2,
    );
    const codes = issues.map((issue) => issue.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'CORRIGE_INVALIDE',
        'QUESTION_REPETEE',
        'REPONSES_IDENTIQUES',
        'CORRECTION_HUMAINE',
        'RENVOI_LECON_INVALIDE',
      ]),
    );
  });
});

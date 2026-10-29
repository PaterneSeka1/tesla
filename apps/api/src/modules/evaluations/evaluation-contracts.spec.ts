import {
  ATTEMPT_STATUSES,
  attemptCodeSchema,
  createQuestionInputSchema,
  EVALUATION_MODES,
  EVALUATION_VERSION_ACTIONS,
  EVALUATION_VERSION_STATUSES,
  formatAttemptCode,
  formatEvaluationCode,
  gradeObjectiveAnswer,
  publicQuestionSchema,
  QUESTION_TYPES,
  saveCorrectionInputSchema,
  SCORING_POLICIES,
  totalScore,
} from '@tesla/shared';
import {
  AttemptStatus,
  EvaluationMode,
  EvaluationVersionAction,
  EvaluationVersionStatus,
  QuestionType,
  ScoringPolicy,
} from '../../generated/prisma/enums.js';

const VERSION_ID = '0190a1b2-0000-7000-8000-000000000001';

describe('Contrats des évaluations', () => {
  it('les enums Prisma correspondent aux constantes de @tesla/shared', () => {
    expect(Object.values(EvaluationMode).sort()).toEqual([...EVALUATION_MODES].sort());
    expect(Object.values(AttemptStatus).sort()).toEqual([...ATTEMPT_STATUSES].sort());
    expect(Object.values(QuestionType).sort()).toEqual([...QUESTION_TYPES].sort());
    expect(Object.values(ScoringPolicy).sort()).toEqual([...SCORING_POLICIES].sort());
    expect(Object.values(EvaluationVersionStatus).sort()).toEqual(
      [...EVALUATION_VERSION_STATUSES].sort(),
    );
    expect(Object.values(EvaluationVersionAction).sort()).toEqual(
      [...EVALUATION_VERSION_ACTIONS].sort(),
    );
  });

  it('formate le code de tentative NT-AAAA-NNNNNN et le code d’évaluation', () => {
    expect(formatAttemptCode(2027, 125)).toBe('NT-2027-000125');
    expect(formatAttemptCode(2027, 999_999)).toBe('NT-2027-999999');
    expect(formatEvaluationCode(7)).toBe('EVAL-007');
  });

  it('refuse un rang hors limites plutôt que de produire un code ambigu', () => {
    expect(() => formatAttemptCode(2027, 0)).toThrow(RangeError);
    expect(() => formatAttemptCode(2027, 1_000_000)).toThrow(RangeError);
    expect(() => formatAttemptCode(27, 1)).toThrow(RangeError);
  });

  it('normalise la saisie d’un code et rejette un format invalide', () => {
    expect(attemptCodeSchema.parse(' nt-2027-000125 ')).toBe('NT-2027-000125');
    expect(attemptCodeSchema.safeParse('NT-2027-125').success).toBe(false);
    expect(attemptCodeSchema.safeParse('2027-000125').success).toBe(false);
  });

  describe('forme des questions', () => {
    const base = { versionId: VERSION_ID, prompt: 'Énoncé fictif ?', points: 2 };
    const options = (...correct: boolean[]) =>
      correct.map((isCorrect, index) => ({ label: `Proposition ${index + 1}`, isCorrect }));
    const valid = (input: object) => createQuestionInputSchema.safeParse(input).success;

    it('choix unique : au moins deux propositions et exactement une bonne', () => {
      expect(valid({ ...base, type: 'CHOIX_UNIQUE', options: options(true, false) })).toBe(true);
      expect(valid({ ...base, type: 'CHOIX_UNIQUE', options: options(true, true) })).toBe(false);
      expect(valid({ ...base, type: 'CHOIX_UNIQUE', options: options(true) })).toBe(false);
    });

    it('choix multiples : au moins une bonne réponse', () => {
      expect(valid({ ...base, type: 'CHOIX_MULTIPLE', options: options(true, true, false) })).toBe(
        true,
      );
      expect(valid({ ...base, type: 'CHOIX_MULTIPLE', options: options(false, false) })).toBe(
        false,
      );
    });

    it('vrai/faux : deux propositions, une bonne ; question ouverte sans proposition', () => {
      expect(valid({ ...base, type: 'VRAI_FAUX', options: options(false, true) })).toBe(true);
      expect(valid({ ...base, type: 'VRAI_FAUX', options: options(true, true) })).toBe(false);
      expect(valid({ ...base, type: 'REPONSE_COURTE' })).toBe(true);
      expect(valid({ ...base, type: 'REPONSE_DEVELOPPEE', options: options(true) })).toBe(false);
    });

    it('barème positif au centième', () => {
      expect(valid({ ...base, type: 'REPONSE_COURTE', points: 1.25 })).toBe(true);
      expect(valid({ ...base, type: 'REPONSE_COURTE', points: 0 })).toBe(false);
      expect(valid({ ...base, type: 'REPONSE_COURTE', points: 1.234 })).toBe(false);
    });
  });

  it('la question publique ne transporte ni bonne réponse ni barème', () => {
    const parsed = publicQuestionSchema.parse({
      id: VERSION_ID,
      position: 0,
      type: 'CHOIX_UNIQUE',
      prompt: 'Énoncé',
      points: 5,
      guidance: 'Critère',
      options: [{ id: VERSION_ID, label: 'A', isCorrect: true }],
    });
    expect(parsed).not.toHaveProperty('points');
    expect(parsed).not.toHaveProperty('guidance');
    expect(parsed.options[0]).not.toHaveProperty('isCorrect');
  });

  it('refuse une note négative dans une correction', () => {
    const grade = (awardedPoints: number) =>
      saveCorrectionInputSchema.safeParse({
        correctionRevision: 1,
        grades: [{ questionId: VERSION_ID, awardedPoints }],
      }).success;
    expect(grade(3)).toBe(true);
    expect(grade(-1)).toBe(false);
  });
});

describe('Moteur de correction déterministe', () => {
  const choice = (type: 'CHOIX_UNIQUE' | 'VRAI_FAUX', correctId = 'a') => ({
    type,
    points: 2,
    scoringPolicy: 'TOUT_OU_RIEN' as const,
    options: [
      { id: 'a', isCorrect: correctId === 'a' },
      { id: 'b', isCorrect: correctId === 'b' },
    ],
  });
  const multiple = (scoringPolicy: 'TOUT_OU_RIEN' | 'CREDIT_PARTIEL') => ({
    type: 'CHOIX_MULTIPLE' as const,
    points: 4,
    scoringPolicy,
    options: [
      { id: 'a', isCorrect: true },
      { id: 'b', isCorrect: true },
      { id: 'c', isCorrect: false },
      { id: 'd', isCorrect: false },
    ],
  });

  it('choix unique et vrai/faux : tous les points ou aucun', () => {
    expect(gradeObjectiveAnswer(choice('CHOIX_UNIQUE'), ['a'])).toBe(2);
    expect(gradeObjectiveAnswer(choice('CHOIX_UNIQUE'), ['b'])).toBe(0);
    expect(gradeObjectiveAnswer(choice('CHOIX_UNIQUE'), ['a', 'b'])).toBe(0);
    expect(gradeObjectiveAnswer(choice('VRAI_FAUX', 'b'), ['b'])).toBe(2);
    expect(gradeObjectiveAnswer(choice('VRAI_FAUX'), [])).toBe(0);
  });

  it('choix multiples tout ou rien : ensemble exact exigé', () => {
    expect(gradeObjectiveAnswer(multiple('TOUT_OU_RIEN'), ['a', 'b'])).toBe(4);
    expect(gradeObjectiveAnswer(multiple('TOUT_OU_RIEN'), ['a'])).toBe(0);
    expect(gradeObjectiveAnswer(multiple('TOUT_OU_RIEN'), ['a', 'b', 'c'])).toBe(0);
  });

  it('choix multiples crédit partiel : bonnes − mauvaises, borné à zéro', () => {
    expect(gradeObjectiveAnswer(multiple('CREDIT_PARTIEL'), ['a', 'b'])).toBe(4);
    expect(gradeObjectiveAnswer(multiple('CREDIT_PARTIEL'), ['a'])).toBe(2);
    expect(gradeObjectiveAnswer(multiple('CREDIT_PARTIEL'), ['a', 'c'])).toBe(0);
    expect(gradeObjectiveAnswer(multiple('CREDIT_PARTIEL'), ['c', 'd'])).toBe(0);
    expect(gradeObjectiveAnswer(multiple('CREDIT_PARTIEL'), ['a', 'a', 'x'])).toBe(2);
  });

  it('ne corrige jamais une réponse libre', () => {
    expect(
      gradeObjectiveAnswer(
        { type: 'REPONSE_DEVELOPPEE', points: 5, scoringPolicy: 'TOUT_OU_RIEN', options: [] },
        [],
      ),
    ).toBeNull();
  });

  it('totalise et signale une correction incomplète', () => {
    expect(
      totalScore([
        { points: 2, awardedPoints: 2 },
        { points: 3, awardedPoints: null },
      ]),
    ).toEqual({ score: 2, maxScore: 5, complete: false });
    expect(
      totalScore([
        { points: 1.5, awardedPoints: 0.75 },
        { points: 0.5, awardedPoints: 0.5 },
      ]),
    ).toEqual({ score: 1.25, maxScore: 2, complete: true });
  });
});

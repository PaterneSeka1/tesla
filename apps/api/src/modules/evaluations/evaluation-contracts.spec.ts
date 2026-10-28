import {
  ATTEMPT_STATUSES,
  attemptCodeSchema,
  EVALUATION_MODES,
  formatAttemptCode,
  recordPaperResultInputSchema,
} from '@tesla/shared';
import { AttemptStatus, EvaluationMode } from '../../generated/prisma/enums.js';

describe('Contrats des évaluations', () => {
  it('les enums Prisma correspondent aux constantes de @tesla/shared', () => {
    expect(Object.values(EvaluationMode).sort()).toEqual([...EVALUATION_MODES].sort());
    expect(Object.values(AttemptStatus).sort()).toEqual([...ATTEMPT_STATUSES].sort());
  });

  it('formate le code de tentative NT-AAAA-NNNNNN', () => {
    expect(formatAttemptCode(2027, 125)).toBe('NT-2027-000125');
    expect(formatAttemptCode(2027, 999_999)).toBe('NT-2027-999999');
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

  it('refuse un score supérieur au barème', () => {
    const base = { completedAt: '2027-01-09T10:00:00.000Z', answers: { q1: 'Réponse' } };
    expect(
      recordPaperResultInputSchema.safeParse({ ...base, score: 12, maxScore: 20 }).success,
    ).toBe(true);
    expect(
      recordPaperResultInputSchema.safeParse({ ...base, score: 21, maxScore: 20 }).success,
    ).toBe(false);
  });
});

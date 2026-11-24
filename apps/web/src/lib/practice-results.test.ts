import { OPERATION_ERROR_CODES } from '@tesla/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './api/client';
import { OfflineQueuedError } from './offline/operations';

const sent = vi.hoisted(() => ({ calls: [] as unknown[], next: [] as (() => unknown)[] }));
vi.mock('./api/practice', () => ({
  sendPracticeResult: async (input: unknown) => {
    sent.calls.push(input);
    return sent.next.shift()!();
  },
}));
const stored = vi.hoisted(() => new Map<string, unknown>());
vi.mock('./game-session', () => ({
  loadGameSession: async (user: string, key: string) => stored.get(`${user}:${key}`) ?? null,
  saveGameSession: async (user: string, key: string, value: unknown) =>
    void stored.set(`${user}:${key}`, value),
}));

const { classifySaveError, flushPendingResults, submitPracticeResult } =
  await import('./practice-results');

const input = (attemptId: string) => ({
  attemptId,
  moduleSlug: 'module-fictif',
  activityKey: 'vf-fictif-1',
  answers: [true],
});
const ok =
  (status: 'counted' | 'stale' = 'counted') =>
  () => ({
    status,
    correct: 1,
    total: 1,
    mastered: true,
    nextReviewOn: '2026-11-25',
    xpAwarded: 0,
    newBadges: [],
  });
const fail = (error: unknown) => () => {
  throw error;
};

describe('envoi des résultats d’entraînement (D201)', () => {
  beforeEach(() => {
    sent.calls = [];
    sent.next = [];
    stored.clear();
  });

  it('nomme chaque issue', () => {
    expect(classifySaveError(new OfflineQueuedError('op', null))).toBe('queued');
    expect(classifySaveError(new ApiError(0, 'NETWORK', 'x'))).toBe('unsecured');
    expect(classifySaveError(new ApiError(503, 'X', 'x'))).toBe('retry');
    expect(classifySaveError(new ApiError(409, OPERATION_ERROR_CODES.inProgress, 'x'))).toBe(
      'retry',
    );
    expect(classifySaveError(new ApiError(409, 'PRACTICE_ATTEMPT_REUSED', 'x'))).toBe('conflict');
    expect(classifySaveError(new ApiError(404, 'PRACTICE_NOT_FOUND', 'x'))).toBe('failed');
  });

  it('contenu modifié : « stale », jamais présenté comme compté', async () => {
    sent.next.push(ok('stale'));
    expect((await submitPracticeResult('compte-a', input('t1'))).state).toBe('stale');
  });

  it('erreur temporaire : gardé puis renvoyé avec le même identifiant de tentative', async () => {
    sent.next.push(fail(new ApiError(0, 'NETWORK', 'x')));
    expect((await submitPracticeResult('compte-a', input('t1'))).state).toBe('unsecured');
    sent.next.push(ok());
    expect(await flushPendingResults('compte-a')).toBe(1);
    expect(sent.calls).toEqual([input('t1'), input('t1')]);
    // Plus rien en attente.
    expect(await flushPendingResults('compte-a')).toBe(0);
  });

  it('refus définitif : rien n’est renvoyé indéfiniment', async () => {
    sent.next.push(fail(new ApiError(404, 'PRACTICE_NOT_FOUND', 'x')));
    expect((await submitPracticeResult('compte-a', input('t2'))).state).toBe('failed');
    expect(await flushPendingResults('compte-a')).toBe(0);
  });
});

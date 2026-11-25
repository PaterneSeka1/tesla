import { OPERATION_ERROR_CODES } from '@tesla/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './api/client';
import { OfflineQueuedError } from './offline/operations';

const sent = vi.hoisted(() => ({
  calls: [] as unknown[],
  next: [] as (() => unknown)[],
  /** Enregistrements présents au moment de chaque envoi (enregistrement avant envoi). */
  storedAtSend: [] as number[],
}));
// Coffre simulé : ouvert pour un seul compte à la fois, écritures pouvant échouer.
const vault = vi.hoisted(() => ({
  owner: null as string | null,
  records: new Map<string, unknown>(),
  fail: false,
}));
vi.mock('./offline/vault', () => ({
  readRecord: async (id: string) =>
    vault.records.has(`${vault.owner}:${id}`)
      ? { value: structuredClone(vault.records.get(`${vault.owner}:${id}`)), revision: 1 }
      : null,
  writeRecord: async (id: string, value: unknown) => {
    if (vault.fail) throw new Error('QuotaExceededError');
    vault.records.set(`${vault.owner}:${id}`, structuredClone(value));
  },
  deleteRecord: async (id: string) => void vault.records.delete(`${vault.owner}:${id}`),
  recordIds: async (prefix: string) =>
    [...vault.records.keys()]
      .filter((key) => key.startsWith(`${vault.owner}:${prefix}`))
      .map((key) => key.slice(`${vault.owner}:`.length)),
}));
vi.mock('./game-session', () => ({ vaultOpenFor: async (user: string) => vault.owner === user }));
vi.mock('./api/practice', () => ({
  sendPracticeResult: async (input: unknown) => {
    sent.calls.push(input);
    sent.storedAtSend.push(vault.records.size + window.sessionStorage.length);
    await new Promise((resolve) => setTimeout(resolve, 1));
    return sent.next.shift()!();
  },
}));

const { classifySaveError, flushPendingResults, listPendingResults, submitPracticeResult } =
  await import('./practice-results');

function memoryStorage(failing = false) {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (failing) throw new Error('QuotaExceededError');
      map.set(key, value);
    },
    removeItem: (key: string) => void map.delete(key),
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  };
}

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

describe('résultats d’entraînement (D201, D204)', () => {
  beforeEach(() => {
    sent.calls = [];
    sent.next = [];
    sent.storedAtSend = [];
    vault.owner = null;
    vault.records.clear();
    vault.fail = false;
    vi.stubGlobal('window', {
      sessionStorage: memoryStorage(),
      dispatchEvent: () => true,
    });
    vi.stubGlobal('navigator', { onLine: true });
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

  it('enregistré avant l’envoi, retiré après confirmation', async () => {
    vault.owner = 'compte-a';
    sent.next.push(ok());
    expect((await submitPracticeResult('compte-a', input('t1'))).state).toBe('saved');
    expect(sent.storedAtSend).toEqual([1]);
    expect(await listPendingResults('compte-a')).toEqual([]);
  });

  it('contenu modifié : « stale », jamais présenté comme compté', async () => {
    sent.next.push(ok('stale'));
    expect((await submitPracticeResult('compte-a', input('t1'))).state).toBe('stale');
  });

  it('double clic : une seule requête pour la même tentative', async () => {
    sent.next.push(ok());
    const [a, b] = await Promise.all([
      submitPracticeResult('compte-a', input('t1')),
      submitPracticeResult('compte-a', input('t1')),
    ]);
    expect(a).toBe(b);
    expect(sent.calls).toHaveLength(1);
  });

  it('erreur temporaire : gardé puis renvoyé avec le même identifiant de tentative', async () => {
    sent.next.push(fail(new ApiError(0, 'NETWORK', 'x')));
    expect((await submitPracticeResult('compte-a', input('t1'))).state).toBe('unsecured');
    const [row] = await listPendingResults('compte-a');
    expect(row).toMatchObject({ ownerId: 'compte-a', tries: 1, lastError: 'x' });
    // Attente avant le prochain essai automatique ; un envoi manuel passe outre.
    expect(await flushPendingResults('compte-a')).toBe(0);
    sent.next.push(ok());
    expect(await flushPendingResults('compte-a', true)).toBe(1);
    expect(sent.calls).toEqual([input('t1'), input('t1')]);
    expect(await listPendingResults('compte-a')).toEqual([]);
  });

  it('aucune limite : 80 résultats en attente sont tous conservés, isolés par compte', async () => {
    vault.owner = 'compte-a';
    for (let index = 0; index < 80; index++) {
      sent.next.push(fail(new ApiError(503, 'X', 'x')));
      await submitPracticeResult('compte-a', input(`t${index}`));
    }
    expect(await listPendingResults('compte-a')).toHaveLength(80);
    vault.owner = 'compte-b';
    expect(await listPendingResults('compte-b')).toEqual([]);
  });

  it('hors ligne avec coffre : repris par la file de l’appareil, sans doublon', async () => {
    vault.owner = 'compte-a';
    sent.next.push(fail(new OfflineQueuedError('op', null)));
    expect((await submitPracticeResult('compte-a', input('t1'))).state).toBe('queued');
    expect(await listPendingResults('compte-a')).toEqual([]);
  });

  it('stockage impossible et envoi échoué : état explicite « unsaved »', async () => {
    vi.stubGlobal('window', { sessionStorage: memoryStorage(true), dispatchEvent: () => true });
    sent.next.push(fail(new ApiError(503, 'X', 'x')));
    expect((await submitPracticeResult('compte-a', input('t1'))).state).toBe('unsaved');
  });

  it('refus définitif : rien n’est renvoyé indéfiniment', async () => {
    sent.next.push(fail(new ApiError(404, 'PRACTICE_NOT_FOUND', 'x')));
    expect((await submitPracticeResult('compte-a', input('t2'))).state).toBe('failed');
    expect(await flushPendingResults('compte-a', true)).toBe(0);
  });
});

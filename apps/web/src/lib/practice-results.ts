'use client';

import {
  OPERATION_ERROR_CODES,
  type PracticeResult,
  type PracticeResultInput,
} from '@tesla/shared';
import { ApiError } from './api/client';
import { sendPracticeResult } from './api/practice';
import { vaultOpenFor } from './game-session';
import { OfflineQueuedError } from './offline/operations';
import { deleteRecord, readRecord, recordIds, writeRecord } from './offline/vault';

/**
 * Résultats d'entraînement (D201, D204) : jamais de perte silencieuse.
 * 1. La tentative terminée est **enregistrée avant l'envoi** (un enregistrement par tentative,
 *    coffre chiffré du compte, sinon onglet) : fermer l'application juste après ne la perd pas.
 * 2. Elle est envoyée avec son identifiant, créé une seule fois et conservé à chaque nouvel essai :
 *    le serveur ne la compte qu'une fois.
 * 3. Hors connexion avec le coffre ouvert, la file d'opérations de l'appareil (D110) prend le
 *    relais : l'enregistrement local est alors retiré, sans doublon entre les deux files.
 * Aucune limite de nombre, aucune expiration : seule une réponse du serveur (enregistré, périmé,
 * refus définitif) retire un résultat. Synchronisation globale : `PracticeSync`.
 */
export type SaveState =
  /** Aperçu de l'encadrement : rien n'est enregistré. */
  | 'preview'
  | 'saving'
  | 'saved'
  /** Dans la file chiffrée de l'appareil, envoyé à la reconnexion. */
  | 'queued'
  /** Activité modifiée depuis la partie : conservée sans être comptée. */
  | 'stale'
  /** Erreur temporaire (réseau, serveur) : gardé sur l'appareil, renvoyé automatiquement. */
  | 'retry'
  /** Hors connexion sans coffre sur l'appareil : gardé dans l'onglet seulement. */
  | 'unsecured'
  /** Stockage local impossible (plein, refusé) et envoi échoué : seul « Réessayer » le sauve. */
  | 'unsaved'
  /** Déjà reçu avec un autre contenu : rien à refaire. */
  | 'conflict'
  /** Refus définitif (activité ou module retiré, droits) : rien ne sera renvoyé. */
  | 'failed';

export const SAVE_MESSAGES: Partial<Record<SaveState, string>> = {
  queued: 'Enregistré sur cet appareil, envoyé à la prochaine connexion.',
  stale: 'Cette activité a été mise à jour depuis : résultat conservé, non compté.',
  retry: 'Pas encore envoyé : nouvel essai automatique.',
  unsecured: 'Hors connexion : résultat gardé dans cet onglet jusqu’au retour du réseau.',
  unsaved: 'Résultat non enregistré : espace de stockage indisponible.',
  conflict: 'Ce résultat a déjà été reçu.',
  failed: 'Ce résultat ne peut pas être enregistré.',
};

/** États pour lesquels un nouvel essai a du sens. */
export const RETRYABLE: readonly SaveState[] = ['retry', 'unsecured', 'unsaved'];

export type PracticeSubmission = PracticeResultInput & { attemptId: string };

export interface PendingResult {
  /** Compte propriétaire (contrôlé à chaque lecture). */
  ownerId: string;
  input: PracticeSubmission;
  createdAt: string;
  /** Nombre d'envois tentés. */
  tries: number;
  /** Prochain envoi automatique (attente croissante, plafonnée). */
  nextAt: number;
  lastError: string | null;
}

const VAULT_PREFIX = 'result:';
const TAB_PREFIX = 'tesla.result:';
const tabKey = (userId: string, attemptId: string) => `${TAB_PREFIX}${userId}:${attemptId}`;
/** Attente avant un nouvel essai automatique : 10 s, 20 s, 40 s… jusqu'à 15 min. */
export const retryDelay = (tries: number) =>
  Math.min(15 * 60_000, 10_000 * 2 ** Math.min(tries, 7));

export function classifySaveError(error: unknown): SaveState {
  if (error instanceof OfflineQueuedError) return 'queued';
  if (!(error instanceof ApiError)) return 'retry';
  if (error.status === 0) return 'unsecured';
  if (
    error.status >= 500 ||
    error.status === 429 ||
    error.status === 401 ||
    error.code === OPERATION_ERROR_CODES.inProgress
  )
    return 'retry';
  if (error.status === 409) return 'conflict';
  return 'failed';
}

function isPending(value: unknown, userId: string): value is PendingResult {
  const row = value as PendingResult | null;
  return (
    !!row &&
    row.ownerId === userId &&
    typeof row.input?.attemptId === 'string' &&
    typeof row.input.moduleSlug === 'string' &&
    Number.isInteger(row.tries)
  );
}

/** Où le résultat est gardé : coffre (durable), onglet, ou nulle part (stockage impossible). */
type Store = 'vault' | 'tab' | 'none';

async function store(row: PendingResult): Promise<Store> {
  if (await vaultOpenFor(row.ownerId)) {
    const id = `${VAULT_PREFIX}${row.input.attemptId}`;
    try {
      const existing = await readRecord<PendingResult>(id);
      await writeRecord(id, row, existing?.revision ?? 0);
      return 'vault';
    } catch {
      // Coffre plein ou verrouillé entre-temps : copie de l'onglet.
    }
  }
  try {
    window.sessionStorage.setItem(tabKey(row.ownerId, row.input.attemptId), JSON.stringify(row));
    return 'tab';
  } catch {
    return 'none';
  }
}

async function remove(userId: string, attemptId: string) {
  if (await vaultOpenFor(userId)) await deleteRecord(`${VAULT_PREFIX}${attemptId}`).catch(() => {});
  try {
    window.sessionStorage.removeItem(tabKey(userId, attemptId));
  } catch {
    // Stockage indisponible.
  }
}

/** Résultats en attente de ce compte (coffre et onglet, sans doublon), du plus ancien au plus récent. */
export async function listPendingResults(userId: string): Promise<PendingResult[]> {
  const rows = new Map<string, PendingResult>();
  try {
    const prefix = `${TAB_PREFIX}${userId}:`;
    for (let index = 0; index < window.sessionStorage.length; index++) {
      const key = window.sessionStorage.key(index);
      if (!key?.startsWith(prefix)) continue;
      const value = JSON.parse(window.sessionStorage.getItem(key) ?? 'null') as unknown;
      if (isPending(value, userId)) rows.set(value.input.attemptId, value);
    }
  } catch {
    // Stockage de l'onglet indisponible.
  }
  if (await vaultOpenFor(userId)) {
    for (const id of await recordIds(VAULT_PREFIX).catch(() => [] as string[])) {
      const row = await readRecord<PendingResult>(id).catch(() => null);
      if (isPending(row?.value, userId)) rows.set(row.value.input.attemptId, row.value);
    }
  }
  return [...rows.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Envois en cours (double clic, synchronisation simultanée) : une seule requête par tentative. */
const inflight = new Map<string, Promise<{ state: SaveState; result?: PracticeResult }>>();

/**
 * Enregistre puis envoie une tentative terminée. Le même `attemptId` doit accompagner chaque
 * nouvel essai : il est créé une fois, au début de la partie.
 */
export function submitPracticeResult(
  userId: string,
  input: PracticeSubmission,
  previous?: PendingResult,
): Promise<{ state: SaveState; result?: PracticeResult }> {
  const key = `${userId}:${input.attemptId}`;
  const running = inflight.get(key);
  if (running) return running;
  const task = send(userId, input, previous).finally(() => inflight.delete(key));
  inflight.set(key, task);
  return task;
}

async function send(
  userId: string,
  input: PracticeSubmission,
  previous?: PendingResult,
): Promise<{ state: SaveState; result?: PracticeResult }> {
  const row: PendingResult = previous ?? {
    ownerId: userId,
    input,
    createdAt: new Date().toISOString(),
    tries: 0,
    nextAt: 0,
    lastError: null,
  };
  // Enregistré avant l'envoi : une fermeture pendant la requête ne perd rien.
  await store(row);
  window.dispatchEvent(new Event('practice-result-pending'));
  try {
    const result = await sendPracticeResult(input);
    await remove(userId, input.attemptId);
    return { state: result.status === 'stale' ? 'stale' : 'saved', result };
  } catch (error) {
    const state = classifySaveError(error);
    if (state === 'queued' || !RETRYABLE.includes(state)) {
      // Repris par la file de l'appareil, ou réponse définitive du serveur.
      await remove(userId, input.attemptId);
      return { state };
    }
    const tries = row.tries + 1;
    const kept = await store({
      ...row,
      tries,
      nextAt: Date.now() + retryDelay(tries),
      lastError: error instanceof Error ? error.message : 'Envoi interrompu.',
    });
    if (kept === 'none') return { state: 'unsaved' };
    if (state === 'unsecured' && kept === 'vault') return { state: 'retry' };
    return { state };
  }
}

let flushing: Promise<number> | null = null;
/**
 * Renvoie les résultats en attente dus (ou tous si `manual`). Une seule synchronisation à la fois ;
 * s'arrête à la première erreur temporaire (réseau, serveur) pour ne pas multiplier les requêtes.
 */
export function flushPendingResults(userId: string, manual = false): Promise<number> {
  if (flushing) return flushing;
  flushing = (async () => {
    let settled = 0;
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return 0;
      for (const row of await listPendingResults(userId)) {
        if (!manual && row.nextAt > Date.now()) continue;
        const { state } = await submitPracticeResult(userId, row.input, row);
        if (RETRYABLE.includes(state)) break;
        settled++;
      }
    } finally {
      flushing = null;
    }
    return settled;
  })();
  return flushing;
}

/** Prochaine échéance d'un envoi automatique (ms), ou `null` si rien n'attend. */
export async function nextPendingAt(userId: string): Promise<number | null> {
  const rows = await listPendingResults(userId);
  return rows.length ? Math.min(...rows.map((row) => row.nextAt)) : null;
}

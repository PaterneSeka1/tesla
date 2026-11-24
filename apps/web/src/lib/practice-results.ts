'use client';

import {
  OPERATION_ERROR_CODES,
  type PracticeResult,
  type PracticeResultInput,
} from '@tesla/shared';
import { ApiError } from './api/client';
import { sendPracticeResult } from './api/practice';
import { loadGameSession, saveGameSession } from './game-session';
import { OfflineQueuedError } from './offline/operations';

/**
 * Envoi d'un résultat d'entraînement (D201) : jamais de perte silencieuse. Chaque issue est
 * nommée ; un résultat non parti est gardé (file chiffrée de l'appareil, sinon onglet) et renvoyé
 * avec le **même** identifiant de tentative : le serveur ne le compte qu'une fois.
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
  /** Erreur temporaire (réseau, serveur) : gardé dans l'onglet, nouvel essai possible. */
  | 'retry'
  /** Hors connexion sans coffre sur l'appareil : gardé dans l'onglet seulement. */
  | 'unsecured'
  /** Déjà reçu avec un autre contenu : rien à refaire. */
  | 'conflict'
  /** Refus définitif (activité ou module retiré, droits) : rien ne sera renvoyé. */
  | 'failed';

export const SAVE_MESSAGES: Partial<Record<SaveState, string>> = {
  queued: 'Enregistré sur cet appareil, envoyé à la prochaine connexion.',
  stale: 'Cette activité a changé depuis : résultat conservé, non compté.',
  retry: 'Enregistrement impossible pour l’instant.',
  unsecured: 'Hors connexion : résultat gardé dans cet onglet jusqu’au retour du réseau.',
  conflict: 'Ce résultat a déjà été reçu.',
  failed: 'Ce résultat ne peut pas être enregistré.',
};

/** États pour lesquels un nouvel essai a du sens. */
export const RETRYABLE: readonly SaveState[] = ['retry', 'unsecured'];

const PENDING_KEY = 'pending-results';
type Pending = PracticeResultInput[];

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

async function pending(userId: string): Promise<Pending> {
  return (await loadGameSession<Pending>(userId, PENDING_KEY))?.data ?? [];
}

async function setPending(userId: string, items: Pending) {
  await saveGameSession(userId, PENDING_KEY, {
    id: PENDING_KEY,
    savedAt: new Date().toISOString(),
    data: items.slice(-50),
  });
}

async function keep(userId: string, input: PracticeResultInput) {
  const items = (await pending(userId)).filter((item) => item.attemptId !== input.attemptId);
  await setPending(userId, [...items, input]);
}

async function drop(userId: string, attemptId: string | undefined) {
  const items = await pending(userId);
  const rest = items.filter((item) => item.attemptId !== attemptId);
  if (rest.length !== items.length) await setPending(userId, rest);
}

export async function submitPracticeResult(
  userId: string,
  input: PracticeResultInput,
): Promise<{ state: SaveState; result?: PracticeResult }> {
  try {
    const result = await sendPracticeResult(input);
    await drop(userId, input.attemptId);
    return { state: result.status === 'stale' ? 'stale' : 'saved', result };
  } catch (error) {
    const state = classifySaveError(error);
    if (RETRYABLE.includes(state)) await keep(userId, input);
    else await drop(userId, input.attemptId);
    return { state };
  }
}

let flushing = false;
/** Renvoie les résultats gardés dans l'onglet (retour du réseau, ouverture des défis). */
export async function flushPendingResults(userId: string): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  let sent = 0;
  try {
    for (const input of await pending(userId)) {
      const { state } = await submitPracticeResult(userId, input);
      if (RETRYABLE.includes(state)) break;
      sent++;
    }
  } finally {
    flushing = false;
  }
  return sent;
}

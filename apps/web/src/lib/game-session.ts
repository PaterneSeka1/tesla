'use client';

import { useEffect, useRef, useState } from 'react';
import { deleteRecord, ensureVaultRestored, ownerId, putRecord, readRecord } from './offline/vault';

/**
 * Sauvegarde commune des parties (D201) : partie en cours (identifiant, exercices choisis et leur
 * version, réponses, position, jokers, cartes trouvées) et résultats en attente d'envoi.
 * - Toujours isolée par compte : la clé contient l'identifiant du compte, une autre session ne
 *   reprend jamais la partie d'un autre.
 * - Coffre chiffré de l'appareil quand il est ouvert pour ce compte (reprise après fermeture
 *   complète, hors ligne compris).
 * - Sinon, stockage de l'onglet seulement (`sessionStorage`, effacé à sa fermeture) : jamais de
 *   progression personnelle dans le stockage durable partagé du navigateur.
 */
export const GAME_SESSION_MAX_DAYS = 14;
const TAB_PREFIX = 'tesla.game:';
const LEGACY_KEYS = ['tesla.games.position', 'tesla.games.ascension'];

export interface GameSession<T> {
  /** Identifiant de la partie (unique, créé sur l'appareil). */
  id: string;
  savedAt: string;
  data: T;
}

const recordId = (key: string) => `game:${key}`;
const tabKey = (userId: string, key: string) => `${TAB_PREFIX}${userId}:${key}`;

/** Anciennes sauvegardes partagées entre comptes (premier chantier) : supprimées. */
export function purgeLegacyGameStorage() {
  try {
    for (const key of LEGACY_KEYS) window.localStorage.removeItem(key);
  } catch {
    // Stockage indisponible : rien à purger.
  }
}

function fresh<T>(session: GameSession<T> | null | undefined, now = Date.now()) {
  if (!session || typeof session !== 'object' || typeof session.id !== 'string') return null;
  const age = now - new Date(session.savedAt).getTime();
  return Number.isFinite(age) && age <= GAME_SESSION_MAX_DAYS * 86_400_000 ? session : null;
}

async function vaultFor(userId: string) {
  await ensureVaultRestored().catch(() => {});
  return ownerId() === userId;
}

export async function loadGameSession<T>(
  userId: string,
  key: string,
): Promise<GameSession<T> | null> {
  if (await vaultFor(userId)) {
    const row = await readRecord<GameSession<T>>(recordId(key)).catch(() => null);
    return fresh(row?.value);
  }
  try {
    const raw = window.sessionStorage.getItem(tabKey(userId, key));
    return fresh(raw ? (JSON.parse(raw) as GameSession<T>) : null);
  } catch {
    return null;
  }
}

/** `true` si la partie survivra à la fermeture de l'application (coffre de l'appareil). */
export async function saveGameSession<T>(
  userId: string,
  key: string,
  session: GameSession<T>,
): Promise<boolean> {
  const value = { ...session, savedAt: new Date().toISOString() };
  if (await vaultFor(userId)) {
    if (await putRecord(recordId(key), value).catch(() => false)) return true;
  }
  try {
    window.sessionStorage.setItem(tabKey(userId, key), JSON.stringify(value));
  } catch {
    // Stockage indisponible : la partie ne reprendra pas après actualisation.
  }
  return false;
}

export async function clearGameSession(userId: string, key: string) {
  if (await vaultFor(userId)) await deleteRecord(recordId(key)).catch(() => {});
  try {
    window.sessionStorage.removeItem(tabKey(userId, key));
  } catch {
    // Stockage indisponible.
  }
}

/** Efface les parties de l'onglet d'un autre compte (changement de compte dans le même onglet). */
export function forgetOtherAccounts(userId: string) {
  try {
    const keep = `${TAB_PREFIX}${userId}:`;
    for (let index = window.sessionStorage.length - 1; index >= 0; index--) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(TAB_PREFIX) && !key.startsWith(keep))
        window.sessionStorage.removeItem(key);
    }
  } catch {
    // Stockage indisponible.
  }
}

/**
 * État de partie persistant. `undefined` pendant le chargement ; `create` fabrique une nouvelle
 * partie quand rien n'est à reprendre ou que la sauvegarde n'est plus valable (`valid`).
 */
export function useGameSession<T>(
  userId: string | null,
  key: string,
  create: () => T,
  valid: (data: T) => boolean = () => true,
) {
  const tag = `${userId ?? '-'}:${key}`;
  const [loaded, setLoaded] = useState<{ tag: string; session: GameSession<T> } | null>(null);
  const createRef = useRef(create);
  const validRef = useRef(valid);
  useEffect(() => {
    createRef.current = create;
    validRef.current = valid;
  });
  // Écritures en série : une sauvegarde tardive ne peut pas recréer une partie déjà effacée.
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = (write: () => Promise<unknown>) => {
    writes.current = writes.current.then(write, write);
  };

  useEffect(() => {
    let active = true;
    purgeLegacyGameStorage();
    if (userId) forgetOtherAccounts(userId);
    void (userId ? loadGameSession<T>(userId, key) : Promise.resolve(null)).then((saved) => {
      if (!active) return;
      setLoaded({
        tag,
        session:
          saved && validRef.current(saved.data)
            ? saved
            : {
                id: crypto.randomUUID(),
                savedAt: new Date().toISOString(),
                data: createRef.current(),
              },
      });
    });
    return () => {
      active = false;
    };
  }, [userId, key, tag]);

  // Changement de compte ou de partie : rien n'est affiché avant le chargement de la bonne sauvegarde.
  const session = loaded?.tag === tag ? loaded.session : undefined;
  const setSession = (next: (current: GameSession<T> | undefined) => GameSession<T> | undefined) =>
    setLoaded((current) => {
      const value = next(current?.tag === tag ? current.session : undefined);
      return value ? { tag, session: value } : current;
    });

  const update = (data: T) => {
    setSession((current) => {
      if (!current) return current;
      const next = { ...current, data };
      if (userId) enqueue(() => saveGameSession(userId, key, next));
      return next;
    });
  };
  /** Nouvelle partie (nouvel identifiant), l'ancienne sauvegarde est remplacée. */
  const restart = (data: T = createRef.current()) => {
    const next = { id: crypto.randomUUID(), savedAt: new Date().toISOString(), data };
    setSession(() => next);
    if (userId) enqueue(() => saveGameSession(userId, key, next));
  };
  /** Partie terminée : la sauvegarde est effacée (la prochaine ouverture en crée une nouvelle). */
  const finish = () => {
    if (userId) enqueue(() => clearGameSession(userId, key));
  };
  return { session, update, restart, finish };
}

const RECENT_KEY = 'recent-plays';
const RECENT_MAX = 40;

/** Activités jouées récemment par ce compte (variété des parties suivantes). */
export async function recentPlays(userId: string): Promise<Set<string>> {
  return new Set((await loadGameSession<string[]>(userId, RECENT_KEY))?.data ?? []);
}

export async function rememberPlays(userId: string, ids: readonly string[]) {
  const current = [...(await recentPlays(userId))].filter((id) => !ids.includes(id));
  await saveGameSession(userId, RECENT_KEY, {
    id: RECENT_KEY,
    savedAt: new Date().toISOString(),
    data: [...current, ...ids].slice(-RECENT_MAX),
  });
}

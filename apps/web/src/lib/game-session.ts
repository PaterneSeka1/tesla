'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteRecord, ensureVaultRestored, ownerId, putRecord, readRecord } from './offline/vault';

/**
 * Sauvegarde commune des parties (D201, D204) : partie en cours (identifiant, exercices choisis et
 * leur version, réponses, saisies, position, jokers, cartes trouvées).
 * - Toujours isolée par compte : la clé contient l'identifiant du compte, une autre session ne
 *   reprend jamais la partie d'un autre.
 * - Coffre chiffré de l'appareil quand il est ouvert pour ce compte (reprise après fermeture
 *   complète, hors ligne compris).
 * - Sinon, ou si l'écriture dans le coffre échoue, stockage de l'onglet (`sessionStorage`, effacé à
 *   sa fermeture) : jamais de progression personnelle dans le stockage durable partagé.
 * - Chaque écriture porte une révision croissante : au chargement, la copie valide la plus récente
 *   (coffre ou onglet) l'emporte, une copie plus ancienne n'écrase jamais une progression récente.
 *
 * Conservation (D204) : une partie non reprise est oubliée après `GAME_SESSION_MAX_DAYS` jours
 * (partie abandonnée) ; les résultats terminés ne passent jamais par ici (file des résultats,
 * `practice-results.ts`, sans expiration) ; préférences et téléchargements ont leur propre durée.
 */
export const GAME_SESSION_MAX_DAYS = 14;
/** Format de sauvegarde : une version inconnue (plus récente) est ignorée, jamais mal interprétée. */
export const GAME_SESSION_FORMAT = 2;
const TAB_PREFIX = 'tesla.game:';
const LEGACY_KEYS = ['tesla.games.position', 'tesla.games.ascension'];

export interface GameSession<T> {
  /** Identifiant de la partie (unique, créé sur l'appareil) : sert d'identifiant de tentative. */
  id: string;
  savedAt: string;
  /** Révision croissante de la sauvegarde (réconciliation coffre / onglet, plusieurs onglets). */
  rev?: number;
  /** Format de la sauvegarde (absent : premier format, repris tel quel). */
  v?: number;
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

/** Sauvegarde lisible, de format connu et pas trop ancienne ; sinon `null`. */
export function validSession<T>(
  session: unknown,
  now = Date.now(),
  maxDays = GAME_SESSION_MAX_DAYS,
): GameSession<T> | null {
  if (!session || typeof session !== 'object') return null;
  const value = session as GameSession<T>;
  if (typeof value.id !== 'string' || typeof value.savedAt !== 'string') return null;
  if (!('data' in value)) return null;
  if (value.v !== undefined && (typeof value.v !== 'number' || value.v > GAME_SESSION_FORMAT))
    return null;
  if (value.rev !== undefined && !Number.isInteger(value.rev)) return null;
  const age = now - new Date(value.savedAt).getTime();
  return Number.isFinite(age) && age <= maxDays * 86_400_000 ? value : null;
}

/** La plus récente de deux sauvegardes : révision d'abord, puis date d'enregistrement. */
export function newest<T>(
  a: GameSession<T> | null,
  b: GameSession<T> | null,
): GameSession<T> | null {
  if (!a || !b) return a ?? b;
  const ra = a.rev ?? 0;
  const rb = b.rev ?? 0;
  if (ra !== rb) return ra > rb ? a : b;
  return a.savedAt >= b.savedAt ? a : b;
}

/** Le coffre de l'appareil est ouvert pour ce compte. */
export async function vaultOpenFor(userId: string) {
  await ensureVaultRestored().catch(() => {});
  return ownerId() === userId;
}

function readTab<T>(userId: string, key: string): unknown {
  try {
    const raw = window.sessionStorage.getItem(tabKey(userId, key));
    return raw ? (JSON.parse(raw) as GameSession<T>) : null;
  } catch {
    return null;
  }
}

export async function loadGameSession<T>(
  userId: string,
  key: string,
  maxDays = GAME_SESSION_MAX_DAYS,
): Promise<GameSession<T> | null> {
  const now = Date.now();
  const tab = validSession<T>(readTab<T>(userId, key), now, maxDays);
  if (!(await vaultOpenFor(userId))) return tab;
  const row = await readRecord<GameSession<T>>(recordId(key)).catch(() => null);
  // Copie de secours de l'onglet (écriture du coffre échouée) : la plus récente l'emporte.
  return newest(validSession<T>(row?.value, now, maxDays), tab);
}

/** `true` si la partie survivra à la fermeture de l'application (coffre de l'appareil). */
export async function saveGameSession<T>(
  userId: string,
  key: string,
  session: GameSession<T>,
): Promise<boolean> {
  const value: GameSession<T> = {
    ...session,
    v: GAME_SESSION_FORMAT,
    rev: session.rev ?? 0,
    savedAt: new Date().toISOString(),
  };
  if (await vaultOpenFor(userId)) {
    if (await putRecord(recordId(key), value).catch(() => false)) {
      // Copie de secours désormais dépassée : retirée pour ne pas encombrer l'onglet.
      try {
        window.sessionStorage.removeItem(tabKey(userId, key));
      } catch {
        // Stockage indisponible.
      }
      return true;
    }
  }
  try {
    window.sessionStorage.setItem(tabKey(userId, key), JSON.stringify(value));
  } catch {
    // Stockage indisponible ou plein : la partie ne reprendra pas après actualisation.
  }
  return false;
}

export async function clearGameSession(userId: string, key: string) {
  if (await vaultOpenFor(userId)) await deleteRecord(recordId(key)).catch(() => {});
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
 * Les écritures sont faites hors des fonctions de mise à jour de React (Strict Mode) et en série :
 * une sauvegarde tardive ne peut pas recréer une partie déjà effacée.
 * `durable` : `true` si la dernière écriture a atteint le coffre (reprise après fermeture).
 */
export function useGameSession<T>(
  userId: string | null,
  key: string,
  create: () => T,
  valid: (data: T) => boolean = () => true,
) {
  const tag = `${userId ?? '-'}:${key}`;
  const [loaded, setLoaded] = useState<{ tag: string; session: GameSession<T> } | null>(null);
  const [durable, setDurable] = useState<boolean | null>(null);
  const current = useRef<{ tag: string; session: GameSession<T> } | null>(null);
  const createRef = useRef(create);
  const validRef = useRef(valid);
  useEffect(() => {
    createRef.current = create;
    validRef.current = valid;
  });
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = useCallback((write: () => Promise<unknown>) => {
    writes.current = writes.current.then(write, write);
  }, []);

  useEffect(() => {
    let active = true;
    purgeLegacyGameStorage();
    if (userId) forgetOtherAccounts(userId);
    void (userId ? loadGameSession<T>(userId, key) : Promise.resolve(null)).then((saved) => {
      if (!active) return;
      const next = {
        tag,
        session:
          saved && validRef.current(saved.data)
            ? saved
            : {
                id: crypto.randomUUID(),
                savedAt: new Date().toISOString(),
                rev: saved?.rev ?? 0,
                data: createRef.current(),
              },
      };
      current.current = next;
      setLoaded(next);
    });
    return () => {
      active = false;
    };
  }, [userId, key, tag]);

  // Changement de compte ou de partie : rien n'est affiché avant le chargement de la bonne sauvegarde.
  const session = loaded?.tag === tag ? loaded.session : undefined;

  const commit = useCallback(
    (next: GameSession<T>) => {
      current.current = { tag, session: next };
      setLoaded(current.current);
      if (userId)
        enqueue(async () => {
          const ok = await saveGameSession(userId, key, next);
          setDurable(ok);
        });
    },
    [tag, userId, key, enqueue],
  );

  const update = useCallback(
    (data: T) => {
      const base = current.current?.tag === tag ? current.current.session : undefined;
      if (!base) return;
      commit({ ...base, rev: (base.rev ?? 0) + 1, data });
    },
    [tag, commit],
  );
  /** Nouvelle partie (nouvel identifiant), l'ancienne sauvegarde est remplacée. */
  const restart = useCallback(
    (data: T = createRef.current()) => {
      const base = current.current?.tag === tag ? current.current.session : undefined;
      commit({
        id: crypto.randomUUID(),
        savedAt: new Date().toISOString(),
        rev: (base?.rev ?? 0) + 1,
        data,
      });
    },
    [tag, commit],
  );
  /** Partie terminée : la sauvegarde est effacée (la prochaine ouverture en crée une nouvelle). */
  const finish = useCallback(() => {
    if (userId) enqueue(() => clearGameSession(userId, key));
  }, [userId, key, enqueue]);
  return { session, update, restart, finish, durable };
}

const RECENT_KEY = 'recent-plays';
const RECENT_MAX = 40;
/** Variété des parties : souvenir des activités jouées, sans valeur pédagogique (60 jours). */
const RECENT_MAX_DAYS = 60;

/** Activités jouées récemment par ce compte (variété des parties suivantes). */
export async function recentPlays(userId: string): Promise<Set<string>> {
  return new Set(
    (await loadGameSession<string[]>(userId, RECENT_KEY, RECENT_MAX_DAYS))?.data ?? [],
  );
}

export async function rememberPlays(userId: string, ids: readonly string[]) {
  const current = [...(await recentPlays(userId))].filter((id) => !ids.includes(id));
  await saveGameSession(userId, RECENT_KEY, {
    id: RECENT_KEY,
    savedAt: new Date().toISOString(),
    rev: Date.now(),
    data: [...current, ...ids].slice(-RECENT_MAX),
  });
}

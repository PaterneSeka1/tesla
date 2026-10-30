import {
  effectivePermissions,
  meResponseSchema,
  OFFLINE_ACCESS_MAX_DAYS,
  type SessionUser,
} from '@tesla/shared';
import { apiFetch } from '@/lib/api/client';
import { dbDelete, dbKeys, dbRead, dbWrite } from './db';

// Coffre local chiffré (D79, étendu par D111) : un coffre par compte sur l'appareil, données
// enregistrées sous `<ownerId>:<id>`. L'en-tête historique `vault` (v2, un seul compte routier)
// reste lu tel quel : aucune donnée n'est déplacée ni réécrite.

type Cipher = { iv: number[]; bytes: number[] };
interface Header {
  id: string;
  revision: number;
  salt: number[];
  check: Cipher;
}
interface RecordRow {
  id: string;
  revision: number;
  cipher: Cipher;
}
/**
 * Déverrouillage conservé entre deux chargements de page (navigation hors connexion, réouverture).
 * La clé AES est non exportable : le navigateur peut s'en servir, personne ne peut la lire.
 */
interface UnlockedSession {
  id: 'session';
  ownerId: string;
  key: CryptoKey;
  expiresAt: number;
}
/** Identité vérifiée par le serveur, conservée chiffrée pour l'usage hors connexion. */
export interface LocalIdentity {
  user: SessionUser;
  verifiedAt: string;
}

/** Durée maximale d'un déverrouillage sans nouvelle saisie de la phrase (D111). */
export const UNLOCK_TTL_MS = 12 * 3_600_000;
const LEGACY_HEADER = 'vault';
const headerId = (owner: string) => `vault:${owner}`;

let unlocked: { ownerId: string; key: CryptoKey } | null = null;
let generation = 0;
let restoring: Promise<void> | null = null;
const channel =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('tesla-offline-lock') : null;
channel?.addEventListener('message', (event: MessageEvent) => {
  if (event.data === 'lock') forget();
  // Déverrouillage dans un autre onglet : reprise de la session enregistrée.
  if (event.data === 'unlock') {
    restoring = null;
    void ensureVaultRestored();
  }
});
export const ownerId = () => unlocked?.ownerId ?? null;
function notify() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('offline-vault-change'));
}
function forget() {
  unlocked = null;
  generation++;
  notify();
}
export function lockVault(broadcast = true) {
  forget();
  restoring = Promise.resolve();
  void dbDelete('settings', 'session').catch(() => {});
  if (broadcast) channel?.postMessage('lock');
}
/**
 * Reprend un déverrouillage encore valide (même onglet après rechargement, autre onglet).
 * Toujours résolue : une erreur laisse simplement le coffre verrouillé.
 */
export function ensureVaultRestored(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  restoring ??= (async () => {
    try {
      const session = await dbRead<UnlockedSession | undefined>('settings', 'session');
      if (!session || session.expiresAt <= Date.now()) {
        if (session) await dbDelete('settings', 'session');
        return;
      }
      if (unlocked?.ownerId !== session.ownerId) {
        unlocked = { ownerId: session.ownerId, key: session.key };
        generation++;
        notify();
      }
    } catch {
      /* Stockage indisponible : coffre verrouillé. */
    }
  })();
  return restoring;
}
async function derive(phrase: string, salt: number[]) {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(phrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new Uint8Array(salt), iterations: 600_000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}
async function encrypt(key: CryptoKey, value: unknown, id: string): Promise<Cipher> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(id) },
    key,
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return { iv: [...iv], bytes: [...new Uint8Array(bytes)] };
}
async function decrypt<T>(key: CryptoKey, cipher: Cipher, id: string): Promise<T> {
  const bytes = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(cipher.iv),
      additionalData: new TextEncoder().encode(id),
    },
    key,
    new Uint8Array(cipher.bytes),
  );
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}
async function headers(): Promise<Header[]> {
  const ids = [...(await dbKeys('settings', 'vault'))];
  return (await Promise.all(ids.map((id) => dbRead<Header | undefined>('settings', id)))).flatMap(
    (h) => (h ? [h] : []),
  );
}
/** Au moins un coffre existe sur l'appareil (sans révéler à quel compte il appartient). */
export async function vaultExists() {
  return (await dbKeys('settings', 'vault')).length > 0;
}
/** Coffre du compte : en-tête dédié, sinon en-tête historique s'il lui appartient (vérifié à l'ouverture). */
async function vaultFor(userId: string): Promise<Header | undefined> {
  return (
    (await dbRead<Header | undefined>('settings', headerId(userId))) ??
    (await dbRead<Header | undefined>('settings', LEGACY_HEADER))
  );
}
/** Données déjà chiffrées pour ce compte (y compris sous l'en-tête historique). */
async function hasRecordsFor(userId: string) {
  return (await dbKeys('records', `${userId}:`)).length > 0;
}
export async function hasVaultFor(userId: string) {
  return (
    !!(await dbRead<Header | undefined>('settings', headerId(userId))) ||
    (!!(await dbRead<Header | undefined>('settings', LEGACY_HEADER)) &&
      (await hasRecordsFor(userId)))
  );
}
async function open(header: Header, phrase: string) {
  const key = await derive(phrase, header.salt);
  try {
    return {
      key,
      owner: (await decrypt<{ ownerId: string }>(key, header.check, header.id)).ownerId,
    };
  } catch {
    return null;
  }
}
/**
 * Déverrouille (ou crée) le coffre.
 * - En ligne, `user` est le compte vérifié par le serveur : son coffre est ouvert ou créé.
 * - Hors connexion, sans `user` : la phrase est essayée sur les coffres présents ; aucune
 *   liste de comptes n'est affichée (pas de fuite d'identité sur un appareil partagé).
 */
export async function unlockVault(phrase: string, user?: SessionUser) {
  if (!crypto.subtle) throw new Error('Le stockage chiffré nécessite HTTPS ou localhost.');
  let opened: { key: CryptoKey; owner: string } | null = null;
  if (user) {
    const header = await vaultFor(user.id);
    const candidate = header ? await open(header, phrase) : null;
    if (candidate?.owner === user.id) opened = candidate;
    else if (header?.id === headerId(user.id) || candidate || (await hasRecordsFor(user.id)))
      // Jamais de nouveau coffre par-dessus des données existantes du compte : elles
      // deviendraient illisibles.
      throw new Error('Phrase de déverrouillage incorrecte.');
    else {
      if (phrase.length < 12)
        throw new Error(
          'Choisissez une phrase locale d’au moins 12 caractères, distincte de votre mot de passe.',
        );
      const salt = [...crypto.getRandomValues(new Uint8Array(16))];
      const key = await derive(phrase, salt);
      const id = headerId(user.id);
      await dbWrite(
        'settings',
        { id, revision: 1, salt, check: await encrypt(key, { ownerId: user.id }, id) } as Header,
        0,
      );
      opened = { key, owner: user.id };
    }
  } else {
    for (const header of await headers()) {
      opened = await open(header, phrase);
      if (opened) break;
    }
    if (!opened) throw new Error('Phrase de déverrouillage incorrecte.');
  }
  unlocked = { ownerId: opened.owner, key: opened.key };
  generation++;
  restoring = Promise.resolve();
  await dbWrite('settings', {
    id: 'session',
    ownerId: opened.owner,
    key: opened.key,
    expiresAt: Date.now() + UNLOCK_TTL_MS,
  } as UnlockedSession & { revision?: number });
  if (user) await rememberIdentity(user);
  channel?.postMessage('unlock');
  notify();
}
export async function readRecord<T>(id: string): Promise<{ value: T; revision: number } | null> {
  const current = unlocked;
  if (!current) throw new Error('Déverrouillez vos données hors ligne.');
  const row = await dbRead<RecordRow | undefined>('records', `${current.ownerId}:${id}`);
  if (!row) return null;
  const value = await decrypt<T>(current.key, row.cipher, row.id);
  if (unlocked !== current) throw new Error('Données verrouillées.');
  return { value, revision: row.revision };
}
export async function writeRecord(id: string, value: unknown, revision: number) {
  const current = unlocked;
  const started = generation;
  if (!current) throw new Error('Données verrouillées.');
  const key = `${current.ownerId}:${id}`;
  const cipher = await encrypt(current.key, value, key);
  if (generation !== started) throw new Error('Données verrouillées.');
  await dbWrite('records', { id: key, cipher, revision: revision + 1 } as RecordRow, revision);
  window.dispatchEvent(new Event('offline-data-change'));
}
/**
 * Écriture sans contrôle de révision (copies de lecture, remplacées à chaque rafraîchissement).
 * `false` : coffre verrouillé entre-temps, rien n'est écrit. Une erreur de stockage est propagée.
 */
export async function putRecord(id: string, value: unknown): Promise<boolean> {
  const current = unlocked;
  const started = generation;
  if (!current) return false;
  const key = `${current.ownerId}:${id}`;
  const cipher = await encrypt(current.key, value, key);
  if (generation !== started) return false;
  await dbWrite('records', { id: key, cipher, revision: 1 } as RecordRow);
  return true;
}
export async function deleteRecord(id: string) {
  const owner = ownerId();
  if (!owner) throw new Error('Données verrouillées.');
  await dbDelete('records', `${owner}:${id}`);
  window.dispatchEvent(new Event('offline-data-change'));
}
export async function recordIds(prefix: string) {
  const current = unlocked;
  if (!current) return [];
  const keys = await dbKeys('records', `${current.ownerId}:${prefix}`);
  return keys.map((k) => k.slice(current.ownerId.length + 1));
}
async function rememberIdentity(user: SessionUser) {
  if (ownerId() !== user.id) return;
  await putRecord('identity', {
    user,
    verifiedAt: new Date().toISOString(),
  } satisfies LocalIdentity);
}
/**
 * Identité locale utilisable hors connexion : vérifiée par le serveur depuis moins de
 * `OFFLINE_ACCESS_MAX_DAYS` jours. Une fois le mandat ou la délégation échus (date connue au
 * dernier contrôle), seules les permissions du rôle sans mandat sont conservées (D112).
 */
export async function localIdentity(now = new Date()): Promise<SessionUser | null> {
  await ensureVaultRestored();
  if (!ownerId()) return null;
  const row = await readRecord<LocalIdentity>('identity').catch(() => null);
  if (!row) return null;
  return identityAt(row.value, now);
}
export function identityAt({ user, verifiedAt }: LocalIdentity, now: Date): SessionUser | null {
  const age = now.getTime() - new Date(verifiedAt).getTime();
  if (age < 0 || age > OFFLINE_ACCESS_MAX_DAYS * 86_400_000) return null;
  const today = now.toISOString().slice(0, 10);
  if (user.authorityValidUntil && user.authorityValidUntil < today)
    return {
      ...user,
      leaderFunction: null,
      authorityValidUntil: null,
      permissions: effectivePermissions({ role: user.role, leaderFunction: null, delegated: [] }),
    };
  return user;
}
/** Le compte connecté au serveur doit être le propriétaire du coffre ouvert. */
export async function assertOnlineOwner() {
  const { user } = await apiFetch('/auth/me', meResponseSchema);
  if (user.id !== ownerId()) {
    lockVault();
    throw new Error('Reconnectez-vous avec le compte propriétaire de ces données.');
  }
  await rememberIdentity(user);
  return user;
}
/** Session serveur confirmée : rafraîchit l'identité locale ou verrouille le coffre d'un autre compte. */
export async function confirmServerUser(user: SessionUser) {
  await ensureVaultRestored();
  const owner = ownerId();
  if (!owner) return;
  if (owner !== user.id) lockVault();
  else await rememberIdentity(user);
}

import { meResponseSchema } from '@tesla/shared';
import { apiFetch } from '@/lib/api/client';
import { dbRead, dbWrite } from './db';

type Cipher = { iv: number[]; bytes: number[] };
interface Header {
  id: 'vault';
  revision: number;
  salt: number[];
  check: Cipher;
}
interface RecordRow {
  id: string;
  revision: number;
  cipher: Cipher;
}
let unlocked: { ownerId: string; key: CryptoKey } | null = null;
let generation = 0;
const channel =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('tesla-offline-lock') : null;
channel?.addEventListener('message', () => lockVault(false));
export const ownerId = () => unlocked?.ownerId ?? null;
export function lockVault(broadcast = true) {
  unlocked = null;
  generation++;
  if (broadcast) channel?.postMessage('lock');
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('offline-vault-change'));
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
export async function vaultExists() {
  return !!(await dbRead<Header | undefined>('settings', 'vault'));
}
export async function unlockVault(phrase: string) {
  if (!crypto.subtle) throw new Error('Le stockage chiffré nécessite HTTPS ou localhost.');
  const header = await dbRead<Header | undefined>('settings', 'vault');
  let key: CryptoKey;
  let userId: string;
  if (!header) {
    if (phrase.length < 12)
      throw new Error(
        'Choisissez une phrase locale d’au moins 12 caractères, distincte de votre mot de passe.',
      );
    const { user } = await apiFetch('/auth/me', meResponseSchema);
    if (user.role !== 'ROUTIER')
      throw new Error('Le mode pédagogique hors ligne est réservé aux routiers.');
    userId = user.id;
    const salt = [...crypto.getRandomValues(new Uint8Array(16))];
    key = await derive(phrase, salt);
    await dbWrite(
      'settings',
      {
        id: 'vault',
        revision: 1,
        salt,
        check: await encrypt(key, { ownerId: userId }, 'vault'),
      } as Header,
      0,
    );
  } else {
    key = await derive(phrase, header.salt);
    try {
      userId = (await decrypt<{ ownerId: string }>(key, header.check, 'vault')).ownerId;
    } catch {
      throw new Error('Phrase de déverrouillage incorrecte.');
    }
  }
  unlocked = { ownerId: userId, key };
  generation++;
  window.dispatchEvent(new Event('offline-vault-change'));
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
export async function recordIds(prefix: string) {
  const current = unlocked;
  if (!current) return [];
  const rows = await dbRead<RecordRow[]>('records');
  const keyPrefix = `${current.ownerId}:${prefix}`;
  return rows
    .filter((r) => r.id.startsWith(keyPrefix))
    .map((r) => r.id.slice(current.ownerId.length + 1));
}
export async function assertOnlineOwner() {
  const { user } = await apiFetch('/auth/me', meResponseSchema);
  if (user.id !== ownerId() || user.role !== 'ROUTIER') {
    lockVault();
    throw new Error('Reconnectez-vous avec le compte propriétaire de ces données.');
  }
  return user;
}

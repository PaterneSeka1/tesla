import {
  meResponseSchema,
  OFFLINE_ACCESS_MAX_DAYS,
  type OfflineDeviceKey,
  offlineDeviceKeySchema,
  type SessionUser,
} from '@tesla/shared';
import { z } from 'zod';
import { ApiError, apiFetch, apiSend } from '@/lib/api/client';
import { dbDelete, dbKeys, dbRead, dbWrite } from './db';
import {
  type Cipher,
  decryptJson,
  deriveLegacyKey,
  derivePasswordKey,
  deviceAad,
  encryptJson,
  generateDataKey,
  importDeviceKey,
  PBKDF2_ITERATIONS,
  passwordAad,
  randomSalt,
  unwrapDataKey,
  wrapDataKey,
} from './vault-crypto';

/*
 * Coffre local chiffré — un coffre par compte sur l'appareil (D79, D111), protégé depuis la refonte
 * (D180) par le **mot de passe du compte** : aucun second secret à retenir.
 *
 * Format 3 (`vault:<userId>`, `format: 3`) : une clé de données aléatoire (DEK) chiffre les
 * enregistrements `<userId>:<id>` ; elle est encapsulée (1) par une clé dérivée du mot de passe
 * (hors connexion) et (2) par la clé de cet appareil, que le serveur ne remet qu'à une session valide
 * (ouverture automatique en ligne, reprotection après un changement ou une réinitialisation du mot
 * de passe). Les coffres antérieurs (phrase locale, en-tête sans `format`) restent lisibles avec leur
 * phrase et sont convertis une fois ; aucune donnée n'est réécrite sans cette conversion.
 */

interface LegacyHeader {
  id: string;
  revision: number;
  salt: number[];
  check: Cipher;
  format?: undefined;
}
interface HeaderV3 {
  id: string;
  revision: number;
  format: 3;
  ownerId: string;
  salt: number[];
  iterations: number;
  /** DEK encapsulée par le mot de passe ; null après retrait de l'appareil. */
  password: Cipher | null;
  /** DEK encapsulée par la clé de l'appareil ; null après retrait. */
  device: { id: string; wrapped: Cipher } | null;
  /** `{ ownerId }` chiffré par la DEK (contrôle d'appartenance). */
  check: Cipher;
  /** Appareil retiré du compte : protections détruites, données illisibles (effacement proposé). */
  revokedAt?: string;
}
type Header = LegacyHeader | HeaderV3;
interface RecordRow {
  id: string;
  revision: number;
  cipher: Cipher;
}
/**
 * Déverrouillage conservé entre deux chargements de page (navigation hors connexion, réouverture).
 * La clé est non exportable : le navigateur peut s'en servir, aucun script ne peut la lire.
 */
interface UnlockedSession {
  id: 'session';
  ownerId: string;
  key: CryptoKey;
  expiresAt: number;
  /** Dernière activité : au-delà de `IDLE_LOCK_MS` sans activité, le coffre se verrouille. */
  lastActivity?: number;
}
/** Identité vérifiée par le serveur, conservée chiffrée pour l'usage hors connexion. */
export interface LocalIdentity {
  user: SessionUser;
  verifiedAt: string;
}

/** Durée maximale d'un déverrouillage sans nouvelle saisie du mot de passe (D111). */
export const UNLOCK_TTL_MS = 12 * 3_600_000;
/** Verrouillage après inactivité (D180) ; en ligne, la réouverture est automatique. */
export const IDLE_LOCK_MS = 2 * 3_600_000;
const ACTIVITY_WRITE_MS = 60_000;
const LEGACY_HEADER = 'vault';
const headerId = (owner: string) => `vault:${owner}`;
const isV3 = (header: Header | undefined): header is HeaderV3 => header?.format === 3;
/** Itérations PBKDF2 des nouveaux coffres (abaissées uniquement par les tests unitaires). */
let iterations = PBKDF2_ITERATIONS;
export function setVaultIterationsForTests(value: number) {
  iterations = value;
}

/**
 * Témoin hors IndexedDB qu'un coffre a existé pour ce compte : s'il subsiste alors que le coffre a
 * disparu, le navigateur a effacé les données locales (AUD-023). Détection au mieux : un effacement
 * complet des données du site emporte aussi ce témoin.
 */
const presenceKey = (owner: string) => `tesla-offline-vault:${owner}`;
function markPresence(owner: string, present: boolean) {
  try {
    if (present) localStorage.setItem(presenceKey(owner), '1');
    else localStorage.removeItem(presenceKey(owner));
  } catch {
    /* Stockage indisponible (navigation privée) : pas de détection. */
  }
}
function hadVault(owner: string) {
  try {
    return localStorage.getItem(presenceKey(owner)) === '1';
  } catch {
    return false;
  }
}

let unlocked: { ownerId: string; key: CryptoKey } | null = null;
let generation = 0;
let restoring: Promise<void> | null = null;
let lastActivityWrite = 0;
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
/**
 * Verrouillage demandé par la personne (« Verrouiller ») : il tient jusqu'à la prochaine saisie du
 * mot de passe (connexion ou déverrouillage), sans réouverture automatique par la clé d'appareil.
 */
const MANUAL_LOCK = 'tesla-offline-manual-lock';
function setManualLock(owner: string | null) {
  try {
    if (owner) localStorage.setItem(MANUAL_LOCK, owner);
    else localStorage.removeItem(MANUAL_LOCK);
  } catch {
    /* Stockage indisponible : pas de mémoire du verrouillage manuel. */
  }
}
function manuallyLocked(owner: string) {
  try {
    return localStorage.getItem(MANUAL_LOCK) === owner;
  } catch {
    return false;
  }
}
export function lockVault(broadcast = true, manual = false) {
  if (manual && unlocked) setManualLock(unlocked.ownerId);
  forget();
  restoring = Promise.resolve();
  void dbDelete('settings', 'session').catch(() => {});
  if (broadcast) channel?.postMessage('lock');
}

/**
 * Reprend un déverrouillage encore valide (même onglet après rechargement, autre onglet), sauf
 * expiration ou inactivité prolongée. Toujours résolue : une erreur laisse le coffre verrouillé.
 */
export function ensureVaultRestored(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  restoring ??= (async () => {
    try {
      const session = await dbRead<UnlockedSession | undefined>('settings', 'session');
      const now = Date.now();
      const idle = session?.lastActivity !== undefined && now - session.lastActivity > IDLE_LOCK_MS;
      if (!session || session.expiresAt <= now || idle) {
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

/** Activité de la personne (clavier, toucher) : repousse le verrouillage pour inactivité. */
export async function recordVaultActivity(now = Date.now()) {
  if (!unlocked || now - lastActivityWrite < ACTIVITY_WRITE_MS) return;
  lastActivityWrite = now;
  const session = await dbRead<UnlockedSession | undefined>('settings', 'session').catch(
    () => undefined,
  );
  if (!session || session.ownerId !== unlocked.ownerId) return;
  if (now - (session.lastActivity ?? now) > IDLE_LOCK_MS) {
    lockVault();
    return;
  }
  await dbWrite('settings', { ...session, lastActivity: now } as UnlockedSession & {
    revision?: number;
  }).catch(() => {});
}

async function allHeaders(): Promise<Header[]> {
  const ids = [...(await dbKeys('settings', 'vault'))];
  return (await Promise.all(ids.map((id) => dbRead<Header | undefined>('settings', id)))).flatMap(
    (h) => (h ? [h] : []),
  );
}
/** Au moins un coffre existe sur l'appareil (sans révéler à quel compte il appartient). */
export async function vaultExists() {
  return (await dbKeys('settings', 'vault')).length > 0;
}
/** Un coffre antérieur (phrase locale) existe encore sur l'appareil. */
export async function legacyVaultExists() {
  return (await allHeaders()).some((header) => !isV3(header));
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

/** Situation du coffre de ce compte sur l'appareil (page « Cet appareil »). */
export type VaultState = 'none' | 'ready' | 'legacy' | 'revoked';
export async function vaultStateFor(userId: string): Promise<VaultState> {
  if (!(await hasVaultFor(userId))) return 'none';
  const header = await vaultFor(userId);
  if (!isV3(header)) return 'legacy';
  return header.revokedAt || (!header.password && !header.device) ? 'revoked' : 'ready';
}

async function startSession(owner: string, key: CryptoKey, user?: SessionUser) {
  setManualLock(null);
  unlocked = { ownerId: owner, key };
  generation++;
  restoring = Promise.resolve();
  const now = Date.now();
  lastActivityWrite = now;
  await dbWrite('settings', {
    id: 'session',
    ownerId: owner,
    key,
    expiresAt: now + UNLOCK_TTL_MS,
    lastActivity: now,
  } as UnlockedSession & { revision?: number });
  if (user) await rememberIdentity(user);
  markPresence(owner, true);
  channel?.postMessage('unlock');
  notify();
}

async function checkOwner(header: HeaderV3, key: CryptoKey) {
  try {
    return (await decryptJson<{ ownerId: string }>(key, header.check, header.id)).ownerId;
  } catch {
    return null;
  }
}

async function openLegacy(header: LegacyHeader, phrase: string) {
  const key = await deriveLegacyKey(phrase, header.salt);
  try {
    return {
      key,
      owner: (await decryptJson<{ ownerId: string }>(key, header.check, header.id)).ownerId,
    };
  } catch {
    return null;
  }
}

async function openV3WithPassword(header: HeaderV3, password: string, extractable = false) {
  if (!header.password || header.revokedAt) return null;
  const kek = await derivePasswordKey(password, header.salt, header.iterations);
  const key = await unwrapDataKey(header.password, kek, passwordAad(header.id), extractable);
  if (!key) return null;
  const owner = await checkOwner(header, key);
  return owner === header.ownerId ? { key, owner } : null;
}

/** Erreurs de déverrouillage présentées telles quelles à la personne. */
export class VaultError extends Error {
  constructor(
    readonly code: 'WRONG_PASSWORD' | 'REVOKED' | 'UNRECOVERABLE' | 'UNSUPPORTED' | 'EXISTS',
    message: string,
  ) {
    super(message);
    this.name = 'VaultError';
  }
}
const assertCrypto = () => {
  if (!globalThis.crypto?.subtle)
    throw new VaultError('UNSUPPORTED', 'Le stockage chiffré nécessite HTTPS ou localhost.');
};

/**
 * Hors connexion : le mot de passe habituel est essayé sur les coffres présents (aucune liste de
 * comptes affichée). Un coffre antérieur s'ouvre encore avec son ancienne phrase locale.
 * Déverrouillage **local** : aucune vérification auprès du serveur n'a lieu.
 */
export async function unlockOffline(secret: string) {
  assertCrypto();
  for (const header of await allHeaders()) {
    const opened = isV3(header)
      ? await openV3WithPassword(header, secret)
      : await openLegacy(header, secret);
    if (opened) {
      await startSession(opened.owner, opened.key);
      return opened.owner;
    }
  }
  throw new VaultError('WRONG_PASSWORD', 'Mot de passe incorrect.');
}

async function writeHeader(header: HeaderV3, expectedRevision: number) {
  await dbWrite('settings', header, expectedRevision);
}

/** Clé de l'appareil demandée au serveur (session valide exigée). `410` : appareil retiré. */
async function fetchDeviceKey(deviceId: string): Promise<OfflineDeviceKey> {
  return apiSend(
    'POST',
    `/auth/offline-devices/${encodeURIComponent(deviceId)}/key`,
    offlineDeviceKeySchema,
  );
}

/** Appareil retiré du compte : les deux protections sont détruites, les données deviennent illisibles. */
async function shred(header: HeaderV3) {
  if (ownerId() === header.ownerId) lockVault();
  await writeHeader(
    {
      ...header,
      password: null,
      device: null,
      revokedAt: new Date().toISOString(),
      revision: header.revision + 1,
    },
    header.revision,
  );
  notify();
}

/** DEK exportable obtenue par la clé d'appareil (session valide), pour la reprotéger. */
async function dataKeyFromDevice(header: HeaderV3, extractable: boolean) {
  if (!header.device || header.revokedAt) return null;
  let material: OfflineDeviceKey;
  try {
    material = await fetchDeviceKey(header.device.id);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 410 || error.status === 404)) {
      await shred(header);
      throw new VaultError(
        'REVOKED',
        'Cet appareil a été retiré de votre compte : ses données locales ne sont plus lisibles.',
      );
    }
    throw error;
  }
  const deviceKey = await importDeviceKey(material.key);
  const key = await unwrapDataKey(
    header.device.wrapped,
    deviceKey,
    deviceAad(header.id, header.device.id),
    extractable,
  );
  if (!key || (await checkOwner(header, key)) !== header.ownerId) return null;
  return key;
}

/** Reprotège la DEK par un (nouveau) mot de passe : nouveau sel, ancienne protection remplacée. */
async function protectWithPassword(header: HeaderV3, dataKey: CryptoKey, password: string) {
  const salt = randomSalt();
  const kek = await derivePasswordKey(password, salt, iterations);
  const next: HeaderV3 = {
    ...header,
    salt,
    iterations,
    password: await wrapDataKey(dataKey, kek, passwordAad(header.id)),
    revision: header.revision + 1,
  };
  await writeHeader(next, header.revision);
  return next;
}

/** Résultat de l'ouverture du coffre après une connexion en ligne. */
export type LoginVaultResult =
  'opened' | 'reprotected' | 'created' | 'none' | 'legacy' | 'revoked' | 'unrecoverable';

/**
 * Après une connexion en ligne réussie (le serveur vient de vérifier `password`) :
 * - coffre du compte protégé par ce mot de passe → ouvert ;
 * - mot de passe changé ou réinitialisé depuis → DEK obtenue par la clé d'appareil puis reprotégée
 *   par le nouveau mot de passe (aucune donnée perdue, ancien mot de passe aussitôt inutilisable ici) ;
 * - aucun coffre et `prepare` → coffre créé et appareil enregistré ;
 * - coffre antérieur à phrase locale → conversion proposée sur « Cet appareil ».
 * Le mot de passe n'est conservé nulle part.
 */
export async function openVaultAfterLogin(
  user: SessionUser,
  password: string,
  {
    prepare = false,
    deviceLabel = defaultDeviceLabel(),
  }: { prepare?: boolean; deviceLabel?: string } = {},
): Promise<LoginVaultResult> {
  assertCrypto();
  if (ownerId() && ownerId() !== user.id) lockVault();
  const header = await vaultFor(user.id);
  if (!(await hasVaultFor(user.id)) || !header) {
    if (!prepare) return 'none';
    await createVault(user, password, deviceLabel);
    return 'created';
  }
  if (!isV3(header)) return 'legacy';
  if (header.revokedAt) return 'revoked';
  const opened = await openV3WithPassword(header, password);
  if (opened) {
    await startSession(opened.owner, opened.key, user);
    return 'opened';
  }
  try {
    const dataKey = await dataKeyFromDevice(header, true);
    if (!dataKey) return 'unrecoverable';
    await protectWithPassword(header, dataKey, password);
    const fresh = (await vaultFor(user.id)) as HeaderV3;
    const reopened = await openV3WithPassword(fresh, password);
    if (!reopened) return 'unrecoverable';
    await startSession(reopened.owner, reopened.key, user);
    return 'reprotected';
  } catch (error) {
    if (error instanceof VaultError && error.code === 'REVOKED') return 'revoked';
    throw error;
  }
}

/**
 * En ligne, session valide : ouverture sans saisie grâce à la clé de l'appareil. Silencieuse :
 * `false` si l'appareil n'est pas préparé, déjà ouvert pour un autre compte ou injoignable.
 */
export async function openVaultOnline(user: SessionUser): Promise<boolean> {
  if (typeof window === 'undefined' || !globalThis.crypto?.subtle) return false;
  await ensureVaultRestored();
  if (ownerId() === user.id) return true;
  if (manuallyLocked(user.id)) return false;
  const header = await dbRead<Header | undefined>('settings', headerId(user.id)).catch(
    () => undefined,
  );
  if (!isV3(header) || !header.device || header.revokedAt) return false;
  try {
    const key = await dataKeyFromDevice(header, false);
    if (!key) return false;
    await startSession(user.id, key, user);
    return true;
  } catch {
    return false;
  }
}

/**
 * En ligne, coffre ouvert : vérifie une fois par chargement que l'appareil n'a pas été retiré du
 * compte (appareil perdu). Retiré → protections détruites et coffre verrouillé.
 */
let deviceChecked = false;
export async function checkDeviceStillAuthorized(user: SessionUser) {
  if (deviceChecked || ownerId() !== user.id) return;
  const header = await dbRead<Header | undefined>('settings', headerId(user.id)).catch(
    () => undefined,
  );
  if (!isV3(header) || !header.device) return;
  deviceChecked = true;
  try {
    await fetchDeviceKey(header.device.id);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 410 || error.status === 404))
      await shred(header);
    else deviceChecked = false;
  }
}

/** Libellé lisible de l'appareil (jamais secret). */
export function defaultDeviceLabel() {
  if (typeof navigator === 'undefined') return 'Appareil';
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Navigateur';
  const system = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad/.test(ua)
      ? 'iOS'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'appareil';
  return `${browser} sur ${system}`.slice(0, 80);
}

/**
 * Prépare le coffre de ce compte : DEK aléatoire, protégée par le mot de passe et par une clé
 * d'appareil émise par le serveur. Jamais par-dessus des données existantes du compte.
 */
export async function createVault(
  user: SessionUser,
  password: string,
  deviceLabel = defaultDeviceLabel(),
) {
  assertCrypto();
  if (await hasVaultFor(user.id)) {
    throw new VaultError('EXISTS', 'Des données de ce compte existent déjà sur cet appareil.');
  }
  const device = await apiSend('POST', '/auth/offline-devices', offlineDeviceKeySchema, {
    label: deviceLabel,
  });
  const id = headerId(user.id);
  const dataKey = await generateDataKey();
  const salt = randomSalt();
  const kek = await derivePasswordKey(password, salt, iterations);
  const header: HeaderV3 = {
    id,
    revision: 1,
    format: 3,
    ownerId: user.id,
    salt,
    iterations,
    password: await wrapDataKey(dataKey, kek, passwordAad(id)),
    device: {
      id: device.deviceId,
      wrapped: await wrapDataKey(
        dataKey,
        await importDeviceKey(device.key),
        deviceAad(id, device.deviceId),
      ),
    },
    check: await encryptJson(dataKey, { ownerId: user.id }, id),
  };
  await dbWrite('settings', header, 0);
  // Session : clé non exportable (la DEK exportable ne quitte pas cette fonction).
  const opened = await openV3WithPassword(header, password);
  if (!opened) throw new Error('Préparation interrompue : recommencez.');
  await startSession(user.id, opened.key, user);
}

/**
 * Changement de mot de passe depuis cet appareil (après confirmation du serveur) : la DEK est
 * reprotégée par le nouveau mot de passe ; l'ancien n'ouvre plus le coffre. Sans coffre : rien.
 */
export async function reprotectAfterPasswordChange(
  user: SessionUser,
  currentPassword: string,
  newPassword: string,
) {
  const header = await dbRead<Header | undefined>('settings', headerId(user.id)).catch(
    () => undefined,
  );
  if (!isV3(header) || header.revokedAt) return false;
  const viaPassword = await openV3WithPassword(header, currentPassword, true);
  const dataKey = viaPassword?.key ?? (await dataKeyFromDevice(header, true).catch(() => null));
  if (!dataKey) return false;
  await protectWithPassword(header, dataKey, newPassword);
  return true;
}

/**
 * Conversion d'un coffre antérieur (phrase locale) : ouverture une dernière fois avec la phrase,
 * enregistrements rechiffrés par une nouvelle DEK, protection par le mot de passe du compte et la
 * clé de l'appareil. La phrase n'est plus jamais demandée ensuite.
 */
export async function convertLegacyVault(user: SessionUser, phrase: string, password: string) {
  assertCrypto();
  const legacy = await vaultFor(user.id);
  if (!legacy || isV3(legacy))
    throw new VaultError('UNRECOVERABLE', 'Aucune ancienne phrase à convertir.');
  const opened = await openLegacy(legacy, phrase);
  if (!opened || opened.owner !== user.id) {
    throw new VaultError('WRONG_PASSWORD', 'Ancienne phrase locale incorrecte.');
  }
  if (ownerId()) lockVault();
  const device = await apiSend('POST', '/auth/offline-devices', offlineDeviceKeySchema, {
    label: defaultDeviceLabel(),
  });
  const id = headerId(user.id);
  const dataKey = await generateDataKey();
  // Rechiffrement de chaque enregistrement (révision conservée) avant tout remplacement d'en-tête.
  for (const recordId of await dbKeys('records', `${user.id}:`)) {
    const row = await dbRead<RecordRow | undefined>('records', recordId);
    if (!row) continue;
    const value = await decryptJson<unknown>(opened.key, row.cipher, row.id);
    const converted: RecordRow = { ...row, cipher: await encryptJson(dataKey, value, row.id) };
    await dbWrite('records', converted);
  }
  const salt = randomSalt();
  const header: HeaderV3 = {
    id,
    revision: (legacy.id === id ? legacy.revision : 0) + 1,
    format: 3,
    ownerId: user.id,
    salt,
    iterations,
    password: await wrapDataKey(
      dataKey,
      await derivePasswordKey(password, salt, iterations),
      passwordAad(id),
    ),
    device: {
      id: device.deviceId,
      wrapped: await wrapDataKey(
        dataKey,
        await importDeviceKey(device.key),
        deviceAad(id, device.deviceId),
      ),
    },
    check: await encryptJson(dataKey, { ownerId: user.id }, id),
  };
  await dbWrite('settings', header);
  if (
    legacy.id === LEGACY_HEADER &&
    (await dbKeys('records', '')).every((key) => key.startsWith(`${user.id}:`))
  ) {
    await dbDelete('settings', LEGACY_HEADER);
  }
  const reopened = await openV3WithPassword(header, password);
  if (reopened) await startSession(user.id, reopened.key, user);
}

/** Le coffre de ce compte a été effacé par le navigateur (éviction, nettoyage) depuis son activation. */
export async function vaultEvicted(userId: string) {
  return hadVault(userId) && !(await hasVaultFor(userId));
}
/** L'alerte d'effacement a été lue : le témoin est retiré. */
export function acknowledgeEviction(userId: string) {
  markPresence(userId, false);
}
/**
 * Effacement des données de ce compte sur l'appareil (mot de passe oublié hors connexion, appareil
 * retiré, changement d'utilisateur) : coffre et données locales, y compris les modifications non
 * synchronisées. Exige le compte confirmé par le serveur ; les autres coffres ne sont pas touchés.
 * L'appareil enregistré côté serveur est retiré s'il est joignable.
 */
export async function resetVault(user: SessionUser) {
  const header = await dbRead<Header | undefined>('settings', headerId(user.id)).catch(
    () => undefined,
  );
  if (ownerId() === user.id) lockVault();
  for (const id of await dbKeys('records', `${user.id}:`)) await dbDelete('records', id);
  await dbDelete('settings', headerId(user.id));
  // En-tête historique (un seul compte) : effacé seulement s'il ne protège plus aucune donnée.
  if ((await dbKeys('records', '')).length === 0) await dbDelete('settings', LEGACY_HEADER);
  markPresence(user.id, false);
  if (isV3(header) && header.device) {
    await apiSend(
      'POST',
      `/auth/offline-devices/${encodeURIComponent(header.device.id)}/revoke`,
      z.null(),
    ).catch(() => {});
  }
  notify();
}
/** Identifiant de l'appareil enregistré pour ce compte (page « Cet appareil »). */
export async function currentDeviceId(userId: string) {
  const header = await dbRead<Header | undefined>('settings', headerId(userId)).catch(
    () => undefined,
  );
  return isV3(header) ? (header.device?.id ?? null) : null;
}
/** Nombre de données locales chiffrées de ce compte (sans les déchiffrer). */
export async function localRecordCount(userId: string) {
  return (await dbKeys('records', `${userId}:`)).length;
}
export async function readRecord<T>(id: string): Promise<{ value: T; revision: number } | null> {
  const current = unlocked;
  if (!current) throw new Error('Déverrouillez vos données hors ligne.');
  const row = await dbRead<RecordRow | undefined>('records', `${current.ownerId}:${id}`);
  if (!row) return null;
  const value = await decryptJson<T>(current.key, row.cipher, row.id);
  if (unlocked !== current) throw new Error('Données verrouillées.');
  return { value, revision: row.revision };
}
export async function writeRecord(id: string, value: unknown, revision: number) {
  const current = unlocked;
  const started = generation;
  if (!current) throw new Error('Données verrouillées.');
  const key = `${current.ownerId}:${id}`;
  const cipher = await encryptJson(current.key, value, key);
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
  const cipher = await encryptJson(current.key, value, key);
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
 * `OFFLINE_ACCESS_MAX_DAYS` jours (D112). Ses permissions ne servent qu'à l'affichage et à la
 * préparation d'écritures différables : jamais une preuve d'autorisation. Au retour du réseau, la
 * session est relue et chaque opération revérifiée par le serveur ; une opération que la personne
 * n'est plus habilitée à faire (ex. changement de responsable plein) est rejetée et conservée (D133).
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
/**
 * Session serveur confirmée : rafraîchit l'identité locale, verrouille le coffre d'un autre compte,
 * ouvre sans saisie le coffre de ce compte (clé d'appareil) et vérifie que l'appareil n'a pas été
 * retiré.
 */
export async function confirmServerUser(user: SessionUser) {
  await ensureVaultRestored();
  const owner = ownerId();
  if (owner && owner !== user.id) lockVault();
  if (ownerId() === user.id) {
    await rememberIdentity(user);
    await checkDeviceStillAuthorized(user);
  } else {
    await openVaultOnline(user);
  }
}

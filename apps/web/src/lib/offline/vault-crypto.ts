/**
 * Primitives du coffre local (refonte lot 3, D180), exclusivement Web Crypto :
 * - clé de données (DEK) : AES-GCM 256 aléatoire, chiffre les enregistrements ;
 * - clé de protection (KEK) : PBKDF2-SHA-256 (sel aléatoire de 16 octets propre à l'appareil,
 *   600 000 itérations) à partir du mot de passe du compte, ou clé d'appareil de 32 octets remise
 *   par le serveur à une session valide ; elle encapsule la DEK (`wrapKey` AES-GCM, donnée
 *   authentifiée = identifiant du coffre et usage) ;
 * - aucune clé n'est exportable hors des opérations d'encapsulation explicites ; le mot de passe
 *   n'est jamais conservé.
 * Argon2id n'est pas disponible nativement dans Web Crypto : PBKDF2 est retenu (pas de dépendance
 * WebAssembly à auditer, compatible avec tous les navigateurs ciblés).
 */
export type Cipher = { iv: number[]; bytes: number[] };

export const PBKDF2_ITERATIONS = 600_000;
const encoder = new TextEncoder();
const aes = (iv: Uint8Array, aad: string): AesGcmParams => ({
  name: 'AES-GCM',
  iv: iv as Uint8Array<ArrayBuffer>,
  additionalData: encoder.encode(aad),
});

export const randomSalt = () => [...crypto.getRandomValues(new Uint8Array(16))];

/** Clé de protection dérivée du mot de passe (non exportable, sert seulement à encapsuler). */
export async function derivePasswordKey(password: string, salt: number[], iterations: number) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new Uint8Array(salt), iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  );
}

/** Clé d'appareil (32 octets base64 remis par le serveur), non exportable. */
export async function importDeviceKey(base64: string) {
  const raw = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  if (raw.length !== 32) throw new Error('Clé d’appareil invalide.');
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['wrapKey', 'unwrapKey']);
}

/** Nouvelle clé de données : exportable seulement pour être encapsulée immédiatement. */
export function generateDataKey() {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]) as Promise<CryptoKey>;
}

export async function wrapDataKey(dataKey: CryptoKey, wrappingKey: CryptoKey, aad: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = await crypto.subtle.wrapKey('raw', dataKey, wrappingKey, aes(iv, aad));
  return { iv: [...iv], bytes: [...new Uint8Array(bytes)] } satisfies Cipher;
}

/**
 * Décapsule la clé de données ; `null` si la clé de protection est fausse (mauvais mot de passe,
 * clé d'appareil d'un autre coffre) ou le bloc altéré. `extractable` seulement pour la reprotéger.
 */
export async function unwrapDataKey(
  cipher: Cipher,
  wrappingKey: CryptoKey,
  aad: string,
  extractable = false,
): Promise<CryptoKey | null> {
  try {
    return await crypto.subtle.unwrapKey(
      'raw',
      new Uint8Array(cipher.bytes),
      wrappingKey,
      aes(new Uint8Array(cipher.iv), aad),
      { name: 'AES-GCM' },
      extractable,
      ['encrypt', 'decrypt'],
    );
  } catch {
    return null;
  }
}

export async function encryptJson(key: CryptoKey, value: unknown, aad: string): Promise<Cipher> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = await crypto.subtle.encrypt(
    aes(iv, aad),
    key,
    encoder.encode(JSON.stringify(value)),
  );
  return { iv: [...iv], bytes: [...new Uint8Array(bytes)] };
}

export async function decryptJson<T>(key: CryptoKey, cipher: Cipher, aad: string): Promise<T> {
  const bytes = await crypto.subtle.decrypt(
    aes(new Uint8Array(cipher.iv), aad),
    key,
    new Uint8Array(cipher.bytes),
  );
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

/** Coffres antérieurs (phrase locale, D111) : clé dérivée directement, lue pour la conversion. */
export async function deriveLegacyKey(phrase: string, salt: number[]) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(phrase), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new Uint8Array(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Données authentifiées des blocs d'encapsulation (liées au coffre et à l'usage). */
export const passwordAad = (headerId: string) => `${headerId}:password`;
export const deviceAad = (headerId: string, deviceId: string) => `${headerId}:device:${deviceId}`;

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Chiffrement applicatif des fiches médicales (AES-256-GCM). L'identifiant du titulaire est lié au
 * chiffré (données associées) : une fiche recopiée sur un autre compte ne se déchiffre pas.
 * La clé (`MEDICAL_DATA_KEY`, 32 octets en base64) n'est jamais en base ni dans le dépôt.
 */
export const MEDICAL_KEY_VERSION = 1;

export interface SealedMedicalData {
  ciphertext: Uint8Array<ArrayBuffer>;
  iv: Uint8Array<ArrayBuffer>;
  authTag: Uint8Array<ArrayBuffer>;
  keyVersion: number;
}

export function parseMedicalKey(base64: string): Buffer {
  const key = Buffer.from(base64, 'base64');
  if (key.length !== 32)
    throw new Error('MEDICAL_DATA_KEY doit contenir 32 octets encodés en base64.');
  return key;
}

const bytes = (buffer: Buffer) => new Uint8Array(buffer);

export function sealMedicalData(key: Buffer, ownerId: string, data: unknown): SealedMedicalData {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(ownerId, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  return {
    ciphertext: bytes(ciphertext),
    iv: bytes(iv),
    authTag: bytes(cipher.getAuthTag()),
    keyVersion: MEDICAL_KEY_VERSION,
  };
}

/** Déchiffre et désérialise ; lève une erreur si la clé, le titulaire ou le contenu ne correspondent pas. */
export function openMedicalData(
  key: Buffer,
  ownerId: string,
  sealed: Pick<SealedMedicalData, 'ciphertext' | 'iv' | 'authTag'>,
): unknown {
  const decipher = createDecipheriv('aes-256-gcm', key, sealed.iv);
  decipher.setAAD(Buffer.from(ownerId, 'utf8'));
  decipher.setAuthTag(sealed.authTag);
  const plain = Buffer.concat([decipher.update(sealed.ciphertext), decipher.final()]);
  return JSON.parse(plain.toString('utf8')) as unknown;
}

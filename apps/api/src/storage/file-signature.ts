import { type StoredFileMimeType } from '@tesla/shared';

/** Octets à lire en tête de fichier pour reconnaître sa signature. */
export const SIGNATURE_BYTES = 16;

const startsWith = (bytes: Uint8Array, prefix: readonly number[], offset = 0) =>
  prefix.every((value, index) => bytes[offset + index] === value);

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

/** Marques MP4 des fichiers audio (« M4A », « M4B ») et marques génériques des encodeurs courants. */
const AUDIO_MP4_BRANDS = ['M4A ', 'M4B ', 'mp42', 'isom'] as const;

/**
 * Type réel d'après la signature binaire (jamais d'après l'extension ou l'en-tête déclaré) ;
 * `null` pour tout contenu hors liste blanche (HTML, SVG, exécutable, archive…).
 */
export function detectMimeType(head: Uint8Array): StoredFileMimeType | null {
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(head, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(head, ascii('GIF87a')) || startsWith(head, ascii('GIF89a'))) return 'image/gif';
  if (startsWith(head, ascii('RIFF')) && startsWith(head, ascii('WEBP'), 8)) return 'image/webp';
  if (startsWith(head, ascii('%PDF-'))) return 'application/pdf';
  // Audio (D221) : MP3 (étiquette ID3 ou trame MPEG couche III), MP4 audio, Ogg, WAV.
  if (startsWith(head, ascii('ID3'))) return 'audio/mpeg';
  if (head[0] === 0xff && head[1] !== undefined && (head[1] & 0xe6) === 0xe2) return 'audio/mpeg';
  if (
    startsWith(head, ascii('ftyp'), 4) &&
    AUDIO_MP4_BRANDS.some((b) => startsWith(head, ascii(b), 8))
  )
    return 'audio/mp4';
  if (startsWith(head, ascii('OggS'))) return 'audio/ogg';
  if (startsWith(head, ascii('RIFF')) && startsWith(head, ascii('WAVE'), 8)) return 'audio/wav';
  return null;
}

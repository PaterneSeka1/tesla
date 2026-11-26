import { fileExtension, STORED_FILE_TYPES, type StoredFile } from '@tesla/shared';
import { uploadModuleFile } from '@/lib/api/files';

/** Formats audio acceptés (liste blanche du stockage), par extension. */
const AUDIO_TYPES = Object.entries(STORED_FILE_TYPES).filter(
  ([, type]) => type.kind === 'AUDIO',
) as [string, { extensions: readonly string[] }][];

export const AUDIO_ACCEPT = AUDIO_TYPES.flatMap(([mime, type]) => [
  mime,
  ...type.extensions.map((extension) => `.${extension}`),
]).join(',');

/**
 * Type canonique d'après l'extension : les navigateurs annoncent des variantes (« audio/x-m4a »,
 * « audio/x-wav »). Le serveur revérifie le type réel par la signature du contenu.
 */
export function canonicalAudioType(name: string): string | null {
  const extension = fileExtension(name);
  return AUDIO_TYPES.find(([, type]) => type.extensions.includes(extension))?.[0] ?? null;
}

/** Envoi d'un enregistrement (D221) : même circuit contrôlé que les images de leçon (D143). */
export async function uploadAudioFile(
  moduleId: string,
  file: File,
  progress: (message: string) => void,
): Promise<StoredFile> {
  const type = canonicalAudioType(file.name);
  if (!type) throw new Error('Format non pris en charge : MP3, M4A, OGG ou WAV.');
  const normalized = file.type === type ? file : new File([file], file.name, { type });
  return uploadModuleFile(moduleId, normalized, progress);
}

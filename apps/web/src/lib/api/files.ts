import {
  requestModuleFileUploadInputSchema,
  type StoredFile,
  storedFileSchema,
  uploadTicketSchema,
} from '@tesla/shared';
import { ApiError, apiSend } from './client';

async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Téléverse un fichier joint à un module (D143) : autorisation de l'API, envoi direct au stockage
 * (le fichier ne transite pas par le VPS), puis confirmation, que le serveur n'accorde qu'après
 * avoir vérifié taille, type réel et empreinte. Exige le réseau : un fichier n'est jamais mis en
 * file d'attente sur l'appareil.
 */
export async function uploadModuleFile(
  moduleId: string,
  file: File,
  progress: (message: string) => void,
): Promise<StoredFile> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ApiError(0, 'NETWORK_ERROR', 'Connexion requise pour envoyer un fichier.');
  }
  progress('Préparation…');
  const input = {
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    sha256: await sha256Hex(file),
  };
  const parsed = requestModuleFileUploadInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message ?? 'Fichier refusé.',
    );
  }
  const ticket = await apiSend(
    'POST',
    `/editor/modules/${encodeURIComponent(moduleId)}/files`,
    uploadTicketSchema,
    parsed.data,
  );
  progress('Envoi du fichier…');
  let response: Response;
  try {
    // Aucun cookie ni Referer vers le stockage : seule l'URL signée autorise l'envoi.
    response = await fetch(ticket.uploadUrl, {
      method: ticket.method,
      headers: ticket.headers,
      body: file,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Envoi interrompu. Vérifiez votre réseau, puis réessayez.',
    );
  }
  if (!response.ok) {
    throw new ApiError(
      response.status,
      'UPLOAD_FAILED',
      response.status === 403
        ? 'Autorisation d’envoi expirée. Recommencez.'
        : 'Le stockage a refusé le fichier. Recommencez.',
    );
  }
  progress('Vérification…');
  return apiSend(
    'POST',
    `/editor/modules/${encodeURIComponent(moduleId)}/files/${ticket.fileId}/complete`,
    storedFileSchema,
  );
}

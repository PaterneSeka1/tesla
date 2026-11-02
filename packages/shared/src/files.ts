import { z } from 'zod';

/**
 * Fichiers stockés hors du VPS (stockage objet compatible S3, Cloudflare R2 en production, D143).
 * PostgreSQL ne conserve que les métadonnées et la référence de l'objet, jamais le contenu ni un
 * lien signé. Le nom d'objet est généré par le serveur ; le nom d'origine n'est qu'une métadonnée.
 */

/** Doit rester synchronisé avec l'enum Prisma `StoredFileCategory`. */
export const STORED_FILE_CATEGORIES = ['MODULE_RESOURCE'] as const;
export type StoredFileCategory = (typeof STORED_FILE_CATEGORIES)[number];

/** Doit rester synchronisé avec l'enum Prisma `StoredFileStatus`. */
export const STORED_FILE_STATUSES = [
  /** Autorisation d'envoi émise, contenu non encore vérifié. */
  'EN_ATTENTE',
  /** Présence, taille, type réel et empreinte vérifiés par le serveur. */
  'VALIDE',
  /** Contrôle échoué : l'objet a été supprimé du stockage. */
  'REJETE',
  /** Envoi jamais confirmé dans le délai : objet éventuel supprimé par le traitement quotidien. */
  'ABANDONNE',
] as const;
export type StoredFileStatus = (typeof STORED_FILE_STATUSES)[number];

/**
 * Types acceptés (liste blanche) : formats d'image passifs et PDF. Jamais de SVG, HTML ou
 * exécutable. L'extension du nom d'origine et la signature réelle du contenu doivent concorder.
 */
export const STORED_FILE_TYPES = {
  'image/png': { extensions: ['png'], kind: 'IMAGE' },
  'image/jpeg': { extensions: ['jpg', 'jpeg'], kind: 'IMAGE' },
  'image/webp': { extensions: ['webp'], kind: 'IMAGE' },
  'image/gif': { extensions: ['gif'], kind: 'IMAGE' },
  'application/pdf': { extensions: ['pdf'], kind: 'DOCUMENT' },
} as const satisfies Record<string, { extensions: readonly string[]; kind: 'IMAGE' | 'DOCUMENT' }>;

export type StoredFileMimeType = keyof typeof STORED_FILE_TYPES;
export const STORED_FILE_MIME_TYPES = Object.keys(STORED_FILE_TYPES) as [
  StoredFileMimeType,
  ...StoredFileMimeType[],
];

/** Plafonds par nature (l'API applique aussi `R2_UPLOAD_MAX_BYTES`, le plus petit l'emporte). */
export const STORED_FILE_MAX_BYTES = {
  IMAGE: 5 * 1024 * 1024,
  DOCUMENT: 20 * 1024 * 1024,
} as const;

/** Extension en minuscules, sans le point ; chaîne vide si absente. */
export function fileExtension(name: string): string {
  const match = /\.([A-Za-z0-9]{1,10})$/.exec(name);
  return match ? match[1]!.toLowerCase() : '';
}

/**
 * Nom d'origine conservé pour l'affichage et le nom de téléchargement : sans chemin, sans
 * caractère de contrôle ni séparateur, borné. Jamais utilisé dans un nom d'objet.
 */
export function normalizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  return (
    base
      .normalize('NFC')
      .replace(/[\p{Cc}\p{Cf}"<>|:*?]/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^\.+/, '')
      .slice(-150) || 'fichier'
  );
}

const sha256Hex = z
  .string()
  .regex(/^[0-9a-f]{64}$/, { error: 'Empreinte SHA-256 attendue (64 caractères hexadécimaux).' });

/** Demande d'autorisation d'envoi d'un fichier joint à un module (auteur ou responsable). */
export const requestModuleFileUploadInputSchema = z
  .object({
    fileName: z.string().trim().min(1, { error: 'Nom de fichier requis.' }).max(255),
    mimeType: z.enum(STORED_FILE_MIME_TYPES, {
      error: 'Type de fichier non autorisé (PNG, JPEG, WebP, GIF ou PDF).',
    }),
    sizeBytes: z.number().int().min(1, { error: 'Fichier vide.' }),
    sha256: sha256Hex,
  })
  .superRefine((value, ctx) => {
    const type = STORED_FILE_TYPES[value.mimeType];
    if (!(type.extensions as readonly string[]).includes(fileExtension(value.fileName))) {
      ctx.addIssue({
        code: 'custom',
        path: ['fileName'],
        message: `Extension incohérente avec le type déclaré (.${type.extensions.join(', .')} attendu).`,
      });
    }
    if (value.sizeBytes > STORED_FILE_MAX_BYTES[type.kind]) {
      ctx.addIssue({
        code: 'custom',
        path: ['sizeBytes'],
        message: `Fichier trop volumineux (${STORED_FILE_MAX_BYTES[type.kind] / 1024 / 1024} Mo maximum).`,
      });
    }
  });

export type RequestModuleFileUploadInput = z.input<typeof requestModuleFileUploadInputSchema>;

/**
 * Autorisation d'envoi direct vers le stockage : URL signée à usage unique (aucun écrasement), à
 * utiliser avec exactement ces en-têtes avant `expiresAt`. Jamais conservée en base.
 */
export const uploadTicketSchema = z.object({
  fileId: z.uuid(),
  method: z.literal('PUT'),
  uploadUrl: z.url(),
  headers: z.record(z.string(), z.string()),
  expiresAt: z.iso.datetime(),
});

export type UploadTicket = z.infer<typeof uploadTicketSchema>;

/** Métadonnées publiques d'un fichier (jamais la clé d'objet ni le compartiment). */
export const storedFileSchema = z.object({
  id: z.uuid(),
  status: z.enum(STORED_FILE_STATUSES),
  originalName: z.string(),
  mimeType: z.enum(STORED_FILE_MIME_TYPES),
  sizeBytes: z.number().int(),
  createdAt: z.iso.datetime(),
  validatedAt: z.iso.datetime().nullable(),
});

export type StoredFile = z.infer<typeof storedFileSchema>;

/** Fichier joint à une ressource de module (absent pour un lien externe). */
export const resourceFileSchema = z.object({
  id: z.uuid(),
  originalName: z.string(),
  mimeType: z.enum(STORED_FILE_MIME_TYPES),
  sizeBytes: z.number().int(),
});

export type ResourceFile = z.infer<typeof resourceFileSchema>;

/** Chemin d'API du contenu d'un fichier de module (redirection vers une URL signée courte). */
export function moduleFilePath(fileId: string): string {
  return `/module-files/${encodeURIComponent(fileId)}`;
}

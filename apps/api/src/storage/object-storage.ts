/**
 * Port de stockage objet (D143) : seule surface utilisée par les services métier. L'implémentation
 * de production parle le protocole S3 (Cloudflare R2) ; remplacer le fournisseur ne touche que
 * `s3-object-storage.ts` et la configuration.
 */
export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface ObjectHead {
  sizeBytes: number;
  contentType: string | null;
}

export interface PresignedUpload {
  url: string;
  /** En-têtes signés que le client doit envoyer tels quels. */
  headers: Record<string, string>;
}

export interface ObjectStorage {
  readonly bucket: string;
  /**
   * URL d'envoi direct à usage unique : type et taille signés, refus si l'objet existe déjà
   * (`If-None-Match: *`), aucun écrasement possible.
   */
  presignUpload(
    key: string,
    options: { contentType: string; sizeBytes: number; expiresInSeconds: number },
  ): Promise<PresignedUpload>;
  /** URL de lecture courte, type et disposition imposés par le serveur. */
  presignDownload(
    key: string,
    options: {
      contentType: string;
      fileName: string;
      disposition: 'inline' | 'attachment';
      expiresInSeconds: number;
    },
  ): Promise<string>;
  /** Métadonnées de l'objet ; `null` s'il n'existe pas. */
  head(key: string): Promise<ObjectHead | null>;
  /** Contenu en flux (jamais chargé entièrement en mémoire). */
  read(key: string): Promise<AsyncIterable<Uint8Array>>;
  /** Suppression idempotente (absence tolérée). */
  delete(key: string): Promise<void>;
}

/**
 * Échec du fournisseur (réseau, droits, configuration). Le message ne contient ni clé d'accès, ni
 * URL signée, ni contenu : seulement l'opération et le code d'erreur du fournisseur.
 */
export class ObjectStorageError extends Error {
  constructor(
    readonly operation: string,
    readonly providerCode: string,
  ) {
    super(`Stockage objet : échec de « ${operation} » (${providerCode}).`);
    this.name = 'ObjectStorageError';
  }
}

import { createHash, randomUUID } from 'node:crypto';
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  Optional,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  normalizeFileName,
  STORED_FILE_TYPES,
  type StoredFileCategory,
  type StoredFileMimeType,
  type UploadTicket,
} from '@tesla/shared';
import { ENV } from '../config/config.module.js';
import { type Env } from '../config/env.js';
import { type StoredFile } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { detectMimeType, SIGNATURE_BYTES } from './file-signature.js';
import { OBJECT_STORAGE, type ObjectStorage, ObjectStorageError } from './object-storage.js';

/** Segment de clé par catégorie (jamais de donnée fournie par l'utilisateur dans une clé). */
const KEY_SEGMENTS: Record<StoredFileCategory, string> = { MODULE_RESOURCE: 'module-resources' };

/** Délai de grâce après l'expiration de l'URL d'envoi avant l'abandon d'un fichier en attente. */
export const ABANDON_GRACE_MS = 60 * 60 * 1000;

export interface UploadRequest {
  category: StoredFileCategory;
  moduleId: string | null;
  createdById: string;
  fileName: string;
  mimeType: StoredFileMimeType;
  sizeBytes: number;
  sha256: string;
}

export const storageUnavailable = () =>
  new ServiceUnavailableException({
    code: 'FILE_STORAGE_UNAVAILABLE',
    message: 'Le stockage des fichiers n’est pas configuré sur cette installation.',
  });

const storageFailed = () =>
  new ServiceUnavailableException({
    code: 'FILE_STORAGE_ERROR',
    message: 'Le stockage des fichiers est momentanément indisponible. Réessayez plus tard.',
  });

/**
 * Cycle de vie technique des fichiers (D143) : autorisation d'envoi direct, confirmation vérifiée
 * par le serveur, lecture par URL signée courte, nettoyage des envois abandonnés. L'autorisation
 * métier (qui peut envoyer ou lire quel fichier) appartient aux services de domaine appelants.
 */
@Injectable()
export class StoredFilesService {
  private readonly logger = new Logger(StoredFilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
    @Optional() @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage | null,
  ) {}

  get available(): boolean {
    return this.storage !== null;
  }

  private requireStorage(): ObjectStorage {
    if (!this.storage) throw storageUnavailable();
    return this.storage;
  }

  /** Crée la fiche `EN_ATTENTE` et l'URL d'envoi signée (type, taille, aucun écrasement). */
  async requestUpload(request: UploadRequest): Promise<UploadTicket> {
    const storage = this.requireStorage();
    const kind = STORED_FILE_TYPES[request.mimeType].kind;
    if (request.sizeBytes > this.env.R2_UPLOAD_MAX_BYTES) {
      throw new PayloadTooLargeException({
        code: 'FILE_TOO_LARGE',
        message: `Fichier trop volumineux (${Math.floor(this.env.R2_UPLOAD_MAX_BYTES / 1024 / 1024)} Mo maximum sur cette installation).`,
      });
    }
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.env.R2_SIGNED_URL_EXPIRATION * 1000);
    const month = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const storageKey = `${this.env.R2_KEY_PREFIX}/${KEY_SEGMENTS[request.category]}/${month}/${randomUUID()}`;
    const file = await this.prisma.storedFile.create({
      data: {
        category: request.category,
        bucket: storage.bucket,
        storageKey,
        originalName: normalizeFileName(request.fileName),
        mimeType: request.mimeType,
        sizeBytes: request.sizeBytes,
        sha256: request.sha256,
        moduleId: request.moduleId,
        createdById: request.createdById,
        uploadExpiresAt: expiresAt,
      },
    });
    const presigned = await this.guard('presignUpload', file.id, () =>
      storage.presignUpload(storageKey, {
        contentType: request.mimeType,
        sizeBytes: request.sizeBytes,
        expiresInSeconds: this.env.R2_SIGNED_URL_EXPIRATION,
      }),
    );
    this.logger.log(`Envoi autorisé : fichier ${file.id} (${kind}, ${request.sizeBytes} octets).`);
    return {
      fileId: file.id,
      method: 'PUT',
      uploadUrl: presigned.url,
      headers: presigned.headers,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Confirmation : le fichier n'est `VALIDE` qu'après vérification réelle de sa présence, de sa
   * taille, de sa signature et de son empreinte (lecture en flux). Idempotente : une seconde
   * confirmation renvoie le fichier déjà validé. Un contenu non conforme est supprimé (`REJETE`).
   */
  async confirm(file: StoredFile): Promise<StoredFile> {
    if (file.status === 'VALIDE') return file;
    if (file.status !== 'EN_ATTENTE') throw fileRejected(file.rejectionReason);
    const storage = this.requireStorage();
    const head = await this.guard('head', file.id, () => storage.head(file.storageKey));
    if (!head) {
      throw new ConflictException({
        code: 'FILE_NOT_UPLOADED',
        message: 'Le fichier n’a pas encore été reçu par le stockage. Recommencez l’envoi.',
      });
    }
    const problem =
      head.sizeBytes !== file.sizeBytes
        ? 'Taille différente de la taille déclarée.'
        : await this.inspect(storage, file);
    if (problem) return this.reject(storage, file, problem);
    const updated = await this.prisma.storedFile.updateMany({
      where: { id: file.id, status: 'EN_ATTENTE' },
      data: { status: 'VALIDE', validatedAt: new Date() },
    });
    const current = await this.prisma.storedFile.findUniqueOrThrow({ where: { id: file.id } });
    if (updated.count === 0 && current.status !== 'VALIDE')
      throw fileRejected(current.rejectionReason);
    if (updated.count === 1) this.logger.log(`Fichier ${file.id} vérifié et validé.`);
    return current;
  }

  /** URL de lecture signée et courte pour un fichier validé (jamais conservée, jamais journalisée). */
  async downloadUrl(file: StoredFile): Promise<string> {
    const storage = this.requireStorage();
    if (file.status !== 'VALIDE') throw fileRejected(file.rejectionReason);
    const kind = STORED_FILE_TYPES[file.mimeType as StoredFileMimeType]?.kind;
    return this.guard('presignDownload', file.id, () =>
      storage.presignDownload(file.storageKey, {
        contentType: file.mimeType,
        fileName: file.originalName,
        // Images affichées ; documents toujours téléchargés (aucun rendu dans l'origine de l'application).
        disposition: kind === 'IMAGE' ? 'inline' : 'attachment',
        expiresInSeconds: this.env.R2_SIGNED_URL_EXPIRATION,
      }),
    );
  }

  /**
   * Envois jamais confirmés (URL expirée depuis plus d'une heure) : objet éventuel supprimé, fiche
   * conservée en `ABANDONNE`. Idempotent ; un échec du stockage laisse la fiche en attente.
   */
  async cleanupAbandoned(now = new Date()): Promise<{ abandoned: number; failed: number }> {
    if (!this.storage) return { abandoned: 0, failed: 0 };
    const storage = this.storage;
    const stale = await this.prisma.storedFile.findMany({
      where: {
        OR: [
          {
            status: 'EN_ATTENTE',
            uploadExpiresAt: { lt: new Date(now.getTime() - ABANDON_GRACE_MS) },
          },
          // Rejet dont la suppression de l'objet avait échoué : nouvel essai.
          { status: 'REJETE', objectDeletedAt: null },
        ],
      },
      take: 500,
    });
    let abandoned = 0;
    let failed = 0;
    for (const file of stale) {
      try {
        await storage.delete(file.storageKey);
        if (file.status === 'REJETE') {
          await this.prisma.storedFile.update({
            where: { id: file.id },
            data: { objectDeletedAt: new Date() },
          });
          continue;
        }
        const { count } = await this.prisma.storedFile.updateMany({
          where: { id: file.id, status: 'EN_ATTENTE' },
          data: {
            status: 'ABANDONNE',
            rejectionReason: 'Envoi jamais confirmé.',
            objectDeletedAt: new Date(),
          },
        });
        abandoned += count;
      } catch (error) {
        failed += 1;
        this.logger.warn(`Nettoyage du fichier ${file.id} reporté : ${describe(error)}`);
      }
    }
    return { abandoned, failed };
  }

  /**
   * Indicateurs sans contenu (traitement quotidien, supervision) : volume logique par statut et
   * fichiers validés qu'aucune ressource ne référence plus depuis 7 jours (signalés, jamais
   * supprimés automatiquement : leur effacement reste une décision humaine).
   */
  async stats(now = new Date()) {
    const byStatus = await this.prisma.storedFile.groupBy({
      by: ['status'],
      _count: { _all: true },
      _sum: { sizeBytes: true },
    });
    const orphans = await this.prisma.storedFile.count({
      where: {
        status: 'VALIDE',
        validatedAt: { lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
        resources: { none: {} },
      },
    });
    return {
      byStatus: Object.fromEntries(
        byStatus.map((row) => [
          row.status,
          { count: row._count._all, bytes: row._sum.sizeBytes ?? 0 },
        ]),
      ),
      orphans,
    };
  }

  /** Lecture en flux : taille réelle, signature et SHA-256 ; message du problème ou `null`. */
  private async inspect(storage: ObjectStorage, file: StoredFile): Promise<string | null> {
    const hash = createHash('sha256');
    const head = new Uint8Array(SIGNATURE_BYTES);
    let size = 0;
    const stream = await this.guard('read', file.id, () => storage.read(file.storageKey));
    try {
      for await (const chunk of stream) {
        if (size < SIGNATURE_BYTES) head.set(chunk.subarray(0, SIGNATURE_BYTES - size), size);
        size += chunk.length;
        if (size > file.sizeBytes) return 'Taille différente de la taille déclarée.';
        hash.update(chunk);
      }
    } catch (error) {
      this.logger.error(`Lecture du fichier ${file.id} impossible : ${describe(error)}`);
      throw storageFailed();
    }
    if (size !== file.sizeBytes) return 'Taille différente de la taille déclarée.';
    if (detectMimeType(head) !== file.mimeType) return 'Contenu différent du type déclaré.';
    if (hash.digest('hex') !== file.sha256) return 'Empreinte SHA-256 différente.';
    return null;
  }

  private async reject(storage: ObjectStorage, file: StoredFile, reason: string): Promise<never> {
    let deleted = true;
    try {
      await storage.delete(file.storageKey);
    } catch (error) {
      // L'objet sera retiré par un nouvel essai : la fiche reste rejetée, jamais validée.
      deleted = false;
      this.logger.warn(`Suppression du fichier rejeté ${file.id} reportée : ${describe(error)}`);
    }
    await this.prisma.storedFile.updateMany({
      where: { id: file.id, status: 'EN_ATTENTE' },
      data: {
        status: 'REJETE',
        rejectionReason: reason,
        objectDeletedAt: deleted ? new Date() : null,
      },
    });
    this.logger.warn(`Fichier ${file.id} rejeté : ${reason}`);
    throw fileRejected(reason);
  }

  private async guard<T>(operation: string, fileId: string, run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      this.logger.error(
        `Stockage (${operation}) en échec pour le fichier ${fileId} : ${describe(error)}`,
      );
      throw storageFailed();
    }
  }
}

function fileRejected(reason: string | null) {
  return new UnprocessableEntityException({
    code: 'FILE_REJECTED',
    message: `Fichier refusé${reason ? ` : ${reason}` : '.'} Envoyez-le de nouveau.`,
  });
}

/** Description journalisable d'une erreur : jamais d'URL signée, de clé d'accès ni de contenu. */
function describe(error: unknown): string {
  if (error instanceof ObjectStorageError) return error.message;
  return error instanceof Error ? error.name : 'erreur inconnue';
}

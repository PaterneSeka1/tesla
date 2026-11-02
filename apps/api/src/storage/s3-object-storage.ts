import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { type Readable } from 'node:stream';
import {
  type ObjectHead,
  type ObjectStorage,
  ObjectStorageError,
  type PresignedUpload,
} from './object-storage.js';

export interface S3StorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** Nom de téléchargement RFC 6266 (le nom d'origine est déjà normalisé). */
export function contentDisposition(disposition: 'inline' | 'attachment', fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/** Stockage S3 compatible (Cloudflare R2 : région « auto », adressage par chemin). */
export class S3ObjectStorage implements ObjectStorage {
  readonly bucket: string;
  private readonly client: S3Client;

  constructor(config: S3StorageConfig) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: true,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      // R2 ne prend pas en charge les sommes CRC ajoutées par défaut par les SDK récents.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      maxAttempts: 3,
    });
  }

  async presignUpload(
    key: string,
    options: { contentType: string; sizeBytes: number; expiresInSeconds: number },
  ): Promise<PresignedUpload> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: options.contentType,
      ContentLength: options.sizeBytes,
      IfNoneMatch: '*',
    });
    const url = await this.call('presignUpload', () =>
      getSignedUrl(this.client, command, {
        expiresIn: options.expiresInSeconds,
        signableHeaders: new Set(['content-type', 'content-length', 'if-none-match']),
      }),
    );
    return { url, headers: { 'Content-Type': options.contentType, 'If-None-Match': '*' } };
  }

  presignDownload(
    key: string,
    options: {
      contentType: string;
      fileName: string;
      disposition: 'inline' | 'attachment';
      expiresInSeconds: number;
    },
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentType: options.contentType,
      ResponseContentDisposition: contentDisposition(options.disposition, options.fileName),
      ResponseCacheControl: `private, max-age=${options.expiresInSeconds}`,
    });
    return this.call('presignDownload', () =>
      getSignedUrl(this.client, command, { expiresIn: options.expiresInSeconds }),
    );
  }

  async head(key: string): Promise<ObjectHead | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return { sizeBytes: result.ContentLength ?? 0, contentType: result.ContentType ?? null };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw toStorageError('head', error);
    }
  }

  async read(key: string): Promise<AsyncIterable<Uint8Array>> {
    const result = await this.call('read', () =>
      this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key })),
    );
    if (!result.Body) throw new ObjectStorageError('read', 'EmptyBody');
    return result.Body as Readable;
  }

  async delete(key: string): Promise<void> {
    await this.call('delete', () =>
      this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key })),
    );
  }

  private async call<T>(operation: string, run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      throw toStorageError(operation, error);
    }
  }
}

function isNotFound(error: unknown): boolean {
  return (
    error instanceof S3ServiceException &&
    (error.name === 'NotFound' ||
      error.name === 'NoSuchKey' ||
      error.$metadata.httpStatusCode === 404)
  );
}

/** Seul le nom d'erreur du fournisseur est conservé (jamais le message, qui peut citer l'URL). */
function toStorageError(operation: string, error: unknown): ObjectStorageError {
  if (error instanceof ObjectStorageError) return error;
  const code = error instanceof Error ? error.name.replace(/[^\w.-]/g, '').slice(0, 60) : 'Unknown';
  return new ObjectStorageError(operation, code || 'Unknown');
}

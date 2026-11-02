import { Readable } from 'node:stream';
import {
  type ObjectHead,
  type ObjectStorage,
  ObjectStorageError,
  type PresignedUpload,
} from './object-storage.js';

/**
 * Stockage en mémoire pour les tests (unitaires et d'intégration) : jamais enregistré par
 * `StorageModule`. `put` simule l'envoi direct du navigateur ; `failNext` simule une panne.
 */
export class MemoryObjectStorage implements ObjectStorage {
  readonly bucket = 'tesla-test';
  readonly objects = new Map<string, { bytes: Uint8Array; contentType: string }>();
  private failures = new Set<string>();

  failNext(operation: 'presignUpload' | 'presignDownload' | 'head' | 'read' | 'delete'): void {
    this.failures.add(operation);
  }

  put(key: string, bytes: Uint8Array, contentType: string): void {
    if (this.objects.has(key)) throw new Error('412 PreconditionFailed');
    this.objects.set(key, { bytes, contentType });
  }

  presignUpload(
    key: string,
    options: { contentType: string; sizeBytes: number; expiresInSeconds: number },
  ): Promise<PresignedUpload> {
    this.fail('presignUpload');
    return Promise.resolve({
      url: `https://storage.test/${this.bucket}/${key}?X-Amz-Expires=${options.expiresInSeconds}`,
      headers: { 'Content-Type': options.contentType, 'If-None-Match': '*' },
    });
  }

  presignDownload(key: string, options: { expiresInSeconds: number }): Promise<string> {
    this.fail('presignDownload');
    return Promise.resolve(
      `https://storage.test/${this.bucket}/${key}?X-Amz-Expires=${options.expiresInSeconds}&X-Amz-Signature=test`,
    );
  }

  head(key: string): Promise<ObjectHead | null> {
    this.fail('head');
    const object = this.objects.get(key);
    return Promise.resolve(
      object ? { sizeBytes: object.bytes.length, contentType: object.contentType } : null,
    );
  }

  read(key: string): Promise<AsyncIterable<Uint8Array>> {
    this.fail('read');
    const object = this.objects.get(key);
    if (!object) return Promise.reject(new ObjectStorageError('read', 'NoSuchKey'));
    // Morceaux de 7 octets : exerce le calcul d'empreinte et la lecture de signature par fragments.
    const chunks: Uint8Array[] = [];
    for (let offset = 0; offset < object.bytes.length; offset += 7)
      chunks.push(object.bytes.subarray(offset, offset + 7));
    return Promise.resolve(Readable.from(chunks, { objectMode: true }));
  }

  delete(key: string): Promise<void> {
    this.fail('delete');
    this.objects.delete(key);
    return Promise.resolve();
  }

  private fail(operation: string): void {
    if (this.failures.delete(operation)) throw new ObjectStorageError(operation, 'InternalError');
  }
}

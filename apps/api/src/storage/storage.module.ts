import { Global, Logger, Module } from '@nestjs/common';
import { ENV } from '../config/config.module.js';
import { type Env } from '../config/env.js';
import { OBJECT_STORAGE } from './object-storage.js';
import { S3ObjectStorage } from './s3-object-storage.js';
import { StoredFilesService } from './stored-files.service.js';

/** Stockage S3 configuré, sinon `null` : les fonctions de fichiers répondent alors 503. */
export function createObjectStorage(env: Env): S3ObjectStorage | null {
  if (
    !env.R2_BUCKET_NAME ||
    !env.R2_ACCESS_KEY_ID ||
    !env.R2_SECRET_ACCESS_KEY ||
    !env.R2_ENDPOINT
  ) {
    new Logger('Stockage').warn(
      'Stockage objet (R2) non configuré : téléversement et lecture des fichiers indisponibles.',
    );
    return null;
  }
  return new S3ObjectStorage({
    endpoint: env.R2_ENDPOINT,
    region: env.R2_REGION,
    bucket: env.R2_BUCKET_NAME,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  });
}

/** Stockage objet partagé par les domaines métier (D143). */
@Global()
@Module({
  providers: [
    { provide: OBJECT_STORAGE, inject: [ENV], useFactory: createObjectStorage },
    StoredFilesService,
  ],
  exports: [StoredFilesService],
})
export class StorageModule {}

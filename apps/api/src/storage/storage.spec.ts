import {
  normalizeFileName,
  requestModuleFileUploadInputSchema,
  STORED_FILE_CATEGORIES,
  STORED_FILE_STATUSES,
} from '@tesla/shared';
import { createResourceInputSchema } from '@tesla/shared';
import { StoredFileCategory, StoredFileStatus } from '../generated/prisma/enums.js';
import { detectMimeType } from './file-signature.js';
import { ObjectStorageError } from './object-storage.js';
import { contentDisposition, S3ObjectStorage } from './s3-object-storage.js';

const SECRET = 'secret-de-test-ne-doit-jamais-apparaitre';
const sha256 = 'a'.repeat(64);
const bytes = (...values: number[]) =>
  new Uint8Array([...values, ...new Array<number>(16).fill(0)]);
const text = (value: string) => bytes(...[...value].map((char) => char.charCodeAt(0)));

describe('Synchronisation des enums de fichiers', () => {
  it('catégories et statuts identiques entre Prisma et @tesla/shared', () => {
    expect(Object.values(StoredFileCategory).sort()).toEqual([...STORED_FILE_CATEGORIES].sort());
    expect(Object.values(StoredFileStatus).sort()).toEqual([...STORED_FILE_STATUSES].sort());
  });
});

describe('detectMimeType', () => {
  it('reconnaît les signatures de la liste blanche', () => {
    expect(detectMimeType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png');
    expect(detectMimeType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(detectMimeType(text('GIF89a'))).toBe('image/gif');
    expect(detectMimeType(text('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
    expect(detectMimeType(text('%PDF-1.7'))).toBe('application/pdf');
  });

  it('refuse les contenus actifs ou exécutables, même renommés', () => {
    expect(detectMimeType(text('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(detectMimeType(text('<!DOCTYPE html><script>'))).toBeNull();
    expect(detectMimeType(text('MZ\x90\0'))).toBeNull(); // exécutable Windows
    expect(detectMimeType(bytes(0x7f, 0x45, 0x4c, 0x46))).toBeNull(); // ELF
    expect(detectMimeType(text('PK\x03\x04'))).toBeNull(); // archive
    expect(detectMimeType(new Uint8Array(0))).toBeNull();
  });
});

describe('Demande d’envoi', () => {
  const valid = { fileName: 'carte.png', mimeType: 'image/png', sizeBytes: 1000, sha256 };

  it('accepte une image conforme', () => {
    expect(requestModuleFileUploadInputSchema.safeParse(valid).success).toBe(true);
  });

  it('refuse un type hors liste blanche (SVG, HTML, exécutable)', () => {
    for (const mimeType of ['image/svg+xml', 'text/html', 'application/x-msdownload']) {
      expect(requestModuleFileUploadInputSchema.safeParse({ ...valid, mimeType }).success).toBe(
        false,
      );
    }
  });

  it('refuse une extension incohérente avec le type déclaré', () => {
    expect(
      requestModuleFileUploadInputSchema.safeParse({ ...valid, fileName: 'carte.png.exe' }).success,
    ).toBe(false);
  });

  it('refuse un fichier trop volumineux ou vide', () => {
    expect(
      requestModuleFileUploadInputSchema.safeParse({ ...valid, sizeBytes: 5 * 1024 * 1024 + 1 })
        .success,
    ).toBe(false);
    expect(
      requestModuleFileUploadInputSchema.safeParse({
        ...valid,
        fileName: 'guide.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 20 * 1024 * 1024 + 1,
      }).success,
    ).toBe(false);
    expect(requestModuleFileUploadInputSchema.safeParse({ ...valid, sizeBytes: 0 }).success).toBe(
      false,
    );
  });

  it('refuse une empreinte mal formée', () => {
    expect(
      requestModuleFileUploadInputSchema.safeParse({ ...valid, sha256: 'A'.repeat(64) }).success,
    ).toBe(false);
  });
});

describe('normalizeFileName', () => {
  it('retire chemins, caractères de contrôle et séparateurs (aucun parcours de répertoire)', () => {
    expect(normalizeFileName('../../etc/passwd')).toBe('passwd');
    expect(normalizeFileName('C:\\Users\\x\\carte.png')).toBe('carte.png');
    expect(normalizeFileName('a\u0000b\u202e"c".pdf')).toBe('abc.pdf');
    expect(normalizeFileName('...')).toBe('fichier');
    expect(normalizeFileName(`${'x'.repeat(300)}.pdf`)).toHaveLength(150);
  });
});

describe('Ressource : fichier ou adresse', () => {
  const base = { versionId: '0190a0b0-0000-7000-8000-000000000001', title: 'Carte' };
  const fileId = '0190a0b0-0000-7000-8000-000000000002';

  it('accepte un fichier pour une image ou un document, sans adresse', () => {
    expect(createResourceInputSchema.safeParse({ ...base, kind: 'IMAGE', fileId }).success).toBe(
      true,
    );
    expect(createResourceInputSchema.safeParse({ ...base, kind: 'DOCUMENT', fileId }).success).toBe(
      true,
    );
  });

  it('refuse fichier et adresse ensemble, ou un fichier pour une vidéo', () => {
    expect(
      createResourceInputSchema.safeParse({
        ...base,
        kind: 'IMAGE',
        fileId,
        url: 'https://a.test/x',
      }).success,
    ).toBe(false);
    expect(createResourceInputSchema.safeParse({ ...base, kind: 'VIDEO', fileId }).success).toBe(
      false,
    );
  });

  it('exige toujours une adresse sûre sans fichier', () => {
    expect(createResourceInputSchema.safeParse({ ...base, kind: 'LIEN' }).success).toBe(false);
    expect(
      createResourceInputSchema.safeParse({ ...base, kind: 'LIEN', url: 'https://a.test' }).success,
    ).toBe(true);
  });
});

describe('S3ObjectStorage (signature locale, aucun appel réseau)', () => {
  const storage = new S3ObjectStorage({
    endpoint: 'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com',
    region: 'auto',
    bucket: 'tesla-files-test',
    accessKeyId: 'AKIDTEST',
    secretAccessKey: SECRET,
  });

  it('signe type, taille et absence d’écrasement de l’envoi, sans exposer le secret', async () => {
    const { url, headers } = await storage.presignUpload(
      'development/module-resources/2026/11/abc',
      {
        contentType: 'image/png',
        sizeBytes: 1234,
        expiresInSeconds: 300,
      },
    );
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/tesla-files-test/development/module-resources/2026/11/abc');
    expect(parsed.searchParams.get('X-Amz-Expires')).toBe('300');
    const signed = parsed.searchParams.get('X-Amz-SignedHeaders')!.split(';');
    expect(signed).toEqual(
      expect.arrayContaining(['content-type', 'content-length', 'if-none-match', 'host']),
    );
    expect(headers).toEqual({ 'Content-Type': 'image/png', 'If-None-Match': '*' });
    expect(url).not.toContain(SECRET);
  });

  it('impose type, disposition et cache privé à la lecture', async () => {
    const url = new URL(
      await storage.presignDownload('k/l', {
        contentType: 'application/pdf',
        fileName: 'Guide été.pdf',
        disposition: 'attachment',
        expiresInSeconds: 120,
      }),
    );
    expect(url.searchParams.get('response-content-type')).toBe('application/pdf');
    expect(url.searchParams.get('response-content-disposition')).toMatch(
      /^attachment; filename="Guide _t_.pdf"/,
    );
    expect(url.searchParams.get('response-cache-control')).toBe('private, max-age=120');
    expect(url.toString()).not.toContain(SECRET);
  });

  it('encode le nom de téléchargement sans permettre d’injection d’en-tête', () => {
    expect(contentDisposition('inline', 'a"b\r\nX: y.png')).toBe(
      'inline; filename="a_b__X: y.png"; filename*=UTF-8\'\'a%22b%0D%0AX%3A%20y.png',
    );
  });

  it('erreur du fournisseur : ni message ni secret dans l’erreur remontée', () => {
    const error = new ObjectStorageError('head', 'AccessDenied');
    expect(error.message).toBe('Stockage objet : échec de « head » (AccessDenied).');
  });
});

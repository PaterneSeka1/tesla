import {
  catalogLessonSchema,
  catalogModuleDetailSchema,
  type OfflineModulePackage,
  offlineModulePackageSchema,
} from '@tesla/shared';
import { apiFetch } from '@/lib/api/client';
import { dbDelete } from './db';
import { assertOnlineOwner, ownerId, readRecord, recordIds, writeRecord } from './vault';

export interface DownloadedModule {
  package: OfflineModulePackage;
  assets: Record<string, { mime: string; bytes: number[] }>;
  unavailable: string[];
  downloadedAt: string;
  lastReadAt: string | null;
  lessonIndex: number;
  estimatedBytes: number;
}
export const MAX_PACKAGE_BYTES = 30 * 1024 * 1024;
export const MAX_ASSET_BYTES = 3 * 1024 * 1024;
const active = new Set<string>();
export async function sha256(value: string) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
export function imageSources(value: unknown): string[] {
  const urls = new Set<string>();
  function walk(node: unknown) {
    if (!node || typeof node !== 'object') return;
    const n = node as { type?: string; attrs?: { src?: string }; content?: unknown[] };
    if (n.type === 'image' && n.attrs?.src) urls.add(n.attrs.src);
    n.content?.forEach(walk);
  }
  walk(value);
  return [...urls];
}
async function boundedImage(url: string) {
  const response = await fetch(url, {
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    signal: AbortSignal.timeout(20_000),
  });
  const mime = response.headers.get('content-type')?.split(';')[0] ?? '';
  if (
    !response.ok ||
    !['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'].includes(mime) ||
    !response.body
  )
    throw new Error('Image inaccessible ou format non pris en charge.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_ASSET_BYTES) throw new Error('Image trop volumineuse (3 Mo maximum).');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return { mime, bytes: [...bytes] };
}
export async function downloadModule(slug: string, progress: (message: string) => void) {
  if (active.has(slug)) throw new Error('Téléchargement déjà en cours.');
  active.add(slug);
  try {
    await assertOnlineOwner();
    progress('Téléchargement du texte…');
    const pkg = await apiFetch(
      `/modules/${encodeURIComponent(slug)}/offline-package`,
      offlineModulePackageSchema,
    );
    if ((await sha256(JSON.stringify(pkg.content))) !== pkg.digest)
      throw new Error('Empreinte du paquet incorrecte. Recommencez le téléchargement.');
    const previous = await readRecord<DownloadedModule>(`module:${slug}`);
    if (previous?.value.package.versionId === pkg.versionId) {
      progress('Cette version est déjà disponible hors ligne.');
      return;
    }
    const sources = [...new Set(pkg.content.lessons.flatMap((l) => imageSources(l.content)))];
    const assets: DownloadedModule['assets'] = {};
    let estimatedBytes = new TextEncoder().encode(JSON.stringify(pkg)).length;
    if (estimatedBytes > MAX_PACKAGE_BYTES)
      throw new Error('Module trop volumineux (30 Mo maximum).');
    const estimate = await navigator.storage?.estimate?.();
    if (
      estimate?.quota &&
      estimate.usage !== undefined &&
      estimate.quota - estimate.usage < estimatedBytes * 8
    )
      throw new Error('Espace local insuffisant.');
    for (const [index, url] of sources.entries()) {
      progress(`Image ${index + 1}/${sources.length}…`);
      // Une image obligatoire en échec invalide le téléchargement. L'ancienne version reste intacte.
      const asset = await boundedImage(url);
      estimatedBytes += asset.bytes.length;
      if (estimatedBytes > MAX_PACKAGE_BYTES)
        throw new Error('Module trop volumineux (30 Mo maximum).');
      assets[url] = asset;
    }
    const resources = [
      ...pkg.content.resources,
      ...pkg.content.lessons.flatMap((l) => l.resources),
    ];
    const value: DownloadedModule = {
      package: pkg,
      assets,
      estimatedBytes,
      unavailable: resources.map((r) => `${r.title} : ressource externe indisponible hors ligne`),
      downloadedAt: new Date().toISOString(),
      lastReadAt: null,
      lessonIndex: 0,
    };
    // Écrans habituels du module et de ses leçons : copies conservées par le dépôt local.
    progress('Leçons…');
    const detail = await apiFetch(
      `/modules/${encodeURIComponent(slug)}`,
      catalogModuleDetailSchema,
    );
    for (const lesson of detail.lessons)
      await apiFetch(
        `/modules/${encodeURIComponent(slug)}/lessons/${lesson.id}`,
        catalogLessonSchema,
      );
    await writeRecord(`module:${slug}`, value, previous?.revision ?? 0);
    progress('Disponible hors ligne. Les ressources externes nécessitent une connexion.');
  } finally {
    active.delete(slug);
  }
}
export async function listDownloads() {
  const ids = await recordIds('module:');
  return (await Promise.all(ids.map((id) => readRecord<DownloadedModule>(id)))).flatMap((row) =>
    row ? [row.value] : [],
  );
}
export async function removeDownload(slug: string) {
  const owner = ownerId();
  if (!owner) throw new Error('Données verrouillées.');
  await dbDelete('records', `${owner}:module:${slug}`);
  window.dispatchEvent(new Event('offline-data-change'));
}

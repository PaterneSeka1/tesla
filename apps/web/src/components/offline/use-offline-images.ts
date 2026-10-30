'use client';

import { useEffect, useState } from 'react';
import { type DownloadedModule } from '@/lib/offline/downloads';
import { ownerId, putRecord, readRecord } from '@/lib/offline/vault';

/**
 * Hors connexion, images d'un module téléchargé (URL locales temporaires) ; `undefined` en ligne
 * ou si le module n'a pas été téléchargé avec ses images (les images restent alors absentes).
 */
export function useOfflineImages(slug: string): Record<string, string> | undefined {
  const [images, setImages] = useState<Record<string, string>>();
  useEffect(() => {
    if (navigator.onLine || !ownerId()) return;
    const urls: string[] = [];
    let cancelled = false;
    void readRecord<DownloadedModule>(`module:${slug}`)
      .then((row) => {
        if (cancelled || !row) return;
        setImages(
          Object.fromEntries(
            Object.entries(row.value.assets).map(([src, asset]) => {
              const url = URL.createObjectURL(
                new Blob([new Uint8Array(asset.bytes)], { type: asset.mime }),
              );
              urls.push(url);
              return [src, url];
            }),
          ),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [slug]);
  return images;
}

/** Position de lecture conservée sur l'appareil (jamais un acquis, jamais envoyée au serveur). */
export function useReadingPosition(slug: string, lessonId: string | undefined) {
  useEffect(() => {
    if (!lessonId || !ownerId()) return;
    void putRecord(`reading:${slug}`, { lessonId, readAt: new Date().toISOString() }).catch(
      () => {},
    );
  }, [slug, lessonId]);
}

export async function readingPosition(slug: string) {
  if (!ownerId()) return null;
  return (
    (await readRecord<{ lessonId: string; readAt: string }>(`reading:${slug}`).catch(() => null))
      ?.value ?? null
  );
}

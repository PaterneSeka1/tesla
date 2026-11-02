'use client';

import { useEffect, useState } from 'react';
import { type DownloadedModule } from '@/lib/offline/downloads';
import { ensureVaultRestored, ownerId, putRecord, readRecord } from '@/lib/offline/vault';

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
export interface LastReading {
  slug: string;
  moduleTitle: string;
  lessonId: string;
  lessonTitle: string;
  readAt: string;
}

/**
 * Position de lecture par module et dernière leçon ouverte (coffre chiffré de cet appareil, propre
 * à la personne connectée) : sert à « Reprendre la lecture » sur l'accueil.
 */
export function useReadingPosition(
  slug: string,
  lessonId: string | undefined,
  titles?: { module: string; lesson: string },
) {
  const moduleTitle = titles?.module;
  const lessonTitle = titles?.lesson;
  useEffect(() => {
    if (!lessonId || !ownerId()) return;
    const readAt = new Date().toISOString();
    void putRecord(`reading:${slug}`, { lessonId, readAt }).catch(() => {});
    if (moduleTitle && lessonTitle) {
      const last: LastReading = { slug, moduleTitle, lessonId, lessonTitle, readAt };
      void putRecord('reading:last', last).catch(() => {});
    }
  }, [slug, lessonId, moduleTitle, lessonTitle]);
}

export async function lastReading(): Promise<LastReading | null> {
  if (!ownerId()) return null;
  return (await readRecord<LastReading>('reading:last').catch(() => null))?.value ?? null;
}

export async function readingPosition(slug: string) {
  await ensureVaultRestored();
  if (!ownerId()) return null;
  return (
    (await readRecord<{ lessonId: string; readAt: string }>(`reading:${slug}`).catch(() => null))
      ?.value ?? null
  );
}

'use client';
import { useEffect, useState } from 'react';
import { LessonContent } from '@/components/modules/lesson-content';
import { Button } from '@/components/ui/button';
import { type DownloadedModule } from '@/lib/offline/downloads';
import { readRecord, writeRecord } from '@/lib/offline/vault';
export function OfflineReader({ slug }: { slug: string }) {
  const [item, setItem] = useState<DownloadedModule | null>(null);
  const [assets, setAssets] = useState<Record<string, string>>({});
  const [error, setError] = useState('Chargement…');
  useEffect(() => {
    const urls: string[] = [];
    let cancelled = false;
    void readRecord<DownloadedModule>(`module:${slug}`)
      .then((row) => {
        if (cancelled) return;
        if (!row) {
          setError('Module non téléchargé ou téléchargement interrompu. Recommencez en ligne.');
          return;
        }
        setItem(row.value);
        const images = Object.fromEntries(
          Object.entries(row.value.assets).map(([src, asset]) => {
            const url = URL.createObjectURL(
              new Blob([new Uint8Array(asset.bytes)], { type: asset.mime }),
            );
            urls.push(url);
            return [src, url];
          }),
        );
        setAssets(images);
      })
      .catch((e) => setError(e.message));
    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [slug]);
  async function navigate(index: number) {
    try {
      const row = await readRecord<DownloadedModule>(`module:${slug}`);
      if (!row) return;
      const value = { ...row.value, lessonIndex: index, lastReadAt: new Date().toISOString() };
      await writeRecord(`module:${slug}`, value, row.revision);
      setItem(value);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Position non enregistrée.');
    }
  }
  if (!item) return <p role="status">{error}</p>;
  const content = item.package.content;
  const index = Math.min(item.lessonIndex, content.lessons.length - 1);
  const lesson = content.lessons[index];
  return (
    <article className="space-y-4">
      <h2 className="text-2xl font-semibold">{content.title}</h2>
      <p>
        Disponible hors ligne · version {content.version} ·{' '}
        {item.estimatedBytes.toLocaleString('fr-FR')} octets estimés
      </p>
      <p>{content.summary}</p>
      <ul className="list-disc pl-5">
        {content.objectives.map((o, i) => (
          <li key={i}>{o}</li>
        ))}
      </ul>
      {lesson && (
        <>
          <h3 className="text-xl font-semibold">{lesson.title}</h3>
          <LessonContent document={lesson.content} offlineImages={assets} />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={index <= 0}
              onClick={() => void navigate(index - 1)}
            >
              Leçon précédente
            </Button>
            <Button
              variant="outline"
              disabled={index >= content.lessons.length - 1}
              onClick={() => void navigate(index + 1)}
            >
              Leçon suivante
            </Button>
          </div>
          <nav aria-label="Leçons téléchargées" className="flex flex-wrap gap-2">
            {content.lessons.map((l, i) => (
              <Button
                key={l.id}
                variant="ghost"
                aria-current={index === i ? 'page' : undefined}
                onClick={() => void navigate(i)}
              >
                {l.title}
              </Button>
            ))}
          </nav>
        </>
      )}
      {error && error !== 'Chargement…' && <p role="alert">{error}</p>}
      <ul>
        {item.unavailable.map((r, i) => (
          <li key={i} className="text-sm text-muted-foreground">
            {r}
          </li>
        ))}
      </ul>
      <p className="text-sm">
        Les liens et références externes nécessitent une connexion. La lecture ne constitue pas une
        validation d’acquis.
      </p>
    </article>
  );
}

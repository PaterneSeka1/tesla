'use client';

import { useQuery } from '@tanstack/react-query';
import {
  type CeremonyItem,
  ceremonyRoles,
  hasDialogue,
  type LessonDocument,
  parseCeremony,
  preparationPoints,
  type ReferenceAmbiance,
} from '@tesla/shared';
import {
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  Presentation,
  Printer,
  ScrollText,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { BackLink } from '@/components/back-link';
import { DownloadModuleButton } from '@/components/download-module-button';
import { EmptyState } from '@/components/empty-state';
import { LessonContent } from '@/components/modules/lesson-content';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { CeremonyStage } from '@/components/reference/ceremony-stage';
import { CeremonyView } from '@/components/reference/ceremony-view';
import { PrayerView } from '@/components/reference/prayer-view';
import { Button } from '@/components/ui/button';
import { catalogModuleQueryOptions, printableModuleQueryOptions } from '@/lib/api/modules';
import { referenceCatalogQueryOptions } from '@/lib/api/reference';
import { cn } from '@/lib/utils';
import { entryHref } from '../reference-catalog';

const SIZES = [0.95, 1.05, 1.2, 1.35, 1.55] as const;
const SIZE_KEY = 'referentiel:taille';

function readStoredSize(): number {
  if (typeof window === 'undefined') return 1;
  try {
    const raw = localStorage.getItem(SIZE_KEY);
    const stored = Number(raw);
    return raw !== null && Number.isInteger(stored) && stored >= 0 && stored < SIZES.length
      ? stored
      : 1;
  } catch {
    // Préférence indisponible : taille par défaut.
    return 1;
  }
}

function useTextSize() {
  const [size, setSize] = useState(readStoredSize);
  const update = (next: number) => {
    setSize(next);
    try {
      localStorage.setItem(SIZE_KEY, String(next));
    } catch {
      // idem
    }
  };
  return [size, update] as const;
}

interface Lesson {
  id: string;
  title: string;
  content: LessonDocument;
}

/**
 * Lecture d'une ressource du référentiel. Le contenu est celui du module publié (même source que la
 * bibliothèque, aucune copie) ; il reste consultable hors ligne une fois chargé ou téléchargé.
 * Aucune lecture n'est enregistrée (ni XP, ni statistique) et rien ici ne vaut cérémonie réelle.
 */
export function ReferenceReader() {
  const { entryId } = useParams<{ entryId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const catalog = useQuery(referenceCatalogQueryOptions(''));
  const found =
    (catalog.data?.categories ?? [])
      .map((category) => ({
        category,
        entry: category.entries.find((item) => item.id === entryId),
      }))
      .find((match) => match.entry !== undefined) ?? null;
  const slug = found?.entry?.moduleSlug ?? '';
  const printable = useQuery({ ...printableModuleQueryOptions(slug), enabled: !!slug });
  const detail = useQuery({ ...catalogModuleQueryOptions(slug), enabled: !!slug });
  const [size, setSize] = useTextSize();

  if (catalog.error)
    return <QueryError error={catalog.error} onRetry={() => void catalog.refetch()} />;
  if (catalog.isPending) return <TableSkeleton rows={6} />;
  if (!found) {
    return (
      <>
        <BackLink href="/referentiel">Référentiel scout</BackLink>
        <EmptyState icon={ScrollText} title="Cette ressource n’est pas disponible." />
      </>
    );
  }
  if (printable.error) {
    return <QueryError error={printable.error} onRetry={() => void printable.refetch()} />;
  }
  if (printable.isPending) return <TableSkeleton rows={6} />;

  const { category } = found;
  const entry = found.entry!;
  const lessons: Lesson[] = printable.data.lessons
    .filter((lesson) => !entry.lessonId || lesson.id === entry.lessonId)
    .map((lesson) => ({ id: lesson.id, title: lesson.title, content: lesson.content }));
  const requested = searchParams.get('fiche');
  const selectedIndex =
    lessons.length === 1 ? 0 : lessons.findIndex((lesson) => lesson.id === requested);
  const selected = selectedIndex >= 0 ? lessons[selectedIndex]! : null;
  const integral = searchParams.get('integral') === '1';
  const linkedTexts = (detail.data?.texts ?? []).map((text) => {
    const target = catalog.data.categories
      .flatMap((item) => item.entries)
      .find((item) => item.moduleSlug === text.slug && !item.lessonId);
    return { ...text, href: target ? entryHref(target) : `/modules/${text.slug}` };
  });

  return (
    <article className="space-y-5" style={{ fontSize: `${SIZES[size]}rem` }}>
      <div className="space-y-2 text-base">
        <BackLink href={selected && lessons.length > 1 ? entryHref(entry) : '/referentiel'}>
          {selected && lessons.length > 1 ? entry.title : category.title}
        </BackLink>
        <div className="flex items-start gap-2">
          <h1 className="min-w-0 flex-1 text-2xl font-semibold tracking-tight text-tesla-bordeaux">
            {selected?.title ?? entry.title}
          </h1>
          <div className="flex shrink-0 items-center" role="group" aria-label="Taille du texte">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={size === 0}
              onClick={() => setSize(size - 1)}
              aria-label="Réduire le texte"
            >
              <Minus aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={size === SIZES.length - 1}
              onClick={() => setSize(size + 1)}
              aria-label="Agrandir le texte"
            >
              <Plus aria-hidden />
            </Button>
          </div>
        </div>
      </div>

      {selected ? (
        <LessonPanel lesson={selected} ambiance={category.ambiance} />
      ) : integral ? (
        <div className="space-y-10">
          {lessons.map((lesson) => (
            <section key={lesson.id} aria-labelledby={`fiche-${lesson.id}`} className="space-y-3">
              <h2
                id={`fiche-${lesson.id}`}
                className="border-b border-tesla-or/50 pb-1 text-xl font-semibold text-tesla-bordeaux"
              >
                {lesson.title}
              </h2>
              <LessonBody lesson={lesson} ambiance={category.ambiance} />
            </section>
          ))}
        </div>
      ) : (
        <nav aria-label="Parties" className="space-y-3 text-base">
          {entry.summary && <p className="text-muted-foreground">{entry.summary}</p>}
          <ol className="divide-y overflow-hidden rounded-xl border bg-white">
            {lessons.map((lesson, index) => (
              <li key={lesson.id}>
                <Link
                  href={entryHref(entry, lesson.id)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-tesla-sable/30 focus-visible:bg-tesla-sable/30 focus-visible:outline-none"
                >
                  <span className="w-6 text-right text-sm text-muted-foreground tabular-nums">
                    {index + 1}
                  </span>
                  <span className="flex-1">{lesson.title}</span>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ol>
          <Button asChild variant="outline">
            <Link href={`/referentiel/${entry.id}?integral=1`}>Lecture intégrale</Link>
          </Button>
        </nav>
      )}

      {selected && lessons.length > 1 && (
        <nav aria-label="Fiches" className="flex justify-between gap-2 text-base">
          <Button
            type="button"
            variant="outline"
            disabled={selectedIndex === 0}
            onClick={() => router.push(entryHref(entry, lessons[selectedIndex - 1]!.id))}
          >
            <ChevronLeft aria-hidden />
            Précédente
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={selectedIndex === lessons.length - 1}
            onClick={() => router.push(entryHref(entry, lessons[selectedIndex + 1]!.id))}
          >
            Suivante
            <ChevronRight aria-hidden />
          </Button>
        </nav>
      )}

      {linkedTexts.length > 0 && (
        <section className="space-y-1 text-base">
          <h2 className="text-sm font-semibold tracking-wide text-tesla-bordeaux uppercase">
            À retrouver aussi
          </h2>
          <ul className="space-y-1">
            {linkedTexts.map((text) => (
              <li key={text.slug}>
                <Link href={text.href} className="text-tesla-rouge underline underline-offset-4">
                  {text.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="flex flex-wrap items-center gap-2 border-t pt-4 text-base">
        <DownloadModuleButton slug={entry.moduleSlug} />
        <Button asChild variant="ghost" size="sm">
          <Link href={`/modules/${entry.moduleSlug}/imprimer`}>
            <Printer aria-hidden />
            Imprimer
          </Link>
        </Button>
      </footer>
    </article>
  );
}

/** Corps d'une fiche selon son contenu réel (dialogue, prière, texte avec ou sans enregistrement). */
function LessonBody({ lesson, ambiance }: { lesson: Lesson; ambiance: ReferenceAmbiance }) {
  const items = useMemo(() => parseCeremony(lesson.content), [lesson.content]);
  if (hasDialogue(lesson.content)) return <CeremonyView items={items} />;
  if (ambiance === 'RECUEILLI') return <PrayerView document={lesson.content} />;
  return <LessonContent document={lesson.content} />;
}

type CeremonyMode = 'lecture' | 'role' | 'preparation';

function LessonPanel({ lesson, ambiance }: { lesson: Lesson; ambiance: ReferenceAmbiance }) {
  const items = useMemo(() => parseCeremony(lesson.content), [lesson.content]);
  if (!hasDialogue(lesson.content)) return <LessonBody lesson={lesson} ambiance={ambiance} />;
  return <CeremonyPanel lesson={lesson} items={items} />;
}

/** Cérémonie : lecture, « Mon rôle », préparation et mode cérémonie (aucune validation). */
function CeremonyPanel({ lesson, items }: { lesson: Lesson; items: CeremonyItem[] }) {
  const roles = useMemo(() => ceremonyRoles(items), [items]);
  const points = useMemo(() => preparationPoints(items), [items]);
  const [mode, setMode] = useState<CeremonyMode>('lecture');
  const [role, setRole] = useState<string | null>(null);
  const [stage, setStage] = useState(false);
  const tabs: { value: CeremonyMode; label: string }[] = [
    { value: 'lecture', label: 'Lecture' },
    { value: 'role', label: 'Mon rôle' },
    ...(points.length > 0 ? [{ value: 'preparation' as const, label: 'Préparation' }] : []),
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-base">
        <div role="group" aria-label="Affichage" className="flex flex-wrap gap-1">
          {tabs.map((tab) => (
            <Button
              key={tab.value}
              type="button"
              size="sm"
              variant={mode === tab.value ? 'default' : 'outline'}
              aria-pressed={mode === tab.value}
              onClick={() => setMode(tab.value)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={() => setStage(true)}>
          <Presentation aria-hidden />
          Mode cérémonie
        </Button>
      </div>
      {mode === 'role' && (
        <div className="space-y-2 text-base">
          <label htmlFor={`role-${lesson.id}`} className="text-sm font-medium">
            Mon rôle dans cette cérémonie
          </label>
          <select
            id={`role-${lesson.id}`}
            value={role ?? ''}
            onChange={(event) => setRole(event.target.value || null)}
            className="block h-10 w-full max-w-sm rounded-md border bg-white px-3"
          >
            <option value="">Choisir…</option>
            {roles.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      )}
      {mode === 'preparation' ? (
        <PreparationList key={lesson.id} lessonId={lesson.id} points={points} />
      ) : (
        <CeremonyView items={items} role={mode === 'role' ? role : null} />
      )}
      {stage && (
        <CeremonyStage
          title={lesson.title}
          storageKey={lesson.id}
          items={items}
          role={mode === 'role' ? role : null}
          onClose={() => setStage(false)}
        />
      )}
    </div>
  );
}

/**
 * Points de préparation réellement écrits dans la cérémonie, cochables sur cet appareil seulement :
 * une aide personnelle, jamais une validation de la cérémonie.
 */
function readChecked(key: string): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(stored) ? stored.filter((value) => Number.isInteger(value)) : [];
  } catch {
    return [];
  }
}

function PreparationList({ lessonId, points }: { lessonId: string; points: string[] }) {
  const key = `referentiel:preparation:${lessonId}`;
  const [checked, setChecked] = useState<number[]>(() => readChecked(key));
  const toggle = (index: number) => {
    const next = checked.includes(index)
      ? checked.filter((value) => value !== index)
      : [...checked, index];
    setChecked(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Liste non conservée (stockage indisponible).
    }
  };
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Liste personnelle, conservée sur cet appareil.
      </p>
      <ul className="space-y-2">
        {points.map((point, index) => (
          <li key={index}>
            <label
              className={cn(
                'flex gap-3 rounded-lg border bg-white px-3 py-2',
                checked.includes(index) && 'bg-tesla-sable/30 text-muted-foreground',
              )}
            >
              <input
                type="checkbox"
                checked={checked.includes(index)}
                onChange={() => toggle(index)}
                className="mt-1.5 accent-tesla-rouge"
              />
              <span>{point}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

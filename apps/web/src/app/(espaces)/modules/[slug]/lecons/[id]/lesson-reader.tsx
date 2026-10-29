'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Clock } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { BackLink } from '@/components/back-link';
import { LessonContent } from '@/components/modules/lesson-content';
import { ResourceList } from '@/components/modules/resource-list';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { catalogLessonQueryOptions } from '@/lib/api/modules';
import { formatDuration } from '@/lib/format';

/** Lecteur de cours : une leçon à la fois, navigation précédente / suivante. */
export function LessonReader() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const { data, error, isPending, refetch } = useQuery(catalogLessonQueryOptions(slug, id));

  if (isPending) return <TableSkeleton rows={6} />;
  if (error) return <QueryError error={error} onRetry={() => void refetch()} />;

  const { module, lesson, previous, next, lessonCount } = data;
  const progress = Math.round(((lesson.position + 1) / lessonCount) * 100);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink href={`/modules/${module.slug}`}>{module.title}</BackLink>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Leçon {lesson.position + 1} sur {lessonCount}
        </p>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Position dans le module"
          aria-valuenow={lesson.position + 1}
          aria-valuemin={1}
          aria-valuemax={lessonCount}
        >
          <div className="h-full bg-tesla-or" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <article className="space-y-6 rounded-lg border bg-white p-5 sm:p-8">
        <header className="space-y-1 border-b pb-4">
          <h2 className="text-2xl font-semibold tracking-tight text-tesla-bordeaux">
            {lesson.title}
          </h2>
          {lesson.durationMinutes && (
            <p className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="size-4" aria-hidden />
              {formatDuration(lesson.durationMinutes)}
            </p>
          )}
        </header>
        <div className="text-[1.05rem]">
          <LessonContent document={lesson.content} />
        </div>
        {lesson.resources.length > 0 && (
          <section className="space-y-2 border-t pt-4">
            <h3 className="font-semibold">Pour aller plus loin</h3>
            <ResourceList resources={lesson.resources} />
          </section>
        )}
      </article>
      <nav aria-label="Leçons" className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        {previous ? (
          <Button asChild variant="outline" className="h-auto justify-start py-2 whitespace-normal">
            <Link href={`/modules/${module.slug}/lecons/${previous.id}`}>
              <ArrowLeft aria-hidden />
              <span className="text-left">
                <span className="block text-xs text-muted-foreground">Précédente</span>
                {previous.title}
              </span>
            </Link>
          </Button>
        ) : (
          <span />
        )}
        {next ? (
          <Button asChild className="h-auto justify-end py-2 whitespace-normal">
            <Link href={`/modules/${module.slug}/lecons/${next.id}`}>
              <span className="text-right">
                <span className="block text-xs opacity-80">Suivante</span>
                {next.title}
              </span>
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button asChild variant="secondary">
            <Link href={`/modules/${module.slug}`}>Fin du module — retour au sommaire</Link>
          </Button>
        )}
      </nav>
    </div>
  );
}

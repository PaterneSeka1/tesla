'use client';

import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { useParams } from 'next/navigation';
import { BackLink } from '@/components/back-link';
import { BrandLogo } from '@/components/brand-logo';
import { LessonContent } from '@/components/modules/lesson-content';
import { ResourceList } from '@/components/modules/resource-list';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { printableModuleQueryOptions } from '@/lib/api/modules';
import { formatDate, formatDuration } from '@/lib/format';

/**
 * Support de cours A4 (impression navigateur, styles `@media print`). Contenu de la version publiée
 * uniquement ; un module ne contient aucun corrigé.
 */
export function PrintableModule() {
  const { slug } = useParams<{ slug: string }>();
  const { data: module, error, isPending, refetch } = useQuery(printableModuleQueryOptions(slug));

  if (isPending) return <TableSkeleton rows={6} />;
  if (error) return <QueryError error={error} onRetry={() => void refetch()} />;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <BackLink href={`/modules/${module.slug}`}>Retour au module</BackLink>
        <Button onClick={() => window.print()}>
          <Printer aria-hidden />
          Imprimer
        </Button>
      </div>
      <article className="print-sheet mx-auto max-w-[210mm] space-y-6 bg-white p-6 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-center gap-4 border-b-2 border-tesla-bordeaux pb-4">
          <BrandLogo size={56} />
          <div className="flex-1">
            <p className="text-sm font-semibold text-tesla-bordeaux">
              Communauté Nikola Tesla — Branche Route
            </p>
            <p className="text-xs text-muted-foreground">
              Nikola Tesla Académie · support de cours
            </p>
          </div>
          <p className="text-right text-xs text-muted-foreground">
            {module.code} · version {module.version}
            <br />
            publiée le {formatDate(module.publishedAt)}
          </p>
        </header>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-tesla-bordeaux">{module.title}</h2>
          <p className="text-sm text-muted-foreground">
            {module.stage ? `Étape recommandée : ${module.stage.name}` : 'Toutes les étapes'}
            {module.theme && ` · ${module.theme}`}
            {module.durationMinutes && ` · ${formatDuration(module.durationMinutes)}`}
          </p>
          {module.summary && <p className="whitespace-pre-line">{module.summary}</p>}
        </div>
        {module.objectives.length > 0 && (
          <section className="space-y-1 break-inside-avoid">
            <h3 className="font-semibold">Objectifs pédagogiques</h3>
            <ul className="list-disc pl-6">
              {module.objectives.map((objective, index) => (
                <li key={index}>{objective}</li>
              ))}
            </ul>
          </section>
        )}
        {module.prerequisites && (
          <section className="space-y-1 break-inside-avoid">
            <h3 className="font-semibold">Prérequis</h3>
            <p className="whitespace-pre-line">{module.prerequisites}</p>
          </section>
        )}
        {module.lessons.map((lesson, index) => (
          <section key={lesson.id} className="space-y-3 border-t pt-4 print:break-before-page">
            <h3 className="text-xl font-semibold text-tesla-bordeaux">
              Leçon {index + 1} — {lesson.title}
            </h3>
            <LessonContent document={lesson.content} />
            {lesson.resources.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-sm font-semibold">Références</h4>
                <ResourceList resources={lesson.resources} />
              </div>
            )}
          </section>
        ))}
        {module.resources.length > 0 && (
          <section className="space-y-2 border-t pt-4 break-inside-avoid">
            <h3 className="font-semibold">Références du module</h3>
            <ResourceList resources={module.resources} />
          </section>
        )}
        <footer className="border-t pt-2 text-center text-xs text-muted-foreground">
          {module.code} · version {module.version} — document destiné aux routiers, sans corrigé.
        </footer>
      </article>
    </>
  );
}

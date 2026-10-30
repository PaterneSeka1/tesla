'use client';

import { useQuery } from '@tanstack/react-query';
import { BookOpenText, Clock, FileDown, Printer, ScrollText, Sparkles, Target } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { DownloadModuleButton } from '@/components/download-module-button';
import { BackLink } from '@/components/back-link';
import { ResourceList } from '@/components/modules/resource-list';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { catalogModuleQueryOptions, modulePdfUrl } from '@/lib/api/modules';
import { formatDate, formatDuration } from '@/lib/format';

export function ModuleDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: module, error, isPending, refetch } = useQuery(catalogModuleQueryOptions(slug));

  if (isPending) return <TableSkeleton rows={5} />;
  if (error) return <QueryError error={error} onRetry={() => void refetch()} />;

  const recommended = module.myStageId !== null && module.stage?.id === module.myStageId;
  const first = module.lessons[0];

  return (
    <>
      <BackLink href="/modules">Bibliothèque</BackLink>
      <header className="space-y-3 rounded-lg bg-tesla-bordeaux p-5 text-white sm:p-6">
        <div className="flex flex-wrap gap-2">
          {module.stage && <Badge variant="accent">Étape recommandée : {module.stage.name}</Badge>}
          {module.theme && <Badge variant="secondary">{module.theme}</Badge>}
          {recommended && (
            <Badge variant="accent">
              <Sparkles aria-hidden />
              Votre étape
            </Badge>
          )}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{module.title}</h1>
        {module.summary && (
          <p className="max-w-3xl whitespace-pre-line text-tesla-sable">{module.summary}</p>
        )}
        <p className="flex flex-wrap gap-4 text-sm text-tesla-sable">
          <span>
            {module.lessons.length} leçon{module.lessons.length > 1 ? 's' : ''}
          </span>
          {module.durationMinutes && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-4" aria-hidden />
              {formatDuration(module.durationMinutes)}
            </span>
          )}
          <span>
            Version {module.version} · publiée le {formatDate(module.publishedAt)}
          </span>
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {first && (
            <Button asChild variant="secondary">
              <Link href={`/modules/${module.slug}/lecons/${first.id}`}>
                <BookOpenText aria-hidden />
                Commencer la lecture
              </Link>
            </Button>
          )}
          <Button
            asChild
            variant="outline"
            className="border-tesla-sable bg-transparent text-white hover:bg-white/10"
          >
            <a href={modulePdfUrl(module.slug)} download>
              <FileDown aria-hidden />
              Télécharger le cours (PDF)
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-tesla-sable bg-transparent text-white hover:bg-white/10"
          >
            <Link href={`/modules/${module.slug}/imprimer`}>
              <Printer aria-hidden />
              Version imprimable
            </Link>
          </Button>
        </div>
      </header>

      <DownloadModuleButton slug={module.slug} />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader>
            <CardTitle>Leçons</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {module.lessons.map((lesson, index) => (
                <li key={lesson.id}>
                  <Link
                    href={`/modules/${module.slug}/lecons/${lesson.id}`}
                    className="flex items-center gap-3 rounded-md border p-3 transition-colors hover:border-tesla-or focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-tesla-sable font-semibold text-tesla-bordeaux">
                      {index + 1}
                    </span>
                    <span className="flex-1 font-medium">{lesson.title}</span>
                    {lesson.durationMinutes && (
                      <span className="text-xs text-muted-foreground">
                        {formatDuration(lesson.durationMinutes)}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
        <div className="space-y-6">
          {module.objectives.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="size-4 text-tesla-rouge" aria-hidden />
                  Objectifs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {module.objectives.map((objective, index) => (
                    <li key={index}>{objective}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {module.texts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ScrollText className="size-4 text-tesla-rouge" aria-hidden />
                  Textes fondamentaux
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {module.texts.map((text) => (
                    <li key={text.slug}>
                      <Link
                        href={`/modules/${text.slug}`}
                        className="font-medium text-tesla-bordeaux underline-offset-4 hover:underline"
                      >
                        {text.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {module.prerequisites && (
            <Card>
              <CardHeader>
                <CardTitle>Prérequis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-line">{module.prerequisites}</p>
              </CardContent>
            </Card>
          )}
          {module.resources.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Ressources</CardTitle>
              </CardHeader>
              <CardContent>
                <ResourceList resources={module.resources} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

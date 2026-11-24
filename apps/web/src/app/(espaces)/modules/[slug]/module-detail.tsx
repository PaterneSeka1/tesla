'use client';

import { useQuery } from '@tanstack/react-query';
import { lessonReadRef } from '@tesla/shared';
import {
  ArrowRight,
  ClipboardList,
  Clock,
  Ellipsis,
  FileDown,
  Printer,
  ScrollText,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSessionUser } from '@/components/auth/session-gate';
import { readingPosition } from '@/components/offline/use-offline-images';
import { DownloadModuleButton } from '@/components/download-module-button';
import { BackLink } from '@/components/back-link';
import { ResourceList } from '@/components/modules/resource-list';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AdventureTrail } from '@/components/modules/adventure-trail';
import { journalQueryOptions, practiceBankQueryOptions } from '@/lib/api/practice';
import { catalogModuleQueryOptions, modulePdfUrl, practicalSheetPdfUrl } from '@/lib/api/modules';
import { formatDate, formatDuration } from '@/lib/format';
import { flattenBank, playableModes } from '@/lib/games';
import { userCan } from '@/lib/navigation';
import { type ReadingPosition, resumeLesson } from '@/lib/reading-position';

export function ModuleDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: module, error, isPending, refetch } = useQuery(catalogModuleQueryOptions(slug));
  const user = useSessionUser();
  const distribute = userCan(user, 'attempt.preparePaper');
  const journal = useQuery({ ...journalQueryOptions, enabled: userCan(user, 'practice.own') });
  const bank = useQuery({ ...practiceBankQueryOptions, enabled: userCan(user, 'practice.play') });
  // Dernière leçon lue sur cet appareil (coffre local ; absente si verrouillé).
  const [last, setLast] = useState<ReadingPosition | null>(null);
  useEffect(() => {
    let active = true;
    void readingPosition(slug)
      .then((position) => {
        if (active) setLast(position);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [slug]);

  if (isPending) return <TableSkeleton rows={5} />;
  if (error) return <QueryError error={error} onRetry={() => void refetch()} />;

  const recommended = module.myStageId !== null && module.stage?.id === module.myStageId;
  const resumed = resumeLesson(module.lessons, last);
  const first = resumed ?? module.lessons[0];
  const readIds = new Set(journal.data?.readLessonIds ?? []);
  const readRefs = new Set(journal.data?.readLessons ?? []);
  const moduleEntries = bank.data ? flattenBank(bank.data, module.slug) : [];

  return (
    <>
      <BackLink href="/modules">Bibliothèque</BackLink>
      <header className="space-y-3 rounded-lg bg-tesla-bordeaux p-5 text-white sm:p-6">
        <div className="flex flex-wrap gap-2">
          {module.stage && (
            <Badge variant="accent">
              {recommended && <Sparkles aria-hidden />}
              Étape recommandée : {module.stage.name}
              {recommended && ' · votre étape'}
            </Badge>
          )}
          {module.theme && <Badge variant="secondary">{module.theme}</Badge>}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{module.title}</h1>
        {module.summary && (
          <p className="max-w-3xl whitespace-pre-line text-tesla-sable">{module.summary}</p>
        )}
        <p className="flex flex-wrap gap-4 text-sm text-tesla-sable">
          <span>
            {module.lessons.length} halte{module.lessons.length > 1 ? 's' : ''}
          </span>
          {module.durationMinutes && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-4" aria-hidden />
              {formatDuration(module.durationMinutes)}
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {first && (
            <Button
              asChild
              size="lg"
              className="bg-tesla-or text-tesla-bordeaux hover:bg-tesla-or/90"
            >
              <Link href={`/modules/${module.slug}/lecons/${first.id}`}>
                {resumed ? 'Reprendre' : 'Commencer'}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          )}
          {/* Actions secondaires regroupées : une seule action principale à l'écran. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="lg"
                className="text-tesla-sable hover:bg-white/10 hover:text-white"
              >
                <Ellipsis aria-hidden />
                Plus
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem asChild>
                <a href={modulePdfUrl(module.slug)} download>
                  <FileDown aria-hidden />
                  Télécharger le cours (PDF)
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/modules/${module.slug}/imprimer`}>
                  <Printer aria-hidden />
                  Version imprimable
                </Link>
              </DropdownMenuItem>
              {distribute && (
                <DropdownMenuItem asChild>
                  <Link href={`/encadrement/distribution/${module.slug}`}>
                    <Users aria-hidden />
                    Préparer une distribution
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <DownloadModuleButton slug={module.slug} />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <AdventureTrail
          stops={module.lessons.map((lesson) => ({
            id: lesson.id,
            title: lesson.title,
            href: `/modules/${module.slug}/lecons/${lesson.id}`,
            durationMinutes: lesson.durationMinutes,
            done: readIds.has(lesson.id) || readRefs.has(lessonReadRef(module.slug, lesson.title)),
            current: lesson.id === resumed?.id,
          }))}
          practiceHref={
            playableModes(moduleEntries).some((mode) => mode.group)
              ? `/defis?module=${encodeURIComponent(module.slug)}`
              : null
          }
        />
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
          {module.practicalSheets.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="size-4 text-tesla-rouge" aria-hidden />
                  Fiches pratiques
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {module.practicalSheets.map((sheet) => (
                    <li key={sheet.key}>
                      <a
                        href={practicalSheetPdfUrl(module.slug, sheet.key)}
                        download
                        className="group flex items-start gap-2 rounded-md p-1 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        <FileDown
                          className="mt-0.5 size-4 shrink-0 text-tesla-bordeaux"
                          aria-hidden
                        />
                        <span className="min-w-0">
                          <span className="font-medium text-tesla-bordeaux underline-offset-4 group-hover:underline">
                            {sheet.title}
                          </span>
                          <span className="block text-muted-foreground">{sheet.purpose}</span>
                        </span>
                      </a>
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
      <p className="text-xs text-muted-foreground">
        Version {module.version} · publiée le {formatDate(module.publishedAt)}
      </p>
    </>
  );
}

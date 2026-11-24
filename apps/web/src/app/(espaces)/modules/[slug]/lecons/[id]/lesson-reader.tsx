'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type CatalogLesson, type RewardSummary } from '@tesla/shared';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Check,
  Clock,
  Layers,
  ScrollText,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSessionUser } from '@/components/auth/session-gate';
import { EmptyState } from '@/components/empty-state';
import { ProgressBar } from '@/components/progress-bar';
import { LessonContent } from '@/components/modules/lesson-content';
import { lessonSections } from '@/components/modules/lesson-sections';
import { useOfflineImages, useReadingPosition } from '@/components/offline/use-offline-images';
import { ResourceList } from '@/components/modules/resource-list';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/client';
import { catalogLessonQueryOptions } from '@/lib/api/modules';
import { sendLessonRead } from '@/lib/api/practice';
import { feedback } from '@/lib/feedback';
import { formatDuration } from '@/lib/format';
import { userCan } from '@/lib/navigation';
import { readerMode, readerSection, saveReaderMode, saveReaderSection } from '@/lib/reader-state';

/**
 * Lecteur de cours en mode concentration (D195) : ni menu ni barre, un bouton de retour, une
 * progression compacte. Deux lectures du même contenu, sans perte de position :
 * - « Découverte » : une séquence à la fois (intertitre et ce qui suit), transitions courtes ;
 * - « Lecture intégrale » : la leçon complète, comme avant.
 * La leçon est « lue » quand on atteint sa fin : le serveur l'enregistre une seule fois (D196).
 */
export function LessonReader() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const { data, error, isPending, refetch } = useQuery(catalogLessonQueryOptions(slug, id));
  const offlineImages = useOfflineImages(slug);
  useReadingPosition(
    slug,
    data?.lesson.id,
    data && {
      module: data.module.title,
      lesson: data.lesson.title,
      position: data.lesson.position + 1,
      count: data.lessonCount,
    },
  );

  if (isPending) return <TableSkeleton rows={6} />;
  // Lien ancien (reprise, favori) vers une leçon d'une version remplacée : retour au module.
  if (error instanceof ApiError && error.status === 404)
    return (
      <EmptyState
        icon={BookOpen}
        title="Cette leçon n’est plus disponible"
        description="Le module a peut-être été mis à jour. Ouvrez-le pour retrouver ses leçons."
        action={
          <Button asChild>
            <Link href={`/modules/${slug}`}>Ouvrir le module</Link>
          </Button>
        }
      />
    );
  if (error) return <QueryError error={error} onRetry={() => void refetch()} />;
  return <Reader key={data.lesson.id} data={data} offlineImages={offlineImages} />;
}

type LessonData = CatalogLesson;

function Reader({
  data,
  offlineImages,
}: {
  data: LessonData;
  offlineImages: Record<string, string> | undefined;
}) {
  const { module, lesson, previous, next, lessonCount } = data;
  const sections = useMemo(() => lessonSections(lesson.content), [lesson.content]);
  const canDiscover = sections.length >= 2;
  const [mode, setMode] = useState<'decouverte' | 'integrale'>(() =>
    canDiscover ? readerMode() : 'integrale',
  );
  const [section, setSection] = useState(() =>
    Math.min(readerSection(lesson.id), sections.length - 1),
  );
  const [direction, setDirection] = useState<1 | -1>(1);
  const [finished, setFinished] = useState(false);
  const discovering = mode === 'decouverte' && canDiscover;
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const endRef = useRef<HTMLDivElement | null>(null);
  const reward = useLessonCompletion(module.slug, lesson.id, finished);

  useEffect(() => saveReaderSection(lesson.id, section), [lesson.id, section]);

  // Lecture intégrale : la fin de la leçon est atteinte quand son pied entre à l'écran.
  useEffect(() => {
    if (discovering || finished || !endRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setFinished(true);
    });
    observer.observe(endRef.current);
    return () => observer.disconnect();
  }, [discovering, finished]);

  const switchMode = () => {
    const nextMode = discovering ? 'integrale' : 'decouverte';
    saveReaderMode(nextMode);
    setMode(nextMode);
    // Même position : la séquence en cours devient le point de lecture de la leçon complète.
    if (nextMode === 'integrale')
      requestAnimationFrame(() => sectionRefs.current[section]?.scrollIntoView({ block: 'start' }));
  };

  const go = (delta: 1 | -1) => {
    setDirection(delta);
    const target = section + delta;
    if (target >= sections.length) {
      setFinished(true);
      feedback('success');
      return;
    }
    setSection(Math.max(0, target));
    window.scrollTo({ top: 0 });
  };

  const progress = discovering ? (finished ? sections.length : section + 1) : lesson.position + 1;
  const progressMax = discovering ? sections.length : lessonCount;
  const practiceSection =
    discovering && sections[section]!.blocks.every((block) => block.type === 'practice');

  return (
    <div className="space-y-5">
      <header className="sticky top-0 z-20 -mx-4 space-y-2 bg-background/95 px-4 pt-1 pb-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 print:hidden">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="-ml-2">
            <Link
              href={`/modules/${module.slug}`}
              aria-label={`Quitter la leçon (${module.title})`}
            >
              <X aria-hidden />
            </Link>
          </Button>
          <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{module.title}</p>
          {canDiscover && (
            <Button variant="ghost" size="sm" onClick={switchMode} aria-pressed={!discovering}>
              {discovering ? <ScrollText aria-hidden /> : <Layers aria-hidden />}
              {discovering ? 'Lecture intégrale' : 'Découverte'}
            </Button>
          )}
        </div>
        <ProgressBar
          label={discovering ? 'Progression dans la leçon' : 'Position dans le module'}
          valueText={
            discovering
              ? `Séquence ${progress} sur ${progressMax}`
              : `Leçon ${progress} sur ${progressMax}`
          }
          value={progress}
          max={progressMax}
          tone="or"
          className="h-1.5"
        />
      </header>

      <article className="space-y-5">
        {(!discovering || (section === 0 && !finished)) && (
          <div className="space-y-1">
            <p className="text-xs font-medium tracking-wide text-tesla-rouge uppercase">
              Halte {lesson.position + 1} sur {lessonCount}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-balance text-tesla-bordeaux">
              {lesson.title}
            </h1>
            {lesson.durationMinutes && (
              <p className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="size-4" aria-hidden />
                {formatDuration(lesson.durationMinutes)}
              </p>
            )}
          </div>
        )}

        {discovering ? (
          !finished && (
            <div
              key={section}
              className={`text-[1.05rem] ${direction === 1 ? 'animate-enter' : 'animate-enter-back'}`}
            >
              <LessonContent
                document={{ type: 'doc', content: sections[section]!.blocks }}
                offlineImages={offlineImages}
                moduleSlug={module.slug}
                onPracticeContinue={() => go(1)}
              />
            </div>
          )
        ) : (
          <div className="space-y-4 text-[1.05rem]">
            {sections.map((part, index) => (
              <div
                key={index}
                ref={(element) => {
                  sectionRefs.current[index] = element;
                }}
                className="scroll-mt-20"
              >
                <LessonContent
                  document={{ type: 'doc', content: part.blocks }}
                  offlineImages={offlineImages}
                  moduleSlug={module.slug}
                />
              </div>
            ))}
          </div>
        )}

        {(!discovering || finished) && lesson.resources.length > 0 && (
          <section className="space-y-2 border-t pt-4">
            <h2 className="font-semibold">Pour aller plus loin</h2>
            <ResourceList resources={lesson.resources} />
          </section>
        )}
        <div ref={endRef} aria-hidden />
      </article>

      {discovering && !finished ? (
        <nav aria-label="Séquences" className="flex items-center justify-between gap-2 pb-4">
          {section === 0 && previous ? (
            <Button asChild variant="ghost">
              <Link href={`/modules/${module.slug}/lecons/${previous.id}`}>
                <ArrowLeft aria-hidden />
                Halte précédente
              </Link>
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => go(-1)} disabled={section === 0}>
              <ArrowLeft aria-hidden />
              Précédent
            </Button>
          )}
          {practiceSection ? (
            // L'activité porte l'action principale ; on peut toutefois la passer.
            <Button variant="ghost" onClick={() => go(1)}>
              Passer
              <ArrowRight aria-hidden />
            </Button>
          ) : (
            <Button onClick={() => go(1)} className="min-w-36">
              {section + 1 < sections.length ? 'Continuer' : 'Terminer la halte'}
              <ArrowRight aria-hidden />
            </Button>
          )}
        </nav>
      ) : (
        <LessonEnd
          moduleSlug={module.slug}
          previous={previous}
          next={next}
          reward={reward}
          showDone={finished || !discovering}
          onReplay={
            discovering
              ? () => {
                  setFinished(false);
                  setSection(0);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

/** Fin de halte : ce qui est fait, la récompense éventuelle, la suite. */
function LessonEnd({
  moduleSlug,
  previous,
  next,
  reward,
  showDone,
  onReplay,
}: {
  moduleSlug: string;
  previous: { id: string; title: string } | null;
  next: { id: string; title: string } | null;
  reward: RewardSummary | null;
  showDone: boolean;
  onReplay?: () => void;
}) {
  return (
    <section className="animate-enter space-y-4 rounded-2xl border bg-card p-5 pb-6">
      {showDone && (
        <p className="flex items-center gap-2 font-semibold text-tesla-bordeaux">
          <Check className="size-5 text-emerald-700" aria-hidden />
          Halte terminée
        </p>
      )}
      {reward && (reward.xpAwarded > 0 || reward.newBadges.length > 0) && (
        <p className="animate-achieve flex items-center gap-2 rounded-xl bg-tesla-sable/50 px-3 py-2 text-sm">
          <Award className="size-5 text-tesla-rouge" aria-hidden />
          {reward.newBadges.length > 0
            ? `Badge obtenu : ${reward.newBadges.map((badge) => badge.title).join(', ')}`
            : `+${reward.xpAwarded} XP`}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        {next ? (
          <Button asChild className="h-auto justify-between py-2.5 whitespace-normal sm:flex-1">
            <Link href={`/modules/${moduleSlug}/lecons/${next.id}`}>
              <span className="text-left">
                <span className="block text-xs opacity-80">Halte suivante</span>
                {next.title}
              </span>
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button asChild className="sm:flex-1">
            <Link href={`/defis?module=${moduleSlug}`}>
              S’entraîner sur ce module
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        )}
        <Button asChild variant="outline">
          <Link href={`/modules/${moduleSlug}`}>Sommaire</Link>
        </Button>
        {previous && (
          <Button asChild variant="ghost">
            <Link href={`/modules/${moduleSlug}/lecons/${previous.id}`}>
              <ArrowLeft aria-hidden />
              Halte précédente
            </Link>
          </Button>
        )}
        {onReplay && (
          <Button variant="ghost" onClick={onReplay}>
            Revoir la halte
          </Button>
        )}
      </div>
    </section>
  );
}

/** Enregistre la lecture complète une seule fois par affichage (rejouable hors ligne). */
function useLessonCompletion(
  moduleSlug: string,
  lessonId: string,
  finished: boolean,
): RewardSummary | null {
  const user = useSessionUser();
  const queryClient = useQueryClient();
  const [reward, setReward] = useState<RewardSummary | null>(null);
  const sent = useRef(false);
  useEffect(() => {
    if (!finished || sent.current || !userCan(user, 'practice.own')) return;
    sent.current = true;
    sendLessonRead({ moduleSlug, lessonId })
      .then((result) => {
        setReward(result);
        if (result.newBadges.length > 0) feedback('reward');
        void queryClient.invalidateQueries({ queryKey: ['me', 'journal'] });
      })
      // Sans réseau : enregistrée sur l'appareil, envoyée plus tard (aucun message nécessaire).
      .catch(() => {});
  }, [finished, moduleSlug, lessonId, user, queryClient]);
  return reward;
}

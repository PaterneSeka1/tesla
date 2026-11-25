'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BookOpen, Check, Flag, Mountain, SkipForward, X } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef } from 'react';
import { useSessionUser } from '@/components/auth/session-gate';
import { usePracticeData } from '@/components/games/use-practice-data';
import { Campfire, Pennant, Tent } from '@/components/illustrations/scenery';
import { ActivityRunner } from '@/components/practice/activity-runner';
import { ProgressBar } from '@/components/progress-bar';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { catalogModuleQueryOptions } from '@/lib/api/modules';
import {
  completeStep,
  currentStep,
  type ExpeditionData,
  expeditionProgress,
  expeditionStart,
  expeditionSteps,
} from '@/lib/expedition';
import { useGameSession } from '@/lib/game-session';
import { dueInBank, entryId, flattenBank, gameMode, isPlayable } from '@/lib/games';
import { userCan } from '@/lib/navigation';

/** Petite scène d'étape : décor symbolique, jamais une information. */
function StepScene({ kind }: { kind: 'lesson' | 'practice' | 'ascension' | 'synthesis' | 'end' }) {
  return (
    <svg viewBox="0 0 320 84" className="block h-auto w-full" aria-hidden focusable="false">
      <rect width="320" height="84" fill="var(--tesla-sable)" opacity="0.45" />
      <path d="M0 70 Q80 54 160 66 T320 60 V84 H0Z" fill="var(--tesla-or)" opacity="0.35" />
      {kind === 'ascension' ? (
        <path d="M150 74 L210 22 L270 74Z" fill="var(--tesla-bordeaux)" opacity="0.55" />
      ) : null}
      {kind === 'synthesis' || kind === 'end' ? (
        <>
          <Tent x={120} y={70} />
          <Campfire x={160} y={72} />
          <Pennant x={200} y={70} color={kind === 'end' ? 'var(--tesla-or)' : undefined} />
        </>
      ) : (
        <Pennant x={kind === 'ascension' ? 210 : 160} y={kind === 'ascension' ? 24 : 70} />
      )}
    </svg>
  );
}

/**
 * Expédition d'un module (D207) : une étape à la fois, en mode concentration. La progression est
 * enregistrée pour ce compte (coffre de l'appareil, sinon onglet) et reprend où elle s'était
 * arrêtée ; une halte lue ou L'Ascension terminée ramène ici (`?fait=`). Rien n'est verrouillé.
 */
export function Expedition() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const doneParam = useSearchParams().get('fait');
  const user = useSessionUser();
  const records = userCan(user, 'practice.own');
  const moduleQuery = useQuery(catalogModuleQueryOptions(slug));
  const { bank, journal } = usePracticeData();

  const entries = useMemo(() => (bank.data ? flattenBank(bank.data, slug) : []), [bank.data, slug]);
  const journalData = journal?.data;
  const steps = useMemo(() => {
    if (!moduleQuery.data) return [];
    const ascension = gameMode('ascension');
    return expeditionSteps({
      lessons: moduleQuery.data.lessons,
      entries,
      mastered: new Set(journalData?.mastered ?? []),
      due: new Set(
        dueInBank(entries, journalData?.dueReviews ?? []).map(
          (row) => `${row.moduleSlug}:${row.activityKey}`,
        ),
      ),
      ascension: !!ascension && isPlayable(ascension, entries),
    });
  }, [moduleQuery.data, entries, journalData]);

  const { session, update, restart } = useGameSession<ExpeditionData>(
    records ? user.id : null,
    `expedition:${slug}`,
    () => expeditionStart(moduleQuery.data?.version ?? 0),
  );

  // Retour d'une halte lue ou de L'Ascension : l'étape est franchie, l'adresse nettoyée.
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!session || !doneParam || steps.length === 0 || handled.current === doneParam) return;
    handled.current = doneParam;
    if (steps.some((step) => step.id === doneParam)) update(completeStep(session.data, doneParam));
    router.replace(`/modules/${slug}/expedition`);
  }, [session, doneParam, steps, update, router, slug]);

  const exitHref = `/modules/${slug}`;
  const header = (
    <header className="flex items-center gap-2">
      <Button asChild variant="ghost" size="icon" className="-ml-2">
        <Link href={exitHref} aria-label="Quitter l’expédition">
          <X aria-hidden />
        </Link>
      </Button>
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-tesla-bordeaux">
        {moduleQuery.data?.title ?? 'Expédition'}
      </h1>
    </header>
  );

  if (moduleQuery.error)
    return (
      <>
        {header}
        <QueryError error={moduleQuery.error} onRetry={() => void moduleQuery.refetch()} />
      </>
    );
  if (moduleQuery.isPending || bank.isPending || !session) return <TableSkeleton rows={4} />;

  const data = session.data;
  const step = currentStep(steps, data);
  const progress = expeditionProgress(steps, data);
  const skip = () => step && update(completeStep(data, step.id));
  const readIds = new Set(journalData?.readLessonIds ?? []);

  return (
    <div className="space-y-5">
      {header}
      {steps.length > 0 && (
        <ProgressBar
          label="Progression de l’expédition"
          value={progress.done}
          max={progress.total}
          tone="or"
          className="h-1.5"
          valueText={`Étape ${Math.min(progress.done + 1, progress.total)} sur ${progress.total}`}
        />
      )}

      {!step ? (
        <section className="animate-achieve space-y-4 overflow-hidden rounded-2xl border bg-card text-center">
          <StepScene kind="end" />
          <div className="space-y-4 px-5 pb-5">
            <p className="text-lg font-semibold text-tesla-bordeaux">Expédition terminée</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild autoFocus>
                <Link href={exitHref}>Retour au module</Link>
              </Button>
              <Button
                variant="outline"
                onClick={() => restart(expeditionStart(moduleQuery.data.version))}
              >
                Recommencer
              </Button>
            </div>
          </div>
        </section>
      ) : step.kind === 'practice' ? (
        <PracticeStep
          key={`${step.id}:${data.practiceIndex}`}
          step={step}
          index={data.practiceIndex}
          onNext={() =>
            data.practiceIndex + 1 < step.entries.length
              ? update({ ...data, practiceIndex: data.practiceIndex + 1 })
              : update(completeStep(data, step.id))
          }
          onSkip={skip}
        />
      ) : (
        <section key={step.id} className="animate-enter overflow-hidden rounded-2xl border bg-card">
          <StepScene kind={step.kind} />
          <div className="space-y-4 p-5">
            {step.kind === 'lesson' && (
              <>
                <p className="text-xs font-semibold tracking-wide text-tesla-rouge uppercase">
                  Halte {step.index + 1}
                </p>
                <p className="text-xl font-semibold text-balance">{step.title}</p>
                {readIds.has(step.lessonId) && (
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Check className="size-4 text-emerald-700" aria-hidden />
                    Déjà parcourue
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button asChild autoFocus>
                    <Link href={`/modules/${slug}/lecons/${step.lessonId}?expedition=1`}>
                      <BookOpen aria-hidden />
                      {readIds.has(step.lessonId) ? 'Relire' : 'Lire la halte'}
                    </Link>
                  </Button>
                  <Button variant="ghost" onClick={skip}>
                    {readIds.has(step.lessonId) ? 'Continuer' : 'Passer'}
                    <SkipForward aria-hidden />
                  </Button>
                </div>
              </>
            )}
            {step.kind === 'ascension' && (
              <>
                <p className="text-xl font-semibold">L’Ascension du module</p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild autoFocus>
                    <Link href={`/defis/ascension?module=${encodeURIComponent(slug)}&expedition=1`}>
                      <Mountain aria-hidden />
                      Monter
                    </Link>
                  </Button>
                  <Button variant="ghost" onClick={skip}>
                    Passer
                    <SkipForward aria-hidden />
                  </Button>
                </div>
              </>
            )}
            {step.kind === 'synthesis' && (
              <>
                <p className="text-xl font-semibold">Ce que vous avez exploré</p>
                {moduleQuery.data.objectives.length > 0 && (
                  <ul className="space-y-1.5 text-sm">
                    {moduleQuery.data.objectives.map((objective, index) => (
                      <li key={index} className="flex gap-2">
                        <Flag className="mt-0.5 size-4 shrink-0 text-tesla-or" aria-hidden />
                        {objective}
                      </li>
                    ))}
                  </ul>
                )}
                <Button onClick={skip} autoFocus>
                  Terminer l’expédition
                  <ArrowRight aria-hidden />
                </Button>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function PracticeStep({
  step,
  index,
  onNext,
  onSkip,
}: {
  step: Extract<ReturnType<typeof expeditionSteps>[number], { kind: 'practice' }>;
  index: number;
  onNext: () => void;
  onSkip: () => void;
}) {
  const entry = step.entries[Math.min(index, step.entries.length - 1)]!;
  const last = index + 1 >= step.entries.length;
  return (
    <section className="animate-enter space-y-4">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="min-w-0 truncate">Autour de « {step.title} »</span>
        {step.entries.length > 1 && (
          <span className="shrink-0 tabular-nums">
            {index + 1} / {step.entries.length}
          </span>
        )}
      </div>
      {step.optional && index === 0 && (
        <p className="rounded-xl bg-tesla-sable/40 px-4 py-2.5 text-sm">
          Notions déjà maîtrisées : un rapide retour, ou{' '}
          <Button variant="link" className="h-auto p-0" onClick={onSkip}>
            passer
          </Button>
          .
        </p>
      )}
      {entry.activity.title && (
        <p className="font-semibold text-tesla-bordeaux">{entry.activity.title}</p>
      )}
      <ActivityRunner
        key={entryId(entry)}
        item={entry}
        continueLabel={last ? 'Continuer l’expédition' : 'Exercice suivant'}
        onContinue={onNext}
      />
      {!step.optional && (
        <Button variant="ghost" size="sm" onClick={onSkip}>
          Passer ces exercices
          <SkipForward aria-hidden />
        </Button>
      )}
    </section>
  );
}

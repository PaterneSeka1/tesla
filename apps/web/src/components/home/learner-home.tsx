'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarDays, Compass, Repeat, Sparkles, X, Zap } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSessionUser } from '@/components/auth/session-gate';
import { lastReading, type LastReading } from '@/components/offline/use-offline-images';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { myDashboardQueryOptions } from '@/lib/api/dashboards';
import { myPathwayQueryOptions } from '@/lib/api/pathway';
import { journalQueryOptions, practiceBankQueryOptions } from '@/lib/api/practice';
import { formatDate } from '@/lib/format';
import { homeSuggestion, nextAdventure } from '@/lib/home';
import { userCan } from '@/lib/navigation';
import { onboardingDone, markOnboardingDone } from '@/lib/onboarding';
import { cn } from '@/lib/utils';

/** Dernière leçon ouverte sur cet appareil (coffre chiffré), `undefined` pendant la lecture. */
function useLastReading(): LastReading | null | undefined {
  const [last, setLast] = useState<LastReading | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    void lastReading()
      .catch(() => null)
      .then((value) => !cancelled && setLast(value));
    return () => {
      cancelled = true;
    };
  }, []);
  return last;
}

/**
 * Accueil des apprenants (D199) : un point de départ, pas un tableau de bord. En-tête compact,
 * une aventure principale (reprise en une action), au plus une suggestion, la prochaine activité
 * de la communauté si elle existe. Statistiques, badges et résultats restent dans le carnet et
 * « Mon parcours ».
 */
export function LearnerHome() {
  const user = useSessionUser();
  const routier = userCan(user, 'progression.readOwn');
  const dashboard = useQuery({ ...myDashboardQueryOptions, enabled: routier });
  const pathway = useQuery({ ...myPathwayQueryOptions, enabled: routier, retry: false });
  const journal = useQuery({ ...journalQueryOptions, enabled: userCan(user, 'practice.own') });
  const bank = useQuery({ ...practiceBankQueryOptions, enabled: userCan(user, 'practice.play') });
  const last = useLastReading();

  const loading = last === undefined || (routier && dashboard.isPending);
  if (loading)
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Chargement de l’accueil">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-44 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
      </div>
    );

  const lock = pathway.data?.catchUpLock;
  const input = {
    catchUp: lock
      ? { active: lock.active, deadline: lock.deadline, stageName: lock.stage?.name ?? null }
      : null,
    lastReading: last ?? null,
    recommended: dashboard.data?.recommendedModules[0] ?? null,
    dueReviews: journal.data?.dueReviews.length ?? 0,
    hasPractice: (bank.data?.modules.length ?? 0) > 0,
  };
  const adventure = nextAdventure(input);
  const suggestion = homeSuggestion(input);
  const activity = dashboard.data?.upcomingActivities[0];
  const stage = dashboard.data?.stage;
  const unlinked = routier && dashboard.data && !dashboard.data.linked;

  return (
    <div className="stagger space-y-5">
      <header className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold text-tesla-bordeaux">Bonjour {user.firstName}</h1>
        {stage && (
          <Link
            href="/progression"
            className="rounded-full bg-tesla-sable/70 px-3 py-1 text-xs font-medium text-tesla-bordeaux hover:bg-tesla-sable"
          >
            {stage.name}
          </Link>
        )}
      </header>

      {unlinked && (
        <p className="rounded-xl bg-muted px-4 py-3 text-sm">
          Compte non rattaché à une fiche routier : demandez le rattachement au responsable. Les
          cours et les défis restent ouverts.
        </p>
      )}

      <Onboarding show={!last && (journal.data?.xp ?? 0) === 0} />

      <section
        aria-label="Aventure en cours"
        className={cn(
          'relative overflow-hidden rounded-2xl p-5 text-white shadow-sm sm:p-6',
          adventure.urgent ? 'bg-tesla-rouge' : 'bg-tesla-bordeaux',
        )}
      >
        <Trail className="pointer-events-none absolute -right-6 -bottom-4 h-36 w-56 text-tesla-or/25" />
        <p className="relative text-xs font-medium tracking-wide text-tesla-or uppercase">
          {adventure.eyebrow}
        </p>
        <p className="relative mt-1 text-2xl font-semibold text-balance">{adventure.title}</p>
        {adventure.detail && (
          <p className="relative mt-1 text-sm text-tesla-sable">{adventure.detail}</p>
        )}
        <Button
          asChild
          size="lg"
          className="relative mt-5 w-full bg-tesla-or text-tesla-bordeaux hover:bg-tesla-or/90 sm:w-auto"
        >
          <Link href={adventure.href}>
            {adventure.cta}
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </section>

      {suggestion && (
        <Link
          href={suggestion.href}
          className="flex items-center gap-4 rounded-2xl border bg-card p-4 transition-transform active:scale-[0.99] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span className="flex size-11 items-center justify-center rounded-xl bg-tesla-sable/60 text-tesla-bordeaux">
            {suggestion.href.endsWith('revisions') ? (
              <Repeat className="size-5" aria-hidden />
            ) : (
              <Zap className="size-5" aria-hidden />
            )}
          </span>
          <span className="flex-1 font-medium">{suggestion.title}</span>
          <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
        </Link>
      )}

      {activity && (
        <Link
          href="/mes-activites"
          className="flex items-center gap-3 px-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <CalendarDays className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate">
            {formatDate(activity.plannedOn)} · {activity.title}
          </span>
        </Link>
      )}
    </div>
  );
}

/** Première visite : trois repères, ignorables, revus depuis « Mon profil ». */
function Onboarding({ show }: { show: boolean }) {
  const [hidden, setHidden] = useState(onboardingDone);
  if (!show || hidden) return null;
  const close = () => {
    markOnboardingDone();
    setHidden(true);
  };
  return (
    <aside
      aria-label="Premiers pas"
      className="animate-enter relative space-y-2 rounded-2xl border border-tesla-or/50 bg-tesla-sable/30 p-4 pr-12"
    >
      <p className="flex items-center gap-2 font-semibold text-tesla-bordeaux">
        <Sparkles className="size-4" aria-hidden />
        Bienvenue sur la Route
      </p>
      <ul className="space-y-1 text-sm">
        <li className="flex gap-2">
          <Compass className="mt-0.5 size-4 shrink-0 text-tesla-rouge" aria-hidden />
          Les cours se lisent par haltes, à votre rythme.
        </li>
        <li className="flex gap-2">
          <Zap className="mt-0.5 size-4 shrink-0 text-tesla-rouge" aria-hidden />
          Les défis servent à s’entraîner : on peut se tromper et recommencer.
        </li>
      </ul>
      <Button size="sm" variant="outline" onClick={close}>
        C’est compris
      </Button>
      <button
        type="button"
        onClick={close}
        aria-label="Fermer"
        className="absolute top-2 right-2 inline-flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
      >
        <X className="size-4" aria-hidden />
      </button>
    </aside>
  );
}

/** Sentier stylisé (décor de la carte d'aventure, sans information). */
function Trail({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 140" fill="none" className={className} aria-hidden>
      <path
        d="M4 132c34-6 52-30 78-38s54 8 76-14 20-46 58-62"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="2 10"
      />
      <circle cx="82" cy="94" r="5" fill="currentColor" />
      <circle cx="158" cy="80" r="5" fill="currentColor" />
      <path d="M210 10l6 14h-12z" fill="currentColor" />
    </svg>
  );
}

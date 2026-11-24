'use client';

import { Check, Flag, List, Map as MapIcon, Target } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface TrailStop {
  id: string;
  title: string;
  href: string;
  durationMinutes: number | null;
  done: boolean;
  current: boolean;
}

const VIEW_KEY = 'tesla.trail.view';

function savedView(): 'sentier' | 'liste' {
  try {
    return window.localStorage.getItem(VIEW_KEY) === 'liste' ? 'liste' : 'sentier';
  } catch {
    return 'sentier';
  }
}

/**
 * Carte d'aventure d'un module (D200) : les leçons sont les haltes d'un sentier, dans l'ordre de
 * l'auteur. États réels seulement : halte lue (enregistrée par le serveur), halte en cours (dernière
 * ouverte sur cet appareil). Aucune halte n'est verrouillée (lecture libre, D181). Une vue liste
 * classique reste disponible ; la carte tient dans la largeur d'un téléphone.
 */
export function AdventureTrail({
  stops,
  practiceHref,
}: {
  stops: TrailStop[];
  /** Défis du module, en fin de sentier, s'il existe des activités publiées. */
  practiceHref: string | null;
}) {
  const [view, setView] = useState(savedView);
  const toggle = () => {
    const next = view === 'sentier' ? 'liste' : 'sentier';
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Préférence non conservée.
    }
  };
  const done = stops.filter((stop) => stop.done).length;

  return (
    <section aria-labelledby="haltes" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="haltes" className="text-lg font-semibold">
          Haltes{' '}
          <span className="text-sm font-normal text-muted-foreground">
            {done > 0 ? `${done} sur ${stops.length}` : stops.length}
          </span>
        </h2>
        <Button variant="ghost" size="sm" onClick={toggle} aria-pressed={view === 'liste'}>
          {view === 'sentier' ? <List aria-hidden /> : <MapIcon aria-hidden />}
          {view === 'sentier' ? 'Liste' : 'Sentier'}
        </Button>
      </div>

      {view === 'liste' ? (
        <ol className="space-y-2">
          {stops.map((stop, index) => (
            <li key={stop.id}>
              <Link
                href={stop.href}
                className="flex items-center gap-3 rounded-md border bg-card p-3 transition-colors hover:border-tesla-or focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="w-6 text-sm text-muted-foreground tabular-nums">{index + 1}</span>
                <span className="flex-1 font-medium">{stop.title}</span>
                {stop.done && <Check className="size-4 text-emerald-700" aria-label="Lue" />}
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <ol className="relative py-2">
          {stops.map((stop, index) => {
            return (
              <li key={stop.id} className="relative pb-3 last:pb-0">
                {/* Tronçon du sentier vers la halte suivante. */}
                {(index < stops.length - 1 || practiceHref) && (
                  <span
                    aria-hidden
                    className={cn(
                      'absolute top-10 -bottom-1 left-[calc(1.25rem-1.5px)] w-0 border-l-[3px] border-dashed',
                      stop.done ? 'border-tesla-or' : 'border-tesla-sable',
                    )}
                  />
                )}
                <Link
                  href={stop.href}
                  className="group relative flex items-center gap-3 rounded-xl py-1 pr-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  aria-current={stop.current ? 'step' : undefined}
                >
                  <span
                    className={cn(
                      'relative flex size-10 shrink-0 items-center justify-center rounded-full border-[3px] text-sm font-semibold transition-transform duration-150 group-hover:scale-110 group-active:scale-95',
                      stop.done
                        ? 'border-tesla-or bg-tesla-or text-tesla-bordeaux'
                        : stop.current
                          ? 'animate-halo border-tesla-rouge bg-card text-tesla-rouge'
                          : 'border-tesla-sable bg-card text-muted-foreground',
                    )}
                  >
                    {stop.done ? <Check className="size-5" aria-label="Lue" /> : index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block leading-snug font-medium',
                        stop.current && 'text-tesla-rouge',
                      )}
                    >
                      {stop.title}
                    </span>
                    {(stop.current || stop.durationMinutes) && (
                      <span className="block text-xs text-muted-foreground">
                        {stop.current ? 'Vous en étiez ici' : formatDuration(stop.durationMinutes!)}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
          {practiceHref && (
            <li className="relative pt-3">
              <Link
                href={practiceHref}
                className="group flex items-center gap-3 rounded-xl py-1 pr-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full border-[3px] border-tesla-bordeaux bg-tesla-bordeaux text-tesla-or transition-transform group-hover:scale-110">
                  <Target className="size-5" aria-hidden />
                </span>
                <span className="font-medium text-tesla-bordeaux">Défis du module</span>
              </Link>
            </li>
          )}
          {!practiceHref && stops.length > 0 && (
            <li aria-hidden className="pt-2 pl-2.5">
              <Flag className="size-5 text-tesla-or" />
            </li>
          )}
        </ol>
      )}
    </section>
  );
}

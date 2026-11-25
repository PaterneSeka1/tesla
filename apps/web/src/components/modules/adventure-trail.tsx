'use client';

import { Check, List, LocateFixed, Map as MapIcon, Target } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import {
  Pennant,
  SCENERY_THEMES,
  type SceneryTheme,
  themeFor,
} from '@/components/illustrations/scenery';
import { Button } from '@/components/ui/button';
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

const W = 360;
const ROW = 92;
const TOP = 58;
const BOTTOM = 70;

/** Position de la n-ième halte : lacets réguliers d'un bord à l'autre de la carte. */
export function mapPoint(index: number): { x: number; y: number } {
  // Alternance gauche / droite, amplitude légèrement variable : un vrai chemin en lacets.
  const side = index % 2 === 0 ? 1 : -1;
  return {
    x: 180 + side * (70 + 22 * Math.abs(Math.sin(index * 1.7 + 0.4))),
    y: TOP + index * ROW,
  };
}

/** Tracé sinueux passant par les points (courbes de Bézier verticales). */
export function mapPath(points: readonly { x: number; y: number }[]): string {
  return points
    .map((point, index) => {
      if (index === 0) return `M${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
      const previous = points[index - 1]!;
      const middle = (previous.y + point.y) / 2;
      return `C${previous.x.toFixed(1)} ${middle.toFixed(1)} ${point.x.toFixed(1)} ${middle.toFixed(1)} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    })
    .join(' ');
}

type MapNode =
  | { kind: 'stop'; stop: TrailStop; index: number }
  | { kind: 'practice'; href: string }
  | { kind: 'finish' };

/**
 * Carte illustrée (D205) : un sentier sinueux dans un paysage symbolique (savane, camp, piste),
 * les haltes dans l'ordre de l'auteur, puis les défis et l'arrivée. Le tronçon parcouru est doré.
 * Le décor est purement décoratif ; la liste des haltes reste une vraie liste de liens (clavier,
 * lecteurs d'écran), placée par-dessus l'illustration. La hauteur suit le nombre réel de haltes.
 */
function AdventureMap({
  stops,
  practiceHref,
  theme,
}: {
  stops: TrailStop[];
  practiceHref: string | null;
  theme: SceneryTheme;
}) {
  const nodes: MapNode[] = [
    ...stops.map((stop, index) => ({ kind: 'stop' as const, stop, index })),
    practiceHref ? { kind: 'practice' as const, href: practiceHref } : { kind: 'finish' as const },
  ];
  const points = nodes.map((_, index) => mapPoint(index));
  const height = points.at(-1)!.y + BOTTOM;
  const reached = stops.reduce((last, stop, index) => (stop.done ? index : last), -1);
  const allDone = stops.length > 0 && stops.every((stop) => stop.done);
  const decor = SCENERY_THEMES[theme];
  const pct = (value: number, total: number) => `${((value / total) * 100).toFixed(3)}%`;

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-background [container-type:inline-size]">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="block h-auto w-full"
        aria-hidden
        focusable="false"
      >
        <defs>
          <linearGradient id="carte-sol" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--tesla-sable)" stopOpacity="0.55" />
            <stop offset="1" stopColor="var(--tesla-sable)" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <rect width={W} height={height} fill="url(#carte-sol)" />
        {/* Ondulations du terrain, une par halte. */}
        {points.map((point, index) => (
          <path
            key={`relief-${index}`}
            d={`M0 ${point.y + 30} Q90 ${point.y + 14} 180 ${point.y + 28} T360 ${point.y + 22}`}
            fill="none"
            stroke="var(--tesla-or)"
            strokeOpacity="0.22"
            strokeWidth="1.2"
          />
        ))}
        {/* Décor du côté libre de chaque halte. */}
        {points.map((point, index) => {
          const Piece = decor[index % decor.length]!;
          const x = point.x < 180 ? point.x + 128 : point.x - 128;
          return (
            <Piece
              key={`decor-${index}`}
              x={Math.min(338, Math.max(22, x))}
              y={point.y + 26}
              scale={0.9}
            />
          );
        })}
        {/* Départ */}
        <Pennant
          x={points[0]!.x - 4}
          y={TOP - 26}
          scale={0.7}
          color="var(--tesla-or)"
          opacity={0.8}
        />
        {/* Sentier complet, puis tronçon parcouru. */}
        <path
          d={mapPath(points)}
          fill="none"
          stroke="var(--tesla-bordeaux)"
          strokeOpacity="0.3"
          strokeWidth="3"
          strokeDasharray="2 7"
          strokeLinecap="round"
        />
        {reached >= 0 && (
          <path
            d={mapPath(points.slice(0, reached + 1 + (allDone ? 1 : 0)))}
            fill="none"
            stroke="var(--tesla-or)"
            strokeWidth="4"
            strokeLinecap="round"
            pathLength={1}
            className="animate-draw"
          />
        )}
        {/* Arrivée */}
        {nodes.at(-1)!.kind === 'finish' && (
          <Pennant
            x={points.at(-1)!.x}
            y={points.at(-1)!.y - 4}
            color={allDone ? 'var(--tesla-or)' : 'var(--tesla-rouge)'}
          />
        )}
      </svg>
      <ol className="absolute inset-0">
        {nodes.map((node, index) => {
          const point = points[index]!;
          const left = point.x < 180;
          const style = { left: pct(point.x, W), top: pct(point.y, height) };
          const label = cn(
            'absolute top-1/2 w-max -translate-y-1/2 leading-snug',
            left ? 'left-full ml-2' : 'right-full mr-2 text-right',
          );
          const room = left ? W - point.x : point.x;
          const maxWidth = `min(15rem, calc(${((room / W) * 100).toFixed(1)}cqw - 2.5rem))`;
          if (node.kind === 'finish')
            return (
              <li key="arrivee" className="absolute" style={style}>
                <span
                  className={cn(label, 'text-sm font-medium text-tesla-bordeaux')}
                  style={{ maxWidth }}
                >
                  {allDone ? 'Module parcouru' : 'Arrivée'}
                </span>
              </li>
            );
          if (node.kind === 'practice')
            return (
              <li key="defis" className="absolute" style={style}>
                <Link
                  href={node.href}
                  className="group absolute -translate-x-1/2 -translate-y-1/2 rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <span className="flex size-12 items-center justify-center rounded-full border-[3px] border-tesla-bordeaux bg-tesla-bordeaux text-tesla-or shadow-sm transition-transform duration-150 group-hover:scale-110 group-active:scale-95">
                    <Target className="size-5" aria-hidden />
                  </span>
                  <span
                    className={cn(
                      label,

                      'font-semibold text-tesla-bordeaux',
                    )}
                    style={{ maxWidth }}
                  >
                    Défis du module
                  </span>
                </Link>
              </li>
            );
          const { stop } = node;
          return (
            <li key={stop.id} id={`halte-${stop.id}`} className="absolute" style={style}>
              <Link
                href={stop.href}
                aria-current={stop.current ? 'step' : undefined}
                className="group absolute -translate-x-1/2 -translate-y-1/2 rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span
                  className={cn(
                    'flex size-11 items-center justify-center rounded-full border-[3px] text-sm font-semibold shadow-sm transition-transform duration-150 group-hover:scale-110 group-active:scale-95',
                    stop.done
                      ? 'border-tesla-or bg-tesla-or text-tesla-bordeaux'
                      : stop.current
                        ? 'animate-halo border-tesla-rouge bg-card text-tesla-rouge'
                        : 'border-tesla-sable bg-card text-muted-foreground',
                  )}
                >
                  {stop.done ? <Check className="size-5" aria-label="Parcourue" /> : node.index + 1}
                </span>
                <span className={label} style={{ maxWidth }}>
                  <span
                    className={cn(
                      'line-clamp-2 rounded-md bg-background/85 px-1.5 py-0.5 text-[0.92rem] font-medium',
                      stop.current && 'text-tesla-rouge',
                    )}
                  >
                    {stop.title}
                  </span>
                  {stop.current && (
                    <span className="block px-1.5 text-xs text-muted-foreground">
                      Vous en étiez ici
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
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
  seed = '',
}: {
  stops: TrailStop[];
  /** Défis du module, en fin de sentier, s'il existe des activités publiées. */
  practiceHref: string | null;
  /** Identifiant stable du module : choisit la composition du décor. */
  seed?: string;
}) {
  const theme = themeFor(seed);
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
  const current = stops.find((stop) => stop.current);

  return (
    <section aria-labelledby="haltes" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="haltes" className="text-lg font-semibold">
          Haltes{' '}
          <span className="text-sm font-normal text-muted-foreground">
            {done > 0 ? `${done} sur ${stops.length}` : stops.length}
          </span>
        </h2>
        <div className="flex items-center gap-1">
          {view === 'sentier' && current && stops.length > 5 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                document
                  .getElementById(`halte-${current.id}`)
                  ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
              }
            >
              <LocateFixed aria-hidden />
              Halte en cours
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={toggle} aria-pressed={view === 'liste'}>
            {view === 'sentier' ? <List aria-hidden /> : <MapIcon aria-hidden />}
            {view === 'sentier' ? 'Liste' : 'Carte'}
          </Button>
        </div>
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
        <AdventureMap stops={stops} practiceHref={practiceHref} theme={theme} />
      )}
    </section>
  );
}

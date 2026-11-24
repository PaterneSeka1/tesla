import { cn } from '@/lib/utils';

/**
 * Paysage de L'Ascension (D202) : une colline de savane, un baobab au pied, un sentier qui serpente
 * jusqu'au sommet et son fanion. Illustration originale en SVG, couleurs du thème, aucune image.
 * Les haltes franchies sont dorées, la halte en cours bat doucement, les suivantes restent discrètes.
 */
const W = 360;
const H = 170;

/** Point du sentier pour t ∈ [0, 1] (du pied au sommet), en lacets. */
export function trailPoint(t: number): { x: number; y: number } {
  const x = 34 + 268 * t + 46 * Math.sin(t * Math.PI * 2.6) * (1 - t);
  const y = 152 - 124 * t + 8 * Math.sin(t * Math.PI * 5) * (1 - t);
  return { x, y };
}

const TRAIL = Array.from({ length: 61 }, (_, index) => trailPoint(index / 60))
  .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
  .join(' ');

export function AscensionLandscape({
  total,
  level,
  state = 'climbing',
  className,
}: {
  /** Nombre de paliers. */
  total: number;
  /** Paliers franchis. */
  level: number;
  state?: 'climbing' | 'summit' | 'halted';
  className?: string;
}) {
  const stops = Array.from({ length: total }, (_, index) => ({
    index,
    ...trailPoint((index + 1) / total),
  }));
  const climber = trailPoint(Math.min(level, total) / total);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn('h-auto w-full select-none', className)}
      role="img"
      aria-label={
        state === 'summit' ? 'Sommet atteint' : `Palier ${Math.min(level + 1, total)} sur ${total}`
      }
    >
      <defs>
        <linearGradient id="asc-sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--tesla-sable)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--tesla-fond)" />
        </linearGradient>
        <linearGradient id="asc-hill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--tesla-or)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--tesla-sable)" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} rx="18" fill="url(#asc-sky)" />
      {/* Soleil et collines lointaines */}
      <circle
        cx="70"
        cy="40"
        r="18"
        fill="var(--tesla-or)"
        opacity={state === 'summit' ? 0.9 : 0.55}
        className="transition-opacity duration-700"
      />
      <path
        d="M0 112 Q60 84 120 104 T240 92 T360 100 V170 H0Z"
        fill="var(--tesla-sable)"
        opacity="0.9"
      />
      {/* Colline principale */}
      <path
        d="M0 170 L0 150 Q120 140 210 70 Q262 24 308 20 Q336 40 360 64 V170Z"
        fill="url(#asc-hill)"
      />
      {/* Baobab au pied du sentier */}
      <g fill="var(--tesla-bordeaux)" opacity="0.7" transform="translate(14 118)">
        <path d="M9 34 C10 22 9 14 7 8 H13 C12 14 12 22 13 34Z" />
        <path d="M2 9 C6 2 15 2 19 8 C15 6 6 6 2 9Z" />
        <path
          d="M0 5 l5 3 M20 4 l-4 4 M9 0 l1 6"
          stroke="var(--tesla-bordeaux)"
          strokeWidth="1.6"
        />
      </g>
      {/* Acacia sur la crête */}
      <g fill="var(--tesla-bordeaux)" opacity="0.45" transform="translate(236 46)">
        <path d="M6 18 L7 6 H8 L9 18Z" />
        <ellipse cx="8" cy="5" rx="10" ry="3.2" />
      </g>
      {/* Sentier */}
      <path
        d={TRAIL}
        fill="none"
        stroke="var(--tesla-bordeaux)"
        strokeOpacity="0.35"
        strokeWidth="2"
        strokeDasharray="3 5"
        strokeLinecap="round"
      />
      {/* Haltes */}
      {stops.map((stop) => {
        const reached = stop.index < level;
        const current = stop.index === level && state === 'climbing';
        const summit = stop.index === total - 1;
        return (
          <g key={stop.index}>
            {current && (
              <circle cx={stop.x} cy={stop.y} r="9" fill="var(--tesla-rouge)" opacity="0.18">
                <animate attributeName="r" values="6;11;6" dur="2.4s" repeatCount="indefinite" />
              </circle>
            )}
            <circle
              cx={stop.x}
              cy={stop.y}
              r={summit ? 5.5 : 4}
              fill={
                reached ? 'var(--tesla-or)' : current ? 'var(--tesla-rouge)' : 'var(--tesla-fond)'
              }
              stroke="var(--tesla-bordeaux)"
              strokeOpacity={reached || current ? 0.9 : 0.35}
              strokeWidth="1.5"
              className="transition-[fill] duration-500"
            />
          </g>
        );
      })}
      {/* Fanion du sommet */}
      <g transform={`translate(${stops.at(-1)?.x ?? 302} ${(stops.at(-1)?.y ?? 28) - 22})`}>
        <path d="M0 0 V20" stroke="var(--tesla-bordeaux)" strokeWidth="1.6" />
        <path
          d="M0 1 L14 5 L0 10Z"
          fill={state === 'summit' ? 'var(--tesla-rouge)' : 'var(--tesla-bordeaux)'}
          opacity={state === 'summit' ? 1 : 0.45}
          className={cn(
            'origin-left transition-opacity duration-700',
            state === 'summit' && 'animate-pop',
          )}
        />
      </g>
      {/* Marcheur */}
      {state !== 'summit' && (
        <g
          style={{ transform: `translate(${climber.x}px, ${climber.y}px)` }}
          className="transition-transform duration-700 ease-out"
        >
          <circle r="6.5" fill="var(--tesla-fond)" stroke="var(--tesla-rouge)" strokeWidth="2" />
          <path
            d="M-2.5 2.5 L0 -3 L2.5 2.5"
            fill="none"
            stroke="var(--tesla-rouge)"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </g>
      )}
    </svg>
  );
}

/** Étapes nommées de l'ascension, annoncées au passage (jamais un compteur de plus). */
export const ASCENSION_STAGES = [
  { from: 0, name: 'Le pied du baobab' },
  { from: 1 / 3, name: 'Le plateau' },
  { from: 2 / 3, name: 'La crête' },
] as const;

export function stageName(level: number, total: number): string {
  const ratio = total > 0 ? level / total : 0;
  return [...ASCENSION_STAGES].reverse().find((stage) => ratio >= stage.from)!.name;
}

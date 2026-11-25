'use client';

import {
  ArrowRight,
  Brain,
  type LucideIcon,
  Layers,
  ListOrdered,
  Mountain,
  Puzzle,
  Repeat,
  SquareCheckBig,
  TextCursorInput,
  Users,
  Zap,
  FileSearch,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { useSessionUser } from '@/components/auth/session-gate';
import { EmptyState } from '@/components/empty-state';
import { PageHeading } from '@/components/page-heading';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { dueInBank, flattenBank, type GameKey, playableModes } from '@/lib/games';
import { userCan } from '@/lib/navigation';
import { flushPendingResults } from '@/lib/practice-results';
import { AscensionLandscape } from './ascension-landscape';
import { usePracticeData } from './use-practice-data';

export const GAME_ICONS: Record<GameKey, LucideIcon> = {
  revisions: Repeat,
  express: Zap,
  'vrai-faux': SquareCheckBig,
  cartes: Layers,
  ascension: Mountain,
  associations: Puzzle,
  memoire: Brain,
  frises: ListOrdered,
  textes: TextCursorInput,
  situations: Users,
  enquetes: FileSearch,
};

/** Jeux mis en avant, avec une illustration propre. */
const FEATURED: GameKey[] = ['ascension', 'memoire'];

/**
 * Salle des défis (D198, D202, D206) : les révisions du jour, un jeu emblématique illustré mis en
 * avant, puis les autres jeux en tuiles compactes (nom et pictogramme seulement). Seuls les jeux réellement jouables
 * apparaissent (`isPlayable`) ; un thème (module) peut être choisi.
 */
export function GameRoom() {
  const user = useSessionUser();
  const { bank, journal } = usePracticeData();
  const params = useSearchParams();
  const router = useRouter();
  const moduleSlug = params.get('module');
  const entries = useMemo(
    () => (bank.data ? flattenBank(bank.data, moduleSlug) : []),
    [bank.data, moduleSlug],
  );
  const owns = userCan(user, 'practice.own');
  // Résultats gardés dans l'onglet (réseau coupé) : renvoyés à l'arrivée dans la salle.
  useEffect(() => {
    if (owns) void flushPendingResults(user.id);
  }, [owns, user.id]);

  if (bank.isPending) return <TableSkeleton rows={4} />;
  if (bank.error) return <QueryError error={bank.error} onRetry={() => void bank.refetch()} />;

  const due = dueInBank(entries, journal?.data?.dueReviews ?? []);
  const query = moduleSlug ? `?module=${encodeURIComponent(moduleSlug)}` : '';
  const available = playableModes(entries, due).filter((mode) => mode.group);
  // Une seule expérience mise en avant (§ 45) : la première disponible parmi les jeux illustrés.
  const featured = FEATURED.flatMap((key) => available.filter((mode) => mode.key === key)).slice(
    0,
    1,
  );
  const others = available.filter((mode) => !featured.includes(mode));

  return (
    <>
      <PageHeading title="Défis" />
      {bank.data.modules.length > 1 && (
        <label className="block max-w-sm">
          <span className="sr-only">Thème</span>
          <select
            value={moduleSlug ?? ''}
            onChange={(event) =>
              router.replace(
                event.target.value
                  ? `/defis?module=${encodeURIComponent(event.target.value)}`
                  : '/defis',
              )
            }
            className="h-11 w-full rounded-lg border bg-card px-3 text-sm"
          >
            <option value="">Tous les thèmes</option>
            {bank.data.modules.map((module) => (
              <option key={module.slug} value={module.slug}>
                {module.title}
              </option>
            ))}
          </select>
        </label>
      )}

      {due.length > 0 && (
        <Link
          href={`/defis/revisions${query}`}
          className="flex items-center gap-4 rounded-2xl bg-tesla-bordeaux p-5 text-white shadow-sm transition-transform active:scale-[0.99] focus-visible:ring-[3px] focus-visible:ring-tesla-or/60 focus-visible:outline-none"
        >
          <Repeat className="size-7 shrink-0 text-tesla-or" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Retour sur les traces</span>
            <span className="block text-sm text-tesla-sable">
              {due.length === 1 ? '1 notion à revoir' : `${due.length} notions à revoir`}
            </span>
          </span>
          <ArrowRight className="size-5" aria-hidden />
        </Link>
      )}

      {available.length === 0 ? (
        <EmptyState
          icon={Puzzle}
          title="Pas encore de défi ici"
          description="Les défis apparaissent avec les activités publiées dans les cours."
        />
      ) : (
        <>
          {featured.length > 0 && (
            <ul className="grid grid-cols-1 gap-3">
              {featured.map((mode) => (
                <li key={mode.key} className="min-w-0">
                  <Link
                    href={`/defis/${mode.key}${query}`}
                    className="group block overflow-hidden rounded-2xl border bg-card shadow-sm transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    {mode.key === 'ascension' ? (
                      <AscensionLandscape total={6} level={0} className="rounded-none" />
                    ) : (
                      <MemoryPreview />
                    )}
                    <span className="flex items-center gap-2 px-4 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-tesla-bordeaux">
                          {mode.title}
                        </span>
                        <span className="block truncate text-sm text-muted-foreground">
                          {mode.tagline}
                        </span>
                      </span>
                      <ArrowRight
                        className="size-4 shrink-0 text-tesla-rouge transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {others.length > 0 && (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {others.map((mode) => {
                const Icon = GAME_ICONS[mode.key];
                return (
                  <li key={mode.key} className="min-w-0">
                    <Link
                      href={`/defis/${mode.key}${query}`}
                      title={mode.tagline}
                      className="group flex h-full min-h-14 items-center gap-2.5 rounded-xl border bg-card px-3 py-2 transition-[transform,background-color] duration-200 hover:bg-tesla-sable/30 active:scale-[0.98] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-tesla-sable/70 text-tesla-bordeaux transition-transform duration-200 group-hover:-rotate-6 max-[359px]:hidden">
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 text-sm leading-tight font-medium">
                        {mode.title}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </>
  );
}

/** Aperçu du jeu de mémoire : trois cartes, l'une retournée. */
function MemoryPreview() {
  return (
    <span
      className="flex h-[7.5rem] items-center justify-center gap-3 bg-tesla-sable/40"
      aria-hidden
    >
      {[-8, 0, 8].map((rotate, index) => (
        <span
          key={rotate}
          style={{ transform: `rotate(${rotate}deg) translateY(${index === 1 ? -6 : 0}px)` }}
          className={
            index === 1
              ? 'flex h-20 w-14 items-center justify-center rounded-lg border-2 border-tesla-or bg-card px-1 text-center text-[0.6rem] font-semibold text-tesla-bordeaux shadow-sm'
              : 'h-20 w-14 overflow-hidden rounded-lg bg-tesla-bordeaux shadow-sm ring-1 ring-tesla-or/40'
          }
        >
          {index === 1 ? '?' : <WavesMini />}
        </span>
      ))}
    </span>
  );
}

function WavesMini() {
  return (
    <svg viewBox="0 0 56 80" className="h-full w-full">
      {[26, 40, 54].map((y, index) => (
        <path
          key={y}
          d={`M6 ${y} q 7 -6 14 0 t 14 0 t 14 0`}
          fill="none"
          stroke="var(--tesla-or)"
          strokeOpacity={0.4 + index * 0.15}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

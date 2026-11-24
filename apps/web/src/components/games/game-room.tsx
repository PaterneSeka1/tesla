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
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { EmptyState } from '@/components/empty-state';
import { PageHeading } from '@/components/page-heading';
import { QueryError, TableSkeleton } from '@/components/query-state';
import {
  compatible,
  flattenBank,
  GAME_GROUPS,
  GAME_MODES,
  type GameGroup,
  type GameKey,
} from '@/lib/games';
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
};

/**
 * Salle des défis (D198) : les jeux disponibles, rangés par usage, lancés en une action. Seuls
 * les modes ayant du contenu publié compatible apparaissent ; un thème (module) peut être choisi.
 */
export function GameRoom() {
  const { bank, journal } = usePracticeData();
  const params = useSearchParams();
  const router = useRouter();
  const moduleSlug = params.get('module');
  const entries = useMemo(
    () => (bank.data ? flattenBank(bank.data, moduleSlug) : []),
    [bank.data, moduleSlug],
  );

  if (bank.isPending) return <TableSkeleton rows={4} />;
  if (bank.error) return <QueryError error={bank.error} onRetry={() => void bank.refetch()} />;

  const due = (journal?.data?.dueReviews ?? []).filter(
    (row) => !moduleSlug || row.moduleSlug === moduleSlug,
  );
  const query = moduleSlug ? `?module=${encodeURIComponent(moduleSlug)}` : '';
  const available = GAME_MODES.filter((mode) => mode.group && compatible(mode, entries).length > 0);

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
        (Object.keys(GAME_GROUPS) as GameGroup[]).map((group) => {
          const modes = available.filter((mode) => mode.group === group);
          if (modes.length === 0) return null;
          return (
            <section key={group} className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">{GAME_GROUPS[group]}</h2>
              <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
                {modes.map((mode) => {
                  const Icon = GAME_ICONS[mode.key];
                  return (
                    <li key={mode.key}>
                      <Link
                        href={`/defis/${mode.key}${query}`}
                        className="group flex min-h-16 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/60 active:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-tesla-sable/60 text-tesla-bordeaux transition-transform duration-150 group-hover:scale-105">
                          <Icon className="size-5" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{mode.title}</span>
                          <span className="block truncate text-sm text-muted-foreground">
                            {mode.tagline}
                          </span>
                        </span>
                        <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </>
  );
}

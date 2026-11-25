'use client';

import { useQuery } from '@tanstack/react-query';
import {
  type PathwayBoard as Board,
  type PathwayBoardScout,
  STAGE_STATUS_SHORT_LABELS,
} from '@tesla/shared';
import { ArrowRight, ChevronRight, History, TriangleAlert, Users } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { PageHeading } from '@/components/page-heading';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { pathwayBoardQueryOptions } from '@/lib/api/pathway';
import { cn } from '@/lib/utils';

const shortDate = (value: string) =>
  new Date(`${value}T00:00:00Z`).toLocaleDateString('fr-FR', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const ficheHref = (id: string) => `/administration/routiers/${id}`;

/** Motif court d'une fiche sans étape (jamais l'explication du calcul, D176). */
function regularizeLabel(reason: PathwayBoardScout['reason']) {
  return reason === 'DATE_NAISSANCE_MANQUANTE'
    ? 'Date de naissance à renseigner'
    : STAGE_STATUS_SHORT_LABELS[reason] || 'Étape non déterminée';
}

/** Carte d'un routier : nom, ancien, rattrapage en cours, prochain passage. */
function ScoutCard({ row }: { row: PathwayBoardScout }) {
  const { scout, catchUp, next } = row;
  const ancien = row.recognizedStages.length > 0;
  return (
    <li>
      <Link
        href={ficheHref(scout.id)}
        className={cn(
          'group block space-y-1.5 rounded-xl border bg-card p-3 shadow-xs transition-[transform,box-shadow] duration-150 hover:shadow-sm active:scale-[0.98] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
          catchUp?.deadline === 'DEPASSEE' && 'border-destructive/50',
        )}
      >
        <span className="flex items-start gap-2">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">
              {scout.firstName} {scout.lastName}
            </span>
            {scout.team && (
              <span className="block truncate text-xs text-muted-foreground">
                {scout.team.name}
              </span>
            )}
          </span>
          {ancien && (
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-tesla-sable/70 px-2 py-0.5 text-[0.7rem] font-medium text-tesla-bordeaux"
              title={`Parcours antérieur reconnu : ${row.recognizedStages.map((s) => s.name).join(', ')}`}
            >
              <History className="size-3" aria-hidden />
              Ancien
            </span>
          )}
        </span>
        {catchUp && (
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs',
              catchUp.deadline === 'DEPASSEE'
                ? 'bg-red-50 text-destructive'
                : catchUp.deadline === 'PROCHE'
                  ? 'bg-amber-50 text-amber-900'
                  : 'bg-muted text-foreground',
            )}
          >
            <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0">
              Rattrape {catchUp.stage.name}
              {catchUp.dueOn &&
                (catchUp.deadline === 'DEPASSEE'
                  ? ` · en retard depuis le ${shortDate(catchUp.dueOn)}`
                  : ` · avant le ${shortDate(catchUp.dueOn)}`)}
            </span>
          </span>
        )}
        {next && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowRight className="size-3 shrink-0" aria-hidden />
            {next.kind === 'SORTIE'
              ? `Sortie de la branche le ${shortDate(next.on)}`
              : `${next.stage?.name} le ${shortDate(next.on)}`}
          </span>
        )}
        {row.exceptional && (
          <span className="block text-xs font-medium text-tesla-rouge">Exception en cours</span>
        )}
      </Link>
    </li>
  );
}

/**
 * Sentier de la communauté (D203) : chaque routier actif dans la colonne de son étape appliquée,
 * calculée par l'API (âge, exception éventuelle). Les fiches sans étape sont en tête, à régulariser.
 * Aucun classement : ordre alphabétique dans chaque étape. Défilement horizontal sur téléphone.
 */
export function PathwayBoard({ data }: { data: Board }) {
  const pending = data.scouts.filter((row) => !row.stage);
  const counts = new Map(
    data.stages.map((stage) => [
      stage.id,
      data.scouts.filter((row) => row.stage?.id === stage.id).length,
    ]),
  );

  if (data.scouts.length === 0) return <EmptyState icon={Users} title="Aucun routier actif" />;

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <section
          aria-labelledby="a-regulariser"
          className="rounded-2xl border border-amber-300 bg-amber-50/70 p-4"
        >
          <h2 id="a-regulariser" className="flex items-center gap-2 font-semibold text-amber-950">
            <TriangleAlert className="size-4" aria-hidden />
            {pending.length === 1
              ? '1 fiche à régulariser'
              : `${pending.length} fiches à régulariser`}
          </h2>
          <ul className="mt-2 grid gap-1 lg:grid-cols-2">
            {pending.map((row) => (
              <li key={row.scout.id}>
                <Link
                  href={ficheHref(row.scout.id)}
                  className="flex min-h-11 items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-amber-100/70 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">
                      {row.scout.firstName} {row.scout.lastName}
                    </span>
                    <span className="text-amber-900"> · {regularizeLabel(row.reason)}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-amber-900" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Téléphone : les quatre étapes d'un coup d'œil, un toucher amène à la colonne. */}
      <div
        className="grid grid-cols-4 gap-1.5 lg:hidden"
        role="group"
        aria-label="Aller à une étape"
      >
        {data.stages.map((stage, index) => (
          <button
            key={stage.id}
            type="button"
            onClick={() =>
              document
                .getElementById(`etape-${stage.code}`)
                ?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
            }
            className="flex min-h-14 flex-col items-center justify-center rounded-xl border bg-card px-1 py-1.5 text-center transition-transform active:scale-95 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="text-lg leading-none font-semibold text-tesla-bordeaux tabular-nums">
              {counts.get(stage.id)}
            </span>
            <span className="mt-1 line-clamp-1 text-[0.65rem] text-muted-foreground">
              {index === data.stages.length - 1 ? 'Départ' : stage.name}
            </span>
          </button>
        ))}
      </div>

      <ol
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0"
        aria-label="Étapes du parcours"
      >
        {data.stages.map((stage, index) => {
          const rows = data.scouts.filter((row) => row.stage?.id === stage.id);
          return (
            <li
              key={stage.id}
              id={`etape-${stage.code}`}
              className="w-[78vw] max-w-[18rem] shrink-0 snap-start space-y-2.5 lg:w-auto lg:max-w-none"
            >
              <div className="flex items-center gap-2 rounded-xl bg-tesla-bordeaux px-3 py-2 text-white">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-tesla-or text-xs font-semibold text-tesla-bordeaux">
                  {index + 1}
                </span>
                <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{stage.name}</h2>
                <span className="text-sm text-tesla-sable tabular-nums">
                  {counts.get(stage.id)}
                </span>
              </div>
              {rows.length === 0 ? (
                <p className="rounded-xl border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                  Personne à cette étape
                </p>
              ) : (
                <ul className="space-y-2">
                  {rows.map((row) => (
                    <ScoutCard key={row.scout.id} row={row} />
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Page « Parcours des routiers ». */
export function PathwayBoardPage() {
  const query = useQuery(pathwayBoardQueryOptions());
  return (
    <>
      <PageHeading title="Parcours des routiers" />
      {query.isPending ? (
        <TableSkeleton rows={5} />
      ) : query.error ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <PathwayBoard data={query.data} />
      )}
    </>
  );
}

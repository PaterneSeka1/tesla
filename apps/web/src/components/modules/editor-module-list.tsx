'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  MODULE_CATEGORIES,
  MODULE_CATEGORY_LABELS,
  MODULE_COLLABORATION_FILTER_LABELS,
  MODULE_COLLABORATION_FILTERS,
  MODULE_EVALUATION_FILTER_LABELS,
  MODULE_EVALUATION_FILTERS,
  MODULE_LESSON_FILTER_LABELS,
  MODULE_LESSON_FILTERS,
  MODULE_LIST_SORT_LABELS,
  MODULE_LIST_SORTS,
  MODULE_ORIGIN_FILTER_LABELS,
  MODULE_ORIGIN_FILTERS,
  MODULE_PUBLICATION_FILTER_LABELS,
  MODULE_PUBLICATION_FILTERS,
} from '@tesla/shared';
import { FilePenLine, Plus, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSessionUser } from '@/components/auth/session-gate';
import { EmptyState } from '@/components/empty-state';
import { PageHeading } from '@/components/page-heading';
import { Pagination } from '@/components/pagination';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { SearchInput } from '@/components/search-input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { chefCandidatesQueryOptions, editorModulesQueryOptions } from '@/lib/api/modules';
import { stagesQueryOptions } from '@/lib/api/scouts';
import { authorName } from '@/lib/format';
import {
  activeFilters,
  activeQuickView,
  ADVANCED_KEYS,
  applyQuickView,
  clearFilter,
  DEFAULT_STATE,
  type ModuleListState,
  parseListState,
  QUICK_VIEWS,
  serializeListState,
  STATUS_OPTION_LABELS,
  STATUS_OPTIONS,
  toApiQuery,
} from '@/lib/module-list-params';
import { userCan } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { ModuleCards, ModuleTable } from './module-list-items';
import { ModuleListStats } from './module-list-stats';

/**
 * Catalogue des modules accessibles (D171) : chef = ses modules et ceux auxquels il collabore,
 * responsable plein = tous. Recherche, filtres, tri et page vivent dans l'URL ; tout est appliqué
 * par l'API (pagination serveur, modules distincts, jamais les versions).
 */
export function EditorModuleList({ review = false }: { review?: boolean }) {
  const user = useSessionUser();
  const canReview = userCan(user, 'module.review');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const state = useMemo(
    () => parseListState(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const listPath = useMemo(() => {
    const query = serializeListState(state);
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, state]);

  const navigate = useCallback(
    (next: ModuleListState, mode: 'push' | 'replace' = 'push') => {
      const query = serializeListState(next);
      const href = query ? `${pathname}?${query}` : pathname;
      if (mode === 'replace') router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    },
    [pathname, router],
  );
  const update = (patch: Partial<ModuleListState>) => navigate({ ...state, ...patch, page: 1 });

  // Recherche : saisie locale, URL mise à jour 350 ms après la dernière frappe (une requête par
  // pause). La temporisation part de la saisie elle-même : aucune frappe n'est perdue.
  const [searchDraft, setSearchDraft] = useState(state.search);
  const [typing, setTyping] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  }, [state]);
  useEffect(() => () => clearTimeout(timer.current ?? undefined), []);
  const onSearchChange = (value: string) => {
    setSearchDraft(value);
    setTyping(true);
    clearTimeout(timer.current ?? undefined);
    timer.current = setTimeout(() => {
      setTyping(false);
      if (value.trim() !== latest.current.search.trim()) {
        navigate({ ...latest.current, search: value, page: 1 }, 'replace');
      }
    }, 350);
  };
  /** Réinitialisation explicite : saisie en attente abandonnée. */
  const resetSearch = () => {
    clearTimeout(timer.current ?? undefined);
    setTyping(false);
    setSearchDraft('');
  };
  // URL modifiée ailleurs (Précédent, vue rapide) : la saisie suit, sauf frappe en cours.
  const [syncedSearch, setSyncedSearch] = useState(state.search);
  if (state.search !== syncedSearch) {
    setSyncedSearch(state.search);
    if (!typing) setSearchDraft(state.search);
  }

  const advancedCount = ADVANCED_KEYS.filter((key) => state[key] !== DEFAULT_STATE[key]).length;
  const [advancedOpen, setAdvancedOpen] = useState(advancedCount > 0);

  const { data, error, isPending, isFetching, refetch } = useQuery({
    ...editorModulesQueryOptions(toApiQuery(state)),
    placeholderData: keepPreviousData,
  });
  const { data: stages } = useQuery(stagesQueryOptions);
  const { data: authors } = useQuery({ ...chefCandidatesQueryOptions, enabled: canReview });

  // Page devenue vide (suppression, filtre plus strict) : retour à la dernière page existante.
  useEffect(() => {
    if (data && data.items.length === 0 && data.total > 0 && state.page > 1) {
      navigate({ ...state, page: Math.max(1, Math.ceil(data.total / data.pageSize)) }, 'replace');
    }
  }, [data, state, navigate]);

  const chips = activeFilters(state, {
    stage: (id) => stages?.items.find((stage) => stage.id === id)?.name,
    author: (id) => {
      const person = authors?.items.find((candidate) => candidate.id === id);
      return person ? authorName(person) : undefined;
    },
  });
  const currentView = activeQuickView(state);
  const views = QUICK_VIEWS.filter((view) => !('reviewOnly' in view) || canReview);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeading
          title={review ? 'Tous les modules' : 'Mes modules'}
          description="Un module regroupe ses versions : seule sa version publiée est visible des routiers."
        />
        <Button asChild>
          <Link href="/encadrement/modules/nouveau">
            <Plus aria-hidden />
            Nouveau module
          </Link>
        </Button>
      </div>

      <ModuleListStats />

      <section aria-label="Recherche et filtres" className="space-y-3">
        <div
          role="group"
          aria-label="Vues rapides"
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
        >
          {views.map((view) => (
            <Button
              key={view.key}
              type="button"
              size="sm"
              variant={currentView === view.key ? 'default' : 'outline'}
              aria-pressed={currentView === view.key}
              className="shrink-0 rounded-full"
              onClick={() => navigate(applyQuickView(state, view.key))}
            >
              {view.label}
            </Button>
          ))}
        </div>

        <form
          role="search"
          className="grid gap-3 sm:grid-cols-2 sm:items-end lg:grid-cols-4 min-[1400px]:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(11rem,1fr))_auto]"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="sm:col-span-2 lg:col-span-4 min-[1400px]:col-span-1">
            <SearchInput
              id="module-search"
              placeholder="Titre, code, résumé, thème, auteur"
              value={searchDraft}
              onChange={onSearchChange}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="module-status">Statut</Label>
            <NativeSelect
              id="module-status"
              value={state.status}
              onChange={(event) =>
                update({ status: event.target.value as ModuleListState['status'] })
              }
            >
              {STATUS_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {STATUS_OPTION_LABELS[value]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <Label htmlFor="module-stage">Étape</Label>
            <NativeSelect
              id="module-stage"
              value={state.stageId}
              onChange={(event) => update({ stageId: event.target.value })}
            >
              <option value="">Toutes les étapes</option>
              {stages?.items.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <Label htmlFor="module-sort">Tri</Label>
            <NativeSelect
              id="module-sort"
              value={state.sort}
              onChange={(event) =>
                navigate({ ...state, sort: event.target.value as ModuleListState['sort'], page: 1 })
              }
            >
              {MODULE_LIST_SORTS.map((value) => (
                <option key={value} value={value}>
                  {MODULE_LIST_SORT_LABELS[value]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button
            type="button"
            variant="outline"
            aria-expanded={advancedOpen}
            aria-controls="module-advanced-filters"
            onClick={() => setAdvancedOpen((open) => !open)}
          >
            <SlidersHorizontal aria-hidden />
            Filtres avancés
            {advancedCount > 0 && (
              <Badge variant="accent" aria-label={`${advancedCount} actifs`}>
                {advancedCount}
              </Badge>
            )}
          </Button>
        </form>

        <div
          id="module-advanced-filters"
          hidden={!advancedOpen}
          className="rounded-xl border bg-card p-4"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FilterSelect
              id="filter-publication"
              label="Publication"
              value={state.publication}
              allLabel="Toutes"
              options={MODULE_PUBLICATION_FILTERS.map((value) => [
                value,
                MODULE_PUBLICATION_FILTER_LABELS[value],
              ])}
              onChange={(value) => update({ publication: value as ModuleListState['publication'] })}
            />
            <FilterSelect
              id="filter-category"
              label="Catégorie"
              value={state.category}
              allLabel="Toutes"
              options={MODULE_CATEGORIES.map((value) => [value, MODULE_CATEGORY_LABELS[value]])}
              onChange={(value) => update({ category: value as ModuleListState['category'] })}
            />
            <FilterSelect
              id="filter-author"
              label="Auteur"
              value={state.author}
              allLabel={canReview ? 'Tous les auteurs' : 'Tous'}
              options={[
                ['me', 'Créés par moi'],
                ...(authors?.items ?? [])
                  .filter((person) => person.id !== user.id)
                  .map((person): [string, string] => [person.id, authorName(person)]),
              ]}
              onChange={(value) => update({ author: value })}
            />
            <FilterSelect
              id="filter-collaboration"
              label="Collaboration"
              value={state.collaboration}
              allLabel="Tous les modules accessibles"
              options={MODULE_COLLABORATION_FILTERS.map((value) => [
                value,
                MODULE_COLLABORATION_FILTER_LABELS[value],
              ])}
              onChange={(value) =>
                update({ collaboration: value as ModuleListState['collaboration'] })
              }
            />
            <FilterSelect
              id="filter-origin"
              label="Provenance"
              value={state.origin}
              allLabel="Toutes"
              options={MODULE_ORIGIN_FILTERS.map((value) => [
                value,
                MODULE_ORIGIN_FILTER_LABELS[value],
              ])}
              onChange={(value) => update({ origin: value as ModuleListState['origin'] })}
            />
            <FilterSelect
              id="filter-evaluation"
              label="Questionnaire"
              value={state.evaluation}
              allLabel="Indifférent"
              options={MODULE_EVALUATION_FILTERS.map((value) => [
                value,
                MODULE_EVALUATION_FILTER_LABELS[value],
              ])}
              onChange={(value) => update({ evaluation: value as ModuleListState['evaluation'] })}
            />
            <FilterSelect
              id="filter-lessons"
              label="Leçons"
              value={state.lessons}
              allLabel="Indifférent"
              options={MODULE_LESSON_FILTERS.map((value) => [
                value,
                MODULE_LESSON_FILTER_LABELS[value],
              ])}
              onChange={(value) => update({ lessons: value as ModuleListState['lessons'] })}
            />
            <fieldset className="space-y-1 sm:col-span-2 lg:col-span-1">
              <legend className="text-sm font-medium">Période</legend>
              <NativeSelect
                aria-label="Date filtrée"
                value={state.dateField}
                onChange={(event) =>
                  update({ dateField: event.target.value as ModuleListState['dateField'] })
                }
              >
                <option value="updated">Dernière modification</option>
                <option value="created">Date de création</option>
              </NativeSelect>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="filter-from" className="sr-only">
                    Du
                  </Label>
                  <Input
                    id="filter-from"
                    type="date"
                    aria-label="Du"
                    value={state.from}
                    max={state.to || undefined}
                    onChange={(event) => update({ from: event.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="filter-to" className="sr-only">
                    Au
                  </Label>
                  <Input
                    id="filter-to"
                    type="date"
                    aria-label="Au"
                    value={state.to}
                    min={state.from || undefined}
                    onChange={(event) => update({ to: event.target.value })}
                  />
                </div>
              </div>
            </fieldset>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
          <span className="font-medium text-tesla-bordeaux">
            {data ? `${data.total} module${data.total > 1 ? 's' : ''}` : 'Recherche…'}
          </span>
          {chips.length > 0 && (
            <>
              <span className="text-muted-foreground">
                · {chips.length} filtre{chips.length > 1 ? 's' : ''}
              </span>
              <ul className="flex flex-wrap gap-2" aria-label="Filtres actifs">
                {chips.map((chip) => (
                  <li key={chip.key}>
                    <button
                      type="button"
                      className="inline-flex min-h-8 items-center gap-1 rounded-full border border-tesla-or/60 bg-tesla-sable/40 py-1 pr-2 pl-3 text-xs font-medium text-tesla-bordeaux hover:bg-tesla-sable focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                      aria-label={`Retirer le filtre ${chip.label}`}
                      onClick={() => {
                        if (chip.key === 'search') resetSearch();
                        navigate(clearFilter(state, chip.key));
                      }}
                    >
                      {chip.label}
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  resetSearch();
                  navigate({ ...DEFAULT_STATE, sort: state.sort });
                }}
              >
                <RotateCcw aria-hidden />
                Réinitialiser
              </Button>
            </>
          )}
        </div>
      </section>

      <div className={cn('space-y-4 transition-opacity', isFetching && data && 'opacity-70')}>
        {isPending ? (
          <TableSkeleton />
        ) : error ? (
          <QueryError error={error} onRetry={() => void refetch()} />
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={FilePenLine}
            title={chips.length > 0 ? 'Aucun module ne correspond' : 'Aucun module'}
            description={
              chips.length > 0 ? 'Retirez un filtre ou modifiez la recherche.' : undefined
            }
            action={
              chips.length > 0 ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    resetSearch();
                    navigate({ ...DEFAULT_STATE, sort: state.sort });
                  }}
                >
                  Réinitialiser les filtres
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <ModuleTable
              items={data.items}
              canReview={canReview}
              review={review}
              returnTo={listPath}
            />
            <ModuleCards
              items={data.items}
              canReview={canReview}
              review={review}
              returnTo={listPath}
            />
            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onPageChange={(page) => navigate({ ...state, page })}
            />
          </>
        )}
      </div>
    </>
  );
}

function FilterSelect({
  id,
  label,
  value,
  allLabel,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  allLabel: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{allLabel}</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

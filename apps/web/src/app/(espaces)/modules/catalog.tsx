'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { MODULE_CATEGORIES, MODULE_CATEGORY_LABELS, type ModuleCategory } from '@tesla/shared';
import { BookOpen, Clock, Search, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { PageHeading } from '@/components/page-heading';
import { Pagination } from '@/components/pagination';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { catalogQueryOptions } from '@/lib/api/modules';
import { stagesQueryOptions } from '@/lib/api/scouts';
import { formatDuration } from '@/lib/format';

const PAGE_SIZE = 12;

/** Modules publiés, en consultation libre : l'étape n'est qu'une recommandation de lecture. */
export function Catalog() {
  const [search, setSearch] = useState('');
  const [stageId, setStageId] = useState('');
  const [theme, setTheme] = useState('');
  const [category, setCategory] = useState<ModuleCategory | ''>('');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());
  const stages = useQuery(stagesQueryOptions);
  const { data, error, isPending, refetch } = useQuery({
    ...catalogQueryOptions({
      search: deferredSearch,
      stageId: stageId || undefined,
      theme: theme || undefined,
      category: category || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    placeholderData: keepPreviousData,
  });
  const filtered = Boolean(deferredSearch || stageId || theme || category);

  return (
    <>
      <PageHeading
        title="Bibliothèque"
        description="Découvrir le scoutisme, la Route et la communauté, puis les modules de chaque étape : tout module publié est accessible quelle que soit votre étape."
      />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Catégorie">
        {(['', ...MODULE_CATEGORIES] as const).map((value) => (
          <Button
            key={value || 'all'}
            size="sm"
            variant={category === value ? 'default' : 'outline'}
            aria-pressed={category === value}
            onClick={() => {
              setCategory(value);
              setPage(1);
            }}
          >
            {value ? MODULE_CATEGORY_LABELS[value] : 'Tous les modules'}
          </Button>
        ))}
      </div>
      <form
        role="search"
        className="grid gap-3 md:grid-cols-[1fr_12rem_12rem]"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="space-y-1">
          <Label htmlFor="catalog-search">Rechercher</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="catalog-search"
              type="search"
              className="pl-9"
              placeholder="Titre, description, thème"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="catalog-stage">Étape</Label>
          <NativeSelect
            id="catalog-stage"
            value={stageId}
            onChange={(event) => {
              setStageId(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Toutes</option>
            {stages.data?.items.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="catalog-theme">Thème</Label>
          <NativeSelect
            id="catalog-theme"
            value={theme}
            onChange={(event) => {
              setTheme(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Tous</option>
            {data?.themes.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </NativeSelect>
        </div>
      </form>

      {isPending ? (
        <TableSkeleton rows={4} />
      ) : error ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={filtered ? 'Aucun module trouvé' : 'Aucun module publié'}
          description={
            filtered
              ? 'Modifiez la recherche ou les filtres.'
              : 'Les modules apparaîtront ici après leur approbation et leur publication par le responsable pédagogique.'
          }
        />
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((module) => {
              const recommended = data.myStageId !== null && module.stage?.id === data.myStageId;
              return (
                <li key={module.slug}>
                  <Link
                    href={`/modules/${module.slug}`}
                    className="group flex h-full flex-col gap-3 rounded-lg border border-t-4 border-t-tesla-rouge bg-card p-4 transition-colors hover:border-tesla-or focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <div className="flex flex-wrap gap-2">
                      {module.stage && <Badge variant="secondary">{module.stage.name}</Badge>}
                      {module.theme && <Badge variant="outline">{module.theme}</Badge>}
                      {module.obligation === 'OBLIGATOIRE' && (
                        <Badge variant="default">Obligatoire</Badge>
                      )}
                      {!module.official && <Badge variant="outline">Contenu non homologué</Badge>}
                      {recommended && (
                        <Badge variant="accent">
                          <Sparkles aria-hidden />
                          Recommandé pour votre étape
                        </Badge>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-tesla-bordeaux group-hover:underline">
                      {module.title}
                    </h3>
                    {module.summary && (
                      <p className="line-clamp-3 text-sm text-muted-foreground">{module.summary}</p>
                    )}
                    <p className="mt-auto flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        {module.lessonCount} leçon{module.lessonCount > 1 ? 's' : ''}
                      </span>
                      {module.durationMinutes && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3" aria-hidden />
                          {formatDuration(module.durationMinutes)}
                        </span>
                      )}
                      <span>Version {module.version}</span>
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}

'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { type ReferenceCategory, type ReferenceEntry } from '@tesla/shared';
import { ChevronRight, Music, ScrollText } from 'lucide-react';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { PageHeading } from '@/components/page-heading';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { ReferenceIconView } from '@/components/reference/reference-icon';
import { SearchInput } from '@/components/search-input';
import { referenceCatalogQueryOptions } from '@/lib/api/reference';

/** Adresse d'une ressource, ou d'une de ses parties (fiche d'une cérémonie). */
export function entryHref(entry: Pick<ReferenceEntry, 'id'>, partId?: string | null) {
  return partId ? `/referentiel/${entry.id}?fiche=${partId}` : `/referentiel/${entry.id}`;
}

/**
 * Référentiel scout (D220) : prières, cérémonies, chants et textes à retrouver vite, en réunion
 * comme au camp. Seules les rubriques qui contiennent une ressource publiée apparaissent.
 */
export function ReferenceCatalogView() {
  const [search, setSearch] = useState('');
  const query = useDeferredValue(search.trim());
  const { data, error, isPending, refetch } = useQuery({
    ...referenceCatalogQueryOptions(query.length >= 2 ? query : ''),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeading title="Référentiel scout" />
      <form role="search" onSubmit={(event) => event.preventDefault()}>
        <SearchInput
          id="reference-search"
          label="Rechercher une prière, une cérémonie, un chant…"
          value={search}
          onChange={setSearch}
        />
      </form>
      {error ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <TableSkeleton rows={4} />
      ) : data.categories.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={
            query ? 'Aucune ressource ne correspond.' : 'Aucune ressource publiée pour l’instant.'
          }
        />
      ) : (
        <div className="space-y-6">
          {data.categories.map((category) => (
            <CategorySection key={category.id} category={category} searching={!!query} />
          ))}
        </div>
      )}
    </>
  );
}

function CategorySection({
  category,
  searching,
}: {
  category: ReferenceCategory;
  searching: boolean;
}) {
  return (
    <section aria-labelledby={`rubrique-${category.id}`} className="space-y-2">
      <h2
        id={`rubrique-${category.id}`}
        className="flex items-center gap-2 text-lg font-semibold text-tesla-bordeaux"
      >
        <ReferenceIconView name={category.icon} className="size-5 text-tesla-or" />
        {category.title}
      </h2>
      {category.description && (
        <p className="text-sm text-muted-foreground">{category.description}</p>
      )}
      <ul className="divide-y overflow-hidden rounded-xl border bg-white">
        {category.entries.map((entry) => (
          <li key={entry.id}>
            <Link
              href={entryHref(entry)}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-tesla-sable/30 focus-visible:bg-tesla-sable/30 focus-visible:outline-none"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{entry.title}</span>
                {searching && entry.match ? (
                  <span className="block truncate text-sm text-muted-foreground">
                    {entry.match}
                  </span>
                ) : (
                  entry.parts.length > 1 && (
                    <span className="block text-sm text-muted-foreground">
                      {entry.parts.length} parties
                    </span>
                  )
                )}
              </span>
              {entry.hasAudio && (
                <Music className="size-4 text-tesla-or" aria-label="Avec enregistrement" />
              )}
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </Link>
            {entry.parts.length > 1 && !searching && (
              <ul className="border-t bg-muted/20 py-1">
                {entry.parts.map((part) => (
                  <li key={part.id}>
                    <Link
                      href={entryHref(entry, part.id)}
                      className="block px-6 py-2 text-sm hover:text-tesla-rouge focus-visible:text-tesla-rouge focus-visible:outline-none"
                    >
                      {part.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

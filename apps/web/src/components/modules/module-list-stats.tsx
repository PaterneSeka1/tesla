'use client';

import { useQuery } from '@tanstack/react-query';
import { editorModuleStatsQueryOptions } from '@/lib/api/modules';

const ITEMS = [
  ['accessible', 'Modules accessibles'],
  ['published', 'Publiés'],
  ['neverPublished', 'Jamais publiés'],
  ['pendingApproval', 'En attente d’approbation'],
] as const;

/**
 * Quatre indicateurs compacts et secondaires (modules distincts, valeurs de l'API). Pas de
 * graphique : la liste reste l'essentiel de la page.
 */
export function ModuleListStats() {
  const { data, isError } = useQuery(editorModuleStatsQueryOptions);
  if (isError) return null; // la liste reste utilisable sans les indicateurs
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-busy={!data}>
      {ITEMS.map(([key, label]) => (
        <div
          key={key}
          className="flex items-baseline justify-between gap-2 rounded-lg border bg-card px-3 py-2"
        >
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="text-lg font-semibold tabular-nums text-tesla-bordeaux">
            {data ? data[key] : '–'}
          </dd>
        </div>
      ))}
    </dl>
  );
}

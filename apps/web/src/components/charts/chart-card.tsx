'use client';

import { type LucideIcon } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Cadre commun des graphiques : titre, état vide propre au graphique et tableau des valeurs
// (alternative textuelle pour les lecteurs d'écran, l'impression et la vérification des chiffres).

export interface ChartColumn {
  key: string;
  label: string;
}

export type ChartRow = Record<string, string | number>;

export function ChartCard({
  title,
  description,
  empty,
  emptyIcon,
  columns,
  rows,
  children,
}: {
  title: string;
  description?: string;
  /** Message affiché à la place du graphique lorsqu'il n'y a rien à représenter. */
  empty?: string;
  emptyIcon: LucideIcon;
  columns: readonly ChartColumn[];
  rows: readonly ChartRow[];
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-3">
        {empty ? (
          <EmptyState icon={emptyIcon} title={empty} />
        ) : (
          <>
            <figure aria-label={title} className="m-0">
              {children}
            </figure>
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Voir les données
              </summary>
              <div className="mt-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columns.map((column, index) => (
                        <TableHead key={column.key} className={index > 0 ? 'text-right' : ''}>
                          {column.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {columns.map((column, index) => (
                          <TableCell
                            key={column.key}
                            className={index > 0 ? 'text-right tabular-nums' : ''}
                          >
                            {row[column.key]}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </details>
          </>
        )}
      </CardContent>
    </Card>
  );
}

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

/** Préférence « réduire les animations » (les graphiques ne s'animent pas). */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(reducedMotionQuery);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    () => window.matchMedia(reducedMotionQuery).matches,
    () => true,
  );
}

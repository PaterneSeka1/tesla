'use client';

import { useId, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface TabItem {
  key: string;
  label: string;
}

/**
 * Onglets accessibles (motif WAI-ARIA : flèches gauche/droite, Début, Fin). Le contenu de l'onglet
 * actif est rendu par l'appelant dans `children`.
 */
export function Tabs({
  label,
  items,
  active,
  onChange,
  children,
}: {
  label: string;
  items: TabItem[];
  active: string;
  onChange: (key: string) => void;
  children: React.ReactNode;
}) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (index: number) => {
    const next = (index + items.length) % items.length;
    onChange(items[next]!.key);
    refs.current[next]?.focus();
  };

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label={label}
        className="-mx-1 flex gap-1 overflow-x-auto border-b px-1 pb-px"
      >
        {items.map((item, index) => {
          const selected = item.key === active;
          return (
            <button
              key={item.key}
              ref={(element) => {
                refs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`${id}-tab-${item.key}`}
              aria-selected={selected}
              aria-controls={`${id}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(item.key)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight') move(index + 1);
                else if (event.key === 'ArrowLeft') move(index - 1);
                else if (event.key === 'Home') move(0);
                else if (event.key === 'End') move(items.length - 1);
                else return;
                event.preventDefault();
              }}
              className={cn(
                'shrink-0 rounded-t-md border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                selected
                  ? 'border-tesla-rouge text-tesla-bordeaux'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-tab-${active}`}
        className="space-y-6"
      >
        {children}
      </div>
    </div>
  );
}

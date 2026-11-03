import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Section secondaire repliable (élément natif `details` : clavier et lecteurs d'écran sans script).
 * Pour les outils ponctuels qui ne doivent pas occuper le haut d'une page (import, réglages).
 */
export function Disclosure({
  title,
  summary,
  defaultOpen = false,
  className,
  children,
}: {
  title: string;
  /** Précision affichée sous le titre, repliée comprise. */
  summary?: string;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className={cn('group rounded-xl border bg-card', className)}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3 hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{title}</span>
          {summary && <span className="block text-sm text-muted-foreground">{summary}</span>}
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="space-y-4 border-t px-4 py-4">{children}</div>
    </details>
  );
}

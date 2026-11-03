import { type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// Indicateur chiffré : la valeur vient toujours de l'API, jamais d'une valeur d'exemple.

const frame = 'flex items-start gap-2.5 rounded-xl border bg-card p-3 shadow-xs sm:gap-3 sm:p-4';

/** Indicateur chiffré ; avec `href`, la carte entière mène au détail. */
export function StatCard({
  label,
  value,
  href,
  icon: Icon,
  hint,
}: {
  label: string;
  value: number | string;
  href?: string;
  icon: LucideIcon;
  hint?: string;
}) {
  const body = (
    <>
      <span className="rounded-lg bg-tesla-sable/60 p-1.5 text-tesla-rouge sm:p-2">
        <Icon className="size-4 sm:size-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-muted-foreground">{label}</span>
        <span className="block text-2xl font-semibold tabular-nums text-tesla-bordeaux">
          {value}
        </span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </>
  );
  if (!href) return <div className={frame}>{body}</div>;
  return (
    <Link
      href={href}
      className={cn(
        frame,
        'group transition-all hover:border-tesla-or active:scale-[0.98] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
      )}
    >
      {body}
    </Link>
  );
}

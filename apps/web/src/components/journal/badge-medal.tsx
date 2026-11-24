import {
  BookMarked,
  Compass,
  Footprints,
  type LucideIcon,
  Map,
  Milestone,
  Mountain,
  Repeat,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/** Emblème de chaque badge (D196) : médaillon original, aucune distinction scoute officielle. */
const EMBLEMS: Record<string, LucideIcon> = {
  'premier-pas': Footprints,
  curiosite: Compass,
  explorateur: Map,
  'memoire-de-la-route': BookMarked,
  'maitre-des-reperes': Milestone,
  perseverance: Mountain,
  'retour-sur-les-traces': Repeat,
};

export function BadgeMedal({
  badgeKey,
  earned,
  className,
}: {
  badgeKey: string;
  earned: boolean;
  className?: string;
}) {
  const Icon = EMBLEMS[badgeKey] ?? Compass;
  return (
    <span
      className={cn(
        'relative flex size-14 items-center justify-center rounded-full border-2',
        earned
          ? 'border-tesla-or bg-tesla-bordeaux text-tesla-or shadow-[inset_0_0_0_3px_var(--tesla-bordeaux),inset_0_0_0_5px_color-mix(in_oklab,var(--tesla-or)_45%,transparent)]'
          : 'border-dashed border-muted-foreground/40 bg-muted text-muted-foreground/60',
        className,
      )}
      aria-hidden
    >
      <Icon className="size-6" />
    </span>
  );
}

'use client';

import { type CeremonyItem, roleMatches } from '@tesla/shared';
import { LessonBlocks } from '@/components/modules/lesson-content';
import { cn } from '@/lib/utils';

/**
 * Lecture d'une cérémonie : intervenants distincts, paroles en clair, indications scéniques en
 * italique dans un encadré, notes signalées. Avec un rôle choisi (« Mon rôle »), ses répliques sont
 * mises en évidence et la réplique qui les précède est signalée comme repère ; tout le reste reste
 * lisible pour garder le fil. Le rôle choisi n'a aucun effet sur les droits du compte.
 */
export function CeremonyView({
  items,
  role = null,
}: {
  items: readonly CeremonyItem[];
  role?: string | null;
}) {
  const mine = (item: CeremonyItem | undefined) =>
    !!role && item?.kind === 'line' && roleMatches(role, item.role);
  return (
    <div className="space-y-3 leading-relaxed">
      {items.map((item, index) => (
        <CeremonyItemView
          key={index}
          item={item}
          highlight={role ? (mine(item) ? 'mine' : 'other') : null}
          cue={!!role && !mine(item) && mine(items[index + 1])}
        />
      ))}
    </div>
  );
}

export function CeremonyItemView({
  item,
  highlight = null,
  cue = false,
  large = false,
}: {
  item: CeremonyItem;
  /** `mine` : réplique du rôle choisi ; `other` : autre élément (atténué) ; null : lecture simple. */
  highlight?: 'mine' | 'other' | null;
  /** Réplique qui précède immédiatement celle du rôle choisi. */
  cue?: boolean;
  large?: boolean;
}) {
  const dim = highlight === 'other' && !cue;
  switch (item.kind) {
    case 'section':
      return (
        <h3
          className={cn(
            'pt-3 font-semibold tracking-wide text-tesla-bordeaux uppercase',
            large ? 'text-base' : 'text-sm',
          )}
        >
          {item.title}
        </h3>
      );
    case 'line':
      return (
        <div
          className={cn(
            'rounded-lg px-3 py-2 transition-opacity',
            highlight === 'mine' && 'border-l-4 border-tesla-or bg-tesla-sable/50',
            cue && 'border-l-4 border-dashed border-tesla-or/60',
            dim && 'opacity-55',
          )}
        >
          {cue && (
            <p className="text-xs font-semibold tracking-wide text-tesla-rouge uppercase">
              Avant votre réplique
            </p>
          )}
          <p className="font-semibold text-tesla-rouge">
            {item.aside ? item.speaker.replace(/\s*\(.*\)\s*$/, '') : item.speaker}
            {item.aside && (
              <span className="font-normal text-muted-foreground italic"> ({item.aside})</span>
            )}
          </p>
          <div className="space-y-2">
            <LessonBlocks blocks={item.blocks} />
          </div>
        </div>
      );
    case 'direction':
      return (
        <div
          className={cn(
            'space-y-1 border-l-2 border-tesla-or/70 py-1 pl-4 text-[#7a5a2e] italic',
            dim && 'opacity-55',
          )}
        >
          <p className="sr-only">Indication :</p>
          <LessonBlocks blocks={item.blocks} />
        </div>
      );
    case 'note':
      return (
        <div className={cn('rounded-md bg-tesla-sable/50 px-3 py-2', dim && 'opacity-55')}>
          <span className="font-semibold text-tesla-bordeaux">NB : </span>
          <span className="[&>p]:inline">
            <LessonBlocks blocks={item.blocks} />
          </span>
        </div>
      );
    case 'reference':
      return <p className="text-sm text-muted-foreground italic">{item.text}</p>;
    case 'text':
      return (
        <div className={cn('space-y-2', dim && 'opacity-55')}>
          <LessonBlocks blocks={item.blocks} />
        </div>
      );
  }
}

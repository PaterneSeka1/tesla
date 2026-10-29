'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { meQueryOptions } from '@/lib/api/auth';
import { HOME_NAV_ITEM, SPACES, type SpaceKey } from '@/lib/spaces';
import { cn } from '@/lib/utils';

export function SpaceNav({
  space,
  orientation,
}: {
  space: SpaceKey;
  orientation: 'vertical' | 'horizontal';
}) {
  const pathname = usePathname();
  const role = useQuery(meQueryOptions).data?.user.role;
  // Les entrées réservées à un rôle n'apparaissent qu'une fois la session connue.
  const items = [...SPACES[space].nav, HOME_NAV_ITEM].filter(
    (item) => !item.roles || (role !== undefined && item.roles.includes(role)),
  );
  // Entrée active : la correspondance la plus précise (« /chef/modules » plutôt que « /chef »).
  const activeHref = items
    .map((item) => item.href)
    .filter((href) => pathname === href || (href !== '/' && pathname.startsWith(`${href}/`)))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav aria-label="Navigation de l'espace">
      <ul className={cn('flex gap-1', orientation === 'vertical' ? 'flex-col' : 'overflow-x-auto')}>
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === activeHref;
          return (
            <li key={`${href}-${label}`}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                  'focus-visible:ring-[3px] focus-visible:ring-tesla-or/60 focus-visible:outline-none',
                  active
                    ? 'bg-tesla-or text-tesla-bordeaux'
                    : 'text-tesla-sable hover:bg-white/10 hover:text-white',
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

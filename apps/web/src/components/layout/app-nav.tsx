'use client';

import { useQuery } from '@tanstack/react-query';
import { type Role } from '@tesla/shared';
import { ChevronDown, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { useState } from 'react';
import { BrandLogo } from '@/components/brand-logo';
import { UserMenu } from '@/components/auth/user-menu';
import { meQueryOptions } from '@/lib/api/auth';
import {
  findActiveHref,
  findActiveItem,
  NAVIGATION,
  type NavItem,
  ROUTIER_BOTTOM_NAV,
} from '@/lib/navigation';
import { cn } from '@/lib/utils';

/**
 * Rôle utilisé pour la navigation. Les écrans hors ligne n'appartiennent qu'au routier : sans
 * réseau, la session ne peut pas être relue, le menu routier reste donc disponible.
 */
function useNavRole(offline: boolean): Role | undefined {
  const role = useQuery(meQueryOptions).data?.user.role;
  return role ?? (offline ? 'ROUTIER' : undefined);
}

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all active:scale-[0.98]',
        'focus-visible:ring-[3px] focus-visible:ring-tesla-or/60 focus-visible:outline-none',
        active
          ? 'bg-tesla-or text-tesla-bordeaux'
          : 'text-tesla-sable hover:translate-x-0.5 hover:bg-white/10 hover:text-white',
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

/** Navigation groupée selon le rôle (sidebar desktop et tiroir mobile). */
export function AppNav({
  offline = false,
  onNavigate,
  animated = false,
}: {
  offline?: boolean;
  onNavigate?: () => void;
  /** Groupes en cascade à l'ouverture (menu latéral mobile). */
  animated?: boolean;
}) {
  const pathname = usePathname();
  const role = useNavRole(offline);
  if (!role) return <div className="flex-1" aria-hidden />;

  const groups = NAVIGATION[role];
  const activeHref = findActiveHref(
    groups.flatMap((group) => group.items.map((item) => item.href)),
    pathname,
  );

  return (
    <nav aria-label="Navigation principale" className="flex-1 space-y-5 overflow-y-auto pr-1">
      {groups.map((group, index) => {
        const motion = animated
          ? { className: 'animate-rise', style: { '--stagger': index + 1 } as React.CSSProperties }
          : { className: '' };
        // Dans un groupe repliable, les liens remontent à chaque dépliage (affichage relancé).
        const links = (
          <ul className={cn('space-y-0.5', group.collapsible && 'animate-rise')}>
            {group.items.map((item) => (
              <li key={item.href}>
                <NavLink item={item} active={item.href === activeHref} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        );
        const labelClass = 'px-3 text-xs font-semibold tracking-wider text-tesla-or/90 uppercase';
        if (group.collapsible) {
          // Repli natif (clavier et lecteurs d'écran) ; ouvert d'office sur la page active.
          const containsActive = group.items.some((item) => item.href === activeHref);
          return (
            <details
              key={group.label}
              open={containsActive || undefined}
              className="group space-y-1"
            >
              <summary
                className={cn(
                  labelClass,
                  'flex min-h-8 cursor-pointer list-none items-center justify-between rounded-md hover:text-tesla-or focus-visible:ring-[3px] focus-visible:ring-tesla-or/60 focus-visible:outline-none [&::-webkit-details-marker]:hidden',
                )}
              >
                {group.label}
                <ChevronDown
                  className="size-4 transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              {links}
            </details>
          );
        }
        return (
          <div key={group.label} className={cn('space-y-1', motion.className)} style={motion.style}>
            <p className={labelClass}>{group.label}</p>
            {links}
          </div>
        );
      })}
    </nav>
  );
}

/** Titre de la page courante, déduit du menu (en-tête). */
export function CurrentPageTitle({ offline = false }: { offline?: boolean }) {
  const pathname = usePathname();
  const role = useNavRole(offline);
  const item = role ? findActiveItem(role, pathname) : undefined;
  return (
    <p key={pathname} className="animate-fade truncate font-semibold">
      {item?.label ?? 'Nikola Tesla Académie'}
    </p>
  );
}

/** Menu latéral mobile et tablette : toutes les entrées du rôle, profil et déconnexion. */
export function MobileMenu({ offline = false }: { offline?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        className="inline-flex size-11 items-center justify-center rounded-md transition-transform hover:bg-white/10 focus-visible:ring-[3px] focus-visible:ring-tesla-or/60 focus-visible:outline-none active:scale-90"
        aria-label="Ouvrir le menu"
      >
        <Menu className="size-6" aria-hidden />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex w-[min(20rem,85vw)] flex-col gap-5 bg-tesla-bordeaux p-4 text-white shadow-xl',
            'duration-300 ease-out data-[state=open]:animate-in data-[state=open]:slide-in-from-left',
            'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=closed]:duration-200',
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <BrandLogo size={40} />
              <div className="leading-tight">
                <DialogPrimitive.Title className="font-semibold">
                  Nikola Tesla
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-xs text-tesla-sable">
                  Académie
                </DialogPrimitive.Description>
              </div>
            </div>
            <DialogPrimitive.Close
              className="inline-flex size-11 items-center justify-center rounded-md hover:bg-white/10 focus-visible:ring-[3px] focus-visible:ring-tesla-or/60 focus-visible:outline-none"
              aria-label="Fermer le menu"
            >
              <X className="size-5" aria-hidden />
            </DialogPrimitive.Close>
          </div>
          <AppNav offline={offline} onNavigate={() => setOpen(false)} animated />
          <div className="border-t border-white/15 pt-4">
            <UserMenu />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Accès rapides du routier sur mobile (les autres rôles utilisent le menu latéral). */
export function RoutierBottomNav({ offline = false }: { offline?: boolean }) {
  const pathname = usePathname();
  const role = useNavRole(offline);
  if (role !== 'ROUTIER') return null;
  const activeHref = findActiveHref(
    ROUTIER_BOTTOM_NAV.map((item) => item.href),
    pathname,
  );
  return (
    <nav
      aria-label="Accès rapides"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden"
    >
      <ul className="grid grid-cols-4">
        {ROUTIER_BOTTOM_NAV.map(({ href, label, icon: Icon }) => {
          const active = href === activeHref;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors active:scale-95',
                  'focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset',
                  active ? 'text-tesla-rouge' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {/* Pastille de l'onglet actif ; l'icône rebondit quand l'onglet devient actif. */}
                <span
                  className={cn(
                    'flex h-7 w-14 items-center justify-center rounded-full transition-colors duration-300',
                    active && 'bg-tesla-sable',
                  )}
                >
                  <Icon
                    key={String(active)}
                    className={cn('size-5', active && 'animate-pop')}
                    aria-hidden
                  />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Marge basse réservée à la barre d'accès rapides du routier. */
export function BottomNavSpacer({ offline = false }: { offline?: boolean }) {
  const role = useNavRole(offline);
  return role === 'ROUTIER' ? <div className="h-16 lg:hidden print:hidden" aria-hidden /> : null;
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { useState } from 'react';
import { BrandLogo } from '@/components/brand-logo';
import { UserMenu } from '@/components/auth/user-menu';
import { meQueryOptions } from '@/lib/api/auth';
import {
  findActiveGroup,
  findActiveHref,
  findActiveItem,
  navigationFor,
  type NavItem,
  hasPathwayNav,
  type NavUser,
  PATHWAY_BOTTOM_NAV,
} from '@/lib/navigation';
import { cn } from '@/lib/utils';

/**
 * Menu hors ligne : seuls les écrans du parcours personnel fonctionnent sans réseau. Affichage
 * uniquement : aucune décision n'est possible hors connexion (D133).
 */
const OFFLINE_USER: NavUser = {
  permissions: ['progression.readOwn', 'module.read', 'evaluation.take'],
};

/**
 * Utilisateur pour la navigation (permissions effectives). Sans réseau, la session ne peut pas
 * être relue : le menu du parcours personnel reste disponible.
 */
function useNavUser(offline: boolean): NavUser | undefined {
  const user = useQuery(meQueryOptions).data?.user;
  return user ?? (offline ? OFFLINE_USER : undefined);
}

function NavLink({
  item,
  active,
  highlighted = false,
  compact = false,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  /** Rubrique de la page affichée, sans être la page elle-même. */
  highlighted?: boolean;
  /** Sous-page d'une rubrique. */
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 text-sm font-medium transition-all active:scale-[0.98]',
        compact ? 'min-h-9 py-1.5' : 'min-h-11 py-2',
        'focus-visible:ring-[3px] focus-visible:ring-tesla-or/60 focus-visible:outline-none',
        active
          ? 'bg-tesla-or text-tesla-bordeaux'
          : highlighted
            ? 'bg-white/10 text-white'
            : 'text-tesla-sable hover:translate-x-0.5 hover:bg-white/10 hover:text-white',
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

/**
 * Navigation par rubriques selon les permissions (sidebar desktop et tiroir mobile) : une entrée par
 * rubrique ; les pages de la rubrique active s'affichent en dessous.
 */
export function AppNav({
  offline = false,
  onNavigate,
  animated = false,
}: {
  offline?: boolean;
  onNavigate?: () => void;
  /** Rubriques en cascade à l'ouverture (menu latéral mobile). */
  animated?: boolean;
}) {
  const pathname = usePathname();
  const user = useNavUser(offline);
  if (!user) return <div className="flex-1" aria-hidden />;

  const groups = navigationFor(user);
  const activeGroup = findActiveGroup(groups, pathname);
  const activeHref = findActiveHref(
    groups.flatMap((group) => group.items.map((item) => item.href)),
    pathname,
  );

  return (
    <nav aria-label="Navigation principale" className="flex-1 overflow-y-auto pr-1">
      <ul className="space-y-1">
        {groups.map((group, index) => {
          const [first] = group.items;
          if (!first) return null;
          const open = group === activeGroup;
          const motion = animated
            ? {
                className: 'animate-rise',
                style: { '--stagger': index + 1 } as React.CSSProperties,
              }
            : { className: '' };
          return (
            <li key={group.label} className={motion.className} style={motion.style}>
              <NavLink
                item={{ href: first.href, label: group.label, icon: group.icon }}
                active={open && (group.items.length === 1 || first.href === activeHref)}
                highlighted={open}
                onNavigate={onNavigate}
              />
              {open && group.items.length > 1 && (
                <ul className="mt-1 ml-4 animate-rise space-y-0.5 border-l border-white/15 pl-2">
                  {group.items.slice(1).map((item, itemIndex, items) => (
                    <li key={item.href}>
                      {/* Intertitre au premier élément d'une section (rubriques longues). */}
                      {item.section && item.section !== items[itemIndex - 1]?.section && (
                        <p
                          className="px-3 pt-3 pb-1 text-[0.6875rem] font-semibold tracking-wide text-tesla-sable/70 uppercase"
                          aria-hidden
                        >
                          {item.section}
                        </p>
                      )}
                      <NavLink
                        item={item}
                        active={item.href === activeHref}
                        onNavigate={onNavigate}
                        compact
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Titre de la page courante, déduit du menu (en-tête). */
export function CurrentPageTitle({ offline = false }: { offline?: boolean }) {
  const pathname = usePathname();
  const user = useNavUser(offline);
  const item = user ? findActiveItem(user, pathname) : undefined;
  return (
    <p key={pathname} className="animate-fade truncate font-semibold">
      {item?.label ?? 'Nikola Tesla Académie'}
    </p>
  );
}

/** Menu latéral mobile et tablette : toutes les entrées autorisées, profil et déconnexion. */
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
  const user = useNavUser(offline);
  if (!user || !hasPathwayNav(user)) return null;
  const activeHref = findActiveHref(
    PATHWAY_BOTTOM_NAV.map((item) => item.href),
    pathname,
  );
  return (
    <nav
      aria-label="Accès rapides"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden"
    >
      <ul className="grid grid-cols-5">
        {PATHWAY_BOTTOM_NAV.map(({ href, label, icon: Icon }) => {
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
                    'flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-300',
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
  const user = useNavUser(offline);
  return user && hasPathwayNav(user) ? (
    <div className="h-16 lg:hidden print:hidden" aria-hidden />
  ) : null;
}

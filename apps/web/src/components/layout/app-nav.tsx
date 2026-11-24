'use client';

import { useQuery } from '@tanstack/react-query';
import { Ellipsis, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { useEffect, useState } from 'react';
import { UserMenu } from '@/components/auth/user-menu';
import { meQueryOptions } from '@/lib/api/auth';
import {
  activeBottomTab,
  bottomTabsFor,
  findActiveGroup,
  findActiveHref,
  findActiveItem,
  moreNavigationFor,
  navigationFor,
  type NavItem,
  type NavUser,
} from '@/lib/navigation';
import { cn } from '@/lib/utils';

/**
 * Menu hors ligne : seuls les écrans du parcours personnel fonctionnent sans réseau. Affichage
 * uniquement : aucune décision n'est possible hors connexion (D133).
 */
const OFFLINE_USER: NavUser = {
  permissions: ['progression.readOwn', 'results.readOwn', 'module.read', 'evaluation.take'],
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
  collapsed = false,
  onNavigate,
}: {
  item: NavItem;
  /** Sidebar repliée : icône seule, libellé pour les technologies d'assistance et au survol. */
  collapsed?: boolean;
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
      title={collapsed ? item.label : undefined}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 text-sm font-medium transition-all active:scale-[0.98]',
        compact ? 'min-h-9 py-1.5' : 'min-h-11 py-2',
        collapsed && 'justify-center px-0',
        'focus-visible:ring-[3px] focus-visible:ring-tesla-or/60 focus-visible:outline-none',
        active
          ? 'bg-tesla-or text-tesla-bordeaux'
          : highlighted
            ? 'bg-white/10 text-white'
            : 'text-tesla-sable hover:translate-x-0.5 hover:bg-white/10 hover:text-white',
      )}
    >
      <Icon className={cn('shrink-0', collapsed ? 'size-5' : 'size-4')} aria-hidden />
      <span className={collapsed ? 'sr-only' : 'truncate'}>{item.label}</span>
    </Link>
  );
}

/**
 * Navigation par rubriques selon les permissions (sidebar desktop) : une entrée par rubrique ; les
 * pages de la rubrique active s'affichent en dessous (sauf sidebar repliée : icônes seules).
 */
export function AppNav({
  offline = false,
  onNavigate,
  animated = false,
  collapsed = false,
}: {
  offline?: boolean;
  onNavigate?: () => void;
  /** Rubriques en cascade à l'ouverture. */
  animated?: boolean;
  collapsed?: boolean;
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
                active={
                  open && (collapsed || group.items.length === 1 || first.href === activeHref)
                }
                highlighted={open}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
              {open && !collapsed && group.items.length > 1 && (
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

/**
 * Écrans immersifs sans barre inférieure : passation d'une évaluation (classique ou en paliers).
 * Un lien de retour explicite reste affiché par la page ; la barre évite une sortie accidentelle.
 */
/**
 * Mode concentration (D195) : passation, lecture d'une leçon, partie d'un défi. Le cadre (menu,
 * en-tête, barre inférieure) s'efface ; la page porte son propre bouton de retour.
 */
const IMMERSIVE =
  /^\/(evaluations\/[^/]+\/(passer|jeu)|modules\/[^/]+\/lecons\/[^/]+|defis\/[^/]+)(\/|$)/;

export function isImmersivePath(pathname: string): boolean {
  return IMMERSIVE.test(pathname);
}

/** Vrai pendant la saisie dans un champ : la barre libère la place du clavier virtuel. */
function useEditingFocus(): boolean {
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    const isEditable = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLInputElement &&
          !['checkbox', 'radio', 'button', 'submit', 'range', 'file'].includes(target.type)));
    // Retour différé : la barre ne doit pas réapparaître sous le doigt entre l'appui et le
    // relâchement d'un bouton situé en bas d'écran (« Enregistrer »), ce qui annulerait le clic.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onFocusIn = (event: FocusEvent) => {
      clearTimeout(timer);
      if (isEditable(event.target)) setEditing(true);
      else timer = setTimeout(() => setEditing(false), 400);
    };
    const onFocusOut = (event: FocusEvent) => {
      if (isEditable(event.relatedTarget)) return;
      clearTimeout(timer);
      timer = setTimeout(() => setEditing(false), 400);
    };
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);
  return editing;
}

const TAB_CLASS = cn(
  'flex min-h-14 w-full flex-col items-center justify-center gap-1 text-xs font-medium transition-colors active:scale-95',
  'focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset',
);

function TabIcon({ icon: Icon, active }: { icon: NavItem['icon']; active: boolean }) {
  return (
    // Pastille de l'onglet actif ; l'icône rebondit quand l'onglet devient actif.
    <span
      className={cn(
        'flex h-7 w-14 items-center justify-center rounded-full transition-colors duration-300',
        active && 'bg-tesla-sable',
      )}
    >
      <Icon key={String(active)} className={cn('size-5', active && 'animate-pop')} aria-hidden />
    </span>
  );
}

/**
 * Barre inférieure mobile et tablette (D182), commune à tous les comptes : trois destinations
 * déduites des permissions puis « Plus » (toutes les autres rubriques, profil, déconnexion).
 * Masquée sur ordinateur (sidebar), à l'impression, pendant une passation et pendant la saisie.
 */
export function BottomNav({ offline = false }: { offline?: boolean }) {
  const pathname = usePathname();
  const user = useNavUser(offline);
  const editing = useEditingFocus();
  const [moreOpen, setMoreOpen] = useState(false);
  if (!user || isImmersivePath(pathname)) return null;
  const tabs = bottomTabsFor(user);
  const active = activeBottomTab(user, pathname);
  const groups = moreNavigationFor(user);
  const activeHref = findActiveHref(
    groups.flatMap((group) => group.items.map((item) => item.href)),
    pathname,
  );
  const moreActive = active === null;

  return (
    <nav
      aria-label="Navigation principale mobile"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_8px_rgb(0_0_0/0.04)] lg:hidden print:hidden',
        editing && 'max-lg:hidden',
      )}
    >
      <ul className={cn('mx-auto grid max-w-xl', tabs.length >= 4 ? 'grid-cols-5' : 'grid-cols-4')}>
        {tabs.map((tab) => {
          const current = tab.href === active?.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  TAB_CLASS,
                  current ? 'text-tesla-rouge' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <TabIcon icon={tab.icon} active={current} />
                {tab.label}
              </Link>
            </li>
          );
        })}
        <li className={tabs.length >= 4 ? 'col-start-5' : 'col-start-4'}>
          <DialogPrimitive.Root open={moreOpen} onOpenChange={setMoreOpen}>
            <DialogPrimitive.Trigger
              className={cn(
                TAB_CLASS,
                moreActive ? 'text-tesla-rouge' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <TabIcon icon={Ellipsis} active={moreActive} />
              Plus
              {moreActive && <span className="sr-only"> (rubrique de la page affichée)</span>}
            </DialogPrimitive.Trigger>
            <DialogPrimitive.Portal>
              <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
              <DialogPrimitive.Content
                className={cn(
                  'fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85dvh] max-w-xl flex-col rounded-t-2xl bg-card text-card-foreground shadow-xl',
                  'pb-[env(safe-area-inset-bottom)] duration-200 ease-out',
                  'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom',
                  'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom',
                )}
              >
                <div className="flex items-center justify-between gap-3 border-b px-4 py-2">
                  <DialogPrimitive.Title className="font-semibold">Plus</DialogPrimitive.Title>
                  <DialogPrimitive.Description className="sr-only">
                    Toutes les autres pages auxquelles vous avez accès.
                  </DialogPrimitive.Description>
                  <DialogPrimitive.Close
                    className="inline-flex size-11 items-center justify-center rounded-md hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    aria-label="Fermer"
                  >
                    <X className="size-5" aria-hidden />
                  </DialogPrimitive.Close>
                </div>
                <div className="space-y-5 overflow-y-auto overscroll-contain px-4 py-4">
                  {groups.map((group) => (
                    <section key={group.label} aria-label={group.label} className="space-y-1.5">
                      <h2 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        {group.label}
                      </h2>
                      <ul className="grid grid-cols-2 gap-1.5">
                        {group.items.map((item) => {
                          const Icon = item.icon;
                          const current = item.href === activeHref;
                          return (
                            <li key={item.href}>
                              <Link
                                href={item.href}
                                onClick={() => setMoreOpen(false)}
                                aria-current={current ? 'page' : undefined}
                                className={cn(
                                  'flex min-h-12 items-center gap-2.5 rounded-lg border px-3 py-2 text-sm font-medium',
                                  'focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                                  current
                                    ? 'border-tesla-or bg-tesla-sable/60 text-tesla-bordeaux'
                                    : 'hover:bg-muted',
                                )}
                              >
                                <Icon className="size-4 shrink-0 text-tesla-rouge" aria-hidden />
                                <span className="min-w-0 leading-tight">{item.label}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))}
                  <div className="border-t pt-3">
                    <UserMenu tone="light" onNavigate={() => setMoreOpen(false)} />
                  </div>
                </div>
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>
        </li>
      </ul>
    </nav>
  );
}

/** Marge basse réservée à la barre inférieure (hauteur de la barre et zone de sécurité). */
export function BottomNavSpacer({ offline = false }: { offline?: boolean }) {
  const pathname = usePathname();
  const user = useNavUser(offline);
  return user && !isImmersivePath(pathname) ? (
    <div
      className="h-[calc(3.5rem+env(safe-area-inset-bottom))] lg:hidden print:hidden"
      aria-hidden
    />
  ) : null;
}

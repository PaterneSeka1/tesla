'use client';

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { SessionGate } from '@/components/auth/session-gate';
import { UserMenu } from '@/components/auth/user-menu';
import { BrandLogo } from '@/components/brand-logo';
import { NotificationsDialog } from '@/components/notifications/notifications-dialog';
import { DeviceStatus } from '@/components/offline/device-status';
import { PracticeSync } from '@/components/practice/practice-sync';
import { cn } from '@/lib/utils';
import { PageTransition } from './page-transition';
import { AppNav, BottomNav, BottomNavSpacer, CurrentPageTitle, isImmersivePath } from './app-nav';

/** Préférence d'affichage de cet appareil seulement (aucune donnée personnelle). */
const COLLAPSED_KEY = 'tesla.sidebar.collapsed';

const listeners = new Set<() => void>();

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean) {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, value ? '1' : '0');
  } catch {
    // Stockage indisponible (navigation privée) : préférence non conservée.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Cadre unique de l'application connectée : la navigation dépend des permissions, jamais de l'URL
 * (D132). Ordinateur (≥ 1024 px) : sidebar fixe et repliable (bouton à côté du logo). Téléphone et
 * tablette : en-tête compact et barre inférieure commune à tous les comptes (D182). Le contenu n'est
 * affiché qu'après vérification de la session et de l'accès au chemin (`SessionGate`), sauf pour
 * les écrans hors ligne.
 */
export function DashboardShell({
  children,
  offline = false,
}: {
  offline?: boolean;
  children: React.ReactNode;
}) {
  // Serveur et premier rendu : sidebar dépliée ; la préférence de l'appareil s'applique ensuite.
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);
  const toggle = () => writeCollapsed(!collapsed);
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  // Mode concentration : seul le contenu reste (hors ligne compris, pour une leçon téléchargée).
  const focus = isImmersivePath(usePathname());

  return (
    <div
      className={cn(
        'min-h-dvh lg:grid print:block',
        focus ? 'lg:block' : collapsed ? 'lg:grid-cols-[4.5rem_1fr]' : 'lg:grid-cols-[17rem_1fr]',
      )}
    >
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-white focus:px-3 focus:py-2"
      >
        Aller au contenu
      </a>

      <aside
        className={cn(
          'hidden bg-tesla-bordeaux text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:gap-5 print:hidden!',
          collapsed ? 'px-2 py-4' : 'p-4',
          focus && 'lg:hidden',
        )}
      >
        <div className={cn('flex items-center gap-2', collapsed ? 'flex-col' : 'pl-1')}>
          <BrandLogo size={collapsed ? 36 : 40} />
          {!collapsed && (
            <div className="min-w-0 flex-1 leading-tight">
              <p className="font-semibold">Nikola Tesla</p>
              <p className="text-xs text-tesla-sable">Académie</p>
            </div>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Déplier le menu' : 'Replier le menu'}
            title={collapsed ? 'Déplier le menu' : 'Replier le menu'}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-tesla-sable hover:bg-white/10 hover:text-white focus-visible:ring-[3px] focus-visible:ring-tesla-or/60 focus-visible:outline-none"
          >
            <ToggleIcon className="size-5" aria-hidden />
          </button>
        </div>
        <AppNav offline={offline} collapsed={collapsed} />
        {!collapsed && <DeviceStatus />}
        <div className="border-t border-white/15 pt-4">
          <UserMenu compact={collapsed} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header
          className={cn(
            'sticky top-0 z-30 bg-tesla-bordeaux pt-[env(safe-area-inset-top)] text-white lg:hidden print:hidden',
            focus && 'hidden',
          )}
        >
          <div className="flex h-12 items-center gap-2.5 px-4">
            <BrandLogo size={28} />
            <div className="min-w-0 flex-1">
              <CurrentPageTitle offline={offline} />
            </div>
          </div>
          <DeviceStatus className="px-4 pb-2" />
        </header>

        <main
          id="contenu"
          className={cn(
            'mx-auto w-full flex-1 space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-8 print:p-0',
            focus ? 'max-w-3xl pt-[max(1.25rem,env(safe-area-inset-top))]' : 'max-w-7xl',
          )}
        >
          {offline ? (
            <PageTransition>{children}</PageTransition>
          ) : (
            <SessionGate>
              <NotificationsDialog />
              <PracticeSync />
              <PageTransition>{children}</PageTransition>
            </SessionGate>
          )}
        </main>
        <BottomNavSpacer offline={offline} />
      </div>
      <BottomNav offline={offline} />
    </div>
  );
}

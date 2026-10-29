import { SessionGate } from '@/components/auth/session-gate';
import { UserMenu } from '@/components/auth/user-menu';
import { BrandLogo } from '@/components/brand-logo';
import { PageTransition } from './page-transition';
import { AppNav, BottomNavSpacer, CurrentPageTitle, MobileMenu, RoutierBottomNav } from './app-nav';

/**
 * Cadre unique de l'application connectée : la navigation dépend du rôle, jamais de l'URL.
 * Desktop : sidebar groupée (titre porté par la page) ; mobile et tablette : en-tête compact
 * et menu latéral, plus une barre
 * d'accès rapides pour le routier. Le contenu n'est affiché qu'après vérification de la session et
 * de l'accès au chemin (`SessionGate`), sauf pour les écrans hors ligne.
 */
export function DashboardShell({
  children,
  offline = false,
}: {
  offline?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr] print:block">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-white focus:px-3 focus:py-2"
      >
        Aller au contenu
      </a>

      <aside className="hidden bg-tesla-bordeaux p-4 text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:gap-6 print:hidden!">
        <div className="flex items-center gap-3 px-1">
          <BrandLogo size={44} />
          <div className="leading-tight">
            <p className="font-semibold">Nikola Tesla</p>
            <p className="text-xs text-tesla-sable">Académie</p>
          </div>
        </div>
        <AppNav offline={offline} />
        <div className="border-t border-white/15 pt-4">
          <UserMenu />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 bg-tesla-bordeaux text-white lg:hidden print:hidden">
          <div className="flex h-14 items-center gap-2 px-2 sm:px-4">
            <MobileMenu offline={offline} />
            <BrandLogo size={32} />
            <div className="min-w-0 flex-1">
              <CurrentPageTitle offline={offline} />
            </div>
          </div>
        </header>

        <main
          id="contenu"
          className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:p-0"
        >
          {offline ? (
            <PageTransition>{children}</PageTransition>
          ) : (
            <SessionGate>
              <PageTransition>{children}</PageTransition>
            </SessionGate>
          )}
        </main>
        <BottomNavSpacer offline={offline} />
      </div>
      <RoutierBottomNav offline={offline} />
    </div>
  );
}

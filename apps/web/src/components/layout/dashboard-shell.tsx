import { SessionGate } from '@/components/auth/session-gate';
import { UserMenu } from '@/components/auth/user-menu';
import { ApiStatus } from '@/components/api-status';
import { BrandLogo } from '@/components/brand-logo';
import { SPACES, type SpaceKey } from '@/lib/spaces';
import { SpaceNav } from './space-nav';

/**
 * Structure responsive commune aux espaces : sidebar sur desktop, navigation horizontale sur mobile.
 * Le contenu n'est affiché qu'après vérification de la session et du rôle (`SessionGate`).
 */
export function DashboardShell({
  space,
  children,
}: {
  space: SpaceKey;
  children: React.ReactNode;
}) {
  const config = SPACES[space];

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-white focus:px-3 focus:py-2"
      >
        Aller au contenu
      </a>

      <aside className="hidden bg-tesla-bordeaux p-4 text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:gap-6">
        <div className="flex items-center gap-3">
          <BrandLogo size={44} />
          <div className="leading-tight">
            <p className="font-semibold">Nikola Tesla</p>
            <p className="text-xs text-tesla-sable">Académie</p>
          </div>
        </div>
        <SpaceNav space={space} orientation="vertical" />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="bg-tesla-bordeaux text-white lg:border-b lg:bg-white lg:text-foreground">
          <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <BrandLogo size={36} className="lg:hidden" />
              <h1 className="truncate font-semibold">{config.title}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <div className="hidden md:block">
                <ApiStatus />
              </div>
              <UserMenu />
            </div>
          </div>
          <div className="px-2 pb-2 lg:hidden">
            <SpaceNav space={space} orientation="horizontal" />
          </div>
        </header>

        <main id="contenu" className="flex-1 space-y-6 px-4 py-6 lg:px-8">
          <SessionGate roles={config.roles}>{children}</SessionGate>
        </main>
      </div>
    </div>
  );
}

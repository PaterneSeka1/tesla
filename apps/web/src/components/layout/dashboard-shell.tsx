import { Info } from 'lucide-react';
import { ROLE_LABELS } from '@tesla/shared';
import { ApiStatus } from '@/components/api-status';
import { BrandLogo } from '@/components/brand-logo';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SPACES, type SpaceKey } from '@/lib/spaces';
import { SpaceNav } from './space-nav';

/** Structure responsive commune aux espaces routier, chef et responsable. */
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

      <aside className="hidden bg-tesla-bordeaux p-4 text-white lg:flex lg:flex-col lg:gap-6">
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
        <header className="bg-tesla-bordeaux text-white lg:bg-white lg:text-foreground lg:border-b">
          <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-8">
            <div className="flex items-center gap-3">
              <BrandLogo size={36} className="lg:hidden" />
              <div>
                <p className="text-xs uppercase tracking-wide opacity-80">
                  {ROLE_LABELS[config.role]}
                </p>
                <h1 className="font-semibold">{config.title}</h1>
              </div>
            </div>
            <ApiStatus />
          </div>
          <div className="px-2 pb-2 lg:hidden">
            <SpaceNav space={space} orientation="horizontal" />
          </div>
        </header>

        <main id="contenu" className="flex-1 space-y-6 px-4 py-6 lg:px-8">
          <Alert variant="info">
            <Info aria-hidden />
            <AlertTitle>Aperçu de structure</AlertTitle>
            <AlertDescription>
              L’authentification n’est pas encore en place : cet espace n’affiche aucune donnée
              personnelle et n’est pas protégé. L’accès sera restreint par rôle dans la phase 1.
            </AlertDescription>
          </Alert>
          {children}
        </main>
      </div>
    </div>
  );
}

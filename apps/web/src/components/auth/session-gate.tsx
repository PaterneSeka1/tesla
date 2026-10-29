'use client';

import { useQuery } from '@tanstack/react-query';
import { type SessionUser } from '@tesla/shared';
import { CloudOff, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, use, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toaster';
import { ApiError } from '@/lib/api/client';
import { meQueryOptions } from '@/lib/api/auth';
import { canAccessPath, getDefaultRouteForUser } from '@/lib/navigation';

const SessionContext = createContext<SessionUser | null>(null);

/** Utilisateur connecté (disponible sous `SessionGate`). */
export function useSessionUser(): SessionUser {
  const user = use(SessionContext);
  if (!user) throw new Error('useSessionUser doit être utilisé sous <SessionGate>.');
  return user;
}

/**
 * Vérifie la session auprès de l'API (`/auth/me`) puis l'accès du rôle au chemin affiché
 * (`canAccessPath`). Session absente ou expirée : connexion, avec retour à la page demandée.
 * Chemin non autorisé : retour au tableau de bord du rôle, avec un message explicite.
 * Confort d'affichage uniquement : chaque route de l'API vérifie elle-même session et permissions.
 */
export function SessionGate({ children }: { children: React.ReactNode }) {
  const { data, error, isPending, refetch, isRefetching } = useQuery(meQueryOptions);
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const unauthenticated = error instanceof ApiError && error.status === 401;
  const forbidden = data !== undefined && !canAccessPath(data.user, pathname);
  const home = data ? getDefaultRouteForUser(data.user) : null;

  useEffect(() => {
    if (unauthenticated) router.replace(`/connexion?suivant=${encodeURIComponent(pathname)}`);
  }, [unauthenticated, router, pathname]);

  useEffect(() => {
    if (!forbidden || !home) return;
    toast.error('Page non accessible avec votre rôle', 'Retour à votre tableau de bord.');
    router.replace(home);
  }, [forbidden, home, router, toast]);

  if (isPending || unauthenticated || forbidden) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Vérification de la session">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (error) {
    const network = error instanceof ApiError && error.status === 0;
    return (
      <Alert variant="destructive">
        {network ? <CloudOff aria-hidden /> : <ShieldAlert aria-hidden />}
        <AlertTitle>Session impossible à vérifier</AlertTitle>
        <AlertDescription>
          <p>{error.message}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isRefetching}
            >
              Réessayer
            </Button>
            {network && (
              <Button asChild variant="outline" size="sm">
                <Link href="/hors-ligne">Contenus hors ligne</Link>
              </Button>
            )}
          </div>
        </AlertDescription>
      </Alert>
    );
  }
  return <SessionContext value={data.user}>{children}</SessionContext>;
}

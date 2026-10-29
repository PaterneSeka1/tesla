'use client';

import { useQuery } from '@tanstack/react-query';
import { type Role, type SessionUser } from '@tesla/shared';
import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, use, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/client';
import { meQueryOptions } from '@/lib/api/auth';
import { ROLE_HOME } from '@/lib/spaces';

const SessionContext = createContext<SessionUser | null>(null);

/** Utilisateur connecté (disponible sous `SessionGate`). */
export function useSessionUser(): SessionUser {
  const user = use(SessionContext);
  if (!user) throw new Error('useSessionUser doit être utilisé sous <SessionGate>.');
  return user;
}

/**
 * Vérifie la session auprès de l'API (`/auth/me`) et le rôle avant d'afficher un espace.
 * Confort d'affichage uniquement : chaque route de l'API vérifie elle-même session et permissions.
 */
export function SessionGate({
  roles,
  children,
}: {
  roles: readonly Role[];
  children: React.ReactNode;
}) {
  const { data, error, isPending, refetch } = useQuery(meQueryOptions);
  const router = useRouter();
  const pathname = usePathname();
  const unauthenticated = error instanceof ApiError && error.status === 401;

  useEffect(() => {
    if (unauthenticated) router.replace(`/connexion?suivant=${encodeURIComponent(pathname)}`);
  }, [unauthenticated, router, pathname]);

  if (isPending || unauthenticated) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Vérification de la session">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (error) {
    return (
      <Alert variant="destructive">
        <ShieldAlert aria-hidden />
        <AlertTitle>Session impossible à vérifier</AlertTitle>
        <AlertDescription>
          <p>{error.message}</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Réessayer
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  if (!roles.includes(data.user.role)) {
    return (
      <Alert variant="destructive">
        <ShieldAlert aria-hidden />
        <AlertTitle>Accès refusé</AlertTitle>
        <AlertDescription>
          <p>Cet espace n’est pas accessible avec votre rôle.</p>
          <Button asChild variant="outline" size="sm">
            <Link href={ROLE_HOME[data.user.role]}>Aller à mon espace</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  return <SessionContext value={data.user}>{children}</SessionContext>;
}

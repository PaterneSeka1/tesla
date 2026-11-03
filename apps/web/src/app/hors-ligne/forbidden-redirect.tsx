'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useToast } from '@/components/ui/toaster';
import { meQueryOptions } from '@/lib/api/auth';
import { canAccessPath, HOME_ROUTE } from '@/lib/navigation';

/**
 * Le service worker sert ce repli à l'adresse demandée : une page non préparée parce qu'elle n'est
 * pas accessible à l'utilisateur (identité serveur ou locale) renvoie à l'accueil, comme
 * `SessionGate` en ligne. Confort d'affichage uniquement : l'API vérifie chaque permission.
 */
export function ForbiddenRedirect() {
  const { data } = useQuery(meQueryOptions);
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    if (!data) return;
    // `window.location` : l'adresse demandée, pas celle du repli (/hors-ligne) mis en cache.
    const { pathname } = window.location;
    if (pathname === '/hors-ligne' || canAccessPath(data.user, pathname)) return;
    toast.error('Cette page ne vous est pas accessible', 'Retour à l’accueil.');
    router.replace(HOME_ROUTE);
  }, [data, router, toast]);

  return null;
}

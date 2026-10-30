'use client';

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { OfflineRuntime } from '@/components/offline-runtime';
import { meQueryOptions } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    // Session expirée (401) ou droits retirés côté serveur (403, ex. changement de responsable
    // plein) : la session est relue. `SessionGate` renvoie alors vers la connexion ou l'accueil, et
    // le menu suit les permissions à jour (D132).
    const onError = (error: Error, queryKey?: readonly unknown[]) => {
      if (!(error instanceof ApiError) || (error.status !== 401 && error.status !== 403)) return;
      if (queryKey?.join('/') === meQueryOptions.queryKey.join('/')) return;
      void client.invalidateQueries({ queryKey: meQueryOptions.queryKey });
    };
    const client: QueryClient = new QueryClient({
      queryCache: new QueryCache({ onError: (error, query) => onError(error, query.queryKey) }),
      mutationCache: new MutationCache({ onError: (error) => onError(error) }),
      defaultOptions: {
        // Hors connexion, `apiFetch` sert les copies locales : les requêtes ne sont jamais suspendues.
        mutations: { networkMode: 'always' },
        queries: {
          networkMode: 'always',
          staleTime: 60_000,
          refetchOnWindowFocus: false,
          // Pas de nouvel essai sur une erreur client (401, 403, 404…) : le résultat ne changera pas.
          retry: (failureCount, error) =>
            !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
            failureCount < 2,
        },
      },
    });
    return client;
  });
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster>
        <OfflineRuntime />
        {children}
      </Toaster>
    </QueryClientProvider>
  );
}

'use client';

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { OfflineRuntime } from '@/components/offline-runtime';
import { meQueryOptions } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    // Session expirée pendant l'utilisation : une réponse 401 d'une donnée fait relire la session ;
    // `SessionGate` renvoie alors vers la connexion, avec retour à la page en cours.
    const onError = (error: Error, queryKey?: readonly unknown[]) => {
      if (!(error instanceof ApiError) || error.status !== 401) return;
      if (queryKey?.join('/') === meQueryOptions.queryKey.join('/')) return;
      void client.invalidateQueries({ queryKey: meQueryOptions.queryKey });
    };
    const client: QueryClient = new QueryClient({
      queryCache: new QueryCache({ onError: (error, query) => onError(error, query.queryKey) }),
      mutationCache: new MutationCache({ onError: (error) => onError(error) }),
      defaultOptions: {
        queries: {
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

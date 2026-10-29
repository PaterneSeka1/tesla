'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { OfflineRuntime } from '@/components/offline-runtime';
import { ApiError } from '@/lib/api/client';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
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
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster>
        <OfflineRuntime />
        {children}
      </Toaster>
    </QueryClientProvider>
  );
}

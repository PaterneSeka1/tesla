'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { healthQueryOptions } from '@/lib/api/health';

/** État réel de l'API, interrogé via GET /api/v1/health. */
export function ApiStatus() {
  const { data, isPending, isError, error } = useQuery(healthQueryOptions);

  if (isPending) return <Badge variant="secondary">Vérification du serveur…</Badge>;
  if (isError) {
    return (
      <Badge variant="destructive" title={error.message}>
        Serveur injoignable
      </Badge>
    );
  }
  if (data.status === 'degraded') {
    return <Badge variant="accent">API active — base de données indisponible</Badge>;
  }
  return <Badge variant="success">Serveur opérationnel · v{data.version}</Badge>;
}

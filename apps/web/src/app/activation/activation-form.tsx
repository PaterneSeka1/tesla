'use client';

import { CircleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ACCOUNT_LINK_PAGES, inspectAccountLink } from '@/lib/api/accounts';

/** Interroge l'ancienne route (sans consommer le lien) pour connaître sa finalité, puis redirige. */
export function LegacyLinkRedirect() {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const hash = window.location.hash;
    let token = '';
    try {
      token = decodeURIComponent(hash.slice(1));
    } catch {
      // fragment illisible : traité comme absent
    }
    if (!token) {
      window.location.replace('/inscription');
      return;
    }
    inspectAccountLink(token)
      .then((info) => window.location.replace(`${ACCOUNT_LINK_PAGES[info.purpose]}${hash}`))
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Lien inutilisable.'),
      );
  }, []);
  if (!error) return <Skeleton className="h-32" aria-label="Vérification du lien" />;
  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden />
      <AlertTitle>Lien inutilisable</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );
}

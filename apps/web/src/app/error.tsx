'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold text-tesla-bordeaux">Une erreur est survenue</h1>
      <p className="max-w-md text-muted-foreground">
        L’opération n’a pas pu aboutir. Vous pouvez réessayer ; si le problème persiste, prévenez un
        responsable.
      </p>
      {error.digest && <p className="text-xs text-muted-foreground">Référence : {error.digest}</p>}
      <Button onClick={reset}>Réessayer</Button>
    </main>
  );
}

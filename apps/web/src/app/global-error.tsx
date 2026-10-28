'use client';

/** Dernier recours si le layout racine échoue : HTML minimal sans dépendance au thème. */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body
        style={{ fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '4rem 1rem' }}
      >
        <h1 style={{ color: '#510D12' }}>Une erreur critique est survenue</h1>
        <p>Veuillez recharger la page.</p>
        <button type="button" onClick={reset}>
          Réessayer
        </button>
      </body>
    </html>
  );
}

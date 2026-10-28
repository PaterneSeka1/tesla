import type { Metadata } from 'next';
import { WifiOff } from 'lucide-react';

export const metadata: Metadata = { title: 'Hors ligne' };

/** Page de repli servie par le service worker lorsqu'aucune connexion n'est disponible. */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <WifiOff className="size-12 text-tesla-rouge" aria-hidden />
      <h1 className="text-2xl font-semibold text-tesla-bordeaux">Vous êtes hors ligne</h1>
      <p className="max-w-md text-muted-foreground">
        Cette page n’est pas disponible sans connexion. Les modules téléchargés pourront être lus
        hors ligne lorsque cette fonctionnalité sera activée.
      </p>
      {/* Rechargement complet volontaire : retente le réseau au lieu d'une navigation client. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="text-tesla-rouge underline underline-offset-4">
        Réessayer
      </a>
    </main>
  );
}

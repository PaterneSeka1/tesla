import { CloudOff } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { PageHeading } from '@/components/page-heading';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Page non disponible' };

/**
 * Repli du service worker pour une page jamais préparée sur cet appareil (D114). Coquille publique
 * et générique : aucune donnée de compte. Les pages préparées s'ouvrent normalement, sans passer ici.
 */
export default function OfflineFallbackPage() {
  return (
    <DashboardShell offline>
      <PageHeading title="Page non disponible sans connexion" />
      <div className="flex max-w-prose items-start gap-3 text-sm">
        <CloudOff className="mt-0.5 size-5 shrink-0" aria-hidden />
        <p>
          Cette page n’a pas encore été préparée sur cet appareil. Les autres rubriques restent
          accessibles ; avec Internet, mettez à jour la préparation depuis « Cet appareil ».
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/connexion">Tableau de bord</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/appareil">Cet appareil</Link>
        </Button>
      </div>
    </DashboardShell>
  );
}

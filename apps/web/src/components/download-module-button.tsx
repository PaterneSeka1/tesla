'use client';
import { CloudDownload } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { downloadModule } from '@/lib/offline/downloads';
import { ownerId } from '@/lib/offline/vault';
export function DownloadModuleButton({ slug }: { slug: string }) {
  const [message, setMessage] = useState('');
  const [needsDevice, setNeedsDevice] = useState(false);
  const [busy, setBusy] = useState(false);
  async function download() {
    if (!ownerId()) {
      setNeedsDevice(true);
      setMessage('Activez d’abord cet appareil pour lire hors ligne.');
      return;
    }
    setBusy(true);
    try {
      await downloadModule(slug, setMessage);
    } catch (e) {
      setMessage(
        `Téléchargement incomplet : ${e instanceof Error ? e.message : 'Recommencez en ligne.'}`,
      );
    } finally {
      setBusy(false);
    }
  }
  // Action secondaire et discrète (D200) : le détail du stockage se gère dans « Cet appareil ».
  return (
    <div className="space-y-1">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3"
        disabled={busy}
        onClick={() => void download()}
      >
        <CloudDownload aria-hidden />
        Rendre disponible hors ligne
      </Button>
      {message && (
        <p role="status" className="text-sm text-muted-foreground">
          {message}{' '}
          {needsDevice && (
            <Link
              href="/appareil"
              className="font-medium text-tesla-rouge underline-offset-4 hover:underline"
            >
              Cet appareil
            </Link>
          )}
        </p>
      )}
    </div>
  );
}

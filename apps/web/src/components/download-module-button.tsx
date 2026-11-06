'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { downloadModule } from '@/lib/offline/downloads';
import { ownerId } from '@/lib/offline/vault';
export function DownloadModuleButton({ slug }: { slug: string }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function download() {
    if (!ownerId()) {
      setMessage('Activez ou déverrouillez d’abord le stockage dans « Cet appareil ».');
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
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => void download()}>
          Rendre disponible hors ligne
        </Button>
        <Button asChild variant="outline">
          <Link href="/appareil">Cet appareil</Link>
        </Button>
      </div>
      {message && <p role="status">{message}</p>}
    </div>
  );
}

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
      setMessage(
        'Ouvrez « Mes téléchargements » pour activer ou déverrouiller le stockage local, puis revenez ici.',
      );
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
    <div className="space-y-2 rounded border bg-card p-4 text-foreground">
      <div className="flex flex-wrap gap-3">
        <Button disabled={busy} onClick={() => void download()}>
          Télécharger pour lire hors ligne
        </Button>
        <Button asChild variant="outline">
          <Link href="/telechargements">Mes téléchargements</Link>
        </Button>
      </div>
      {message && <p role="status">{message}</p>}
    </div>
  );
}

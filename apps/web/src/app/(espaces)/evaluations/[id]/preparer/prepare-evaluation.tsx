'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BackLink } from '@/components/back-link';
import { useSessionUser } from '@/components/auth/session-gate';
import { DeviceUnlock } from '@/components/offline/device-unlock';
import { PageHeading } from '@/components/page-heading';
import { Button } from '@/components/ui/button';
import { meQueryOptions } from '@/lib/api/auth';
import { prepareEvaluation } from '@/lib/offline/attempts';
import { ensureVaultRestored, hasVaultFor, ownerId } from '@/lib/offline/vault';

/**
 * Préparation en ligne d'une passation sans connexion : le serveur vérifie éligibilité, déblocage
 * et limite de tentatives, puis réserve une tentative pour 24 heures (D78) ; le questionnaire,
 * sans corrigé, est conservé chiffré sur l'appareil.
 */
export function PrepareEvaluation() {
  const { id } = useParams<{ id: string }>();
  const user = useSessionUser();
  const local = useQuery(meQueryOptions).data?.local;
  const router = useRouter();
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [exists, setExists] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const refresh = () => {
      void ensureVaultRestored()
        .then(async () => {
          setExists(await hasVaultFor(user.id));
          setUnlocked(ownerId() === user.id);
        })
        .catch(() => setUnlocked(false));
    };
    refresh();
    window.addEventListener('offline-vault-change', refresh);
    return () => window.removeEventListener('offline-vault-change', refresh);
  }, [user.id]);
  return (
    <>
      <BackLink href={`/evaluations/${id}`}>Évaluation</BackLink>
      <PageHeading title="Passer sans connexion" />
      <p className="max-w-prose text-sm">
        Une tentative est réservée pendant 24 heures : vos réponses doivent parvenir au serveur dans
        ce délai. Le questionnaire est conservé chiffré sur cet appareil, sans les réponses
        attendues.
      </p>
      {unlocked === false && <DeviceUnlock user={user} create={!exists} />}
      {unlocked && (
        <Button
          disabled={busy || local}
          onClick={() => {
            setBusy(true);
            setError('');
            prepareEvaluation(id)
              .then(() => router.push(`/evaluations/${id}/passer`))
              .catch((e: unknown) => {
                setError(e instanceof Error ? e.message : 'Préparation impossible.');
                setBusy(false);
              });
          }}
        >
          Vérifier mes droits et préparer
        </Button>
      )}
      {local && <p className="text-sm">La préparation nécessite une connexion.</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </>
  );
}

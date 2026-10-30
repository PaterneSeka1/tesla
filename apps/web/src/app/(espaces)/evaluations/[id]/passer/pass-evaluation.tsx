'use client';

import { CloudOff } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BackLink } from '@/components/back-link';
import { OfflineAttempt } from '@/components/offline-attempt';
import { TableSkeleton } from '@/components/query-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { findLocalAttempt } from '@/lib/offline/attempts';
import { ensureVaultRestored } from '@/lib/offline/vault';
import { TakeEvaluation } from './take-evaluation';

/**
 * Passation dans son écran habituel (D117) : une copie préparée sur cet appareil est reprise ici,
 * avec ou sans réseau ; sinon passation en ligne. Sans réseau ni copie préparée, aucune
 * tentative ne peut être ouverte (la réservation exige le serveur).
 */
export function PassEvaluation() {
  const { id } = useParams<{ id: string }>();
  const [local, setLocal] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    void ensureVaultRestored()
      .then(() => findLocalAttempt(id))
      .then((copy) => !cancelled && setLocal(copy?.package.session.id ?? null))
      .catch(() => !cancelled && setLocal(null));
    return () => {
      cancelled = true;
    };
  }, [id]);
  if (local === undefined) return <TableSkeleton rows={5} />;
  if (local)
    return (
      <>
        <BackLink href={`/evaluations/${id}`}>Évaluation</BackLink>
        <OfflineAttempt id={local} />
      </>
    );
  if (typeof navigator !== 'undefined' && !navigator.onLine)
    return (
      <>
        <BackLink href={`/evaluations/${id}`}>Évaluation</BackLink>
        <Alert>
          <CloudOff aria-hidden />
          <AlertTitle>Hors connexion</AlertTitle>
          <AlertDescription>
            Cette évaluation n’a pas été préparée sur cet appareil. Avec Internet, choisissez «
            Préparer pour passer sans connexion » : vos droits sont vérifiés et une tentative est
            réservée.
          </AlertDescription>
        </Alert>
      </>
    );
  return <TakeEvaluation />;
}

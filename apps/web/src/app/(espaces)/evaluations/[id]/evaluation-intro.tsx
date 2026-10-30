'use client';

import { useQuery } from '@tanstack/react-query';
import { ATTEMPT_STATUS_LABELS, ELIGIBILITY_LABELS } from '@tesla/shared';
import { CircleAlert, Play } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BackLink } from '@/components/back-link';
import { AttemptStatusBadge } from '@/components/evaluations/attempt-status-badge';
import { EligibilityBadge } from '@/components/evaluations/eligibility-badge';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { availableEvaluationQueryOptions, myAttemptsQueryOptions } from '@/lib/api/evaluations';
import { formatDateTime, formatDuration } from '@/lib/format';
import { findLocalAttempt, SYNC_STATE_LABELS, type SyncState } from '@/lib/offline/attempts';
import { ensureVaultRestored } from '@/lib/offline/vault';

/** État de la copie préparée sur cet appareil pour cette évaluation, s'il y en a une. */
function useLocalCopy(evaluationId: string) {
  const [state, setState] = useState<SyncState | null>(null);
  useEffect(() => {
    const refresh = () => {
      void ensureVaultRestored()
        .then(() => findLocalAttempt(evaluationId))
        .then((copy) => setState(copy?.status ?? null))
        .catch(() => setState(null));
    };
    refresh();
    window.addEventListener('offline-data-change', refresh);
    window.addEventListener('offline-vault-change', refresh);
    return () => {
      window.removeEventListener('offline-data-change', refresh);
      window.removeEventListener('offline-vault-change', refresh);
    };
  }, [evaluationId]);
  return state;
}

/** Présentation d'une évaluation publiée : consignes, nombre de questions, accès et historique. */
export function EvaluationIntro() {
  const { id } = useParams<{ id: string }>();
  const { data, error, isPending, refetch } = useQuery(availableEvaluationQueryOptions(id));
  const attempts = useQuery(myAttemptsQueryOptions({ evaluationId: id, pageSize: 20 }));
  const localCopy = useLocalCopy(id);

  if (isPending) return <TableSkeleton rows={4} />;
  if (error) return <QueryError error={error} onRetry={() => void refetch()} />;
  const eligibility = data.eligibility;
  const open = eligibility?.openAttempt;
  const canStart =
    eligibility?.allowed && (!open || (open.mode === 'EN_LIGNE' && open.status === 'EN_COURS'));

  return (
    <>
      <BackLink href="/evaluations">Évaluations</BackLink>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {data.stage.name} · version {data.version}
          {data.module && ` · module « ${data.module.title} »`}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-tesla-bordeaux">{data.title}</h1>
        {eligibility && <EligibilityBadge eligibility={eligibility} />}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Avant de commencer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ul className="list-inside list-disc space-y-1">
            <li>
              {data.questionCount} question{data.questionCount > 1 ? 's' : ''}
              {data.durationMinutes && `, environ ${formatDuration(data.durationMinutes)}`}.
            </li>
            <li>
              Vos réponses sont enregistrées au fil de l’eau ; vous pouvez reprendre plus tard.
            </li>
            <li>Une fois remises, elles ne sont plus modifiables.</li>
            <li>
              Les réponses rédigées sont corrigées par un chef, puis le résultat est examiné par le
              responsable pédagogique. Un résultat n’entraîne jamais à lui seul un changement
              d’étape.
            </li>
            {data.maxAttempts && (
              <li>
                {data.maxAttempts} tentative{data.maxAttempts > 1 ? 's' : ''} au maximum (
                {eligibility?.attemptsUsed ?? 0} utilisée
                {(eligibility?.attemptsUsed ?? 0) > 1 ? 's' : ''}).
              </li>
            )}
          </ul>
          {data.instructions && (
            <div className="rounded-md bg-tesla-sable/30 p-3">
              <p className="font-medium">Consignes</p>
              <p className="whitespace-pre-line">{data.instructions}</p>
            </div>
          )}
          {eligibility && !eligibility.allowed && (
            <Alert variant="info">
              <CircleAlert aria-hidden />
              <AlertTitle>{ELIGIBILITY_LABELS[eligibility.status]}</AlertTitle>
              <AlertDescription>
                Le module reste consultable librement. Si vous pensez être prêt, parlez-en à votre
                chef : seul le responsable pédagogique peut accorder un déblocage.
              </AlertDescription>
            </Alert>
          )}
          {open && !(open.mode === 'EN_LIGNE' && open.status === 'EN_COURS') && (
            <Alert variant="info">
              <CircleAlert aria-hidden />
              <AlertDescription>
                Une tentative est en cours de traitement ({ATTEMPT_STATUS_LABELS[open.status]}).
              </AlertDescription>
            </Alert>
          )}
          {localCopy && (
            <Button asChild size="lg">
              <Link href={`/evaluations/${data.id}/passer`}>
                <Play aria-hidden />
                {localCopy === 'LOCAL'
                  ? 'Reprendre sur cet appareil'
                  : `Copie de cet appareil · ${SYNC_STATE_LABELS[localCopy]}`}
              </Link>
            </Button>
          )}
          {!localCopy && eligibility?.allowed && (!open || open.mode === 'HORS_LIGNE') && (
            <Button asChild variant="outline">
              <Link href={`/evaluations/${data.id}/preparer`}>
                Préparer pour passer sans connexion
              </Link>
            </Button>
          )}
          {canStart && !localCopy && (
            <Button asChild size="lg">
              <Link href={`/evaluations/${data.id}/passer`}>
                <Play aria-hidden />
                {open ? 'Reprendre l’évaluation' : 'Commencer l’évaluation'}
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mes tentatives</CardTitle>
        </CardHeader>
        <CardContent>
          {attempts.isPending ? (
            <TableSkeleton rows={2} />
          ) : attempts.error ? (
            <QueryError error={attempts.error} onRetry={() => void attempts.refetch()} />
          ) : attempts.data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune tentative pour l’instant.</p>
          ) : (
            <ul className="space-y-2">
              {attempts.data.items.map((attempt) => (
                <li
                  key={attempt.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
                >
                  <span>
                    <span className="font-mono">{attempt.code}</span> ·{' '}
                    {formatDateTime(
                      attempt.submittedAt ?? attempt.completedAt ?? attempt.createdAt,
                    )}
                  </span>
                  <AttemptStatusBadge status={attempt.status} />
                </li>
              ))}
            </ul>
          )}
          <Button asChild variant="link" className="px-0">
            <Link href="/mes-resultats">Voir mes résultats</Link>
          </Button>
        </CardContent>
      </Card>
    </>
  );
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, CircleAlert, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSessionUser } from '@/components/auth/session-gate';
import { RequirePermission } from '@/components/auth/require-permission';
import { BackLink } from '@/components/back-link';
import { CopyAnswers, CopyHeader, CopyHistory } from '@/components/evaluations/copy-view';
import { useEvaluationAction } from '@/components/evaluations/use-evaluation-action';
import { CommentDialog } from '@/components/modules/comment-dialog';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { acceptReview, requestCorrection, reviewAttemptQueryOptions } from '@/lib/api/evaluations';
import { fullName } from '@/lib/format';

/** Examen d'un résultat corrigé : réponses, notes, observations du chef, décision motivée. */
export function ResultReview() {
  const user = useSessionUser();
  const { id } = useParams<{ id: string }>();
  const run = useEvaluationAction();
  const { data, error, isPending, refetch } = useQuery(reviewAttemptQueryOptions(id));

  return (
    <RequirePermission user={user} permission="attempt.decide">
      <BackLink href="/administration/evaluations-a-valider">Résultats à examiner</BackLink>
      {isPending ? (
        <TableSkeleton rows={6} />
      ) : error ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : (
        <>
          <CopyHeader copy={data} />
          <Alert variant="info">
            <CircleAlert aria-hidden />
            <AlertDescription>
              Accepter ce résultat ne valide pas officiellement un acquis et ne change pas l’étape
              du routier. La validation officielle reste un acte séparé du responsable.
            </AlertDescription>
          </Alert>
          {data.status === 'SOUMISE' && (
            <div className="flex flex-wrap gap-2">
              <CommentDialog
                trigger={
                  <Button>
                    <Check aria-hidden />
                    Accepter le résultat corrigé
                  </Button>
                }
                title="Accepter ce résultat ?"
                description={
                  <p>Le routier pourra consulter son résultat détaillé (sans le corrigé).</p>
                }
                label="Commentaire motivé (facultatif, visible du routier)"
                confirmLabel="Accepter"
                onConfirm={(comment) =>
                  run(() => acceptReview(data.id, { comment }), {
                    success: 'Résultat accepté',
                    error: 'Action impossible',
                  })
                }
              />
              <CommentDialog
                trigger={
                  <Button variant="outline">
                    <RotateCcw aria-hidden />
                    Demander une nouvelle correction
                  </Button>
                }
                title="Demander une nouvelle correction"
                description={<p>La copie revient aux chefs avec votre motif.</p>}
                label="Motif"
                required
                confirmLabel="Renvoyer en correction"
                onConfirm={(reason) =>
                  run(() => requestCorrection(data.id, { reason }), {
                    success: 'Nouvelle correction demandée',
                    error: 'Action impossible',
                  })
                }
              />
            </div>
          )}
          {data.decision && (
            <p className="text-sm text-muted-foreground">
              Examiné par {data.decision.decidedBy ? fullName(data.decision.decidedBy) : '—'}
              {data.decision.comment && ` : « ${data.decision.comment} »`}
            </p>
          )}
          {data.observations && (
            <p className="rounded-md bg-tesla-sable/30 p-3 text-sm">
              Observations du chef{data.recordedBy && ` (${fullName(data.recordedBy)})`} :{' '}
              {data.observations}
            </p>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Réponses et correction</CardTitle>
            </CardHeader>
            <CardContent>
              <CopyAnswers copy={data} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Historique</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <CopyHistory copy={data} />
              <Button asChild variant="link" className="px-0">
                <Link href={`/administration/routiers/${data.scout.id}`}>Fiche du routier</Link>
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </RequirePermission>
  );
}

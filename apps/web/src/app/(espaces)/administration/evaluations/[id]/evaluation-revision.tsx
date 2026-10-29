'use client';

import { useQuery } from '@tanstack/react-query';
import { Archive, Check, Globe, RotateCcw, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useSessionUser } from '@/components/auth/session-gate';
import { ResponsableOnly } from '@/components/auth/responsable-only';
import { BackLink } from '@/components/back-link';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { QuestionList } from '@/components/evaluations/question-list';
import { useEvaluationAction } from '@/components/evaluations/use-evaluation-action';
import { CommentDialog } from '@/components/modules/comment-dialog';
import { ModuleHistory } from '@/components/modules/module-history';
import { ModuleStatusBadge } from '@/components/modules/module-status-badge';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  approveEvaluation,
  archiveEvaluation,
  evaluationReviewQueryOptions,
  publishEvaluation,
  rejectEvaluation,
  requestEvaluationChanges,
} from '@/lib/api/evaluations';
import { formatDuration, formatPoints, fullName } from '@/lib/format';

/** Examen d'un questionnaire soumis : contenu exact (corrigé compris) et décisions du responsable. */
export function EvaluationRevision() {
  const user = useSessionUser();
  const { id } = useParams<{ id: string }>();
  const run = useEvaluationAction();
  const { data, error, isPending, refetch } = useQuery(evaluationReviewQueryOptions(id));

  return (
    <ResponsableOnly role={user.role}>
      <BackLink href="/administration/evaluations">Questionnaires</BackLink>
      {isPending ? (
        <TableSkeleton rows={6} />
      ) : error ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : (
        (() => {
          const { evaluation, published } = data;
          const { current } = evaluation;
          const versionId = current.id;
          return (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    {evaluation.code} · version {current.version} · {evaluation.stage.name}
                    {evaluation.module && ` · ${evaluation.module.code} ${evaluation.module.title}`}
                  </p>
                  <h1 className="text-2xl font-semibold tracking-tight text-tesla-bordeaux">
                    {current.title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <ModuleStatusBadge status={current.status} />
                    {current.questionCount} questions · {formatPoints(current.totalPoints)}
                    {current.durationMinutes && ` · ${formatDuration(current.durationMinutes)}`}
                    {current.maxAttempts && ` · ${current.maxAttempts} tentative(s) max.`}
                    {current.submittedBy && ` · soumis par ${fullName(current.submittedBy)}`}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {current.status === 'SOUMIS' && (
                    <CommentDialog
                      trigger={
                        <Button>
                          <Check aria-hidden />
                          Approuver
                        </Button>
                      }
                      title="Approuver ce questionnaire ?"
                      description={
                        <p>La version reste figée ; elle sera disponible après publication.</p>
                      }
                      label="Commentaire (facultatif)"
                      confirmLabel="Approuver"
                      onConfirm={(comment) =>
                        run(() => approveEvaluation(evaluation.id, { versionId, comment }), {
                          success: 'Questionnaire approuvé',
                          error: 'Approbation impossible',
                        })
                      }
                    />
                  )}
                  {(current.status === 'SOUMIS' || current.status === 'APPROUVE') && (
                    <CommentDialog
                      trigger={
                        <Button variant="outline">
                          <RotateCcw aria-hidden />
                          Demander des modifications
                        </Button>
                      }
                      title="Demander des modifications"
                      description={
                        <p>Le questionnaire revient à l’équipe de rédaction avec votre motif.</p>
                      }
                      label="Motif"
                      required
                      confirmLabel="Renvoyer"
                      onConfirm={(comment) =>
                        run(() => requestEvaluationChanges(evaluation.id, { versionId, comment }), {
                          success: 'Modifications demandées',
                          error: 'Action impossible',
                        })
                      }
                    />
                  )}
                  {current.status === 'SOUMIS' && (
                    <CommentDialog
                      trigger={
                        <Button variant="ghost">
                          <X aria-hidden />
                          Refuser
                        </Button>
                      }
                      title="Refuser ce questionnaire ?"
                      description={
                        <p>La version est close ; une nouvelle version pourra être rédigée.</p>
                      }
                      label="Motif"
                      required
                      destructive
                      confirmLabel="Refuser"
                      onConfirm={(comment) =>
                        run(() => rejectEvaluation(evaluation.id, { versionId, comment }), {
                          success: 'Questionnaire refusé',
                          error: 'Refus impossible',
                        })
                      }
                    />
                  )}
                  {current.status === 'APPROUVE' && (
                    <ConfirmDialog
                      trigger={
                        <Button>
                          <Globe aria-hidden />
                          Publier
                        </Button>
                      }
                      title="Publier ce questionnaire ?"
                      description={
                        <p>
                          Les routiers éligibles pourront le passer et les chefs l’imprimer.
                          {published &&
                            ` La version ${published.version} actuellement publiée sera archivée ; ses tentatives restent consultables.`}
                          {evaluation.module && ' Le module évalué doit être publié.'}
                        </p>
                      }
                      confirmLabel="Publier"
                      onConfirm={() =>
                        run(() => publishEvaluation(evaluation.id, versionId), {
                          success: 'Questionnaire publié',
                          error: 'Publication impossible',
                        })
                      }
                    />
                  )}
                  {current.status === 'PUBLIE' && (
                    <CommentDialog
                      trigger={
                        <Button variant="outline">
                          <Archive aria-hidden />
                          Archiver
                        </Button>
                      }
                      title="Retirer ce questionnaire ?"
                      description={
                        <p>Plus aucune nouvelle tentative ; l’historique est conservé.</p>
                      }
                      label="Motif"
                      required
                      destructive
                      confirmLabel="Archiver"
                      onConfirm={(comment) =>
                        run(() => archiveEvaluation(evaluation.id, { versionId, comment }), {
                          success: 'Questionnaire archivé',
                          error: 'Archivage impossible',
                        })
                      }
                    />
                  )}
                </div>
              </div>

              {current.submissionNote && (
                <p className="rounded-md bg-muted/60 px-3 py-2 text-sm">
                  Note de soumission : « {current.submissionNote} »
                </p>
              )}
              {current.instructions && (
                <section className="rounded-lg border bg-tesla-sable/30 p-4 text-sm">
                  <h3 className="font-semibold">Consignes</h3>
                  <p className="whitespace-pre-line">{current.instructions}</p>
                </section>
              )}
              <Card>
                <CardHeader>
                  <CardTitle>Contenu soumis (corrigé compris)</CardTitle>
                  <CardDescription>
                    Exactement ce qui sera passé par les routiers et imprimé ; aucun seuil de
                    réussite n’est appliqué.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <QuestionList questions={current.questions} showKey />
                </CardContent>
              </Card>
              {published && (
                <details className="rounded-lg border bg-card p-4">
                  <summary className="cursor-pointer font-medium">
                    Comparer avec la version publiée ({published.version})
                  </summary>
                  <div className="mt-3">
                    <QuestionList questions={published.questions} showKey />
                  </div>
                </details>
              )}
              <Card>
                <CardHeader>
                  <CardTitle>Historique</CardTitle>
                </CardHeader>
                <CardContent>
                  <ModuleHistory events={evaluation.events} versions={evaluation.versions} />
                </CardContent>
              </Card>
            </>
          );
        })()
      )}
    </ResponsableOnly>
  );
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { type EditorEvaluationDetail, MODULE_VERSION_ACTION_LABELS } from '@tesla/shared';
import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  Eye,
  FilePlus2,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { BackLink } from '@/components/back-link';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EvaluationSettingsForm } from '@/components/evaluations/evaluation-settings-form';
import { QuestionForm } from '@/components/evaluations/question-form';
import { QuestionList } from '@/components/evaluations/question-list';
import { useEvaluationAction } from '@/components/evaluations/use-evaluation-action';
import { CommentDialog } from '@/components/modules/comment-dialog';
import { ModuleHistory } from '@/components/modules/module-history';
import { ModuleStatusBadge } from '@/components/modules/module-status-badge';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  addQuestion,
  createEvaluationVersion,
  deleteQuestion,
  editorEvaluationQueryOptions,
  reorderQuestions,
  resumeEvaluation,
  submitEvaluation,
  updateEvaluation,
  updateQuestion,
} from '@/lib/api/evaluations';
import { formatPoints } from '@/lib/format';

type Status = EditorEvaluationDetail['current']['status'];

const STATE_MESSAGES: Partial<Record<Status, string>> = {
  SOUMIS: 'Ce questionnaire est soumis : il est figé jusqu’à la décision du responsable.',
  APPROUVE:
    'Ce questionnaire est approuvé : il est figé et attend sa publication par le responsable.',
  A_CORRIGER:
    'Le responsable a demandé des modifications : reprenez la rédaction pour modifier cette version.',
  REFUSE: 'Cette version a été refusée. Vous pouvez créer une nouvelle version de travail.',
  PUBLIE:
    'Cette version est publiée et ne peut plus être modifiée. Créez une nouvelle version : elle devra être approuvée à son tour, les tentatives existantes restent liées à leur version.',
  ARCHIVE: 'Cette version est archivée. Vous pouvez créer une nouvelle version de travail.',
};

export function EvaluationEditor() {
  const { id } = useParams<{ id: string }>();
  const run = useEvaluationAction();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const {
    data: evaluation,
    error,
    isPending,
    refetch,
  } = useQuery(editorEvaluationQueryOptions(id));

  if (isPending) return <TableSkeleton rows={6} />;
  if (error) return <QueryError error={error} onRetry={() => void refetch()} />;

  const { current } = evaluation;
  const editable = current.status === 'BROUILLON';
  const canCreateVersion = ['PUBLIE', 'REFUSE', 'ARCHIVE'].includes(current.status);
  const lastDecision = evaluation.events.find(
    (event) => event.versionId === current.id && event.comment && event.action !== 'SOUMISE',
  );
  const questionIds = current.questions.map((question) => question.id);

  const move = (index: number, offset: number) => {
    const next = [...questionIds];
    const [moved] = next.splice(index, 1);
    next.splice(index + offset, 0, moved!);
    void run(() => reorderQuestions(evaluation.id, current.id, next), {
      success: 'Ordre enregistré',
      error: 'Réordonnancement impossible',
    });
  };

  return (
    <>
      <BackLink href="/chef/evaluations">Évaluations</BackLink>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {evaluation.code} · version {current.version} · {evaluation.stage.name}
            {evaluation.published &&
              evaluation.published.id !== current.id &&
              ` · version ${evaluation.published.version} publiée`}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-tesla-bordeaux">
            {current.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <ModuleStatusBadge status={current.status} />
            {current.questionCount} question{current.questionCount > 1 ? 's' : ''} ·{' '}
            {formatPoints(current.totalPoints)}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/chef/evaluations/${evaluation.id}/apercu`}>
              <Eye aria-hidden />
              Aperçu
            </Link>
          </Button>
          {current.status === 'A_CORRIGER' && (
            <Button
              onClick={() =>
                void run(() => resumeEvaluation(evaluation.id, current.id), {
                  success: 'Rédaction reprise',
                  error: 'Reprise impossible',
                })
              }
            >
              <RotateCcw aria-hidden />
              Reprendre la rédaction
            </Button>
          )}
          {canCreateVersion && (
            <Button
              onClick={() =>
                void run(() => createEvaluationVersion(evaluation.id), {
                  success: 'Nouvelle version créée',
                  error: 'Création impossible',
                  detail: 'La version publiée reste en service jusqu’à la publication de celle-ci.',
                })
              }
            >
              <FilePlus2 aria-hidden />
              Nouvelle version
            </Button>
          )}
          {editable && (
            <CommentDialog
              trigger={
                <Button disabled={current.questionCount === 0}>
                  <Send aria-hidden />
                  Soumettre
                </Button>
              }
              title="Soumettre le questionnaire ?"
              description={
                <p>
                  La version {current.version} sera figée et transmise au responsable pédagogique,
                  seul habilité à l’approuver et à la publier.
                </p>
              }
              label="Note pour le responsable (facultative)"
              confirmLabel="Soumettre"
              onConfirm={(note) =>
                run(
                  () =>
                    submitEvaluation(evaluation.id, {
                      versionId: current.id,
                      revision: current.revision,
                      note,
                    }),
                  { success: 'Questionnaire soumis', error: 'Soumission impossible' },
                )
              }
            />
          )}
        </div>
      </div>

      {STATE_MESSAGES[current.status] && (
        <Alert variant={current.status === 'A_CORRIGER' ? 'destructive' : 'info'}>
          <CircleAlert aria-hidden />
          <AlertTitle>{STATE_MESSAGES[current.status]}</AlertTitle>
          {lastDecision && (
            <AlertDescription>
              <p>
                {MODULE_VERSION_ACTION_LABELS[lastDecision.action]} : « {lastDecision.comment} »
              </p>
            </AlertDescription>
          )}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
          <CardDescription>
            Titre, consignes, étape concernée, module évalué, durée et nombre de tentatives.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EvaluationSettingsForm
            evaluation={evaluation}
            disabled={!editable}
            submitLabel="Enregistrer les informations"
            onSubmit={async ({ stageId, moduleId, ...values }) => {
              await run(
                () =>
                  updateEvaluation(evaluation.id, {
                    versionId: current.id,
                    revision: current.revision,
                    ...values,
                    ...(evaluation.settingsEditable && { stageId, moduleId }),
                  }),
                { success: 'Informations enregistrées', error: 'Enregistrement impossible' },
              );
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Questions, bonnes réponses et barèmes</CardTitle>
          <CardDescription>
            Les bonnes réponses et barèmes ne sont jamais transmis au routier avant la correction.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {current.questions.length === 0 && !adding && (
            <p className="text-sm text-muted-foreground">Aucune question pour l’instant.</p>
          )}
          <QuestionList
            questions={current.questions}
            showKey
            actions={
              editable
                ? (question, index) => (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                        aria-label={`Monter la question ${index + 1}`}
                      >
                        <ArrowUp aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={index === questionIds.length - 1}
                        onClick={() => move(index, 1)}
                        aria-label={`Descendre la question ${index + 1}`}
                      >
                        <ArrowDown aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingId(editingId === question.id ? null : question.id)}
                        aria-label={`Modifier la question ${index + 1}`}
                        aria-expanded={editingId === question.id}
                      >
                        <Pencil aria-hidden />
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Supprimer la question ${index + 1}`}
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        }
                        title={`Supprimer la question ${index + 1} ?`}
                        description={
                          <p>La question et ses propositions seront retirées du brouillon.</p>
                        }
                        confirmLabel="Supprimer"
                        destructive
                        onConfirm={() =>
                          run(() => deleteQuestion(evaluation.id, question.id, question.revision), {
                            success: 'Question supprimée',
                            error: 'Suppression impossible',
                          })
                        }
                      />
                    </div>
                  )
                : undefined
            }
          />
          {editingId &&
            (() => {
              const question = current.questions.find((item) => item.id === editingId);
              if (!question) return null;
              return (
                <section
                  aria-label="Modification de la question"
                  className="rounded-lg border border-tesla-or p-4"
                >
                  <h3 className="mb-3 font-semibold">
                    Modifier la question {question.position + 1}
                  </h3>
                  <QuestionForm
                    key={`${question.id}-${question.revision}`}
                    question={question}
                    submitLabel="Enregistrer la question"
                    onCancel={() => setEditingId(null)}
                    onSubmit={async (values) => {
                      const ok = await run(
                        () =>
                          updateQuestion(evaluation.id, question.id, {
                            revision: question.revision,
                            ...values,
                          }),
                        { success: 'Question enregistrée', error: 'Enregistrement impossible' },
                      );
                      if (ok) setEditingId(null);
                      return ok;
                    }}
                  />
                </section>
              );
            })()}
          {editable &&
            (adding ? (
              <section
                aria-label="Nouvelle question"
                className="rounded-lg border border-tesla-or p-4"
              >
                <h3 className="mb-3 font-semibold">Nouvelle question</h3>
                <QuestionForm
                  submitLabel="Ajouter la question"
                  onCancel={() => setAdding(false)}
                  onSubmit={(values) =>
                    run(() => addQuestion(evaluation.id, { versionId: current.id, ...values }), {
                      success: 'Question ajoutée',
                      error: 'Ajout impossible',
                    })
                  }
                />
              </section>
            ) : (
              <Button variant="outline" onClick={() => setAdding(true)}>
                <Plus aria-hidden />
                Ajouter une question
              </Button>
            ))}
        </CardContent>
      </Card>

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
}

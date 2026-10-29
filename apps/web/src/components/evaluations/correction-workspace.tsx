'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import {
  type CorrectionDetail,
  isObjectiveQuestion,
  PAPER_DOCUMENT_LABELS,
  PAPER_DOCUMENTS,
  type SaveCorrectionInput,
} from '@tesla/shared';
import { Ban, FileDown, Save, Send } from 'lucide-react';
import { useId } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { BackLink } from '@/components/back-link';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FormField, fieldA11y } from '@/components/form-field';
import { CommentDialog } from '@/components/modules/comment-dialog';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  cancelAttempt,
  correctionQueryOptions,
  paperPdfUrl,
  saveCorrection,
  submitCorrection,
} from '@/lib/api/evaluations';
import { formatPoints, todayIsoDate } from '@/lib/format';
import { CopyAnswers, CopyHeader, CopyHistory } from './copy-view';
import { useEvaluationAction } from './use-evaluation-action';

const pointsField = z
  .string()
  .trim()
  .refine((value) => value === '' || /^\d+([.,]\d{1,2})?$/.test(value), {
    message: 'Nombre positif, deux décimales au maximum.',
  });

const formSchema = z.object({
  completedAt: z.string(),
  observations: z.string().trim().max(5000, { error: '5 000 caractères au maximum.' }),
  reason: z.string().trim().max(1000, { error: '1 000 caractères au maximum.' }),
  items: z.array(
    z.object({
      questionId: z.string(),
      optionIds: z.array(z.string()),
      text: z.string().max(5000, { error: '5 000 caractères au maximum.' }),
      points: pointsField,
      appreciation: z.string().trim().max(300, { error: '300 caractères au maximum.' }),
      comment: z.string().trim().max(2000, { error: '2 000 caractères au maximum.' }),
    }),
  ),
});

type FormValues = z.infer<typeof formSchema>;

const EDITABLE = new Set(['PREPAREE', 'A_CORRIGER', 'SOUMISE']);

/**
 * Correction d'une copie (papier ou en ligne). Papier : impression des documents, transcription
 * des réponses. Les questions objectives sont recalculées par le serveur ; les réponses libres
 * reçoivent une note, une appréciation et une observation. Une note n'est jamais une validation.
 */
export function CorrectionWorkspace({
  code,
  backHref,
  backLabel,
}: {
  code: string;
  backHref: string;
  backLabel: string;
}) {
  const { data, error, isPending, refetch } = useQuery(correctionQueryOptions(code));
  if (isPending) return <TableSkeleton rows={6} />;
  if (error) return <QueryError error={error} onRetry={() => void refetch()} />;
  return (
    <>
      <BackLink href={backHref}>{backLabel}</BackLink>
      <CopyHeader copy={data} />
      {data.mode === 'PAPIER' && <PaperDocuments copy={data} />}
      {EDITABLE.has(data.status) ? (
        <CorrectionForm key={data.correctionRevision} copy={data} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Copie</CardTitle>
            <CardDescription>
              {data.status === 'EN_COURS'
                ? 'Le routier n’a pas encore remis ses réponses.'
                : 'Copie en lecture seule.'}
            </CardDescription>
          </CardHeader>
          <CardContent>{data.status !== 'EN_COURS' && <CopyAnswers copy={data} />}</CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Historique</CardTitle>
        </CardHeader>
        <CardContent>
          <CopyHistory copy={data} />
        </CardContent>
      </Card>
    </>
  );
}

function PaperDocuments({ copy }: { copy: CorrectionDetail }) {
  const documents = PAPER_DOCUMENTS.filter(
    (document) => document !== 'questionnaire' || copy.status === 'PREPAREE',
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents A4</CardTitle>
        <CardDescription>
          Réimprimer ne crée jamais de nouvelle tentative : le code {copy.code} reste le même. Le
          corrigé et la grille sont réservés aux chefs.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {documents.map((document) => (
          <Button
            key={document}
            asChild
            variant={document === 'questionnaire' ? 'default' : 'outline'}
          >
            <a href={paperPdfUrl(copy.code, document)} target="_blank" rel="noopener">
              <FileDown aria-hidden />
              {PAPER_DOCUMENT_LABELS[document]}
            </a>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}

function CorrectionForm({ copy }: { copy: CorrectionDetail }) {
  const id = useId();
  const run = useEvaluationAction();
  const paper = copy.mode === 'PAPIER';
  const submitted = copy.status === 'SOUMISE';
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      completedAt: copy.completedAt?.slice(0, 10) ?? copy.plannedFor ?? todayIsoDate(),
      observations: copy.observations ?? '',
      reason: '',
      items: copy.questions.map((question) => ({
        questionId: question.id,
        optionIds: question.answer?.optionIds ?? [],
        text: question.answer?.text ?? '',
        points:
          question.answer?.awardedPoints == null || isObjectiveQuestion(question.type)
            ? ''
            : String(question.answer.awardedPoints),
        appreciation: question.answer?.appreciation ?? '',
        comment: question.answer?.comment ?? '',
      })),
    },
  });
  const items = useWatch({ control, name: 'items' });

  const toggle = (index: number, optionId: string, single: boolean, checked: boolean) => {
    const current = items[index]?.optionIds ?? [];
    const next = single
      ? checked
        ? [optionId]
        : []
      : checked
        ? [...current, optionId]
        : current.filter((value) => value !== optionId);
    setValue(`items.${index}.optionIds`, next, { shouldDirty: true });
  };

  const save = async (values: FormValues) => {
    if (submitted && !values.reason) {
      setError('reason', { message: 'Motif obligatoire pour reprendre une correction soumise.' });
      return;
    }
    for (const [index, item] of values.items.entries()) {
      const question = copy.questions[index]!;
      const points = item.points === '' ? null : Number(item.points.replace(',', '.'));
      if (points !== null && points > question.points) {
        setError(`items.${index}.points`, {
          message: `Au maximum ${formatPoints(question.points)}.`,
        });
        return;
      }
    }
    const input: SaveCorrectionInput = {
      correctionRevision: copy.correctionRevision,
      ...(paper && { completedAt: new Date(`${values.completedAt}T12:00:00Z`).toISOString() }),
      ...(paper && {
        answers: values.items.map((item) => ({
          questionId: item.questionId,
          optionIds: item.optionIds,
          text: item.text,
        })),
      }),
      grades: values.items.map((item, index) => ({
        questionId: item.questionId,
        awardedPoints:
          isObjectiveQuestion(copy.questions[index]!.type) || item.points === ''
            ? null
            : Number(item.points.replace(',', '.')),
        appreciation: item.appreciation,
        comment: item.comment,
      })),
      observations: values.observations,
      ...(values.reason && { reason: values.reason }),
    };
    await run(() => saveCorrection(copy.code, input), {
      success: 'Correction enregistrée',
      error: 'Enregistrement impossible',
      detail: 'Brouillon de correction : rien n’est transmis au responsable avant la soumission.',
    });
  };

  const missing = copy.questions.filter(
    (question) => !isObjectiveQuestion(question.type) && question.answer?.awardedPoints == null,
  ).length;

  return (
    <form className="space-y-4" onSubmit={(event) => void handleSubmit(save)(event)} noValidate>
      {submitted && (
        <Alert variant="info">
          <AlertTitle>Copie soumise au responsable</AlertTitle>
          <AlertDescription>
            Toute reprise de la correction est tracée et exige un motif ; la copie revient alors à
            l’état « À corriger ».
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{paper ? 'Saisie et correction de la copie papier' : 'Correction'}</CardTitle>
          <CardDescription>
            {paper
              ? 'Reportez les réponses de la feuille : les questions à choix sont corrigées automatiquement à l’enregistrement.'
              : 'Les questions à choix ont été corrigées automatiquement ; notez les réponses rédigées.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {paper && (
            <FormField id={`${id}-date`} label="Date de passation" required>
              <Input
                {...fieldA11y(`${id}-date`)}
                type="date"
                className="max-w-48"
                max={todayIsoDate()}
                {...register('completedAt')}
              />
            </FormField>
          )}
          <ol className="space-y-3">
            {copy.questions.map((question, index) => {
              const objective = isObjectiveQuestion(question.type);
              const single = question.type !== 'CHOIX_MULTIPLE';
              const itemErrors = errors.items?.[index];
              return (
                <li key={question.id} className="space-y-3 rounded-lg border bg-card p-4">
                  <div className="flex flex-wrap justify-between gap-2 text-sm">
                    <span className="font-semibold text-tesla-bordeaux">Question {index + 1}</span>
                    <span className="text-muted-foreground">
                      {objective && question.answer?.awardedPoints != null
                        ? `${formatPoints(question.answer.awardedPoints)} attribués sur ${formatPoints(question.points)}`
                        : `Barème : ${formatPoints(question.points)}`}
                    </span>
                  </div>
                  <p className="whitespace-pre-line">{question.prompt}</p>
                  {objective ? (
                    <fieldset className="space-y-1.5" disabled={!paper}>
                      <legend className="sr-only">Réponse du routier</legend>
                      {question.options.map((option) => {
                        const checked = items[index]?.optionIds.includes(option.id) ?? false;
                        return (
                          <label
                            key={option.id}
                            className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm has-[:checked]:border-tesla-rouge"
                          >
                            <input
                              type={single ? 'radio' : 'checkbox'}
                              name={`${id}-q${index}`}
                              className="mt-0.5 size-4 accent-tesla-rouge"
                              checked={checked}
                              onChange={(event) =>
                                toggle(index, option.id, single, event.target.checked)
                              }
                            />
                            <span className="flex-1">{option.label}</span>
                            {option.isCorrect && (
                              <span className="text-xs font-medium text-tesla-rouge">
                                bonne réponse
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </fieldset>
                  ) : (
                    <>
                      {paper ? (
                        <FormField id={`${id}-text-${index}`} label="Réponse transcrite">
                          <Textarea
                            {...fieldA11y(`${id}-text-${index}`, itemErrors?.text?.message)}
                            rows={question.type === 'REPONSE_COURTE' ? 2 : 5}
                            {...register(`items.${index}.text`)}
                          />
                        </FormField>
                      ) : (
                        <p className="rounded-md bg-muted/50 px-3 py-2 text-sm whitespace-pre-line">
                          {question.answer?.text ?? (
                            <span className="text-muted-foreground">Sans réponse</span>
                          )}
                        </p>
                      )}
                      {(question.expectedAnswer || question.guidance) && (
                        <div className="rounded-md bg-tesla-sable/30 p-3 text-sm">
                          {question.expectedAnswer && <p>Attendu : {question.expectedAnswer}</p>}
                          {question.guidance && (
                            <p className="text-muted-foreground">Critères : {question.guidance}</p>
                          )}
                        </div>
                      )}
                      <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
                        <FormField
                          id={`${id}-points-${index}`}
                          label="Note"
                          required
                          error={itemErrors?.points?.message}
                        >
                          <Input
                            {...fieldA11y(`${id}-points-${index}`, itemErrors?.points?.message)}
                            inputMode="decimal"
                            placeholder={`/ ${question.points}`}
                            {...register(`items.${index}.points`)}
                          />
                        </FormField>
                        <FormField
                          id={`${id}-appreciation-${index}`}
                          label="Appréciation"
                          error={itemErrors?.appreciation?.message}
                        >
                          <Input
                            {...fieldA11y(
                              `${id}-appreciation-${index}`,
                              itemErrors?.appreciation?.message,
                            )}
                            maxLength={300}
                            {...register(`items.${index}.appreciation`)}
                          />
                        </FormField>
                      </div>
                    </>
                  )}
                  <FormField
                    id={`${id}-comment-${index}`}
                    label="Observation du correcteur"
                    error={itemErrors?.comment?.message}
                  >
                    <Input
                      {...fieldA11y(`${id}-comment-${index}`, itemErrors?.comment?.message)}
                      maxLength={2000}
                      {...register(`items.${index}.comment`)}
                    />
                  </FormField>
                </li>
              );
            })}
          </ol>
          <FormField
            id={`${id}-observations`}
            label="Observations générales"
            hint="Accompagnement du routier ; visibles du responsable."
            error={errors.observations?.message}
          >
            <Textarea
              {...fieldA11y(`${id}-observations`, errors.observations?.message, 'hint')}
              rows={3}
              {...register('observations')}
            />
          </FormField>
          {submitted && (
            <FormField
              id={`${id}-reason`}
              label="Motif de la reprise"
              required
              error={errors.reason?.message}
            >
              <Input
                {...fieldA11y(`${id}-reason`, errors.reason?.message)}
                {...register('reason')}
              />
            </FormField>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSubmitting}>
          <Save aria-hidden />
          {isSubmitting ? 'Enregistrement…' : 'Enregistrer la correction'}
        </Button>
        {copy.status === 'A_CORRIGER' && (
          <ConfirmDialog
            trigger={
              <Button type="button" variant="outline" disabled={isDirty || missing > 0}>
                <Send aria-hidden />
                Soumettre au responsable
              </Button>
            }
            title="Soumettre le résultat corrigé ?"
            description={
              <p>
                Le responsable examinera le résultat. Cette note ne vaut ni validation officielle
                d’un acquis ni passage d’étape.
              </p>
            }
            confirmLabel="Soumettre"
            onConfirm={() =>
              run(() => submitCorrection(copy.code, copy.correctionRevision), {
                success: 'Résultat soumis au responsable',
                error: 'Soumission impossible',
              })
            }
          />
        )}
        {(copy.status === 'PREPAREE' || copy.status === 'A_CORRIGER') && (
          <CommentDialog
            trigger={
              <Button type="button" variant="ghost">
                <Ban aria-hidden />
                Annuler la tentative
              </Button>
            }
            title="Annuler cette tentative ?"
            description={
              <p>
                La tentative {copy.code} reste dans l’historique avec son code, qui ne sera jamais
                réutilisé.
              </p>
            }
            label="Motif"
            required
            destructive
            confirmLabel="Annuler la tentative"
            onConfirm={(reason) =>
              run(() => cancelAttempt(copy.code, { reason }), {
                success: 'Tentative annulée',
                error: 'Annulation impossible',
              })
            }
          />
        )}
      </div>
      {copy.status === 'A_CORRIGER' && (isDirty || missing > 0) && (
        <p className="text-sm text-muted-foreground">
          {isDirty
            ? 'Enregistrez la correction avant de la soumettre.'
            : `${missing} réponse${missing > 1 ? 's' : ''} rédigée${missing > 1 ? 's' : ''} à noter avant la soumission.`}
        </p>
      )}
    </form>
  );
}

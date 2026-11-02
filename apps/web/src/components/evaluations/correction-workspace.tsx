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
import { Ban, CheckCheck, FileDown, Megaphone, Save, Send, Smartphone } from 'lucide-react';
import { useRouter } from 'next/navigation';
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
  acceptReview,
  cancelAttempt,
  correctionQueryOptions,
  paperPdfUrl,
  saveCorrection,
  submitCorrection,
  switchToPaper,
  transmitCopy,
} from '@/lib/api/evaluations';
import { formatDateTime, formatPoints, todayIsoDate } from '@/lib/format';
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
 * Copie modifiable par la personne connectée (D161) : le responsable plein (corrigé reçu) corrige
 * toute copie non examinée ; le reste de l'encadrement saisit une copie papier non transmise.
 */
function isEditable(copy: CorrectionDetail): boolean {
  if (copy.answerKey) return EDITABLE.has(copy.status);
  return (
    copy.mode === 'PAPIER' &&
    copy.transmittedAt === null &&
    (copy.status === 'PREPAREE' || copy.status === 'A_CORRIGER')
  );
}

/**
 * Copie papier ou en ligne. Encadrement : impression, saisie des réponses (provisoire, reprise
 * possible), transmission pour correction, sans corrigé ni note. Responsable plein : corrigé,
 * barème, notes des réponses libres, validation du score et publication. Les questions objectives
 * sont recalculées par le serveur. Une note n'est jamais une validation d'acquis.
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
      {data.mode !== 'PAPIER' && (data.status === 'PREPAREE' || data.status === 'EN_COURS') && (
        <SwitchToPaper copy={data} />
      )}
      {data.answerKey && data.status === 'SOUMISE' && <PublishResult copy={data} />}
      {isEditable(data) ? (
        <CorrectionForm key={data.correctionRevision} copy={data} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Copie</CardTitle>
            <CardDescription>
              {data.status === 'EN_COURS'
                ? 'Le routier n’a pas encore remis ses réponses.'
                : data.transmittedAt && !data.answerKey && data.status === 'A_CORRIGER'
                  ? `Transmise pour correction le ${formatDateTime(data.transmittedAt)}${data.transmittedBy ? ` par ${data.transmittedBy.firstName} ${data.transmittedBy.lastName}` : ''}. La correction est réservée au responsable plein.`
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
  // Corrigé et grille : responsable plein seulement (refusés par l'API sinon).
  const documents = PAPER_DOCUMENTS.filter((document) =>
    document === 'questionnaire' ? copy.status === 'PREPAREE' : copy.answerKey,
  );
  if (documents.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents A4</CardTitle>
        <CardDescription>
          Réimprimer ne crée jamais de nouvelle tentative : le code {copy.code} reste le même.
          {copy.answerKey && ' Le corrigé et la grille sont confidentiels.'}
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
  // Responsable plein : correction ; autres membres de l'encadrement : saisie seule (D161).
  const grader = copy.answerKey;
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
      if (points !== null && question.points !== null && points > question.points) {
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
      grades: grader
        ? values.items.map((item, index) => ({
            questionId: item.questionId,
            awardedPoints:
              isObjectiveQuestion(copy.questions[index]!.type) || item.points === ''
                ? null
                : Number(item.points.replace(',', '.')),
            appreciation: item.appreciation,
            comment: item.comment,
          }))
        : [],
      observations: values.observations,
      ...(values.reason && { reason: values.reason }),
    };
    await run(
      () => saveCorrection(copy.code, input),
      grader
        ? {
            success: 'Correction enregistrée',
            error: 'Enregistrement impossible',
            detail: 'Brouillon : le résultat n’est visible du routier qu’après publication.',
          }
        : {
            success: 'Saisie enregistrée',
            error: 'Enregistrement impossible',
            detail: 'Saisie provisoire : vous pourrez la reprendre avant de la transmettre.',
          },
    );
  };

  const missing = copy.questions.filter(
    (question) => !isObjectiveQuestion(question.type) && question.answer?.awardedPoints == null,
  ).length;
  // Progression de la saisie (réponses renseignées dans le formulaire, enregistrées ou non).
  const answered = items.filter((item) => item.optionIds.length > 0 || item.text.trim()).length;
  const unanswered = copy.questions
    .map((_, index) => index)
    .filter((index) => !(items[index]?.optionIds.length || items[index]?.text.trim()));

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
          <CardTitle>
            {!grader
              ? 'Saisie des réponses'
              : paper
                ? 'Saisie et correction de la copie papier'
                : 'Correction'}
          </CardTitle>
          <CardDescription>
            {!grader
              ? 'Reportez fidèlement les réponses de la feuille, y compris les questions sans réponse. La saisie n’est pas une correction.'
              : paper
                ? 'Reportez les réponses de la feuille : les questions à choix sont corrigées automatiquement à l’enregistrement.'
                : 'Les questions à choix ont été corrigées automatiquement ; notez les réponses rédigées.'}
          </CardDescription>
          {paper && (
            <p className="text-sm font-medium" aria-live="polite">
              {answered} / {copy.questions.length} question{copy.questions.length > 1 ? 's' : ''}{' '}
              renseignée{answered > 1 ? 's' : ''}
            </p>
          )}
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
                    {question.points !== null && (
                      <span className="text-muted-foreground">
                        {objective && question.answer?.awardedPoints != null
                          ? `${formatPoints(question.answer.awardedPoints)} attribués sur ${formatPoints(question.points)}`
                          : `Barème : ${formatPoints(question.points)}`}
                      </span>
                    )}
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
                      {grader && (
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
                              placeholder={
                                question.points === null ? undefined : `/ ${question.points}`
                              }
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
                      )}
                    </>
                  )}
                  {grader && (
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
                  )}
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
          {isSubmitting
            ? 'Enregistrement…'
            : grader
              ? 'Enregistrer la correction'
              : 'Enregistrer la saisie'}
        </Button>
        {!grader && paper && copy.status === 'A_CORRIGER' && (
          <ConfirmDialog
            trigger={
              <Button type="button" variant="outline" disabled={isDirty}>
                <Send aria-hidden />
                Transmettre pour correction
              </Button>
            }
            title="Transmettre la copie au responsable ?"
            description={
              <div className="space-y-2">
                <p>
                  {answered} question{answered > 1 ? 's' : ''} renseignée
                  {answered > 1 ? 's' : ''} sur {copy.questions.length}
                  {unanswered.length > 0 &&
                    ` ; sans réponse : ${unanswered.map((index) => `Q${index + 1}`).join(', ')}`}
                  .
                </p>
                <p>
                  La saisie sera close : seul le responsable plein pourra ensuite modifier cette
                  copie et la corriger.
                </p>
              </div>
            }
            confirmLabel="Transmettre"
            onConfirm={() =>
              run(() => transmitCopy(copy.code, copy.correctionRevision), {
                success: 'Copie transmise pour correction',
                error: 'Transmission impossible',
              })
            }
          />
        )}
        {grader && copy.status === 'A_CORRIGER' && (
          <ConfirmDialog
            trigger={
              <Button type="button" variant="outline" disabled={isDirty || missing > 0}>
                <Send aria-hidden />
                Valider la note
              </Button>
            }
            title="Valider la note finale ?"
            description={
              <p>
                Le score est figé ; toute reprise sera motivée et tracée. Il restera à publier le
                résultat. Cette note ne vaut ni validation officielle d’un acquis ni passage
                d’étape.
              </p>
            }
            confirmLabel="Valider la note"
            onConfirm={() =>
              run(() => submitCorrection(copy.code, copy.correctionRevision), {
                success: 'Note validée',
                error: 'Validation impossible',
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
      {grader && copy.status === 'A_CORRIGER' && (isDirty || missing > 0) && (
        <p className="text-sm text-muted-foreground">
          {isDirty
            ? 'Enregistrez la correction avant de valider la note.'
            : `${missing} réponse${missing > 1 ? 's' : ''} rédigée${missing > 1 ? 's' : ''} à noter avant la validation.`}
        </p>
      )}
      {!grader && isDirty && copy.status === 'A_CORRIGER' && (
        <p className="text-sm text-muted-foreground">
          Enregistrez la saisie avant de la transmettre.
        </p>
      )}
    </form>
  );
}

/** Publication du résultat validé (responsable plein) : visible du routier, sans changement d'étape. */
function PublishResult({ copy }: { copy: CorrectionDetail }) {
  const run = useEvaluationAction();
  return (
    <Alert variant="info">
      <CheckCheck aria-hidden />
      <AlertTitle>Note validée</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          Publier rend le résultat visible dans l’historique du routier (et dans son espace s’il a
          un compte). Aucune étape n’est modifiée.
        </p>
        <ConfirmDialog
          trigger={
            <Button type="button" size="sm">
              <Megaphone aria-hidden />
              Publier le résultat
            </Button>
          }
          title="Publier le résultat ?"
          description={<p>Le résultat de {copy.code} sera visible du routier.</p>}
          confirmLabel="Publier"
          onConfirm={() =>
            run(() => acceptReview(copy.id, {}), {
              success: 'Résultat publié',
              error: 'Publication impossible',
            })
          }
        />
      </AlertDescription>
    </Alert>
  );
}

/**
 * Bascule au papier (D164) d'une tentative en ligne non remise : la tentative est annulée (ses
 * réponses restent dans l'historique) et une copie papier est préparée. Refusée par le serveur
 * pendant une réservation hors ligne non synchronisée.
 */
function SwitchToPaper({ copy }: { copy: CorrectionDetail }) {
  const run = useEvaluationAction();
  const router = useRouter();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Problème de téléphone ?</CardTitle>
        <CardDescription>
          Le routier peut terminer sur papier. Les réponses déjà enregistrées restent dans
          l’historique de cette tentative ; une seule copie sera notée.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CommentDialog
          trigger={
            <Button type="button" variant="outline">
              <Smartphone aria-hidden />
              Basculer au papier
            </Button>
          }
          title="Basculer cette tentative au papier ?"
          description={
            <p>
              La tentative {copy.code} sera annulée et une copie papier préparée avec un nouveau
              code.
            </p>
          }
          label="Motif"
          required
          confirmLabel="Basculer au papier"
          onConfirm={async (reason) => {
            let next: string | null = null;
            const done = await run(
              async () => {
                const paper = await switchToPaper(copy.code, { reason });
                next = paper.code;
                return paper;
              },
              { success: 'Copie papier préparée', error: 'Bascule impossible' },
            );
            if (done && next) router.push(`/encadrement/corrections/${next}`);
            return done;
          }}
        />
      </CardContent>
    </Card>
  );
}

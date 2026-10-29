import {
  ATTEMPT_STATUS_LABELS,
  type CorrectionDetail,
  EVALUATION_MODE_LABELS,
  isObjectiveQuestion,
  QUESTION_TYPE_LABELS,
} from '@tesla/shared';
import { Check, CircleAlert, Square, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatDateTime, formatPoints, formatScore, fullName } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AttemptStatusBadge } from './attempt-status-badge';

/** En-tête d'une copie : routier (avec ou sans compte), équipe, étape, version exacte, statut. */
export function CopyHeader({ copy }: { copy: CorrectionDetail }) {
  const { scout } = copy;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-sm font-semibold text-tesla-rouge">{copy.code}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-tesla-bordeaux">
            {copy.version.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {copy.evaluation.code} · version {copy.version.version} ·{' '}
            {EVALUATION_MODE_LABELS[copy.mode]}
            {copy.evaluation.module && ` · ${copy.evaluation.module.code}`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <AttemptStatusBadge status={copy.status} />
          <p className="text-lg font-semibold">{formatScore(copy.score, copy.maxScore)}</p>
        </div>
      </div>
      <dl className="grid gap-3 rounded-lg border bg-tesla-sable/20 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Routier</dt>
          <dd className="font-medium">
            {fullName(scout)}
            {!scout.hasAccount && (
              <Badge variant="outline" className="ml-2">
                Sans compte
              </Badge>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Matricule</dt>
          <dd className="font-medium">{scout.matricule ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Équipe</dt>
          <dd className="font-medium">
            {scout.team?.name ?? '—'}
            {scout.teamAtPreparation && scout.teamAtPreparation.id !== scout.team?.id && (
              <span className="block text-xs text-muted-foreground">
                À la préparation : {scout.teamAtPreparation.name}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Étape actuelle</dt>
          <dd className="font-medium">{scout.stage?.name ?? '—'}</dd>
        </div>
      </dl>
      {!copy.version.isCurrent && (
        <Alert variant="info">
          <CircleAlert aria-hidden />
          <AlertDescription>
            Copie liée à la version {copy.version.version} du questionnaire, qui n’est plus la
            version publiée : elle est corrigée selon sa propre version.
          </AlertDescription>
        </Alert>
      )}
      {copy.waiver && (
        <p className="text-sm text-muted-foreground">
          Passée par dérogation du responsable : « {copy.waiver.reason} »
        </p>
      )}
    </div>
  );
}

/** Réponses, corrigé et notes (lecture seule). */
export function CopyAnswers({ copy }: { copy: CorrectionDetail }) {
  return (
    <ol className="space-y-3">
      {copy.questions.map((question, index) => {
        const answer = question.answer;
        return (
          <li key={question.id} className="space-y-2 rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-semibold text-tesla-bordeaux">
                Question {index + 1} · {QUESTION_TYPE_LABELS[question.type]}
              </span>
              <span className="font-medium">
                {answer?.awardedPoints == null
                  ? `— / ${formatPoints(question.points)}`
                  : formatScore(answer.awardedPoints, question.points)}
                {answer?.autoScored && (
                  <span className="ml-1 text-xs text-muted-foreground">(automatique)</span>
                )}
              </span>
            </div>
            <p className="whitespace-pre-line">{question.prompt}</p>
            {isObjectiveQuestion(question.type) ? (
              <ul className="space-y-1">
                {question.options.map((option) => {
                  const chosen = answer?.optionIds.includes(option.id) ?? false;
                  return (
                    <li
                      key={option.id}
                      className={cn(
                        'flex items-start gap-2 rounded-md border px-3 py-1.5 text-sm',
                        option.isCorrect && 'border-tesla-or bg-tesla-sable/40',
                      )}
                    >
                      {chosen ? (
                        option.isCorrect ? (
                          <Check className="mt-0.5 size-4 text-tesla-rouge" aria-hidden />
                        ) : (
                          <X className="mt-0.5 size-4 text-destructive" aria-hidden />
                        )
                      ) : (
                        <Square className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
                      )}
                      <span>
                        {option.label}
                        <span className="sr-only">
                          {chosen ? ' — choisie' : ''}
                          {option.isCorrect ? ' — bonne réponse' : ''}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <>
                <p className="rounded-md bg-muted/50 px-3 py-2 text-sm whitespace-pre-line">
                  {answer?.text ?? <span className="text-muted-foreground">Sans réponse</span>}
                </p>
                {question.expectedAnswer && (
                  <p className="text-xs text-muted-foreground">
                    Attendu : {question.expectedAnswer}
                  </p>
                )}
              </>
            )}
            {(answer?.appreciation || answer?.comment) && (
              <p className="text-sm">
                {answer.appreciation && <span className="font-medium">{answer.appreciation}</span>}
                {answer.appreciation && answer.comment && ' — '}
                {answer.comment}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Historique de la tentative (ajout seul) : saisies, soumissions, décisions, motifs. */
export function CopyHistory({ copy }: { copy: CorrectionDetail }) {
  return (
    <ol className="space-y-2 border-l-2 border-tesla-sable pl-4 text-sm">
      {copy.events.map((event) => (
        <li key={event.id}>
          <span className="font-medium">{ATTEMPT_STATUS_LABELS[event.toStatus]}</span>{' '}
          <span className="text-muted-foreground">
            · {fullName(event.actor)} · {formatDateTime(event.createdAt)}
          </span>
          {event.reason && (
            <p className="mt-1 rounded-md bg-muted/60 px-3 py-1.5 whitespace-pre-line">
              {event.reason}
            </p>
          )}
        </li>
      ))}
      {copy.plannedFor && (
        <li className="text-muted-foreground">Passation prévue le {formatDate(copy.plannedFor)}</li>
      )}
    </ol>
  );
}

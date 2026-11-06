'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ATTEMPT_STATUS_LABELS,
  EVALUATION_MODE_LABELS,
  type EvaluationQuestionResult,
  QUESTION_TYPE_LABELS,
} from '@tesla/shared';
import { Check, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { BackLink } from '@/components/back-link';
import { EmptyState } from '@/components/empty-state';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { evaluationResultsQueryOptions } from '@/lib/api/evaluations';
import { formatDateTime, formatPoints, fullName } from '@/lib/format';

const percent = (rate: number) => `${Math.round(rate * 100)} %`;

/**
 * Résultats d'un questionnaire pour l'encadrement (D139) : participation, copies (par ordre
 * alphabétique, sans classement), réponses et répartition par question. Lecture seule.
 */
export function EvaluationResultsView() {
  const { id } = useParams<{ id: string }>();
  const { data, error, isPending, refetch } = useQuery(evaluationResultsQueryOptions(id));

  if (isPending) return <TableSkeleton rows={6} />;
  if (error) return <QueryError error={error} onRetry={() => void refetch()} />;

  const facts = [
    { label: 'Routiers concernés', value: data.concerned },
    { label: 'Ont participé', value: data.participants },
    { label: 'N’ont pas participé', value: data.notParticipated },
    { label: 'Copies remises', value: data.finishedAttempts },
    { label: 'Passations en cours', value: data.openAttempts },
    {
      label: 'Moyenne',
      value: data.averagePercent === null ? '—' : `${Math.round(data.averagePercent)} %`,
      hint: 'Copies entièrement notées',
    },
  ];
  // Questions les moins réussies d'abord (au moins une copie notée).
  const struggling = data.questions
    .filter((question) => question.successRate !== null && question.successRate < 0.5)
    .sort((a, b) => a.successRate! - b.successRate!);

  return (
    <div className="space-y-6">
      <BackLink href="/encadrement/evaluations">Questionnaires</BackLink>
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          {data.evaluation.stage.name}
          {data.evaluation.version !== null &&
            ` · questions de la version ${data.evaluation.version}`}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-tesla-bordeaux">
          {data.evaluation.title}
        </h1>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {facts.map((fact) => (
          <div key={fact.label} className="rounded-lg border bg-card p-3">
            <dt className="text-xs text-muted-foreground">{fact.label}</dt>
            <dd className="text-2xl font-semibold text-tesla-bordeaux">{fact.value}</dd>
            {fact.hint && <dd className="text-xs text-muted-foreground">{fact.hint}</dd>}
          </div>
        ))}
      </dl>

      {struggling.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Questions souvent manquées</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {struggling.map((question) => (
                <li key={question.position}>
                  <a
                    href={`#question-${question.position}`}
                    className="text-tesla-rouge hover:underline"
                  >
                    Question {question.position + 1}
                  </a>{' '}
                  — {percent(question.successRate!)} de réussite complète : {question.prompt}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Copies</CardTitle>
        </CardHeader>
        <CardContent>
          {data.attempts.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Aucune copie remise" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Routier</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead className="hidden sm:table-cell">Statut</TableHead>
                  <TableHead className="hidden md:table-cell">Mode</TableHead>
                  <TableHead className="hidden lg:table-cell">Remise</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.attempts.map((attempt) => (
                  <TableRow key={attempt.code}>
                    <TableCell>
                      <Link
                        href={`/encadrement/corrections/${attempt.code}`}
                        className="font-medium text-tesla-rouge underline-offset-4 hover:underline"
                      >
                        {fullName(attempt.scout)}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {attempt.code} · v{attempt.version}
                      </p>
                    </TableCell>
                    <TableCell>
                      {formatPoints(attempt.score)} / {formatPoints(attempt.maxScore)}
                      {!attempt.complete && (
                        <p className="text-xs text-muted-foreground">Notation en cours</p>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline">{ATTEMPT_STATUS_LABELS[attempt.status]}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {EVALUATION_MODE_LABELS[attempt.mode]}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {attempt.submittedAt ? formatDateTime(attempt.submittedAt) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data.questions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-tesla-bordeaux">Réponses par question</h2>
          {data.questions.map((question) => (
            <QuestionResult key={question.position} question={question} />
          ))}
        </section>
      )}
    </div>
  );
}

function QuestionResult({ question }: { question: EvaluationQuestionResult }) {
  const graded = question.fullPoints + question.partialPoints + question.noPoints;
  return (
    <Card id={`question-${question.position}`}>
      <CardHeader>
        <p className="text-xs text-muted-foreground">
          Question {question.position + 1} · {QUESTION_TYPE_LABELS[question.type]} ·{' '}
          {formatPoints(question.points)}
        </p>
        <CardTitle className="text-base">{question.prompt}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          {question.answered} réponse{question.answered > 1 ? 's' : ''} sur {question.copies} copie
          {question.copies > 1 ? 's' : ''} · tous les points : {question.fullPoints} · en partie :{' '}
          {question.partialPoints} · aucun point : {question.noPoints}
          {question.pendingGrade > 0 && ` · à noter : ${question.pendingGrade}`}
          {graded > 0 &&
            question.successRate !== null &&
            ` · réussite ${percent(question.successRate)}`}
        </p>
        {question.options.length > 0 && (
          <ul className="space-y-1.5">
            {question.options.map((option, index) => {
              const share = question.copies === 0 ? 0 : option.chosen / question.copies;
              return (
                <li key={index} className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5">
                      {option.isCorrect && (
                        <Check className="size-4 text-tesla-bordeaux" aria-label="Bonne réponse" />
                      )}
                      {option.label}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {option.chosen}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted" aria-hidden>
                    <div
                      className={
                        option.isCorrect
                          ? 'h-full rounded-full bg-tesla-or'
                          : 'h-full rounded-full bg-tesla-rouge/60'
                      }
                      style={{ width: `${Math.round(share * 100)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {question.texts.length > 0 && (
          <details>
            <summary className="cursor-pointer font-medium">
              Réponses rédigées ({question.texts.length})
            </summary>
            <ul className="mt-2 space-y-2">
              {question.texts.map((item) => (
                <li key={item.code} className="rounded-md border p-2">
                  <p className="whitespace-pre-line">{item.text}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.code} ·{' '}
                    {item.awardedPoints === null ? 'à noter' : formatPoints(item.awardedPoints)}
                  </p>
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type AttemptSession } from '@tesla/shared';
import { ArrowLeft, ArrowRight, CircleCheck, Save, Send } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { BackLink } from '@/components/back-link';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AnswerFields } from '@/components/evaluations/answer-fields';
import { useToast } from '@/components/ui/toaster';
import { saveAnswers, startAttempt, submitAttempt } from '@/lib/api/evaluations';

type Answers = Record<string, { optionIds: string[]; text: string }>;

function toAnswers(session: AttemptSession): Answers {
  return Object.fromEntries(
    session.answers.map((answer) => [
      answer.questionId,
      { optionIds: answer.optionIds, text: answer.text ?? '' },
    ]),
  );
}

const isAnswered = (answer: Answers[string] | undefined) =>
  !!answer && (answer.optionIds.length > 0 || answer.text.trim() !== '');

/**
 * Passation en ligne, une question par écran (confortable sur smartphone). Démarrage idempotent :
 * l'ouverture reprend la tentative en cours. Sauvegarde à chaque changement de question ; remise
 * définitive après confirmation, protégée côté serveur contre les doubles envois.
 */
export function TakeEvaluation() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const queryClient = useQueryClient();
  const headingId = useId();
  const {
    data: session,
    error,
    isPending,
    refetch,
  } = useQuery({
    // Clé hors de « evaluations » : les invalidations après remise ne relancent pas le démarrage.
    queryKey: ['attempt-session', id],
    queryFn: () => startAttempt(id),
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState<AttemptSession | null>(null);
  const loaded = useRef<string | null>(null);

  useEffect(() => {
    if (session && loaded.current !== session.id) {
      loaded.current = session.id;
      setAnswers(toAnswers(session));
    }
  }, [session]);

  if (isPending) return <TableSkeleton rows={5} />;
  if (error) {
    return (
      <>
        <BackLink href={`/evaluations/${id}`}>Retour à l’évaluation</BackLink>
        <QueryError error={error} onRetry={() => void refetch()} />
      </>
    );
  }

  const current = finished ?? session;
  if (current.status !== 'EN_COURS') {
    return (
      <Alert variant="info">
        <CircleCheck aria-hidden />
        <AlertTitle>Vos réponses ont été remises</AlertTitle>
        <AlertDescription>
          <p>
            Les questions à choix sont corrigées ; les réponses rédigées le seront par
            l’encadrement, puis le responsable examinera le résultat. Vous le retrouverez dans « Mes
            résultats ».
          </p>
          <Button asChild size="sm">
            <Link href="/mes-resultats">Mes résultats</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const questions = session.questions;
  const question = questions[index]!;
  const answer = answers[question.id] ?? { optionIds: [], text: '' };
  const answeredCount = questions.filter((q) => isAnswered(answers[q.id])).length;
  const payload = () => ({
    answers: questions.map((q) => ({
      questionId: q.id,
      optionIds: answers[q.id]?.optionIds ?? [],
      text: answers[q.id]?.text ?? '',
    })),
  });

  const persist = async (): Promise<boolean> => {
    if (!dirty) return true;
    setSaving(true);
    try {
      await saveAnswers(session.id, payload());
      setDirty(false);
      return true;
    } catch (cause) {
      toast.error('Enregistrement impossible', cause instanceof Error ? cause.message : undefined);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const goTo = async (next: number) => {
    await persist();
    setIndex(next);
  };

  const update = (value: Partial<Answers[string]>) => {
    setAnswers({ ...answers, [question.id]: { ...answer, ...value } });
    setDirty(true);
  };

  const submit = async (): Promise<boolean> => {
    try {
      const result = await submitAttempt(session.id, payload());
      setFinished(result);
      await queryClient.invalidateQueries({ queryKey: ['evaluations'] });
      toast.success('Réponses remises', 'Merci ! Votre copie part en correction.');
      return true;
    } catch (cause) {
      toast.error('Remise impossible', cause instanceof Error ? cause.message : undefined);
      await refetch();
      return false;
    }
  };

  return (
    <>
      <BackLink href={`/evaluations/${id}`}>Retour à l’évaluation</BackLink>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {session.evaluation.title} · <span className="font-mono">{session.code}</span>
        </p>
        <div className="flex items-center justify-between gap-2 text-sm">
          <span>
            Question {index + 1} sur {questions.length}
          </span>
          <span className="text-muted-foreground">
            {answeredCount} répondue{answeredCount > 1 ? 's' : ''}
          </span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Progression"
          aria-valuemin={0}
          aria-valuemax={questions.length}
          aria-valuenow={answeredCount}
        >
          <div
            className="h-full bg-tesla-rouge transition-all"
            style={{ width: `${(answeredCount / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {index === 0 && session.evaluation.instructions && (
        <section className="rounded-lg border bg-tesla-sable/30 p-4 text-sm">
          <h3 className="font-semibold">Consignes</h3>
          <p className="whitespace-pre-line">{session.evaluation.instructions}</p>
        </section>
      )}

      <section
        aria-labelledby={headingId}
        className="space-y-4 rounded-lg border bg-card p-4 sm:p-6"
      >
        <AnswerFields question={question} answer={answer} onChange={update} />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="outline"
          disabled={index === 0 || saving}
          onClick={() => void goTo(index - 1)}
        >
          <ArrowLeft aria-hidden />
          Précédente
        </Button>
        <Button variant="ghost" disabled={!dirty || saving} onClick={() => void persist()}>
          <Save aria-hidden />
          {saving ? 'Enregistrement…' : dirty ? 'Enregistrer' : 'Enregistré'}
        </Button>
        {index < questions.length - 1 ? (
          <Button disabled={saving} onClick={() => void goTo(index + 1)}>
            Suivante
            <ArrowRight aria-hidden />
          </Button>
        ) : (
          <ConfirmDialog
            trigger={
              <Button disabled={saving}>
                <Send aria-hidden />
                Remettre mes réponses
              </Button>
            }
            title="Remettre vos réponses ?"
            description={
              <>
                <p>
                  Vous avez répondu à {answeredCount} question{answeredCount > 1 ? 's' : ''} sur{' '}
                  {questions.length}. Après la remise, vos réponses ne seront plus modifiables.
                </p>
                {answeredCount < questions.length && (
                  <p className="font-medium">Certaines questions sont sans réponse.</p>
                )}
              </>
            }
            confirmLabel="Remettre définitivement"
            onConfirm={submit}
          />
        )}
      </div>

      <nav aria-label="Aller à une question" className="flex flex-wrap gap-1.5">
        {questions.map((q, position) => (
          <Button
            key={q.id}
            size="sm"
            variant={
              position === index ? 'default' : isAnswered(answers[q.id]) ? 'secondary' : 'outline'
            }
            className="size-9 p-0"
            aria-current={position === index ? 'step' : undefined}
            aria-label={`Question ${position + 1}${isAnswered(answers[q.id]) ? ', répondue' : ''}`}
            onClick={() => void goTo(position)}
          >
            {position + 1}
          </Button>
        ))}
      </nav>
    </>
  );
}

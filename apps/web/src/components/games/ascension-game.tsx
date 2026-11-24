'use client';

import { ArrowRight, Lightbulb, Mountain, RotateCcw, SkipForward, Split } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AnswerFeedback, ChoiceButton } from '@/components/practice/kit';
import { Button } from '@/components/ui/button';
import { feedback } from '@/lib/feedback';
import { cn } from '@/lib/utils';

export interface AscensionQuestion {
  id: string;
  prompt: string;
  options: string[];
  answer: number;
  hint?: string;
  explanation?: string;
}

type Joker = 'fifty' | 'hint' | 'skip';

interface State {
  /** Index de la question en cours dans la liste (réserve comprise). */
  question: number;
  /** Paliers franchis. */
  level: number;
  used: Joker[];
  removed: number[];
  hintShown: boolean;
}

const START: State = { question: 0, level: 0, used: [], removed: [], hintShown: false };
const KEY = 'tesla.games.ascension';

/**
 * L'Ascension (D198) : jeu original à paliers, inspiré des jeux de questions à étapes, sans aucun
 * élément d'émission existante. Entraînement seulement : jokers autorisés, aucun résultat
 * enregistré, aucune valeur officielle. Une erreur arrête la partie ; on recommence aussitôt.
 * La partie en cours reprend après une fermeture.
 */
export function AscensionGame({
  questions,
  exitHref,
  size = 10,
}: {
  questions: AscensionQuestion[];
  exitHref: string;
  size?: number;
}) {
  const signature = useMemo(() => questions.map((q) => q.id).join('|'), [questions]);
  const [state, setState] = useState<State>(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as {
        signature: string;
        state: State;
      } | null;
      return saved?.signature === signature ? saved.state : START;
    } catch {
      return START;
    }
  });
  const [chosen, setChosen] = useState<number | null>(null);
  const total = Math.min(size, Math.max(0, questions.length - 1));
  const finishedWin = state.level >= total && total > 0;
  const lost = chosen !== null && chosen !== questions[state.question]?.answer;

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ signature, state }));
    } catch {
      // Stockage indisponible.
    }
  }, [signature, state]);

  if (total < 3)
    return (
      <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
        Il faut au moins quatre questions à choix publiées pour cette ascension.
      </p>
    );

  const restart = () => {
    setChosen(null);
    setState(START);
  };

  if (finishedWin)
    return (
      <div className="animate-achieve space-y-4 rounded-2xl border-2 border-tesla-or bg-tesla-sable/40 p-6 text-center">
        <Mountain className="mx-auto size-10 text-tesla-rouge" aria-hidden />
        <p className="text-xl font-semibold text-tesla-bordeaux">Sommet atteint</p>
        <p className="text-sm text-muted-foreground">{total} paliers franchis.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href={exitHref}>Autres défis</Link>
          </Button>
          <Button variant="outline" onClick={restart}>
            Rejouer
          </Button>
        </div>
      </div>
    );

  const question = questions[state.question]!;
  const hasReserve = state.question + 1 < questions.length && questions.length > total;
  const canUse = (joker: Joker) => !state.used.includes(joker) && chosen === null;

  const choose = (option: number) => {
    if (chosen !== null) return;
    setChosen(option);
    feedback(option === question.answer ? 'success' : 'error');
  };

  const nextQuestion = () => {
    setChosen(null);
    setState({
      ...state,
      question: state.question + 1,
      level: state.level + 1,
      removed: [],
      hintShown: false,
    });
  };

  const applyJoker = (joker: Joker) => {
    if (!canUse(joker)) return;
    if (joker === 'fifty') {
      const wrong = question.options
        .map((_, index) => index)
        .filter((index) => index !== question.answer);
      setState({
        ...state,
        used: [...state.used, joker],
        removed: wrong.slice(0, Math.max(0, question.options.length - 2)),
      });
    } else if (joker === 'hint') {
      setState({ ...state, used: [...state.used, joker], hintShown: true });
    } else {
      // Passer : la question est remplacée par une question de réserve, le palier ne change pas.
      setState({
        ...state,
        used: [...state.used, joker],
        question: state.question + 1,
        removed: [],
        hintShown: false,
      });
    }
  };

  return (
    <div className="space-y-5">
      <ol className="flex gap-1" aria-label={`Palier ${state.level + 1} sur ${total}`}>
        {Array.from({ length: total }, (_, index) => (
          <li
            key={index}
            className={cn(
              'h-2 flex-1 rounded-full transition-colors duration-300',
              index < state.level
                ? 'bg-tesla-or'
                : index === state.level
                  ? 'bg-tesla-rouge'
                  : 'bg-muted',
            )}
          />
        ))}
      </ol>
      <p className="text-xs font-medium tracking-wide text-tesla-rouge uppercase">
        Palier {state.level + 1} sur {total}
      </p>

      <div key={question.id} className="animate-enter space-y-4">
        <p className="text-lg leading-snug font-medium text-balance">{question.prompt}</p>
        <div className="grid gap-2.5" role="group" aria-label="Propositions">
          {question.options.map((option, index) =>
            state.removed.includes(index) ? null : (
              <ChoiceButton
                key={index}
                onClick={() => choose(index)}
                disabled={chosen !== null}
                state={
                  chosen === null
                    ? 'idle'
                    : index === question.answer
                      ? 'correct'
                      : index === chosen
                        ? 'wrong'
                        : 'muted'
                }
              >
                {option}
              </ChoiceButton>
            ),
          )}
        </div>
        {state.hintShown && question.hint && (
          <p className="rounded-xl bg-tesla-sable/40 px-4 py-3 text-sm">{question.hint}</p>
        )}
        {chosen !== null && <AnswerFeedback correct={!lost} explanation={question.explanation} />}
      </div>

      {chosen === null ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Jokers">
          <Button
            variant="outline"
            size="sm"
            disabled={!canUse('fifty') || question.options.length < 3}
            onClick={() => applyJoker('fifty')}
          >
            <Split aria-hidden />
            Deux de moins
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!canUse('hint') || !question.hint}
            onClick={() => applyJoker('hint')}
          >
            <Lightbulb aria-hidden />
            Indice
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!canUse('skip') || !hasReserve}
            onClick={() => applyJoker('skip')}
          >
            <SkipForward aria-hidden />
            Passer
          </Button>
        </div>
      ) : lost ? (
        <div className="space-y-3">
          <p className="text-sm">
            Arrêt au palier <span className="font-semibold">{state.level}</span>. La bonne réponse
            est indiquée ci-dessus.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={restart} autoFocus>
              <RotateCcw aria-hidden />
              Recommencer
            </Button>
            <Button asChild variant="outline">
              <Link href={exitHref}>Autres défis</Link>
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={nextQuestion} autoFocus>
          Palier suivant
          <ArrowRight aria-hidden />
        </Button>
      )}
    </div>
  );
}

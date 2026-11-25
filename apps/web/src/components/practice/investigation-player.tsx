'use client';

import { type PracticeActivity } from '@tesla/shared';
import { ArrowRight, Eye, FileSearch, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { feedback } from '@/lib/feedback';
import { AnswerFeedback, ChoiceButton, type PlayerProps, useSaved } from './kit';

type Investigation = Extract<PracticeActivity, { kind: 'investigation' }>;

/**
 * Enquête (D206) : une mission, des indices vérifiés rédigés par l'encadrement, révélés un à un
 * dans le carnet, puis une énigme. On peut répondre à tout moment ; une erreur n'arrête rien (on
 * cherche encore), la solution expliquée reste accessible. Les indices ne sont jamais pénalisés :
 * seule la première proposition compte pour le suivi d'entraînement.
 */
export function InvestigationPlayer(props: PlayerProps<Investigation>) {
  const { activity, onDone } = props;
  const [revealed, setRevealed] = useSaved(props, 'revealed', 1);
  const [first, setFirst] = useSaved<number | null>(props, 'first', null);
  const [chosen, setChosen] = useSaved<number | null>(props, 'chosen', null);
  const [solution, setSolution] = useSaved(props, 'solution', false);
  const clues = activity.clues.slice(0, Math.max(1, Math.min(revealed, activity.clues.length)));
  const solved = chosen === activity.answer;
  const finished = solved || solution;

  const choose = (option: number) => {
    if (finished) return;
    if (first === null) setFirst(option);
    setChosen(option);
    feedback(option === activity.answer ? 'success' : 'error');
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 rounded-xl bg-tesla-bordeaux px-4 py-3 text-tesla-sable">
        <Search className="mt-0.5 size-5 shrink-0 text-tesla-or" aria-hidden />
        <p className="leading-relaxed">{activity.mission}</p>
      </div>

      <section aria-label="Carnet d’enquête" className="space-y-2">
        <ol className="space-y-2">
          {clues.map((clue, index) => (
            <li
              key={index}
              className="animate-enter rounded-xl border border-dashed border-tesla-or/70 bg-tesla-sable/30 px-4 py-3"
            >
              <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-tesla-rouge uppercase">
                <FileSearch className="size-3.5" aria-hidden />
                {clue.label || `Indice ${index + 1}`}
              </p>
              <p className="mt-1 text-sm leading-relaxed">{clue.text}</p>
            </li>
          ))}
        </ol>
        {!finished && revealed < activity.clues.length && (
          <Button variant="ghost" size="sm" onClick={() => setRevealed(revealed + 1)}>
            <FileSearch aria-hidden />
            Indice suivant ({revealed + 1}/{activity.clues.length})
          </Button>
        )}
      </section>

      <div className="space-y-2.5">
        <p className="font-medium text-balance">{activity.question}</p>
        <div className="grid gap-2" role="group" aria-label="Propositions">
          {activity.options.map((option, index) => (
            <ChoiceButton
              key={index}
              onClick={() => choose(index)}
              disabled={finished}
              state={
                finished && index === activity.answer
                  ? 'correct'
                  : chosen === index
                    ? 'wrong'
                    : finished
                      ? 'muted'
                      : 'idle'
              }
            >
              {option}
            </ChoiceButton>
          ))}
        </div>
      </div>

      {chosen !== null && !finished && (
        <div className="flex flex-wrap items-center gap-2" role="status">
          <p className="text-sm">Pas encore. Relisez les indices.</p>
          <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setSolution(true)}>
            <Eye aria-hidden />
            Voir la solution
          </Button>
        </div>
      )}
      {finished && (
        <AnswerFeedback
          correct={solved}
          neutral={!solved}
          explanation={
            activity.explanation ??
            (solved ? undefined : `Réponse : ${activity.options[activity.answer]}`)
          }
        />
      )}
      {finished && (
        <Button onClick={() => onDone([first ?? -1])} autoFocus>
          Terminer
          <ArrowRight aria-hidden />
        </Button>
      )}
    </div>
  );
}

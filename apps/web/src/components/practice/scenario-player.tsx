'use client';

import { type PracticeActivity } from '@tesla/shared';
import { Button } from '@/components/ui/button';
import { AnswerFeedback, ChoiceButton, type PlayerProps, useSaved } from './kit';

type Scenario = Extract<PracticeActivity, { kind: 'scenario' }>;

/**
 * Mise en situation : plusieurs choix peuvent être raisonnables. Chaque choix reçoit l'éclairage
 * rédigé par l'encadrement, sans « bonne » ni « mauvaise » réponse ; on peut explorer les autres.
 */
export function ScenarioPlayer(props: PlayerProps<Scenario>) {
  const { activity, onDone } = props;
  const [chosen, setChosen] = useSaved<number | null>(props, 'chosen', null);
  const [first, setFirst] = useSaved<number | null>(props, 'first', null);
  return (
    <div className="space-y-4">
      <p className="rounded-2xl bg-tesla-sable/40 p-4 leading-relaxed whitespace-pre-line">
        {activity.situation}
      </p>
      <p className="text-sm font-medium">Que feriez-vous ?</p>
      <div className="grid gap-2.5" role="group" aria-label="Choix possibles">
        {activity.choices.map((choice, index) => (
          <ChoiceButton
            key={index}
            state={chosen === index ? 'selected' : 'idle'}
            onClick={() => {
              setChosen(index);
              if (first === null) setFirst(index);
            }}
          >
            {choice.label}
          </ChoiceButton>
        ))}
      </div>
      {chosen !== null && (
        <>
          <AnswerFeedback
            key={chosen}
            neutral
            correct
            explanation={activity.choices[chosen]!.insight}
          />
          <p className="text-xs text-muted-foreground">
            Vous pouvez explorer les autres choix : plusieurs peuvent se défendre.
          </p>
          <Button onClick={() => onDone([first ?? chosen])}>Terminer</Button>
        </>
      )}
    </div>
  );
}

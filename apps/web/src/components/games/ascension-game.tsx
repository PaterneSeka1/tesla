'use client';

import { ArrowRight, BookOpen, Lightbulb, RotateCcw, SkipForward, Split } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AnswerFeedback, ChoiceButton } from '@/components/practice/kit';
import { Button } from '@/components/ui/button';
import { feedback } from '@/lib/feedback';
import { type GameSession } from '@/lib/game-session';
import { type AscensionQuestion } from '@/lib/games';
import { RETRYABLE, type SaveState } from '@/lib/practice-results';
import { cn } from '@/lib/utils';
import { AscensionLandscape, stageName } from './ascension-landscape';

export type Joker = 'fifty' | 'hint' | 'skip';

export interface AscensionData {
  /** Questions tirées à l'ouverture (version comprise) ; la dernière sert de réserve. */
  picked: { id: string; fingerprint: string }[];
  question: number;
  /** Paliers franchis. */
  level: number;
  used: Joker[];
  removed: number[];
  hintShown: boolean;
  /** Réponse donnée à la question en cours (null : pas encore répondu). */
  chosen: number | null;
  /** Un joker a servi pour la question en cours : la réponse est « assistée ». */
  assisted: boolean;
  /** Paliers franchis sans aucun joker. */
  autonomous: number;
  /** Identifiant de tentative de la réponse en cours, créé une fois (renvois idempotents). */
  answerId?: string;
}

export const ascensionStart = (picked: AscensionQuestion[]): AscensionData => ({
  picked: picked.map((question) => ({ id: question.id, fingerprint: question.fingerprint })),
  question: 0,
  level: 0,
  used: [],
  removed: [],
  hintShown: false,
  chosen: null,
  assisted: false,
  autonomous: 0,
});

export function ascensionStillValid(data: AscensionData, pool: readonly AscensionQuestion[]) {
  const byId = new Map(pool.map((question) => [question.id, question.fingerprint]));
  return (
    data.picked.length > 0 &&
    data.question < data.picked.length &&
    data.picked.every((item) => byId.get(item.id) === item.fingerprint)
  );
}

const JOKERS: { key: Joker; label: string; icon: typeof Split }[] = [
  { key: 'fifty', label: 'Deux de moins', icon: Split },
  { key: 'hint', label: 'Indice', icon: Lightbulb },
  { key: 'skip', label: 'Changer', icon: SkipForward },
];

/**
 * L'Ascension (D198, D202) : jeu original à paliers sur un sentier de savane, du pied du baobab au
 * sommet. Entraînement seulement : jokers, aucune note officielle. Chaque réponse est envoyée au
 * serveur (mode `ascension`) : une erreur remet la notion à revoir, une réponse aidée par un joker
 * n'est jamais une maîtrise. La partie reprend exactement où elle s'était arrêtée.
 */
export function AscensionGame({
  session,
  pool,
  exitHref,
  size,
  onUpdate,
  onRestart,
  onFinish,
  onAnswer,
  records,
}: {
  /** Les réponses sont enregistrées (apprenant) ; sinon aperçu de l'encadrement. */
  records: boolean;
  session: GameSession<AscensionData>;
  /** Toutes les questions disponibles (pour retrouver celles de la partie). */
  pool: readonly AscensionQuestion[];
  exitHref: string;
  size: number;
  onUpdate: (data: AscensionData) => void;
  onRestart: () => void;
  onFinish: () => void;
  /** Envoi de la réponse (aperçu : rien). Renvoie l'issue de l'enregistrement. */
  onAnswer: (
    question: AscensionQuestion,
    answer: number,
    assisted: boolean,
    attemptId: string,
  ) => Promise<SaveState>;
}) {
  const state = session.data;
  const byId = new Map(pool.map((question) => [question.id, question]));
  const questions = state.picked.map((item) => byId.get(item.id)!);
  const total = Math.min(size, questions.length - 1);
  const [unsent, setUnsent] = useState(0);
  const question = questions[state.question]!;
  const lost = state.chosen !== null && state.chosen !== question.answer;
  const won = state.level >= total;

  const answer = (option: number) => {
    if (state.chosen !== null) return;
    const correct = option === question.answer;
    feedback(correct ? 'success' : 'error');
    const attemptId = crypto.randomUUID();
    onUpdate({ ...state, chosen: option, answerId: attemptId });
    void onAnswer(question, option, state.assisted, attemptId).then((saved) => {
      if (RETRYABLE.includes(saved)) setUnsent((count) => count + 1);
    });
    if (!correct) onFinish();
  };

  const climb = () => {
    const level = state.level + 1;
    onUpdate({
      ...state,
      question: state.question + 1,
      level,
      removed: [],
      hintShown: false,
      chosen: null,
      answerId: undefined,
      assisted: false,
      autonomous: state.autonomous + (state.assisted ? 0 : 1),
    });
    if (level >= total) {
      feedback('reward');
      onFinish();
    }
  };

  // Reprise après une fermeture juste après la réponse : même identifiant, aucun double comptage.
  const resent = useRef(false);
  useEffect(() => {
    if (resent.current || state.chosen === null || !state.answerId) return;
    resent.current = true;
    void onAnswer(question, state.chosen, state.assisted, state.answerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule fois, à l'ouverture.
  }, []);

  const hasReserve = state.question + 1 < questions.length && questions.length > total;
  const canUse = (joker: Joker) =>
    !state.used.includes(joker) &&
    state.chosen === null &&
    (joker !== 'fifty' || question.options.length >= 3) &&
    (joker !== 'skip' || hasReserve);

  const applyJoker = (joker: Joker) => {
    if (!canUse(joker)) return;
    const used = [...state.used, joker];
    if (joker === 'fifty') {
      const wrong = question.options
        .map((_, index) => index)
        .filter((index) => index !== question.answer);
      // Toujours les mêmes propositions retirées pour une question donnée (reprise fidèle).
      const removed = wrong
        .sort((a, b) => ((a * 7 + question.item) % 5) - ((b * 7 + question.item) % 5))
        .slice(0, Math.max(0, question.options.length - 2));
      onUpdate({ ...state, used, removed, assisted: true });
    } else if (joker === 'hint') {
      onUpdate({ ...state, used, hintShown: true, assisted: true });
    } else {
      // Changer : la question est remplacée par la réserve, le palier ne change pas.
      onUpdate({
        ...state,
        used,
        question: state.question + 1,
        removed: [],
        hintShown: false,
        assisted: false,
      });
    }
  };

  if (won)
    return (
      <div className="animate-achieve space-y-4 text-center">
        <AscensionLandscape total={total} level={total} state="summit" />
        <p className="text-xl font-semibold text-tesla-bordeaux">Sommet atteint</p>
        <p className="text-sm text-muted-foreground">
          {state.autonomous === total
            ? 'Sans aucun joker.'
            : `${state.autonomous} paliers sur ${total} sans joker.`}
        </p>
        {unsent > 0 && <UnsentNote />}
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={onRestart} autoFocus>
            <RotateCcw aria-hidden />
            Nouvelle ascension
          </Button>
          <Button asChild variant="outline">
            <Link href={exitHref}>Autres défis</Link>
          </Button>
        </div>
      </div>
    );

  const stage = stageName(state.level, total);
  const newStage = state.level > 0 && stage !== stageName(state.level - 1, total);

  return (
    <div className="space-y-4">
      <div className="relative">
        <AscensionLandscape
          total={total}
          level={state.level}
          state={lost ? 'halted' : 'climbing'}
        />
        <p
          key={stage}
          className={cn(
            'absolute top-2.5 right-3 rounded-full bg-card/85 px-2.5 py-0.5 text-xs font-medium text-tesla-bordeaux shadow-sm backdrop-blur-sm',
            newStage && 'animate-achieve',
          )}
          aria-live="polite"
        >
          {stage}
        </p>
      </div>

      <div key={question.id} className="animate-enter space-y-4">
        <p className="text-lg leading-snug font-medium text-balance">{question.prompt}</p>
        <div className="grid gap-2.5" role="group" aria-label="Propositions">
          {question.options.map((option, index) =>
            state.removed.includes(index) ? null : (
              <ChoiceButton
                key={index}
                onClick={() => answer(index)}
                disabled={state.chosen !== null}
                state={
                  state.chosen === null
                    ? 'idle'
                    : index === question.answer
                      ? 'correct'
                      : index === state.chosen
                        ? 'wrong'
                        : 'muted'
                }
              >
                {option}
              </ChoiceButton>
            ),
          )}
        </div>
        {state.hintShown && (
          <p className="animate-enter rounded-xl bg-tesla-sable/40 px-4 py-3 text-sm">
            {question.hint ?? `Cette notion se trouve dans « ${question.lessonTitle} ».`}
          </p>
        )}
        {state.chosen !== null && (
          <AnswerFeedback correct={!lost} explanation={question.explanation} />
        )}
      </div>

      {state.chosen === null ? (
        <div className="flex justify-center gap-3" role="group" aria-label="Jokers">
          {JOKERS.map(({ key, label, icon: Icon }) => {
            const spent = state.used.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => applyJoker(key)}
                disabled={!canUse(key)}
                aria-label={spent ? `${label} (utilisé)` : label}
                className={cn(
                  'flex w-20 flex-col items-center gap-1 rounded-2xl border-2 px-2 py-2 text-[0.7rem] font-medium transition-[transform,opacity,border-color] duration-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  spent
                    ? 'border-dashed border-border text-muted-foreground opacity-50'
                    : 'border-tesla-or/70 bg-tesla-sable/40 text-tesla-bordeaux enabled:hover:-translate-y-0.5 enabled:active:scale-95 disabled:opacity-40',
                )}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </button>
            );
          })}
        </div>
      ) : lost ? (
        <div className="animate-enter space-y-3 rounded-2xl border bg-card p-4">
          <p className="font-medium text-tesla-bordeaux">
            Halte au palier {state.level} sur {total}
          </p>
          {records && (
            <p className="text-sm text-muted-foreground">La notion est ajoutée à vos révisions.</p>
          )}
          {unsent > 0 && <UnsentNote />}
          <div className="flex flex-wrap gap-2">
            <Button onClick={onRestart} autoFocus>
              <RotateCcw aria-hidden />
              Repartir
            </Button>
            <Button asChild variant="outline">
              <Link href={`/modules/${question.moduleSlug}/lecons/${question.lessonId}`}>
                <BookOpen aria-hidden />
                Revoir la leçon
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={climb} autoFocus className="w-full sm:w-auto">
          {state.level + 1 >= total ? 'Atteindre le sommet' : 'Monter'}
          <ArrowRight aria-hidden />
        </Button>
      )}
    </div>
  );
}

function UnsentNote() {
  return (
    <p className="text-xs text-muted-foreground">
      Certaines réponses seront envoyées au retour du réseau.
    </p>
  );
}

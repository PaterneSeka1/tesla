'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  type EarnedBadge,
  gradePractice,
  type PracticeActivity,
  type PracticeAnswers,
  type PracticeKind,
} from '@tesla/shared';
import { ArrowRight, Award, CloudOff, RefreshCw, RotateCcw } from 'lucide-react';
import { type ComponentType, useEffect, useRef, useState } from 'react';
import { useSessionUser } from '@/components/auth/session-gate';
import { Button } from '@/components/ui/button';
import { feedback } from '@/lib/feedback';
import { userCan } from '@/lib/navigation';
import {
  flushPendingResults,
  RETRYABLE,
  SAVE_MESSAGES,
  type SaveState,
  submitPracticeResult,
} from '@/lib/practice-results';
import { ClozePlayer } from './cloze-player';
import { FlashcardsPlayer } from './flashcards-player';
import { type PlayerProps } from './kit';
import { MatchPlayer } from './match-player';
import { OrderPlayer } from './order-player';
import { QuizPlayer } from './quiz-player';
import { ScenarioPlayer } from './scenario-player';

/**
 * Registre des lecteurs d'activité (D194) : un composant par type, aucun aiguillage géant. Ajouter
 * un type = un schéma dans `@tesla/shared/practice`, un lecteur ici.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PLAYERS: Record<PracticeKind, ComponentType<PlayerProps<any>>> = {
  quiz: QuizPlayer,
  truefalse: QuizPlayer,
  match: MatchPlayer,
  order: OrderPlayer,
  flashcards: FlashcardsPlayer,
  cloze: ClozePlayer,
  scenario: ScenarioPlayer,
};

export interface RunnableActivity {
  moduleSlug: string;
  key: string;
  /** Empreinte du contenu joué (banque) : le serveur ne recorrige jamais un contenu modifié. */
  fingerprint?: string;
  activity: PracticeActivity;
  reverent?: boolean;
}

/** Éléments à revoir (questions manquées), pour l'écran de fin. */
function toReview(activity: PracticeActivity, graded: boolean[]): string[] {
  switch (activity.kind) {
    case 'quiz':
      return activity.items.filter((_, index) => !graded[index]).map((item) => item.prompt);
    case 'truefalse':
      return activity.items.filter((_, index) => !graded[index]).map((item) => item.statement);
    case 'flashcards':
      return activity.cards.filter((_, index) => !graded[index]).map((card) => card.front);
    default:
      return [];
  }
}

/**
 * Déroulé d'une activité : jeu, puis écran de fin sobre (ce qui est fait, ce qui est à revoir, la
 * récompense réellement obtenue, la suite). Le résultat est envoyé au serveur, qui recorrige et
 * attribue seul les récompenses ; sans réseau, il attend sur l'appareil. L'encadrement joue en
 * aperçu : rien n'est enregistré.
 */
export function ActivityRunner({
  item,
  onContinue,
  continueLabel = 'Continuer',
  compact = false,
}: {
  item: RunnableActivity;
  onContinue?: () => void;
  continueLabel?: string;
  /** Intégrée dans une leçon : écran de fin réduit. */
  compact?: boolean;
}) {
  const user = useSessionUser();
  const queryClient = useQueryClient();
  const [round, setRound] = useState(0);
  const [answers, setAnswers] = useState<PracticeAnswers | null>(null);
  const [assisted, setAssisted] = useState(false);
  const [saved, setSaved] = useState<SaveState | 'idle'>('idle');
  const [reward, setReward] = useState<{ xp: number; badges: EarnedBadge[] } | null>(null);
  // Une tentative par manche : son identifiant accompagne chaque nouvel essai d'envoi.
  const attempt = useRef<string>(crypto.randomUUID());
  const Player = PLAYERS[item.activity.kind];
  // Aperçu (rédaction, sans module publié) : jamais d'enregistrement.
  const records = item.moduleSlug !== '' && userCan(user, 'practice.own');

  // Résultats gardés dans l'onglet : renvoyés à l'ouverture et au retour du réseau.
  useEffect(() => {
    if (!records) return;
    const flush = () => void flushPendingResults(user.id);
    flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [records, user.id]);

  const send = async (result: PracticeAnswers, help: boolean) => {
    const attemptId = attempt.current;
    setSaved('saving');
    const outcome = await submitPracticeResult(user.id, {
      attemptId,
      moduleSlug: item.moduleSlug,
      activityKey: item.key,
      fingerprint: item.fingerprint,
      mode: 'activity',
      assisted: help,
      answers: result,
    });
    // Réponse d'une manche abandonnée (« Recommencer » entre-temps) : ignorée.
    if (attempt.current !== attemptId) return;
    setSaved(outcome.state);
    const response = outcome.result;
    if (response && (response.xpAwarded > 0 || response.newBadges.length > 0)) {
      setReward({ xp: response.xpAwarded, badges: response.newBadges });
      if (response.newBadges.length > 0) feedback('reward');
    }
    if (outcome.state === 'saved')
      void queryClient.invalidateQueries({ queryKey: ['me', 'journal'] });
  };

  const finish = (result: PracticeAnswers, meta?: { assisted?: boolean }) => {
    setAnswers(result);
    setAssisted(!!meta?.assisted);
    if (!records) return setSaved('preview');
    void send(result, !!meta?.assisted);
  };

  if (!answers)
    return (
      <Player
        key={round}
        activity={item.activity}
        reverent={item.reverent}
        onDone={(result, meta) => finish(result, meta)}
      />
    );

  const graded = gradePractice(item.activity, answers);
  const correct = graded.filter(Boolean).length;
  const review = toReview(item.activity, graded);
  const scored = graded.length > 0 && !item.reverent;
  const perfect = scored && correct === graded.length;

  return (
    <div className="animate-enter space-y-4" role="status">
      <div className="space-y-1">
        <p className="text-lg font-semibold text-tesla-bordeaux">
          {!scored ? 'Activité terminée' : perfect ? 'Sans faute !' : 'Activité terminée'}
        </p>
        {scored && (
          <p className="text-sm text-muted-foreground">
            {correct} sur {graded.length}
          </p>
        )}
      </div>

      {!compact && review.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium">À revoir</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {review.slice(0, 4).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {reward && (
        <div className="animate-achieve flex items-center gap-3 rounded-xl border border-tesla-or/60 bg-tesla-sable/40 px-4 py-3">
          <Award className="size-6 shrink-0 text-tesla-rouge" aria-hidden />
          <p className="text-sm">
            {reward.badges.length > 0 ? (
              <>
                <span className="font-semibold">
                  Badge obtenu : {reward.badges.map((b) => b.title).join(', ')}
                </span>
                {reward.xp > 0 && <span className="text-muted-foreground"> · +{reward.xp} XP</span>}
              </>
            ) : (
              <span className="font-medium">+{reward.xp} XP</span>
            )}
          </p>
        </div>
      )}

      {saved !== 'idle' && SAVE_MESSAGES[saved] && (
        <p
          className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
          role={saved === 'failed' || saved === 'retry' ? 'alert' : undefined}
        >
          <CloudOff className="size-3.5" aria-hidden />
          {SAVE_MESSAGES[saved]}
          {RETRYABLE.includes(saved) && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => void send(answers, assisted)}
            >
              <RefreshCw className="size-3" aria-hidden />
              Réessayer
            </Button>
          )}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {onContinue && (
          <Button onClick={onContinue} autoFocus>
            {continueLabel}
            <ArrowRight aria-hidden />
          </Button>
        )}
        <Button
          variant={onContinue ? 'outline' : 'default'}
          onClick={() => {
            attempt.current = crypto.randomUUID();
            setAnswers(null);
            setAssisted(false);
            setReward(null);
            setSaved('idle');
            setRound(round + 1);
          }}
        >
          <RotateCcw aria-hidden />
          Recommencer
        </Button>
      </div>
    </div>
  );
}

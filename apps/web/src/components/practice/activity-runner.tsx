'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  type EarnedBadge,
  gradePractice,
  type PracticeActivity,
  type PracticeAnswers,
  type PracticeKind,
} from '@tesla/shared';
import { ArrowRight, Award, CloudOff, RotateCcw } from 'lucide-react';
import { type ComponentType, useState } from 'react';
import { useSessionUser } from '@/components/auth/session-gate';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/client';
import { sendPracticeResult } from '@/lib/api/practice';
import { feedback } from '@/lib/feedback';
import { userCan } from '@/lib/navigation';
import { OfflineQueuedError } from '@/lib/offline/operations';
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
  activity: PracticeActivity;
  reverent?: boolean;
}

type Saved = 'idle' | 'saving' | 'saved' | 'device' | 'offline' | 'none';

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
  const [saved, setSaved] = useState<Saved>('idle');
  const [reward, setReward] = useState<{ xp: number; badges: EarnedBadge[] } | null>(null);
  const Player = PLAYERS[item.activity.kind];
  // Aperçu (rédaction, sans module publié) : jamais d'enregistrement.
  const records = item.moduleSlug !== '' && userCan(user, 'practice.own');

  const finish = async (result: PracticeAnswers) => {
    setAnswers(result);
    if (!records) return setSaved('none');
    setSaved('saving');
    try {
      const response = await sendPracticeResult({
        moduleSlug: item.moduleSlug,
        activityKey: item.key,
        answers: result,
      });
      setSaved('saved');
      if (response.xpAwarded > 0 || response.newBadges.length > 0) {
        setReward({ xp: response.xpAwarded, badges: response.newBadges });
        if (response.newBadges.length > 0) feedback('reward');
      }
      void queryClient.invalidateQueries({ queryKey: ['me', 'journal'] });
    } catch (error) {
      setSaved(
        error instanceof OfflineQueuedError
          ? 'device'
          : error instanceof ApiError && error.status === 0
            ? 'offline'
            : 'none',
      );
    }
  };

  if (!answers)
    return (
      <Player
        key={round}
        activity={item.activity}
        reverent={item.reverent}
        onDone={(result) => void finish(result)}
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

      {saved === 'offline' && (
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <CloudOff className="size-3.5" aria-hidden />
          Hors connexion : ce résultat n’est pas enregistré. Activez cet appareil pour garder vos
          entraînements sans réseau.
        </p>
      )}
      {saved === 'device' && (
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <CloudOff className="size-3.5" aria-hidden />
          Enregistré sur cet appareil, envoyé à la prochaine connexion.
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
            setAnswers(null);
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

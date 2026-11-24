'use client';

import { HelpCircle, Puzzle, X } from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import {
  ascensionQuestions,
  compatible,
  entryId,
  flattenBank,
  gameMode,
  pickSession,
} from '@/lib/games';
import { AscensionGame } from './ascension-game';
import { MemoryGame } from './memory-game';
import { SequenceGame } from './sequence-game';
import { todaySeed, usePracticeData } from './use-practice-data';

const RULES_SEEN = 'tesla.games.rules';

function rulesSeen(key: string): boolean {
  try {
    return (JSON.parse(window.localStorage.getItem(RULES_SEEN) ?? '[]') as string[]).includes(key);
  } catch {
    return true;
  }
}

function markRulesSeen(key: string) {
  try {
    const seen = new Set(JSON.parse(window.localStorage.getItem(RULES_SEEN) ?? '[]') as string[]);
    seen.add(key);
    window.localStorage.setItem(RULES_SEEN, JSON.stringify([...seen]));
  } catch {
    // Stockage indisponible : les règles se réafficheront.
  }
}

/**
 * Partie en mode concentration : bouton de retour, titre, jeu. Les règles s'affichent à la
 * première partie d'un mode, puis sur demande. Aucune configuration avant de jouer.
 */
export function GamePlay() {
  const { mode: key } = useParams<{ mode: string }>();
  const moduleSlug = useSearchParams().get('module');
  const mode = gameMode(key);
  const { bank, journal } = usePracticeData();
  const [showRules, setShowRules] = useState(() => !!mode?.rules && !rulesSeen(mode.key));
  const [seed] = useState(todaySeed);
  const back = moduleSlug ? `/defis?module=${encodeURIComponent(moduleSlug)}` : '/defis';

  const entries = useMemo(
    () => (bank.data ? flattenBank(bank.data, moduleSlug) : []),
    [bank.data, moduleSlug],
  );
  const session = useMemo(() => {
    if (!mode || !bank.data) return [];
    return pickSession(mode, entries, {
      due: journal?.data?.dueReviews ?? [],
      practiced: new Set(journal?.data?.practiced ?? []),
      seed,
    });
    // La partie est fixée à l'ouverture : une nouvelle échéance ne la change pas en cours de jeu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, bank.data, entries, seed, journal?.isPending]);

  const header = (
    <header className="flex items-center gap-2">
      <Button asChild variant="ghost" size="icon" className="-ml-2">
        <Link href={back} aria-label="Quitter la partie">
          <X aria-hidden />
        </Link>
      </Button>
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-tesla-bordeaux">
        {mode?.title ?? 'Défi'}
      </h1>
      {mode?.rules && !showRules && (
        <Button variant="ghost" size="icon" onClick={() => setShowRules(true)} aria-label="Règles">
          <HelpCircle aria-hidden />
        </Button>
      )}
    </header>
  );

  if (!mode)
    return (
      <>
        {header}
        <EmptyState icon={Puzzle} title="Ce défi n’existe pas" />
      </>
    );
  if (bank.isPending || (journal?.isPending ?? false)) return <TableSkeleton rows={4} />;
  if (bank.error) return <QueryError error={bank.error} onRetry={() => void bank.refetch()} />;

  if (showRules)
    return (
      <div className="space-y-5">
        {header}
        <div className="animate-enter space-y-4 rounded-2xl border bg-card p-5">
          <p className="leading-relaxed">{mode.rules}</p>
          <Button
            onClick={() => {
              markRulesSeen(mode.key);
              setShowRules(false);
            }}
            autoFocus
          >
            C’est parti
          </Button>
        </div>
      </div>
    );

  const empty = (
    <EmptyState
      icon={Puzzle}
      title={
        mode.key === 'revisions'
          ? 'Rien à revoir aujourd’hui'
          : 'Pas encore de contenu pour ce défi'
      }
      action={
        <Button asChild variant="outline">
          <Link href={back}>Autres défis</Link>
        </Button>
      }
    />
  );

  return (
    <div className="space-y-5">
      {header}
      {mode.engine === 'ascension' ? (
        <AscensionGame
          questions={ascensionQuestions(compatible(mode, entries), seed, mode.size + 1)}
          exitHref={back}
        />
      ) : mode.engine === 'memory' ? (
        session.length === 0 ? (
          empty
        ) : (
          <MemoryGame entry={session[0]!} size={mode.size} exitHref={back} />
        )
      ) : session.length === 0 ? (
        empty
      ) : (
        <SequenceGame
          key={session.map(entryId).join('|')}
          storageKey={`${mode.key}:${moduleSlug ?? '*'}:${seed}`}
          entries={session}
          exitHref={back}
        />
      )}
    </div>
  );
}

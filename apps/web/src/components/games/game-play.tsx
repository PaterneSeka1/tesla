'use client';

import { type DueReview } from '@tesla/shared';
import { HelpCircle, Puzzle, X } from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useSessionUser } from '@/components/auth/session-gate';
import { EmptyState } from '@/components/empty-state';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { recentPlays, rememberPlays, useGameSession } from '@/lib/game-session';
import {
  allAscensionQuestions,
  ascensionQuestions,
  type BankEntry,
  compatible,
  entryId,
  flattenBank,
  gameMode,
  type GameMode,
  isPlayable,
  pickSession,
  type SelectionContext,
} from '@/lib/games';
import { userCan } from '@/lib/navigation';
import { submitPracticeResult } from '@/lib/practice-results';
import {
  type AscensionData,
  AscensionGame,
  ascensionStart,
  ascensionStillValid,
} from './ascension-game';
import { type MemoryData, MemoryGame, memoryStart, memoryStillValid } from './memory-game';
import { type SequenceData, SequenceGame, sequenceStillValid } from './sequence-game';
import { usePracticeData } from './use-practice-data';

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

interface HostProps {
  mode: GameMode;
  userId: string | null;
  sessionKey: string;
  entries: BankEntry[];
  context: Omit<SelectionContext, 'seed'>;
  exitHref: string;
  empty: React.ReactNode;
}

/**
 * Partie en mode concentration : bouton de retour, titre, jeu. Les règles s'affichent à la
 * première partie d'un mode, puis sur demande. Aucune configuration avant de jouer. La partie est
 * enregistrée pour ce compte seul et reprend après fermeture, changement de jour ou coupure.
 */
export function GamePlay() {
  const { mode: key } = useParams<{ mode: string }>();
  const moduleSlug = useSearchParams().get('module');
  const mode = gameMode(key);
  const user = useSessionUser();
  const records = userCan(user, 'practice.own');
  const { bank, journal } = usePracticeData();
  const journalData = journal?.data;
  const [showRules, setShowRules] = useState(() => !!mode?.rules && !rulesSeen(mode.key));
  const [recent, setRecent] = useState<Set<string> | null>(records ? null : new Set());
  const back = moduleSlug ? `/defis?module=${encodeURIComponent(moduleSlug)}` : '/defis';

  useEffect(() => {
    if (records) void recentPlays(user.id).then(setRecent);
  }, [records, user.id]);

  const entries = useMemo(
    () => (bank.data ? flattenBank(bank.data, moduleSlug) : []),
    [bank.data, moduleSlug],
  );

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
  if (bank.isPending || (journal?.isPending ?? false) || recent === null)
    return <TableSkeleton rows={4} />;
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

  const due: DueReview[] = journalData?.dueReviews ?? [];
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
  const host: HostProps = {
    mode,
    userId: records ? user.id : null,
    sessionKey: `${mode.key}:${moduleSlug ?? '*'}`,
    entries,
    context: {
      due,
      practiced: new Set(journalData?.practiced ?? []),
      mastered: new Set(journalData?.mastered ?? []),
      recent,
    },
    exitHref: back,
    empty,
  };

  return (
    <div className="space-y-5">
      {header}
      {!isPlayable(mode, entries, due) ? (
        empty
      ) : mode.engine === 'ascension' ? (
        <AscensionHost {...host} />
      ) : mode.engine === 'memory' ? (
        <MemoryHost {...host} />
      ) : (
        <SequenceHost {...host} />
      )}
    </div>
  );
}

const seedOf = () => crypto.randomUUID();

function SequenceHost({ mode, userId, sessionKey, entries, context, exitHref, empty }: HostProps) {
  const create = (): SequenceData => {
    const picked = pickSession(mode, entries, { ...context, seed: seedOf() });
    if (userId) void rememberPlays(userId, picked.map(entryId));
    return {
      picked: picked.map((entry) => ({ id: entryId(entry), fingerprint: entry.fingerprint })),
      index: 0,
      done: false,
    };
  };
  const { session, update, restart, finish } = useGameSession(userId, sessionKey, create, (data) =>
    sequenceStillValid(data, entries),
  );
  if (!session) return <TableSkeleton rows={3} />;
  if (session.data.picked.length === 0) return empty;
  return (
    <SequenceGame
      key={session.id}
      session={session}
      entries={entries}
      exitHref={exitHref}
      onUpdate={update}
      onRestart={() => restart()}
      onFinish={finish}
    />
  );
}

function AscensionHost({ mode, userId, sessionKey, entries, context, exitHref }: HostProps) {
  const pool = useMemo(() => allAscensionQuestions(compatible(mode, entries)), [mode, entries]);
  const create = (): AscensionData => {
    const picked = ascensionQuestions(
      compatible(mode, entries),
      { ...context, seed: seedOf() },
      mode.size + 1,
    );
    if (userId)
      void rememberPlays(userId, [
        ...new Set(picked.map((q) => `${q.moduleSlug}:${q.activityKey}`)),
      ]);
    return ascensionStart(picked);
  };
  const { session, update, restart, finish } = useGameSession(userId, sessionKey, create, (data) =>
    ascensionStillValid(data, pool),
  );
  if (!session) return <TableSkeleton rows={3} />;
  return (
    <AscensionGame
      key={session.id}
      session={session}
      pool={pool}
      size={mode.size}
      exitHref={exitHref}
      records={!!userId}
      onUpdate={update}
      onRestart={() => restart()}
      onFinish={finish}
      onAnswer={async (question, answer, assisted) =>
        userId
          ? (
              await submitPracticeResult(userId, {
                attemptId: crypto.randomUUID(),
                moduleSlug: question.moduleSlug,
                activityKey: question.activityKey,
                fingerprint: question.fingerprint,
                mode: 'ascension',
                item: question.item,
                assisted,
                answers: [answer],
              })
            ).state
          : 'preview'
      }
    />
  );
}

function MemoryHost({ mode, userId, sessionKey, entries, context, exitHref, empty }: HostProps) {
  const create = (): MemoryData | null => {
    const entry = pickSession(mode, entries, { ...context, seed: seedOf() })[0];
    if (!entry) return null;
    if (userId) void rememberPlays(userId, [entryId(entry)]);
    return memoryStart(entry);
  };
  const { session, update, restart, finish } = useGameSession<MemoryData | null>(
    userId,
    sessionKey,
    create,
    (data) => !!data && memoryStillValid(data, entries),
  );
  if (!session) return <TableSkeleton rows={3} />;
  const data = session.data;
  const entry = data && entries.find((item) => entryId(item) === data.entry.id);
  if (!data || !entry) return empty;
  return (
    <MemoryGame
      key={session.id}
      session={{ ...session, data }}
      entry={entry}
      size={mode.size}
      exitHref={exitHref}
      onUpdate={update}
      onRestart={() => restart()}
      onComplete={(done) => {
        finish();
        if (userId)
          void submitPracticeResult(userId, {
            attemptId: done.attemptId,
            moduleSlug: entry.moduleSlug,
            activityKey: entry.key,
            fingerprint: entry.fingerprint,
            mode: 'memory',
            answers: [],
          });
      }}
    />
  );
}

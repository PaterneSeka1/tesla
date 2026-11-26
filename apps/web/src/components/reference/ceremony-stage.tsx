'use client';

import { type CeremonyItem, roleMatches } from '@tesla/shared';
import { ChevronLeft, ChevronRight, Minus, Plus, SkipForward, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useWakeLock } from '@/lib/wake-lock';
import { CeremonyItemView } from './ceremony-view';

const SCALES = [1, 1.2, 1.45, 1.75, 2.1] as const;

function readNumber(key: string, fallback: number): number {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && localStorage.getItem(key) !== null ? value : fallback;
  } catch {
    return fallback;
  }
}

function writeNumber(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Stockage indisponible (navigation privée) : la position n'est simplement pas reprise.
  }
}

/**
 * Mode cérémonie (D220) : une étape à la fois en grands caractères, l'étape précédente rappelée
 * au-dessus pour le contexte, navigation précédente / suivante (boutons, flèches du clavier),
 * accès direct à la prochaine réplique du rôle choisi, reprise de la dernière position sur cet
 * appareil, écran maintenu allumé si le navigateur le permet et si la personne le souhaite.
 * Sobre et solennel : ni navigation générale, ni récompense, ni animation décorative.
 */
export function CeremonyStage({
  title,
  storageKey,
  items,
  role,
  onClose,
}: {
  title: string;
  /** Identité de la cérémonie pour la reprise (leçon publiée). */
  storageKey: string;
  items: readonly CeremonyItem[];
  role: string | null;
  onClose: () => void;
}) {
  // Les titres de rubrique accompagnent l'étape qui suit, ils ne sont pas une étape.
  const steps = useMemo(() => {
    const result: { item: CeremonyItem; section: string | null }[] = [];
    let section: string | null = null;
    for (const item of items) {
      if (item.kind === 'section') section = item.title;
      else if (item.kind !== 'reference') result.push({ item, section });
    }
    return result;
  }, [items]);
  const positionKey = `referentiel:ceremonie:${storageKey}`;
  const [index, setIndex] = useState(() =>
    Math.min(readNumber(positionKey, 0), Math.max(0, steps.length - 1)),
  );
  const [scale, setScale] = useState(() =>
    Math.min(readNumber('referentiel:ceremonie:taille', 1), SCALES.length - 1),
  );
  const [awake, setAwake] = useState(true);
  const wake = useWakeLock(awake);

  const go = useCallback(
    (next: number) => {
      const bounded = Math.max(0, Math.min(next, steps.length - 1));
      setIndex(bounded);
      writeNumber(positionKey, bounded);
    },
    [positionKey, steps.length],
  );

  const isMine = (step: (typeof steps)[number] | undefined) =>
    !!role && step?.item.kind === 'line' && roleMatches(role, step.item.role);
  const nextMine = role
    ? steps.findIndex((step, position) => position > index && isMine(step))
    : -1;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault();
        go(index + 1);
      } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        go(index - 1);
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [go, index, onClose]);

  const current = steps[index];
  const previous = steps[index - 1];
  const next = steps[index + 1];
  const size = SCALES[scale]!;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Mode cérémonie : ${title}`}
      className="fixed inset-0 z-[70] flex flex-col bg-[#fbf6ee] text-neutral-900"
    >
      <header className="flex items-center gap-1 border-b border-tesla-or/40 px-3 pt-[max(env(safe-area-inset-top),0.5rem)] pb-2">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-tesla-bordeaux">{title}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={scale === 0}
          onClick={() => {
            setScale(scale - 1);
            writeNumber('referentiel:ceremonie:taille', scale - 1);
          }}
          aria-label="Réduire le texte"
        >
          <Minus aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={scale === SCALES.length - 1}
          onClick={() => {
            setScale(scale + 1);
            writeNumber('referentiel:ceremonie:taille', scale + 1);
          }}
          aria-label="Agrandir le texte"
        >
          <Plus aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Quitter le mode cérémonie"
        >
          <X aria-hidden />
        </Button>
      </header>
      <main
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
        style={{ fontSize: `${size * 1.15}rem` }}
        aria-live="polite"
      >
        <div className="mx-auto max-w-3xl space-y-5">
          {previous && (
            <div className="text-[0.7em] opacity-60" aria-hidden>
              <CeremonyItemView item={previous.item} large />
            </div>
          )}
          {current ? (
            <div className={cn('space-y-2', isMine(current) && 'rounded-xl ring-2 ring-tesla-or')}>
              {current.section && (
                <p className="text-[0.6em] font-semibold tracking-wide text-tesla-bordeaux uppercase">
                  {current.section}
                </p>
              )}
              <CeremonyItemView
                item={current.item}
                highlight={isMine(current) ? 'mine' : null}
                large
              />
            </div>
          ) : (
            <p className="text-muted-foreground">
              Cette cérémonie ne contient pas encore de déroulé.
            </p>
          )}
          {next && (
            <div className="text-[0.7em] opacity-45" aria-hidden>
              <CeremonyItemView item={next.item} large />
            </div>
          )}
        </div>
      </main>
      <footer className="space-y-2 border-t border-tesla-or/40 bg-white/70 px-3 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {steps.length ? index + 1 : 0} / {steps.length}
          </span>
          {wake.supported && (
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={awake}
                onChange={(event) => setAwake(event.target.checked)}
                className="accent-tesla-rouge"
              />
              Écran toujours allumé
            </label>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-14 flex-1 text-base"
            disabled={index === 0}
            onClick={() => go(index - 1)}
          >
            <ChevronLeft aria-hidden />
            Précédent
          </Button>
          {role && (
            <Button
              type="button"
              variant="secondary"
              className="h-14"
              disabled={nextMine === -1}
              onClick={() => go(nextMine)}
              aria-label="Aller à ma prochaine réplique"
            >
              <SkipForward aria-hidden />
              <span className="hidden sm:inline">Ma réplique</span>
            </Button>
          )}
          <Button
            type="button"
            className="h-14 flex-1 text-base"
            disabled={index >= steps.length - 1}
            onClick={() => go(index + 1)}
          >
            Suivant
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </footer>
    </div>,
    document.body,
  );
}

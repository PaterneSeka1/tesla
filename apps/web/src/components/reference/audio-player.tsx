'use client';

import {
  activeSegmentIndex,
  formatClock,
  isAudioSynchronized,
  type LessonAudioAttrs,
  LYRIC_PART_LABELS,
  type LyricSegment,
} from '@tesla/shared';
import {
  Check,
  Download,
  Loader2,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { resolveImageSrc } from '@/lib/api/assets';
import { prefersReducedMotion } from '@/lib/preferences';
import {
  downloadLocalAudio,
  localAudioSize,
  readLocalAudio,
  removeLocalAudio,
} from '@/lib/reference-media';
import { cn } from '@/lib/utils';
import { useWakeLock } from '@/lib/wake-lock';

const RATES = [0.75, 1, 1.25] as const;
/** Après un défilement manuel, le suivi automatique reprend seul au bout de ce délai. */
const FOLLOW_RESUME_MS = 8_000;

type LyricsMode = 'synced' | 'full';

/**
 * Lecteur d'un enregistrement et de ses paroles (D221). La phrase en cours est calculée à partir de
 * la **position réelle** de l'élément audio (`currentTime`, lue à chaque image pendant la lecture et
 * à chaque déplacement) : pause, reprise, déplacement et changement de vitesse restent synchronisés.
 * Paroles synchronisées seulement si les repères valent pour cet enregistrement exact ; sinon
 * paroles intégrales. Aucune statistique d'écoute, aucune récompense.
 */
export function AudioPlayer({ attrs }: { attrs: LessonAudioAttrs }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [source, setSource] = useState<string | null>(null);
  const [local, setLocal] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [rate, setRate] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState(false);
  const synced = isAudioSynchronized(attrs);
  const [mode, setMode] = useState<LyricsMode>(synced ? 'synced' : 'full');
  const segments = attrs.segments;
  const active = synced ? activeSegmentIndex(segments, currentMs) : -1;
  const retried = useRef(false);

  // Copie locale d'abord (écoute hors ligne), sinon lecture contrôlée par la session.
  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    void (async () => {
      const blob = await readLocalAudio(attrs.src);
      if (cancelled) return;
      if (blob) {
        objectUrl = URL.createObjectURL(blob);
        setLocal(blob.size);
        setSource(objectUrl);
      } else {
        setLocal(null);
        setSource(resolveImageSrc(attrs.src));
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attrs.src]);

  // Position réelle lue à chaque image pendant la lecture (aucun chronomètre indépendant).
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      const audio = audioRef.current;
      if (audio) setCurrentMs(audio.currentTime * 1000);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const seekTo = useCallback((ms: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const target = Math.max(0, Math.min(ms, (audio.duration || Infinity) * 1000));
    audio.currentTime = target / 1000;
    setCurrentMs(target);
  }, []);

  const toggle = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setError('Lecture impossible sur cet appareil.');
      }
    } else audio.pause();
  }, []);

  // Commandes du système (écran verrouillé, écouteurs) lorsque le navigateur les propose.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;
    try {
      session.metadata = new MediaMetadata({
        title: attrs.title || 'Enregistrement',
        artist: attrs.credit ?? '',
        album: 'Nikola Tesla Académie',
      });
      session.setActionHandler('play', () => void audioRef.current?.play());
      session.setActionHandler('pause', () => audioRef.current?.pause());
      session.setActionHandler('seekbackward', () =>
        seekTo((audioRef.current?.currentTime ?? 0) * 1000 - 10_000),
      );
      session.setActionHandler('seekforward', () =>
        seekTo((audioRef.current?.currentTime ?? 0) * 1000 + 10_000),
      );
      session.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) seekTo(details.seekTime * 1000);
      });
    } catch {
      // Action non prise en charge par ce navigateur : commandes de la page seulement.
    }
    return () => {
      for (const action of ['play', 'pause', 'seekbackward', 'seekforward', 'seekto'] as const) {
        try {
          session.setActionHandler(action, null);
        } catch {
          // idem
        }
      }
    };
  }, [attrs.title, attrs.credit, seekTo]);

  const controls = (
    <Controls
      playing={playing}
      currentMs={currentMs}
      durationMs={durationMs}
      rate={rate}
      onToggle={() => void toggle()}
      onSeek={seekTo}
      onRate={(next) => {
        setRate(next);
        if (audioRef.current) audioRef.current.playbackRate = next;
      }}
    />
  );

  return (
    <section
      aria-label={attrs.title ? `Enregistrement : ${attrs.title}` : 'Enregistrement'}
      className="space-y-3 rounded-xl border bg-white/80 p-3 shadow-sm"
    >
      {source && (
        <audio
          ref={audioRef}
          src={source}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => {
            setPlaying(false);
            setCurrentMs((audioRef.current?.currentTime ?? 0) * 1000);
          }}
          onEnded={() => setPlaying(false)}
          onSeeked={() => setCurrentMs((audioRef.current?.currentTime ?? 0) * 1000)}
          onTimeUpdate={() => {
            if (!playing) setCurrentMs((audioRef.current?.currentTime ?? 0) * 1000);
          }}
          onLoadedMetadata={() => {
            const audio = audioRef.current!;
            setDurationMs(Number.isFinite(audio.duration) ? audio.duration * 1000 : 0);
            audio.playbackRate = rate;
            setError(null);
          }}
          onError={() => {
            // Lien de lecture expiré pendant une longue écoute : une seule reprise à la même position.
            const audio = audioRef.current;
            if (!retried.current && audio && !local && navigator.onLine) {
              retried.current = true;
              const at = audio.currentTime;
              audio.src = `${resolveImageSrc(attrs.src)}`;
              audio.currentTime = at;
              return;
            }
            setError(
              navigator.onLine
                ? 'Enregistrement indisponible.'
                : 'Hors ligne : téléchargez ce chant pour l’écouter sans connexion.',
            );
          }}
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          {attrs.title && (
            <p className="truncate font-semibold text-tesla-bordeaux">{attrs.title}</p>
          )}
          {attrs.credit && <p className="truncate text-xs text-muted-foreground">{attrs.credit}</p>}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setStage(true)}
          aria-label="Chant collectif : grand affichage"
        >
          <Maximize2 aria-hidden />
          Chant collectif
        </Button>
      </div>
      {controls}
      {error && (
        <p role="alert" className="text-sm text-tesla-rouge">
          {error}
        </p>
      )}
      {segments.length > 0 && (
        <>
          {synced && (
            <div role="group" aria-label="Affichage des paroles" className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant={mode === 'synced' ? 'default' : 'ghost'}
                aria-pressed={mode === 'synced'}
                onClick={() => setMode('synced')}
              >
                Paroles synchronisées
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === 'full' ? 'default' : 'ghost'}
                aria-pressed={mode === 'full'}
                onClick={() => setMode('full')}
              >
                Paroles intégrales
              </Button>
            </div>
          )}
          {mode === 'synced' && synced ? (
            <SyncedLyrics
              segments={segments}
              active={active}
              onSelect={(segment) => {
                if (segment.startMs !== null) seekTo(segment.startMs);
                void audioRef.current?.play().catch(() => {});
              }}
            />
          ) : (
            <FullLyrics segments={segments} />
          )}
        </>
      )}
      {attrs.download && (
        <OfflineCopy src={attrs.src} size={local} onChange={(size) => setLocal(size)} />
      )}
      {stage && (
        <CollectiveStage
          title={attrs.title ?? null}
          segments={segments}
          synced={synced}
          active={active}
          controls={controls}
          onSelect={(segment) => {
            if (segment.startMs !== null) seekTo(segment.startMs);
          }}
          onClose={() => setStage(false)}
        />
      )}
    </section>
  );
}

function Controls({
  playing,
  currentMs,
  durationMs,
  rate,
  onToggle,
  onSeek,
  onRate,
  large = false,
}: {
  playing: boolean;
  currentMs: number;
  durationMs: number;
  rate: number;
  onToggle: () => void;
  onSeek: (ms: number) => void;
  onRate: (rate: number) => void;
  large?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onSeek(currentMs - 10_000)}
          aria-label="Reculer de 10 secondes"
        >
          <RotateCcw aria-hidden />
        </Button>
        <Button
          type="button"
          size="icon"
          className={cn('rounded-full', large ? 'size-14' : 'size-11')}
          onClick={onToggle}
          aria-label={playing ? 'Pause' : 'Lecture'}
        >
          {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onSeek(currentMs + 10_000)}
          aria-label="Avancer de 10 secondes"
        >
          <RotateCw aria-hidden />
        </Button>
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.round(durationMs))}
          step={100}
          value={Math.min(Math.round(currentMs), Math.max(1, Math.round(durationMs)))}
          onChange={(event) => onSeek(Number(event.target.value))}
          aria-label="Position dans l’enregistrement"
          aria-valuetext={`${formatClock(currentMs)} sur ${formatClock(durationMs)}`}
          className="h-2 min-w-0 flex-1 cursor-pointer accent-tesla-rouge"
        />
        <label className="sr-only" htmlFor="audio-rate">
          Vitesse
        </label>
        <select
          id="audio-rate"
          value={rate}
          onChange={(event) => onRate(Number(event.target.value))}
          className="h-8 rounded-md border bg-transparent px-1 text-xs"
        >
          {RATES.map((value) => (
            <option key={value} value={value}>
              {String(value).replace('.', ',')}×
            </option>
          ))}
        </select>
      </div>
      <p className="text-right text-xs text-muted-foreground tabular-nums" aria-hidden>
        {formatClock(currentMs)} / {formatClock(durationMs)}
      </p>
    </div>
  );
}

/**
 * Paroles qui suivent l'enregistrement : la phrase en cours est mise en évidence et centrée, les
 * phrases voisines restent visibles. Un défilement manuel suspend le suivi (bouton pour revenir).
 */
function SyncedLyrics({
  segments,
  active,
  onSelect,
  large = false,
}: {
  segments: readonly LyricSegment[];
  active: number;
  onSelect: (segment: LyricSegment) => void;
  large?: boolean;
}) {
  const container = useRef<HTMLOListElement>(null);
  const [following, setFollowing] = useState(true);
  const resumeTimer = useRef<number | null>(null);

  const suspend = () => {
    setFollowing(false);
    if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => setFollowing(true), FOLLOW_RESUME_MS);
  };
  useEffect(
    () => () => {
      if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    },
    [],
  );

  useEffect(() => {
    const list = container.current;
    if (!following || !list || active < 0) return;
    const line = list.children[active] as HTMLElement | undefined;
    if (!line) return;
    list.scrollTo({
      top: line.offsetTop - list.clientHeight / 2 + line.clientHeight / 2,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  }, [active, following]);

  return (
    <div className="relative">
      <ol
        ref={container}
        onWheel={suspend}
        onTouchMove={suspend}
        className={cn(
          'relative space-y-1 overflow-y-auto overscroll-contain scroll-smooth rounded-lg px-1 py-[40%]',
          large ? 'h-[60vh]' : 'h-64 bg-tesla-sable/15',
        )}
        aria-label="Paroles synchronisées"
      >
        {segments.map((segment, index) => (
          <li key={segment.id}>
            <button
              type="button"
              onClick={() => onSelect(segment)}
              aria-current={index === active ? 'true' : undefined}
              className={cn(
                'w-full rounded-md px-2 py-1 text-left transition-[color,opacity,transform] duration-300 motion-reduce:transition-none',
                large ? 'text-3xl leading-snug sm:text-4xl' : 'text-lg',
                index === active
                  ? large
                    ? 'font-semibold text-white'
                    : 'font-semibold text-tesla-bordeaux'
                  : large
                    ? 'text-white/45'
                    : 'text-foreground/55',
                segment.part === 'REFRAIN' && 'italic',
              )}
            >
              {segment.text}
            </button>
          </li>
        ))}
      </ol>
      {!following && active >= 0 && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="absolute right-2 bottom-2 shadow"
          onClick={() => setFollowing(true)}
        >
          Revenir à la phrase en cours
        </Button>
      )}
    </div>
  );
}

/** Paroles intégrales, groupées par partie (couplet, refrain), sans lien avec la lecture. */
function FullLyrics({
  segments,
  large = false,
}: {
  segments: readonly LyricSegment[];
  large?: boolean;
}) {
  const groups = useMemo(() => {
    const result: { part: LyricSegment['part']; lines: LyricSegment[] }[] = [];
    for (const segment of segments) {
      const last = result[result.length - 1];
      if (last && (last.part ?? null) === (segment.part ?? null)) last.lines.push(segment);
      else result.push({ part: segment.part ?? null, lines: [segment] });
    }
    return result;
  }, [segments]);
  return (
    <div className={cn('space-y-4', large ? 'text-3xl leading-snug text-white' : 'text-lg')}>
      {groups.map((group, index) => (
        <div key={index} className={cn(group.part === 'REFRAIN' && 'italic')}>
          {group.part && (
            <p
              className={cn(
                'text-xs font-semibold tracking-wide uppercase not-italic',
                large ? 'text-tesla-or' : 'text-muted-foreground',
              )}
            >
              {LYRIC_PART_LABELS[group.part]}
            </p>
          )}
          {group.lines.map((line) => (
            <p key={line.id}>{line.text}</p>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Mode chant collectif (réunions, camps, veillées) : grands caractères, contraste élevé, phrase en
 * cours et contrôles essentiels. L'écran reste allumé si le navigateur le permet.
 */
function CollectiveStage({
  title,
  segments,
  synced,
  active,
  controls,
  onSelect,
  onClose,
}: {
  title: string | null;
  segments: readonly LyricSegment[];
  synced: boolean;
  active: number;
  controls: React.ReactNode;
  onSelect: (segment: LyricSegment) => void;
  onClose: () => void;
}) {
  useWakeLock(true);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title ? `Chant collectif : ${title}` : 'Chant collectif'}
      className="fixed inset-0 z-[70] flex flex-col bg-neutral-950 text-white"
    >
      <div className="flex items-center gap-2 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2">
        <p className="min-w-0 flex-1 truncate text-sm text-white/70">{title}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10 hover:text-white"
          onClick={onClose}
          aria-label="Quitter le chant collectif"
        >
          <X aria-hidden />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        {synced ? (
          <SyncedLyrics segments={segments} active={active} onSelect={onSelect} large />
        ) : (
          <div className="py-6">
            <FullLyrics segments={segments} large />
          </div>
        )}
      </div>
      <div className="border-t border-white/10 bg-neutral-900 px-4 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] text-white [&_button]:text-white [&_select]:bg-neutral-900">
        {controls}
      </div>
    </div>,
    document.body,
  );
}

/** Copie hors ligne de l'enregistrement : télécharger, mettre à jour, supprimer. */
function OfflineCopy({
  src,
  size,
  onChange,
}: {
  src: string;
  size: number | null;
  onChange: (size: number | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    void localAudioSize(src).then(onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- vérification initiale seulement
  }, [src]);
  const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {size !== null ? (
        <>
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Check className="size-4 text-tesla-rouge" aria-hidden />
            Disponible hors ligne ({megabytes(size)})
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await removeLocalAudio(src).catch(() => {});
              onChange(null);
              setBusy(false);
            }}
          >
            <Trash2 aria-hidden />
            Supprimer la copie
          </Button>
        </>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMessage(null);
            try {
              onChange(await downloadLocalAudio(src));
            } catch (error) {
              setMessage(error instanceof Error ? error.message : 'Téléchargement impossible.');
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
          Télécharger pour écouter hors ligne
        </Button>
      )}
      {message && (
        <span role="alert" className="text-tesla-rouge">
          {message}
        </span>
      )}
    </div>
  );
}

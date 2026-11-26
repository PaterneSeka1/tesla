'use client';

import {
  formatPreciseClock,
  type LessonAudioAttrs,
  LYRIC_PART_LABELS,
  LYRIC_PARTS,
  type LyricPart,
  type LyricSegment,
  lessonFileImageSrc,
  newSegmentId,
  parsePreciseClock,
  parseSyncedLyrics,
  splitLyrics,
  timelineIssues,
} from '@tesla/shared';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Crosshair,
  Eraser,
  Headphones,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { resolveImageSrc } from '@/lib/api/assets';
import { cn } from '@/lib/utils';
import { AudioPlayer } from './audio-player';
import { AUDIO_ACCEPT, uploadAudioFile } from './audio-upload';

type Step = 'infos' | 'paroles' | 'synchro' | 'apercu';

const STEPS: { value: Step; label: string }[] = [
  { value: 'infos', label: '1. Enregistrement' },
  { value: 'paroles', label: '2. Paroles' },
  { value: 'synchro', label: '3. Synchroniser' },
  { value: 'apercu', label: '4. Aperçu' },
];

const SYNC_RATES = [0.5, 0.75, 1] as const;

/**
 * Atelier de l'encadrement (D221) : aucun JSON, aucun format de sous-titres à connaître. On colle
 * les paroles, on écoute, et on marque le début de chaque phrase au moment où elle est chantée ;
 * les repères s'ajustent ensuite à la main. Les repères ne valent que pour l'enregistrement actuel
 * (« Valider la synchronisation ») et une chronologie incohérente n'est jamais validée.
 */
export function SyncWorkshop({
  initial,
  moduleId,
  open,
  onOpenChange,
  onSave,
}: {
  initial: LessonAudioAttrs;
  moduleId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (attrs: LessonAudioAttrs) => void;
}) {
  const [draft, setDraft] = useState<LessonAudioAttrs>(initial);
  const [step, setStep] = useState<Step>('infos');
  const issues = useMemo(() => timelineIssues(draft.segments), [draft.segments]);
  const synchronized = draft.syncedSrc === draft.src;
  const update = (patch: Partial<LessonAudioAttrs>) =>
    setDraft((current) => ({ ...current, ...patch }));
  // Toute modification des repères ou des phrases demande une nouvelle validation.
  const setSegments = (segments: LyricSegment[]) =>
    setDraft((current) => ({ ...current, segments, syncedSrc: null }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Atelier de l’enregistrement</DialogTitle>
          <DialogDescription>
            {synchronized
              ? 'Paroles synchronisées avec cet enregistrement.'
              : draft.segments.some((segment) => segment.startMs !== null)
                ? 'Synchronisation à valider.'
                : 'Paroles non synchronisées : elles s’afficheront en texte intégral.'}
          </DialogDescription>
        </DialogHeader>
        <div role="tablist" aria-label="Étapes" className="flex flex-wrap gap-1">
          {STEPS.map((item) => (
            <Button
              key={item.value}
              type="button"
              role="tab"
              size="sm"
              aria-selected={step === item.value}
              variant={step === item.value ? 'default' : 'outline'}
              onClick={() => setStep(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        {step === 'infos' && <InfosStep draft={draft} moduleId={moduleId} update={update} />}
        {step === 'paroles' && <LyricsStep segments={draft.segments} setSegments={setSegments} />}
        {step === 'synchro' && (
          <SyncStep
            src={draft.src}
            segments={draft.segments}
            setSegments={setSegments}
            issues={issues}
            synchronized={synchronized}
            onValidate={() => update({ syncedSrc: draft.src })}
          />
        )}
        {step === 'apercu' && (
          <div className="space-y-2">
            {!synchronized && (
              <p className="text-sm text-muted-foreground">
                Aperçu sans défilement : validez d’abord la synchronisation (étape 3).
              </p>
            )}
            <AudioPlayer attrs={draft} />
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            type="button"
            onClick={() => {
              onSave(draft);
              onOpenChange(false);
            }}
          >
            Enregistrer dans la leçon
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InfosStep({
  draft,
  moduleId,
  update,
}: {
  draft: LessonAudioAttrs;
  moduleId?: string;
  update: (patch: Partial<LessonAudioAttrs>) => void;
}) {
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="audio-title">Titre</Label>
          <Input
            id="audio-title"
            value={draft.title ?? ''}
            maxLength={200}
            onChange={(event) => update({ title: event.target.value || null })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="audio-credit">Auteur, interprète ou source (si connus)</Label>
          <Input
            id="audio-credit"
            value={draft.credit ?? ''}
            maxLength={300}
            onChange={(event) => update({ credit: event.target.value || null })}
          />
        </div>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Droits de diffusion</legend>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="audio-rights"
            checked={draft.rights === 'INCONNUS'}
            onChange={() => update({ rights: 'INCONNUS' })}
            className="mt-1 accent-tesla-rouge"
          />
          Non vérifiés : l’enregistrement ne pourra pas être soumis.
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="audio-rights"
            checked={draft.rights === 'AUTORISES'}
            onChange={() => update({ rights: 'AUTORISES' })}
            className="mt-1 accent-tesla-rouge"
          />
          Diffusion autorisée auprès de la communauté.
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.download}
            onChange={(event) => update({ download: event.target.checked })}
            className="mt-1 accent-tesla-rouge"
          />
          Téléchargement autorisé (écoute hors ligne sur les appareils).
        </label>
      </fieldset>
      {moduleId && (
        <div className="space-y-1 text-sm">
          <Label htmlFor="audio-replace">Remplacer l’enregistrement</Label>
          <input
            id="audio-replace"
            type="file"
            accept={AUDIO_ACCEPT}
            className="block text-sm"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              setError(null);
              try {
                const stored = await uploadAudioFile(moduleId, file, setProgress);
                // Nouveau fichier : les anciens repères ne sont jamais réutilisés automatiquement.
                update({
                  src: lessonFileImageSrc(stored.id),
                  syncedSrc: null,
                  segments: draft.segments.map((segment) => ({
                    ...segment,
                    startMs: null,
                    endMs: null,
                  })),
                });
                setProgress('Enregistrement remplacé : synchronisez de nouveau les paroles.');
              } catch (err) {
                setProgress(null);
                setError(err instanceof Error ? err.message : 'Envoi impossible.');
              }
            }}
          />
          {progress && <p className="text-muted-foreground">{progress}</p>}
          {error && (
            <p role="alert" className="text-tesla-rouge">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function LyricsStep({
  segments,
  setSegments,
}: {
  segments: LyricSegment[];
  setSegments: (segments: LyricSegment[]) => void;
}) {
  const [text, setText] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const edit = (index: number, patch: Partial<LyricSegment>) =>
    setSegments(segments.map((segment, i) => (i === index ? { ...segment, ...patch } : segment)));
  const moveTo = (index: number, delta: number) => {
    const next = [...segments];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item!);
    setSegments(next);
  };
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="lyrics-paste">Coller les paroles</Label>
        <Textarea
          id="lyrics-paste"
          rows={6}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={'Une phrase par ligne.\nUne ligne « Refrain » marque les lignes suivantes.'}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={!text.trim()}
            onClick={() => {
              const parsed = splitLyrics(text);
              setSegments([...segments, ...parsed]);
              setText('');
              setMessage(`${parsed.length} phrase(s) ajoutée(s).`);
            }}
          >
            Découper en phrases
          </Button>
          <label className="text-sm">
            <span className="mr-2 text-muted-foreground">
              ou importer un fichier (LRC, WebVTT, SRT) :
            </span>
            <input
              type="file"
              accept=".lrc,.vtt,.srt,.txt,text/plain,text/vtt"
              className="text-sm"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                if (file.size > 512 * 1024) {
                  setMessage('Fichier trop volumineux.');
                  return;
                }
                const parsed = parseSyncedLyrics(await file.text());
                if (parsed.length === 0) {
                  setMessage('Aucune phrase horodatée reconnue dans ce fichier.');
                  return;
                }
                setSegments(parsed);
                setMessage(
                  `${parsed.length} phrase(s) importée(s) avec leurs repères : vérifiez-les à l’écoute, puis validez.`,
                );
              }}
            />
          </label>
        </div>
        {message && (
          <p className="text-sm text-muted-foreground" role="status">
            {message}
          </p>
        )}
      </div>
      {segments.length > 0 && (
        <ol className="space-y-2">
          {segments.map((segment, index) => (
            <li
              key={segment.id}
              className="flex flex-wrap items-center gap-1 rounded-md border p-2"
            >
              <span className="w-6 text-right text-xs text-muted-foreground tabular-nums">
                {index + 1}
              </span>
              <Input
                aria-label={`Phrase ${index + 1}`}
                value={segment.text}
                maxLength={500}
                onChange={(event) => edit(index, { text: event.target.value })}
                className="min-w-48 flex-1"
              />
              <select
                aria-label={`Partie de la phrase ${index + 1}`}
                value={segment.part ?? ''}
                onChange={(event) =>
                  edit(index, { part: (event.target.value || null) as LyricPart | null })
                }
                className="h-9 rounded-md border bg-transparent px-1 text-sm"
              >
                <option value="">—</option>
                {LYRIC_PARTS.map((part) => (
                  <option key={part} value={part}>
                    {LYRIC_PART_LABELS[part]}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={index === 0}
                onClick={() => moveTo(index, -1)}
                aria-label="Monter"
              >
                <ArrowUp aria-hidden />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={index === segments.length - 1}
                onClick={() => moveTo(index, 1)}
                aria-label="Descendre"
              >
                <ArrowDown aria-hidden />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => {
                  // Refrain chanté une nouvelle fois : copie avec son propre repère.
                  const next = [...segments];
                  next.splice(index + 1, 0, {
                    ...segment,
                    id: newSegmentId(),
                    startMs: null,
                    endMs: null,
                  });
                  setSegments(next);
                }}
                aria-label="Dupliquer (refrain répété)"
              >
                <Copy aria-hidden />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setSegments(segments.filter((_, i) => i !== index))}
                aria-label="Supprimer la phrase"
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ol>
      )}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() =>
          setSegments([
            ...segments,
            { id: newSegmentId(), text: 'Nouvelle phrase', startMs: null, part: null },
          ])
        }
      >
        <Plus aria-hidden />
        Ajouter une phrase
      </Button>
    </div>
  );
}

function SyncStep({
  src,
  segments,
  setSegments,
  issues,
  synchronized,
  onValidate,
}: {
  src: string;
  segments: LyricSegment[];
  setSegments: (segments: LyricSegment[]) => void;
  issues: string[];
  synchronized: boolean;
  onValidate: () => void;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [now, setNow] = useState(0);
  const [rate, setRate] = useState(1);
  const firstUnmarked = segments.findIndex((segment) => segment.startMs === null);
  const [pointer, setPointer] = useState(firstUnmarked === -1 ? 0 : firstUnmarked);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      setNow((audio.current?.currentTime ?? 0) * 1000);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const setStart = (index: number, startMs: number | null) =>
    setSegments(segments.map((segment, i) => (i === index ? { ...segment, startMs } : segment)));
  const seek = (ms: number) => {
    if (!audio.current) return;
    audio.current.currentTime = Math.max(0, ms) / 1000;
    setNow(Math.max(0, ms));
  };
  const mark = () => {
    if (pointer >= segments.length) return;
    setStart(pointer, Math.round((audio.current?.currentTime ?? 0) * 1000));
    setPointer(pointer + 1);
  };

  if (segments.length === 0) {
    return <p className="text-sm text-muted-foreground">Ajoutez d’abord les paroles (étape 2).</p>;
  }
  return (
    <div className="space-y-4">
      <audio
        ref={audio}
        src={resolveImageSrc(src)}
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onSeeked={() => setNow((audio.current?.currentTime ?? 0) * 1000)}
        onLoadedMetadata={() => {
          if (audio.current) audio.current.playbackRate = rate;
        }}
      />
      <div className="sticky top-0 z-10 space-y-2 rounded-lg border bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="icon"
            className="rounded-full"
            onClick={() =>
              audio.current?.paused ? void audio.current.play() : audio.current?.pause()
            }
            aria-label={playing ? 'Pause' : 'Lecture'}
          >
            {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => seek(now - 3000)}>
            <RotateCcw aria-hidden />3 s
          </Button>
          <span className="font-mono text-sm tabular-nums">{formatPreciseClock(now)}</span>
          <label className="ml-auto flex items-center gap-1 text-sm">
            Vitesse
            <select
              value={rate}
              onChange={(event) => {
                const next = Number(event.target.value);
                setRate(next);
                if (audio.current) audio.current.playbackRate = next;
              }}
              className="h-8 rounded-md border bg-transparent px-1"
            >
              {SYNC_RATES.map((value) => (
                <option key={value} value={value}>
                  {String(value).replace('.', ',')}×
                </option>
              ))}
            </select>
          </label>
        </div>
        <Button
          type="button"
          className="h-14 w-full text-base"
          disabled={pointer >= segments.length}
          onClick={mark}
        >
          <Crosshair aria-hidden />
          {pointer < segments.length
            ? `Marquer : « ${segments[pointer]!.text.slice(0, 48)}${segments[pointer]!.text.length > 48 ? '…' : ''} »`
            : 'Toutes les phrases sont marquées'}
        </Button>
      </div>
      <ol className="space-y-1">
        {segments.map((segment, index) => (
          <SegmentTiming
            key={`${segment.id}:${segment.startMs ?? ''}`}
            index={index}
            segment={segment}
            current={index === pointer}
            onPoint={() => setPointer(index)}
            onSet={(ms) => setStart(index, ms)}
            onHere={() => setStart(index, Math.round((audio.current?.currentTime ?? 0) * 1000))}
            onListen={() => {
              if (segment.startMs === null) return;
              seek(segment.startMs - 1000);
              void audio.current?.play();
            }}
          />
        ))}
      </ol>
      {issues.length > 0 ? (
        <ul
          className="space-y-1 rounded-md bg-tesla-sable/40 px-3 py-2 text-sm"
          aria-label="À corriger"
        >
          {issues.slice(0, 5).map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
          {issues.length > 5 && <li>… et {issues.length - 5} autre(s).</li>}
        </ul>
      ) : (
        <Button
          type="button"
          variant={synchronized ? 'outline' : 'default'}
          disabled={synchronized}
          onClick={onValidate}
        >
          <Headphones aria-hidden />
          {synchronized ? 'Synchronisation validée' : 'Valider la synchronisation'}
        </Button>
      )}
    </div>
  );
}

function SegmentTiming({
  index,
  segment,
  current,
  onPoint,
  onSet,
  onHere,
  onListen,
}: {
  index: number;
  segment: LyricSegment;
  current: boolean;
  onPoint: () => void;
  onSet: (ms: number | null) => void;
  onHere: () => void;
  onListen: () => void;
}) {
  const shown = segment.startMs === null ? '' : formatPreciseClock(segment.startMs);
  // Saisie locale ; le composant est recréé quand le repère change (clé), sans effet de recopie.
  const [value, setValue] = useState(shown);
  return (
    <li
      className={cn(
        'flex flex-wrap items-center gap-1 rounded-md px-2 py-1',
        current && 'bg-tesla-sable/50 ring-1 ring-tesla-or',
      )}
    >
      <button
        type="button"
        onClick={onPoint}
        className="min-w-0 flex-1 truncate text-left text-sm"
        title="Marquer à partir de cette phrase"
      >
        <span className="mr-2 text-xs text-muted-foreground tabular-nums">{index + 1}</span>
        {segment.text}
      </button>
      <Input
        aria-label={`Début de la phrase ${index + 1}`}
        value={value}
        placeholder="—"
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => {
          if (value.trim() === '') return onSet(null);
          const ms = parsePreciseClock(value);
          if (ms === null) setValue(shown);
          else onSet(ms);
        }}
        className="h-8 w-28 font-mono text-sm"
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={onHere}
        aria-label="Repère à la position actuelle"
      >
        <Crosshair aria-hidden />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        disabled={segment.startMs === null}
        onClick={onListen}
        aria-label="Écouter depuis ce repère"
      >
        <Play aria-hidden />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        disabled={segment.startMs === null}
        onClick={() => onSet(null)}
        aria-label="Effacer le repère"
      >
        <Eraser aria-hidden />
      </Button>
    </li>
  );
}

import { z } from 'zod';

/**
 * Paroles et textes synchronisés avec un enregistrement (D221) : modèle canonique unique, utilisé
 * pour les chants comme pour les récits narrés. Les segments sont portés par le bloc `audio` d'une
 * leçon (versionné et publié avec le module) ; leurs repères ne valent que pour l'enregistrement
 * exact désigné par `syncedSrc`. Aucune synchronisation automatique : un humain pose et vérifie
 * les repères.
 */

/** Partie d'un chant (facultative) : aide à la lecture des paroles intégrales. */
export const LYRIC_PARTS = ['COUPLET', 'REFRAIN'] as const;
export type LyricPart = (typeof LYRIC_PARTS)[number];

export const LYRIC_PART_LABELS: Record<LyricPart, string> = {
  COUPLET: 'Couplet',
  REFRAIN: 'Refrain',
};

/** Durée maximale d'un enregistrement prise en compte (3 heures, en millisecondes). */
export const MAX_MEDIA_MS = 3 * 60 * 60 * 1000;
export const MAX_LYRIC_SEGMENTS = 400;

export const lyricSegmentSchema = z.object({
  /** Identité stable du segment (générée à la création, conservée lors des corrections). */
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  text: z.string().trim().min(1).max(500),
  /** Début (ms) ; null tant que le repère n'est pas posé. */
  startMs: z.number().int().min(0).max(MAX_MEDIA_MS).nullable(),
  /** Fin facultative (ms) : au-delà, aucune phrase n'est mise en évidence (passage instrumental). */
  endMs: z.number().int().min(0).max(MAX_MEDIA_MS).nullable().optional(),
  part: z.enum(LYRIC_PARTS).nullable().optional(),
});

export type LyricSegment = z.infer<typeof lyricSegmentSchema>;

/**
 * Problèmes d'une chronologie : repère manquant, ordre non croissant, fin avant le début.
 * Liste vide = chronologie publiable.
 */
export function timelineIssues(segments: readonly LyricSegment[]): string[] {
  const issues: string[] = [];
  let previous = -1;
  segments.forEach((segment, index) => {
    const label = `Phrase ${index + 1}`;
    if (segment.startMs === null) {
      issues.push(`${label} : repère de début manquant.`);
      return;
    }
    if (segment.startMs <= previous) {
      issues.push(`${label} : son repère doit suivre celui de la phrase précédente.`);
    }
    if (segment.endMs != null && segment.endMs <= segment.startMs) {
      issues.push(`${label} : la fin doit suivre le début.`);
    }
    previous = Math.max(previous, segment.startMs);
  });
  return issues;
}

/**
 * Index de la phrase en cours à l'instant `timeMs` de la lecture réelle, ou -1 (avant la première
 * phrase, ou après la fin facultative de la phrase courante). Recherche dichotomique : appelée à
 * chaque `timeupdate`, y compris après un déplacement ou un changement de vitesse.
 */
export function activeSegmentIndex(segments: readonly LyricSegment[], timeMs: number): number {
  let low = 0;
  let high = segments.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const start = segments[middle]!.startMs;
    if (start !== null && start <= timeMs) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  if (found === -1) return -1;
  const endMs = segments[found]!.endMs;
  return endMs != null && timeMs >= endMs ? -1 : found;
}

/** Identifiant court de segment (non cryptographique : identité d'affichage seulement). */
export function newSegmentId(): string {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Découpe de paroles collées : une phrase par ligne non vide. Une ligne « Refrain » ou « Couplet »
 * (suivie ou non de « : » ou d'un numéro) n'est pas une phrase : elle marque la partie des lignes
 * suivantes, jusqu'à la prochaine ligne vide.
 */
export function splitLyrics(text: string, makeId: () => string = newSegmentId): LyricSegment[] {
  const segments: LyricSegment[] = [];
  let part: LyricPart | null = null;
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (line === '') {
      part = null;
      continue;
    }
    const marker = /^(refrain|couplet)\b\s*\d*\s*:?\s*$/i.exec(line);
    if (marker) {
      part = marker[1]!.toLowerCase() === 'refrain' ? 'REFRAIN' : 'COUPLET';
      continue;
    }
    segments.push({ id: makeId(), text: line.slice(0, 500), startMs: null, part });
  }
  return segments.slice(0, MAX_LYRIC_SEGMENTS);
}

/** « 01:02.345 » ou « 1:02:03.4 » → millisecondes ; null si illisible. */
function parseClock(value: string): number | null {
  const match = /^(?:(\d{1,2}):)?(\d{1,3}):(\d{1,2})(?:[.,](\d{1,3}))?$/.exec(value.trim());
  if (!match) return null;
  const [, hours = '0', minutes, seconds, fraction = '0'] = match;
  if (Number(seconds) >= 60) return null;
  const ms =
    (Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)) * 1000 +
    Number(fraction.padEnd(3, '0'));
  return ms <= MAX_MEDIA_MS ? ms : null;
}

/** Texte brut d'une ligne importée : balises retirées (jamais interprétées), espaces normalisés. */
function plainText(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/\{[^}]*\}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Import LRC : `[mm:ss.xx]texte`, plusieurs repères possibles sur une ligne (refrain répété), balises
 * de métadonnées (`[ar:…]`) ignorées. Résultat trié par repère.
 */
export function parseLrc(text: string, makeId: () => string = newSegmentId): LyricSegment[] {
  const segments: { startMs: number; text: string }[] = [];
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const stamps: number[] = [];
    let rest = line.trim();
    for (;;) {
      const match = /^\[([^\]]*)\]/.exec(rest);
      if (!match) break;
      const ms = parseClock(match[1]!);
      if (ms !== null) stamps.push(ms);
      rest = rest.slice(match[0].length);
    }
    const lyric = plainText(rest);
    if (lyric === '') continue;
    for (const startMs of stamps) segments.push({ startMs, text: lyric.slice(0, 500) });
  }
  return segments
    .sort((a, b) => a.startMs - b.startMs)
    .slice(0, MAX_LYRIC_SEGMENTS)
    .map((segment) => ({ id: makeId(), text: segment.text, startMs: segment.startMs }));
}

/**
 * Import WebVTT ou SRT : un segment par bloc de sous-titre (début, fin, texte sur une ou plusieurs
 * lignes). Les balises sont retirées, jamais interprétées.
 */
export function parseTimedCues(text: string, makeId: () => string = newSegmentId): LyricSegment[] {
  const segments: LyricSegment[] = [];
  const blocks = text.replace(/\r\n?/g, '\n').split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split('\n');
    const timing = lines.findIndex((line) => line.includes('-->'));
    if (timing === -1) continue;
    const [from = '', to = ''] = lines[timing]!.split('-->');
    const startMs = parseClock(from);
    const endMs = parseClock(to.trim().split(/\s+/)[0] ?? '');
    const lyric = plainText(lines.slice(timing + 1).join(' '));
    if (startMs === null || lyric === '') continue;
    segments.push({
      id: makeId(),
      text: lyric.slice(0, 500),
      startMs,
      endMs: endMs !== null && endMs > startMs ? endMs : null,
    });
  }
  return segments.sort((a, b) => a.startMs! - b.startMs!).slice(0, MAX_LYRIC_SEGMENTS);
}

/** Import d'un fichier de paroles synchronisées : WebVTT/SRT si des repères « --> », sinon LRC. */
export function parseSyncedLyrics(text: string, makeId?: () => string): LyricSegment[] {
  return text.includes('-->') ? parseTimedCues(text, makeId) : parseLrc(text, makeId);
}

/** « 1:05 » (ou « 1:02:05 ») pour l'affichage d'une durée. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`;
}

/** « 1:05.250 » : repère précis affiché et saisi dans l'atelier de synchronisation. */
export function formatPreciseClock(ms: number): string {
  return `${formatClock(ms)}.${String(Math.floor(ms % 1000)).padStart(3, '0')}`;
}

/** Saisie d'un repère (« 1:05.250 », « 65.25 », « 1:05 ») → millisecondes ; null si illisible. */
export function parsePreciseClock(value: string): number | null {
  const trimmed = value.trim();
  if (/^\d+(?:[.,]\d{1,3})?$/.test(trimmed)) {
    const ms = Math.round(Number(trimmed.replace(',', '.')) * 1000);
    return ms <= MAX_MEDIA_MS ? ms : null;
  }
  return parseClock(trimmed);
}

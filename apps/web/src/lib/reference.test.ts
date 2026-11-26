import {
  activeSegmentIndex,
  ceremonyRoles,
  formatPreciseClock,
  hasDialogue,
  isAudioSynchronized,
  type LessonDocument,
  lessonDocumentSchema,
  type LyricSegment,
  parseCeremony,
  parseLrc,
  parsePreciseClock,
  parseSyncedLyrics,
  parseTimedCues,
  preparationPoints,
  roleMatches,
  searchExcerpt,
  speakerRole,
  splitLyrics,
  timelineIssues,
} from '@tesla/shared';
import { describe, expect, it } from 'vitest';
import { hiddenWord, prayerLines, shuffledOrder } from '@/components/reference/prayer-view';

let counter = 0;
const id = () => `s-${++counter}`;
const segment = (startMs: number | null, text = 'phrase', endMs?: number | null): LyricSegment => ({
  id: id(),
  text,
  startMs,
  endMs,
});
const FILE = '/api/v1/module-files/0190a7b2-1c2d-7e3f-8a9b-0c1d2e3f4a5b';
const OTHER = '/api/v1/module-files/0190a7b2-1c2d-7e3f-8a9b-0c1d2e3f4a5c';

describe('paroles synchronisées (D221)', () => {
  it('trouve la phrase en cours à partir de la position réelle, y compris après un déplacement', () => {
    const lines = [segment(1000), segment(4000), segment(9000, 'x', 12_000)];
    expect(activeSegmentIndex(lines, 0)).toBe(-1);
    expect(activeSegmentIndex(lines, 1000)).toBe(0);
    expect(activeSegmentIndex(lines, 3999)).toBe(0);
    expect(activeSegmentIndex(lines, 4000)).toBe(1);
    // Retour en arrière (déplacement) : recalcul sans état.
    expect(activeSegmentIndex(lines, 1500)).toBe(0);
    expect(activeSegmentIndex(lines, 10_000)).toBe(2);
    // Après la fin facultative : passage instrumental, aucune phrase.
    expect(activeSegmentIndex(lines, 12_500)).toBe(-1);
  });

  it('signale les repères manquants, désordonnés ou une fin avant le début', () => {
    expect(timelineIssues([segment(0), segment(1000)])).toEqual([]);
    expect(timelineIssues([segment(0), segment(null)])).toHaveLength(1);
    expect(timelineIssues([segment(2000), segment(1000)])[0]).toMatch(/suivre/);
    expect(timelineIssues([segment(1000, 'a', 500)])[0]).toMatch(/fin/);
  });

  it('découpe des paroles collées et repère couplets et refrains', () => {
    const lines = splitLyrics('Refrain :\nLigne A\nLigne B\n\nCouplet 1\nLigne C\n\nLigne D', id);
    expect(lines.map((line) => [line.text, line.part])).toEqual([
      ['Ligne A', 'REFRAIN'],
      ['Ligne B', 'REFRAIN'],
      ['Ligne C', 'COUPLET'],
      ['Ligne D', null],
    ]);
    expect(lines.every((line) => line.startMs === null)).toBe(true);
  });

  it('importe un LRC, refrain répété compris, et ignore les métadonnées', () => {
    const lines = parseLrc(
      '[ar:Test]\n[00:01.50]Un\n[00:05.00][00:20.25]Refrain\n[00:10.00]Deux',
      id,
    );
    expect(lines.map((line) => [line.startMs, line.text])).toEqual([
      [1500, 'Un'],
      [5000, 'Refrain'],
      [10_000, 'Deux'],
      [20_250, 'Refrain'],
    ]);
  });

  it('importe WebVTT et SRT sans interpréter les balises', () => {
    const vtt =
      'WEBVTT\n\n00:00:01.000 --> 00:00:03.500\n<b>Bonjour</b> <script>x</script>\n\n00:00:04.000 --> 00:00:06.000\nSuite';
    expect(parseTimedCues(vtt, id).map((line) => [line.startMs, line.endMs, line.text])).toEqual([
      [1000, 3500, 'Bonjour x'],
      [4000, 6000, 'Suite'],
    ]);
    const srt =
      '1\n00:00:02,000 --> 00:00:04,000\nPremière\n\n2\n00:00:05,000 --> 00:00:07,000\nSeconde';
    expect(parseSyncedLyrics(srt, id).map((line) => line.startMs)).toEqual([2000, 5000]);
  });

  it('lit et affiche les repères saisis à la main', () => {
    expect(parsePreciseClock('1:05.250')).toBe(65_250);
    expect(parsePreciseClock('65,5')).toBe(65_500);
    expect(parsePreciseClock('1:75')).toBeNull();
    expect(formatPreciseClock(65_250)).toBe('1:05.250');
  });
});

describe('bloc audio des leçons (D221)', () => {
  const doc = (attrs: Record<string, unknown>) => ({
    type: 'doc',
    content: [
      {
        type: 'audio',
        attrs: {
          src: FILE,
          rights: 'AUTORISES',
          download: true,
          syncedSrc: null,
          segments: [],
          ...attrs,
        },
      },
    ],
  });

  it('accepte un enregistrement interne et une synchronisation cohérente', () => {
    const parsed = lessonDocumentSchema.safeParse(
      doc({ syncedSrc: FILE, segments: [segment(0, 'a'), segment(1200, 'b')] }),
    );
    expect(parsed.success).toBe(true);
    const block = (parsed.data as LessonDocument).content[0]!;
    expect(block.type === 'audio' && isAudioSynchronized(block.attrs)).toBe(true);
  });

  it('refuse une adresse externe et une synchronisation désordonnée', () => {
    expect(
      lessonDocumentSchema.safeParse(doc({ src: 'https://exemple.org/chant.mp3' })).success,
    ).toBe(false);
    expect(
      lessonDocumentSchema.safeParse(
        doc({ syncedSrc: FILE, segments: [segment(2000, 'a'), segment(1000, 'b')] }),
      ).success,
    ).toBe(false);
  });

  it('ignore les repères posés pour un autre enregistrement (remplacement)', () => {
    const parsed = lessonDocumentSchema.parse(
      doc({ syncedSrc: OTHER, segments: [segment(2000, 'a'), segment(1000, 'b')] }),
    );
    const block = parsed.content[0]!;
    expect(block.type === 'audio' && isAudioSynchronized(block.attrs)).toBe(false);
  });
});

const bold = (text: string) => ({
  type: 'text' as const,
  text,
  marks: [{ type: 'bold' as const }],
});
const plain = (text: string) => ({ type: 'text' as const, text });
const say = (speaker: string, words: string) => ({
  type: 'paragraph' as const,
  content: [bold(`${speaker} :`), plain(` ${words}`)],
});

describe('lecture structurée des cérémonies (D220)', () => {
  const ceremony: LessonDocument = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [plain('Référence : Boussole, pp. 1–2.')] },
      { type: 'heading', attrs: { level: 2 }, content: [plain('Préparation')] },
      {
        type: 'paragraph',
        content: [plain('La cérémonie se fait en tenue. La communauté fait un rectangle.')],
      },
      { type: 'heading', attrs: { level: 2 }, content: [plain('Déroulé et paroles')] },
      say('Le CC', 'Route pour…'),
      say('Les routiers en rectangle', 'SERVIR !'),
      { type: 'blockquote', content: [{ type: 'paragraph', content: [plain('Il s’avance.')] }] },
      say('Le CC (s’adressant aux routiers)', 'À l’aise !'),
      { type: 'paragraph', content: [plain('Suite de la réplique.')] },
      say('Les routiers', 'SERVIR !'),
      { type: 'paragraph', content: [bold('NB :'), plain(' Un repas peut être offert.')] },
    ],
  };

  it('distingue répliques, indications, notes et références sans rien reformuler', () => {
    const items = parseCeremony(ceremony);
    expect(items.map((item) => item.kind)).toEqual([
      'reference',
      'section',
      'text',
      'section',
      'line',
      'line',
      'direction',
      'line',
      'line',
      'note',
    ]);
    const third = items[7]!;
    expect(third.kind === 'line' && third.role).toBe('CC');
    expect(third.kind === 'line' && third.aside).toBe('s’adressant aux routiers');
    // Le paragraphe sans intervenant prolonge la réplique précédente.
    expect(third.kind === 'line' && third.blocks).toHaveLength(2);
    expect(hasDialogue(ceremony)).toBe(true);
  });

  it('dérive les rôles du texte et rattache les précisions au rôle général', () => {
    expect(speakerRole('Les routiers en rectangle')).toEqual({
      role: 'Routiers en rectangle',
      aside: null,
    });
    expect(ceremonyRoles(parseCeremony(ceremony))).toEqual(['CC', 'Routiers']);
    expect(roleMatches('Routiers', 'Routiers en rectangle')).toBe(true);
    expect(roleMatches('CC', 'Coordinateur')).toBe(false);
  });

  it('propose comme points de préparation les seules phrases écrites', () => {
    expect(preparationPoints(parseCeremony(ceremony))).toEqual([
      'La cérémonie se fait en tenue.',
      'La communauté fait un rectangle.',
    ]);
  });
});

describe('prière et recherche', () => {
  const prayer: LessonDocument = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [bold('Seigneur Jésus, apprenez-nous :')] },
      { type: 'paragraph', content: [plain('À être généreux,')] },
      { type: 'paragraph', content: [plain('À donner sans compter,')] },
    ],
  };

  it('lit les lignes dans l’ordre et masque un mot sans rien inventer', () => {
    expect(prayerLines(prayer)).toEqual([
      'Seigneur Jésus, apprenez-nous :',
      'À être généreux,',
      'À donner sans compter,',
    ]);
    expect(hiddenWord('À être généreux,')).toEqual({
      before: 'À être ',
      word: 'généreux',
      after: ',',
    });
  });

  it('mélange toujours l’ordre de départ de la remise en ordre', () => {
    for (const count of [2, 3, 7, 8]) {
      const order = shuffledOrder(count);
      expect([...order].sort((a, b) => a - b)).toEqual([...Array(count).keys()]);
      expect(order).not.toEqual([...Array(count).keys()]);
    }
  });

  it('trouve un extrait sans tenir compte des accents', () => {
    expect(searchExcerpt('Le traditionnel Akwaba parmi nous.', 'akwaba')).toContain('Akwaba');
    expect(searchExcerpt('À être généreux', 'genereux')).toContain('généreux');
    expect(searchExcerpt('texte', 'absent')).toBeNull();
  });
});

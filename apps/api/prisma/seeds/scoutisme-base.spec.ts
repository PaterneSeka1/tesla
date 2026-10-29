import { isLessonDocumentEmpty, lessonDocumentSchema, PROGRESSION_STAGES } from '@tesla/shared';
import { MORSE_DIGITS, MORSE_LETTERS, SCOUTISME_BASE_MODULES } from './scoutisme-base.seed.js';
import {
  assertValidSource,
  canonicalJson,
  contentHash,
  diffSnapshots,
  snapshotOf,
} from './source-modules.js';

const textOf = (node: unknown): string => {
  const n = node as { type: string; text?: string; content?: unknown[] };
  return n.type === 'text' ? n.text! : (n.content ?? []).map(textOf).join('\n');
};

describe('Seed « Bases du scoutisme »', () => {
  it('définit exactement quatre modules aux codes et slugs stables', () => {
    expect(SCOUTISME_BASE_MODULES.map((m) => m.key)).toEqual([
      'NT-SCOUT-M01',
      'NT-SCOUT-M02',
      'NT-SCOUT-M03',
      'NT-SCOUT-M04',
    ]);
    expect(SCOUTISME_BASE_MODULES.map((m) => m.slug)).toEqual([
      'nt-scout-m01-decouvrir-le-scoutisme',
      'nt-scout-m02-loi-principes-et-vertus',
      'nt-scout-m03-la-methode-scoute',
      'nt-scout-m04-initiation-au-morse',
    ]);
  });

  it('respecte le découpage demandé (5, 4, 7 et 5 leçons, dans l’ordre)', () => {
    expect(SCOUTISME_BASE_MODULES.map((m) => m.lessons.length)).toEqual([5, 4, 7, 5]);
    expect(SCOUTISME_BASE_MODULES[2]!.lessons.map((l) => l.title)).toEqual([
      'Présentation des huit éléments',
      'Loi et promesse',
      'Vie en petit groupe',
      'Vie dans la nature',
      'Soutien adulte et cadre symbolique',
      'Éducation par l’action',
      'Progression personnelle et engagement communautaire',
    ]);
  });

  it('propose des étapes existantes et des contenus conformes à la liste blanche', () => {
    const stages = PROGRESSION_STAGES.map((s) => s.code as string);
    for (const module of SCOUTISME_BASE_MODULES) {
      expect(stages).toContain(module.stageCode);
      expect(() => assertValidSource(module)).not.toThrow();
      for (const lesson of module.lessons) {
        expect(lessonDocumentSchema.safeParse(lesson.content).success).toBe(true);
      }
    }
    expect(SCOUTISME_BASE_MODULES.map((m) => m.stageCode)).toEqual([
      'NOVICIAT',
      'NOVICIAT',
      'APPRENTISSAGE',
      'APPRENTISSAGE',
    ]);
  });

  it('chaque leçon vide est signalée « à compléter » et chaque module « évaluation à préparer »', () => {
    for (const module of SCOUTISME_BASE_MODULES) {
      module.lessons.forEach((lesson, position) => {
        if (!isLessonDocumentEmpty(lesson.content)) return;
        expect(
          module.notes.some((n) => n.kind === 'A_COMPLETER' && n.lessonPosition === position),
        ).toBe(true);
      });
      expect(module.notes.some((n) => n.note.startsWith('Évaluation à préparer'))).toBe(true);
    }
    const empty = SCOUTISME_BASE_MODULES.flatMap((m) =>
      m.lessons.filter((l) => isLessonDocumentEmpty(l.content)),
    );
    expect(empty).toHaveLength(8);
  });

  it('conserve les dix articles de la loi et leur référence de page', () => {
    const lesson = SCOUTISME_BASE_MODULES[1]!.lessons[2]!;
    const list = lesson.content.content[0]!;
    expect(list.type).toBe('orderedList');
    expect(list.type === 'orderedList' && list.content).toHaveLength(10);
    expect(textOf(lesson.content)).toContain('Le scout met son honneur à mériter confiance.');
    expect(textOf(lesson.content)).toContain('p. 2');
  });

  it('transcrit l’alphabet Morse complet sans signe étranger au point et au trait', () => {
    expect(MORSE_LETTERS.map(([letter]) => letter).join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(MORSE_DIGITS.map(([digit]) => digit).join('')).toBe('1234567890');
    for (const [, code] of [...MORSE_LETTERS, ...MORSE_DIGITS]) {
      expect(code).toMatch(/^[·—]( [·—])*$/);
    }
    expect(new Set(MORSE_LETTERS.map(([, code]) => code)).size).toBe(26);
  });

  it('calcule une empreinte stable, indépendante de l’ordre des clés', () => {
    const module = SCOUTISME_BASE_MODULES[0]!;
    expect(contentHash(module)).toBe(contentHash(structuredClone(module)));
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: 3 }] })).toBe('{"a":[{"c":3,"d":2}],"b":1}');
  });

  it('décrit les écarts entre l’import et une source modifiée', () => {
    const module = SCOUTISME_BASE_MODULES[3]!;
    const changed = structuredClone(module);
    changed.title = 'Le Morse';
    changed.lessons[0]!.title = 'Histoire du Morse';
    changed.lessons.push({ title: 'Nouvelle leçon', content: { type: 'doc', content: [] } });
    expect(diffSnapshots(snapshotOf(module), snapshotOf(module))).toEqual([]);
    expect(diffSnapshots(snapshotOf(module), snapshotOf(changed))).toEqual([
      'title modifié dans la source',
      'leçon 1 : titre « Définition et histoire du Morse » → « Histoire du Morse »',
      'leçon 6 ajoutée dans la source : « Nouvelle leçon »',
    ]);
  });

  it('refuse une définition invalide avant toute écriture', () => {
    const invalid = structuredClone(SCOUTISME_BASE_MODULES[0]!);
    invalid.lessons[0]!.content = {
      type: 'doc',
      content: [{ type: 'image', attrs: { src: 'http://exemple.test/a.png' } }],
    };
    expect(() => assertValidSource(invalid)).toThrow(/hors liste blanche/);
  });
});

import { isLessonDocumentEmpty, lessonDocumentSchema, PROGRESSION_STAGES } from '@tesla/shared';
import { auditLesson } from './pedagogy-audit.js';
import {
  MORSE_ABBREVIATIONS,
  MORSE_DIGITS,
  MORSE_LETTERS,
  morseOf,
  SCOUTISME_BASE_MODULES,
} from './scoutisme-base.seed.js';
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
      'NOVICIAT',
      'APPRENTISSAGE',
    ]);
    expect(SCOUTISME_BASE_MODULES.map((m) => m.category)).toEqual([
      'ETAPE',
      'ETAPE',
      'ETAPE',
      'COMPLEMENTAIRE',
    ]);
  });

  it('ne contient plus aucune leçon vide, provisoire ou sans référence (révision 2)', () => {
    for (const module of SCOUTISME_BASE_MODULES) {
      expect(module.objectives.length).toBeGreaterThanOrEqual(3);
      for (const lesson of module.lessons) {
        expect(isLessonDocumentEmpty(lesson.content)).toBe(false);
        const blocking = auditLesson(lesson.title, lesson.content, {
          requireReference: true,
          fundamental: false,
        }).filter((issue) => issue.blocking);
        expect(blocking, `${module.key} — ${lesson.title}`).toEqual([]);
      }
      expect(module.notes.some((n) => n.note.startsWith('Évaluation à préparer'))).toBe(false);
    }
  });

  it('trace chaque correction de la source dans les notes, sans réécrire la loi', () => {
    const [m01, m02] = SCOUTISME_BASE_MODULES;
    expect(m01!.notes.some((n) => n.note.includes('Stephenson Smith Robert Baden Powell'))).toBe(
      true,
    );
    expect(m01!.notes.some((n) => n.note.includes('(Malaysi)'))).toBe(true);
    // Le nom du prêtre (1937) reste à confirmer par le responsable.
    expect(m01!.notes.some((n) => n.kind === 'A_VERIFIER' && n.note.includes('Paul Ray'))).toBe(
      true,
    );
    expect(textOf(m02!.lessons[2]!.content)).toContain(
      'Le scout obéit sans réplique et ne fait rien à moitié.',
    );
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
    // Contrôle indépendant : code Morse international (recommandation UIT-R M.1677-1).
    const itu =
      'A.- B-... C-.-. D-.. E. F..-. G--. H.... I.. J.--- K-.- L.-.. M-- N-. O--- P.--. Q--.- R.-. S... T- U..- V...- W.-- X-..- Y-.-- Z--.. 1.---- 2..--- 3...-- 4....- 5..... 6-.... 7--... 8---.. 9----. 0-----';
    for (const entry of itu.split(' ')) {
      const [sign, code] = [entry[0]!, entry.slice(1)];
      const expected = code.replaceAll('.', '·').replaceAll('-', '—').split('').join(' ');
      expect([...MORSE_LETTERS, ...MORSE_DIGITS].find(([s]) => s === sign)?.[1]).toBe(expected);
    }
  });

  it('recompose les abréviations depuis l’alphabet, sans doublon', () => {
    expect(morseOf('SOS')).toBe('··· ——— ···');
    expect(morseOf('k')).toBe('—·—');
    expect(() => morseOf('?')).toThrow(/absent/);
    const keys = MORSE_ABBREVIATIONS.map(([abbreviation]) => abbreviation);
    expect(new Set(keys).size).toBe(keys.length);
    const lesson = textOf(SCOUTISME_BASE_MODULES[3]!.lessons[3]!.content);
    expect(lesson).toContain('GA : bon après-midi — ——· ·—');
    expect(lesson).not.toContain('·-·');
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

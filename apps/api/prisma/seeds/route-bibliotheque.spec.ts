import { isLessonDocumentEmpty, lessonDocumentSchema, PROGRESSION_STAGES } from '@tesla/shared';
import {
  FUNDAMENTAL_TEXTS,
  PRIERE_ROUTE_KEY,
  PRIERE_ROUTE_ORIGINAL,
  ROUTE_CATALOG,
  ROUTE_MODULES,
} from './route-bibliotheque.seed.js';
import { SCOUTISME_BASE_MODULES } from './scoutisme-base.seed.js';
import { assertValidSource, canonicalJson, snapshotOf } from './source-modules.js';

const textOf = (node: unknown): string => {
  const n = node as { type: string; text?: string; content?: unknown[] };
  return n.type === 'text' ? n.text! : (n.content ?? []).map(textOf).join('\n');
};

const ALL = [...FUNDAMENTAL_TEXTS, ...ROUTE_MODULES];

describe('Seed « Bibliothèque de la Route »', () => {
  it('définit dix modules et un texte fondamental aux codes et slugs uniques et stables', () => {
    expect(ROUTE_MODULES.map((m) => m.key)).toEqual(
      [3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => `NT-ROUTE-M${String(n).padStart(2, '0')}`),
    );
    expect(FUNDAMENTAL_TEXTS.map((m) => m.key)).toEqual([PRIERE_ROUTE_KEY]);
    const existing = SCOUTISME_BASE_MODULES;
    const keys = new Set([...existing, ...ALL].map((m) => m.key));
    const slugs = new Set([...existing, ...ALL].map((m) => m.slug));
    expect(keys.size).toBe(existing.length + ALL.length);
    expect(slugs.size).toBe(existing.length + ALL.length);
  });

  it('couvre les 12 modules du catalogue en réutilisant NT-SCOUT-M01 et M02 (aucun doublon)', () => {
    expect(ROUTE_CATALOG).toHaveLength(12);
    expect(ROUTE_CATALOG.filter((entry) => entry.reused).map((entry) => entry.key)).toEqual([
      'NT-SCOUT-M01',
      'NT-SCOUT-M02',
    ]);
    const known = new Set(
      [...SCOUTISME_BASE_MODULES, ...ROUTE_MODULES].map((module) => module.key),
    );
    expect(ROUTE_CATALOG.every((entry) => known.has(entry.key))).toBe(true);
  });

  it('respecte le découpage demandé et les étapes recommandées', () => {
    expect(ROUTE_MODULES.map((m) => m.lessons.length)).toEqual([6, 8, 6, 6, 7, 7, 8, 10, 6, 6]);
    expect(ROUTE_MODULES.map((m) => m.stageCode)).toEqual([
      'NOVICIAT',
      'NOVICIAT',
      'APPRENTISSAGE',
      'APPRENTISSAGE',
      'APPRENTISSAGE',
      'COMPAGNONNAGE',
      'COMPAGNONNAGE',
      'COMPAGNONNAGE',
      'DEPART_ROUTIER',
      'DEPART_ROUTIER',
    ]);
    const stages = PROGRESSION_STAGES.map((s) => s.code as string);
    for (const module of ROUTE_MODULES) {
      expect(stages).toContain(module.stageCode);
      expect(module.category).toBe('ETAPE');
    }
  });

  it('produit des contenus conformes à la liste blanche, sans leçon vide, avec objectifs et sources', () => {
    for (const module of ALL) {
      expect(() => assertValidSource(module)).not.toThrow();
      for (const lesson of module.lessons) {
        expect(lessonDocumentSchema.safeParse(lesson.content).success).toBe(true);
        expect(isLessonDocumentEmpty(lesson.content)).toBe(false);
      }
    }
    for (const module of ROUTE_MODULES) {
      expect(module.summary.length).toBeGreaterThan(0);
      expect(module.objectives.length).toBeGreaterThanOrEqual(3);
      // Chaque leçon cite sa source documentaire.
      for (const lesson of module.lessons) expect(textOf(lesson.content)).toMatch(/Source : /);
      // La dernière leçon porte la conclusion du module.
      expect(textOf(module.lessons.at(-1)!.content)).toContain('Pour conclure');
      // Étape recommandée signalée comme proposition ; évaluation à préparer.
      expect(module.notes.some((n) => n.note.includes('ni obligatoire'))).toBe(true);
      expect(module.notes.some((n) => n.note.startsWith('Évaluation à préparer'))).toBe(true);
    }
  });

  it('n’invente pas la Charte : aucune leçon, seulement une note à compléter', () => {
    for (const module of ALL) {
      for (const lesson of module.lessons) expect(lesson.title).not.toMatch(/charte/i);
    }
    const m03 = ROUTE_MODULES[0]!;
    expect(m03.notes.some((n) => n.kind === 'A_COMPLETER' && n.note.includes('Charte'))).toBe(true);
  });

  it('conserve le texte original de la prière et propose la version corrigée à valider', () => {
    const [priere] = FUNDAMENTAL_TEXTS;
    expect(priere!.category).toBe('TEXTE_FONDAMENTAL');
    expect(priere!.stageCode).toBeNull();
    expect(priere!.notes.some((n) => n.note.includes(PRIERE_ROUTE_ORIGINAL))).toBe(true);
    expect(priere!.notes.some((n) => n.kind === 'A_VERIFIER')).toBe(true);
    expect(textOf(priere!.lessons[0]!.content)).toContain(
      'Rendez-nous frères, nous qui faisons route, pour ensemble vous trouver.',
    );
    // Les modules citent la prière sans la recopier.
    expect(ROUTE_MODULES[0]!.textLinks).toEqual([PRIERE_ROUTE_KEY]);
    for (const module of ROUTE_MODULES) {
      expect(canonicalJson(module.lessons)).not.toContain('gardez notre cœur pur');
    }
  });

  it('signale les exemples de projets comme propositions éditoriales', () => {
    const m10 = ROUTE_MODULES.find((m) => m.key === 'NT-ROUTE-M10')!;
    for (const lesson of m10.lessons) {
      expect(textOf(lesson.content)).toContain('Exemples de projets (proposition éditoriale)');
    }
  });

  it('n’altère pas l’empreinte des imports antérieurs (champ textLinks absent)', () => {
    for (const module of SCOUTISME_BASE_MODULES) {
      expect(canonicalJson(snapshotOf(module))).not.toContain('textLinks');
    }
  });
});

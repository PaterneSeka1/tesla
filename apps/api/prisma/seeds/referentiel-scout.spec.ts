import {
  ceremonyRoles,
  documentPlainText,
  hasDialogue,
  lessonDocumentSchema,
  parseCeremony,
  preparationPoints,
} from '@tesla/shared';
import { DEFAULT_CATEGORIES, DEFAULT_PLACEMENTS } from './reference-catalog.js';
import {
  CEREMONIAL,
  CEREMONY_LESSONS,
  PRIERE_SCOUTE,
  REFERENCE_SOURCES,
} from './referentiel-scout.seed.js';
import { assertValidSource } from './source-modules.js';

const lessonText = (index: number) => documentPlainText(CEREMONY_LESSONS[index]!.content);

describe('Seed « Référentiel scout » (D220)', () => {
  it('importe des sources valides, sans publication, comme textes fondamentaux', () => {
    for (const source of REFERENCE_SOURCES) {
      expect(() => assertValidSource(source)).not.toThrow();
      expect(source.category).toBe('TEXTE_FONDAMENTAL');
      for (const lesson of source.lessons) {
        expect(lessonDocumentSchema.safeParse(lesson.content).success).toBe(true);
      }
    }
  });

  it('transcrit les neuf cérémonies, une fiche chacune, dans l’ordre du document', () => {
    expect(CEREMONIAL.lessons.map((lesson) => lesson.title)).toEqual([
      'La cérémonie d’accueil',
      'La cérémonie de l’engagement routier',
      'La cérémonie du départ routier',
      'Cérémonie de remise des flots gris',
      'Cérémonie de remise des flots marrons',
      'Cérémonie de remise des flots routiers',
      'Cérémonie de remise de l’étoile marron',
      'Cérémonie de remise de l’étoile blanche',
      'Cérémonie de remise de l’étoile dorée',
    ]);
    // Références documentaires de chaque fiche (pages de la Boussole).
    expect(lessonText(0)).toContain('pp. 56–57');
    expect(lessonText(5)).toContain('pp. 68–69');
    expect(lessonText(8)).toContain('page suivant la p. 69');
  });

  it('structure les dialogues : six cérémonies dialoguées, rôles tirés du texte', () => {
    const dialogued = CEREMONY_LESSONS.map((lesson) => hasDialogue(lesson.content));
    expect(dialogued).toEqual([true, true, true, true, true, true, false, false, false]);
    expect(ceremonyRoles(parseCeremony(CEREMONY_LESSONS[0].content))).toEqual(['CC', 'Routiers']);
    expect(ceremonyRoles(parseCeremony(CEREMONY_LESSONS[2].content))).toEqual([
      'Compagnon Routier',
      'CC',
      'Aumônier',
    ]);
    expect(ceremonyRoles(parseCeremony(CEREMONY_LESSONS[3].content))).toEqual([
      'Délégué',
      'Coordinateur',
      'Communauté',
      'Routier récipiendaire',
    ]);
  });

  it('conserve les points sensibles du cérémonial sans les reformuler', () => {
    expect(lessonText(0)).toContain('le foulard de la route');
    expect(lessonText(1)).toContain(
      'Moi (il se nomme) je m’engage à servir de mon mieux Dieu, l’Église et ma patrie ;',
    );
    expect(lessonText(1)).toContain('porte Enseigne');
    expect(lessonText(2)).toContain('Renouvelle maintenant ton Serment');
    expect(lessonText(2)).toContain('Le parrain lui donne alors l’accolade');
    expect(lessonText(3)).toContain('symbole d’humilité');
    expect(lessonText(4)).toContain('symbole de charité et d’humanisme');
    expect(lessonText(5)).toContain('caractérisés par les couleurs des quatre branches');
    for (const index of [6, 7, 8]) {
      expect(lessonText(index)).toContain('(Marron – Blanc – Dorée)');
    }
    // Formulations du document conservées telles quelles.
    expect(lessonText(2)).toContain('Soit prudent comme le serpent');
    expect(lessonText(5)).toContain('un monde un peu plus meilleur');
  });

  it('garde la divergence de la page 8 et la signale à l’encadrement', () => {
    expect(lessonText(5)).toContain('la fin de l’étape d’apprentissage');
    expect(lessonText(5)).toContain('son étape de compagnonnage');
    const divergence = CEREMONIAL.notes.find((note) => note.lessonPosition === 5);
    expect(divergence?.kind).toBe('A_VERIFIER');
    expect(divergence?.note).toMatch(/apprentissage.*compagnonnage/);
  });

  it('ne crée aucune rubrique de préparation absente du document', () => {
    const points = CEREMONY_LESSONS.map(
      (lesson) => preparationPoints(parseCeremony(lesson.content)).length,
    );
    expect(points.slice(0, 6).every((count) => count > 0)).toBe(true);
    expect(points.slice(6)).toEqual([0, 0, 0]);
  });

  it('reproduit la Prière scoute mot pour mot', () => {
    expect(documentPlainText(PRIERE_SCOUTE.lessons[0]!.content).split('\n')).toEqual([
      'Seigneur Jésus, apprenez-nous :',
      'À être généreux,',
      'À vous servir comme vous le méritez,',
      'À donner sans compter,',
      'À combattre sans souci des blessures,',
      'À travailler sans chercher le repos,',
      "À nous dépenser, sans attendre d'autre récompense,",
      'Que celle de savoir que nous faisons votre sainte volonté.',
    ]);
  });

  it('ne prépare ni rubrique ni contenu pour les ressources non fournies', () => {
    expect(DEFAULT_CATEGORIES.map((category) => category.slug)).toEqual([
      'ceremonies',
      'prieres',
      'textes-de-reference',
    ]);
    const modules = DEFAULT_PLACEMENTS.map((placement) => placement.module);
    expect(modules.some((slug) => /charte|chant|legende/.test(slug))).toBe(false);
    expect(REFERENCE_SOURCES.map((source) => source.slug)).toEqual([
      'ceremonial-de-la-route',
      'priere-scoute',
    ]);
  });
});

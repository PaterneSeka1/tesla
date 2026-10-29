/**
 * Catalogue éditorial initial « Découvrir la Route » (D104) : structures de modules transversaux en
 * BROUILLON, sans contenu inventé. Chaque module porte une leçon vide « À rédiger » : sa soumission
 * est refusée tant qu'un rédacteur ne l'a pas rédigée d'après une source vérifiée. Ces intitulés sont
 * une proposition éditoriale, pas une validation officielle (aucune source officielle n'est citée,
 * donc `officialSource` reste nul : contenu non homologué).
 *
 * Les intitulés 1 à 3 du catalogue sont déjà couverts par des modules importés (pas de doublon) :
 * 1 « Présentation générale » et 2 « Histoire » → NT-SCOUT-M01 ; 3 « Loi, promesse et valeurs » → NT-SCOUT-M02.
 */
import { createHash } from 'node:crypto';
import { type LessonDocument, type SourceEditorialNote } from '@tesla/shared';
import { type SourceModule } from './source-modules.js';

interface CatalogEntry {
  number: number;
  slug: string;
  title: string;
}

interface CatalogSection {
  letter: 'A' | 'B' | 'C' | 'D';
  theme: string;
  entries: CatalogEntry[];
}

/** Intitulés du catalogue initial (mission de refonte, 2026-10-29), hors ceux déjà couverts. */
export const DISCOVERY_CATALOG: readonly CatalogSection[] = [
  {
    letter: 'A',
    theme: 'Découvrir le scoutisme',
    entries: [
      { number: 4, slug: 'symboles-et-identite-scoute', title: 'Symboles et identité scoute' },
      {
        number: 5,
        slug: 'organisation-du-scoutisme-en-cote-d-ivoire',
        title: 'Organisation du scoutisme en Côte d’Ivoire',
      },
    ],
  },
  {
    letter: 'B',
    theme: 'Découvrir la branche Route',
    entries: [
      {
        number: 6,
        slug: 'presentation-de-la-branche-route',
        title: 'Présentation de la branche Route',
      },
      {
        number: 7,
        slug: 'identite-et-spiritualite-du-routier',
        title: 'Identité et spiritualité du Routier',
      },
      {
        number: 8,
        slug: 'vie-communautaire-et-fraternite',
        title: 'Vie communautaire et fraternité',
      },
      {
        number: 9,
        slug: 'organisation-d-une-communaute-route',
        title: 'Organisation d’une communauté Route',
      },
      { number: 10, slug: 'fonctionnement-des-equipes', title: 'Fonctionnement des équipes' },
      {
        number: 11,
        slug: 'responsabilites-et-esprit-de-service',
        title: 'Responsabilités et esprit de service',
      },
    ],
  },
  {
    letter: 'C',
    theme: 'Découvrir sa communauté',
    entries: [
      {
        number: 12,
        slug: 'presentation-de-la-communaute-nikola-tesla',
        title: 'Présentation de la communauté Nikola Tesla',
      },
      {
        number: 13,
        slug: 'organisation-et-responsables-de-la-communaute',
        title: 'Organisation et responsables de la communauté',
      },
      {
        number: 14,
        slug: 'fonctionnement-des-activites-et-formations',
        title: 'Fonctionnement des activités et formations',
      },
      {
        number: 15,
        slug: 'vie-en-equipe-et-participation-communautaire',
        title: 'Vie en équipe et participation communautaire',
      },
    ],
  },
  {
    letter: 'D',
    theme: 'Comprendre sa progression',
    entries: [
      {
        number: 16,
        slug: 'presentation-des-etapes-de-progression-route',
        title: 'Présentation des étapes de progression Route',
      },
      { number: 17, slug: 'comprendre-le-noviciat', title: 'Comprendre le Noviciat' },
      { number: 18, slug: 'comprendre-l-apprentissage', title: 'Comprendre l’Apprentissage' },
      { number: 19, slug: 'comprendre-le-compagnonnage', title: 'Comprendre le Compagnonnage' },
      { number: 20, slug: 'presentation-des-flots', title: 'Présentation des flots' },
      {
        number: 21,
        slug: 'presentation-des-ceremonies-et-engagements',
        title: 'Présentation des cérémonies et engagements',
      },
      { number: 22, slug: 'comprendre-le-depart-routier', title: 'Comprendre le Départ routier' },
      {
        number: 23,
        slug: 'fonctionnement-des-evaluations-pedagogiques',
        title: 'Fonctionnement des évaluations pédagogiques',
      },
      {
        number: 24,
        slug: 'comprendre-le-rattrapage-des-modules',
        title: 'Comprendre le rattrapage des modules',
      },
    ],
  },
];

const SOURCE_DOCUMENT = 'Catalogue éditorial initial « Découvrir la Route » (refonte 2026-10-29)';

/** Empreinte de la liste des intitulés : signale toute modification ultérieure du catalogue. */
const CATALOG_SHA256 = createHash('sha256')
  .update(
    DISCOVERY_CATALOG.flatMap((section) =>
      section.entries.map((entry) => `${section.letter}${entry.number} ${entry.title}`),
    ).join('\n'),
  )
  .digest('hex');

const EMPTY: LessonDocument = { type: 'doc', content: [] };

const notes = (title: string): SourceEditorialNote[] => [
  {
    kind: 'A_COMPLETER',
    lessonPosition: 0,
    note: `Contenu à rédiger d’après une source vérifiée (manuel SAPF-Route, documents du mouvement ou de la communauté). Aucun texte n’a été généré pour « ${title} ».`,
  },
  {
    kind: 'INFORMATION',
    lessonPosition: null,
    note: 'Module transversal de découverte, consultable par tous une fois publié. Intitulé issu du catalogue éditorial initial : ni obligatoire, ni rattaché à une étape, sans valeur officielle tant qu’aucune source n’est citée.',
  },
];

export const DISCOVERY_MODULES: SourceModule[] = DISCOVERY_CATALOG.flatMap((section) =>
  section.entries.map((entry): SourceModule => ({
    key: `NT-DEC-${section.letter}${String(entry.number).padStart(2, '0')}`,
    slug: `nt-dec-${entry.slug}`,
    title: entry.title,
    summary: '',
    objectives: [],
    stageCode: null,
    theme: section.theme,
    category: 'TRANSVERSAL',
    sourceDocument: SOURCE_DOCUMENT,
    sourceSha256: CATALOG_SHA256,
    sourcePages: `intitulé n° ${entry.number}`,
    lessons: [{ title: 'À rédiger', content: EMPTY }],
    notes: notes(entry.title),
  })),
);

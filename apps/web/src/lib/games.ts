import { type DueReview, type PracticeBank, type PracticeKind, stableShuffle } from '@tesla/shared';

/**
 * Registre des modes de jeu (D198). Un mode choisit, de façon déterministe, des activités de la
 * banque d'entraînement publiée ; il n'a jamais de contenu propre ni de corrigé officiel. Ajouter
 * un mode = une entrée ici (et, si besoin, un composant de jeu).
 */
export type GameKey =
  | 'revisions'
  | 'express'
  | 'vrai-faux'
  | 'cartes'
  | 'ascension'
  | 'associations'
  | 'memoire'
  | 'frises'
  | 'textes'
  | 'situations';

export type GameGroup = 'reviser' | 'memoire' | 'defi';

export const GAME_GROUPS: Record<GameGroup, string> = {
  reviser: 'Réviser rapidement',
  memoire: 'Tester sa mémoire',
  defi: 'Relever un défi',
};

export interface GameMode {
  key: GameKey;
  title: string;
  /** Une ligne : ce que l'on fait (pas de règle détaillée avant de jouer). */
  tagline: string;
  group: GameGroup | null;
  /** Rendu : enchaînement d'activités, jeu à paliers, ou cartes à retourner. */
  engine: 'sequence' | 'ascension' | 'memory';
  kinds: readonly PracticeKind[];
  /** Nombre d'activités (séquence) ou de questions (paliers) d'une partie. */
  size: number;
  /** Estimation indicative, jamais un chronomètre. */
  minutes: number;
  /** Règles affichées à la première partie ou sur demande. */
  rules?: string;
}

export const GAME_MODES: readonly GameMode[] = [
  {
    key: 'revisions',
    title: 'Retour sur les traces',
    tagline: 'Les notions à revoir aujourd’hui.',
    group: null,
    engine: 'sequence',
    kinds: ['quiz', 'truefalse', 'match', 'order', 'flashcards', 'cloze'],
    size: 5,
    minutes: 5,
  },
  {
    key: 'express',
    title: 'Défi express',
    tagline: 'Quelques questions variées, sans pression.',
    group: 'reviser',
    engine: 'sequence',
    kinds: ['quiz', 'truefalse', 'flashcards'],
    size: 3,
    minutes: 2,
  },
  {
    key: 'vrai-faux',
    title: 'Vrai ou faux',
    tagline: 'Une affirmation, deux réponses.',
    group: 'reviser',
    engine: 'sequence',
    kinds: ['truefalse'],
    size: 3,
    minutes: 2,
  },
  {
    key: 'cartes',
    title: 'Cartes de mémorisation',
    tagline: 'Se poser la question, retourner la carte.',
    group: 'reviser',
    engine: 'sequence',
    kinds: ['flashcards'],
    size: 3,
    minutes: 5,
  },
  {
    key: 'memoire',
    title: 'Jeu de mémoire',
    tagline: 'Retrouver les paires de cartes.',
    group: 'memoire',
    engine: 'memory',
    kinds: ['match'],
    size: 6,
    minutes: 5,
    rules:
      'Retournez deux cartes : si elles vont ensemble, elles restent visibles. Retrouvez toutes les paires, à votre rythme.',
  },
  {
    key: 'textes',
    title: 'Texte à compléter',
    tagline: 'Retrouver les mots d’un texte.',
    group: 'memoire',
    engine: 'sequence',
    kinds: ['cloze'],
    size: 1,
    minutes: 5,
  },
  {
    key: 'frises',
    title: 'Remise en ordre',
    tagline: 'Replacer les étapes et les dates.',
    group: 'memoire',
    engine: 'sequence',
    kinds: ['order'],
    size: 2,
    minutes: 5,
  },
  {
    key: 'ascension',
    title: 'L’Ascension',
    tagline: 'Monter palier par palier, avec trois jokers.',
    group: 'defi',
    engine: 'ascension',
    kinds: ['quiz'],
    size: 10,
    minutes: 10,
    rules:
      'Une question par palier, de plus en plus loin. Trois jokers par partie : retirer deux propositions, obtenir un indice, passer la question. Une erreur arrête l’ascension ; vous gardez le palier atteint et pouvez recommencer aussitôt. C’est un entraînement : aucun résultat officiel.',
  },
  {
    key: 'associations',
    title: 'Associations',
    tagline: 'Relier chaque élément à sa correspondance.',
    group: 'defi',
    engine: 'sequence',
    kinds: ['match'],
    size: 2,
    minutes: 5,
  },
  {
    key: 'situations',
    title: 'Mises en situation',
    tagline: 'Que feriez-vous à sa place ?',
    group: 'defi',
    engine: 'sequence',
    kinds: ['scenario'],
    size: 1,
    minutes: 5,
  },
];

export function gameMode(key: string): GameMode | undefined {
  return GAME_MODES.find((mode) => mode.key === key);
}

export interface BankEntry {
  moduleSlug: string;
  moduleTitle: string;
  key: string;
  lessonId: string;
  lessonTitle: string;
  reverent?: boolean;
  activity: PracticeBank['modules'][number]['activities'][number]['activity'];
}

/** Banque à plat, limitée à un module si demandé. */
export function flattenBank(bank: PracticeBank, moduleSlug?: string | null): BankEntry[] {
  return bank.modules
    .filter((module) => !moduleSlug || module.slug === moduleSlug)
    .flatMap((module) =>
      module.activities.map((entry) => ({
        moduleSlug: module.slug,
        moduleTitle: module.title,
        key: entry.key,
        lessonId: entry.lessonId,
        lessonTitle: entry.lessonTitle,
        reverent: entry.reverent,
        activity: entry.activity,
      })),
    );
}

export const entryId = (entry: { moduleSlug: string; key: string }) =>
  `${entry.moduleSlug}:${entry.key}`;

/** Activités compatibles avec un mode (jamais un type incompatible). */
export function compatible(mode: GameMode, entries: readonly BankEntry[]): BankEntry[] {
  return entries.filter(
    (entry) =>
      mode.kinds.includes(entry.activity.kind) &&
      // Le jeu de mémoire exige au moins trois paires courtes.
      (mode.engine !== 'memory' ||
        (entry.activity.kind === 'match' &&
          entry.activity.pairs.length >= 3 &&
          entry.activity.pairs.every((pair) => pair.left.length <= 60 && pair.right.length <= 80))),
  );
}

/**
 * Sélection déterministe d'une partie : d'abord les activités à revoir (échéance), puis celles
 * jamais pratiquées, puis les autres ; l'ordre varie d'un jour à l'autre (graine = date), jamais
 * au hasard pur. Révisions : uniquement les activités échues.
 */
export function pickSession(
  mode: GameMode,
  entries: readonly BankEntry[],
  context: { due: readonly DueReview[]; practiced: ReadonlySet<string>; seed: string },
): BankEntry[] {
  const pool = compatible(mode, entries);
  const dueIds = new Set(context.due.map((row) => `${row.moduleSlug}:${row.activityKey}`));
  if (mode.key === 'revisions')
    return pool.filter((entry) => dueIds.has(entryId(entry))).slice(0, mode.size);
  const rank = (entry: BankEntry) =>
    dueIds.has(entryId(entry)) ? 0 : context.practiced.has(entryId(entry)) ? 2 : 1;
  const shuffled = stableShuffle(pool, `${mode.key}:${context.seed}`);
  return [...shuffled].sort((a, b) => rank(a) - rank(b)).slice(0, mode.size);
}

/** Questions de L'Ascension : toutes les questions à choix compatibles, ordre stable du jour. */
export function ascensionQuestions(entries: readonly BankEntry[], seed: string, size = 10) {
  const questions = entries.flatMap((entry) =>
    entry.activity.kind === 'quiz'
      ? entry.activity.items.map((item, index) => ({ ...item, id: `${entryId(entry)}:${index}` }))
      : [],
  );
  return stableShuffle(questions, `ascension:${seed}`).slice(0, size);
}

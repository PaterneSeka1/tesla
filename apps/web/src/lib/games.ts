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
  fingerprint: string;
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
        fingerprint: entry.fingerprint,
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

/** Contexte de sélection d'une partie (carnet du compte et historique local des parties). */
export interface SelectionContext {
  due: readonly DueReview[];
  practiced: ReadonlySet<string>;
  /** Activités réussies sans erreur (jamais prioritaires). */
  mastered?: ReadonlySet<string>;
  /** Activités jouées lors des dernières parties (évite de rejouer exactement la même chose). */
  recent?: ReadonlySet<string>;
  /** Graine propre à la partie : stable pendant la partie, différente d'une partie à l'autre. */
  seed: string;
}

const difficultyOf = (entry: BankEntry) => entry.activity.difficulty ?? 2;

/** Révisions échues qui existent encore dans la banque publiée (les autres ne bloquent rien). */
export function dueInBank(entries: readonly BankEntry[], due: readonly DueReview[]): DueReview[] {
  const ids = new Set(entries.map(entryId));
  return due.filter((row) => ids.has(`${row.moduleSlug}:${row.activityKey}`));
}

/**
 * Priorité d'une activité (plus petit = plus utile) : à revoir, jamais pratiquée, pratiquée sans
 * être maîtrisée, maîtrisée ; une activité vue lors des dernières parties passe après ses pareilles.
 */
function priority(entry: BankEntry, context: SelectionContext, dueIds: ReadonlySet<string>) {
  const id = entryId(entry);
  const base = dueIds.has(id)
    ? 0
    : !context.practiced.has(id)
      ? 1
      : context.mastered?.has(id)
        ? 3
        : 2;
  return base * 2 + (context.recent?.has(id) ? 1 : 0);
}

/**
 * Sélection déterministe d'une partie : priorité pédagogique, puis variété (une leçon différente
 * à chaque activité tant que possible), puis difficulté croissante. Révisions : uniquement les
 * activités échues encore publiées. La sélection est enregistrée avec la partie.
 */
export function pickSession(
  mode: GameMode,
  entries: readonly BankEntry[],
  context: SelectionContext,
): BankEntry[] {
  const pool = compatible(mode, entries);
  const dueIds = new Set(context.due.map((row) => `${row.moduleSlug}:${row.activityKey}`));
  if (mode.key === 'revisions')
    return pool.filter((entry) => dueIds.has(entryId(entry))).slice(0, mode.size);
  const ranked = stableShuffle(pool, `${mode.key}:${context.seed}`).sort(
    (a, b) => priority(a, context, dueIds) - priority(b, context, dueIds),
  );
  const chosen: BankEntry[] = [];
  const lessons = new Set<string>();
  for (const entry of ranked) {
    if (chosen.length >= mode.size) break;
    if (lessons.has(entry.lessonId)) continue;
    lessons.add(entry.lessonId);
    chosen.push(entry);
  }
  for (const entry of ranked) {
    if (chosen.length >= mode.size) break;
    if (!chosen.includes(entry)) chosen.push(entry);
  }
  return chosen
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => difficultyOf(a.entry) - difficultyOf(b.entry) || a.index - b.index)
    .map(({ entry }) => entry);
}

export interface AscensionQuestion {
  /** `module:activité:rang` : identité stable de la question. */
  id: string;
  moduleSlug: string;
  activityKey: string;
  fingerprint: string;
  item: number;
  lessonId: string;
  lessonTitle: string;
  prompt: string;
  options: string[];
  answer: number;
  hint?: string;
  explanation?: string;
  difficulty: number;
}

/** Il faut au moins trois paliers et une question de réserve. */
export const ASCENSION_MIN_QUESTIONS = 4;

export function allAscensionQuestions(entries: readonly BankEntry[]): AscensionQuestion[] {
  return entries.flatMap((entry) =>
    entry.activity.kind === 'quiz'
      ? entry.activity.items.map((item, index) => ({
          id: `${entryId(entry)}:${index}`,
          moduleSlug: entry.moduleSlug,
          activityKey: entry.key,
          fingerprint: entry.fingerprint,
          item: index,
          lessonId: entry.lessonId,
          lessonTitle: entry.lessonTitle,
          prompt: item.prompt,
          options: item.options,
          answer: item.answer,
          hint: item.hint,
          explanation: item.explanation,
          difficulty: difficultyOf(entry),
        }))
      : [],
  );
}

/**
 * Questions d'une ascension : d'abord les notions à revoir et les questions nouvelles, en variant
 * les leçons, puis rangées par difficulté croissante (la dernière sert de réserve au joker).
 */
export function ascensionQuestions(
  entries: readonly BankEntry[],
  context: SelectionContext,
  count: number,
): AscensionQuestion[] {
  const dueIds = new Set(context.due.map((row) => `${row.moduleSlug}:${row.activityKey}`));
  const byEntry = new Map(entries.map((entry) => [entryId(entry), entry]));
  const rank = (question: AscensionQuestion) =>
    priority(byEntry.get(`${question.moduleSlug}:${question.activityKey}`)!, context, dueIds);
  const ranked = stableShuffle(allAscensionQuestions(entries), `ascension:${context.seed}`).sort(
    (a, b) => rank(a) - rank(b),
  );
  const chosen: AscensionQuestion[] = [];
  const lessons = new Set<string>();
  for (const question of ranked) {
    if (chosen.length >= count) break;
    if (lessons.has(question.lessonId)) continue;
    lessons.add(question.lessonId);
    chosen.push(question);
  }
  for (const question of ranked) {
    if (chosen.length >= count) break;
    if (!chosen.includes(question)) chosen.push(question);
  }
  const reserve = chosen.length > ASCENSION_MIN_QUESTIONS - 1 ? chosen.pop()! : null;
  chosen.sort((a, b) => a.difficulty - b.difficulty);
  return reserve ? [...chosen, reserve] : chosen;
}

/**
 * Un jeu est-il réellement jouable avec ce contenu ? Seule source de vérité pour l'accueil, la
 * salle des défis et les modules : aucun jeu vide, aucun bouton inutile.
 */
export function isPlayable(
  mode: GameMode,
  entries: readonly BankEntry[],
  due: readonly DueReview[] = [],
): boolean {
  if (mode.key === 'revisions')
    return pickSession(mode, entries, { due, practiced: new Set(), seed: '' }).length > 0;
  const pool = compatible(mode, entries);
  if (mode.engine === 'ascension')
    return allAscensionQuestions(pool).length >= ASCENSION_MIN_QUESTIONS;
  return pool.length > 0;
}

export function playableModes(
  entries: readonly BankEntry[],
  due: readonly DueReview[] = [],
): GameMode[] {
  return GAME_MODES.filter((mode) => isPlayable(mode, entries, due));
}

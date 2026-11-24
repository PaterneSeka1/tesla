import { z } from 'zod';

/**
 * Entraînement libre (D194). Une **activité** est un bloc d'une leçon (nœud `practice`) : elle suit
 * donc le circuit de publication des modules (rédaction, approbation, version figée). Ses réponses
 * sont des réponses d'entraînement, publiques pour qui lit la leçon : elles ne proviennent jamais
 * d'un questionnaire officiel et n'ont aucune valeur de résultat, d'acquis ni d'étape.
 */

export const PRACTICE_KINDS = [
  'quiz',
  'truefalse',
  'match',
  'order',
  'flashcards',
  'cloze',
  'scenario',
] as const;
export type PracticeKind = (typeof PRACTICE_KINDS)[number];

export const PRACTICE_KIND_LABELS: Record<PracticeKind, string> = {
  quiz: 'Questions à choix',
  truefalse: 'Vrai ou faux',
  match: 'Associations',
  order: 'Remise en ordre',
  flashcards: 'Cartes de mémorisation',
  cloze: 'Texte à compléter',
  scenario: 'Mise en situation',
};

const text = (max: number) => z.string().trim().min(1, 'Champ obligatoire.').max(max);
/** Champ facultatif (une chaîne vide vaut absence, côté affichage). */
const optionalText = (max: number) => z.string().trim().max(max).optional();

/** Identifiant stable d'une activité dans le module (clé de révision et de récompense). */
const activityId = z.string().regex(/^[a-z0-9-]{6,40}$/, 'Identifiant d’activité invalide.');

/** Difficulté éditoriale facultative (1 accessible, 2 intermédiaire, 3 exigeante). */
export const PRACTICE_DIFFICULTIES = [1, 2, 3] as const;
export const PRACTICE_DIFFICULTY_LABELS: Record<1 | 2 | 3, string> = {
  1: 'Accessible',
  2: 'Intermédiaire',
  3: 'Exigeante',
};
const practiceDifficulty = z.number().int().min(1).max(3).optional();

const quizItem = z
  .object({
    prompt: text(400),
    options: z.array(text(200)).min(2).max(6),
    answer: z.number().int().min(0),
    /** Indice facultatif, proposé seulement en entraînement. */
    hint: optionalText(300),
    explanation: optionalText(600),
  })
  .refine((item) => item.answer < item.options.length, {
    message: 'La bonne réponse doit faire partie des propositions.',
  });

/** Marqueur de mot à compléter : `[[mot]]` (un ou plusieurs mots, sans crochet). */
export const CLOZE_BLANK = /\[\[([^[\]]{1,60})\]\]/g;

export const practiceActivitySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('quiz'),
    id: activityId,
    title: optionalText(120),
    difficulty: practiceDifficulty,
    items: z.array(quizItem).min(1).max(30),
  }),
  z.object({
    kind: z.literal('truefalse'),
    id: activityId,
    title: optionalText(120),
    difficulty: practiceDifficulty,
    items: z
      .array(
        z.object({ statement: text(400), answer: z.boolean(), explanation: optionalText(600) }),
      )
      .min(1)
      .max(30),
  }),
  z.object({
    kind: z.literal('match'),
    id: activityId,
    title: optionalText(120),
    difficulty: practiceDifficulty,
    pairs: z
      .array(z.object({ left: text(160), right: text(200) }))
      .min(2)
      .max(10),
  }),
  z.object({
    kind: z.literal('order'),
    id: activityId,
    title: optionalText(120),
    difficulty: practiceDifficulty,
    /** Étapes dans le bon ordre ; `marker` facultatif (date, numéro) affiché après correction. */
    steps: z
      .array(z.object({ label: text(200), marker: optionalText(40) }))
      .min(3)
      .max(10),
  }),
  z.object({
    kind: z.literal('flashcards'),
    id: activityId,
    title: optionalText(120),
    difficulty: practiceDifficulty,
    cards: z
      .array(z.object({ front: text(300), back: text(600) }))
      .min(1)
      .max(40),
  }),
  z.object({
    kind: z.literal('cloze'),
    id: activityId,
    title: optionalText(120),
    difficulty: practiceDifficulty,
    /** Texte où chaque mot à retrouver est noté `[[mot]]`. */
    text: text(3000).refine((value) => (value.match(CLOZE_BLANK) ?? []).length >= 1, {
      message: 'Marquez au moins un mot à compléter avec [[ ]].',
    }),
  }),
  z.object({
    kind: z.literal('scenario'),
    id: activityId,
    title: optionalText(120),
    difficulty: practiceDifficulty,
    situation: text(1200),
    /** Plusieurs choix peuvent être raisonnables : chacun reçoit un éclairage, jamais une note. */
    choices: z
      .array(z.object({ label: text(240), insight: text(800) }))
      .min(2)
      .max(5),
  }),
]);

export type PracticeActivity = z.infer<typeof practiceActivitySchema>;

export function newPracticeId(): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return random
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()
    .slice(0, 16);
}

/** Modèle vide pour l'éditeur (champs simples, aucun paramètre avancé). */
export function emptyPracticeActivity(kind: PracticeKind): PracticeActivity {
  const id = newPracticeId();
  switch (kind) {
    case 'quiz':
      return { kind, id, items: [{ prompt: '', options: ['', ''], answer: 0 }] };
    case 'truefalse':
      return { kind, id, items: [{ statement: '', answer: true }] };
    case 'match':
      return {
        kind,
        id,
        pairs: [
          { left: '', right: '' },
          { left: '', right: '' },
        ],
      };
    case 'order':
      return { kind, id, steps: [{ label: '' }, { label: '' }, { label: '' }] };
    case 'flashcards':
      return { kind, id, cards: [{ front: '', back: '' }] };
    case 'cloze':
      return { kind, id, text: '' };
    case 'scenario':
      return {
        kind,
        id,
        situation: '',
        choices: [
          { label: '', insight: '' },
          { label: '', insight: '' },
        ],
      };
  }
}

/** Mots à compléter d'un texte `[[…]]`, dans l'ordre. */
export function clozeBlanks(value: string): string[] {
  return [...value.matchAll(CLOZE_BLANK)].map((match) => match[1]!.trim());
}

/** Texte sans marqueurs (lecture intégrale, impression). */
export function clozePlainText(value: string): string {
  return value.replace(CLOZE_BLANK, (_, word: string) => word);
}

/** Comparaison tolérante : casse, accents et ponctuation finale ignorés. */
export function sameWord(a: string, b: string): boolean {
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[’']/g, "'")
      .replace(/[.,;:!?«»"]/g, '')
      .trim()
      .toLocaleLowerCase('fr');
  return normalize(a) === normalize(b);
}

/**
 * Réponses d'entraînement (une par élément) : index d'option (quiz), booléen (vrai/faux),
 * permutation (associations : index de droite choisi pour chaque gauche ; ordre : index d'origine
 * dans l'ordre proposé), textes (texte à compléter), auto-évaluation 0/1 (cartes). Mise en
 * situation : aucune note.
 */
export const practiceAnswersSchema = z
  .array(z.union([z.number().int().min(-1).max(100), z.boolean(), z.string().max(120)]))
  .max(60);

export type PracticeAnswers = z.infer<typeof practiceAnswersSchema>;

/** Nombre d'éléments notés d'une activité (0 pour une mise en situation). */
export function practiceItemCount(activity: PracticeActivity): number {
  switch (activity.kind) {
    case 'quiz':
    case 'truefalse':
      return activity.items.length;
    case 'match':
      return activity.pairs.length;
    case 'order':
      return activity.steps.length;
    case 'flashcards':
      return activity.cards.length;
    case 'cloze':
      return clozeBlanks(activity.text).length;
    case 'scenario':
      return 0;
  }
}

/**
 * Correction déterministe d'une activité d'entraînement, partagée par l'appareil (retour
 * immédiat) et l'API (seule autorité pour les récompenses). Renvoie un booléen par élément.
 */
export function gradePractice(activity: PracticeActivity, answers: PracticeAnswers): boolean[] {
  const at = (index: number) => answers[index];
  switch (activity.kind) {
    case 'quiz':
      return activity.items.map((item, index) => at(index) === item.answer);
    case 'truefalse':
      return activity.items.map((item, index) => at(index) === item.answer);
    case 'match':
      return activity.pairs.map((_, index) => at(index) === index);
    case 'order':
      return activity.steps.map((_, index) => at(index) === index);
    case 'flashcards':
      // Auto-évaluation : « je savais » (1) ou « à revoir » (0).
      return activity.cards.map((_, index) => at(index) === 1);
    case 'cloze': {
      const blanks = clozeBlanks(activity.text);
      return blanks.map((word, index) => {
        const answer = at(index);
        return typeof answer === 'string' && sameWord(answer, word);
      });
    }
    case 'scenario':
      return [];
  }
}

/** Maîtrise : tous les éléments notés réussis (une mise en situation est « explorée »). */
export function isMastered(activity: PracticeActivity, answers: PracticeAnswers): boolean {
  const graded = gradePractice(activity, answers);
  return graded.length === 0 ? answers.length > 0 : graded.every(Boolean);
}

/** Ordre de présentation déterministe (impression, première présentation) : rotation stable. */
export function stableShuffle<T>(items: readonly T[], seed: string): T[] {
  const indexed = items.map((item, index) => ({ item, weight: hashString(`${seed}:${index}`) }));
  indexed.sort((a, b) => a.weight - b.weight);
  return indexed.map((entry) => entry.item);
}

function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * Version imprimable d'une activité (support papier, routier sans téléphone) : l'exercice seul,
 * sans réponse ; les propositions à ordonner ou associer sont mélangées de façon stable.
 */
export function practicePrintLines(activity: PracticeActivity): { title: string; lines: string[] } {
  const title = `Entraînement — ${activity.title || PRACTICE_KIND_LABELS[activity.kind]}`;
  switch (activity.kind) {
    case 'quiz':
      return {
        title,
        lines: activity.items.flatMap((item, index) => [
          `${index + 1}. ${item.prompt}`,
          ...item.options.map((option) => `   [ ] ${option}`),
        ]),
      };
    case 'truefalse':
      return {
        title,
        lines: activity.items.map(
          (item, index) => `${index + 1}. ${item.statement}   [ ] Vrai   [ ] Faux`,
        ),
      };
    case 'match': {
      const right = stableShuffle(
        activity.pairs.map((pair) => pair.right),
        activity.id,
      );
      return {
        title,
        lines: [
          'Reliez chaque élément à sa correspondance.',
          ...activity.pairs.map(
            (pair, index) =>
              `${index + 1}. ${pair.left}   —   ${String.fromCharCode(65 + index)}. ${right[index]}`,
          ),
        ],
      };
    }
    case 'order':
      return {
        title,
        lines: [
          'Numérotez dans le bon ordre.',
          ...stableShuffle(activity.steps, activity.id).map((step) => `[ ] ${step.label}`),
        ],
      };
    case 'flashcards':
      return { title, lines: activity.cards.map((card, index) => `${index + 1}. ${card.front}`) };
    case 'cloze':
      return { title, lines: [activity.text.replace(CLOZE_BLANK, '__________')] };
    case 'scenario':
      return {
        title,
        lines: [activity.situation, ...activity.choices.map((choice) => `[ ] ${choice.label}`)],
      };
  }
}

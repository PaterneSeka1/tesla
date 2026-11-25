import { type BankEntry, entryId } from './games';

/**
 * Expédition pédagogique (D207) : parcours guidé d'un module **publié**, construit de façon
 * déterministe à partir de contenus existants (aucun contenu inventé, aucune copie du cours) :
 * 1. chaque halte, lue dans le lecteur habituel (activités rédigées comprises) ;
 * 2. après chaque halte, les exercices dérivés de son texte (frise, mémorisation, cartes) ;
 * 3. L'Ascension du module si elle est jouable ;
 * 4. une synthèse (objectifs du module) et la fin d'expédition.
 * Adaptation : un exercice déjà maîtrisé devient facultatif (court « revoir ? »), une notion à
 * revoir est proposée en priorité. Rien n'est verrouillé : chaque étape peut être passée.
 */
export type ExpeditionStep =
  | { id: string; kind: 'lesson'; lessonId: string; title: string; index: number }
  | {
      id: string;
      kind: 'practice';
      lessonId: string;
      title: string;
      entries: BankEntry[];
      /** Tout est déjà maîtrisé : étape facultative. */
      optional: boolean;
    }
  | { id: string; kind: 'ascension'; title: string }
  | { id: string; kind: 'synthesis'; title: string };

export interface ExpeditionInput {
  lessons: readonly { id: string; title: string }[];
  entries: readonly BankEntry[];
  mastered: ReadonlySet<string>;
  due: ReadonlySet<string>;
  ascension: boolean;
}

export function expeditionSteps({
  lessons,
  entries,
  mastered,
  due,
  ascension,
}: ExpeditionInput): ExpeditionStep[] {
  const steps: ExpeditionStep[] = [];
  for (const [index, lesson] of lessons.entries()) {
    steps.push({
      id: `lesson:${lesson.id}`,
      kind: 'lesson',
      lessonId: lesson.id,
      title: lesson.title,
      index,
    });
    // Les activités rédigées se jouent dans le lecteur ; ici, celles tirées du texte publié.
    const derived = entries.filter(
      (entry) => entry.lessonId === lesson.id && entry.origin === 'derived',
    );
    if (derived.length === 0) continue;
    // Notions à revoir d'abord, puis nouvelles, puis déjà maîtrisées.
    const rank = (entry: BankEntry) =>
      due.has(entryId(entry)) ? 0 : mastered.has(entryId(entry)) ? 2 : 1;
    const ordered = [...derived].sort((a, b) => rank(a) - rank(b));
    steps.push({
      id: `practice:${lesson.id}`,
      kind: 'practice',
      lessonId: lesson.id,
      title: lesson.title,
      entries: ordered,
      optional: ordered.every((entry) => rank(entry) === 2),
    });
  }
  if (ascension) steps.push({ id: 'ascension', kind: 'ascension', title: 'L’Ascension' });
  if (lessons.length > 0) steps.push({ id: 'synthesis', kind: 'synthesis', title: 'Synthèse' });
  return steps;
}

export interface ExpeditionData {
  /** Étapes franchies (identifiants stables : `lesson:<id>`, `practice:<id>`…). */
  done: string[];
  /** Exercice en cours dans une étape de pratique. */
  practiceIndex: number;
  /** Version du module au départ : une nouvelle version garde les étapes encore présentes. */
  version: number;
}

export const expeditionStart = (version: number): ExpeditionData => ({
  done: [],
  practiceIndex: 0,
  version,
});

/** Première étape non franchie (reprise), ou `null` si l'expédition est terminée. */
export function currentStep(
  steps: readonly ExpeditionStep[],
  data: ExpeditionData,
): ExpeditionStep | null {
  return steps.find((step) => !data.done.includes(step.id)) ?? null;
}

/** Étape franchie : ajoutée une seule fois, l'exercice en cours revient à zéro. */
export function completeStep(data: ExpeditionData, stepId: string): ExpeditionData {
  return data.done.includes(stepId)
    ? data
    : { ...data, done: [...data.done, stepId], practiceIndex: 0 };
}

/** Progression réelle : étapes franchies encore présentes dans le parcours actuel. */
export function expeditionProgress(steps: readonly ExpeditionStep[], data: ExpeditionData) {
  const ids = new Set(steps.map((step) => step.id));
  return { done: data.done.filter((id) => ids.has(id)).length, total: steps.length };
}

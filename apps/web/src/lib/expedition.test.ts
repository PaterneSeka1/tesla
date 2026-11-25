import { type PracticeActivity } from '@tesla/shared';
import { describe, expect, it } from 'vitest';
import {
  completeStep,
  currentStep,
  expeditionProgress,
  expeditionStart,
  expeditionSteps,
} from './expedition';
import { type BankEntry } from './games';

const activity: PracticeActivity = {
  kind: 'order',
  id: 'ordre-fictif',
  steps: [{ label: 'A' }, { label: 'B' }, { label: 'C' }],
};
const entry = (key: string, lessonId: string, origin: BankEntry['origin']): BankEntry => ({
  origin,
  moduleSlug: 'module-fictif',
  moduleTitle: 'Module fictif',
  key,
  fingerprint: `f-${key}`,
  lessonId,
  lessonTitle: `Leçon ${lessonId}`,
  activity: { ...activity, id: key },
});
const lessons = [
  { id: 'l1', title: 'Halte une' },
  { id: 'l2', title: 'Halte deux' },
];

describe('expéditions (D207)', () => {
  it('haltes, exercices dérivés de chaque halte, Ascension, synthèse : rien d’inventé', () => {
    const steps = expeditionSteps({
      lessons,
      entries: [entry('d-1', 'l1', 'derived'), entry('a-1', 'l1', 'authored')],
      mastered: new Set(),
      due: new Set(),
      ascension: true,
    });
    expect(steps.map((step) => step.id)).toEqual([
      'lesson:l1',
      'practice:l1',
      'lesson:l2',
      'ascension',
      'synthesis',
    ]);
    // Les activités rédigées restent dans le lecteur, jamais dupliquées ici.
    const practice = steps[1]!;
    expect(practice.kind === 'practice' && practice.entries.map((e) => e.key)).toEqual(['d-1']);
  });

  it('adaptation : notions à revoir d’abord, étape facultative si tout est maîtrisé', () => {
    const entries = [
      entry('d-1', 'l1', 'derived'),
      entry('d-2', 'l1', 'derived'),
      entry('d-3', 'l2', 'derived'),
    ];
    const steps = expeditionSteps({
      lessons,
      entries,
      mastered: new Set(['module-fictif:d-1', 'module-fictif:d-3']),
      due: new Set(['module-fictif:d-2']),
      ascension: false,
    });
    const first = steps.find((step) => step.id === 'practice:l1')!;
    const second = steps.find((step) => step.id === 'practice:l2')!;
    expect(first.kind === 'practice' && first.entries.map((e) => e.key)).toEqual(['d-2', 'd-1']);
    expect(first.kind === 'practice' && first.optional).toBe(false);
    expect(second.kind === 'practice' && second.optional).toBe(true);
    expect(steps.some((step) => step.kind === 'ascension')).toBe(false);
  });

  it('reprise : première étape non franchie ; une étape n’est comptée qu’une fois', () => {
    const steps = expeditionSteps({
      lessons,
      entries: [],
      mastered: new Set(),
      due: new Set(),
      ascension: false,
    });
    let data = expeditionStart(1);
    expect(currentStep(steps, data)?.id).toBe('lesson:l1');
    data = completeStep(completeStep(data, 'lesson:l1'), 'lesson:l1');
    expect(data.done).toEqual(['lesson:l1']);
    expect(currentStep(steps, data)?.id).toBe('lesson:l2');
    // Étape d'une ancienne version disparue : ignorée dans la progression.
    data = completeStep(data, 'lesson:ancienne');
    expect(expeditionProgress(steps, data)).toEqual({ done: 1, total: 3 });
    data = completeStep(completeStep(data, 'lesson:l2'), 'synthesis');
    expect(currentStep(steps, data)).toBeNull();
  });
});

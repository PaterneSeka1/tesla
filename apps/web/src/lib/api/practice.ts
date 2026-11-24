import { queryOptions } from '@tanstack/react-query';
import {
  learningJournalSchema,
  type LessonReadInput,
  practiceBankSchema,
  practiceInsightsSchema,
  type PracticeResultInput,
  practiceResultSchema,
  rewardSummarySchema,
} from '@tesla/shared';
import { apiFetch, apiSend } from './client';

// Entraînement libre (D194) et carnet (D196, D197). La banque et le carnet sont conservés sur
// l'appareil (coffre chiffré) : on peut jouer et consulter ses récompenses hors ligne. Les
// résultats sont rejoués à la reconnexion ; le serveur recorrige et ne récompense qu'une fois.

export const practiceBankQueryOptions = queryOptions({
  queryKey: ['practice', 'bank'],
  queryFn: () => apiFetch('/practice/bank', practiceBankSchema),
  staleTime: 10 * 60_000,
});

export const journalQueryOptions = queryOptions({
  queryKey: ['me', 'journal'],
  queryFn: () => apiFetch('/me/journal', learningJournalSchema),
});

export const sendPracticeResult = (input: PracticeResultInput) =>
  apiSend('POST', '/me/practice/results', practiceResultSchema, input, {
    type: 'practice.result',
    label: 'Entraînement',
    entity: { kind: 'practice', id: `${input.moduleSlug}:${input.activityKey}` },
  });

export const sendLessonRead = (input: LessonReadInput) =>
  apiSend('POST', '/me/lessons/read', rewardSummarySchema, input, {
    type: 'lesson.read',
    label: 'Leçon lue',
    entity: { kind: 'lesson', id: input.lessonId },
  });

/** Encadrement : activités les plus difficiles, agrégées (jamais nominatif). */
export const practiceInsightsQueryOptions = queryOptions({
  queryKey: ['practice', 'insights'],
  queryFn: () => apiFetch('/practice/insights', practiceInsightsSchema),
});

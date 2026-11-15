import { describe, expect, it } from 'vitest';
import { moduleReadiness } from './module-readiness';

const lesson = (id: string, content: unknown[], title = `Leçon ${id}`) => ({
  id,
  position: 0,
  title,
  durationMinutes: null,
  content: { type: 'doc' as const, content: content as never[] },
  revision: 1,
  updatedAt: '2026-11-15T00:00:00.000Z',
  updatedBy: null,
});
const text = (value: string) => ({ type: 'paragraph', content: [{ type: 'text', text: value }] });
const base = {
  summary: 'Résumé',
  objectives: ['Lire une carte'],
  stage: { id: 's', code: 'X', name: 'Étape', position: 1 } as never,
};

describe('Vérification avant soumission', () => {
  it('reprend les refus du serveur : aucune leçon, leçon vide', () => {
    expect(moduleReadiness({ ...base, lessons: [] })).toEqual([
      expect.objectContaining({ level: 'bloquant', section: 'contenu' }),
    ]);
    const items = moduleReadiness({
      ...base,
      lessons: [lesson('a', []), lesson('b', [text('ok')])],
    });
    expect(items).toEqual([
      expect.objectContaining({
        level: 'bloquant',
        lessonId: 'a',
        message: expect.stringContaining('vide'),
      }),
    ]);
  });

  it('les conseils ne bloquent jamais (description, objectifs, étape, image sans description)', () => {
    const items = moduleReadiness({
      summary: ' ',
      objectives: [],
      stage: null,
      lessons: [lesson('a', [{ type: 'image', attrs: { src: 'https://e.org/a.png', alt: '' } }])],
    });
    expect(items.every((item) => item.level === 'conseil')).toBe(true);
    expect(items).toHaveLength(4);
  });

  it('une saisie non synchronisée bloque l’envoi et pointe vers la leçon', () => {
    const items = moduleReadiness(
      { ...base, lessons: [lesson('a', [text('ok')])] },
      new Set(['a']),
    );
    expect(items).toEqual([expect.objectContaining({ level: 'bloquant', lessonId: 'a' })]);
  });
});

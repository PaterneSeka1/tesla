import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearLessonDraft,
  readLessonDraft,
  sameLessonContent,
  writeLessonDraft,
} from './lesson-drafts';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  Object.assign(globalThis, {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  });
});

const draft = (savedAt: number) => ({
  lessonId: 'l1',
  baseRevision: 3,
  title: 'Titre',
  duration: '',
  content: { type: 'doc', content: [] },
  savedAt,
});

describe('Brouillons locaux des leçons', () => {
  it('écrit, relit et retire un brouillon', () => {
    expect(writeLessonDraft(draft(10))).toBe(true);
    expect(readLessonDraft('l1')).toMatchObject({ baseRevision: 3, title: 'Titre' });
    clearLessonDraft('l1');
    expect(readLessonDraft('l1')).toBeNull();
  });

  it('ne retire pas une saisie plus récente que l’envoi confirmé', () => {
    writeLessonDraft(draft(20));
    clearLessonDraft('l1', 10);
    expect(readLessonDraft('l1')).not.toBeNull();
  });

  it('stockage plein ou indisponible : échec signalé, jamais d’exception', () => {
    Object.assign(globalThis, {
      localStorage: {
        getItem: () => {
          throw new Error('indisponible');
        },
        setItem: () => {
          throw new Error('quota');
        },
        removeItem: () => {},
      },
    });
    expect(writeLessonDraft(draft(1))).toBe(false);
    expect(readLessonDraft('l1')).toBeNull();
  });

  it('compare le contenu sans tenir compte des espaces de bord', () => {
    expect(
      sameLessonContent(
        { title: ' Titre ', duration: '', content: { a: 1 } },
        { title: 'Titre', duration: ' ', content: { a: 1 } },
      ),
    ).toBe(true);
  });
});

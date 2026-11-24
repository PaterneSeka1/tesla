import { describe, expect, it } from 'vitest';
import { homeSuggestion, type HomeInput, nextAdventure } from './home';

const base: HomeInput = {
  catchUp: null,
  lastReading: null,
  recommended: null,
  dueReviews: 0,
  hasPractice: false,
};
const reading = {
  slug: 'histoire',
  moduleTitle: 'Histoire du scoutisme',
  lessonId: 'l3',
  lessonTitle: 'Brownsea',
  position: 3,
  count: 5,
};

describe('accueil : une aventure principale (D199)', () => {
  it('reprend la leçon interrompue en une action', () => {
    const adventure = nextAdventure({ ...base, lastReading: reading });
    expect(adventure).toMatchObject({ kind: 'resume', href: '/modules/histoire/lecons/l3' });
    expect(adventure.detail).toBe('Halte 3 sur 5 · Brownsea');
  });

  it('un rattrapage à échéance passe avant la reprise ; sans alerte, après', () => {
    const catchUp = { active: true, deadline: 'PROCHE' as const, stageName: 'Noviciat' };
    expect(nextAdventure({ ...base, lastReading: reading, catchUp }).kind).toBe('catchup');
    expect(
      nextAdventure({ ...base, lastReading: reading, catchUp: { ...catchUp, deadline: null } })
        .kind,
    ).toBe('resume');
    expect(nextAdventure({ ...base, catchUp: { ...catchUp, deadline: null } }).kind).toBe(
      'catchup',
    );
  });

  it('module recommandé, sinon exploration', () => {
    expect(nextAdventure({ ...base, recommended: { slug: 'loi', title: 'Loi' } }).href).toBe(
      '/modules/loi',
    );
    expect(nextAdventure(base).kind).toBe('explore');
  });

  it('au plus une suggestion, jamais pour remplir', () => {
    expect(homeSuggestion({ ...base, dueReviews: 2, hasPractice: true })?.href).toBe(
      '/defis/revisions',
    );
    expect(homeSuggestion({ ...base, hasPractice: true })?.href).toBe('/defis/express');
    expect(homeSuggestion(base)).toBeNull();
  });
});

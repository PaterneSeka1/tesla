import { describe, expect, it } from 'vitest';
import { resumeLesson } from './reading-position';

const v2 = [
  { id: 'n1', title: 'Prière scoute' },
  { id: 'n2', title: 'Charte des routiers' },
  { id: 'n3', title: 'Prière route' },
  { id: 'n4', title: 'Prière du soir' },
];

describe('reprise de lecture (D182)', () => {
  it('retrouve la leçon par identifiant', () => {
    expect(resumeLesson(v2, { lessonId: 'n3', lessonTitle: 'autre' })?.id).toBe('n3');
  });

  it('après une nouvelle version publiée, retrouve la leçon par titre même déplacée', () => {
    expect(resumeLesson(v2, { lessonId: 'ancien', lessonTitle: 'Charte des routiers' })?.id).toBe(
      'n2',
    );
  });

  it('rien à reprendre : aucune position, ancienne position sans titre, leçon retirée', () => {
    expect(resumeLesson(v2, null)).toBeUndefined();
    expect(resumeLesson(v2, { lessonId: 'ancien' })).toBeUndefined();
    expect(resumeLesson(v2, { lessonId: 'ancien', lessonTitle: 'Leçon retirée' })).toBeUndefined();
  });
});

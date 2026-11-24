import { type LessonBlock } from '@tesla/shared';
import { describe, expect, it } from 'vitest';
import { lessonSections } from './lesson-sections';

const p = (text: string): LessonBlock => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h = (level: 2 | 3, text: string): LessonBlock => ({
  type: 'heading',
  attrs: { level },
  content: [{ type: 'text', text }],
});
const practice: LessonBlock = {
  type: 'practice',
  attrs: {
    activity: { kind: 'truefalse', id: 'tf-000001', items: [{ statement: 's', answer: true }] },
  },
};

describe('séquences du mode Découverte', () => {
  it('découpe aux intertritres et conserve tout le contenu dans l’ordre', () => {
    const blocks = [p('intro'), h(2, 'A'), p('a'), h(2, 'B'), p('b'), practice, p('b2')];
    const sections = lessonSections({ type: 'doc', content: blocks });
    expect(sections.map((s) => s.title)).toEqual([null, 'A', 'B', 'B', 'B']);
    expect(sections.flatMap((s) => s.blocks)).toEqual(blocks);
  });

  it('se replie sur les intertitres de niveau 3, puis sur une séquence unique', () => {
    expect(
      lessonSections({ type: 'doc', content: [h(3, 'X'), p('x'), h(3, 'Y'), p('y')] }),
    ).toHaveLength(2);
    expect(lessonSections({ type: 'doc', content: [p('seul')] })).toHaveLength(1);
  });

  it('rattache un intertitre sans contenu à la séquence précédente', () => {
    const sections = lessonSections({ type: 'doc', content: [h(2, 'A'), p('a'), h(2, 'Vide')] });
    expect(sections).toHaveLength(1);
  });
});

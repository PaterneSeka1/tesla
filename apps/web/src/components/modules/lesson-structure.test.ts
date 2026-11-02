import { type LessonBlock } from '@tesla/shared';
import { describe, expect, it } from 'vitest';
import { structureLesson } from './lesson-structure';

const p = (text: string): LessonBlock => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h = (text: string): LessonBlock => ({
  type: 'heading',
  attrs: { level: 3 },
  content: [{ type: 'text', text }],
});

describe('structureLesson', () => {
  it('regroupe une rubrique pédagogique et ses blocs en encadré jusqu’au titre suivant', () => {
    const { segments } = structureLesson([
      p('Introduction.'),
      h('À retenir'),
      p('Point 1.'),
      p('Point 2.'),
      h('Le rythme'),
      p('Suite.'),
    ]);
    expect(segments.map((s) => s.kind)).toEqual(['block', 'callout', 'block', 'block']);
    const callout = segments[1]!;
    expect(callout.kind === 'callout' && callout.variant).toBe('retenir');
    expect(callout.kind === 'callout' && callout.blocks).toHaveLength(2);
  });

  it('place les références documentaires en pied de leçon sans perdre de contenu', () => {
    const blocks = [p('Texte.'), h('Pour réfléchir'), p('Question ?'), p('Source : manuel, p. 3.')];
    const { segments, references } = structureLesson(blocks);
    expect(references).toEqual([blocks[3]]);
    const kept = segments.flatMap((s) => (s.kind === 'block' ? [s.block] : [s.blocks]).flat());
    expect(kept).toHaveLength(2);
  });

  it('laisse intacte une leçon sans rubrique connue', () => {
    const blocks = [h('Le fondateur'), p('Texte.')];
    expect(structureLesson(blocks).segments).toEqual(
      blocks.map((block) => ({ kind: 'block', block })),
    );
  });
});

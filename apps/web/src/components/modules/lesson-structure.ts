import { type LessonBlock, type LessonInline } from '@tesla/shared';

/** Rubriques pédagogiques rendues en encadré (titre de niveau 3 exact, insensible à la casse). */
const CALLOUTS: Record<string, CalloutVariant> = {
  objectifs: 'objectifs',
  'à retenir': 'retenir',
  'pour retenir': 'retenir',
  'pour conclure': 'retenir',
  'pour mémoriser': 'retenir',
  'pour réfléchir': 'reflexion',
  'application pratique': 'pratique',
  'exemple de répartition (à adapter)': 'pratique',
  'liste de préparation': 'pratique',
};
export type CalloutVariant = 'objectifs' | 'retenir' | 'reflexion' | 'pratique';
/** Ligne de référence documentaire en fin de leçon (« Source : … », « Référence : … »). */
const REFERENCE = /^(Source|Référence)\s?:/;

export type LessonSegment =
  | { kind: 'block'; block: LessonBlock }
  | { kind: 'callout'; variant: CalloutVariant; title: string; blocks: LessonBlock[] };

const plainText = (nodes: LessonInline[] | undefined) =>
  (nodes ?? [])
    .map((node) => (node.type === 'text' ? node.text : ' '))
    .join('')
    .trim();

/**
 * Découpe une leçon pour la lecture : une rubrique connue (« À retenir », « Pour réfléchir »…) et
 * les blocs qui la suivent jusqu'au titre suivant forment un encadré ; les références documentaires
 * sont regroupées en pied de leçon. Le contenu lui-même n'est jamais modifié.
 */
export function structureLesson(blocks: LessonBlock[]): {
  segments: LessonSegment[];
  references: LessonBlock[];
} {
  const segments: LessonSegment[] = [];
  const references: LessonBlock[] = [];
  let current: Extract<LessonSegment, { kind: 'callout' }> | null = null;
  for (const block of blocks) {
    if (block.type === 'paragraph' && REFERENCE.test(plainText(block.content))) {
      references.push(block);
      continue;
    }
    if (block.type === 'heading') {
      const title = plainText(block.content);
      const variant = CALLOUTS[title.toLocaleLowerCase('fr')];
      current = variant ? { kind: 'callout', variant, title, blocks: [] } : null;
      segments.push(current ?? { kind: 'block', block });
      continue;
    }
    if (current) current.blocks.push(block);
    else segments.push({ kind: 'block', block });
  }
  return { segments, references };
}

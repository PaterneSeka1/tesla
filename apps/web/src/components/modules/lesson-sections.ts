import { type LessonBlock, type LessonDocument, type LessonInline } from '@tesla/shared';

/** Séquence du mode « Découverte » : un intertitre et ce qui le suit, jamais un texte modifié. */
export interface LessonSection {
  title: string | null;
  blocks: LessonBlock[];
}

const plain = (nodes: LessonInline[] | undefined) =>
  (nodes ?? [])
    .map((node) => (node.type === 'text' ? node.text : ' '))
    .join('')
    .trim();

function splitAt(blocks: LessonBlock[], level: 2 | 3): LessonSection[] {
  const sections: LessonSection[] = [];
  let current: LessonSection = { title: null, blocks: [] };
  for (const block of blocks) {
    if (block.type === 'heading' && block.attrs.level === level) {
      if (current.blocks.length > 0) sections.push(current);
      current = { title: plain(block.content), blocks: [block] };
    } else current.blocks.push(block);
  }
  if (current.blocks.length > 0) sections.push(current);
  return sections;
}

/** Une séquence trop courte (un intertitre seul, une ligne) rejoint la précédente. */
function mergeShort(sections: LessonSection[]): LessonSection[] {
  const merged: LessonSection[] = [];
  for (const section of sections) {
    const previous = merged.at(-1);
    const substantive = section.blocks.filter((block) => block.type !== 'heading').length;
    if (previous && substantive === 0) previous.blocks.push(...section.blocks);
    else merged.push({ title: section.title, blocks: [...section.blocks] });
  }
  return merged;
}

/**
 * Découpe une leçon en séquences par intertitres (niveau 2, sinon niveau 3). Une activité
 * d'entraînement forme sa propre séquence, après le texte qui la précède. Le contenu intégral est
 * l'assemblage exact des séquences, dans l'ordre : rien n'est caché ni réécrit.
 */
export function lessonSections(document: LessonDocument): LessonSection[] {
  const blocks = document.content;
  let sections = mergeShort(splitAt(blocks, 2));
  if (sections.length < 2) sections = mergeShort(splitAt(blocks, 3));
  return sections.flatMap((section) => {
    const parts: LessonSection[] = [];
    let current: LessonSection = { title: section.title, blocks: [] };
    for (const block of section.blocks) {
      if (block.type === 'practice') {
        if (current.blocks.length > 0) parts.push(current);
        parts.push({ title: section.title, blocks: [block] });
        current = { title: section.title, blocks: [] };
      } else current.blocks.push(block);
    }
    if (current.blocks.length > 0) parts.push(current);
    return parts;
  });
}

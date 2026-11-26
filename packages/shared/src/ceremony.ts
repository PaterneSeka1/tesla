import { type LessonBlock, type LessonDocument, type LessonInline } from './lesson-content.js';
import { blockPlainText, searchableText } from './reference.js';

/**
 * Lecture structurée d'une cérémonie (D220), dérivée du texte d'une leçon **sans nœud nouveau**
 * (comme les blocs pédagogiques) : éditeur, impression, PDF et hors ligne restent inchangés.
 * Conventions de rédaction, identiques à la présentation du Cérémonial de la Route :
 * - réplique : paragraphe commençant par l'intervenant **en gras** suivi de « : »
 *   (« **Le CC :** À l'aise ! ») ; les paragraphes et listes qui suivent sans intervenant
 *   prolongent la réplique ;
 * - indication scénique : citation en retrait (blockquote) ;
 * - note : paragraphe commençant par « **NB :** » ;
 * - référence : paragraphe commençant par « Référence : » ;
 * - rubriques : titres (« Préparation », « Déroulé et paroles »…).
 * Rien n'est résumé ni reformulé : chaque élément garde ses nœuds d'origine.
 */

export type CeremonyItem =
  | { kind: 'section'; title: string; level: 2 | 3 }
  | {
      kind: 'line';
      /** Intervenant tel qu'écrit (« Le CC (s'adressant aux autres Routiers) »). */
      speaker: string;
      /** Rôle normalisé (« CC »), utilisé par le mode « Mon rôle ». */
      role: string;
      /** Précision entre parenthèses (« s'adressant aux autres Routiers »), ou null. */
      aside: string | null;
      /** Paroles : suite du premier paragraphe, puis paragraphes et listes de continuation. */
      blocks: LessonBlock[];
    }
  | { kind: 'direction'; blocks: LessonBlock[] }
  | { kind: 'note'; blocks: LessonBlock[] }
  | { kind: 'reference'; text: string }
  | { kind: 'text'; blocks: LessonBlock[] };

const SPEAKER_MAX_LENGTH = 90;

function isBold(inline: LessonInline | undefined): inline is LessonInline & { type: 'text' } {
  return inline?.type === 'text' && (inline.marks ?? []).some((mark) => mark.type === 'bold');
}

/** Intervenant en tête d'un paragraphe (« Le CC : »), ou null. */
function leadingSpeaker(block: LessonBlock): { label: string; rest: LessonInline[] } | null {
  if (block.type !== 'paragraph' || !block.content?.length) return null;
  // Le libellé peut occuper plusieurs fragments gras consécutifs (« CC » + « (…) : »).
  let label = '';
  let index = 0;
  while (index < block.content.length && isBold(block.content[index])) {
    label += (block.content[index] as { text: string }).text;
    index += 1;
    if (/:\s*$/.test(label)) break;
  }
  if (!/:\s*$/.test(label)) return null;
  const clean = label.replace(/\s*:\s*$/, '').trim();
  if (clean === '' || clean.length > SPEAKER_MAX_LENGTH) return null;
  const rest = block.content.slice(index);
  const first = rest[0];
  if (first?.type === 'text') {
    const trimmed = first.text.replace(/^\s+/, '');
    rest[0] = trimmed === '' ? first : { ...first, text: trimmed };
    if (trimmed === '') rest.shift();
  }
  return { label: clean, rest };
}

function isNoteLabel(label: string): boolean {
  return /^n\.?\s?b\.?$/i.test(label.trim());
}

/** « Le CC (s'adressant…) » → rôle « CC », précision « s'adressant… ». */
export function speakerRole(label: string): { role: string; aside: string | null } {
  const match = /^(.*?)\s*\((.*)\)\s*$/.exec(label.trim());
  const base = (match ? match[1]! : label).trim();
  const aside = match ? match[2]!.trim() || null : null;
  const withoutArticle = base.replace(/^(le|la|les)\s+/i, '').replace(/^l['’]\s*/i, '');
  const role = withoutArticle.charAt(0).toUpperCase() + withoutArticle.slice(1);
  return { role: role || base, aside };
}

export function parseCeremony(document: LessonDocument): CeremonyItem[] {
  const items: CeremonyItem[] = [];
  for (const block of document.content) {
    const last = items[items.length - 1];
    if (block.type === 'heading') {
      items.push({
        kind: 'section',
        title: blockPlainText(block).trim(),
        level: block.attrs.level,
      });
      continue;
    }
    if (block.type === 'blockquote') {
      // Indications consécutives regroupées (même encadré).
      if (last?.kind === 'direction') last.blocks.push(...block.content);
      else items.push({ kind: 'direction', blocks: [...block.content] });
      continue;
    }
    const speaker = leadingSpeaker(block);
    if (speaker && isNoteLabel(speaker.label)) {
      items.push({ kind: 'note', blocks: [{ type: 'paragraph', content: speaker.rest }] });
      continue;
    }
    if (speaker) {
      const { role, aside } = speakerRole(speaker.label);
      items.push({
        kind: 'line',
        speaker: speaker.label,
        role,
        aside,
        blocks: speaker.rest.length ? [{ type: 'paragraph', content: speaker.rest }] : [],
      });
      continue;
    }
    const plain = blockPlainText(block).trim();
    if (block.type === 'paragraph' && /^référence\s*:/i.test(plain)) {
      items.push({ kind: 'reference', text: plain.replace(/^référence\s*:\s*/i, '') });
      continue;
    }
    if (last?.kind === 'line' && (block.type === 'paragraph' || block.type.endsWith('List'))) {
      last.blocks.push(block);
      continue;
    }
    if (last?.kind === 'text') last.blocks.push(block);
    else items.push({ kind: 'text', blocks: [block] });
  }
  return items;
}

/** Vrai si le texte comporte un dialogue (au moins deux répliques). */
export function hasDialogue(document: LessonDocument): boolean {
  return parseCeremony(document).filter((item) => item.kind === 'line').length >= 2;
}

/**
 * Rôles proposés par « Mon rôle », dans l'ordre d'apparition. Un rôle qui précise un autre
 * (« Routiers en rectangle » après « Routiers ») lui est rattaché.
 */
export function ceremonyRoles(items: readonly CeremonyItem[]): string[] {
  const roles: string[] = [];
  for (const item of items) {
    if (item.kind !== 'line') continue;
    if (!roles.some((role) => roleMatches(role, item.role))) roles.push(item.role);
  }
  // Un rôle général apparu après sa précision absorbe celle-ci.
  return roles.filter((role) => !roles.some((other) => other !== role && roleMatches(other, role)));
}

/** Vrai si la réplique de rôle `role` revient au rôle choisi `selected`. */
export function roleMatches(selected: string, role: string): boolean {
  const a = searchableText(selected);
  const b = searchableText(role);
  return a === b || b.startsWith(`${a} `);
}

/**
 * Points de préparation réellement écrits : phrases de la rubrique « Préparation » (aucune
 * obligation ajoutée). Utilisés par la liste de préparation personnelle, jamais une validation.
 */
export function preparationPoints(items: readonly CeremonyItem[]): string[] {
  const points: string[] = [];
  let inPreparation = false;
  for (const item of items) {
    if (item.kind === 'section') {
      inPreparation = searchableText(item.title).startsWith('preparation');
      continue;
    }
    if (!inPreparation || item.kind !== 'text') continue;
    for (const block of item.blocks) {
      const sentences = blockPlainText(block)
        .replace(/\s+/g, ' ')
        .split(/(?<=[.!?])\s+(?=[A-ZÀÂÉÈÊÎÔÛÇ«])/u)
        .map((sentence) => sentence.trim())
        .filter(Boolean);
      points.push(...sentences);
    }
  }
  return points;
}

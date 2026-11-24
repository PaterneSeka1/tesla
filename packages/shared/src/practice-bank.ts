import type { LessonBlock, LessonDocument, LessonInline } from './lesson-content.js';
import type { PracticeActivity } from './practice.js';

/**
 * Banque d'entraînement d'un module publié (D194) : activités rédigées dans les leçons, complétées
 * par des activités **dérivées** du contenu publié, sans rien inventer ni modifier :
 * - liste numérotée de 3 à 8 lignes courtes → remise en ordre ;
 * - citation (texte de référence, prière) → texte à compléter, pour mémoriser, jamais noté ;
 * - encadré « À retenir » → carte de rappel.
 * Calcul pur et déterministe : mêmes identifiants pour un même texte, quelle que soit la version.
 */

export interface BankActivity {
  /** Clé stable dans le module : identifiant rédigé, ou empreinte du texte d'origine. */
  key: string;
  /** Empreinte du contenu (`activityFingerprint`) : change dès que l'activité est modifiée. */
  fingerprint: string;
  lessonId: string;
  lessonTitle: string;
  /** `authored` : rédigée par l'encadrement ; `derived` : tirée du texte publié. */
  origin: 'authored' | 'derived';
  /** Texte religieux ou officiel cité : mémorisation sans score ni compétition (cahier § 34). */
  reverent?: boolean;
  activity: PracticeActivity;
}

export interface BankLesson {
  id: string;
  title: string;
  content: LessonDocument;
}

const plain = (nodes: readonly LessonInline[] | undefined): string =>
  (nodes ?? [])
    .map((node) => (node.type === 'text' ? node.text : ' '))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

function blockText(block: LessonBlock): string {
  switch (block.type) {
    case 'paragraph':
    case 'heading':
      return plain(block.content);
    case 'bulletList':
    case 'orderedList':
      return block.content.map((item) => item.content.map(blockText).join(' ')).join(' ');
    case 'blockquote':
      return block.content.map(blockText).join('\n');
    default:
      return '';
  }
}

/** Empreinte FNV-1a 32 bits (hexadécimal) : identifiant stable d'un texte. */
export function fingerprint(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** Sérialisation canonique (clés triées) : même empreinte quel que soit l'ordre des clés. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

/** Empreinte du contenu d'une activité, indépendante de l'ordre des clés JSON. */
export function activityFingerprint(activity: PracticeActivity): string {
  return fingerprint(canonical(activity));
}

const RETENIR = new Set(['à retenir', 'pour retenir', 'pour mémoriser', 'pour conclure']);
const SACRED = /prière|seigneur|dieu|jésus|amen|marie|notre père|promesse|loi scoute/i;

/**
 * Mots à masquer pour mémoriser un texte : un mot significatif (≥ 5 lettres) sur `step`, au plus
 * `max`. Le texte original est conservé à l'identique autour des trous.
 */
export function clozeFromText(value: string, step = 4, max = 12): string | null {
  const tokens = value.split(/(\s+)/);
  let seen = 0;
  let blanks = 0;
  const out = tokens.map((token) => {
    const word = /^([«"(]*)([\p{L}][\p{L}’'-]{4,})([.,;:!?»")]*)$/u.exec(token);
    if (!word || blanks >= max) return token;
    seen++;
    if (seen % step !== 0) return token;
    blanks++;
    return `${word[1]}[[${word[2]}]]${word[3]}`;
  });
  return blanks >= 2 ? out.join('') : null;
}

export function buildPracticeBank(lessons: readonly BankLesson[]): BankActivity[] {
  const bank: BankActivity[] = [];
  const keys = new Set<string>();
  const push = (entry: Omit<BankActivity, 'fingerprint'>) => {
    if (keys.has(entry.key)) return;
    keys.add(entry.key);
    bank.push({ ...entry, fingerprint: activityFingerprint(entry.activity) });
  };

  for (const lesson of lessons) {
    const base = { lessonId: lesson.id, lessonTitle: lesson.title };
    const blocks = lesson.content.content;
    let heading = '';
    for (let index = 0; index < blocks.length; index++) {
      const block = blocks[index]!;
      if (block.type === 'heading') heading = plain(block.content);
      if (block.type === 'practice') {
        push({
          ...base,
          key: block.attrs.activity.id,
          origin: 'authored',
          activity: block.attrs.activity,
        });
        continue;
      }
      if (block.type === 'orderedList') {
        const steps = block.content.map((item) => item.content.map(blockText).join(' ').trim());
        if (
          steps.length >= 3 &&
          steps.length <= 8 &&
          steps.every((s) => s.length > 0 && s.length <= 160)
        ) {
          const key = `d-o-${fingerprint(steps.join('|'))}`;
          push({
            ...base,
            key,
            origin: 'derived',
            activity: {
              kind: 'order',
              id: key,
              title: heading || lesson.title,
              steps: steps.map((label) => ({ label })),
            },
          });
        }
        continue;
      }
      if (block.type === 'blockquote') {
        const quote = blockText(block).trim();
        if (quote.length < 60 || quote.length > 2500) continue;
        const cloze = clozeFromText(quote);
        if (!cloze) continue;
        const key = `d-c-${fingerprint(quote)}`;
        push({
          ...base,
          key,
          origin: 'derived',
          reverent: SACRED.test(`${heading} ${lesson.title} ${quote}`),
          activity: { kind: 'cloze', id: key, title: heading || lesson.title, text: cloze },
        });
        continue;
      }
      if (
        block.type === 'heading' &&
        block.attrs.level === 3 &&
        RETENIR.has(heading.toLocaleLowerCase('fr'))
      ) {
        const parts: string[] = [];
        for (
          let next = index + 1;
          next < blocks.length && blocks[next]!.type !== 'heading';
          next++
        ) {
          parts.push(blockText(blocks[next]!));
        }
        const back = parts.join('\n').trim();
        if (back.length < 20 || back.length > 600) continue;
        const key = `d-f-${fingerprint(back)}`;
        push({
          ...base,
          key,
          origin: 'derived',
          activity: {
            kind: 'flashcards',
            id: key,
            title: lesson.title,
            cards: [{ front: `Que retenir de « ${lesson.title} » ?`, back }],
          },
        });
      }
    }
  }
  return bank;
}

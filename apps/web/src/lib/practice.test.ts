import {
  buildPracticeBank,
  clozeBlanks,
  clozeFromText,
  computeBadges,
  gradePractice,
  isMastered,
  type LessonDocument,
  lessonDocumentSchema,
  nextReview,
  practicePrintLines,
  sameWord,
} from '@tesla/shared';
import { describe, expect, it } from 'vitest';

const paragraph = (text: string) => ({
  type: 'paragraph' as const,
  content: [{ type: 'text' as const, text }],
});

describe('activités d’entraînement (D194)', () => {
  it('le document de leçon accepte une activité valide et refuse une activité incohérente', () => {
    const valid = {
      type: 'doc',
      content: [
        {
          type: 'practice',
          attrs: {
            activity: {
              kind: 'quiz',
              id: 'quiz-abc123',
              items: [{ prompt: 'Question ?', options: ['A', 'B'], answer: 1 }],
            },
          },
        },
      ],
    };
    expect(lessonDocumentSchema.safeParse(valid).success).toBe(true);
    const outOfRange = structuredClone(valid);
    outOfRange.content[0]!.attrs.activity.items[0]!.answer = 5;
    expect(lessonDocumentSchema.safeParse(outOfRange).success).toBe(false);
    const html = structuredClone(valid) as { content: { attrs: { activity: { id: string } } }[] };
    html.content[0]!.attrs.activity.id = '<script>';
    expect(lessonDocumentSchema.safeParse(html).success).toBe(false);
  });

  it('corrige chaque type de façon déterministe', () => {
    expect(
      gradePractice(
        { kind: 'truefalse', id: 'tf-000001', items: [{ statement: 'x', answer: false }] },
        [false],
      ),
    ).toEqual([true]);
    expect(
      gradePractice(
        {
          kind: 'order',
          id: 'or-000001',
          steps: [{ label: 'a' }, { label: 'b' }, { label: 'c' }],
        },
        [0, 2, 1],
      ),
    ).toEqual([true, false, false]);
    const cloze = { kind: 'cloze' as const, id: 'cl-000001', text: 'Être [[toujours]] prêt' };
    expect(gradePractice(cloze, ['Toujours'])).toEqual([true]);
    expect(isMastered(cloze, ['jamais'])).toBe(false);
    // Mise en situation : jamais notée, explorée dès qu'un choix est fait.
    const scenario = {
      kind: 'scenario' as const,
      id: 'sc-000001',
      situation: 's',
      choices: [
        { label: 'a', insight: 'i' },
        { label: 'b', insight: 'j' },
      ],
    };
    expect(gradePractice(scenario, [1])).toEqual([]);
    expect(isMastered(scenario, [1])).toBe(true);
  });

  it('compare les mots sans tenir compte de la casse, des accents ni de la ponctuation', () => {
    expect(sameWord('Éclaireur.', 'eclaireur')).toBe(true);
    expect(sameWord('route', 'routier')).toBe(false);
  });

  it('n’imprime jamais la réponse', () => {
    const lines = practicePrintLines({
      kind: 'cloze',
      id: 'cl-000002',
      text: 'Le [[service]] avant tout',
    }).lines.join(' ');
    expect(lines).not.toContain('service');
  });
});

describe('banque dérivée du contenu publié', () => {
  const doc: LessonDocument = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Étapes' }] },
      {
        type: 'orderedList',
        content: ['Préparer', 'Partir', 'Revenir'].map((text) => ({
          type: 'listItem',
          content: [paragraph(text)],
        })),
      },
      {
        type: 'blockquote',
        content: [
          paragraph(
            'Seigneur Jésus, apprenez-nous à être généreux, à vous servir comme vous le méritez, à donner sans compter.',
          ),
        ],
      },
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'À retenir' }] },
      paragraph('La Route est un temps de service et de découverte de soi.'),
    ],
  };

  it('dérive ordre, texte à compléter et carte de rappel sans modifier le texte', () => {
    const bank = buildPracticeBank([{ id: 'l1', title: 'Leçon', content: doc }]);
    expect(bank.map((entry) => entry.activity.kind)).toEqual(['order', 'cloze', 'flashcards']);
    const cloze = bank[1]!;
    expect(cloze.reverent).toBe(true);
    if (cloze.activity.kind !== 'cloze') throw new Error('type');
    expect(cloze.activity.text.replace(/\[\[|\]\]/g, '')).toBe(
      'Seigneur Jésus, apprenez-nous à être généreux, à vous servir comme vous le méritez, à donner sans compter.',
    );
    expect(clozeBlanks(cloze.activity.text).length).toBeGreaterThanOrEqual(2);
    // Clés stables d'une version à l'autre (même texte = même clé).
    expect(buildPracticeBank([{ id: 'l2', title: 'Autre', content: doc }])[0]!.key).toBe(
      bank[0]!.key,
    );
  });

  it('ne masque rien dans un texte trop court', () => {
    expect(clozeFromText('Toujours prêt.')).toBeNull();
  });
});

describe('révisions et badges (D196, D197)', () => {
  const today = new Date('2026-11-24T10:00:00Z');

  it('Leitner : la réussite fait monter, l’erreur ramène à la première boîte', () => {
    expect(nextReview(0, true, today)).toEqual({ box: 1, dueOn: '2026-11-25' });
    expect(nextReview(2, true, today)).toEqual({ box: 3, dueOn: '2026-12-01' });
    expect(nextReview(4, false, today)).toEqual({ box: 1, dueOn: '2026-11-25' });
    expect(nextReview(5, true, today).box).toBe(5);
  });

  it('badges datés par l’événement qui remplit la condition', () => {
    const at = (day: number) => new Date(Date.UTC(2026, 10, day));
    const badges = computeBadges({
      events: [
        { kind: 'LECON_LUE', moduleSlug: 'a', createdAt: at(2) },
        { kind: 'LECON_LUE', moduleSlug: 'b', createdAt: at(3) },
        { kind: 'LECON_LUE', moduleSlug: 'a', createdAt: at(4) },
        { kind: 'LECON_LUE', moduleSlug: 'c', createdAt: at(5) },
      ],
      progress: [{ activityKind: 'quiz', attempts: 3, box: 2, masteredAt: at(6) }],
    });
    const earned = Object.fromEntries(badges.map((badge) => [badge.key, badge.earnedAt]));
    expect(earned['premier-pas']).toBe(at(2).toISOString());
    expect(earned.curiosite).toBe(at(5).toISOString());
    expect(earned.perseverance).toBe(at(6).toISOString());
    expect(earned.explorateur).toBeNull();
  });
});

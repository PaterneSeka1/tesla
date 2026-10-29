import {
  canTransition,
  createResourceInputSchema,
  isLessonDocumentEmpty,
  lessonDocumentSchema,
  MODULE_RESOURCE_KINDS,
  MODULE_VERSION_ACTIONS,
  MODULE_VERSION_STATUSES,
  slugify,
  updateModuleVersionInputSchema,
} from '@tesla/shared';
import {
  ModuleResourceKind,
  ModuleVersionAction,
  ModuleVersionStatus,
} from '../../generated/prisma/enums.js';

const versionId = '0190a0b0-0000-7000-8000-000000000001';

describe('Synchronisation des enums des modules', () => {
  it('statuts, actions et types de ressource identiques entre Prisma et @tesla/shared', () => {
    expect(Object.values(ModuleVersionStatus).sort()).toEqual([...MODULE_VERSION_STATUSES].sort());
    expect(Object.values(ModuleVersionAction).sort()).toEqual([...MODULE_VERSION_ACTIONS].sort());
    expect(Object.values(ModuleResourceKind).sort()).toEqual([...MODULE_RESOURCE_KINDS].sort());
  });
});

describe('Workflow de publication', () => {
  it('suit BROUILLON → SOUMIS → APPROUVE → PUBLIE → ARCHIVE', () => {
    expect(canTransition('BROUILLON', 'SOUMIS')).toBe(true);
    expect(canTransition('SOUMIS', 'APPROUVE')).toBe(true);
    expect(canTransition('APPROUVE', 'PUBLIE')).toBe(true);
    expect(canTransition('PUBLIE', 'ARCHIVE')).toBe(true);
    expect(canTransition('SOUMIS', 'A_CORRIGER')).toBe(true);
    expect(canTransition('A_CORRIGER', 'BROUILLON')).toBe(true);
  });

  it('interdit la publication sans approbation et toute sortie d’un état clos', () => {
    expect(canTransition('BROUILLON', 'PUBLIE')).toBe(false);
    expect(canTransition('SOUMIS', 'PUBLIE')).toBe(false);
    expect(canTransition('REFUSE', 'BROUILLON')).toBe(false);
    expect(canTransition('ARCHIVE', 'PUBLIE')).toBe(false);
  });
});

describe('Contenu de leçon (liste blanche)', () => {
  const doc = (content: unknown[]) => ({ type: 'doc', content });
  const text = (value: string, marks?: unknown[]) => ({ type: 'text', text: value, marks });

  it('accepte titres, paragraphes, listes, citations, liens et images https', () => {
    const result = lessonDocumentSchema.safeParse(
      doc([
        { type: 'heading', attrs: { level: 2 }, content: [text('Titre')] },
        { type: 'paragraph', content: [text('Gras', [{ type: 'bold' }])] },
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [text('Point')] }] },
          ],
        },
        { type: 'blockquote', content: [{ type: 'paragraph', content: [text('Citation')] }] },
        {
          type: 'paragraph',
          content: [text('lien', [{ type: 'link', attrs: { href: 'https://example.org' } }])],
        },
        { type: 'image', attrs: { src: 'https://example.org/a.png', alt: 'Illustration' } },
      ]),
    );
    expect(result.success).toBe(true);
  });

  it('refuse les liens javascript:, les images non https et les nœuds inconnus', () => {
    const js = doc([
      {
        type: 'paragraph',
        content: [text('x', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }])],
      },
    ]);
    expect(lessonDocumentSchema.safeParse(js).success).toBe(false);
    const dataImage = doc([{ type: 'image', attrs: { src: 'data:image/png;base64,AAAA' } }]);
    expect(lessonDocumentSchema.safeParse(dataImage).success).toBe(false);
    const httpImage = doc([{ type: 'image', attrs: { src: 'http://example.org/a.png' } }]);
    expect(lessonDocumentSchema.safeParse(httpImage).success).toBe(false);
    expect(
      lessonDocumentSchema.safeParse(doc([{ type: 'html', content: '<script>' }])).success,
    ).toBe(false);
    expect(
      lessonDocumentSchema.safeParse(doc([{ type: 'heading', attrs: { level: 1 } }])).success,
    ).toBe(false);
  });

  it('retire les attributs non prévus (ex. gestionnaires d’événements)', () => {
    const parsed = lessonDocumentSchema.parse(
      doc([{ type: 'image', attrs: { src: 'https://example.org/a.png', onerror: 'alert(1)' } }]),
    );
    expect(parsed.content[0]).toEqual({
      type: 'image',
      attrs: { src: 'https://example.org/a.png' },
    });
  });

  it('refuse un contenu trop imbriqué', () => {
    let node: unknown = { type: 'paragraph', content: [text('fond')] };
    for (let i = 0; i < 10; i += 1) node = { type: 'blockquote', content: [node] };
    expect(lessonDocumentSchema.safeParse(doc([node])).success).toBe(false);
  });

  it('détecte une leçon vide', () => {
    expect(isLessonDocumentEmpty({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe(true);
    expect(
      isLessonDocumentEmpty({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }] }],
      }),
    ).toBe(false);
  });
});

describe('Ressources et métadonnées', () => {
  it('n’accepte que les vidéos hébergées sur les plateformes autorisées', () => {
    const base = { versionId, kind: 'VIDEO', title: 'Vidéo' } as const;
    expect(
      createResourceInputSchema.safeParse({ ...base, url: 'https://youtu.be/abc' }).success,
    ).toBe(true);
    expect(
      createResourceInputSchema.safeParse({ ...base, url: 'https://evil.example/v.mp4' }).success,
    ).toBe(false);
    expect(
      createResourceInputSchema.safeParse({
        versionId,
        kind: 'DOCUMENT',
        title: 'D',
        url: 'javascript:x',
      }).success,
    ).toBe(false);
  });

  it('exige au moins une modification et la révision lue', () => {
    expect(updateModuleVersionInputSchema.safeParse({ versionId, revision: 1 }).success).toBe(
      false,
    );
    expect(
      updateModuleVersionInputSchema.safeParse({ versionId, title: 'Nouveau titre' }).success,
    ).toBe(false);
    expect(
      updateModuleVersionInputSchema.safeParse({ versionId, revision: 1, title: 'Titre' }).success,
    ).toBe(true);
  });

  it('produit des slugs sans accents', () => {
    expect(slugify('Histoire du scoutisme & Baden-Powell')).toBe(
      'histoire-du-scoutisme-baden-powell',
    );
    expect(slugify('Prière — Spiritualité Route')).toBe('priere-spiritualite-route');
    expect(slugify('!!!')).toBe('module');
  });
});

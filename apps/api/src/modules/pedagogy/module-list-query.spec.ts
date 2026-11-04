import { editorModuleListQuerySchema } from '@tesla/shared';
import { foldText, likePattern, moduleFilterWhere, moduleOrderBy } from './module-list-query.js';

const parse = (query: Record<string, string>) => editorModuleListQuerySchema.parse(query);
const context = { userId: '0190a0b0-0000-7000-8000-000000000001', canReview: false };

describe('liste des modules : requête', () => {
  it('replie casse et accents ; neutralise les jokers LIKE', () => {
    expect(foldText('Prière ÉTAPE Noël')).toBe('priere etape noel');
    expect(likePattern('50%_a\\b')).toBe('%50\\%\\_a\\\\b%');
  });

  it('aucun filtre par défaut ; chaque filtre ajoute une condition combinable', () => {
    expect(moduleFilterWhere(parse({}), context)).toEqual([]);
    const filters = moduleFilterWhere(
      parse({
        status: 'BROUILLON',
        publication: 'current',
        category: 'ETAPE',
        author: 'me',
        origin: 'import',
        evaluation: 'without',
        lessons: 'with',
        from: '2026-09-01',
        to: '2026-09-30',
      }),
      context,
    );
    expect(filters).toHaveLength(8);
    expect(filters).toContainEqual({ createdById: context.userId });
    expect(filters).toContainEqual({ publishedVersionId: { not: null } });
    expect(filters).toContainEqual({
      updatedAt: {
        gte: new Date('2026-09-01T00:00:00.000Z'),
        lt: new Date('2026-10-01T00:00:00.000Z'),
      },
    });
  });

  it('« nécessitant mon intervention » dépend du rôle de décision', () => {
    const query = parse({ collaboration: 'action' });
    expect(moduleFilterWhere(query, context)).toEqual([
      { versions: { some: { status: { in: ['A_CORRIGER'] } } } },
    ]);
    expect(moduleFilterWhere(query, { ...context, canReview: true })).toEqual([
      { versions: { some: { status: { in: ['SOUMIS', 'APPROUVE'] } } } },
    ]);
  });

  it('tri stable (départage par numéro) ; titre trié en SQL', () => {
    expect(moduleOrderBy('updated_desc')).toEqual([{ updatedAt: 'desc' }, { number: 'desc' }]);
    expect(moduleOrderBy('title_asc')).toBeNull();
  });

  it('refuse une période inversée, un tri ou une date inconnus', () => {
    expect(() => parse({ from: '2026-10-01', to: '2026-09-01' })).toThrow();
    expect(() => parse({ sort: 'random' })).toThrow();
    expect(() => parse({ from: '01/09/2026' })).toThrow();
    expect(parse({ stageId: '', author: '' })).toMatchObject({
      stageId: undefined,
      author: undefined,
    });
  });
});

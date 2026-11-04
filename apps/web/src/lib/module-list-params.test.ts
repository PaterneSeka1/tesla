import { describe, expect, it } from 'vitest';
import {
  activeFilters,
  activeQuickView,
  applyQuickView,
  clearFilter,
  DEFAULT_STATE,
  parseListState,
  QUICK_VIEWS,
  safeReturnPath,
  serializeListState,
  toApiQuery,
} from './module-list-params';

const STAGE = '0190a0b0-0000-7000-8000-000000000001';
const names = { stage: () => 'Noviciat', author: () => 'Awa Koné' };

describe('état de la liste des modules dans l’URL', () => {
  it('aller-retour URL ↔ état sans perte, valeurs par défaut omises', () => {
    const state = {
      ...DEFAULT_STATE,
      search: 'prière',
      status: 'BROUILLON' as const,
      stageId: STAGE,
      sort: 'title_asc' as const,
      author: 'me',
      lessons: 'with' as const,
      dateField: 'created' as const,
      from: '2026-09-01',
      page: 3,
    };
    const query = serializeListState(state);
    expect(query).not.toContain('pageSize');
    expect(parseListState(new URLSearchParams(query))).toEqual(state);
    expect(serializeListState(DEFAULT_STATE)).toBe('');
    // Le champ de date n'apparaît qu'avec une période.
    expect(serializeListState({ ...DEFAULT_STATE, dateField: 'created' })).toBe('');
  });

  it('ignore les valeurs inconnues ou mal formées (URL modifiée à la main)', () => {
    const state = parseListState(
      new URLSearchParams(
        'status=SUPPRIME&sort=x&stageId=abc&author=<script>&from=hier&page=-2&origin=import',
      ),
    );
    expect(state).toEqual({ ...DEFAULT_STATE, origin: 'import' });
  });

  it('requête API : chaînes vides retirées, taille de page fixe', () => {
    const query = toApiQuery({ ...DEFAULT_STATE, search: '  ', publication: 'never' });
    expect(query).toMatchObject({ search: undefined, publication: 'never', pageSize: 20 });
    expect(query.dateField).toBeUndefined();
  });

  it('vues rapides : préréglages exclusifs, tri conservé, reconnaissance de la vue active', () => {
    const sorted = { ...DEFAULT_STATE, sort: 'code_asc' as const, category: 'ETAPE' as const };
    const drafts = applyQuickView(sorted, 'drafts');
    expect(drafts).toEqual({
      ...DEFAULT_STATE,
      sort: 'code_asc',
      status: 'BROUILLON',
      author: 'me',
    });
    expect(activeQuickView(drafts)).toBe('drafts');
    expect(activeQuickView(DEFAULT_STATE)).toBe('all');
    expect(activeQuickView({ ...drafts, lessons: 'with' })).toBeNull();
    expect(QUICK_VIEWS.map((view) => view.key)).toEqual([
      'all',
      'drafts',
      'review',
      'published',
      'noQuiz',
    ]);
  });

  it('pastilles des filtres actifs et suppression individuelle (retour en page 1)', () => {
    const state = {
      ...DEFAULT_STATE,
      stageId: STAGE,
      status: 'BROUILLON' as const,
      author: 'me',
      page: 4,
    };
    const chips = activeFilters(state, names);
    expect(chips.map((chip) => chip.label)).toEqual(['Brouillon', 'Noviciat', 'Créés par moi']);
    const cleared = clearFilter(state, 'stageId');
    expect(cleared).toMatchObject({ stageId: '', status: 'BROUILLON', page: 1 });
    expect(activeFilters(DEFAULT_STATE, names)).toEqual([]);
  });

  it('adresse de retour limitée aux listes de modules internes', () => {
    const fallback = '/encadrement/modules';
    expect(safeReturnPath('/administration/modules?status=BROUILLON&page=2', fallback)).toBe(
      '/administration/modules?status=BROUILLON&page=2',
    );
    for (const unsafe of [
      'https://exemple.test/administration/modules',
      '//exemple.test/administration/modules',
      '/\\exemple.test',
      '/administration/comptes',
      '/administration/modules-a-valider-bis',
      null,
    ]) {
      expect(safeReturnPath(unsafe, fallback)).toBe(fallback);
    }
  });
});

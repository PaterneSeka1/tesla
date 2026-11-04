import {
  type EditorModuleListQuery,
  MODULE_CATEGORIES,
  MODULE_CATEGORY_LABELS,
  MODULE_COLLABORATION_FILTER_LABELS,
  MODULE_COLLABORATION_FILTERS,
  MODULE_DATE_FIELDS,
  MODULE_EVALUATION_FILTER_LABELS,
  MODULE_EVALUATION_FILTERS,
  MODULE_LESSON_FILTER_LABELS,
  MODULE_LESSON_FILTERS,
  MODULE_LIST_SORTS,
  MODULE_ORIGIN_FILTER_LABELS,
  MODULE_ORIGIN_FILTERS,
  MODULE_PUBLICATION_FILTER_LABELS,
  MODULE_PUBLICATION_FILTERS,
  MODULE_VERSION_STATUS_LABELS,
  MODULE_VERSION_STATUSES,
  type ModuleListSort,
} from '@tesla/shared';

// État de la liste « Tous les modules » porté par l'URL (D171) : partageable, conservé au retour
// d'un module et par le bouton « Précédent ». Aucun filtre enregistré en base.

export const MODULE_LIST_PAGE_SIZE = 20;

/** Statuts proposés dans le filtre principal « Statut » (éditorial). */
export const STATUS_OPTIONS = ['all', 'working', ...MODULE_VERSION_STATUSES] as const;
export type StatusOption = (typeof STATUS_OPTIONS)[number];

export const STATUS_OPTION_LABELS: Record<StatusOption, string> = {
  all: 'Tous les statuts',
  working: 'En préparation',
  ...MODULE_VERSION_STATUS_LABELS,
};

export interface ModuleListState {
  search: string;
  status: StatusOption;
  stageId: string;
  sort: ModuleListSort;
  publication: (typeof MODULE_PUBLICATION_FILTERS)[number] | '';
  category: (typeof MODULE_CATEGORIES)[number] | '';
  author: string;
  collaboration: (typeof MODULE_COLLABORATION_FILTERS)[number] | '';
  origin: (typeof MODULE_ORIGIN_FILTERS)[number] | '';
  evaluation: (typeof MODULE_EVALUATION_FILTERS)[number] | '';
  lessons: (typeof MODULE_LESSON_FILTERS)[number] | '';
  dateField: (typeof MODULE_DATE_FIELDS)[number];
  from: string;
  to: string;
  page: number;
}

export const DEFAULT_STATE: ModuleListState = {
  search: '',
  status: 'all',
  stageId: '',
  sort: 'updated_desc',
  publication: '',
  category: '',
  author: '',
  collaboration: '',
  origin: '',
  evaluation: '',
  lessons: '',
  dateField: 'updated',
  from: '',
  to: '',
  page: 1,
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function pick<T extends string>(
  values: readonly T[],
  value: string | null,
  fallback: T | '',
): T | '' {
  return value !== null && (values as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Lecture tolérante : une valeur inconnue (URL modifiée à la main) est ignorée. */
export function parseListState(params: URLSearchParams): ModuleListState {
  const page = Number(params.get('page'));
  const author = params.get('author') ?? '';
  const stageId = params.get('stageId') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  return {
    search: (params.get('search') ?? '').slice(0, 100),
    status: (pick(STATUS_OPTIONS, params.get('status'), 'all') || 'all') as StatusOption,
    stageId: UUID.test(stageId) ? stageId : '',
    sort: (pick(MODULE_LIST_SORTS, params.get('sort'), 'updated_desc') ||
      'updated_desc') as ModuleListSort,
    publication: pick(MODULE_PUBLICATION_FILTERS, params.get('publication'), ''),
    category: pick(MODULE_CATEGORIES, params.get('category'), ''),
    author: author === 'me' || UUID.test(author) ? author : '',
    collaboration: pick(MODULE_COLLABORATION_FILTERS, params.get('collaboration'), ''),
    origin: pick(MODULE_ORIGIN_FILTERS, params.get('origin'), ''),
    evaluation: pick(MODULE_EVALUATION_FILTERS, params.get('evaluation'), ''),
    lessons: pick(MODULE_LESSON_FILTERS, params.get('lessons'), ''),
    dateField: params.get('dateField') === 'created' ? 'created' : 'updated',
    from: DAY.test(from) ? from : '',
    to: DAY.test(to) ? to : '',
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

/** Chaîne de requête minimale : seules les valeurs différentes du défaut apparaissent. */
export function serializeListState(state: ModuleListState): string {
  const params = new URLSearchParams();
  for (const key of Object.keys(DEFAULT_STATE) as (keyof ModuleListState)[]) {
    const value = state[key];
    if (value === DEFAULT_STATE[key] || value === '') continue;
    if (key === 'dateField' && !state.from && !state.to) continue;
    params.set(key, String(value));
  }
  return params.toString();
}

/** Requête envoyée à l'API (recherche déjà stabilisée par l'appelant). */
export function toApiQuery(state: ModuleListState): EditorModuleListQuery {
  return {
    search: state.search.trim() || undefined,
    status: state.status,
    stageId: state.stageId || undefined,
    sort: state.sort,
    publication: state.publication || undefined,
    category: state.category || undefined,
    author: state.author || undefined,
    collaboration: state.collaboration || undefined,
    origin: state.origin || undefined,
    evaluation: state.evaluation || undefined,
    lessons: state.lessons || undefined,
    dateField: state.from || state.to ? state.dateField : undefined,
    from: state.from || undefined,
    to: state.to || undefined,
    page: state.page,
    pageSize: MODULE_LIST_PAGE_SIZE,
  };
}

/** Champs filtrants (hors tri et page) ; leur modification ramène à la page 1. */
export type FilterKey = Exclude<keyof ModuleListState, 'sort' | 'page' | 'dateField'>;

export const ADVANCED_KEYS: FilterKey[] = [
  'publication',
  'category',
  'author',
  'collaboration',
  'origin',
  'evaluation',
  'lessons',
  'from',
  'to',
];

/** Vues rapides : simples préréglages des filtres existants (aucun point d'accès dédié). */
export const QUICK_VIEWS = [
  { key: 'all', label: 'Tous', patch: {} },
  { key: 'drafts', label: 'Mes brouillons', patch: { status: 'BROUILLON', author: 'me' } },
  { key: 'review', label: 'À approuver', patch: { status: 'SOUMIS' }, reviewOnly: true },
  { key: 'published', label: 'Publiés', patch: { publication: 'current' } },
  { key: 'noQuiz', label: 'Sans questionnaire', patch: { evaluation: 'without' } },
] as const satisfies readonly {
  key: string;
  label: string;
  patch: Partial<ModuleListState>;
  reviewOnly?: boolean;
}[];

export type QuickViewKey = (typeof QUICK_VIEWS)[number]['key'];

/** État d'une vue rapide : filtres réinitialisés, tri conservé. */
export function applyQuickView(state: ModuleListState, key: QuickViewKey): ModuleListState {
  const view = QUICK_VIEWS.find((candidate) => candidate.key === key)!;
  return { ...DEFAULT_STATE, sort: state.sort, ...view.patch };
}

/** Vue rapide correspondant exactement aux filtres courants, sinon null. */
export function activeQuickView(state: ModuleListState): QuickViewKey | null {
  for (const view of QUICK_VIEWS) {
    const expected = applyQuickView(state, view.key);
    const same = (Object.keys(DEFAULT_STATE) as (keyof ModuleListState)[])
      .filter((key) => key !== 'sort' && key !== 'page')
      .every((key) => expected[key] === state[key]);
    if (same) return view.key;
  }
  return null;
}

export interface ActiveFilter {
  key: FilterKey;
  label: string;
}

/** Pastilles des filtres actifs (libellés en clair, jamais d'identifiant). */
export function activeFilters(
  state: ModuleListState,
  names: { stage: (id: string) => string | undefined; author: (id: string) => string | undefined },
): ActiveFilter[] {
  const chips: ActiveFilter[] = [];
  const add = (key: FilterKey, label: string | undefined) => label && chips.push({ key, label });
  if (state.search.trim()) add('search', `« ${state.search.trim()} »`);
  if (state.status !== 'all') add('status', STATUS_OPTION_LABELS[state.status]);
  if (state.stageId) add('stageId', names.stage(state.stageId) ?? 'Étape choisie');
  if (state.publication) add('publication', MODULE_PUBLICATION_FILTER_LABELS[state.publication]);
  if (state.category) add('category', MODULE_CATEGORY_LABELS[state.category]);
  if (state.author) {
    add(
      'author',
      state.author === 'me' ? 'Créés par moi' : (names.author(state.author) ?? 'Auteur choisi'),
    );
  }
  if (state.collaboration)
    add('collaboration', MODULE_COLLABORATION_FILTER_LABELS[state.collaboration]);
  if (state.origin) add('origin', MODULE_ORIGIN_FILTER_LABELS[state.origin]);
  if (state.evaluation) add('evaluation', MODULE_EVALUATION_FILTER_LABELS[state.evaluation]);
  if (state.lessons) add('lessons', MODULE_LESSON_FILTER_LABELS[state.lessons]);
  const dateLabel = state.dateField === 'created' ? 'Créés' : 'Modifiés';
  if (state.from) add('from', `${dateLabel} depuis le ${frenchDay(state.from)}`);
  if (state.to) add('to', `${dateLabel} jusqu’au ${frenchDay(state.to)}`);
  return chips;
}

function frenchDay(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

/** Retire un filtre (retour à sa valeur par défaut) et revient à la première page. */
export function clearFilter(state: ModuleListState, key: FilterKey): ModuleListState {
  return { ...state, [key]: DEFAULT_STATE[key], page: 1 };
}

const RETURN_PREFIXES = ['/administration/modules', '/encadrement/modules'];

/**
 * Adresse de retour vers la liste (paramètre `retour`) : uniquement un chemin interne de liste des
 * modules, jamais une adresse externe (redirection ouverte).
 */
export function safeReturnPath(value: string | null, fallback: string): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return fallback;
  }
  const path = value.split('?')[0]!;
  return RETURN_PREFIXES.includes(path) ? value : fallback;
}

import { z } from 'zod';
import { userSummarySchema } from './api.js';

// Import du programme annuel : moteur commun aux sources Markdown et Excel (.xlsx).
// Chaîne : tableau source → correspondance des colonnes → normalisation → validation, ici (fonctions
// pures, sans écriture) ; rapprochement, empreinte, transaction et historique côté API.
// Règles : docs/FEATURES/IMPORT_PROGRAMME_EXCEL.md. Rien n'est inventé : une cellule vide reste vide,
// une valeur non reconnue est signalée, jamais devinée.

// ─── Normalisation des libellés ─────────────────────────────────────────────

/** Minuscules, sans accents ni ponctuation, espaces simples. */
export function normalizeLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Variante sans pluriel simple (« novices routiers » = « novice routier »). */
function singularLabel(value: string): string {
  return normalizeLabel(value)
    .split(' ')
    .map((word) => (word.length > 3 && /[sx]$/.test(word) ? word.slice(0, -1) : word))
    .join(' ');
}

/** Clé d'idempotence : date + titre normalisé (accents, casse et ponctuation ignorés). */
export function programmeImportKey(date: string, title: string): string {
  return `${date}|${normalizeLabel(title).replace(/ /g, '-')}`;
}

// ─── Dates ──────────────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  janvier: 1,
  janv: 1,
  jan: 1,
  fevrier: 2,
  fevr: 2,
  fev: 2,
  mars: 3,
  avril: 4,
  avr: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  juil: 7,
  aout: 8,
  septembre: 9,
  sept: 9,
  sep: 9,
  octobre: 10,
  oct: 10,
  novembre: 11,
  nov: 11,
  decembre: 12,
  dec: 12,
};

function validIso(year: number, month: number, day: number): string | null {
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}

/**
 * Accepte AAAA-MM-JJ, JJ/MM/AAAA (aussi JJ-MM-AAAA, JJ.MM.AAAA) et la forme française écrite
 * (« samedi 10 octobre 2026 », « 10 oct. 2026 »). Renvoie AAAA-MM-JJ, ou null si la date
 * n'existe pas ou n'est pas reconnue (jamais de date approchée).
 */
export function parseProgrammeDate(raw: string): string | null {
  const value = raw.trim();
  let match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ][\d:.]+Z?)?$/.exec(value);
  if (match) return validIso(Number(match[1]), Number(match[2]), Number(match[3]));
  match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(value);
  if (match) return validIso(Number(match[3]), Number(match[2]), Number(match[1]));
  match =
    /^(?:(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche) )?(\d{1,2})(?: ?er)? ([a-z]+) (\d{4})$/.exec(
      normalizeLabel(value),
    );
  const month = match ? MONTHS[match[2]!] : undefined;
  if (match && month) return validIso(Number(match[3]), month, Number(match[1]));
  return null;
}

/** Numéro de série Excel → AAAA-MM-JJ (partie horaire ignorée). Calendrier 1900 ou 1904. */
export function excelSerialToIsoDate(serial: number, date1904 = false): string | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 2_958_465) return null;
  const base = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  return new Date(base + Math.floor(serial) * 86_400_000).toISOString().slice(0, 10);
}

/** « OCTOBRE 2026 » → « 2026-10 » ; null si non reconnu. */
function parseMonthLabel(raw: string): string | null {
  const match = /^([a-z]+) (\d{4})$/.exec(normalizeLabel(raw));
  const month = match ? MONTHS[match[1]!] : undefined;
  return match && month ? `${match[2]}-${String(month).padStart(2, '0')}` : null;
}

// ─── Statut indiqué dans la source ──────────────────────────────────────────

/**
 * Statut lu dans le fichier : reconnu seulement si la correspondance est certaine. Il est conservé
 * comme information source et n'a **aucun effet** sur le statut opérationnel (D172).
 */
export const SOURCE_STATUS_VALUES = ['PLANIFIEE', 'REALISEE', 'REPORTEE', 'ANNULEE'] as const;

export type SourceStatus = (typeof SOURCE_STATUS_VALUES)[number];

const SOURCE_STATUS_ALIASES: Record<string, SourceStatus> = {
  prevue: 'PLANIFIEE',
  prevu: 'PLANIFIEE',
  planifiee: 'PLANIFIEE',
  planifie: 'PLANIFIEE',
  programmee: 'PLANIFIEE',
  'a venir': 'PLANIFIEE',
  tenue: 'REALISEE',
  tenu: 'REALISEE',
  realisee: 'REALISEE',
  realise: 'REALISEE',
  effectuee: 'REALISEE',
  faite: 'REALISEE',
  reportee: 'REPORTEE',
  reporte: 'REPORTEE',
  annulee: 'ANNULEE',
  annule: 'ANNULEE',
};

export function recognizeSourceStatus(raw: string | null | undefined): SourceStatus | null {
  return raw ? (SOURCE_STATUS_ALIASES[normalizeLabel(raw)] ?? null) : null;
}

// ─── Champs et correspondance des colonnes ──────────────────────────────────

export const PROGRAMME_IMPORT_FIELDS = [
  'date',
  'title',
  'theme',
  'objectives',
  'categories',
  'moduleCodes',
  'leaderLabel',
  'location',
  'format',
  'sourceStatus',
  'sourceAttendance',
  'planningNotes',
  'sourceNumber',
  'month',
] as const;

export type ProgrammeImportField = (typeof PROGRAMME_IMPORT_FIELDS)[number];

/** Contenu prévu pour une catégorie : `category:<CODE>`. */
export const CATEGORY_FIELD_PREFIX = 'category:';

/** Valeur de correspondance explicite « ignorer cette colonne ». */
export const IGNORED_COLUMN = 'ignore';

export const PROGRAMME_IMPORT_FIELD_LABELS: Record<ProgrammeImportField, string> = {
  date: 'Date de la séance',
  title: 'Intitulé (temps commun / objectif)',
  theme: 'Axe du mois / thème',
  objectives: 'Objectifs (séparés par ;)',
  categories: 'Catégories concernées (liste)',
  moduleCodes: 'Modules (codes)',
  leaderLabel: 'Responsable prévu',
  location: 'Lieu prévu',
  format: 'Format prévu',
  sourceStatus: 'Statut indiqué dans le fichier',
  sourceAttendance: 'Effectif indiqué (nombre)',
  planningNotes: 'Observations du programme',
  sourceNumber: 'Numéro de séance',
  month: 'Mois (contrôle de cohérence)',
};

/** Variantes d'en-têtes reconnues (forme normalisée, correspondance exacte uniquement). */
const FIELD_ALIASES: Record<ProgrammeImportField, readonly string[]> = {
  date: ['date', 'dates', 'date du samedi', 'date de la seance', 'date prevue', 'jour', 'samedi'],
  title: [
    'activite',
    'activites',
    'seance',
    'titre',
    'intitule',
    'sujet',
    'temps commun objectif',
    'temps commun',
    'objectif commun',
  ],
  theme: ['theme', 'axe du mois', 'axe', 'axe pedagogique', 'axe mensuel', 'theme du mois'],
  objectives: ['objectifs', 'objectif', 'objectifs pedagogiques'],
  categories: ['categories', 'categorie', 'niveaux'],
  moduleCodes: ['modules', 'module'],
  leaderLabel: ['responsable', 'responsables', 'responsable prevu', 'animateur', 'animateurs'],
  location: ['lieu', 'lieu prevu'],
  format: ['format', 'format prevu', 'modalite', 'type d activite'],
  sourceStatus: ['statut', 'etat', 'statut de la seance'],
  sourceAttendance: ['presents', 'effectif', 'nombre de presents'],
  planningNotes: [
    'observations',
    'observation',
    'observations validations',
    'validations',
    'remarques',
    'notes',
    'commentaires',
  ],
  sourceNumber: ['n', 'no', 'num', 'numero', 'n seance', 'numero de seance'],
  month: ['mois'],
};

const ALIAS_INDEX = new Map<string, ProgrammeImportField>(
  PROGRAMME_IMPORT_FIELDS.flatMap((field) =>
    FIELD_ALIASES[field].map((alias) => [alias, field] as const),
  ),
);

export interface ProgrammeCategoryRef {
  code: string;
  label: string;
}

/** Lettre de colonne Excel (0 → A, 26 → AA). */
export function columnLetter(index: number): string {
  let letter = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letter = String.fromCharCode(65 + ((n - 1) % 26)) + letter;
  }
  return letter;
}

/** Valeurs de correspondance acceptées pour une colonne. */
export function programmeFieldOptions(categories: readonly ProgrammeCategoryRef[]): string[] {
  return [
    ...PROGRAMME_IMPORT_FIELDS,
    ...categories.map((category) => `${CATEGORY_FIELD_PREFIX}${category.code}`),
    IGNORED_COLUMN,
  ];
}

/** Reconnaît un en-tête : champ connu, contenu d'une catégorie, ou null (correspondance manuelle). */
export function detectProgrammeField(
  header: string,
  categories: readonly ProgrammeCategoryRef[],
): string | null {
  const candidates = [header, header.replace(/\([^)]*\)/g, ' ')];
  for (const candidate of candidates) {
    const field = ALIAS_INDEX.get(normalizeLabel(candidate));
    if (field) return field;
    const singular = singularLabel(candidate);
    if (singular === '') continue;
    const category = categories.find(
      (c) => singularLabel(c.label) === singular || singularLabel(c.code) === singular,
    );
    if (category) return `${CATEGORY_FIELD_PREFIX}${category.code}`;
  }
  return null;
}

// ─── Tableau source et normalisation ────────────────────────────────────────

export type ProgrammeCellValue = string | number | boolean | null;

export interface ProgrammeTableRow {
  /** Numéro de ligne dans la source (ligne Excel ou ligne du texte Markdown). */
  line: number;
  cells: ProgrammeCellValue[];
  /** Commentaires de cellule (Excel), par colonne. */
  notes?: (string | null)[];
}

export interface ProgrammeTable {
  /** Libellés d'en-tête, par colonne. */
  header: string[];
  /** Clé affichée de chaque colonne (lettre Excel ou numéro). */
  columnKeys: string[];
  rows: ProgrammeTableRow[];
  /** Les nombres de la colonne date sont des numéros de série Excel. */
  excelDates?: { date1904: boolean };
}

export const IMPORT_ISSUE_SEVERITIES = ['ERREUR', 'AVERTISSEMENT'] as const;

export type ImportIssueSeverity = (typeof IMPORT_ISSUE_SEVERITIES)[number];

export interface ProgrammeImportIssue {
  severity: ImportIssueSeverity;
  line: number | null;
  column: string | null;
  message: string;
}

/**
 * Ligne normalisée. Un champ `undefined` signifie « colonne absente de la source » : il n'est ni
 * comparé ni écrit (un import Markdown n'efface pas le format venu d'un import Excel).
 */
export interface ProgrammeSourceRow {
  line: number;
  date: string;
  title: string;
  importKey: string;
  theme?: string | null;
  objectives?: string[];
  /** Libellés de la colonne « Catégories » (Markdown). */
  categories?: string[];
  /** Contenu prévu par code de catégorie (colonnes dédiées). */
  categoryContents?: Record<string, string | null>;
  moduleCodes?: string[];
  leaderLabel?: string | null;
  location?: string | null;
  format?: string | null;
  sourceStatus?: string | null;
  sourceAttendance?: number | null;
  planningNotes?: string | null;
  sourceNumber?: number | null;
}

export interface ProgrammeRejectedRow {
  line: number;
  date: string | null;
  title: string | null;
  messages: string[];
}

export interface ProgrammeNormalizeResult {
  rows: ProgrammeSourceRow[];
  rejected: ProgrammeRejectedRow[];
  issues: ProgrammeImportIssue[];
  /** Codes de catégorie résolus par ligne (contenu non vide ou liste « Catégories »). */
  categoryCodes: Map<number, string[]>;
}

const TEXT_LIMITS = {
  title: 200,
  theme: 150,
  leaderLabel: 150,
  location: 200,
  format: 150,
  sourceStatus: 100,
  planningNotes: 3000,
  category: 3000,
} as const;

function cellText(value: ProgrammeCellValue | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'VRAI' : 'FAUX';
  if (typeof value === 'number') return String(value);
  return value.replace(/\r\n?/g, '\n').trim();
}

/** Texte sur une ligne (titres, libellés). */
function singleLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function splitList(value: string, separators: RegExp): string[] {
  return value
    .split(separators)
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Normalise un tableau selon la correspondance des colonnes (`mapping[i]` : champ, `category:CODE`,
 * `ignore` ou null). Fonction pure : aucune donnée ajoutée ; chaque anomalie est localisée (ligne,
 * colonne). Une ligne sans date ni intitulé mais non vide est signalée puis écartée.
 */
export function normalizeProgrammeTable(
  table: ProgrammeTable,
  mapping: readonly (string | null)[],
  categories: readonly ProgrammeCategoryRef[],
): ProgrammeNormalizeResult {
  const result: ProgrammeNormalizeResult = {
    rows: [],
    rejected: [],
    issues: [],
    categoryCodes: new Map(),
  };
  const columnOf = (field: string) => mapping.indexOf(field);
  const keyOf = (index: number) => table.columnKeys[index] ?? String(index + 1);
  const dateColumn = columnOf('date');
  const titleColumn = columnOf('title');
  const seenKeys = new Map<string, number>();
  const categoryByLabel = new Map<string, string>();
  for (const category of categories) {
    categoryByLabel.set(singularLabel(category.label), category.code);
    categoryByLabel.set(singularLabel(category.code), category.code);
  }

  for (const row of table.rows) {
    const raw = (field: string) => {
      const index = columnOf(field);
      return index < 0 ? undefined : row.cells[index];
    };
    const has = (field: string) => columnOf(field) >= 0;
    const text = (field: string) => cellText(raw(field));
    const messages: string[] = [];
    const warn = (column: number, message: string) =>
      result.issues.push({
        severity: 'AVERTISSEMENT',
        line: row.line,
        column: column >= 0 ? keyOf(column) : null,
        message,
      });
    const fail = (column: number, message: string) => {
      messages.push(message);
      result.issues.push({
        severity: 'ERREUR',
        line: row.line,
        column: column >= 0 ? keyOf(column) : null,
        message,
      });
    };

    const rawDate = raw('date');
    const title = singleLine(text('title'));
    const dateText = cellText(rawDate);
    if (row.cells.every((cell) => cellText(cell) === '')) continue;
    if (dateText === '' && title === '') {
      const content = row.cells.map(cellText).find((cell) => cell !== '') ?? '';
      warn(-1, `Ligne écartée (ni date ni intitulé) : « ${content.slice(0, 80)} ».`);
      continue;
    }

    let date: string | null = null;
    if (typeof rawDate === 'number' && table.excelDates) {
      date = excelSerialToIsoDate(rawDate, table.excelDates.date1904);
    } else if (dateText !== '') {
      date = parseProgrammeDate(dateText);
    }
    if (!date) {
      fail(
        dateColumn,
        dateText === ''
          ? 'Date manquante.'
          : `Date invalide « ${dateText} » (attendu : date Excel, AAAA-MM-JJ, JJ/MM/AAAA ou « 10 octobre 2026 »).`,
      );
    }
    if (title === '' || title.length > TEXT_LIMITS.title) {
      fail(
        titleColumn,
        'Intitulé de l’activité manquant ou trop long (200 caractères au maximum).',
      );
    }

    const optional = (
      field: Exclude<keyof typeof TEXT_LIMITS, 'title' | 'category'>,
      oneLine = true,
    ) => {
      if (!has(field)) return undefined;
      const value = oneLine ? singleLine(text(field)) : text(field);
      if (value.length > TEXT_LIMITS[field]) {
        fail(
          columnOf(field),
          `${PROGRAMME_IMPORT_FIELD_LABELS[field]} : ${TEXT_LIMITS[field].toLocaleString('fr-FR')} caractères au maximum.`,
        );
      }
      return value === '' ? null : value;
    };
    const integer = (field: 'sourceAttendance' | 'sourceNumber') => {
      if (!has(field)) return undefined;
      const value = text(field);
      if (value === '') return null;
      const number = Number(value.replace(',', '.'));
      if (!Number.isInteger(number) || number < 0 || number > 100_000) {
        warn(
          columnOf(field),
          `${PROGRAMME_IMPORT_FIELD_LABELS[field]} « ${value} » non numérique : non repris.`,
        );
        return null;
      }
      return number;
    };

    // Catégories : colonne « Catégories » (liste) et colonnes de contenu dédiées.
    const codes = new Set<string>();
    let categoryList: string[] | undefined;
    if (has('categories')) {
      categoryList = splitList(text('categories'), /[,;\n]/);
      for (const label of categoryList) {
        const code = categoryByLabel.get(singularLabel(label));
        if (code) codes.add(code);
        else fail(columnOf('categories'), `Catégorie inconnue « ${label} ».`);
      }
    }
    let categoryContents: Record<string, string | null> | undefined;
    mapping.forEach((field, index) => {
      if (!field?.startsWith(CATEGORY_FIELD_PREFIX)) return;
      const code = field.slice(CATEGORY_FIELD_PREFIX.length);
      const value = cellText(row.cells[index]);
      if (value.length > TEXT_LIMITS.category) {
        fail(index, `Contenu de catégorie : 3 000 caractères au maximum.`);
      }
      categoryContents = { ...categoryContents, [code]: value === '' ? null : value };
      if (value !== '') codes.add(code);
    });

    let planningNotes = optional('planningNotes', false);
    // Commentaires de cellule : informations de planification, reprises avec leur colonne.
    const notes = (row.notes ?? [])
      .map((note, index) =>
        note ? `Commentaire (${table.header[index] || keyOf(index)}) : ${note.trim()}` : null,
      )
      .filter((note): note is string => Boolean(note));
    if (notes.length > 0) {
      planningNotes = [planningNotes, ...notes].filter(Boolean).join('\n');
      if (planningNotes.length > TEXT_LIMITS.planningNotes) {
        fail(-1, 'Observations et commentaires : 3 000 caractères au maximum.');
      }
    }

    const sourceStatus = optional('sourceStatus');
    if (sourceStatus && !recognizeSourceStatus(sourceStatus)) {
      warn(
        columnOf('sourceStatus'),
        `Statut « ${sourceStatus} » non reconnu : conservé comme information, sans effet.`,
      );
    }
    if (has('month') && date) {
      const monthText = singleLine(text('month'));
      const month = monthText === '' ? null : parseMonthLabel(monthText);
      if (monthText !== '' && month !== date.slice(0, 7)) {
        warn(
          columnOf('month'),
          month
            ? `Mois « ${monthText} » différent de la date (${date}) : la date fait foi.`
            : `Mois « ${monthText} » non reconnu (contrôle seulement).`,
        );
      }
    }

    if (!date || messages.length > 0) {
      result.rejected.push({ line: row.line, date, title: title || null, messages });
      continue;
    }
    const importKey = programmeImportKey(date, title);
    const duplicateOf = seenKeys.get(importKey);
    if (duplicateOf !== undefined) {
      const message = `Doublon de la ligne ${duplicateOf} (même date et même intitulé).`;
      fail(titleColumn, message);
      result.rejected.push({ line: row.line, date, title, messages: [message] });
      continue;
    }
    seenKeys.set(importKey, row.line);
    result.categoryCodes.set(row.line, [...codes]);
    const source: ProgrammeSourceRow = { line: row.line, date, title, importKey };
    const assign = <K extends keyof ProgrammeSourceRow>(key: K, value: ProgrammeSourceRow[K]) => {
      if (value !== undefined) source[key] = value;
    };
    assign('theme', optional('theme'));
    assign('objectives', has('objectives') ? splitList(text('objectives'), /[;\n]/) : undefined);
    assign('categories', categoryList);
    assign('categoryContents', categoryContents);
    assign(
      'moduleCodes',
      has('moduleCodes')
        ? splitList(text('moduleCodes'), /[,;\s]+/).map((code) => code.toUpperCase())
        : undefined,
    );
    assign('leaderLabel', optional('leaderLabel'));
    assign('location', optional('location'));
    assign('format', optional('format'));
    assign('sourceStatus', sourceStatus);
    assign('sourceAttendance', integer('sourceAttendance'));
    assign('planningNotes', planningNotes);
    assign('sourceNumber', integer('sourceNumber'));
    result.rows.push(source);
  }
  return result;
}

/**
 * Correspondance effective : détection automatique, puis choix explicites (`overrides`, par clé de
 * colonne). Signale les colonnes obligatoires absentes, les champs attribués deux fois et — si
 * `strict` — toute colonne non reconnue qui contient des données (jamais ignorée en silence).
 */
export function resolveProgrammeMapping(
  table: Pick<ProgrammeTable, 'header' | 'columnKeys' | 'rows'>,
  categories: readonly ProgrammeCategoryRef[],
  overrides: Readonly<Record<string, string>> = {},
  strict = true,
): {
  mapping: (string | null)[];
  columns: ProgrammeImportColumn[];
  issues: ProgrammeImportIssue[];
} {
  const allowed = new Set(programmeFieldOptions(categories));
  const issues: ProgrammeImportIssue[] = [];
  const columns = table.header.map((header, index): ProgrammeImportColumn => {
    const key = table.columnKeys[index] ?? String(index + 1);
    const override = overrides[key];
    const detected = header.trim() === '' ? null : detectProgrammeField(header, categories);
    let field = detected;
    if (override !== undefined) {
      if (allowed.has(override)) field = override;
      else
        issues.push({
          severity: 'ERREUR',
          line: null,
          column: key,
          message: `Correspondance « ${override} » inconnue pour la colonne ${key}.`,
        });
    }
    const values = table.rows.map((row) => cellText(row.cells[index])).filter((v) => v !== '');
    return {
      key,
      header,
      field,
      auto: override === undefined && detected !== null,
      nonEmpty: values.length,
      sample: values[0]?.slice(0, 80) ?? null,
    };
  });
  const used = new Map<string, string>();
  for (const column of columns) {
    if (!column.field || column.field === IGNORED_COLUMN) continue;
    const previous = used.get(column.field);
    if (previous) {
      issues.push({
        severity: 'ERREUR',
        line: null,
        column: column.key,
        message: `Les colonnes ${previous} et ${column.key} correspondent au même champ : choisissez-en une.`,
      });
    } else used.set(column.field, column.key);
  }
  for (const field of ['date', 'title'] as const) {
    if (!used.has(field)) {
      issues.push({
        severity: 'ERREUR',
        line: null,
        column: null,
        message: `Colonne obligatoire non reconnue : « ${PROGRAMME_IMPORT_FIELD_LABELS[field]} ». Indiquez la colonne correspondante.`,
      });
    }
  }
  for (const column of columns) {
    if (column.field === null && column.nonEmpty > 0) {
      issues.push({
        severity: strict ? 'ERREUR' : 'AVERTISSEMENT',
        line: null,
        column: column.key,
        message: `Colonne « ${column.header || column.key} » non reconnue (${column.nonEmpty} valeur${column.nonEmpty > 1 ? 's' : ''}) : ${strict ? 'choisissez une correspondance ou « Ignorer ».' : 'ignorée.'}`,
      });
    }
  }
  const mapping = columns.map((column) =>
    column.field && column.field !== IGNORED_COLUMN && used.get(column.field) === column.key
      ? column.field
      : null,
  );
  return { mapping, columns, issues };
}

// ─── Markdown ───────────────────────────────────────────────────────────────

function splitCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

/** Tableau Markdown → tableau source (première ligne « | … | » = en-tête). */
export function markdownToProgrammeTable(content: string): ProgrammeTable | null {
  let table: ProgrammeTable | null = null;
  for (const [index, rawLine] of content.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line.startsWith('|')) continue;
    const cells = splitCells(line);
    if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue; // ligne de séparation
    if (!table) {
      table = {
        header: cells,
        columnKeys: cells.map((_, position) => String(position + 1)),
        rows: [],
      };
      continue;
    }
    table.rows.push({ line: index + 1, cells });
  }
  return table;
}

/** @deprecated Conservé pour compatibilité : utiliser `normalizeProgrammeTable`. */
export type ParsedProgrammeRow = ProgrammeSourceRow;

export interface ProgrammeParseResult {
  rows: ProgrammeSourceRow[];
  errors: { line: number; date: string | null; title: string | null; message: string }[];
}

/**
 * Analyse un tableau Markdown du programme (colonnes Date et Activité obligatoires). Les catégories
 * de la colonne « Catégories » sont conservées telles quelles (résolues par l'API).
 */
export function parseProgrammeMarkdown(content: string): ProgrammeParseResult {
  const table = markdownToProgrammeTable(content);
  if (!table) {
    return {
      rows: [],
      errors: [
        {
          line: 0,
          date: null,
          title: null,
          message: 'Aucun tableau Markdown trouvé (lignes commençant par « | »).',
        },
      ],
    };
  }
  const { mapping } = resolveProgrammeMapping(table, [], {}, false);
  if (!mapping.includes('date') || !mapping.includes('title')) {
    return {
      rows: [],
      errors: [
        {
          line: 1,
          date: null,
          title: null,
          message: 'En-tête invalide : les colonnes « Date » et « Activité » sont obligatoires.',
        },
      ],
    };
  }
  // Catégories résolues plus tard : la normalisation ne les contrôle pas ici.
  const categoryColumn = mapping.indexOf('categories');
  const withoutCategories = mapping.map((field) => (field === 'categories' ? null : field));
  const result = normalizeProgrammeTable(table, withoutCategories, []);
  for (const row of result.rows) {
    const source = table.rows.find((r) => r.line === row.line);
    row.categories =
      categoryColumn < 0 ? [] : splitList(cellText(source?.cells[categoryColumn]), /[,;]/);
    row.objectives ??= [];
    row.moduleCodes ??= [];
    row.theme ??= null;
    row.leaderLabel ??= null;
    row.location ??= null;
  }
  return {
    rows: result.rows,
    errors: result.rejected.flatMap((rejected) =>
      rejected.messages.map((message) => ({
        line: rejected.line,
        date: rejected.date,
        title: rejected.title,
        message,
      })),
    ),
  };
}

// ─── Contrats d'API ─────────────────────────────────────────────────────────

/** Taille maximale d'un classeur (octets) : un programme annuel pèse quelques centaines de ko. */
export const PROGRAMME_XLSX_MAX_BYTES = 2 * 1024 * 1024;

export const IMPORT_ROW_ACTIONS = [
  'CREER',
  'METTRE_A_JOUR',
  'INCHANGEE',
  'CONSERVEE_MANUELLE',
  'A_DECIDER',
  'IGNOREE',
  'ERREUR',
] as const;

export type ImportRowAction = (typeof IMPORT_ROW_ACTIONS)[number];

export const IMPORT_ROW_ACTION_LABELS: Record<ImportRowAction, string> = {
  CREER: 'Sera créée',
  METTRE_A_JOUR: 'Sera mise à jour',
  INCHANGEE: 'Déjà à jour',
  CONSERVEE_MANUELLE: 'Protégée : conservée',
  A_DECIDER: 'Rapprochement à décider',
  IGNOREE: 'Ignorée sur décision',
  ERREUR: 'Erreur : ignorée',
};

/** Décision sur une ligne (rapprochement incertain, ou ligne à ne pas importer). */
export const importDecisionSchema = z.discriminatedUnion('action', [
  z.object({ line: z.number().int().min(1), action: z.literal('CREER') }),
  z.object({ line: z.number().int().min(1), action: z.literal('IGNORER') }),
  z.object({
    line: z.number().int().min(1),
    action: z.literal('METTRE_A_JOUR'),
    activityId: z.uuid(),
  }),
]);

export type ImportDecision = z.infer<typeof importDecisionSchema>;

const decisionsSchema = z
  .array(importDecisionSchema)
  .max(1000)
  .refine((items) => new Set(items.map((item) => item.line)).size === items.length, {
    message: 'Une ligne a reçu plusieurs décisions.',
  });

const fingerprintSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/, { error: 'Empreinte de prévisualisation invalide.' });

export const programmeImportInputSchema = z.object({
  content: z
    .string()
    .min(1, { error: 'Collez le tableau du programme.' })
    .max(200_000, { error: 'Contenu trop volumineux (200 000 caractères au maximum).' }),
  decisions: decisionsSchema.optional(),
  fingerprint: fingerprintSchema.optional(),
});

export type ProgrammeImportInput = z.input<typeof programmeImportInputSchema>;

export const programmeExcelImportInputSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/\.xlsx$/i, { error: 'Seuls les classeurs .xlsx sont acceptés.' }),
  fileBase64: z
    .string()
    .min(1, { error: 'Fichier vide.' })
    .max(Math.ceil(PROGRAMME_XLSX_MAX_BYTES / 3) * 4 + 4, {
      error: 'Fichier trop volumineux (2 Mo au maximum).',
    })
    .regex(/^[A-Za-z0-9+/]*={0,2}$/, { error: 'Contenu du fichier illisible.' }),
  sheet: z.string().max(100).optional(),
  headerRow: z.number().int().min(1).max(10_000).optional(),
  /** Correspondances choisies : clé de colonne (lettre) → champ, `category:CODE` ou `ignore`. */
  mapping: z.record(z.string().regex(/^[A-Z]{1,3}$/), z.string().max(60)).optional(),
  decisions: decisionsSchema.optional(),
  /** Obligatoire à la confirmation : empreinte de la prévisualisation examinée. */
  fingerprint: fingerprintSchema.optional(),
});

export type ProgrammeExcelImportInput = z.input<typeof programmeExcelImportInputSchema>;

export interface ProgrammeImportColumn {
  key: string;
  header: string;
  field: string | null;
  auto: boolean;
  nonEmpty: number;
  sample: string | null;
}

const activityRefSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  plannedOn: z.iso.date(),
  status: z.enum(['PLANIFIEE', 'REPORTEE', 'REALISEE', 'ANNULEE']),
});

export const programmeImportReportSchema = z.object({
  applied: z.boolean(),
  /** Empreinte de la prévisualisation : la confirmation est refusée si l'état a changé. */
  fingerprint: z.string(),
  importId: z.uuid().nullable(),
  source: z.object({
    format: z.enum(['XLSX', 'MARKDOWN']),
    fileName: z.string().nullable(),
    sheet: z.string().nullable(),
    sheets: z.array(z.object({ name: z.string(), rows: z.number().int(), hidden: z.boolean() })),
    headerLine: z.number().int().nullable(),
    dataRows: z.number().int(),
  }),
  columns: z.array(
    z.object({
      key: z.string(),
      header: z.string(),
      field: z.string().nullable(),
      auto: z.boolean(),
      nonEmpty: z.number().int(),
      sample: z.string().nullable(),
    }),
  ),
  issues: z.array(
    z.object({
      severity: z.enum(IMPORT_ISSUE_SEVERITIES),
      line: z.number().int().nullable(),
      column: z.string().nullable(),
      message: z.string(),
    }),
  ),
  rows: z.array(
    z.object({
      line: z.number().int(),
      date: z.string().nullable(),
      title: z.string().nullable(),
      action: z.enum(IMPORT_ROW_ACTIONS),
      messages: z.array(z.string()),
      activityId: z.uuid().nullable(),
      candidates: z.array(activityRefSchema),
      changes: z.array(
        z.object({
          field: z.string(),
          label: z.string(),
          from: z.string().nullable(),
          to: z.string().nullable(),
        }),
      ),
      protection: z.array(z.string()),
      planned: z
        .object({
          theme: z.string().nullable(),
          format: z.string().nullable(),
          leaderLabel: z.string().nullable(),
          location: z.string().nullable(),
          objectives: z.array(z.string()),
          sourceStatus: z.string().nullable(),
          sourceStatusRecognized: z.enum(SOURCE_STATUS_VALUES).nullable(),
          sourceAttendance: z.number().int().nullable(),
          planningNotes: z.string().nullable(),
          categories: z.array(
            z.object({ code: z.string(), label: z.string(), content: z.string().nullable() }),
          ),
        })
        .nullable(),
    }),
  ),
  counts: z.record(z.enum(IMPORT_ROW_ACTIONS), z.number().int()),
  /** Séances du programme absentes de la source : jamais supprimées, seulement signalées. */
  absent: z.array(activityRefSchema),
});

export type ProgrammeImportReport = z.infer<typeof programmeImportReportSchema>;

export const programmeImportHistorySchema = z.object({
  items: z.array(
    z.object({
      id: z.uuid(),
      format: z.enum(['XLSX', 'MARKDOWN']),
      fileName: z.string().nullable(),
      fileSha256: z.string().nullable(),
      sheet: z.string().nullable(),
      counts: z.record(z.string(), z.number().int()),
      actor: userSummarySchema,
      createdAt: z.iso.datetime(),
    }),
  ),
});

export type ProgrammeImportHistory = z.infer<typeof programmeImportHistorySchema>;

import { z } from 'zod';
import { paginationQuerySchema, searchQuerySchema, userSummarySchema } from './api.js';
import { competencyRefSchema, scoutRefSchema } from './progression.js';
import { stageSummarySchema } from './scouts.js';

// Programme annuel, activités et présences. Règles : docs/FEATURES/PROGRAMME_ANNUEL.md et
// docs/FEATURES/SUIVI_ACTIVITES.md. L'assiduité est une information d'accompagnement : elle ne
// déclenche ni sanction, ni promotion, ni validation.

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `${max.toLocaleString('fr-FR')} caractères au maximum.` })
    .transform((value) => (value === '' ? null : value));

const requiredText = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, {
      error: `${label} est obligatoire (${min} caractère${min > 1 ? 's' : ''} au minimum).`,
    })
    .max(max, { error: `${max.toLocaleString('fr-FR')} caractères au maximum.` });

const calendarDate = z.iso.date({ error: 'Date invalide (AAAA-MM-JJ).' });

// ─── Catégories du programme ────────────────────────────────────────────────

/**
 * Catégories employées par le programme annuel 2026–2027. Leur correspondance avec les étapes du
 * manuel n'est **pas présumée** : la proposition ci-dessous (`proposedStageCode`) est chargée « à
 * confirmer » et n'est utilisée par aucune règle automatique (docs/DECISIONS.md, D70).
 */
export const PROGRAMME_CATEGORIES = [
  { code: 'NOVICES', label: 'Novices Routiers', order: 1, proposedStageCode: 'NOVICIAT' },
  { code: 'ASPIRANTS', label: 'Aspirants Routiers', order: 2, proposedStageCode: 'APPRENTISSAGE' },
  {
    code: 'COMPAGNONS',
    label: 'Compagnons Routiers',
    order: 3,
    proposedStageCode: 'COMPAGNONNAGE',
  },
  { code: 'CONFIRMES', label: 'Routiers Confirmés', order: 4, proposedStageCode: 'DEPART_ROUTIER' },
] as const;

export const programmeCategorySchema = z.object({
  id: z.uuid(),
  code: z.string(),
  label: z.string(),
  stage: stageSummarySchema.nullable(),
  /** Correspondance confirmée par le responsable. */
  correspondenceValidated: z.boolean(),
  position: z.number().int(),
});

export type ProgrammeCategory = z.infer<typeof programmeCategorySchema>;

export const programmeCategoryListSchema = z.object({ items: z.array(programmeCategorySchema) });

export const updateProgrammeCategoryInputSchema = z
  .object({
    stageId: z.uuid().nullable().optional(),
    correspondenceValidated: z.boolean().optional(),
  })
  .refine((value) => value.stageId !== undefined || value.correspondenceValidated !== undefined, {
    message: 'Aucune modification fournie.',
  });

export type UpdateProgrammeCategoryInput = z.input<typeof updateProgrammeCategoryInputSchema>;

export const programmeSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  title: z.string(),
  startsOn: z.iso.date().nullable(),
  endsOn: z.iso.date().nullable(),
  activityCount: z.number().int(),
  realisedCount: z.number().int(),
});

export type Programme = z.infer<typeof programmeSchema>;

export const programmeListSchema = z.object({ items: z.array(programmeSchema) });

// ─── Activités ──────────────────────────────────────────────────────────────

/** Synchronisés avec les enums Prisma (vérifié par un test). */
export const ACTIVITY_STATUSES = ['PLANIFIEE', 'REPORTEE', 'REALISEE', 'ANNULEE'] as const;

export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  PLANIFIEE: 'Planifiée',
  REPORTEE: 'Reportée',
  REALISEE: 'Réalisée',
  ANNULEE: 'Annulée',
};

export const ACTIVITY_ORIGINS = ['PROGRAMME', 'SUPPLEMENTAIRE'] as const;

export type ActivityOrigin = (typeof ACTIVITY_ORIGINS)[number];

export const ACTIVITY_ORIGIN_LABELS: Record<ActivityOrigin, string> = {
  PROGRAMME: 'Programme annuel',
  SUPPLEMENTAIRE: 'Activité supplémentaire',
};

export const ACTIVITY_ACTIONS = [
  'CREEE',
  'IMPORTEE',
  'MODIFIEE',
  'STATUT_MODIFIE',
  'PRESENCES_ENREGISTREES',
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export const ACTIVITY_ACTION_LABELS: Record<ActivityAction, string> = {
  CREEE: 'Activité créée',
  IMPORTEE: 'Importée du programme',
  MODIFIEE: 'Modifiée',
  STATUT_MODIFIE: 'Statut modifié',
  PRESENCES_ENREGISTREES: 'Présences enregistrées',
};

const objectivesSchema = z
  .array(requiredText(1, 300, 'L’objectif'))
  .max(20, { error: '20 objectifs au maximum.' });

const idListSchema = z.array(z.uuid()).max(30, { error: '30 éléments au maximum.' });

export const createActivityInputSchema = z
  .object({
    origin: z.enum(ACTIVITY_ORIGINS).default('SUPPLEMENTAIRE'),
    programmeId: z.uuid().optional(),
    title: requiredText(1, 200, 'Le titre'),
    theme: optionalText(150).optional(),
    description: z.string().trim().max(5000).default(''),
    objectives: objectivesSchema.default([]),
    plannedOn: calendarDate,
    plannedLocation: optionalText(200).optional(),
    leaderLabel: optionalText(150).optional(),
    categoryIds: idListSchema.default([]),
    moduleIds: idListSchema.default([]),
    competencyIds: idListSchema.default([]),
  })
  .refine((value) => value.origin !== 'PROGRAMME' || value.programmeId !== undefined, {
    message: 'Une séance du programme doit être rattachée au programme annuel.',
    path: ['programmeId'],
  });

export type CreateActivityInput = z.input<typeof createActivityInputSchema>;

/** Modification (révision lue obligatoire). Le statut se change par `POST /activities/:id/status`. */
export const updateActivityInputSchema = z.object({
  revision: z.number().int().min(1),
  title: requiredText(1, 200, 'Le titre').optional(),
  theme: optionalText(150).nullable().optional(),
  description: z.string().trim().max(5000).optional(),
  objectives: objectivesSchema.optional(),
  plannedOn: calendarDate.optional(),
  plannedLocation: optionalText(200).nullable().optional(),
  leaderLabel: optionalText(150).nullable().optional(),
  categoryIds: idListSchema.optional(),
  moduleIds: idListSchema.optional(),
  competencyIds: idListSchema.optional(),
  /** Compétences effectivement observées (sous-ensemble de `competencyIds`). */
  observedCompetencyIds: idListSchema.optional(),
  location: optionalText(200).nullable().optional(),
  contentDone: optionalText(5000).nullable().optional(),
  difficulties: optionalText(3000).nullable().optional(),
  observations: optionalText(3000).nullable().optional(),
  report: optionalText(10000).nullable().optional(),
});

export type UpdateActivityInput = z.input<typeof updateActivityInputSchema>;

export const changeActivityStatusInputSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('REALISEE'),
    revision: z.number().int().min(1),
    heldOn: calendarDate,
    location: optionalText(200).optional(),
  }),
  z.object({
    status: z.literal('REPORTEE'),
    revision: z.number().int().min(1),
    /** Nouvelle date prévue. */
    postponedTo: calendarDate,
    reason: requiredText(3, 1000, 'Le motif'),
  }),
  z.object({
    status: z.literal('ANNULEE'),
    revision: z.number().int().min(1),
    reason: requiredText(3, 1000, 'Le motif'),
  }),
  z.object({
    status: z.literal('PLANIFIEE'),
    revision: z.number().int().min(1),
    reason: requiredText(3, 1000, 'Le motif'),
  }),
]);

export type ChangeActivityStatusInput = z.input<typeof changeActivityStatusInputSchema>;

export const activityListQuerySchema = paginationQuerySchema.extend({
  search: searchQuerySchema,
  programmeId: z.uuid().optional(),
  origin: z.enum(ACTIVITY_ORIGINS).optional(),
  status: z.enum(ACTIVITY_STATUSES).optional(),
  categoryId: z.uuid().optional(),
  from: calendarDate.optional(),
  to: calendarDate.optional(),
  /** `true` : activités dont les présences restent à saisir (réalisées ou passées, aucune présence). */
  attendanceMissing: z.enum(['true', 'false']).optional(),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export type ActivityListQuery = z.input<typeof activityListQuerySchema>;

export const attendanceCountsSchema = z.object({
  present: z.number().int(),
  absent: z.number().int(),
  excused: z.number().int(),
});

export type AttendanceCounts = z.infer<typeof attendanceCountsSchema>;

export const activitySummarySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  theme: z.string().nullable(),
  origin: z.enum(ACTIVITY_ORIGINS),
  status: z.enum(ACTIVITY_STATUSES),
  plannedOn: z.iso.date(),
  heldOn: z.iso.date().nullable(),
  leaderLabel: z.string().nullable(),
  categories: z.array(z.object({ id: z.uuid(), label: z.string() })),
  attendance: attendanceCountsSchema,
});

export type ActivitySummary = z.infer<typeof activitySummarySchema>;

export const activityEventSchema = z.object({
  id: z.uuid(),
  action: z.enum(ACTIVITY_ACTIONS),
  fromStatus: z.enum(ACTIVITY_STATUSES).nullable(),
  toStatus: z.enum(ACTIVITY_STATUSES).nullable(),
  comment: z.string().nullable(),
  /** Champs modifiés (noms), pour l'historique des modifications sensibles. */
  fields: z.array(z.string()),
  actor: userSummarySchema,
  createdAt: z.iso.datetime(),
});

export const activityDetailSchema = activitySummarySchema.extend({
  programme: z.object({ id: z.uuid(), title: z.string() }).nullable(),
  description: z.string(),
  objectives: z.array(z.string()),
  plannedLocation: z.string().nullable(),
  location: z.string().nullable(),
  contentDone: z.string().nullable(),
  difficulties: z.string().nullable(),
  observations: z.string().nullable(),
  report: z.string().nullable(),
  statusReason: z.string().nullable(),
  imported: z.boolean(),
  manuallyEditedAt: z.iso.datetime().nullable(),
  revision: z.number().int(),
  modules: z.array(z.object({ id: z.uuid(), code: z.string(), title: z.string() })),
  competencies: z.array(competencyRefSchema.extend({ observed: z.boolean() })),
  events: z.array(activityEventSchema),
  createdBy: userSummarySchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type ActivityDetail = z.infer<typeof activityDetailSchema>;

// ─── Présences ──────────────────────────────────────────────────────────────

export const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'EXCUSE'] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/** « Non renseigné » n'est jamais enregistré : c'est l'absence de saisie (jamais « absent » par défaut). */
export const NOT_RECORDED = 'NON_RENSEIGNE';

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus | typeof NOT_RECORDED, string> = {
  PRESENT: 'Présent',
  ABSENT: 'Absent',
  EXCUSE: 'Excusé',
  NON_RENSEIGNE: 'Non renseigné',
};

export const saveAttendanceInputSchema = z.object({
  entries: z
    .array(
      z.object({
        scoutProfileId: z.uuid(),
        status: z.enum(ATTENDANCE_STATUSES, { error: 'Statut de présence invalide.' }),
        note: optionalText(300).optional(),
        /**
         * Statut vu lors de la saisie (synchronisation différée) : si la présence a changé
         * entre-temps sur le serveur, la saisie est refusée en conflit plutôt qu'écrasée.
         */
        expectedStatus: z.enum([...ATTENDANCE_STATUSES, NOT_RECORDED]).optional(),
      }),
    )
    .min(1, { error: 'Aucune présence à enregistrer.' })
    .max(200, { error: '200 lignes au maximum.' })
    .refine(
      (entries) => new Set(entries.map((entry) => entry.scoutProfileId)).size === entries.length,
      { message: 'Un routier apparaît plusieurs fois dans la saisie.' },
    ),
});

export type SaveAttendanceInput = z.input<typeof saveAttendanceInputSchema>;

export const attendanceSheetSchema = z.object({
  activity: activitySummarySchema,
  /** Saisie possible : activité réalisée, ou planifiée dont la date est passée. */
  editable: z.boolean(),
  entries: z.array(
    z.object({
      scout: scoutRefSchema,
      status: z.enum([...ATTENDANCE_STATUSES, NOT_RECORDED]),
      note: z.string().nullable(),
      recordedBy: userSummarySchema.nullable(),
      updatedAt: z.iso.datetime().nullable(),
    }),
  ),
});

export type AttendanceSheet = z.infer<typeof attendanceSheetSchema>;

// ─── Import du programme (Markdown) ─────────────────────────────────────────

export const programmeImportInputSchema = z.object({
  content: z
    .string()
    .min(1, { error: 'Collez le tableau du programme.' })
    .max(200_000, { error: 'Contenu trop volumineux (200 000 caractères au maximum).' }),
});

export type ProgrammeImportInput = z.input<typeof programmeImportInputSchema>;

export const IMPORT_ROW_ACTIONS = [
  'CREER',
  'METTRE_A_JOUR',
  'INCHANGEE',
  'CONSERVEE_MANUELLE',
  'ERREUR',
] as const;

export type ImportRowAction = (typeof IMPORT_ROW_ACTIONS)[number];

export const IMPORT_ROW_ACTION_LABELS: Record<ImportRowAction, string> = {
  CREER: 'Sera créée',
  METTRE_A_JOUR: 'Sera mise à jour',
  INCHANGEE: 'Déjà à jour',
  CONSERVEE_MANUELLE: 'Modifiée manuellement : conservée',
  ERREUR: 'Erreur : ignorée',
};

export const programmeImportReportSchema = z.object({
  applied: z.boolean(),
  rows: z.array(
    z.object({
      line: z.number().int(),
      date: z.string().nullable(),
      title: z.string().nullable(),
      action: z.enum(IMPORT_ROW_ACTIONS),
      messages: z.array(z.string()),
    }),
  ),
  counts: z.record(z.enum(IMPORT_ROW_ACTIONS), z.number().int()),
});

export type ProgrammeImportReport = z.infer<typeof programmeImportReportSchema>;

export interface ParsedProgrammeRow {
  line: number;
  date: string;
  title: string;
  theme: string | null;
  categories: string[];
  objectives: string[];
  moduleCodes: string[];
  leaderLabel: string | null;
  location: string | null;
  importKey: string;
}

export interface ProgrammeParseResult {
  rows: ParsedProgrammeRow[];
  errors: { line: number; date: string | null; title: string | null; message: string }[];
}

/** En-têtes reconnus (sans accents, minuscules) → champ. `date` et `activite` sont obligatoires. */
const HEADER_ALIASES: Record<string, keyof ParsedProgrammeRow | 'skip'> = {
  date: 'date',
  categories: 'categories',
  categorie: 'categories',
  niveaux: 'categories',
  theme: 'theme',
  activite: 'title',
  activites: 'title',
  seance: 'title',
  titre: 'title',
  objectifs: 'objectives',
  objectif: 'objectives',
  modules: 'moduleCodes',
  module: 'moduleCodes',
  responsable: 'leaderLabel',
  responsables: 'leaderLabel',
  lieu: 'location',
};

function normalizeLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Clé d'idempotence : date + titre normalisé (accents, casse et ponctuation ignorés). */
export function programmeImportKey(date: string, title: string): string {
  return `${date}|${normalizeLabel(title).replace(/ /g, '-')}`;
}

/** Accepte AAAA-MM-JJ ou JJ/MM/AAAA ; renvoie AAAA-MM-JJ ou null si la date n'existe pas. */
export function parseProgrammeDate(raw: string): string | null {
  const value = raw.trim();
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  let iso: string | null = null;
  if (match) iso = `${match[1]}-${match[2]}-${match[3]}`;
  match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (match) iso = `${match[3]}-${match[2]!.padStart(2, '0')}-${match[1]!.padStart(2, '0')}`;
  if (!iso) return null;
  const date = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}

function splitList(value: string, separators: RegExp): string[] {
  return value
    .split(separators)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

/**
 * Analyse un tableau Markdown du programme annuel (format : docs/FEATURES/PROGRAMME_ANNUEL.md).
 * Fonction pure : aucune écriture, aucune donnée inventée ; une ligne non conforme est signalée.
 */
export function parseProgrammeMarkdown(content: string): ProgrammeParseResult {
  const lines = content.split(/\r?\n/);
  const result: ProgrammeParseResult = { rows: [], errors: [] };
  let columns: (keyof ParsedProgrammeRow | 'skip')[] | null = null;
  const seenKeys = new Map<string, number>();

  for (const [index, rawLine] of lines.entries()) {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (!line.startsWith('|')) continue;
    const cells = splitCells(line);
    if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue; // ligne de séparation
    if (!columns) {
      columns = cells.map((cell) => HEADER_ALIASES[normalizeLabel(cell)] ?? 'skip');
      if (!columns.includes('date') || !columns.includes('title')) {
        result.errors.push({
          line: lineNumber,
          date: null,
          title: null,
          message: 'En-tête invalide : les colonnes « Date » et « Activité » sont obligatoires.',
        });
        columns = null;
      }
      continue;
    }
    const values: Partial<Record<keyof ParsedProgrammeRow, string>> = {};
    for (const [position, column] of columns.entries()) {
      if (column !== 'skip') values[column] = cells[position] ?? '';
    }
    const title = (values.title ?? '').trim();
    const rawDate = (values.date ?? '').trim();
    const date = parseProgrammeDate(rawDate);
    if (!date) {
      result.errors.push({
        line: lineNumber,
        date: rawDate || null,
        title: title || null,
        message: `Date invalide « ${rawDate} » (attendu : AAAA-MM-JJ ou JJ/MM/AAAA).`,
      });
      continue;
    }
    if (title === '' || title.length > 200) {
      result.errors.push({
        line: lineNumber,
        date,
        title: title || null,
        message: 'Intitulé de l’activité manquant ou trop long (200 caractères au maximum).',
      });
      continue;
    }
    const importKey = programmeImportKey(date, title);
    const duplicateOf = seenKeys.get(importKey);
    if (duplicateOf !== undefined) {
      result.errors.push({
        line: lineNumber,
        date,
        title,
        message: `Doublon de la ligne ${duplicateOf} (même date et même intitulé).`,
      });
      continue;
    }
    seenKeys.set(importKey, lineNumber);
    const text = (value: string | undefined) =>
      value && value.trim() !== '' ? value.trim() : null;
    result.rows.push({
      line: lineNumber,
      date,
      title,
      theme: text(values.theme),
      categories: splitList(values.categories ?? '', /[,;]/),
      objectives: splitList(values.objectives ?? '', /;/),
      moduleCodes: splitList(values.moduleCodes ?? '', /[,;\s]+/).map((code) => code.toUpperCase()),
      leaderLabel: text(values.leaderLabel),
      location: text(values.location),
      importKey,
    });
  }

  if (!columns && result.errors.length === 0) {
    result.errors.push({
      line: 0,
      date: null,
      title: null,
      message: 'Aucun tableau Markdown trouvé (lignes commençant par « | »).',
    });
  }
  return result;
}

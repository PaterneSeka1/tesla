import { createHash } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  ACTIVITY_STATUS_LABELS,
  CATEGORY_FIELD_PREFIX,
  columnLetter,
  formatModuleCode,
  IMPORT_ROW_ACTIONS,
  type ImportDecision,
  type ImportRowAction,
  markdownToProgrammeTable,
  normalizeLabel,
  normalizeProgrammeTable,
  PROGRAMME_XLSX_MAX_BYTES,
  type ProgrammeExcelImportInput,
  programmeExcelImportInputSchema,
  type ProgrammeImportColumn,
  type ProgrammeImportInput,
  programmeImportInputSchema,
  type ProgrammeImportIssue,
  type ProgrammeImportReport,
  type ProgrammeSourceRow,
  type ProgrammeTable,
  recognizeSourceStatus,
  resolveProgrammeMapping,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan } from '../../common/permissions.js';
import { parseInput } from '../../common/validation.js';
import { type Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { isoToDate } from '../progression/progression-common.js';
import { toIsoDate } from '../scouts/presenters.js';
import { readXlsx, XlsxReadError, type XlsxSheet } from './xlsx-reader.js';

type Tx = Prisma.TransactionClient;

/** Lignes examinées pour trouver l'en-tête (titres et bandeaux au-dessus du tableau). */
const HEADER_SCAN_ROWS = 50;

interface Category {
  id: string;
  code: string;
  label: string;
}

/** Source analysée, indépendante du format. */
interface ImportSource {
  format: 'XLSX' | 'MARKDOWN';
  fileName: string | null;
  /** Empreinte du fichier (Excel) ou du texte (Markdown). */
  sha256: string;
  sheet: string | null;
  sheets: ProgrammeImportReport['source']['sheets'];
  headerLine: number | null;
  table: ProgrammeTable | null;
  mapping: (string | null)[];
  columns: ProgrammeImportColumn[];
  issues: ProgrammeImportIssue[];
}

const existingInclude = {
  categories: true,
  modules: true,
  _count: { select: { attendances: true } },
} as const satisfies Prisma.ActivityInclude;

type ExistingActivity = Prisma.ActivityGetPayload<{ include: typeof existingInclude }>;

type Row = ProgrammeImportReport['rows'][number];

interface PlannedRow extends Row {
  source: ProgrammeSourceRow | null;
  existing: ExistingActivity | null;
  categoryContents: Map<string, string | null> | null;
  moduleIds: string[] | null;
}

interface Plan {
  rows: PlannedRow[];
  issues: ProgrammeImportIssue[];
  absent: ProgrammeImportReport['absent'];
  fingerprint: string;
}

const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

function activityRef(activity: ExistingActivity) {
  return {
    id: activity.id,
    title: activity.title,
    plannedOn: toIsoDate(activity.plannedOn),
    status: activity.status,
  };
}

function invalidFile(message: string): UnprocessableEntityException {
  return new UnprocessableEntityException({ code: 'IMPORT_FILE_INVALID', message });
}

/**
 * Import du programme annuel, commun au Markdown et à l'Excel : analyse (aucune écriture), puis
 * confirmation transactionnelle. Principes (D172) : rien n'est supprimé, une séance protégée
 * (modifiée à la main, statut opérationnel, présences, compte rendu) n'est jamais réécrite, un
 * rapprochement incertain est tranché par le responsable, le statut du fichier reste une
 * information. Le fichier n'est jamais conservé : seuls son nom et son empreinte sont historisés.
 */
@Injectable()
export class ProgrammeImportService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Points d'entrée ────────────────────────────────────────────────────────

  async previewMarkdown(actor: Actor, programmeId: string, input: ProgrammeImportInput) {
    assertCan(actor, 'programme.configure');
    const data = parseInput(programmeImportInputSchema, input);
    const categories = await this.categories();
    const source = this.markdownSource(data.content, categories);
    return this.preview(programmeId, source, categories, data.decisions ?? []);
  }

  async applyMarkdown(actor: Actor, programmeId: string, input: ProgrammeImportInput) {
    assertCan(actor, 'programme.configure');
    const data = parseInput(programmeImportInputSchema, input);
    const categories = await this.categories();
    const source = this.markdownSource(data.content, categories);
    // Compatibilité : l'empreinte reste facultative pour le Markdown.
    return this.apply(
      actor,
      programmeId,
      source,
      categories,
      data.decisions ?? [],
      data.fingerprint,
    );
  }

  async previewExcel(actor: Actor, programmeId: string, input: ProgrammeExcelImportInput) {
    assertCan(actor, 'programme.configure');
    const data = parseInput(programmeExcelImportInputSchema, input);
    const categories = await this.categories();
    const source = this.excelSource(data, categories);
    return this.preview(programmeId, source, categories, data.decisions ?? []);
  }

  async applyExcel(actor: Actor, programmeId: string, input: ProgrammeExcelImportInput) {
    assertCan(actor, 'programme.configure');
    const data = parseInput(programmeExcelImportInputSchema, input);
    if (!data.fingerprint) {
      throw new UnprocessableEntityException({
        code: 'IMPORT_PREVIEW_REQUIRED',
        message: 'Prévisualisez le classeur avant de confirmer l’import.',
      });
    }
    const categories = await this.categories();
    const source = this.excelSource(data, categories);
    return this.apply(
      actor,
      programmeId,
      source,
      categories,
      data.decisions ?? [],
      data.fingerprint,
    );
  }

  // ─── Sources ────────────────────────────────────────────────────────────────

  private async categories(): Promise<Category[]> {
    return this.prisma.programmeCategory.findMany({
      select: { id: true, code: true, label: true },
      orderBy: { position: 'asc' },
    });
  }

  private markdownSource(content: string, categories: Category[]): ImportSource {
    const table = markdownToProgrammeTable(content);
    const base = {
      format: 'MARKDOWN' as const,
      fileName: null,
      sha256: sha256(content),
      sheet: null,
      sheets: [],
      headerLine: null,
    };
    if (!table) {
      return {
        ...base,
        table: null,
        mapping: [],
        columns: [],
        issues: [
          {
            severity: 'ERREUR',
            line: null,
            column: null,
            message: 'Aucun tableau Markdown trouvé (lignes commençant par « | »).',
          },
        ],
      };
    }
    // Markdown : une colonne inconnue est signalée sans bloquer (comportement historique).
    const resolved = resolveProgrammeMapping(table, categories, {}, false);
    return { ...base, table, ...resolved };
  }

  private excelSource(
    input: ReturnType<typeof programmeExcelImportInputSchema.parse>,
    categories: Category[],
  ): ImportSource {
    const buffer = Buffer.from(input.fileBase64, 'base64');
    if (buffer.length === 0) throw invalidFile('Fichier vide.');
    if (buffer.length > PROGRAMME_XLSX_MAX_BYTES) {
      throw invalidFile('Fichier trop volumineux (2 Mo au maximum).');
    }
    let workbook;
    try {
      workbook = readXlsx(buffer);
    } catch (error) {
      if (error instanceof XlsxReadError) throw invalidFile(error.message);
      throw invalidFile('Classeur illisible ou endommagé.');
    }
    const sheets = workbook.sheets.map((s) => ({
      name: s.name,
      rows: s.rows.length,
      hidden: s.hidden,
    }));
    const sheet = input.sheet
      ? workbook.sheets.find((s) => s.name === input.sheet)
      : (workbook.sheets.find((s) => !s.hidden && s.rows.length > 0) ?? workbook.sheets[0]);
    if (!sheet) throw invalidFile(`Feuille « ${input.sheet} » introuvable dans le classeur.`);
    const issues: ProgrammeImportIssue[] = [];
    const columnKeys = Array.from({ length: sheet.columnCount }, (_, i) => columnLetter(i));
    const headerRow = this.findHeaderRow(sheet, columnKeys, categories, input.headerRow);
    if (!headerRow) {
      return {
        format: 'XLSX',
        fileName: input.fileName,
        sha256: sha256(buffer),
        sheet: sheet.name,
        sheets,
        headerLine: null,
        table: null,
        mapping: [],
        columns: [],
        issues: [
          {
            severity: 'ERREUR',
            line: input.headerRow ?? null,
            column: null,
            message:
              sheet.rows.length === 0
                ? `La feuille « ${sheet.name} » est vide.`
                : 'Ligne d’en-tête introuvable : indiquez le numéro de la ligne qui contient les titres des colonnes.',
          },
        ],
      };
    }
    const table: ProgrammeTable = {
      header: headerRow.cells.map((cell) => (cell === null ? '' : String(cell).trim())),
      columnKeys,
      rows: sheet.rows.filter((row) => row.line > headerRow.line),
      excelDates: { date1904: workbook.date1904 },
    };
    const resolved = resolveProgrammeMapping(table, categories, input.mapping ?? {}, true);
    issues.push(...resolved.issues, ...this.sheetIssues(sheet, headerRow.line, columnKeys));
    return {
      format: 'XLSX',
      fileName: input.fileName,
      sha256: sha256(buffer),
      sheet: sheet.name,
      sheets,
      headerLine: headerRow.line,
      table,
      mapping: resolved.mapping,
      columns: resolved.columns,
      issues,
    };
  }

  /** Ligne d'en-tête : celle demandée, sinon la première qui contient Date et Intitulé. */
  private findHeaderRow(
    sheet: XlsxSheet,
    columnKeys: string[],
    categories: Category[],
    requested?: number,
  ) {
    if (requested !== undefined) return sheet.rows.find((row) => row.line === requested) ?? null;
    let best: { row: XlsxSheet['rows'][number]; score: number } | null = null;
    for (const row of sheet.rows.slice(0, HEADER_SCAN_ROWS)) {
      const header = row.cells.map((cell) => (typeof cell === 'string' ? cell : ''));
      const { columns } = resolveProgrammeMapping(
        { header, columnKeys, rows: [] },
        categories,
        {},
        false,
      );
      const fields = columns.map((column) => column.field);
      if (fields.includes('date') && fields.includes('title')) return row;
      const score = fields.filter(Boolean).length;
      if (score >= 2 && (!best || score > best.score)) best = { row, score };
    }
    return best?.row ?? null;
  }

  /** Avertissements propres au classeur : fusions, formules, erreurs, commentaires hors tableau. */
  private sheetIssues(sheet: XlsxSheet, headerLine: number, keys: string[]) {
    const issues: ProgrammeImportIssue[] = [];
    const warn = (line: number | null, column: string | null, message: string) =>
      issues.push({ severity: 'AVERTISSEMENT', line, column, message });
    for (const merge of sheet.merges) {
      if (merge.endRow <= headerLine) continue;
      warn(
        merge.startRow,
        keys[merge.startCol] ?? null,
        merge.endRow > merge.startRow
          ? `Cellules fusionnées ${merge.ref} : la valeur est reprise sur chaque ligne de la plage.`
          : `Cellules fusionnées ${merge.ref} : seule la première cellule est lue.`,
      );
    }
    const dataFormulas = sheet.formulaCells.filter((cell) => cell.line > headerLine);
    if (dataFormulas.length > 0) {
      warn(
        null,
        null,
        `${dataFormulas.length} cellule(s) à formule : la dernière valeur calculée par Excel est utilisée, aucune formule n’est exécutée.`,
      );
    }
    for (const cell of dataFormulas.filter((c) => !c.cached)) {
      warn(cell.line, keys[cell.col] ?? null, 'Formule sans valeur calculée : cellule lue vide.');
    }
    for (const cell of sheet.errorCells.filter((c) => c.line > headerLine)) {
      warn(cell.line, keys[cell.col] ?? null, `Cellule en erreur (${cell.value}) : lue vide.`);
    }
    for (const comment of sheet.comments) {
      warn(
        comment.line,
        keys[comment.col] ?? null,
        `Commentaire hors du tableau non repris : « ${comment.text.slice(0, 120)} ».`,
      );
    }
    return issues;
  }

  // ─── Analyse et rapprochement ──────────────────────────────────────────────

  private async preview(
    programmeId: string,
    source: ImportSource,
    categories: Category[],
    decisions: ImportDecision[],
  ): Promise<ProgrammeImportReport> {
    return this.prisma.$transaction(async (tx) => {
      const programme = await this.requireProgramme(tx, programmeId);
      const plan = await this.plan(tx, programme, source, categories, decisions);
      return this.toReport(source, plan, false, null);
    });
  }

  private async requireProgramme(tx: Tx, id: string) {
    const programme = await tx.programme.findUnique({ where: { id } });
    if (!programme) {
      throw new NotFoundException({
        code: 'PROGRAMME_NOT_FOUND',
        message: 'Programme introuvable.',
      });
    }
    return programme;
  }

  private async plan(
    tx: Tx,
    programme: { id: string; startsOn: Date | null; endsOn: Date | null },
    source: ImportSource,
    categories: Category[],
    decisions: ImportDecision[],
  ): Promise<Plan> {
    const issues = [...source.issues];
    const normalized = source.table
      ? normalizeProgrammeTable(source.table, source.mapping, categories)
      : { rows: [], rejected: [], issues: [], categoryCodes: new Map<number, string[]>() };
    issues.push(...normalized.issues);
    const categoryByCode = new Map(categories.map((c) => [c.code, c]));
    const moduleCodes = [...new Set(normalized.rows.flatMap((row) => row.moduleCodes ?? []))];
    const [modules, existing] = await Promise.all([
      moduleCodes.length > 0
        ? tx.pedagogicalModule.findMany({ select: { id: true, number: true } })
        : Promise.resolve([]),
      tx.activity.findMany({
        where: {
          OR: [
            { programmeId: programme.id },
            { importKey: { in: normalized.rows.map((row) => row.importKey) } },
          ],
        },
        include: existingInclude,
        orderBy: { id: 'asc' },
      }),
    ]);
    const moduleByCode = new Map(modules.map((m) => [formatModuleCode(m.number), m.id]));
    const byKey = new Map(existing.map((a) => [a.importKey, a]));
    const byId = new Map(existing.map((a) => [a.id, a]));
    const decisionByLine = new Map(decisions.map((d) => [d.line, d]));
    const lines = new Set([
      ...normalized.rows.map((r) => r.line),
      ...normalized.rejected.map((r) => r.line),
    ]);
    for (const decision of decisions) {
      if (!lines.has(decision.line)) {
        issues.push({
          severity: 'ERREUR',
          line: decision.line,
          column: null,
          message: `Décision pour la ligne ${decision.line}, absente de la source analysée.`,
        });
      }
    }

    // Période du programme : contrôle des dates, sans blocage.
    const startsOn = programme.startsOn ? toIsoDate(programme.startsOn) : null;
    const endsOn = programme.endsOn ? toIsoDate(programme.endsOn) : null;
    if ((!startsOn || !endsOn) && normalized.rows.length > 0) {
      issues.push({
        severity: 'AVERTISSEMENT',
        line: null,
        column: null,
        message: 'Période du programme non renseignée : les dates ne sont pas contrôlées.',
      });
    }

    // 1. Correspondance exacte (même date et même intitulé normalisé).
    const matched = new Set<string>();
    for (const row of normalized.rows) {
      const activity = byKey.get(row.importKey);
      if (activity?.programmeId === programme.id) matched.add(activity.id);
    }
    const programmeActivities = existing.filter(
      (a) => a.programmeId === programme.id && a.origin === 'PROGRAMME',
    );
    const chosen = new Map<string, number>();

    const rows: PlannedRow[] = normalized.rejected.map((rejected) => ({
      line: rejected.line,
      date: rejected.date,
      title: rejected.title,
      action: 'ERREUR',
      messages: rejected.messages,
      activityId: null,
      candidates: [],
      changes: [],
      protection: [],
      planned: null,
      source: null,
      existing: null,
      categoryContents: null,
      moduleIds: null,
    }));

    for (const row of normalized.rows) {
      const messages: string[] = [];
      const errors: string[] = [];
      // Catégories : codes résolus → contenus (null = catégorie concernée sans contenu détaillé).
      const codes = normalized.categoryCodes.get(row.line) ?? [];
      const categoryContents =
        row.categories !== undefined || row.categoryContents !== undefined
          ? new Map(
              codes.map((code) => [
                categoryByCode.get(code)!.id,
                row.categoryContents?.[code] ?? null,
              ]),
            )
          : null;
      let moduleIds: string[] | null = null;
      if (row.moduleCodes !== undefined) {
        moduleIds = [];
        for (const code of row.moduleCodes) {
          const id = moduleByCode.get(code);
          if (id) moduleIds.push(id);
          else errors.push(`Module inconnu « ${code} ».`);
        }
        moduleIds = [...new Set(moduleIds)];
      }
      if (startsOn && endsOn && (row.date < startsOn || row.date > endsOn)) {
        const message = `Date en dehors de la période du programme (${startsOn} → ${endsOn}).`;
        messages.push(message);
        issues.push({ severity: 'AVERTISSEMENT', line: row.line, column: null, message });
      }
      const recognized = recognizeSourceStatus(row.sourceStatus);
      const planned: Row['planned'] = {
        theme: row.theme ?? null,
        format: row.format ?? null,
        leaderLabel: row.leaderLabel ?? null,
        location: row.location ?? null,
        objectives: row.objectives ?? [],
        sourceStatus: row.sourceStatus ?? null,
        sourceStatusRecognized: recognized,
        sourceAttendance: row.sourceAttendance ?? null,
        planningNotes: row.planningNotes ?? null,
        categories: categories
          .filter((c) => codes.includes(c.code) || row.categoryContents?.[c.code] !== undefined)
          .map((c) => ({
            code: c.code,
            label: c.label,
            content: row.categoryContents?.[c.code] ?? null,
          })),
      };
      const base = {
        line: row.line,
        date: row.date,
        title: row.title,
        planned,
        source: row,
        categoryContents,
        moduleIds,
        candidates: [] as Row['candidates'],
        changes: [] as Row['changes'],
        protection: [] as string[],
      };
      const push = (
        action: ImportRowAction,
        existingActivity: ExistingActivity | null,
        extra: string[] = [],
      ) =>
        rows.push({
          ...base,
          action,
          messages: [...extra, ...messages],
          activityId: existingActivity?.id ?? null,
          existing: existingActivity,
        });

      if (errors.length > 0) {
        for (const message of errors) {
          issues.push({ severity: 'ERREUR', line: row.line, column: null, message });
        }
        push('ERREUR', null, errors);
        continue;
      }
      const exact = byKey.get(row.importKey);
      if (exact && exact.programmeId !== programme.id) {
        const message = 'Cette séance appartient déjà à un autre programme.';
        issues.push({ severity: 'ERREUR', line: row.line, column: null, message });
        push('ERREUR', null, [message]);
        continue;
      }
      const decision = decisionByLine.get(row.line);
      if (decision?.action === 'IGNORER') {
        push('IGNOREE', exact ?? null, ['Ligne ignorée sur décision du responsable.']);
        continue;
      }

      let target: ExistingActivity | null = exact ?? null;
      if (!target) {
        // 2. Rapprochement assisté : même date ou même intitulé, jamais fusionné sans décision.
        const title = normalizeLabel(row.title);
        const candidates = programmeActivities.filter(
          (a) =>
            !matched.has(a.id) &&
            (toIsoDate(a.plannedOn) === row.date || normalizeLabel(a.title) === title),
        );
        base.candidates = candidates.map(activityRef);
        if (decision?.action === 'METTRE_A_JOUR') {
          const selected = byId.get(decision.activityId);
          const other = chosen.get(decision.activityId);
          if (!selected || selected.programmeId !== programme.id || matched.has(selected.id)) {
            const message = 'Séance choisie pour le rapprochement invalide ou déjà rapprochée.';
            issues.push({ severity: 'ERREUR', line: row.line, column: null, message });
            push('ERREUR', null, [message]);
            continue;
          }
          if (other !== undefined) {
            const message = `Séance déjà choisie pour la ligne ${other}.`;
            issues.push({ severity: 'ERREUR', line: row.line, column: null, message });
            push('ERREUR', null, [message]);
            continue;
          }
          chosen.set(selected.id, row.line);
          target = selected;
        } else if (decision?.action !== 'CREER' && candidates.length > 0) {
          push('A_DECIDER', null, [
            candidates.length > 1
              ? `${candidates.length} séances existantes proches (même date ou même intitulé) : choisissez la séance à mettre à jour, créer une nouvelle séance ou ignorer la ligne.`
              : 'Une séance existante est proche (même date ou même intitulé) : mettre à jour cette séance, créer une nouvelle séance ou ignorer la ligne.',
          ]);
          continue;
        }
      }

      if (!target) {
        const extra =
          recognized && recognized !== 'PLANIFIEE'
            ? [
                `Le fichier indique « ${row.sourceStatus} » : la séance est créée « Planifiée » ; enregistrez ${recognized === 'REALISEE' ? 'la réalisation' : 'le changement'} depuis sa fiche.`,
              ]
            : [];
        push('CREER', null, extra);
        continue;
      }

      base.changes = this.diff(target, row, categoryContents, moduleIds, categories);
      base.protection = this.protection(target);
      const extra: string[] = [];
      if (recognized && recognized !== target.status) {
        extra.push(
          `Le fichier indique « ${row.sourceStatus} » ; dans Tesla : ${ACTIVITY_STATUS_LABELS[target.status]}. Aucun changement automatique de statut.`,
        );
      }
      if (base.protection.length > 0) {
        push('CONSERVEE_MANUELLE', target, [
          `Séance protégée (${base.protection.join(', ')}) : ${base.changes.length > 0 ? 'différences non appliquées' : 'aucune différence'}${target.importKey !== row.importKey ? ' ; rattachement au programme enregistré' : ''}.`,
          ...extra,
        ]);
      } else if (base.changes.length > 0 || target.importKey !== row.importKey) {
        push('METTRE_A_JOUR', target, extra);
      } else {
        push('INCHANGEE', target, extra);
      }
    }

    rows.sort((a, b) => a.line - b.line);
    const linked = new Set(rows.map((row) => row.activityId).filter(Boolean));
    const pending = new Set(
      rows
        .filter((row) => row.action === 'A_DECIDER')
        .flatMap((row) => row.candidates.map((c) => c.id)),
    );
    const absent = programmeActivities
      .filter((a) => !linked.has(a.id) && !pending.has(a.id))
      .sort((a, b) => a.plannedOn.getTime() - b.plannedOn.getTime())
      .map(activityRef);

    const fingerprint = sha256(
      JSON.stringify({
        format: source.format,
        file: source.sha256,
        sheet: source.sheet,
        headerLine: source.headerLine,
        mapping: source.mapping,
        period: [startsOn, endsOn],
        state: existing.map((a) => [
          a.id,
          a.revision,
          a.status,
          a.importKey,
          a.programmeId,
          a.manuallyEditedAt?.toISOString() ?? null,
          a._count.attendances,
          a.updatedAt.toISOString(),
        ]),
      }),
    );
    return { rows, issues, absent, fingerprint };
  }

  /** Raisons qui interdisent à un import de réécrire la séance. */
  private protection(activity: ExistingActivity): string[] {
    const reasons: string[] = [];
    if (activity.importKey === null) reasons.push('saisie dans Tesla');
    if (activity.manuallyEditedAt) reasons.push('modifiée manuellement');
    if (activity.status !== 'PLANIFIEE') {
      reasons.push(`statut « ${ACTIVITY_STATUS_LABELS[activity.status]} »`);
    }
    if (activity._count.attendances > 0) reasons.push('présences enregistrées');
    if (
      activity.report ||
      activity.contentDone ||
      activity.difficulties ||
      activity.observations ||
      activity.outcomes ||
      activity.followUp ||
      activity.heldByLabel
    ) {
      reasons.push('compte rendu renseigné');
    }
    return reasons;
  }

  /** Différences entre la séance et la ligne (champs présents dans la source seulement). */
  private diff(
    activity: ExistingActivity,
    row: ProgrammeSourceRow,
    categoryContents: Map<string, string | null> | null,
    moduleIds: string[] | null,
    categories: Category[],
  ): Row['changes'] {
    const changes: Row['changes'] = [];
    type Value = string | number | null | undefined;
    const add = (field: string, label: string, from: Value, to: Value) => {
      const f = from === null || from === undefined ? null : String(from);
      const t = to === null || to === undefined ? null : String(to);
      if (f !== t) changes.push({ field, label, from: f, to: t });
    };
    add('title', 'Intitulé', activity.title, row.title);
    add('plannedOn', 'Date prévue', toIsoDate(activity.plannedOn), row.date);
    if (row.theme !== undefined) add('theme', 'Axe / thème', activity.theme, row.theme);
    if (row.objectives !== undefined) {
      add(
        'objectives',
        'Objectifs',
        activity.objectives.join(' ; ') || null,
        row.objectives.join(' ; ') || null,
      );
    }
    if (row.location !== undefined)
      add('plannedLocation', 'Lieu prévu', activity.plannedLocation, row.location);
    if (row.leaderLabel !== undefined)
      add('leaderLabel', 'Responsable prévu', activity.leaderLabel, row.leaderLabel);
    if (row.format !== undefined)
      add('plannedFormat', 'Format prévu', activity.plannedFormat, row.format);
    if (row.sourceStatus !== undefined)
      add('sourceStatus', 'Statut indiqué (source)', activity.sourceStatus, row.sourceStatus);
    if (row.sourceAttendance !== undefined) {
      add(
        'sourceAttendanceCount',
        'Effectif indiqué (source)',
        activity.sourceAttendanceCount,
        row.sourceAttendance,
      );
    }
    if (row.planningNotes !== undefined)
      add('planningNotes', 'Observations du programme', activity.planningNotes, row.planningNotes);
    if (row.sourceNumber !== undefined)
      add('sourceNumber', 'Numéro de séance', activity.sourceNumber, row.sourceNumber);
    if (categoryContents) {
      const current = new Map(
        activity.categories.map((link) => [link.categoryId, link.plannedContent]),
      );
      const label = (ids: Iterable<string>) =>
        categories
          .filter((c) => [...ids].includes(c.id))
          .map((c) => c.label)
          .join(', ') || null;
      add(
        'categories',
        'Catégories concernées',
        label(current.keys()),
        label(categoryContents.keys()),
      );
      if (row.categoryContents !== undefined) {
        for (const category of categories) {
          if (!current.has(category.id) && !categoryContents.has(category.id)) continue;
          add(
            `${CATEGORY_FIELD_PREFIX}${category.code}`,
            `Programme — ${category.label}`,
            current.get(category.id) ?? null,
            categoryContents.get(category.id) ?? null,
          );
        }
      }
    }
    if (moduleIds) {
      const sorted = (ids: string[]) => [...ids].sort().join(',') || null;
      add('modules', 'Modules', sorted(activity.modules.map((m) => m.moduleId)), sorted(moduleIds));
    }
    return changes;
  }

  // ─── Confirmation ──────────────────────────────────────────────────────────

  private async apply(
    actor: Actor,
    programmeId: string,
    source: ImportSource,
    categories: Category[],
    decisions: ImportDecision[],
    fingerprint: string | undefined,
  ): Promise<ProgrammeImportReport> {
    return this.prisma.$transaction(
      async (tx) => {
        const programme = await this.requireProgramme(tx, programmeId);
        // Verrou consultatif : deux imports simultanés du même programme s'exécutent l'un après l'autre.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`programme-import:${programmeId}`}))`;
        const plan = await this.plan(tx, programme, source, categories, decisions);
        if (fingerprint && fingerprint !== plan.fingerprint) {
          throw new ConflictException({
            code: 'IMPORT_PREVIEW_STALE',
            message:
              'Le programme ou le fichier a changé depuis la prévisualisation : relancez l’analyse avant de confirmer.',
          });
        }
        if (
          plan.issues.some((issue) => issue.severity === 'ERREUR') ||
          plan.rows.some((row) => row.action === 'ERREUR')
        ) {
          throw new UnprocessableEntityException({
            code: 'IMPORT_HAS_ERRORS',
            message:
              'Le programme contient des erreurs : corrigez-les puis relancez la prévisualisation.',
          });
        }
        if (plan.rows.some((row) => row.action === 'A_DECIDER')) {
          throw new UnprocessableEntityException({
            code: 'IMPORT_DECISIONS_REQUIRED',
            message: 'Des rapprochements restent à décider avant de confirmer l’import.',
          });
        }
        const counts = this.counts(plan.rows);
        const record = await tx.programmeImport.create({
          data: {
            programmeId,
            actorId: actor.userId,
            format: source.format,
            fileName: source.fileName,
            fileSha256: source.format === 'XLSX' ? source.sha256 : null,
            sheetName: source.sheet,
            counts: { ...counts, ABSENTES: plan.absent.length },
            decisions: decisions.length > 0 ? decisions : undefined,
          },
        });
        for (const row of plan.rows) {
          const origin = source.sheet
            ? `ligne ${row.line} de « ${source.sheet} »`
            : `ligne ${row.line}`;
          const trace = { importId: record.id, line: row.line, sheet: source.sheet };
          if (row.action === 'CREER' && row.source) {
            await this.createSession(tx, actor, programmeId, row, origin, trace);
          } else if (row.action === 'METTRE_A_JOUR' && row.existing && row.source) {
            await this.updateSession(tx, actor, row, origin, trace);
          } else if (
            row.action === 'CONSERVEE_MANUELLE' &&
            row.existing &&
            row.source &&
            row.existing.importKey !== row.source.importKey
          ) {
            // Rattachement décidé d'une séance protégée : seule la clé technique change.
            await tx.activity.update({
              where: { id: row.existing.id },
              data: { importKey: row.source.importKey },
            });
            await tx.activityEvent.create({
              data: {
                activityId: row.existing.id,
                actorId: actor.userId,
                action: 'IMPORTEE',
                comment: `Rattachée au programme importé (${origin}) sans modification : séance protégée.`,
                changes: trace,
              },
            });
          }
        }
        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            action: 'programme.imported',
            entityType: 'Programme',
            entityId: programmeId,
            metadata: {
              importId: record.id,
              format: source.format,
              ...counts,
              ABSENTES: plan.absent.length,
            },
          },
        });
        return this.toReport(source, plan, true, record.id);
      },
      { timeout: 30_000 },
    );
  }

  private sessionFields(row: ProgrammeSourceRow) {
    return {
      title: row.title,
      plannedOn: isoToDate(row.date),
      ...(row.theme !== undefined && { theme: row.theme }),
      ...(row.objectives !== undefined && { objectives: row.objectives }),
      ...(row.location !== undefined && { plannedLocation: row.location }),
      ...(row.leaderLabel !== undefined && { leaderLabel: row.leaderLabel }),
      ...(row.format !== undefined && { plannedFormat: row.format }),
      ...(row.sourceStatus !== undefined && { sourceStatus: row.sourceStatus }),
      ...(row.sourceAttendance !== undefined && { sourceAttendanceCount: row.sourceAttendance }),
      ...(row.planningNotes !== undefined && { planningNotes: row.planningNotes }),
      ...(row.sourceNumber !== undefined && { sourceNumber: row.sourceNumber }),
    };
  }

  private async createSession(
    tx: Tx,
    actor: Actor,
    programmeId: string,
    row: PlannedRow,
    origin: string,
    trace: Record<string, unknown>,
  ) {
    const source = row.source!;
    const activity = await tx.activity.create({
      data: {
        programmeId,
        origin: 'PROGRAMME',
        importKey: source.importKey,
        createdById: actor.userId,
        objectives: [],
        ...this.sessionFields(source),
      },
    });
    if (row.categoryContents && row.categoryContents.size > 0) {
      await tx.activityCategory.createMany({
        data: [...row.categoryContents].map(([categoryId, plannedContent]) => ({
          activityId: activity.id,
          categoryId,
          plannedContent,
        })),
      });
    }
    if (row.moduleIds && row.moduleIds.length > 0) {
      await tx.activityModule.createMany({
        data: row.moduleIds.map((moduleId) => ({ activityId: activity.id, moduleId })),
      });
    }
    await tx.activityEvent.create({
      data: {
        activityId: activity.id,
        actorId: actor.userId,
        action: 'IMPORTEE',
        toStatus: 'PLANIFIEE',
        comment: `Créée par l’import du programme (${origin}).`,
        changes: trace as Prisma.InputJsonObject,
      },
    });
  }

  private async updateSession(
    tx: Tx,
    actor: Actor,
    row: PlannedRow,
    origin: string,
    trace: Record<string, unknown>,
  ) {
    const source = row.source!;
    const activity = row.existing!;
    await tx.activity.update({
      where: { id: activity.id },
      data: {
        ...this.sessionFields(source),
        importKey: source.importKey,
        revision: { increment: 1 },
        updatedById: actor.userId,
      },
    });
    if (row.categoryContents) {
      const keep = [...row.categoryContents.keys()];
      await tx.activityCategory.deleteMany({
        where: { activityId: activity.id, categoryId: { notIn: keep } },
      });
      for (const [categoryId, content] of row.categoryContents) {
        // Sans colonne de contenu (Markdown), le contenu déjà saisi est conservé.
        const plannedContent = source.categoryContents !== undefined ? content : undefined;
        await tx.activityCategory.upsert({
          where: { activityId_categoryId: { activityId: activity.id, categoryId } },
          create: { activityId: activity.id, categoryId, plannedContent: plannedContent ?? null },
          update: plannedContent !== undefined ? { plannedContent } : {},
        });
      }
    }
    if (row.moduleIds) {
      await tx.activityModule.deleteMany({ where: { activityId: activity.id } });
      await tx.activityModule.createMany({
        data: row.moduleIds.map((moduleId) => ({ activityId: activity.id, moduleId })),
      });
    }
    const dateChange = row.changes.find((change) => change.field === 'plannedOn');
    await tx.activityEvent.create({
      data: {
        activityId: activity.id,
        actorId: actor.userId,
        action: 'IMPORTEE',
        comment: `Mise à jour par l’import du programme (${origin}).`,
        changes: {
          ...trace,
          fields: row.changes.map((change) => change.label),
          ...(dateChange && { plannedOn: { from: dateChange.from, to: dateChange.to } }),
        },
      },
    });
  }

  // ─── Rapport ───────────────────────────────────────────────────────────────

  private counts(rows: Row[]): Record<ImportRowAction, number> {
    const counts = Object.fromEntries(IMPORT_ROW_ACTIONS.map((action) => [action, 0])) as Record<
      ImportRowAction,
      number
    >;
    for (const row of rows) counts[row.action] += 1;
    return counts;
  }

  private toReport(
    source: ImportSource,
    plan: Plan,
    applied: boolean,
    importId: string | null,
  ): ProgrammeImportReport {
    return {
      applied,
      fingerprint: plan.fingerprint,
      importId,
      source: {
        format: source.format,
        fileName: source.fileName,
        sheet: source.sheet,
        sheets: source.sheets,
        headerLine: source.headerLine,
        dataRows: plan.rows.length,
      },
      columns: source.columns,
      issues: plan.issues,
      rows: plan.rows.map(
        ({ source: _s, existing: _e, categoryContents: _c, moduleIds: _m, ...row }) => row,
      ),
      counts: this.counts(plan.rows),
      absent: plan.absent,
    };
  }
}

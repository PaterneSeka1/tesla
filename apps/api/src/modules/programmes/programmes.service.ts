import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import {
  formatModuleCode,
  IMPORT_ROW_ACTIONS,
  type ImportRowAction,
  type ParsedProgrammeRow,
  parseProgrammeMarkdown,
  type Programme,
  type ProgrammeCategory,
  type ProgrammeImportInput,
  programmeImportInputSchema,
  type ProgrammeImportReport,
  type UpdateProgrammeCategoryInput,
  updateProgrammeCategoryInputSchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan } from '../../common/permissions.js';
import { isForeignKeyViolation } from '../../common/prisma-errors.js';
import { parseInput } from '../../common/validation.js';
import { type Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { isoToDate } from '../progression/progression-common.js';
import { toIsoDate, toStageSummary } from '../scouts/presenters.js';

type Tx = Prisma.TransactionClient;

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

interface PlannedRow {
  row: ParsedProgrammeRow;
  action: ImportRowAction;
  messages: string[];
  categoryIds: string[];
  moduleIds: string[];
  existingId: string | null;
}

/**
 * Programme annuel et catégories. L'import part d'un tableau Markdown (format documenté dans
 * docs/FEATURES/PROGRAMME_ANNUEL.md) : prévisualisation sans écriture, puis application idempotente
 * (clé date + intitulé). Une séance modifiée à la main n'est jamais remplacée par un import.
 */
@Injectable()
export class ProgrammesService {
  constructor(private readonly prisma: PrismaService) {}

  async listProgrammes(actor: Actor): Promise<Programme[]> {
    assertCan(actor, 'activity.read');
    const programmes = await this.prisma.programme.findMany({ orderBy: { code: 'desc' } });
    const counts = await this.prisma.activity.groupBy({
      by: ['programmeId', 'status'],
      where: { programmeId: { in: programmes.map((programme) => programme.id) } },
      _count: { _all: true },
    });
    return programmes.map((programme) => {
      const own = counts.filter((group) => group.programmeId === programme.id);
      return {
        id: programme.id,
        code: programme.code,
        title: programme.title,
        startsOn: programme.startsOn ? toIsoDate(programme.startsOn) : null,
        endsOn: programme.endsOn ? toIsoDate(programme.endsOn) : null,
        activityCount: own.reduce((sum, group) => sum + group._count._all, 0),
        realisedCount: own
          .filter((group) => group.status === 'REALISEE')
          .reduce((sum, group) => sum + group._count._all, 0),
      };
    });
  }

  async listCategories(actor: Actor): Promise<ProgrammeCategory[]> {
    assertCan(actor, 'activity.read');
    const rows = await this.prisma.programmeCategory.findMany({
      include: { stage: true },
      orderBy: { position: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      label: row.label,
      stage: toStageSummary(row.stage),
      correspondenceValidated: row.correspondenceValidated,
      position: row.position,
    }));
  }

  /** Correspondance catégorie ↔ étape : modifiée et confirmée uniquement par le responsable. */
  async updateCategory(
    actor: Actor,
    id: string,
    input: UpdateProgrammeCategoryInput,
  ): Promise<ProgrammeCategory[]> {
    assertCan(actor, 'programme.configure');
    const data = parseInput(updateProgrammeCategoryInputSchema, input);
    try {
      await this.prisma.$transaction(async (tx) => {
        const category = await tx.programmeCategory.findUnique({ where: { id } });
        if (!category) {
          throw new NotFoundException({
            code: 'CATEGORY_NOT_FOUND',
            message: 'Catégorie introuvable.',
          });
        }
        const stageChanged = data.stageId !== undefined && data.stageId !== category.stageId;
        await tx.programmeCategory.update({
          where: { id },
          data: {
            ...(data.stageId !== undefined && { stageId: data.stageId }),
            // Changer l'étape remet la correspondance « à confirmer », sauf confirmation explicite.
            correspondenceValidated:
              data.correspondenceValidated ??
              (stageChanged ? false : category.correspondenceValidated),
            updatedById: actor.userId,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            action: 'programme_category.updated',
            entityType: 'ProgrammeCategory',
            entityId: id,
            metadata: {
              previousStageId: category.stageId,
              stageId: data.stageId ?? category.stageId,
              correspondenceValidated: data.correspondenceValidated ?? null,
            },
          },
        });
      });
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new UnprocessableEntityException({
          code: 'STAGE_NOT_FOUND',
          message: 'Étape inconnue.',
        });
      }
      throw error;
    }
    return this.listCategories(actor);
  }

  /** Prévisualisation : aucune écriture. */
  async previewImport(
    actor: Actor,
    programmeId: string,
    input: ProgrammeImportInput,
  ): Promise<ProgrammeImportReport> {
    assertCan(actor, 'programme.configure');
    const { content } = parseInput(programmeImportInputSchema, input);
    return this.prisma.$transaction(async (tx) => {
      await this.requireProgramme(tx, programmeId);
      return this.toReport(await this.plan(tx, content, programmeId), false, []);
    });
  }

  /**
   * Application : refusée si la prévisualisation contient une erreur (le fichier doit être corrigé).
   * Crée les séances nouvelles, met à jour celles qui ont changé et n'ont pas été modifiées à la main.
   */
  async applyImport(
    actor: Actor,
    programmeId: string,
    input: ProgrammeImportInput,
  ): Promise<ProgrammeImportReport> {
    assertCan(actor, 'programme.configure');
    const { content } = parseInput(programmeImportInputSchema, input);
    return this.prisma.$transaction(async (tx) => {
      await this.requireProgramme(tx, programmeId);
      // Verrou consultatif : deux imports simultanés du même programme s'exécutent l'un après l'autre.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`programme-import:${programmeId}`}))`;
      const { planned, parseErrors } = await this.plan(tx, content, programmeId);
      if (parseErrors.length > 0 || planned.some((item) => item.action === 'ERREUR')) {
        throw new UnprocessableEntityException({
          code: 'IMPORT_HAS_ERRORS',
          message:
            'Le programme contient des erreurs : corrigez-les puis relancez la prévisualisation.',
        });
      }
      for (const item of planned) {
        if (item.action === 'CREER') {
          const activity = await tx.activity.create({
            data: {
              programmeId,
              origin: 'PROGRAMME',
              importKey: item.row.importKey,
              createdById: actor.userId,
              ...this.importedFields(item.row),
            },
          });
          await this.replaceLinks(tx, activity.id, item);
          await tx.activityEvent.create({
            data: {
              activityId: activity.id,
              actorId: actor.userId,
              action: 'IMPORTEE',
              toStatus: 'PLANIFIEE',
              comment: `Ligne ${item.row.line} du programme importé`,
            },
          });
        } else if (item.action === 'METTRE_A_JOUR' && item.existingId) {
          await tx.activity.update({
            where: { id: item.existingId },
            data: {
              ...this.importedFields(item.row),
              revision: { increment: 1 },
              updatedById: actor.userId,
            },
          });
          await this.replaceLinks(tx, item.existingId, item);
          await tx.activityEvent.create({
            data: {
              activityId: item.existingId,
              actorId: actor.userId,
              action: 'IMPORTEE',
              comment: `Mise à jour par l’import (ligne ${item.row.line})`,
              changes: { fields: item.messages },
            },
          });
        }
      }
      const report = this.toReport({ planned, parseErrors }, true, []);
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: 'programme.imported',
          entityType: 'Programme',
          entityId: programmeId,
          metadata: report.counts,
        },
      });
      return report;
    });
  }

  private async requireProgramme(tx: Tx, id: string): Promise<void> {
    const programme = await tx.programme.findUnique({ where: { id }, select: { id: true } });
    if (!programme) {
      throw new NotFoundException({
        code: 'PROGRAMME_NOT_FOUND',
        message: 'Programme introuvable.',
      });
    }
  }

  private importedFields(row: ParsedProgrammeRow) {
    return {
      title: row.title,
      theme: row.theme,
      objectives: row.objectives,
      plannedOn: isoToDate(row.date),
      plannedLocation: row.location,
      leaderLabel: row.leaderLabel,
    };
  }

  private async replaceLinks(
    tx: Tx,
    activityId: string,
    item: { categoryIds: string[]; moduleIds: string[] },
  ): Promise<void> {
    await tx.activityCategory.deleteMany({ where: { activityId } });
    await tx.activityCategory.createMany({
      data: item.categoryIds.map((categoryId) => ({ activityId, categoryId })),
    });
    await tx.activityModule.deleteMany({ where: { activityId } });
    await tx.activityModule.createMany({
      data: item.moduleIds.map((moduleId) => ({ activityId, moduleId })),
    });
  }

  /** Calcule l'action de chaque ligne en comparant avec les séances déjà importées. */
  private async plan(
    tx: Tx,
    content: string,
    programmeId: string,
  ): Promise<{
    planned: PlannedRow[];
    parseErrors: ReturnType<typeof parseProgrammeMarkdown>['errors'];
  }> {
    const parsed = parseProgrammeMarkdown(content);
    const [categories, modules, existing] = await Promise.all([
      tx.programmeCategory.findMany(),
      tx.pedagogicalModule.findMany({ select: { id: true, number: true } }),
      tx.activity.findMany({
        where: { importKey: { in: parsed.rows.map((row) => row.importKey) } },
        include: { categories: true, modules: true },
      }),
    ]);
    const categoryByLabel = new Map<string, string>();
    for (const category of categories) {
      categoryByLabel.set(normalize(category.label), category.id);
      categoryByLabel.set(normalize(category.code), category.id);
    }
    const moduleByCode = new Map(
      modules.map((module) => [formatModuleCode(module.number), module.id]),
    );
    const existingByKey = new Map(existing.map((activity) => [activity.importKey, activity]));

    const planned = parsed.rows.map((row): PlannedRow => {
      const messages: string[] = [];
      const categoryIds: string[] = [];
      for (const label of row.categories) {
        const id = categoryByLabel.get(normalize(label));
        if (id) categoryIds.push(id);
        else messages.push(`Catégorie inconnue « ${label} ».`);
      }
      const moduleIds: string[] = [];
      for (const code of row.moduleCodes) {
        const id = moduleByCode.get(code);
        if (id) moduleIds.push(id);
        else messages.push(`Module inconnu « ${code} ».`);
      }
      const current = existingByKey.get(row.importKey);
      const base = {
        row,
        categoryIds: [...new Set(categoryIds)],
        moduleIds: [...new Set(moduleIds)],
        existingId: current?.id ?? null,
      };
      if (messages.length > 0) return { ...base, action: 'ERREUR', messages };
      if (!current) return { ...base, action: 'CREER', messages };
      if (current.programmeId !== programmeId)
        return {
          ...base,
          action: 'ERREUR',
          messages: ['Cette séance appartient déjà à un autre programme.'],
        };
      if (current.manuallyEditedAt) {
        return {
          ...base,
          action: 'CONSERVEE_MANUELLE',
          messages: ['Séance modifiée à la main : non remplacée.'],
        };
      }
      const sameSet = (a: string[], b: string[]) =>
        a.length === b.length && [...a].sort().join() === [...b].sort().join();
      const diff: string[] = [];
      if (current.theme !== row.theme) diff.push('theme');
      if (current.plannedLocation !== row.location) diff.push('plannedLocation');
      if (current.leaderLabel !== row.leaderLabel) diff.push('leaderLabel');
      if (current.objectives.join('\n') !== row.objectives.join('\n')) diff.push('objectives');
      if (
        !sameSet(
          current.categories.map((link) => link.categoryId),
          base.categoryIds,
        )
      )
        diff.push('categories');
      if (
        !sameSet(
          current.modules.map((link) => link.moduleId),
          base.moduleIds,
        )
      )
        diff.push('modules');
      return diff.length > 0
        ? { ...base, action: 'METTRE_A_JOUR', messages: diff }
        : { ...base, action: 'INCHANGEE', messages };
    });
    return { planned, parseErrors: parsed.errors };
  }

  private toReport(
    plan: {
      planned: PlannedRow[];
      parseErrors: ReturnType<typeof parseProgrammeMarkdown>['errors'];
    },
    applied: boolean,
    extra: ProgrammeImportReport['rows'],
  ): ProgrammeImportReport {
    const rows: ProgrammeImportReport['rows'] = [
      ...plan.parseErrors.map((error) => ({
        line: error.line,
        date: error.date,
        title: error.title,
        action: 'ERREUR' as const,
        messages: [error.message],
      })),
      ...plan.planned.map((item) => ({
        line: item.row.line,
        date: item.row.date,
        title: item.row.title,
        action: item.action,
        messages: item.messages,
      })),
      ...extra,
    ].sort((a, b) => a.line - b.line);
    const counts = Object.fromEntries(IMPORT_ROW_ACTIONS.map((action) => [action, 0])) as Record<
      ImportRowAction,
      number
    >;
    for (const row of rows) counts[row.action] += 1;
    return { applied, rows, counts };
  }
}

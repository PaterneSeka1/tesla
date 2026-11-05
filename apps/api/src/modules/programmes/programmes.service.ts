import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  type Programme,
  type ProgrammeCategory,
  type ProgrammeImportHistory,
  type ProgrammeInput,
  programmeInputSchema,
  type UpdateProgrammeCategoryInput,
  updateProgrammeCategoryInputSchema,
  type UpdateProgrammeInput,
  updateProgrammeInputSchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan } from '../../common/permissions.js';
import { isForeignKeyViolation, isUniqueViolation } from '../../common/prisma-errors.js';
import { parseInput } from '../../common/validation.js';
import { type Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { isoToDate } from '../progression/progression-common.js';
import {
  toIsoDate,
  toStageSummary,
  toUserSummary,
  userSummarySelect,
} from '../scouts/presenters.js';

type Tx = Prisma.TransactionClient;

/**
 * Programmes annuels (création volontaire, période) et catégories. L'import (Markdown ou Excel) est
 * porté par `ProgrammeImportService`.
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

  /** Création volontaire d'un programme annuel (aucune année n'est créée automatiquement). */
  async createProgramme(actor: Actor, input: ProgrammeInput): Promise<Programme[]> {
    assertCan(actor, 'programme.configure');
    const data = parseInput(programmeInputSchema, input);
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('programmes:period'))`;
      if (await tx.programme.findUnique({ where: { code: data.code }, select: { id: true } })) {
        throw new ConflictException({
          code: 'PROGRAMME_CODE_TAKEN',
          message: 'Un programme porte déjà ce code.',
        });
      }
      await this.assertNoOverlap(tx, null, data.startsOn, data.endsOn);
      try {
        const programme = await tx.programme.create({
          data: {
            code: data.code,
            title: data.title,
            startsOn: isoToDate(data.startsOn),
            endsOn: isoToDate(data.endsOn),
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            action: 'programme.created',
            entityType: 'Programme',
            entityId: programme.id,
            metadata: { code: data.code, startsOn: data.startsOn, endsOn: data.endsOn },
          },
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictException({
            code: 'PROGRAMME_CODE_TAKEN',
            message: 'Un programme porte déjà ce code.',
          });
        }
        throw error;
      }
    });
    return this.listProgrammes(actor);
  }

  /** Titre et période d'un programme (contrôle des dates importées). */
  async updateProgramme(
    actor: Actor,
    id: string,
    input: UpdateProgrammeInput,
  ): Promise<Programme[]> {
    assertCan(actor, 'programme.configure');
    const data = parseInput(updateProgrammeInputSchema, input);
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('programmes:period'))`;
      const programme = await tx.programme.findUnique({ where: { id } });
      if (!programme) {
        throw new NotFoundException({
          code: 'PROGRAMME_NOT_FOUND',
          message: 'Programme introuvable.',
        });
      }
      const startsOn = data.startsOn ?? (programme.startsOn && toIsoDate(programme.startsOn));
      const endsOn = data.endsOn ?? (programme.endsOn && toIsoDate(programme.endsOn));
      if (startsOn && endsOn) {
        if (startsOn >= endsOn) {
          throw new UnprocessableEntityException({
            code: 'VALIDATION_ERROR',
            message: 'La fin du programme doit suivre son début.',
          });
        }
        await this.assertNoOverlap(tx, id, startsOn, endsOn);
      }
      await tx.programme.update({
        where: { id },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.startsOn !== undefined && { startsOn: isoToDate(data.startsOn) }),
          ...(data.endsOn !== undefined && { endsOn: isoToDate(data.endsOn) }),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: 'programme.updated',
          entityType: 'Programme',
          entityId: id,
          metadata: { ...data },
        },
      });
    });
    return this.listProgrammes(actor);
  }

  private async assertNoOverlap(tx: Tx, id: string | null, startsOn: string, endsOn: string) {
    const overlapping = await tx.programme.findFirst({
      where: {
        ...(id && { id: { not: id } }),
        startsOn: { lte: isoToDate(endsOn) },
        endsOn: { gte: isoToDate(startsOn) },
      },
      select: { title: true },
    });
    if (overlapping) {
      throw new ConflictException({
        code: 'PROGRAMME_PERIOD_OVERLAP',
        message: `La période chevauche celle du programme « ${overlapping.title} ».`,
      });
    }
  }

  /** Historique des imports confirmés (le fichier source n'est jamais conservé). */
  async importHistory(actor: Actor, programmeId: string): Promise<ProgrammeImportHistory> {
    assertCan(actor, 'activity.read');
    const rows = await this.prisma.programmeImport.findMany({
      where: { programmeId },
      include: { actor: userSummarySelect },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        format: row.format,
        fileName: row.fileName,
        fileSha256: row.fileSha256,
        sheet: row.sheetName,
        counts: Object.fromEntries(
          Object.entries((row.counts ?? {}) as Record<string, unknown>).filter(
            (entry): entry is [string, number] => typeof entry[1] === 'number',
          ),
        ),
        actor: toUserSummary(row.actor)!,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }
}

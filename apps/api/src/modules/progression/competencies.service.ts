import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  type Competency,
  type CompetencyListQuery,
  competencyListQuerySchema,
  type CreateCompetencyInput,
  createCompetencyInputSchema,
  NONE_FILTER,
  type Paginated,
  type UpdateCompetencyInput,
  updateCompetencyInputSchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan } from '../../common/permissions.js';
import { isForeignKeyViolation, isUniqueViolation } from '../../common/prisma-errors.js';
import { parseInput } from '../../common/validation.js';
import { type Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { toStageSummary } from '../scouts/presenters.js';
import { moduleRefSelect, toModuleRef } from './progression-common.js';

const competencyInclude = {
  stage: true,
  modules: { include: { module: moduleRefSelect }, orderBy: { createdAt: 'asc' } },
} as const satisfies Prisma.CompetencyInclude;

type CompetencyRow = Prisma.CompetencyGetPayload<{ include: typeof competencyInclude }>;

function toCompetency(row: CompetencyRow): Competency {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    domain: row.domain,
    stage: toStageSummary(row.stage),
    observableCriteria: row.observableCriteria,
    minEvidenceCount: row.minEvidenceCount,
    isActive: row.isActive,
    position: row.position,
    modules: row.modules.map((link) => toModuleRef(link.module)),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function competencyNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'COMPETENCY_NOT_FOUND',
    message: 'Compétence introuvable.',
  });
}

function invalidReference(): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code: 'INVALID_REFERENCE',
    message: 'Étape ou module inconnu.',
  });
}

/**
 * Référentiel de compétences administré par le responsable. Rien n'est pré-rempli : aucune
 * compétence n'est attribuée « au nom du manuel » sans saisie explicite. Jamais supprimée : désactivée.
 */
@Injectable()
export class CompetenciesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: Actor, query: CompetencyListQuery): Promise<Paginated<Competency>> {
    assertCan(actor, 'competency.read');
    const { page, pageSize, search, stageId, status } = parseInput(
      competencyListQuerySchema,
      query,
    );
    const words = search?.split(/\s+/).filter(Boolean) ?? [];
    const where: Prisma.CompetencyWhereInput = {
      ...(status !== 'all' && { isActive: status === 'active' }),
      ...(stageId && { stageId: stageId === NONE_FILTER ? null : stageId }),
      AND: words.map((word) => ({
        OR: [
          { code: { contains: word, mode: 'insensitive' as const } },
          { name: { contains: word, mode: 'insensitive' as const } },
          { domain: { contains: word, mode: 'insensitive' as const } },
        ],
      })),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.competency.count({ where }),
      this.prisma.competency.findMany({
        where,
        include: competencyInclude,
        orderBy: [{ position: 'asc' }, { code: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items: rows.map(toCompetency), page, pageSize, total };
  }

  async get(actor: Actor, id: string): Promise<Competency> {
    assertCan(actor, 'competency.read');
    const row = await this.prisma.competency.findUnique({
      where: { id },
      include: competencyInclude,
    });
    if (!row) throw competencyNotFound();
    return toCompetency(row);
  }

  async create(actor: Actor, input: CreateCompetencyInput): Promise<Competency> {
    assertCan(actor, 'competency.manage');
    const data = parseInput(createCompetencyInputSchema, input);
    try {
      const id = await this.prisma.$transaction(async (tx) => {
        const competency = await tx.competency.create({
          data: {
            code: data.code,
            name: data.name,
            description: data.description,
            domain: data.domain ?? null,
            stageId: data.stageId ?? null,
            observableCriteria: data.observableCriteria,
            minEvidenceCount: data.minEvidenceCount,
            position: data.position,
            createdById: actor.userId,
            modules: { create: [...new Set(data.moduleIds)].map((moduleId) => ({ moduleId })) },
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            action: 'competency.created',
            entityType: 'Competency',
            entityId: competency.id,
            metadata: { code: competency.code },
          },
        });
        return competency.id;
      });
      return this.get(actor, id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'COMPETENCY_CODE_USED',
          message: 'Ce code de compétence est déjà utilisé.',
        });
      }
      if (isForeignKeyViolation(error)) throw invalidReference();
      throw error;
    }
  }

  async update(actor: Actor, id: string, input: UpdateCompetencyInput): Promise<Competency> {
    assertCan(actor, 'competency.manage');
    const data = parseInput(updateCompetencyInputSchema, input);
    try {
      await this.prisma.$transaction(async (tx) => {
        const existing = await tx.competency.findUnique({ where: { id } });
        if (!existing) throw competencyNotFound();
        await tx.competency.update({
          where: { id },
          data: {
            ...(data.name !== undefined && { name: data.name }),
            ...(data.description !== undefined && { description: data.description }),
            ...(data.domain !== undefined && { domain: data.domain }),
            ...(data.stageId !== undefined && { stageId: data.stageId }),
            ...(data.observableCriteria !== undefined && {
              observableCriteria: data.observableCriteria,
            }),
            ...(data.minEvidenceCount !== undefined && { minEvidenceCount: data.minEvidenceCount }),
            ...(data.position !== undefined && { position: data.position }),
            ...(data.isActive !== undefined && { isActive: data.isActive }),
            updatedById: actor.userId,
          },
        });
        if (data.moduleIds !== undefined) {
          await tx.competencyModule.deleteMany({ where: { competencyId: id } });
          await tx.competencyModule.createMany({
            data: [...new Set(data.moduleIds)].map((moduleId) => ({ competencyId: id, moduleId })),
          });
        }
        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            action: 'competency.updated',
            entityType: 'Competency',
            entityId: id,
            metadata: {
              fields: Object.keys(data).filter(
                (key) => data[key as keyof typeof data] !== undefined,
              ),
            },
          },
        });
      });
      return this.get(actor, id);
    } catch (error) {
      if (isForeignKeyViolation(error)) throw invalidReference();
      throw error;
    }
  }
}

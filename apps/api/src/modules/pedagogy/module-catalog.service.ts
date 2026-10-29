import { Injectable } from '@nestjs/common';
import {
  type CatalogLesson,
  type CatalogModule,
  type CatalogModuleDetail,
  type CatalogPage,
  type CatalogQuery,
  catalogQuerySchema,
  type PrintableModule,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan } from '../../common/permissions.js';
import { parseInput } from '../../common/validation.js';
import { type Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { toStageSummary } from '../scouts/presenters.js';
import {
  formatModuleCode,
  lessonNotFound,
  moduleNotFound,
  toLessonDocument,
} from './module-common.js';

const publishedInclude = {
  stage: true,
  _count: { select: { lessons: true } },
} as const satisfies Prisma.ModuleVersionInclude;

type PublishedRow = Prisma.ModuleVersionGetPayload<{ include: typeof publishedInclude }>;

const lessonSummarySelect = {
  id: true,
  position: true,
  title: true,
  durationMinutes: true,
} as const satisfies Prisma.ModuleLessonSelect;

const publicResourceSelect = {
  id: true,
  lessonId: true,
  kind: true,
  title: true,
  url: true,
  description: true,
} as const satisfies Prisma.ModuleResourceSelect;

function toCatalogModule(
  module: { slug: string; number: number },
  version: PublishedRow,
): CatalogModule {
  return {
    slug: module.slug,
    code: formatModuleCode(module.number),
    version: version.version,
    title: version.title,
    summary: version.summary,
    stage: toStageSummary(version.stage),
    theme: version.theme,
    durationMinutes: version.durationMinutes,
    lessonCount: version._count.lessons,
    publishedAt: version.publishedAt!.toISOString(),
  };
}

/**
 * Bibliothèque : uniquement la version publiée courante de chaque module, pour tout utilisateur
 * authentifié. La consultation n'est jamais conditionnée à l'étape du routier (règle pédagogique 1) ;
 * l'étape sert seulement à signaler les modules recommandés. Aucun brouillon n'est exposé.
 */
@Injectable()
export class ModuleCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: Actor, query: CatalogQuery): Promise<CatalogPage> {
    assertCan(actor, 'module.read');
    const { page, pageSize, search, stageId, theme } = parseInput(catalogQuerySchema, query);
    const versionWhere: Prisma.ModuleVersionWhereInput = {
      status: 'PUBLIE',
      ...(stageId && { stageId }),
      ...(theme && { theme: { equals: theme, mode: 'insensitive' } }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { summary: { contains: search, mode: 'insensitive' } },
          { theme: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };
    const where: Prisma.PedagogicalModuleWhereInput = { publishedVersion: versionWhere };
    const [total, modules, themes, myStageId] = await Promise.all([
      this.prisma.pedagogicalModule.count({ where }),
      this.prisma.pedagogicalModule.findMany({
        where,
        include: { publishedVersion: { include: publishedInclude } },
        orderBy: { publishedVersion: { title: 'asc' } },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.moduleVersion.findMany({
        where: { status: 'PUBLIE', theme: { not: null } },
        distinct: ['theme'],
        select: { theme: true },
        orderBy: { theme: 'asc' },
      }),
      this.myStageId(actor),
    ]);
    return {
      items: modules.map((module) => toCatalogModule(module, module.publishedVersion!)),
      page,
      pageSize,
      total,
      themes: themes.map((row) => row.theme!),
      myStageId,
    };
  }

  async get(actor: Actor, slug: string): Promise<CatalogModuleDetail> {
    assertCan(actor, 'module.read');
    const { module, version } = await this.published(slug, {
      lessons: { select: lessonSummarySelect, orderBy: { position: 'asc' } },
      resources: {
        where: { lessonId: null },
        select: publicResourceSelect,
        orderBy: { createdAt: 'asc' },
      },
    });
    return {
      ...toCatalogModule(module, version),
      objectives: version.objectives,
      prerequisites: version.prerequisites,
      lessons: version.lessons,
      resources: version.resources,
      myStageId: await this.myStageId(actor),
    };
  }

  async lesson(actor: Actor, slug: string, lessonId: string): Promise<CatalogLesson> {
    assertCan(actor, 'module.read');
    const { module, version } = await this.published(slug, {
      lessons: { select: lessonSummarySelect, orderBy: { position: 'asc' } },
    });
    const index = version.lessons.findIndex((lesson) => lesson.id === lessonId);
    if (index === -1) throw lessonNotFound();
    const lesson = await this.prisma.moduleLesson.findUniqueOrThrow({
      where: { id: lessonId },
      select: {
        ...lessonSummarySelect,
        content: true,
        resources: { select: publicResourceSelect, orderBy: { createdAt: 'asc' } },
      },
    });
    return {
      module: {
        slug: module.slug,
        title: version.title,
        version: version.version,
        code: formatModuleCode(module.number),
      },
      lesson: { ...lesson, content: toLessonDocument(lesson.content) },
      lessonCount: version.lessons.length,
      previous: version.lessons[index - 1] ?? null,
      next: version.lessons[index + 1] ?? null,
    };
  }

  /** Contenu complet de la version publiée, pour l'impression A4 (aucun corrigé n'existe dans un module). */
  async printable(actor: Actor, slug: string): Promise<PrintableModule> {
    assertCan(actor, 'module.read');
    const { module, version } = await this.published(slug, {
      lessons: {
        select: {
          ...lessonSummarySelect,
          content: true,
          resources: { select: publicResourceSelect, orderBy: { createdAt: 'asc' } },
        },
        orderBy: { position: 'asc' },
      },
      resources: {
        where: { lessonId: null },
        select: publicResourceSelect,
        orderBy: { createdAt: 'asc' },
      },
    });
    return {
      ...toCatalogModule(module, version),
      objectives: version.objectives,
      prerequisites: version.prerequisites,
      lessons: version.lessons.map((lesson) => ({
        ...lesson,
        content: toLessonDocument(lesson.content),
      })),
      resources: version.resources,
    };
  }

  /** Module par slug et sa version publiée ; 404 si aucune version n'est publiée. */
  private async published<I extends Prisma.ModuleVersionInclude>(slug: string, include: I) {
    const module = await this.prisma.pedagogicalModule.findUnique({
      where: { slug },
      include: { publishedVersion: { include: { ...publishedInclude, ...include } } },
    });
    if (!module?.publishedVersion) throw moduleNotFound();
    return {
      module,
      version: module.publishedVersion as unknown as Prisma.ModuleVersionGetPayload<{
        include: typeof publishedInclude & I;
      }>,
    };
  }

  /** Étape actuelle du routier connecté (profil rattaché au compte), sinon null. */
  private async myStageId(actor: Actor): Promise<string | null> {
    if (actor.role !== 'ROUTIER') return null;
    const profile = await this.prisma.scoutProfile.findUnique({
      where: { userId: actor.userId },
      select: { currentStageId: true },
    });
    return profile?.currentStageId ?? null;
  }
}

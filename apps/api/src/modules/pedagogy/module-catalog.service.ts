import { createHash } from 'node:crypto';
import { offlineModulePackageSchema, printableModuleSchema } from '@tesla/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import {
  type CatalogLesson,
  type CatalogModule,
  type CatalogModuleDetail,
  type CatalogPage,
  type CatalogQuery,
  catalogQuerySchema,
  PRACTICAL_SHEETS,
  type PracticalSheet,
  practicalSheetsFor,
  type PrintableModule,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan } from '../../common/permissions.js';
import { parseInput } from '../../common/validation.js';
import { type Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { computedStageIdOf, loadStageContext } from '../progression/computed-stage.js';
import { toStageSummary } from '../scouts/presenters.js';
import {
  formatModuleCode,
  lessonNotFound,
  moduleNotFound,
  publicResourceSelect,
  toLessonDocument,
  toPublicResource,
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
    category: version.category,
    obligation: version.obligation,
    official: version.officialSource !== null,
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
    const { page, pageSize, search, stageId, theme, category } = parseInput(
      catalogQuerySchema,
      query,
    );
    const versionWhere: Prisma.ModuleVersionWhereInput = {
      status: 'PUBLIE',
      ...(stageId && { stageId }),
      ...(category && { category }),
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
      // Textes cités : seuls ceux dont une version est publiée sont exposés (jamais un brouillon).
      textLinks: {
        where: { textModule: { publishedVersionId: { not: null } } },
        orderBy: { position: 'asc' },
        select: {
          textModule: { select: { slug: true, publishedVersion: { select: { title: true } } } },
        },
      },
    });
    return {
      ...toCatalogModule(module, version),
      objectives: version.objectives,
      prerequisites: version.prerequisites,
      lessons: version.lessons,
      resources: version.resources.map(toPublicResource),
      texts: version.textLinks.map(({ textModule }) => ({
        slug: textModule.slug,
        title: textModule.publishedVersion!.title,
      })),
      practicalSheets: practicalSheetsFor(await this.sourceKeyOf(module.id)),
      myStageId: await this.myStageId(actor),
    };
  }

  /** Fiche pratique d'un module publié (modèle vierge, sans donnée) ; 404 si elle n'y est pas rattachée. */
  async practicalSheet(actor: Actor, slug: string, key: string): Promise<PracticalSheet> {
    assertCan(actor, 'module.read');
    const { module } = await this.published(slug, {});
    const attached = practicalSheetsFor(await this.sourceKeyOf(module.id));
    const sheet = attached.some((item) => item.key === key)
      ? PRACTICAL_SHEETS.find((item) => item.key === key)
      : undefined;
    if (!sheet) {
      throw new NotFoundException({
        code: 'PRACTICAL_SHEET_NOT_FOUND',
        message: 'Fiche pratique introuvable.',
      });
    }
    return sheet;
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
      lesson: {
        ...lesson,
        content: toLessonDocument(lesson.content),
        resources: lesson.resources.map(toPublicResource),
      },
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
        resources: lesson.resources.map(toPublicResource),
      })),
      resources: version.resources.map(toPublicResource),
    };
  }

  async offlinePackage(actor: Actor, slug: string) {
    const content = printableModuleSchema.parse(await this.printable(actor, slug));
    const version = await this.prisma.moduleVersion.findFirstOrThrow({
      where: { module: { slug }, version: content.version },
      select: { id: true },
    });
    return offlineModulePackageSchema.parse({
      versionId: version.id,
      content,
      digest: createHash('sha256').update(JSON.stringify(content)).digest('hex'),
    });
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

  /** Code source d'un module importé (null pour un module créé dans la plateforme). */
  private async sourceKeyOf(moduleId: string): Promise<string | null> {
    const source = await this.prisma.moduleSourceImport.findUnique({
      where: { moduleId },
      select: { sourceKey: true },
    });
    return source?.sourceKey ?? null;
  }

  /** Étape actuelle du routier connecté (profil rattaché au compte), sinon null. */
  private async myStageId(actor: Actor): Promise<string | null> {
    if (actor.role !== 'ROUTIER') return null;
    const profile = await this.prisma.scoutProfile.findUnique({
      where: { userId: actor.userId },
      select: { birthDate: true, membershipStatus: true },
    });
    // Étape actuelle calculée selon l'âge (D173).
    return profile ? computedStageIdOf(profile, await loadStageContext(this.prisma)) : null;
  }
}

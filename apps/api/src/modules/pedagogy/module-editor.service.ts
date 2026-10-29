import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  type AddCollaboratorInput,
  addCollaboratorInputSchema,
  type CreateLessonInput,
  createLessonInputSchema,
  type CreateModuleInput,
  createModuleInputSchema,
  type CreateResourceInput,
  createResourceInputSchema,
  type EditorModuleDetail,
  type EditorModuleListItem,
  type EditorModuleListQuery,
  editorModuleListQuerySchema,
  emptyLessonDocument,
  isLessonDocumentEmpty,
  type ModuleActivityItem,
  type ModuleVersionDetail,
  type Paginated,
  type ReorderLessonsInput,
  reorderLessonsInputSchema,
  slugify,
  type SubmitModuleInput,
  submitModuleInputSchema,
  type UpdateLessonInput,
  updateLessonInputSchema,
  type UpdateModuleVersionInput,
  updateModuleVersionInputSchema,
  type UserSummary,
  type VersionActionInput,
  versionActionInputSchema,
  WORKING_MODULE_STATUSES,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan, can } from '../../common/permissions.js';
import { isUniqueViolation } from '../../common/prisma-errors.js';
import { parseInput } from '../../common/validation.js';
import { type Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { toUserSummary, userSummarySelect } from '../scouts/presenters.js';
import {
  editableModulesWhere,
  editConflict,
  eventInclude,
  formatModuleCode,
  invalidTransition,
  isWorkingStatus,
  lessonNotFound,
  lockVersion,
  type ModuleAccess,
  moduleNotFound,
  recordEvent,
  resolveAccess,
  toActivityItem,
  toEvent,
  toLessonDocument,
  toVersionDetail,
  toVersionSummary,
  versionDetailInclude,
  versionNotEditable,
  versionNotFound,
  versionSummaryInclude,
} from './module-common.js';

const workingStatuses = [...WORKING_MODULE_STATUSES];

function workingVersionExists(): ConflictException {
  return new ConflictException({
    code: 'WORKING_VERSION_EXISTS',
    message:
      'Une version de travail existe déjà pour ce module : reprenez-la plutôt que d’en créer une autre.',
  });
}

/**
 * Espace éditorial : création et rédaction des modules par les chefs (auteur ou collaborateurs)
 * et le responsable. Aucune action de ce service ne publie : la soumission est la dernière étape
 * accessible à un chef (décisions : `ModuleReviewService`).
 *
 * Concurrence : chaque version et chaque leçon porte un compteur `revision` ; une écriture fondée
 * sur une révision périmée est refusée (409 `EDIT_CONFLICT`), jamais écrasée silencieusement.
 */
@Injectable()
export class ModuleEditorService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: Actor, query: EditorModuleListQuery): Promise<Paginated<EditorModuleListItem>> {
    assertCan(actor, 'module.write');
    const { page, pageSize, search, status } = parseInput(editorModuleListQuerySchema, query);
    const filters: Prisma.PedagogicalModuleWhereInput[] = [editableModulesWhere(actor)];
    if (status === 'working')
      filters.push({ versions: { some: { status: { in: workingStatuses } } } });
    else if (status === 'published') filters.push({ publishedVersionId: { not: null } });
    else if (status !== 'all') filters.push({ versions: { some: { status } } });
    if (search) {
      filters.push({ versions: { some: { title: { contains: search, mode: 'insensitive' } } } });
    }
    const where: Prisma.PedagogicalModuleWhereInput = { AND: filters };
    const [total, modules] = await this.prisma.$transaction([
      this.prisma.pedagogicalModule.count({ where }),
      this.prisma.pedagogicalModule.findMany({
        where,
        include: {
          createdBy: userSummarySelect,
          collaborators: { where: { userId: actor.userId, removedAt: null }, select: { id: true } },
          versions: { include: versionSummaryInclude, orderBy: { version: 'desc' } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items: modules.map((module) => {
        const latest = module.versions[0]!;
        const working = module.versions.find((version) => isWorkingStatus(version.status));
        const published = module.versions.find(
          (version) => version.id === module.publishedVersionId,
        );
        return {
          id: module.id,
          code: formatModuleCode(module.number),
          slug: module.slug,
          createdBy: toUserSummary(module.createdBy)!,
          createdAt: module.createdAt.toISOString(),
          access: accessOf(actor, module.createdById, module.collaborators.length > 0),
          working: working ? toVersionSummary(working) : null,
          published: published ? toVersionSummary(published) : null,
          latest: toVersionSummary(latest),
        };
      }),
      page,
      pageSize,
      total,
    };
  }

  /** Crée le module et sa version 1 à l'état brouillon. Le slug est fixé ici et ne change plus. */
  async create(actor: Actor, input: CreateModuleInput): Promise<{ id: string }> {
    assertCan(actor, 'module.write');
    const data = parseInput(createModuleInputSchema, input);
    const base = slugify(data.title);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const slug = await availableSlug(tx, base);
          const module = await tx.pedagogicalModule.create({
            data: { slug, createdById: actor.userId },
          });
          const version = await tx.moduleVersion.create({
            data: {
              moduleId: module.id,
              version: 1,
              title: data.title,
              summary: data.summary,
              objectives: data.objectives,
              prerequisites: data.prerequisites ?? null,
              durationMinutes: data.durationMinutes ?? null,
              stageId: data.stageId ?? null,
              theme: data.theme ?? null,
              createdById: actor.userId,
              updatedById: actor.userId,
            },
          });
          await recordEvent(tx, actor, {
            moduleId: module.id,
            versionId: version.id,
            action: 'CREEE',
            fromStatus: null,
            toStatus: 'BROUILLON',
          });
          await tx.auditLog.create({
            data: {
              actorId: actor.userId,
              action: 'module.created',
              entityType: 'PedagogicalModule',
              entityId: module.id,
              metadata: { slug, title: data.title },
            },
          });
          return { id: module.id };
        });
      } catch (error) {
        // Deux créations simultanées du même titre : nouvel essai avec le slug suivant.
        if (isUniqueViolation(error)) continue;
        throw error;
      }
    }
    throw new ConflictException({
      code: 'SLUG_UNAVAILABLE',
      message: 'Impossible d’attribuer une adresse à ce module : réessayez.',
    });
  }

  async get(actor: Actor, moduleId: string): Promise<EditorModuleDetail> {
    assertCan(actor, 'module.write');
    const { access } = await resolveAccess(this.prisma, actor, moduleId);
    return this.detail(actor, moduleId, access);
  }

  /** Détail complet d'un module (utilisé aussi par la révision du responsable). */
  async detail(actor: Actor, moduleId: string, access: ModuleAccess): Promise<EditorModuleDetail> {
    const module = await this.prisma.pedagogicalModule.findUnique({
      where: { id: moduleId },
      include: {
        createdBy: userSummarySelect,
        versions: { include: versionSummaryInclude, orderBy: { version: 'desc' } },
        collaborators: {
          where: { removedAt: null },
          include: { user: userSummarySelect, addedBy: userSummarySelect },
          orderBy: { createdAt: 'asc' },
        },
        events: { include: eventInclude, orderBy: { createdAt: 'desc' }, take: 100 },
      },
    });
    if (!module) throw moduleNotFound();
    const current =
      module.versions.find((version) => isWorkingStatus(version.status)) ?? module.versions[0]!;
    const currentDetail = await this.versionDetail(current.id);
    const isWriter = access !== null;
    const status = current.status;
    return {
      id: module.id,
      code: formatModuleCode(module.number),
      slug: module.slug,
      createdBy: toUserSummary(module.createdBy)!,
      createdAt: module.createdAt.toISOString(),
      access,
      publishedVersionId: module.publishedVersionId,
      current: currentDetail,
      versions: module.versions.map(toVersionSummary),
      collaborators: module.collaborators.map((collaborator) => ({
        user: toUserSummary(collaborator.user)!,
        addedBy: toUserSummary(collaborator.addedBy)!,
        addedAt: collaborator.createdAt.toISOString(),
      })),
      events: module.events.map(toEvent),
      permissions: {
        canEdit: isWriter && status === 'BROUILLON',
        canSubmit: isWriter && status === 'BROUILLON',
        canResume: isWriter && status === 'A_CORRIGER',
        canCreateVersion: isWriter && !isWorkingStatus(status),
        canManageCollaborators: access === 'AUTEUR' || access === 'RESPONSABLE',
        canReview: can(actor, 'module.review'),
      },
    };
  }

  /** Contenu exact d'une version (aperçu, versions antérieures). */
  async getVersion(
    actor: Actor,
    moduleId: string,
    versionId: string,
  ): Promise<ModuleVersionDetail> {
    assertCan(actor, 'module.write');
    await resolveAccess(this.prisma, actor, moduleId);
    const version = await this.prisma.moduleVersion.findFirst({
      where: { id: versionId, moduleId },
      select: { id: true },
    });
    if (!version) throw versionNotFound();
    return this.versionDetail(versionId);
  }

  async versionDetail(versionId: string): Promise<ModuleVersionDetail> {
    const row = await this.prisma.moduleVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: versionDetailInclude,
    });
    return toVersionDetail(row);
  }

  /** Modifie les informations du brouillon (révision attendue obligatoire). */
  async updateVersion(
    actor: Actor,
    moduleId: string,
    input: UpdateModuleVersionInput,
  ): Promise<void> {
    assertCan(actor, 'module.write');
    const { versionId, revision, ...fields } = parseInput(updateModuleVersionInputSchema, input);
    await this.prisma.$transaction(async (tx) => {
      await resolveAccess(tx, actor, moduleId);
      const locked = await lockVersion(tx, moduleId, versionId);
      if (locked.status !== 'BROUILLON') throw versionNotEditable(locked.status);
      if (locked.revision !== revision) throw editConflict();
      await tx.moduleVersion.update({
        where: { id: versionId },
        data: {
          ...(fields.title !== undefined && { title: fields.title }),
          ...(fields.summary !== undefined && { summary: fields.summary }),
          ...(fields.objectives !== undefined && { objectives: fields.objectives }),
          ...(fields.prerequisites !== undefined && { prerequisites: fields.prerequisites }),
          ...(fields.durationMinutes !== undefined && { durationMinutes: fields.durationMinutes }),
          ...(fields.stageId !== undefined && { stageId: fields.stageId }),
          ...(fields.theme !== undefined && { theme: fields.theme }),
          revision: { increment: 1 },
          updatedById: actor.userId,
        },
      });
      await touchModule(tx, moduleId);
    });
  }

  /**
   * Nouvelle version de travail d'un module publié (ou refusé/archivé) : copie du contenu de la
   * version publiée (à défaut, de la plus récente). La version publiée reste visible et inchangée.
   */
  async createVersion(actor: Actor, moduleId: string): Promise<void> {
    assertCan(actor, 'module.write');
    try {
      await this.prisma.$transaction(async (tx) => {
        const { publishedVersionId } = await resolveAccess(tx, actor, moduleId);
        await tx.$queryRaw`SELECT id FROM pedagogical_modules WHERE id = ${moduleId}::uuid FOR UPDATE`;
        const versions = await tx.moduleVersion.findMany({
          where: { moduleId },
          include: { lessons: { orderBy: { position: 'asc' } }, resources: true },
          orderBy: { version: 'desc' },
        });
        if (versions.some((version) => isWorkingStatus(version.status)))
          throw workingVersionExists();
        const source =
          versions.find((version) => version.id === publishedVersionId) ?? versions[0]!;
        const created = await tx.moduleVersion.create({
          data: {
            moduleId,
            version: versions[0]!.version + 1,
            title: source.title,
            summary: source.summary,
            objectives: source.objectives,
            prerequisites: source.prerequisites,
            durationMinutes: source.durationMinutes,
            stageId: source.stageId,
            theme: source.theme,
            basedOnVersionId: source.id,
            createdById: actor.userId,
            updatedById: actor.userId,
          },
        });
        const lessonIds = new Map<string, string>();
        for (const lesson of source.lessons) {
          const copy = await tx.moduleLesson.create({
            data: {
              versionId: created.id,
              position: lesson.position,
              title: lesson.title,
              content: lesson.content as Prisma.InputJsonValue,
              durationMinutes: lesson.durationMinutes,
              createdById: actor.userId,
            },
          });
          lessonIds.set(lesson.id, copy.id);
        }
        for (const resource of source.resources) {
          await tx.moduleResource.create({
            data: {
              versionId: created.id,
              lessonId: resource.lessonId ? (lessonIds.get(resource.lessonId) ?? null) : null,
              kind: resource.kind,
              title: resource.title,
              url: resource.url,
              description: resource.description,
              createdById: actor.userId,
            },
          });
        }
        await recordEvent(tx, actor, {
          moduleId,
          versionId: created.id,
          action: 'CREEE',
          fromStatus: null,
          toStatus: 'BROUILLON',
          comment: `D’après la version ${source.version}.`,
        });
        await touchModule(tx, moduleId);
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw workingVersionExists();
      throw error;
    }
  }

  /** Reprise de la rédaction après une demande de corrections (A_CORRIGER → BROUILLON). */
  async resume(actor: Actor, moduleId: string, input: VersionActionInput): Promise<void> {
    assertCan(actor, 'module.write');
    const { versionId } = parseInput(versionActionInputSchema, input);
    await this.prisma.$transaction(async (tx) => {
      await resolveAccess(tx, actor, moduleId);
      const locked = await lockVersion(tx, moduleId, versionId);
      if (locked.status !== 'A_CORRIGER') throw invalidTransition(locked.status);
      await tx.moduleVersion.update({
        where: { id: versionId },
        data: { status: 'BROUILLON', revision: { increment: 1 }, updatedById: actor.userId },
      });
      await recordEvent(tx, actor, {
        moduleId,
        versionId,
        action: 'REPRISE',
        fromStatus: 'A_CORRIGER',
        toStatus: 'BROUILLON',
      });
      await touchModule(tx, moduleId);
    });
  }

  /** Soumission à l'approbation : la version est figée jusqu'à la décision du responsable. */
  async submit(actor: Actor, moduleId: string, input: SubmitModuleInput): Promise<void> {
    assertCan(actor, 'module.write');
    const { versionId, revision, note } = parseInput(submitModuleInputSchema, input);
    await this.prisma.$transaction(async (tx) => {
      await resolveAccess(tx, actor, moduleId);
      const locked = await lockVersion(tx, moduleId, versionId);
      if (locked.status !== 'BROUILLON') throw invalidTransition(locked.status);
      if (locked.revision !== revision) throw editConflict();
      const lessons = await tx.moduleLesson.findMany({
        where: { versionId },
        select: { title: true, content: true },
      });
      if (lessons.length === 0) {
        throw new UnprocessableEntityException({
          code: 'MODULE_INCOMPLETE',
          message: 'Ajoutez au moins une leçon avant de soumettre le module.',
        });
      }
      const empty = lessons.find((lesson) =>
        isLessonDocumentEmpty(toLessonDocument(lesson.content)),
      );
      if (empty) {
        throw new UnprocessableEntityException({
          code: 'MODULE_INCOMPLETE',
          message: `La leçon « ${empty.title} » est vide : complétez-la avant de soumettre.`,
        });
      }
      const now = new Date();
      await tx.moduleVersion.update({
        where: { id: versionId },
        data: {
          status: 'SOUMIS',
          submittedAt: now,
          submittedById: actor.userId,
          submissionNote: note ?? null,
          revision: { increment: 1 },
        },
      });
      await recordEvent(tx, actor, {
        moduleId,
        versionId,
        action: 'SOUMISE',
        fromStatus: 'BROUILLON',
        toStatus: 'SOUMIS',
        comment: note ?? null,
        audit: 'module.submitted',
      });
      await touchModule(tx, moduleId);
    });
  }

  // ─── Leçons ──────────────────────────────────────────────────────────────

  async addLesson(
    actor: Actor,
    moduleId: string,
    input: CreateLessonInput,
  ): Promise<{ id: string }> {
    assertCan(actor, 'module.write');
    const data = parseInput(createLessonInputSchema, input);
    return this.prisma.$transaction(async (tx) => {
      await resolveAccess(tx, actor, moduleId);
      // Verrou exclusif : deux ajouts simultanés reçoivent des rangs distincts.
      const locked = await lockVersion(tx, moduleId, data.versionId);
      if (locked.status !== 'BROUILLON') throw versionNotEditable(locked.status);
      const count = await tx.moduleLesson.count({ where: { versionId: data.versionId } });
      if (count >= 200) {
        throw new UnprocessableEntityException({
          code: 'TOO_MANY_LESSONS',
          message: '200 leçons au maximum par module.',
        });
      }
      const lesson = await tx.moduleLesson.create({
        data: {
          versionId: data.versionId,
          position: count,
          title: data.title,
          durationMinutes: data.durationMinutes ?? null,
          content: (data.content ?? emptyLessonDocument()) as unknown as Prisma.InputJsonValue,
          createdById: actor.userId,
          updatedById: actor.userId,
        },
      });
      await touchModule(tx, moduleId);
      return { id: lesson.id };
    });
  }

  async updateLesson(actor: Actor, lessonId: string, input: UpdateLessonInput): Promise<void> {
    assertCan(actor, 'module.write');
    const { revision, ...fields } = parseInput(updateLessonInputSchema, input);
    await this.prisma.$transaction(async (tx) => {
      const { moduleId, versionId } = await this.lessonContext(tx, actor, lessonId);
      const locked = await lockVersion(tx, moduleId, versionId, 'SHARE');
      if (locked.status !== 'BROUILLON') throw versionNotEditable(locked.status);
      const { count } = await tx.moduleLesson.updateMany({
        where: { id: lessonId, revision },
        data: {
          ...(fields.title !== undefined && { title: fields.title }),
          ...(fields.durationMinutes !== undefined && { durationMinutes: fields.durationMinutes }),
          ...(fields.content !== undefined && {
            content: fields.content as unknown as Prisma.InputJsonValue,
          }),
          revision: { increment: 1 },
          updatedById: actor.userId,
        },
      });
      if (count === 0) throw editConflict();
      await touchModule(tx, moduleId);
    });
  }

  async deleteLesson(actor: Actor, lessonId: string, revision: number): Promise<void> {
    assertCan(actor, 'module.write');
    await this.prisma.$transaction(async (tx) => {
      const { moduleId, versionId } = await this.lessonContext(tx, actor, lessonId);
      const locked = await lockVersion(tx, moduleId, versionId);
      if (locked.status !== 'BROUILLON') throw versionNotEditable(locked.status);
      const lesson = await tx.moduleLesson.findUnique({ where: { id: lessonId } });
      if (!lesson) throw lessonNotFound();
      if (lesson.revision !== revision) throw editConflict();
      await tx.moduleResource.deleteMany({ where: { lessonId } });
      await tx.moduleLesson.delete({ where: { id: lessonId } });
      await tx.moduleLesson.updateMany({
        where: { versionId, position: { gt: lesson.position } },
        data: { position: { decrement: 1 } },
      });
      await touchModule(tx, moduleId);
    });
  }

  /** Nouvel ordre : la liste doit correspondre exactement aux leçons actuelles (sinon 409). */
  async reorderLessons(actor: Actor, moduleId: string, input: ReorderLessonsInput): Promise<void> {
    assertCan(actor, 'module.write');
    const { versionId, lessonIds } = parseInput(reorderLessonsInputSchema, input);
    await this.prisma.$transaction(async (tx) => {
      await resolveAccess(tx, actor, moduleId);
      const locked = await lockVersion(tx, moduleId, versionId);
      if (locked.status !== 'BROUILLON') throw versionNotEditable(locked.status);
      const current = await tx.moduleLesson.findMany({
        where: { versionId },
        select: { id: true },
      });
      const expected = new Set(current.map((lesson) => lesson.id));
      if (
        new Set(lessonIds).size !== lessonIds.length ||
        lessonIds.length !== expected.size ||
        lessonIds.some((id) => !expected.has(id))
      ) {
        throw editConflict();
      }
      for (const [position, id] of lessonIds.entries()) {
        await tx.moduleLesson.update({ where: { id }, data: { position } });
      }
      await touchModule(tx, moduleId);
    });
  }

  // ─── Ressources ──────────────────────────────────────────────────────────

  async addResource(actor: Actor, moduleId: string, input: CreateResourceInput): Promise<void> {
    assertCan(actor, 'module.write');
    const data = parseInput(createResourceInputSchema, input);
    await this.prisma.$transaction(async (tx) => {
      await resolveAccess(tx, actor, moduleId);
      const locked = await lockVersion(tx, moduleId, data.versionId, 'SHARE');
      if (locked.status !== 'BROUILLON') throw versionNotEditable(locked.status);
      if (data.lessonId) {
        const lesson = await tx.moduleLesson.findFirst({
          where: { id: data.lessonId, versionId: data.versionId },
          select: { id: true },
        });
        if (!lesson) throw lessonNotFound();
      }
      await tx.moduleResource.create({
        data: {
          versionId: data.versionId,
          lessonId: data.lessonId ?? null,
          kind: data.kind,
          title: data.title,
          url: data.url,
          description: data.description ?? null,
          createdById: actor.userId,
        },
      });
      await touchModule(tx, moduleId);
    });
  }

  async deleteResource(actor: Actor, resourceId: string): Promise<void> {
    assertCan(actor, 'module.write');
    await this.prisma.$transaction(async (tx) => {
      const resource = await tx.moduleResource.findUnique({
        where: { id: resourceId },
        select: { versionId: true, version: { select: { moduleId: true } } },
      });
      if (!resource) {
        throw new NotFoundException({
          code: 'RESOURCE_NOT_FOUND',
          message: 'Ressource introuvable.',
        });
      }
      const moduleId = resource.version.moduleId;
      await resolveAccess(tx, actor, moduleId);
      const locked = await lockVersion(tx, moduleId, resource.versionId, 'SHARE');
      if (locked.status !== 'BROUILLON') throw versionNotEditable(locked.status);
      await tx.moduleResource.delete({ where: { id: resourceId } });
      await touchModule(tx, moduleId);
    });
  }

  // ─── Collaborateurs ──────────────────────────────────────────────────────

  /** Chefs actifs pouvant être invités. */
  async chefCandidates(actor: Actor): Promise<UserSummary[]> {
    assertCan(actor, 'module.write');
    const users = await this.prisma.user.findMany({
      where: { role: 'CHEF', isActive: true },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return users;
  }

  /** Invitation d'un chef : réservée à l'auteur du module et au responsable. */
  async addCollaborator(
    actor: Actor,
    moduleId: string,
    input: AddCollaboratorInput,
  ): Promise<void> {
    assertCan(actor, 'module.write');
    const { userId } = parseInput(addCollaboratorInputSchema, input);
    try {
      await this.prisma.$transaction(async (tx) => {
        const { access, createdById } = await resolveAccess(tx, actor, moduleId);
        assertManager(access);
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user || !user.isActive || user.role !== 'CHEF') {
          throw new UnprocessableEntityException({
            code: 'INVALID_COLLABORATOR',
            message: 'Seul un chef actif peut être invité comme collaborateur.',
          });
        }
        if (userId === createdById) {
          throw new ConflictException({
            code: 'ALREADY_COLLABORATOR',
            message: 'Ce chef est l’auteur du module.',
          });
        }
        await tx.moduleCollaborator.create({
          data: { moduleId, userId, addedById: actor.userId },
        });
        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            action: 'module.collaborator_added',
            entityType: 'PedagogicalModule',
            entityId: moduleId,
            metadata: { userId },
          },
        });
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'ALREADY_COLLABORATOR',
          message: 'Ce chef collabore déjà à ce module.',
        });
      }
      throw error;
    }
  }

  async removeCollaborator(actor: Actor, moduleId: string, userId: string): Promise<void> {
    assertCan(actor, 'module.write');
    await this.prisma.$transaction(async (tx) => {
      const { access } = await resolveAccess(tx, actor, moduleId);
      assertManager(access);
      const { count } = await tx.moduleCollaborator.updateMany({
        where: { moduleId, userId, removedAt: null },
        data: { removedAt: new Date(), removedById: actor.userId },
      });
      if (count === 0) {
        throw new NotFoundException({
          code: 'COLLABORATOR_NOT_FOUND',
          message: 'Ce chef ne collabore pas à ce module.',
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: 'module.collaborator_removed',
          entityType: 'PedagogicalModule',
          entityId: moduleId,
          metadata: { userId },
        },
      });
    });
  }

  /** Activité éditoriale récente sur les modules accessibles. */
  async activity(actor: Actor): Promise<ModuleActivityItem[]> {
    assertCan(actor, 'module.write');
    const events = await this.prisma.moduleVersionEvent.findMany({
      where: { module: editableModulesWhere(actor) },
      include: { ...eventInclude, module: { select: { number: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return events.map(toActivityItem);
  }

  /** Module et version d'une leçon, après contrôle d'accès de l'acteur. */
  private async lessonContext(
    tx: Prisma.TransactionClient,
    actor: Actor,
    lessonId: string,
  ): Promise<{ moduleId: string; versionId: string }> {
    const lesson = await tx.moduleLesson.findUnique({
      where: { id: lessonId },
      select: { versionId: true, version: { select: { moduleId: true } } },
    });
    if (!lesson) throw lessonNotFound();
    await resolveAccess(tx, actor, lesson.version.moduleId);
    return { moduleId: lesson.version.moduleId, versionId: lesson.versionId };
  }
}

function accessOf(actor: Actor, createdById: string, isCollaborator: boolean): ModuleAccess {
  if (can(actor, 'module.writeAny')) return 'RESPONSABLE';
  return createdById === actor.userId ? 'AUTEUR' : isCollaborator ? 'COLLABORATEUR' : 'AUTEUR';
}

function assertManager(access: ModuleAccess): void {
  if (access === 'COLLABORATEUR') {
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Seuls l’auteur du module et le responsable gèrent les collaborateurs.',
    });
  }
}

/** Date de dernière activité du module (tri des listes). */
async function touchModule(tx: Prisma.TransactionClient, moduleId: string): Promise<void> {
  await tx.pedagogicalModule.update({ where: { id: moduleId }, data: { updatedAt: new Date() } });
}

/** Premier slug libre : « base », puis « base-2 », « base-3 »… */
async function availableSlug(tx: Prisma.TransactionClient, base: string): Promise<string> {
  const taken = new Set(
    (
      await tx.pedagogicalModule.findMany({
        where: { slug: { startsWith: base } },
        select: { slug: true },
      })
    ).map((module) => module.slug),
  );
  if (!taken.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

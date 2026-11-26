import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type AddReferenceEntryInput,
  addReferenceEntryInputSchema,
  type CreateReferenceCategoryInput,
  createReferenceCategoryInputSchema,
  documentPlainText,
  hasDialogue,
  type LessonDocument,
  lessonDocumentSchema,
  type ManagedReference,
  type ManagedReferenceCategory,
  type ReferenceCatalog,
  type ReferenceCategory,
  type ReferenceEntry,
  type ReferenceIcon,
  referenceSlug,
  type ReorderReferenceInput,
  reorderReferenceInputSchema,
  searchableText,
  searchExcerpt,
  type UpdateReferenceCategoryInput,
  updateReferenceCategoryInputSchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan, can } from '../../common/permissions.js';
import { parseInput } from '../../common/validation.js';
import { type Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { assertCanAtWrite } from '../auth/write-authority.js';
import { resolveAccess } from '../pedagogy/module-common.js';

const categoryNotFound = () =>
  new NotFoundException({ code: 'REFERENCE_CATEGORY_NOT_FOUND', message: 'Rubrique introuvable.' });
const entryNotFound = () =>
  new NotFoundException({ code: 'REFERENCE_ENTRY_NOT_FOUND', message: 'Ressource introuvable.' });

/** Requête de recherche : 2 à 80 caractères utiles, sinon ignorée. */
function normalizeQuery(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const query = raw.trim().slice(0, 80);
  return searchableText(query).length >= 2 ? query : null;
}

const entryInclude = {
  module: {
    select: {
      id: true,
      slug: true,
      createdById: true,
      publishedVersion: {
        select: {
          title: true,
          summary: true,
          lessons: {
            orderBy: { position: 'asc' },
            select: { id: true, lessonKey: true, title: true, content: true },
          },
        },
      },
      versions: {
        orderBy: { version: 'desc' },
        take: 1,
        select: { title: true, lessons: { select: { lessonKey: true, title: true } } },
      },
    },
  },
} satisfies Prisma.ReferenceEntryInclude;

type EntryRow = Prisma.ReferenceEntryGetPayload<{ include: typeof entryInclude }>;

interface VisibleLesson {
  id: string;
  title: string;
  content: LessonDocument;
}

/** Leçons publiées d'un rangement (toutes, ou la leçon désignée) ; null si rien n'est publié. */
function publishedLessons(entry: EntryRow): VisibleLesson[] | null {
  const version = entry.module.publishedVersion;
  if (!version) return null;
  const lessons = version.lessons
    .filter((lesson) => entry.lessonKey === null || lesson.lessonKey === entry.lessonKey)
    .map((lesson) => {
      const parsed = lessonDocumentSchema.safeParse(lesson.content);
      return {
        id: lesson.id,
        title: lesson.title,
        content: parsed.success ? parsed.data : { type: 'doc' as const, content: [] },
      };
    });
  return lessons.length > 0 ? lessons : null;
}

function hasAudio(document: LessonDocument): boolean {
  return document.content.some((block) => block.type === 'audio');
}

/**
 * Référentiel scout (D220). Lecture : toute personne qui lit la bibliothèque (`module.read`), sur
 * les seuls modules publiés ; une rubrique sans ressource publiée n'est jamais renvoyée. Écritures :
 * rubriques par le responsable plein en fonction (`reference.manage`, revérifié à l'écriture) ;
 * rangements par les rédacteurs du module (`module.write` + accès au module). Aucune lecture n'est
 * enregistrée : ni XP, ni statistique de consultation.
 */
@Injectable()
export class ReferenceService {
  constructor(private readonly prisma: PrismaService) {}

  async catalog(actor: Actor, rawQuery?: unknown): Promise<ReferenceCatalog> {
    assertCan(actor, 'module.read');
    const query = normalizeQuery(rawQuery);
    const needle = query ? searchableText(query) : null;
    const rows = await this.prisma.referenceCategory.findMany({
      where: { archivedAt: null },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      include: {
        entries: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], include: entryInclude },
      },
    });
    const categories: ReferenceCategory[] = [];
    for (const row of rows) {
      const entries: ReferenceEntry[] = [];
      for (const entry of row.entries) {
        const lessons = publishedLessons(entry);
        if (!lessons) continue;
        const single = entry.lessonKey !== null ? lessons[0]! : null;
        const title = single?.title ?? entry.module.publishedVersion!.title;
        let match: string | null = null;
        if (needle) {
          const inTitle =
            searchableText(title).includes(needle) ||
            searchableText(row.title).includes(needle) ||
            lessons.some((lesson) => searchableText(lesson.title).includes(needle));
          const body = lessons.map((lesson) => documentPlainText(lesson.content)).join('\n');
          match = searchExcerpt(body, query!);
          if (!inTitle && match === null) continue;
        }
        entries.push({
          id: entry.id,
          title,
          summary: single ? '' : entry.module.publishedVersion!.summary,
          moduleSlug: entry.module.slug,
          lessonId: single?.id ?? null,
          parts: single ? [] : lessons.map((lesson) => ({ id: lesson.id, title: lesson.title })),
          hasAudio: lessons.some((lesson) => hasAudio(lesson.content)),
          hasDialogue: lessons.some((lesson) => hasDialogue(lesson.content)),
          match,
        });
      }
      if (entries.length === 0) continue;
      categories.push({
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        icon: row.icon as ReferenceIcon | null,
        ambiance: row.ambiance,
        entries,
      });
    }
    return { categories };
  }

  /** Vue de gestion : toutes les rubriques (vides et retirées comprises) et l'état des rangements. */
  async manage(actor: Actor): Promise<ManagedReference> {
    if (!can(actor, 'reference.manage')) assertCan(actor, 'module.write');
    const writeAny = can(actor, 'module.writeAny');
    const rows = await this.prisma.referenceCategory.findMany({
      orderBy: [{ archivedAt: { sort: 'asc', nulls: 'first' } }, { position: 'asc' }],
      include: {
        entries: {
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
          include: {
            ...entryInclude,
            module: {
              select: {
                ...entryInclude.module.select,
                collaborators: {
                  where: { userId: actor.userId, removedAt: null },
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });
    const categories: ManagedReferenceCategory[] = rows.map((row) => {
      const entries = row.entries.map((entry) => {
        const lessons = publishedLessons(entry);
        const latest = entry.module.versions[0];
        const lessonTitle =
          entry.lessonKey === null
            ? null
            : (lessons?.[0]?.title ??
              latest?.lessons.find((lesson) => lesson.lessonKey === entry.lessonKey)?.title ??
              null);
        const state = lessons
          ? ('PUBLIEE' as const)
          : entry.lessonKey !== null && entry.module.publishedVersion
            ? ('LECON_ABSENTE' as const)
            : ('NON_PUBLIEE' as const);
        return {
          id: entry.id,
          moduleId: entry.module.id,
          moduleSlug: entry.module.slug,
          title: entry.module.publishedVersion?.title ?? latest?.title ?? entry.module.slug,
          lessonTitle,
          state,
          canRemove:
            writeAny ||
            entry.module.createdById === actor.userId ||
            entry.module.collaborators.length > 0,
        };
      });
      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        icon: row.icon as ReferenceIcon | null,
        ambiance: row.ambiance,
        archived: row.archivedAt !== null,
        visible: row.archivedAt === null && entries.some((entry) => entry.state === 'PUBLIEE'),
        entries,
      };
    });
    return { categories, canManageCategories: can(actor, 'reference.manage') };
  }

  async createCategory(actor: Actor, input: CreateReferenceCategoryInput): Promise<{ id: string }> {
    assertCan(actor, 'reference.manage');
    const data = parseInput(createReferenceCategoryInputSchema, input);
    return this.prisma.$transaction(async (tx) => {
      await assertCanAtWrite(tx, actor, 'reference.manage');
      const slug = await availableSlug(tx, referenceSlug(data.title));
      const last = await tx.referenceCategory.aggregate({ _max: { position: true } });
      const row = await tx.referenceCategory.create({
        data: {
          slug,
          title: data.title,
          description: data.description || null,
          icon: data.icon ?? null,
          ambiance: data.ambiance,
          position: (last._max.position ?? -1) + 1,
          createdById: actor.userId,
        },
      });
      await audit(tx, actor, 'reference.category_created', 'ReferenceCategory', row.id, {
        title: row.title,
      });
      return { id: row.id };
    });
  }

  async updateCategory(
    actor: Actor,
    id: string,
    input: UpdateReferenceCategoryInput,
  ): Promise<{ id: string }> {
    assertCan(actor, 'reference.manage');
    const data = parseInput(updateReferenceCategoryInputSchema, input);
    return this.prisma.$transaction(async (tx) => {
      await assertCanAtWrite(tx, actor, 'reference.manage');
      const current = await tx.referenceCategory.findUnique({ where: { id } });
      if (!current) throw categoryNotFound();
      const archivedAt =
        data.archived === undefined
          ? undefined
          : data.archived
            ? (current.archivedAt ?? new Date())
            : null;
      await tx.referenceCategory.update({
        where: { id },
        data: {
          title: data.title,
          description: data.description === undefined ? undefined : data.description || null,
          icon: data.icon,
          ambiance: data.ambiance,
          archivedAt,
        },
      });
      await audit(tx, actor, 'reference.category_updated', 'ReferenceCategory', id, {
        changes: Object.keys(data),
      });
      return { id };
    });
  }

  async reorderCategories(actor: Actor, input: ReorderReferenceInput): Promise<{ ok: true }> {
    assertCan(actor, 'reference.manage');
    const { ids } = parseInput(reorderReferenceInputSchema, input);
    await this.prisma.$transaction(async (tx) => {
      await assertCanAtWrite(tx, actor, 'reference.manage');
      const existing = await tx.referenceCategory.findMany({ select: { id: true } });
      assertSamePermutation(
        existing.map((row) => row.id),
        ids,
      );
      for (const [position, id] of ids.entries()) {
        await tx.referenceCategory.update({ where: { id }, data: { position } });
      }
      await audit(tx, actor, 'reference.categories_reordered', 'ReferenceCategory', null, {});
    });
    return { ok: true };
  }

  async reorderEntries(
    actor: Actor,
    categoryId: string,
    input: ReorderReferenceInput,
  ): Promise<{ ok: true }> {
    assertCan(actor, 'reference.manage');
    const { ids } = parseInput(reorderReferenceInputSchema, input);
    await this.prisma.$transaction(async (tx) => {
      await assertCanAtWrite(tx, actor, 'reference.manage');
      const existing = await tx.referenceEntry.findMany({
        where: { categoryId },
        select: { id: true },
      });
      if (existing.length === 0) throw categoryNotFound();
      assertSamePermutation(
        existing.map((row) => row.id),
        ids,
      );
      for (const [position, id] of ids.entries()) {
        await tx.referenceEntry.update({ where: { id }, data: { position } });
      }
      await audit(tx, actor, 'reference.entries_reordered', 'ReferenceCategory', categoryId, {});
    });
    return { ok: true };
  }

  /** Ranger un module (ou une leçon) : rédacteur du module ou responsable. */
  async addEntry(actor: Actor, input: AddReferenceEntryInput): Promise<{ id: string }> {
    assertCan(actor, 'module.write');
    const data = parseInput(addReferenceEntryInputSchema, input);
    return this.prisma.$transaction(async (tx) => {
      await resolveAccess(tx, actor, data.moduleId);
      const category = await tx.referenceCategory.findUnique({ where: { id: data.categoryId } });
      if (!category || category.archivedAt) throw categoryNotFound();
      let lessonKey: string | null = null;
      if (data.lessonId) {
        const lesson = await tx.moduleLesson.findFirst({
          where: { id: data.lessonId, version: { moduleId: data.moduleId } },
          select: { lessonKey: true },
        });
        if (!lesson) {
          throw new NotFoundException({ code: 'LESSON_NOT_FOUND', message: 'Leçon introuvable.' });
        }
        lessonKey = lesson.lessonKey;
      }
      const duplicate = await tx.referenceEntry.findFirst({
        where: { categoryId: category.id, moduleId: data.moduleId, lessonKey },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException({
          code: 'REFERENCE_ENTRY_EXISTS',
          message: 'Cette ressource est déjà rangée dans cette rubrique.',
        });
      }
      const last = await tx.referenceEntry.aggregate({
        where: { categoryId: category.id },
        _max: { position: true },
      });
      const row = await tx.referenceEntry.create({
        data: {
          categoryId: category.id,
          moduleId: data.moduleId,
          lessonKey,
          position: (last._max.position ?? -1) + 1,
          createdById: actor.userId,
        },
      });
      await audit(tx, actor, 'reference.entry_added', 'ReferenceEntry', row.id, {
        categoryId: category.id,
        moduleId: data.moduleId,
        lessonKey,
      });
      return { id: row.id };
    });
  }

  /** Retirer un rangement : le module et ses versions restent intacts. */
  async removeEntry(actor: Actor, id: string): Promise<{ ok: true }> {
    assertCan(actor, 'module.write');
    await this.prisma.$transaction(async (tx) => {
      const entry = await tx.referenceEntry.findUnique({ where: { id } });
      if (!entry) throw entryNotFound();
      await resolveAccess(tx, actor, entry.moduleId);
      await tx.referenceEntry.delete({ where: { id } });
      await audit(tx, actor, 'reference.entry_removed', 'ReferenceEntry', id, {
        categoryId: entry.categoryId,
        moduleId: entry.moduleId,
        lessonKey: entry.lessonKey,
      });
    });
    return { ok: true };
  }
}

function assertSamePermutation(existing: readonly string[], ids: readonly string[]): void {
  const expected = new Set(existing);
  if (
    ids.length !== expected.size ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !expected.has(id))
  ) {
    throw new ConflictException({
      code: 'REFERENCE_ORDER_STALE',
      message: 'La liste a changé entre-temps : rechargez la page.',
    });
  }
}

async function availableSlug(tx: Prisma.TransactionClient, base: string): Promise<string> {
  const taken = new Set(
    (
      await tx.referenceCategory.findMany({
        where: { slug: { startsWith: base } },
        select: { slug: true },
      })
    ).map((row) => row.slug),
  );
  if (!taken.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    if (!taken.has(`${base}-${suffix}`)) return `${base}-${suffix}`;
  }
}

async function audit(
  tx: Prisma.TransactionClient,
  actor: Actor,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Prisma.InputJsonObject,
): Promise<void> {
  await tx.auditLog.create({
    data: { actorId: actor.userId, action, entityType, entityId, metadata },
  });
}

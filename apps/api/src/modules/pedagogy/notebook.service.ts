import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  bookmarkInputSchema,
  type Notebook,
  type NoteSaveResult,
  noteInputSchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan } from '../../common/permissions.js';
import { parseInput } from '../../common/validation.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

type Row = { id: string; moduleSlug: string; lessonKey: string };

/**
 * Carnet personnel (D209) : favoris et notes du compte connecté **seulement**. Aucune méthode ne
 * prend un autre compte en paramètre ; aucune permission de l'encadrement n'y donne accès. Les
 * leçons sont rattachées à leur identité stable (`lesson_key`) et résolues dans la version publiée
 * actuelle ; un contenu retiré reste listé, marqué indisponible (rien n'est supprimé en silence).
 */
@Injectable()
export class NotebookService {
  constructor(private readonly prisma: PrismaService) {}

  async notebook(actor: Actor): Promise<Notebook> {
    assertCan(actor, 'practice.own');
    const [bookmarks, notes] = await Promise.all([
      this.prisma.learnerBookmark.findMany({
        where: { userId: actor.userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.learnerNote.findMany({
        where: { userId: actor.userId },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);
    const resolve = await this.resolver([...bookmarks, ...notes]);
    return {
      bookmarks: bookmarks.map((row) => ({
        kind: row.lessonKey ? ('lesson' as const) : ('module' as const),
        ...resolve(row),
      })),
      notes: notes.map((row) => ({
        ...resolve(row),
        body: row.body,
        revision: row.revision,
        updatedAt: row.updatedAt.toISOString(),
      })),
    };
  }

  async setBookmark(actor: Actor, body: unknown): Promise<Notebook> {
    assertCan(actor, 'practice.own');
    const input = parseInput(bookmarkInputSchema, body);
    const lessonKey = input.lessonId ? await this.lessonKey(input.moduleSlug, input.lessonId) : '';
    if (!input.lessonId) await this.publishedVersion(input.moduleSlug);
    const where = { userId: actor.userId, moduleSlug: input.moduleSlug, lessonKey };
    // Idempotent : ajouter deux fois ou retirer un favori absent ne change rien.
    if (input.on)
      await this.prisma.learnerBookmark.createMany({ data: [where], skipDuplicates: true });
    else await this.prisma.learnerBookmark.deleteMany({ where });
    return this.notebook(actor);
  }

  /**
   * Note d'une leçon : création, modification ou suppression (texte vide) selon la révision connue
   * de l'appareil. Une révision différente (autre appareil entre-temps) est un conflit explicite.
   */
  async saveNote(actor: Actor, body: unknown): Promise<NoteSaveResult> {
    assertCan(actor, 'practice.own');
    const input = parseInput(noteInputSchema, body);
    const lessonKey = await this.lessonKey(input.moduleSlug, input.lessonId);
    const text = input.body.trim();
    const key = {
      userId_moduleSlug_lessonKey: {
        userId: actor.userId,
        moduleSlug: input.moduleSlug,
        lessonKey,
      },
    };
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.learnerNote.findUnique({ where: key });
        if ((existing?.revision ?? 0) !== input.revision) throw noteConflict();
        if (!text) {
          if (existing) await tx.learnerNote.delete({ where: key });
          return { note: null, revision: 0 };
        }
        const saved = existing
          ? await tx.learnerNote.update({
              where: { id: existing.id, revision: existing.revision },
              data: { body: text, revision: existing.revision + 1 },
            })
          : await tx.learnerNote.create({
              data: { userId: actor.userId, moduleSlug: input.moduleSlug, lessonKey, body: text },
            });
        const resolve = await this.resolver([saved], tx);
        return {
          note: {
            ...resolve(saved),
            body: saved.body,
            revision: saved.revision,
            updatedAt: saved.updatedAt.toISOString(),
          },
          revision: saved.revision,
        };
      });
    } catch (error) {
      // Deux créations simultanées, ou mise à jour d'une révision dépassée.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2025'].includes(error.code)
      )
        throw noteConflict();
      throw error;
    }
  }

  /**
   * Suppression par le titulaire d'un favori ou d'une note, même pour un contenu retiré. Un
   * identifiant d'un autre compte est traité comme absent (aucune information divulguée).
   */
  async remove(actor: Actor, kind: 'bookmark' | 'note', id: string): Promise<Notebook> {
    assertCan(actor, 'practice.own');
    const where = { id, userId: actor.userId };
    const { count } =
      kind === 'note'
        ? await this.prisma.learnerNote.deleteMany({ where })
        : await this.prisma.learnerBookmark.deleteMany({ where });
    if (count === 0) throw contentNotFound();
    return this.notebook(actor);
  }

  private async publishedVersion(moduleSlug: string) {
    const module = await this.prisma.pedagogicalModule.findUnique({
      where: { slug: moduleSlug },
      select: { publishedVersionId: true },
    });
    if (!module?.publishedVersionId) throw contentNotFound();
    return module.publishedVersionId;
  }

  private async lessonKey(moduleSlug: string, lessonId: string): Promise<string> {
    const versionId = await this.publishedVersion(moduleSlug);
    const lesson = await this.prisma.moduleLesson.findFirst({
      where: { id: lessonId, versionId },
      select: { lessonKey: true },
    });
    if (!lesson) throw contentNotFound();
    return lesson.lessonKey;
  }

  /** Titres et leçons actuels des contenus référencés (une requête par lot, pas par ligne). */
  private async resolver(rows: readonly Row[], db: Prisma.TransactionClient = this.prisma) {
    const slugs = [...new Set(rows.map((row) => row.moduleSlug))];
    const modules = slugs.length
      ? await db.pedagogicalModule.findMany({
          where: { slug: { in: slugs } },
          select: {
            slug: true,
            publishedVersion: {
              select: {
                title: true,
                lessons: { select: { id: true, title: true, lessonKey: true } },
              },
            },
          },
        })
      : [];
    const bySlug = new Map(modules.map((module) => [module.slug, module.publishedVersion]));
    return (row: Row) => {
      const version = bySlug.get(row.moduleSlug) ?? null;
      const lesson = row.lessonKey
        ? (version?.lessons.find((item) => item.lessonKey === row.lessonKey) ?? null)
        : null;
      return {
        id: row.id,
        moduleSlug: row.moduleSlug,
        moduleTitle: version?.title ?? row.moduleSlug,
        lessonId: lesson?.id ?? null,
        lessonTitle: lesson?.title ?? null,
        available: !!version && (!row.lessonKey || !!lesson),
      };
    };
  }
}

function noteConflict(): ConflictException {
  return new ConflictException({
    code: 'NOTE_CONFLICT',
    message:
      'Cette note a été modifiée sur un autre appareil. Rechargez-la avant de l’enregistrer.',
  });
}

function contentNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'CONTENT_NOT_FOUND',
    message: 'Ce contenu n’est pas publié.',
  });
}

import { Injectable, NotFoundException } from '@nestjs/common';
import {
  type BankActivity,
  buildPracticeBank,
  computeBadges,
  type EarnedBadge,
  gradePractice,
  type LearningJournal,
  lessonReadInputSchema,
  lessonReadRef,
  nextReview,
  practiceActivitySchema,
  type PracticeBank,
  INSIGHT_MIN_LEARNERS,
  PRACTICE_KIND_LABELS,
  type PracticeInsights,
  PRACTICE_KINDS,
  type PracticeKind,
  type PracticeResult,
  practiceResultInputSchema,
  type RewardSummary,
  XP_RULES,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan } from '../../common/permissions.js';
import { parseInput } from '../../common/validation.js';
import { type LearningEventKind, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  formatModuleCode,
  lessonNotFound,
  moduleNotFound,
  toLessonDocument,
} from './module-common.js';

type Tx = Prisma.TransactionClient;

const DUE_LIMIT = 20;

function activityNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'PRACTICE_NOT_FOUND',
    message: 'Cette activité n’existe plus dans la version publiée du module.',
  });
}

/**
 * Entraînement libre et progression ludique (D194, D196, D197).
 * - La banque provient **uniquement** des versions publiées des modules (blocs « Activité » et
 *   activités dérivées du texte publié) : jamais d'un questionnaire officiel ni d'un brouillon.
 * - Le score n'est jamais reçu du client : l'API recorrige les réponses contre la version publiée.
 * - XP et badges : une attribution par référence (`learning_events`, index unique, ajout seul),
 *   rejouable sans doublon (hors ligne, double envoi, deux appareils).
 * - Aucun effet sur l'étape, les acquis, les rattrapages ni les résultats officiels.
 */
@Injectable()
export class PracticeService {
  constructor(private readonly prisma: PrismaService) {}

  async bank(actor: Actor): Promise<PracticeBank> {
    assertCan(actor, 'practice.play');
    const modules = await this.prisma.pedagogicalModule.findMany({
      where: { publishedVersionId: { not: null } },
      select: {
        slug: true,
        number: true,
        publishedVersion: {
          select: {
            version: true,
            title: true,
            theme: true,
            lessons: {
              select: { id: true, title: true, content: true },
              orderBy: { position: 'asc' },
            },
          },
        },
      },
      orderBy: { number: 'asc' },
    });
    return {
      modules: modules
        .map((module) => {
          const version = module.publishedVersion!;
          return {
            slug: module.slug,
            code: formatModuleCode(module.number),
            title: version.title,
            theme: version.theme,
            version: version.version,
            activities: safeBank(version.lessons),
          };
        })
        .filter((module) => module.activities.length > 0),
    };
  }

  /** Recorrige une activité, met à jour la révision et attribue les récompenses une seule fois. */
  async recordResult(actor: Actor, body: unknown): Promise<PracticeResult> {
    assertCan(actor, 'practice.own');
    const input = parseInput(practiceResultInputSchema, body);
    const entry = (await this.publishedBank(input.moduleSlug)).find(
      (item) => item.key === input.activityKey,
    );
    if (!entry) throw activityNotFound();
    const graded = gradePractice(entry.activity, input.answers);
    const correct = graded.filter(Boolean).length;
    const total = graded.length;
    // Mise en situation : explorée dès qu'un choix est fait (aucune note, aucune « bonne » réponse).
    const mastered = total === 0 ? input.answers.length > 0 : correct === total;
    const now = new Date();
    const ref = `${input.moduleSlug}:${input.activityKey}`;

    return this.prisma.$transaction(async (tx) => {
      const before = await this.badgeFacts(tx, actor.userId);
      const existing = await tx.practiceProgress.findUnique({
        where: {
          userId_moduleSlug_activityKey: {
            userId: actor.userId,
            moduleSlug: input.moduleSlug,
            activityKey: input.activityKey,
          },
        },
      });
      // Leitner : une réussite avant l'échéance ne fait pas monter la notion (pas de récompense de
      // la répétition immédiate) ; une erreur la ramène toujours à la première boîte.
      const early = existing && mastered && existing.dueOn.getTime() > now.getTime();
      const review = early
        ? { box: existing.box, dueOn: existing.dueOn.toISOString().slice(0, 10) }
        : nextReview(existing?.box ?? 0, mastered, now);
      const data = {
        activityKind: entry.activity.kind,
        lastCorrect: correct,
        lastTotal: total,
        box: review.box,
        dueOn: new Date(`${review.dueOn}T00:00:00Z`),
        lastPracticedAt: now,
        ...(mastered && !existing?.masteredAt && { masteredAt: now }),
      };
      await tx.practiceProgress.upsert({
        where: {
          userId_moduleSlug_activityKey: {
            userId: actor.userId,
            moduleSlug: input.moduleSlug,
            activityKey: input.activityKey,
          },
        },
        create: {
          userId: actor.userId,
          moduleSlug: input.moduleSlug,
          activityKey: input.activityKey,
          attempts: 1,
          ...data,
        },
        update: { attempts: { increment: 1 }, ...data },
      });

      let xp = await this.award(tx, actor.userId, 'ACTIVITE_TERMINEE', ref, input.moduleSlug);
      if (mastered)
        xp += await this.award(tx, actor.userId, 'ACTIVITE_MAITRISEE', ref, input.moduleSlug);
      // Révision utile : la notion monte d'une boîte (au plus une récompense par boîte atteinte).
      if (existing && mastered && review.box > existing.box && review.box >= 3)
        xp += await this.award(
          tx,
          actor.userId,
          'REVISION',
          `${ref}:${review.box}`,
          input.moduleSlug,
        );

      const rewards = await this.newBadges(tx, actor.userId, before, xp);
      return { correct, total, mastered, nextReviewOn: review.dueOn, ...rewards };
    });
  }

  /** Leçon lue jusqu'au bout (une fois par titre de leçon et par module, toutes versions). */
  async recordLessonRead(actor: Actor, body: unknown): Promise<RewardSummary> {
    assertCan(actor, 'practice.own');
    const input = parseInput(lessonReadInputSchema, body);
    const module = await this.prisma.pedagogicalModule.findUnique({
      where: { slug: input.moduleSlug },
      select: { publishedVersionId: true },
    });
    if (!module?.publishedVersionId) throw moduleNotFound();
    const lesson = await this.prisma.moduleLesson.findFirst({
      where: { id: input.lessonId, versionId: module.publishedVersionId },
      select: { title: true },
    });
    if (!lesson) throw lessonNotFound();
    return this.prisma.$transaction(async (tx) => {
      const before = await this.badgeFacts(tx, actor.userId);
      const xp = await this.award(
        tx,
        actor.userId,
        'LECON_LUE',
        lessonReadRef(input.moduleSlug, lesson.title),
        input.moduleSlug,
      );
      return this.newBadges(tx, actor.userId, before, xp);
    });
  }

  async journal(actor: Actor): Promise<LearningJournal> {
    assertCan(actor, 'practice.own');
    const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
    const facts = await this.badgeFacts(this.prisma, actor.userId);
    const [xp, due] = await Promise.all([
      this.prisma.learningEvent.aggregate({ where: { userId: actor.userId }, _sum: { xp: true } }),
      this.prisma.practiceProgress.findMany({
        where: { userId: actor.userId, dueOn: { lte: today } },
        orderBy: [{ dueOn: 'asc' }, { box: 'asc' }],
        take: DUE_LIMIT,
      }),
    ]);
    const reads = facts.events.filter((event) => event.kind === 'LECON_LUE');
    return {
      xp: xp._sum.xp ?? 0,
      lessonsRead: reads.length,
      activitiesMastered: facts.progress.filter((row) => row.masteredAt).length,
      badges: computeBadges(facts),
      dueReviews: due.map((row) => ({
        moduleSlug: row.moduleSlug,
        activityKey: row.activityKey,
        activityKind: (PRACTICE_KINDS as readonly string[]).includes(row.activityKind)
          ? (row.activityKind as PracticeKind)
          : 'quiz',
        dueOn: row.dueOn.toISOString().slice(0, 10),
        box: row.box,
      })),
      readLessons: reads.map((event) => event.ref),
      practiced: (
        await this.prisma.practiceProgress.findMany({
          where: { userId: actor.userId },
          select: { moduleSlug: true, activityKey: true },
        })
      ).map((row) => `${row.moduleSlug}:${row.activityKey}`),
    };
  }

  /**
   * Activités les plus difficiles (cahier § 84) : taux de réussite moyen au dernier essai, par
   * activité, à partir de 3 apprenants ; aucun nom, aucun suivi individuel, aucune note officielle.
   */
  async insights(actor: Actor): Promise<PracticeInsights> {
    assertCan(actor, 'statistics.read');
    const rows = await this.prisma.practiceProgress.findMany({
      where: { lastTotal: { gt: 0 } },
      select: { moduleSlug: true, activityKey: true, lastCorrect: true, lastTotal: true },
    });
    const groups = new Map<string, { slug: string; key: string; rates: number[] }>();
    for (const row of rows) {
      const id = `${row.moduleSlug}:${row.activityKey}`;
      const group = groups.get(id) ?? { slug: row.moduleSlug, key: row.activityKey, rates: [] };
      group.rates.push(row.lastCorrect / row.lastTotal);
      groups.set(id, group);
    }
    const hardest = [...groups.values()]
      .filter((group) => group.rates.length >= INSIGHT_MIN_LEARNERS)
      .map((group) => ({
        ...group,
        rate: group.rates.reduce((sum, rate) => sum + rate, 0) / group.rates.length,
      }))
      .filter((group) => group.rate < 1)
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 5);
    if (hardest.length === 0) return { items: [] };
    const bank = await this.bank(actor);
    return {
      items: hardest.flatMap((group) => {
        const module = bank.modules.find((item) => item.slug === group.slug);
        const entry = module?.activities.find((item) => item.key === group.key);
        if (!module || !entry) return [];
        return [
          {
            moduleSlug: module.slug,
            moduleTitle: module.title,
            lessonTitle: entry.lessonTitle,
            title: entry.activity.title || PRACTICE_KIND_LABELS[entry.activity.kind],
            learners: group.rates.length,
            successRate: Math.round(group.rate * 100) / 100,
          },
        ];
      }),
    };
  }

  private async publishedBank(slug: string): Promise<BankActivity[]> {
    const module = await this.prisma.pedagogicalModule.findUnique({
      where: { slug },
      select: {
        publishedVersion: {
          select: {
            lessons: {
              select: { id: true, title: true, content: true },
              orderBy: { position: 'asc' },
            },
          },
        },
      },
    });
    if (!module?.publishedVersion) throw moduleNotFound();
    return safeBank(module.publishedVersion.lessons);
  }

  /** Attribution idempotente : 0 si la référence a déjà été récompensée. */
  private async award(
    tx: Tx,
    userId: string,
    kind: LearningEventKind,
    ref: string,
    moduleSlug: string,
  ): Promise<number> {
    const xp = XP_RULES[kind];
    const created = await tx.learningEvent.createMany({
      data: [{ userId, kind, ref, moduleSlug, xp }],
      skipDuplicates: true,
    });
    return created.count === 1 ? xp : 0;
  }

  private async badgeFacts(tx: Tx | PrismaService, userId: string) {
    const [events, progress] = await Promise.all([
      tx.learningEvent.findMany({
        where: { userId },
        select: { kind: true, moduleSlug: true, createdAt: true, ref: true },
      }),
      tx.practiceProgress.findMany({
        where: { userId },
        select: { activityKind: true, attempts: true, box: true, masteredAt: true },
      }),
    ]);
    return { events, progress };
  }

  /** Badges obtenus par cette écriture (comparaison avant / après, dans la même transaction). */
  private async newBadges(
    tx: Tx,
    userId: string,
    before: Awaited<ReturnType<PracticeService['badgeFacts']>>,
    xpAwarded: number,
  ): Promise<RewardSummary> {
    const had = new Set(
      computeBadges(before)
        .filter((badge) => badge.earnedAt)
        .map((badge) => badge.key),
    );
    const after = computeBadges(await this.badgeFacts(tx, userId));
    const newBadges: EarnedBadge[] = after.filter((badge) => badge.earnedAt && !had.has(badge.key));
    return { xpAwarded, newBadges };
  }
}

/** Banque d'une version publiée ; une activité hors schéma (contenu ancien altéré) est ignorée. */
function safeBank(lessons: { id: string; title: string; content: Prisma.JsonValue }[]) {
  return buildPracticeBank(
    lessons.map((lesson) => ({ ...lesson, content: toLessonDocument(lesson.content) })),
  ).filter((entry) => practiceActivitySchema.safeParse(entry.activity).success);
}

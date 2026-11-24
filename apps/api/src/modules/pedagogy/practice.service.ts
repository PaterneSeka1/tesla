import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type BankActivity,
  buildPracticeBank,
  computeBadges,
  type EarnedBadge,
  gradePractice,
  type LearningJournal,
  lessonKeyReadRef,
  lessonReadInputSchema,
  lessonReadRef,
  mergeBadges,
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
  practiceResultSchema,
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

  /**
   * Enregistre une tentative (D201) : recorrection serveur, révision, récompenses.
   * - Idempotente par `attemptId` : la même tentative rejouée renvoie le résultat enregistré.
   * - Versionnée : si le contenu joué (`fingerprint`) n'est plus celui publié, la tentative est
   *   conservée comme périmée, sans recorrection ni effet.
   * - Sérialisée par compte (verrou transactionnel) : deux appareils simultanés ne se mélangent pas.
   */
  async recordResult(actor: Actor, body: unknown): Promise<PracticeResult> {
    assertCan(actor, 'practice.own');
    const input = parseInput(practiceResultInputSchema, body);
    const published = await this.publishedModule(input.moduleSlug);
    const entry = published.bank.find((item) => item.key === input.activityKey);
    // Sans identifiant de tentative (ancien client), une activité inconnue reste une erreur.
    if (!entry && !input.attemptId) throw activityNotFound();
    const attemptId = input.attemptId ?? randomUUID();
    const userId = actor.userId;
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    return this.prisma.$transaction(async (tx) => {
      await lockLearner(tx, userId);
      const replay = await tx.practiceAttempt.findUnique({
        where: { userId_attemptId: { userId, attemptId } },
      });
      if (replay) {
        if (replay.moduleSlug !== input.moduleSlug || replay.activityKey !== input.activityKey)
          throw attemptReused();
        return practiceResultSchema.parse(replay.result);
      }
      const attempt = {
        userId,
        attemptId,
        moduleSlug: input.moduleSlug,
        activityKey: input.activityKey,
        moduleVersion: published.version,
        activityFingerprint: input.fingerprint ?? null,
        mode: input.mode,
        item: input.item ?? null,
        assisted: input.assisted,
        answers: input.answers,
      };

      if (!entry || (input.fingerprint && input.fingerprint !== entry.fingerprint)) {
        const result: PracticeResult = {
          status: 'stale',
          correct: 0,
          total: 0,
          mastered: false,
          nextReviewOn: today,
          xpAwarded: 0,
          newBadges: [],
        };
        await tx.practiceAttempt.create({
          data: { ...attempt, status: 'PERIMEE', correct: 0, total: 0, mastered: false, result },
        });
        return result;
      }

      const before = await this.badgeFacts(tx, userId);
      const graded = gradeAttempt(entry.activity, input);
      const where = {
        userId_moduleSlug_activityKey: {
          userId,
          moduleSlug: input.moduleSlug,
          activityKey: input.activityKey,
        },
      };
      const existing = await tx.practiceProgress.findUnique({ where });
      const ref = `${input.moduleSlug}:${input.activityKey}`;
      const keep = existing
        ? { box: existing.box, dueOn: existing.dueOn.toISOString().slice(0, 10) }
        : null;
      let review = keep ?? nextReview(0, false, now);
      let xp = 0;

      if (input.mode === 'activity') {
        // Leitner : une réussite avant l'échéance ne fait pas monter la notion ; une réponse
        // assistée ne déplace rien ; une erreur ramène toujours à la première boîte.
        const early = existing && graded.mastered && existing.dueOn.getTime() > now.getTime();
        if (!(input.assisted || early))
          review = nextReview(existing?.box ?? 0, graded.mastered, now);
        const failed = !graded.mastered && !input.assisted && !existing?.masteredAt;
        const data = {
          activityKind: entry.activity.kind,
          lastCorrect: graded.correct,
          lastTotal: graded.total,
          box: review.box,
          dueOn: new Date(`${review.dueOn}T00:00:00Z`),
          lastPracticedAt: now,
          ...(graded.mastered && !existing?.masteredAt && { masteredAt: now }),
        };
        await tx.practiceProgress.upsert({
          where,
          create: {
            userId,
            moduleSlug: input.moduleSlug,
            activityKey: input.activityKey,
            attempts: 1,
            failuresBeforeMastery: failed ? 1 : 0,
            ...data,
          },
          update: {
            attempts: { increment: 1 },
            ...(failed && { failuresBeforeMastery: { increment: 1 } }),
            ...data,
          },
        });
        xp += await this.award(tx, userId, 'ACTIVITE_TERMINEE', ref, input.moduleSlug);
        if (graded.mastered)
          xp += await this.award(tx, userId, 'ACTIVITE_MAITRISEE', ref, input.moduleSlug);
        // Révision utile : la notion monte d'une boîte (au plus une récompense par boîte atteinte).
        if (existing && graded.mastered && review.box > existing.box && review.box >= 3)
          xp += await this.award(tx, userId, 'REVISION', `${ref}:${review.box}`, input.moduleSlug);
      } else if (input.mode === 'ascension' && graded.correct === 0) {
        // Erreur dans L'Ascension : la notion revient à revoir (jamais de maîtrise par une question).
        review = nextReview(0, false, now);
        const failed = !existing?.masteredAt;
        const data = {
          box: review.box,
          dueOn: new Date(`${review.dueOn}T00:00:00Z`),
          lastPracticedAt: now,
        };
        await tx.practiceProgress.upsert({
          where,
          create: {
            userId,
            moduleSlug: input.moduleSlug,
            activityKey: input.activityKey,
            activityKind: entry.activity.kind,
            attempts: 0,
            failuresBeforeMastery: failed ? 1 : 0,
            ...data,
          },
          update: { ...(failed && { failuresBeforeMastery: { increment: 1 } }), ...data },
        });
      } else if (input.mode === 'memory') {
        xp += await this.award(tx, userId, 'ACTIVITE_TERMINEE', ref, input.moduleSlug);
      }

      const rewards = await this.newBadges(tx, userId, before, xp);
      const result: PracticeResult = {
        status: 'counted',
        correct: graded.correct,
        total: graded.total,
        mastered: graded.mastered,
        nextReviewOn: review.dueOn,
        ...rewards,
      };
      await tx.practiceAttempt.create({
        data: {
          ...attempt,
          status: 'COMPTEE',
          correct: graded.correct,
          total: graded.total,
          mastered: graded.mastered,
          result,
        },
      });
      return result;
    });
  }

  /**
   * Leçon lue jusqu'au bout : une fois par leçon pédagogique (identité stable `lesson_key`,
   * renommage et nouvelles versions compris ; l'ancienne référence par titre reste reconnue).
   */
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
      select: { title: true, lessonKey: true },
    });
    if (!lesson) throw lessonNotFound();
    return this.prisma.$transaction(async (tx) => {
      await lockLearner(tx, actor.userId);
      const legacy = await tx.learningEvent.findUnique({
        where: {
          userId_kind_ref: {
            userId: actor.userId,
            kind: 'LECON_LUE',
            ref: lessonReadRef(input.moduleSlug, lesson.title),
          },
        },
        select: { id: true },
      });
      if (legacy) return { xpAwarded: 0, newBadges: [] };
      const before = await this.badgeFacts(tx, actor.userId);
      const xp = await this.award(
        tx,
        actor.userId,
        'LECON_LUE',
        lessonKeyReadRef(input.moduleSlug, lesson.lessonKey),
        input.moduleSlug,
      );
      return this.newBadges(tx, actor.userId, before, xp);
    });
  }

  async journal(actor: Actor): Promise<LearningJournal> {
    assertCan(actor, 'practice.own');
    const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
    const facts = await this.badgeFacts(this.prisma, actor.userId);
    const [xp, rows, bank] = await Promise.all([
      this.prisma.learningEvent.aggregate({ where: { userId: actor.userId }, _sum: { xp: true } }),
      this.prisma.practiceProgress.findMany({
        where: { userId: actor.userId },
        select: {
          moduleSlug: true,
          activityKey: true,
          activityKind: true,
          dueOn: true,
          box: true,
          masteredAt: true,
        },
        orderBy: [{ dueOn: 'asc' }, { box: 'asc' }],
      }),
      this.bank(actor),
    ]);
    // Révisions réconciliées avec les versions publiées : une activité retirée ou devenue
    // invalide ne bloque plus les autres (son suivi reste en base, rien n'est supprimé).
    const published = new Set(
      bank.modules.flatMap((module) =>
        module.activities.map((entry) => `${module.slug}:${entry.key}`),
      ),
    );
    const due = rows
      .filter(
        (row) =>
          row.dueOn.getTime() <= today.getTime() &&
          published.has(`${row.moduleSlug}:${row.activityKey}`),
      )
      .slice(0, DUE_LIMIT);
    const reads = facts.events.filter((event) => event.kind === 'LECON_LUE');
    const stored = await this.prisma.learningBadge.findMany({
      where: { userId: actor.userId },
      select: { badgeKey: true, earnedAt: true },
    });
    return {
      xp: xp._sum.xp ?? 0,
      lessonsRead: reads.length,
      activitiesMastered: facts.progress.filter((row) => row.masteredAt).length,
      badges: mergeBadges(computeBadges(facts), stored),
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
      readLessonIds: await this.readLessonIds(new Set(reads.map((event) => event.ref))),
      practiced: rows.map((row) => `${row.moduleSlug}:${row.activityKey}`),
      mastered: rows
        .filter((row) => row.masteredAt)
        .map((row) => `${row.moduleSlug}:${row.activityKey}`),
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

  private async publishedModule(slug: string): Promise<{ version: number; bank: BankActivity[] }> {
    const module = await this.prisma.pedagogicalModule.findUnique({
      where: { slug },
      select: {
        publishedVersion: {
          select: {
            version: true,
            lessons: {
              select: { id: true, title: true, content: true },
              orderBy: { position: 'asc' },
            },
          },
        },
      },
    });
    if (!module?.publishedVersion) throw moduleNotFound();
    return {
      version: module.publishedVersion.version,
      bank: safeBank(module.publishedVersion.lessons),
    };
  }

  /** Leçons publiées actuelles déjà lues (identité stable, ou ancienne référence par titre). */
  private async readLessonIds(refs: ReadonlySet<string>): Promise<string[]> {
    const slugs = [...new Set([...refs].map((ref) => ref.split(':')[0]!))];
    if (slugs.length === 0) return [];
    const modules = await this.prisma.pedagogicalModule.findMany({
      where: { slug: { in: slugs }, publishedVersionId: { not: null } },
      select: {
        slug: true,
        publishedVersion: {
          select: { lessons: { select: { id: true, title: true, lessonKey: true } } },
        },
      },
    });
    return modules.flatMap((module) =>
      (module.publishedVersion?.lessons ?? [])
        .filter(
          (lesson) =>
            refs.has(lessonKeyReadRef(module.slug, lesson.lessonKey)) ||
            refs.has(lessonReadRef(module.slug, lesson.title)),
        )
        .map((lesson) => lesson.id),
    );
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
        select: { activityKind: true, masteredAt: true, failuresBeforeMastery: true },
      }),
    ]);
    return { events, progress };
  }

  /**
   * Badges obtenus par cette écriture (comparaison avant / après, même transaction), puis
   * enregistrement de tout badge dont la condition est remplie : un badge enregistré n'est jamais
   * retiré et garde sa date réelle d'obtention.
   */
  private async newBadges(
    tx: Tx,
    userId: string,
    before: Awaited<ReturnType<PracticeService['badgeFacts']>>,
    xpAwarded: number,
  ): Promise<RewardSummary> {
    const stored = await tx.learningBadge.findMany({
      where: { userId },
      select: { badgeKey: true },
    });
    const had = new Set([
      ...stored.map((row) => row.badgeKey),
      ...computeBadges(before)
        .filter((badge) => badge.earnedAt)
        .map((badge) => badge.key),
    ]);
    const earned = computeBadges(await this.badgeFacts(tx, userId)).filter(
      (badge) => badge.earnedAt,
    );
    const known = new Set(stored.map((row) => row.badgeKey));
    const toStore = earned.filter((badge) => !known.has(badge.key));
    if (toStore.length > 0)
      await tx.learningBadge.createMany({
        data: toStore.map((badge) => ({
          userId,
          badgeKey: badge.key,
          earnedAt: new Date(badge.earnedAt!),
        })),
        skipDuplicates: true,
      });
    const newBadges: EarnedBadge[] = earned.filter((badge) => !had.has(badge.key));
    return { xpAwarded, newBadges };
  }
}

/** Sérialise les écritures ludiques d'un même compte (plusieurs appareils, rejeux simultanés). */
async function lockLearner(tx: Tx, userId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`practice:${userId}`}))`;
}

function attemptReused(): ConflictException {
  return new ConflictException({
    code: 'PRACTICE_ATTEMPT_REUSED',
    message: 'Cette tentative a déjà été enregistrée pour une autre activité.',
  });
}

function invalidMode(): BadRequestException {
  return new BadRequestException({
    code: 'PRACTICE_MODE_INVALID',
    message: 'Ce jeu ne correspond pas à cette activité.',
  });
}

/** Correction selon la façon de jouer (activité complète, question de L'Ascension, mémoire). */
function gradeAttempt(
  activity: BankActivity['activity'],
  input: { mode: string; item?: number; assisted: boolean; answers: (number | boolean | string)[] },
): { correct: number; total: number; mastered: boolean } {
  if (input.mode === 'ascension') {
    if (activity.kind !== 'quiz' || input.item === undefined || input.answers.length !== 1)
      throw invalidMode();
    const item = activity.items[input.item];
    if (!item) throw invalidMode();
    return { correct: input.answers[0] === item.answer ? 1 : 0, total: 1, mastered: false };
  }
  if (input.mode === 'memory') {
    if (activity.kind !== 'match') throw invalidMode();
    return { correct: 0, total: 0, mastered: false };
  }
  const graded = gradePractice(activity, input.answers);
  const correct = graded.filter(Boolean).length;
  const total = graded.length;
  // Mise en situation : explorée dès qu'un choix est fait (aucune note, aucune « bonne » réponse).
  const complete = total === 0 ? input.answers.length > 0 : correct === total;
  return { correct, total, mastered: complete && !input.assisted };
}

/** Banque d'une version publiée ; une activité hors schéma (contenu ancien altéré) est ignorée. */
function safeBank(lessons: { id: string; title: string; content: Prisma.JsonValue }[]) {
  return buildPracticeBank(
    lessons.map((lesson) => ({ ...lesson, content: toLessonDocument(lesson.content) })),
  ).filter((entry) => practiceActivitySchema.safeParse(entry.activity).success);
}

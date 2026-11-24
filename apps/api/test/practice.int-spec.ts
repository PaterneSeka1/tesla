import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  CSRF_HEADER,
  learningJournalSchema,
  type LessonDocument,
  practiceBankSchema,
  practiceInsightsSchema,
  practiceResultSchema,
  rewardSummarySchema,
  XP_RULES,
} from '@tesla/shared';
import request from 'supertest';
import { type App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { validateEnv } from '../src/config/env.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { type Prisma } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestPrisma, resetDatabase, testDatabaseUrl } from './int-database.js';

// Entraînement libre et récompenses ludiques (D194, D196, D197). PostgreSQL réel, données fictives.
const PASSWORD = 'mot-de-passe-fictif-de-test';
const OPERATION_ID = '019a0000-0000-7000-8000-000000000001';

const LESSON: LessonDocument = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Leçon fictive.' }] },
    {
      type: 'practice',
      attrs: {
        activity: {
          kind: 'truefalse',
          id: 'vf-fictif-1',
          items: [
            { statement: 'Affirmation fictive vraie.', answer: true },
            { statement: 'Affirmation fictive fausse.', answer: false },
          ],
        },
      },
    },
    {
      type: 'practice',
      attrs: {
        activity: {
          kind: 'quiz',
          id: 'qcm-fictif-1',
          items: [
            { prompt: 'Question fictive A ?', options: ['Oui', 'Non', 'Peut-être'], answer: 0 },
            { prompt: 'Question fictive B ?', options: ['Un', 'Deux', 'Trois'], answer: 2 },
          ],
        },
      },
    },
    {
      type: 'orderedList',
      content: ['Premier', 'Deuxième', 'Troisième'].map((text) => ({
        type: 'listItem' as const,
        content: [{ type: 'paragraph' as const, content: [{ type: 'text' as const, text }] }],
      })),
    },
  ],
};

describe('Entraînement libre et récompenses (intégration PostgreSQL)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordHash: string;
  let counter = 0;
  let lessonId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl();
    prisma = createTestPrisma();
    passwordHash = await hashPassword(PASSWORD);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(
      app,
      validateEnv({ NODE_ENV: 'test', DATABASE_URL: testDatabaseUrl(), SWAGGER_ENABLED: 'false' }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    lessonId = await publishedModule('entrainement-fictif', LESSON);
    await draftModule('brouillon-fictif');
  });

  async function login(role: 'ENCADREMENT' | 'ADMINISTRATEUR' | 'ROUTIER' | 'ADULTE') {
    counter += 1;
    const user = await prisma.user.create({
      data: {
        email: `jeu${counter}@example.test`,
        firstName: 'Fictif',
        lastName: `${role} ${counter}`,
        role,
        passwordHash,
      },
    });
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/auth/login')
      .set(CSRF_HEADER, '1')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);
    return {
      user,
      get: (path: string) => agent.get(`/api/v1${path}`),
      post: (path: string, body: object = {}, operationId?: string) => {
        const call = agent.post(`/api/v1${path}`).set(CSRF_HEADER, '1');
        if (operationId) call.set('x-tesla-operation-id', operationId);
        return call.send(body);
      },
    };
  }

  async function publishedModule(
    slug: string,
    content: LessonDocument,
    {
      lessonTitle = 'Leçon fictive',
      versionNumber = 1,
      lessonKey = undefined as string | undefined,
    } = {},
  ): Promise<string> {
    const module = await prisma.pedagogicalModule.upsert({
      where: { slug },
      create: { slug },
      update: {},
    });
    // Nouvelle version : l'ancienne publiée est archivée (une seule publiée par module).
    await prisma.moduleVersion.updateMany({
      where: { moduleId: module.id, status: 'PUBLIE' },
      data: { status: 'ARCHIVE' },
    });
    const version = await prisma.moduleVersion.create({
      data: { moduleId: module.id, version: versionNumber, title: `Module ${slug}` },
    });
    const lesson = await prisma.moduleLesson.create({
      data: {
        versionId: version.id,
        position: 0,
        title: lessonTitle,
        ...(lessonKey && { lessonKey }),
        content: structuredClone(content) as unknown as Prisma.InputJsonValue,
      },
    });
    for (const status of ['SOUMIS', 'APPROUVE', 'PUBLIE'] as const) {
      await prisma.moduleVersion.update({
        where: { id: version.id },
        data: { status, ...(status === 'PUBLIE' && { publishedAt: new Date() }) },
      });
    }
    await prisma.pedagogicalModule.update({
      where: { id: module.id },
      data: { publishedVersionId: version.id },
    });
    return lesson.id;
  }

  /** Brouillon contenant une activité : jamais dans la banque. */
  async function draftModule(slug: string) {
    const module = await prisma.pedagogicalModule.create({ data: { slug } });
    const version = await prisma.moduleVersion.create({
      data: { moduleId: module.id, version: 1, title: 'Brouillon fictif' },
    });
    await prisma.moduleLesson.create({
      data: {
        versionId: version.id,
        position: 0,
        title: 'Brouillon',
        content: {
          type: 'doc',
          content: [
            {
              type: 'practice',
              attrs: {
                activity: {
                  kind: 'truefalse',
                  id: 'vf-brouillon',
                  items: [{ statement: 'Non publié.', answer: true }],
                },
              },
            },
          ],
        },
      },
    });
  }

  it('banque : versions publiées seulement, activité rédigée et activité dérivée', async () => {
    const routier = await login('ROUTIER');
    const bank = practiceBankSchema.parse((await routier.get('/practice/bank').expect(200)).body);
    expect(bank.modules.map((module) => module.slug)).toEqual(['entrainement-fictif']);
    const kinds = bank.modules[0]!.activities.map((entry) => [entry.origin, entry.activity.kind]);
    expect(kinds).toEqual([
      ['authored', 'truefalse'],
      ['authored', 'quiz'],
      ['derived', 'order'],
    ]);
    // L'administrateur n'a pas accès à l'entraînement.
    await (await login('ADMINISTRATEUR')).get('/practice/bank').expect(403);
  });

  it('recorrige côté serveur et ne récompense qu’une fois (rejeu, deux envois)', async () => {
    const routier = await login('ROUTIER');
    const wrong = practiceResultSchema.parse(
      (
        await routier
          .post('/me/practice/results', {
            moduleSlug: 'entrainement-fictif',
            activityKey: 'vf-fictif-1',
            answers: [true, true],
          })
          .expect(200)
      ).body,
    );
    expect(wrong).toMatchObject({ correct: 1, total: 2, mastered: false });
    expect(wrong.xpAwarded).toBe(XP_RULES.ACTIVITE_TERMINEE);

    const body = {
      moduleSlug: 'entrainement-fictif',
      activityKey: 'vf-fictif-1',
      answers: [true, false],
    };
    const first = practiceResultSchema.parse(
      (await routier.post('/me/practice/results', body, OPERATION_ID).expect(200)).body,
    );
    expect(first).toMatchObject({
      correct: 2,
      mastered: true,
      xpAwarded: XP_RULES.ACTIVITE_MAITRISEE,
    });
    // Rejeu de la même opération (file hors ligne) : réponse rejouée, aucun nouvel essai.
    await routier.post('/me/practice/results', body, OPERATION_ID).expect(200);
    // Nouvel envoi distinct : aucune récompense en double.
    const again = practiceResultSchema.parse(
      (await routier.post('/me/practice/results', body).expect(200)).body,
    );
    expect(again.xpAwarded).toBe(0);

    const progress = await prisma.practiceProgress.findFirstOrThrow({
      where: { userId: routier.user.id },
    });
    expect(progress.attempts).toBe(3);
    const events = await prisma.learningEvent.findMany({ where: { userId: routier.user.id } });
    expect(events.map((event) => event.kind).sort()).toEqual([
      'ACTIVITE_MAITRISEE',
      'ACTIVITE_TERMINEE',
    ]);
    // Ajout seul : un événement ne se modifie ni ne se supprime.
    await expect(
      prisma.learningEvent.update({ where: { id: events[0]!.id }, data: { xp: 99 } }),
    ).rejects.toThrow();
  });

  it('refuse une activité inconnue, un brouillon et une entrée invalide', async () => {
    const routier = await login('ROUTIER');
    await routier
      .post('/me/practice/results', {
        moduleSlug: 'brouillon-fictif',
        activityKey: 'vf-brouillon',
        answers: [true],
      })
      .expect(404);
    await routier
      .post('/me/practice/results', {
        moduleSlug: 'entrainement-fictif',
        activityKey: 'inconnue-123',
        answers: [true],
      })
      .expect(404);
    await routier
      .post('/me/practice/results', {
        moduleSlug: 'entrainement-fictif',
        activityKey: 'X',
        answers: [],
      })
      .expect(400);
  });

  it('leçon lue : une récompense par leçon, badge « Premier pas », carnet personnel', async () => {
    const adulte = await login('ADULTE');
    const first = rewardSummarySchema.parse(
      (
        await adulte
          .post('/me/lessons/read', { moduleSlug: 'entrainement-fictif', lessonId })
          .expect(200)
      ).body,
    );
    expect(first.xpAwarded).toBe(XP_RULES.LECON_LUE);
    expect(first.newBadges.map((badge) => badge.key)).toEqual(['premier-pas']);
    const second = rewardSummarySchema.parse(
      (
        await adulte
          .post('/me/lessons/read', { moduleSlug: 'entrainement-fictif', lessonId })
          .expect(200)
      ).body,
    );
    expect(second).toEqual({ xpAwarded: 0, newBadges: [] });

    const journal = learningJournalSchema.parse((await adulte.get('/me/journal').expect(200)).body);
    expect(journal.xp).toBe(XP_RULES.LECON_LUE);
    expect(journal.lessonsRead).toBe(1);
    // Carnet strictement personnel : un autre compte part de zéro.
    const other = learningJournalSchema.parse(
      (await (await login('ROUTIER')).get('/me/journal').expect(200)).body,
    );
    expect(other.xp).toBe(0);
    // L'encadrement joue en aperçu : rien n'est enregistré.
    const chef = await login('ENCADREMENT');
    await chef.get('/practice/bank').expect(200);
    await chef
      .post('/me/lessons/read', { moduleSlug: 'entrainement-fictif', lessonId })
      .expect(403);
  });

  it('indicateur de l’encadrement : agrégé, à partir de trois apprenants, refusé aux routiers', async () => {
    const answer = (learner: Awaited<ReturnType<typeof login>>) =>
      learner
        .post('/me/practice/results', {
          moduleSlug: 'entrainement-fictif',
          activityKey: 'vf-fictif-1',
          answers: [false, false],
        })
        .expect(200);
    const learners = [await login('ROUTIER'), await login('ROUTIER'), await login('ADULTE')];
    const chef = await login('ENCADREMENT');
    await answer(learners[0]!);
    await answer(learners[1]!);
    // Deux apprenants seulement : rien n'est affiché (confidentialité).
    expect(
      practiceInsightsSchema.parse((await chef.get('/practice/insights').expect(200)).body).items,
    ).toEqual([]);
    await answer(learners[2]!);
    const insights = practiceInsightsSchema.parse(
      (await chef.get('/practice/insights').expect(200)).body,
    );
    expect(insights.items).toEqual([
      expect.objectContaining({ learners: 3, successRate: 0.5, moduleSlug: 'entrainement-fictif' }),
    ]);
    expect(JSON.stringify(insights)).not.toMatch(/Fictif|example\.test/);
    await learners[0]!.get('/practice/insights').expect(403);
  });

  const ATTEMPT = '019a0000-0000-7000-8000-0000000000a1';
  const result = (body: object) => ({
    moduleSlug: 'entrainement-fictif',
    activityKey: 'vf-fictif-1',
    ...body,
  });

  it('tentative : même identifiant rejoué (nouvel envoi, simultané) = un seul effet', async () => {
    const routier = await login('ROUTIER');
    const body = result({ attemptId: ATTEMPT, answers: [true, false] });
    const responses = await Promise.all(
      Array.from({ length: 4 }, () => routier.post('/me/practice/results', body)),
    );
    expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200]);
    const parsed = responses.map((response) => practiceResultSchema.parse(response.body));
    // Toutes les réponses sont identiques : la première enregistrée est rejouée.
    expect(new Set(parsed.map((item) => JSON.stringify(item))).size).toBe(1);
    expect(parsed[0]).toMatchObject({ status: 'counted', mastered: true });
    const progress = await prisma.practiceProgress.findFirstOrThrow({
      where: { userId: routier.user.id },
    });
    expect(progress.attempts).toBe(1);
    expect(await prisma.practiceAttempt.count({ where: { userId: routier.user.id } })).toBe(1);
    const xp = await prisma.learningEvent.aggregate({
      where: { userId: routier.user.id },
      _sum: { xp: true },
    });
    expect(xp._sum.xp).toBe(XP_RULES.ACTIVITE_TERMINEE + XP_RULES.ACTIVITE_MAITRISEE);
    // Même identifiant pour une autre activité : refus explicite.
    await routier
      .post('/me/practice/results', {
        ...body,
        activityKey: 'qcm-fictif-1',
        answers: [0, 2],
      })
      .expect(409);
    // Un autre compte peut utiliser le même identifiant sans collision.
    const other = await login('ROUTIER');
    await other.post('/me/practice/results', body).expect(200);
    // Historique en ajout seul.
    const row = await prisma.practiceAttempt.findFirstOrThrow({
      where: { userId: routier.user.id },
    });
    await expect(
      prisma.practiceAttempt.update({ where: { id: row.id }, data: { correct: 0 } }),
    ).rejects.toThrow();
  });

  it('version : un contenu modifié depuis la partie est conservé sans recorrection', async () => {
    const routier = await login('ROUTIER');
    const bank = practiceBankSchema.parse((await routier.get('/practice/bank').expect(200)).body);
    const entry = bank.modules[0]!.activities.find((item) => item.key === 'vf-fictif-1')!;
    expect(entry.fingerprint).toMatch(/^[0-9a-f]{8}$/);

    const stale = practiceResultSchema.parse(
      (
        await routier
          .post(
            '/me/practice/results',
            result({ attemptId: ATTEMPT, fingerprint: '00000000', answers: [true, false] }),
          )
          .expect(200)
      ).body,
    );
    expect(stale).toMatchObject({ status: 'stale', xpAwarded: 0, mastered: false });
    expect(await prisma.practiceProgress.count({ where: { userId: routier.user.id } })).toBe(0);
    expect(
      await prisma.practiceAttempt.findFirstOrThrow({ where: { userId: routier.user.id } }),
    ).toMatchObject({ status: 'PERIMEE', moduleVersion: 1 });

    // Activité retirée depuis : même traitement, jamais d'erreur bloquante pour la file.
    const removed = practiceResultSchema.parse(
      (
        await routier
          .post('/me/practice/results', {
            attemptId: '019a0000-0000-7000-8000-0000000000a2',
            moduleSlug: 'entrainement-fictif',
            activityKey: 'retiree-123',
            answers: [true],
          })
          .expect(200)
      ).body,
    );
    expect(removed.status).toBe('stale');

    const counted = practiceResultSchema.parse(
      (
        await routier
          .post(
            '/me/practice/results',
            result({
              attemptId: '019a0000-0000-7000-8000-0000000000a3',
              fingerprint: entry.fingerprint,
              answers: [true, false],
            }),
          )
          .expect(200)
      ).body,
    );
    expect(counted).toMatchObject({ status: 'counted', mastered: true });
  });

  it('réponse assistée : jamais une maîtrise ; Ascension : une erreur remet la notion à revoir', async () => {
    const routier = await login('ROUTIER');
    const assisted = practiceResultSchema.parse(
      (
        await routier
          .post(
            '/me/practice/results',
            result({ activityKey: 'qcm-fictif-1', assisted: true, answers: [0, 2] }),
          )
          .expect(200)
      ).body,
    );
    expect(assisted).toMatchObject({ correct: 2, total: 2, mastered: false });
    expect(assisted.xpAwarded).toBe(XP_RULES.ACTIVITE_TERMINEE);

    const ascension = (item: number, answer: number, assisted = false) =>
      routier.post(
        '/me/practice/results',
        result({
          activityKey: 'qcm-fictif-1',
          mode: 'ascension',
          item,
          assisted,
          answers: [answer],
        }),
      );
    const right = practiceResultSchema.parse((await ascension(0, 0).expect(200)).body);
    expect(right).toMatchObject({ correct: 1, total: 1, mastered: false, xpAwarded: 0 });
    await ascension(1, 0).expect(200);
    const progress = await prisma.practiceProgress.findFirstOrThrow({
      where: { userId: routier.user.id, activityKey: 'qcm-fictif-1' },
    });
    expect(progress).toMatchObject({ box: 1, attempts: 1, failuresBeforeMastery: 1 });
    // Mode incompatible ou question inexistante : refus.
    await ascension(9, 0).expect(400);
    await routier
      .post('/me/practice/results', result({ mode: 'ascension', item: 0, answers: [true] }))
      .expect(400);
    await routier.post('/me/practice/results', result({ mode: 'memory', answers: [] })).expect(400);
  });

  it('badges : Persévérance après de vraies difficultés, badge enregistré jamais retiré', async () => {
    const routier = await login('ROUTIER');
    const send = (answers: boolean[]) =>
      routier.post('/me/practice/results', result({ answers })).expect(200);
    // Trois réussites de suite : aucune difficulté, pas de Persévérance.
    const regular = await login('ROUTIER');
    for (let index = 0; index < 3; index++)
      await regular.post('/me/practice/results', result({ answers: [true, false] })).expect(200);
    let journal = learningJournalSchema.parse((await regular.get('/me/journal').expect(200)).body);
    expect(journal.badges.find((badge) => badge.key === 'perseverance')?.earnedAt).toBeNull();

    await send([false, true]);
    await send([false, true]);
    const success = practiceResultSchema.parse((await send([true, false])).body);
    expect(success.newBadges.map((badge) => badge.key)).toEqual(['perseverance']);
    const stored = await prisma.learningBadge.findFirstOrThrow({
      where: { userId: routier.user.id, badgeKey: 'perseverance' },
    });
    // Une erreur ultérieure ne retire rien ; la date d'obtention reste celle d'origine.
    await send([false, false]);
    journal = learningJournalSchema.parse((await routier.get('/me/journal').expect(200)).body);
    expect(journal.badges.find((badge) => badge.key === 'perseverance')?.earnedAt).toBe(
      stored.earnedAt.toISOString(),
    );
    await expect(prisma.learningBadge.delete({ where: { id: stored.id } })).rejects.toThrow();
  });

  it('leçon renommée dans une nouvelle version : déjà lue, aucune récompense en double', async () => {
    const adulte = await login('ADULTE');
    await adulte
      .post('/me/lessons/read', { moduleSlug: 'entrainement-fictif', lessonId })
      .expect(200);
    const original = await prisma.moduleLesson.findUniqueOrThrow({ where: { id: lessonId } });
    const renamedId = await publishedModule('entrainement-fictif', LESSON, {
      lessonTitle: 'Leçon fictive renommée',
      versionNumber: 2,
      lessonKey: original.lessonKey,
    });
    const journal = learningJournalSchema.parse((await adulte.get('/me/journal').expect(200)).body);
    expect(journal.readLessonIds).toEqual([renamedId]);
    const again = rewardSummarySchema.parse(
      (
        await adulte
          .post('/me/lessons/read', { moduleSlug: 'entrainement-fictif', lessonId: renamedId })
          .expect(200)
      ).body,
    );
    expect(again.xpAwarded).toBe(0);
  });
});

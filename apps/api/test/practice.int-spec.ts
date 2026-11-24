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

  async function publishedModule(slug: string, content: LessonDocument): Promise<string> {
    const module = await prisma.pedagogicalModule.create({ data: { slug } });
    const version = await prisma.moduleVersion.create({
      data: { moduleId: module.id, version: 1, title: `Module ${slug}` },
    });
    const lesson = await prisma.moduleLesson.create({
      data: {
        versionId: version.id,
        position: 0,
        title: 'Leçon fictive',
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
});

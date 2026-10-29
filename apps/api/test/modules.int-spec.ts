import { createHash } from 'node:crypto';
import { offlineModulePackageSchema } from '@tesla/shared';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  apiErrorSchema,
  catalogLessonSchema,
  catalogModuleDetailSchema,
  catalogPageSchema,
  CSRF_HEADER,
  editorModuleDetailSchema,
  editorModuleListItemSchema,
  type EditorModuleDetail,
  moduleActivityListSchema,
  moduleReviewSchema,
  paginatedSchema,
  printableModuleSchema,
  publicationHistoryItemSchema,
  submissionListSchema,
} from '@tesla/shared';
import request, { type Test as SupertestRequest } from 'supertest';
import { type App } from 'supertest/types.js';
import { type z } from 'zod';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { validateEnv } from '../src/config/env.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  createTestPrisma,
  grantPersona,
  personaRole,
  resetDatabase,
  type TestPersona,
  testDatabaseUrl,
} from './int-database.js';

// Modules pédagogiques de bout en bout : rédaction, collaboration, concurrence, workflow
// d'approbation, publication atomique et bibliothèque. Données exclusivement fictives.
const PASSWORD = 'mot-de-passe-fictif-de-test';

async function json<T>(req: SupertestRequest, status: number, schema: z.ZodType<T>): Promise<T> {
  const response = await req.expect(status);
  return schema.parse(response.body);
}

async function errorCode(req: SupertestRequest, status: number): Promise<string> {
  return (await json(req, status, apiErrorSchema)).code;
}

const paragraph = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

describe('Modules pédagogiques (intégration PostgreSQL)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordHash: string;
  let counter = 0;

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
  });

  async function loginAs(role: TestPersona) {
    counter += 1;
    const user = await prisma.user.create({
      data: {
        email: `module${counter}@example.test`,
        firstName: 'Fictif',
        lastName: `${role} ${counter}`,
        role: personaRole(role),
        passwordHash,
      },
    });
    await grantPersona(prisma, user.id, role);
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/auth/login')
      .set(CSRF_HEADER, '1')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);
    const write = (method: 'post' | 'patch' | 'delete', path: string, body: object = {}) =>
      agent[method](`/api/v1${path}`).set(CSRF_HEADER, '1').send(body);
    return {
      user,
      get: (path: string) => agent.get(`/api/v1${path}`),
      post: (path: string, body?: object) => write('post', path, body),
      patch: (path: string, body: object) => write('patch', path, body),
      del: (path: string) => write('delete', path),
    };
  }

  type Client = Awaited<ReturnType<typeof loginAs>>;

  const createModule = (client: Client, title = 'Histoire du scoutisme', extra: object = {}) =>
    json(
      client.post('/editor/modules', { title, summary: 'Résumé fictif.', ...extra }),
      201,
      editorModuleDetailSchema,
    );

  const addLesson = (client: Client, module: EditorModuleDetail, title: string, text = 'Contenu') =>
    json(
      client.post(`/editor/modules/${module.id}/lessons`, {
        versionId: module.current.id,
        title,
        content: paragraph(text),
      }),
      201,
      editorModuleDetailSchema,
    );

  const submit = (client: Client, module: EditorModuleDetail) =>
    json(
      client.post(`/editor/modules/${module.id}/submit`, {
        versionId: module.current.id,
        revision: module.current.revision,
      }),
      201,
      editorModuleDetailSchema,
    );

  /** Module rédigé par un chef, soumis, approuvé puis publié par le responsable. */
  async function publishedModule(
    chef: Client,
    responsable: Client,
    title?: string,
    extra?: object,
  ) {
    let module = await createModule(chef, title, extra);
    module = await addLesson(chef, module, 'Leçon 1');
    module = await submit(chef, module);
    const versionId = module.current.id;
    await responsable.post(`/admin/modules/${module.id}/approve`, { versionId }).expect(204);
    await responsable.post(`/admin/modules/${module.id}/publish`, { versionId }).expect(204);
    return module;
  }

  describe('Rédaction et collaboration', () => {
    it('un chef crée un module, ajoute, modifie et réordonne les leçons', async () => {
      const chef = await loginAs('CHEF');
      let module = await createModule(chef);
      expect(module.code).toMatch(/^MOD-\d{3}$/);
      expect(module.slug).toBe('histoire-du-scoutisme');
      expect(module.current).toMatchObject({ version: 1, status: 'BROUILLON', revision: 1 });
      expect(module.access).toBe('AUTEUR');

      module = await addLesson(chef, module, 'Baden-Powell');
      module = await addLesson(chef, module, 'Les débuts');
      const [first, second] = module.current.lessons;
      expect(module.current.lessons.map((l) => l.position)).toEqual([0, 1]);

      await chef
        .patch(`/editor/lessons/${first!.id}`, {
          revision: first!.revision,
          title: 'Baden-Powell, fondateur',
          content: paragraph('Texte révisé'),
        })
        .expect(204);
      module = await json(
        chef.post(`/editor/modules/${module.id}/lessons/reorder`, {
          versionId: module.current.id,
          lessonIds: [second!.id, first!.id],
        }),
        201,
        editorModuleDetailSchema,
      );
      expect(module.current.lessons.map((l) => l.title)).toEqual([
        'Les débuts',
        'Baden-Powell, fondateur',
      ]);
      expect(module.current.lessons[1]!.revision).toBe(2);

      module = await json(
        chef.patch(`/editor/modules/${module.id}`, {
          versionId: module.current.id,
          revision: 1,
          objectives: ['Connaître le fondateur'],
          durationMinutes: 45,
        }),
        200,
        editorModuleDetailSchema,
      );
      expect(module.current).toMatchObject({ revision: 2, durationMinutes: 45 });

      await chef.del(`/editor/lessons/${module.current.lessons[0]!.id}?revision=1`).expect(204);
      const after = await json(
        chef.get(`/editor/modules/${module.id}`),
        200,
        editorModuleDetailSchema,
      );
      expect(after.current.lessons.map((l) => [l.position, l.title])).toEqual([
        [0, 'Baden-Powell, fondateur'],
      ]);
    });

    it('un collaborateur invité rédige ; un chef non invité et un routier sont refusés', async () => {
      const [author, collaborator, outsider, routier] = await Promise.all([
        loginAs('CHEF'),
        loginAs('CHEF'),
        loginAs('CHEF'),
        loginAs('ROUTIER'),
      ]);
      let module = await createModule(author);

      expect(await errorCode(outsider.get(`/editor/modules/${module.id}`), 404)).toBe(
        'MODULE_NOT_FOUND',
      );
      await outsider
        .post(`/editor/modules/${module.id}/lessons`, { versionId: module.current.id, title: 'X' })
        .expect(404);
      await routier.get('/editor/modules').expect(403);
      await routier.post('/editor/modules', { title: 'Module routier' }).expect(403);

      module = await json(
        author.post(`/editor/modules/${module.id}/collaborators`, { userId: collaborator.user.id }),
        201,
        editorModuleDetailSchema,
      );
      expect(module.collaborators.map((c) => c.user.id)).toEqual([collaborator.user.id]);
      await author
        .post(`/editor/modules/${module.id}/collaborators`, { userId: routier.user.id })
        .expect(422);

      const seen = await json(
        collaborator.get('/editor/modules'),
        200,
        paginatedSchema(editorModuleListItemSchema),
      );
      expect(seen.items.map((m) => [m.id, m.access])).toEqual([[module.id, 'COLLABORATEUR']]);
      const outsiderList = await json(
        outsider.get('/editor/modules'),
        200,
        paginatedSchema(editorModuleListItemSchema),
      );
      expect(outsiderList.total).toBe(0);

      module = await addLesson(collaborator, module, 'Écrite par le collaborateur');
      expect(module.current.lessons[0]!.updatedBy?.id).toBe(collaborator.user.id);
      // Un collaborateur ne gère pas les collaborateurs.
      await collaborator
        .post(`/editor/modules/${module.id}/collaborators`, { userId: outsider.user.id })
        .expect(403);

      await author
        .del(`/editor/modules/${module.id}/collaborators/${collaborator.user.id}`)
        .expect(204);
      await collaborator.get(`/editor/modules/${module.id}`).expect(404);
      expect(await prisma.moduleCollaborator.count({ where: { moduleId: module.id } })).toBe(1);
    });

    it('refuse les contenus dangereux ou invalides', async () => {
      const chef = await loginAs('CHEF');
      const module = await createModule(chef);
      const lessonWith = (content: object) =>
        chef.post(`/editor/modules/${module.id}/lessons`, {
          versionId: module.current.id,
          title: 'Leçon',
          content,
        });
      const js = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'clic',
                marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
              },
            ],
          },
        ],
      };
      expect(await errorCode(lessonWith(js), 400)).toBe('VALIDATION_ERROR');
      expect(
        await errorCode(
          lessonWith({ type: 'doc', content: [{ type: 'html', html: '<script>' }] }),
          400,
        ),
      ).toBe('VALIDATION_ERROR');
      expect(
        await errorCode(
          chef.post(`/editor/modules/${module.id}/resources`, {
            versionId: module.current.id,
            kind: 'VIDEO',
            title: 'Vidéo',
            url: 'https://inconnu.example/video.mp4',
          }),
          400,
        ),
      ).toBe('VALIDATION_ERROR');
      expect(await errorCode(chef.post('/editor/modules', { title: '' }), 400)).toBe(
        'VALIDATION_ERROR',
      );

      // Attribut non prévu retiré avant stockage.
      await lessonWith({
        type: 'doc',
        content: [
          { type: 'image', attrs: { src: 'https://example.org/a.png', onerror: 'alert(1)' } },
        ],
      }).expect(201);
      const stored = await prisma.moduleLesson.findFirstOrThrow({
        where: { versionId: module.current.id },
      });
      expect(JSON.stringify(stored.content)).not.toContain('onerror');
    });
  });

  describe('Concurrence', () => {
    it('refuse l’écrasement silencieux d’une version ou d’une leçon modifiée entre-temps', async () => {
      const [chefA, chefB] = await Promise.all([loginAs('CHEF'), loginAs('RESPONSABLE')]);
      let module = await createModule(chefA);
      module = await addLesson(chefA, module, 'Leçon');
      const lesson = module.current.lessons[0]!;

      const results = await Promise.all(
        [chefA, chefB].map((client, i) =>
          client.patch(`/editor/modules/${module.id}`, {
            versionId: module.current.id,
            revision: module.current.revision,
            title: `Titre concurrent ${i}`,
          }),
        ),
      );
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(apiErrorSchema.parse(results.find((r) => r.status === 409)!.body).code).toBe(
        'EDIT_CONFLICT',
      );

      const lessonResults = await Promise.all(
        [chefA, chefB].map((client, i) =>
          client.patch(`/editor/lessons/${lesson.id}`, {
            revision: lesson.revision,
            content: paragraph(`Version ${i}`),
          }),
        ),
      );
      expect(lessonResults.map((r) => r.status).sort()).toEqual([204, 409]);
      const stored = await prisma.moduleLesson.findUniqueOrThrow({ where: { id: lesson.id } });
      expect(stored.revision).toBe(2);

      // Réordonnancement fondé sur une liste périmée.
      await chefA
        .post(`/editor/modules/${module.id}/lessons/reorder`, {
          versionId: module.current.id,
          lessonIds: [lesson.id, '0190a0b0-0000-7000-8000-000000000099'],
        })
        .expect(409);
    });

    it('ajouts simultanés de leçons : rangs distincts', async () => {
      const chef = await loginAs('CHEF');
      const module = await createModule(chef);
      await Promise.all(
        [1, 2, 3, 4].map((n) =>
          chef
            .post(`/editor/modules/${module.id}/lessons`, {
              versionId: module.current.id,
              title: `L${n}`,
            })
            .expect(201),
        ),
      );
      const lessons = await prisma.moduleLesson.findMany({
        where: { versionId: module.current.id },
      });
      expect(lessons.map((l) => l.position).sort()).toEqual([0, 1, 2, 3]);
    });
  });

  describe('Workflow d’approbation et publication', () => {
    it('soumission, refus des décisions par un chef, approbation et publication par le responsable', async () => {
      const [chef, responsable, routier] = await Promise.all([
        loginAs('CHEF'),
        loginAs('RESPONSABLE'),
        loginAs('ROUTIER'),
      ]);
      let module = await createModule(chef);
      await chef
        .post(`/editor/modules/${module.id}/submit`, {
          versionId: module.current.id,
          revision: module.current.revision,
        })
        .expect(422); // aucune leçon
      module = await addLesson(chef, module, 'Leçon 1');
      module = await json(
        chef.post(`/editor/modules/${module.id}/submit`, {
          versionId: module.current.id,
          revision: module.current.revision,
          note: 'Prêt pour relecture.',
        }),
        201,
        editorModuleDetailSchema,
      );
      expect(module.current.status).toBe('SOUMIS');
      const versionId = module.current.id;

      // Version figée : plus aucune modification.
      expect(
        await errorCode(
          chef.patch(`/editor/modules/${module.id}`, {
            versionId,
            revision: module.current.revision,
            title: 'Modif',
          }),
          409,
        ),
      ).toBe('VERSION_NOT_EDITABLE');

      // Un chef ne décide jamais.
      for (const action of ['approve', 'publish']) {
        await chef.post(`/admin/modules/${module.id}/${action}`, { versionId }).expect(403);
      }
      await chef
        .post(`/admin/modules/${module.id}/reject`, { versionId, comment: 'x' })
        .expect(403);
      await chef.get('/admin/modules/submissions').expect(403);

      // Publication d'une version non approuvée refusée.
      expect(
        await errorCode(
          responsable.post(`/admin/modules/${module.id}/publish`, { versionId }),
          409,
        ),
      ).toBe('VERSION_NOT_APPROVED');
      // Brouillon/soumission invisibles des routiers.
      await routier.get(`/modules/${module.slug}`).expect(404);

      const queue = await json(
        responsable.get('/admin/modules/submissions'),
        200,
        submissionListSchema,
      );
      expect(queue.items.map((i) => [i.moduleId, i.submissionNote])).toEqual([
        [module.id, 'Prêt pour relecture.'],
      ]);
      const review = await json(
        responsable.get(`/admin/modules/${module.id}/review`),
        200,
        moduleReviewSchema,
      );
      expect(review.module.current.lessons[0]!.content).toEqual(paragraph('Contenu'));

      await responsable.post(`/admin/modules/${module.id}/approve`, { versionId }).expect(204);
      await responsable.post(`/admin/modules/${module.id}/publish`, { versionId }).expect(204);

      const catalog = await json(routier.get('/modules'), 200, catalogPageSchema);
      expect(catalog.items.map((m) => [m.slug, m.version])).toEqual([[module.slug, 1]]);
      const audit = await prisma.auditLog.findMany({
        where: { entityId: versionId },
        orderBy: { createdAt: 'asc' },
      });
      expect(audit.map((a) => a.action)).toEqual([
        'module.submitted',
        'module.approved',
        'module.published',
      ]);
    });

    it('demande de corrections motivée, reprise, refus', async () => {
      const [chef, responsable] = await Promise.all([loginAs('CHEF'), loginAs('RESPONSABLE')]);
      let module = await createModule(chef);
      module = await addLesson(chef, module, 'Leçon 1');
      module = await submit(chef, module);
      const versionId = module.current.id;

      await responsable
        .post(`/admin/modules/${module.id}/request-changes`, { versionId })
        .expect(400);
      await responsable
        .post(`/admin/modules/${module.id}/request-changes`, {
          versionId,
          comment: 'Préciser les objectifs.',
        })
        .expect(204);
      module = await json(chef.get(`/editor/modules/${module.id}`), 200, editorModuleDetailSchema);
      expect(module.current.status).toBe('A_CORRIGER');
      expect(module.events[0]).toMatchObject({
        action: 'CORRECTIONS_DEMANDEES',
        comment: 'Préciser les objectifs.',
      });
      expect(module.permissions).toMatchObject({ canEdit: false, canResume: true });

      module = await json(
        chef.post(`/editor/modules/${module.id}/resume`, { versionId }),
        201,
        editorModuleDetailSchema,
      );
      expect(module.current.status).toBe('BROUILLON');
      module = await submit(chef, module);
      await responsable
        .post(`/admin/modules/${module.id}/reject`, { versionId, comment: 'Hors programme.' })
        .expect(204);
      module = await json(chef.get(`/editor/modules/${module.id}`), 200, editorModuleDetailSchema);
      expect(module.current.status).toBe('REFUSE');
      expect(module.permissions.canCreateVersion).toBe(true);
    });

    it('une nouvelle version laisse l’ancienne publiée jusqu’à la publication atomique', async () => {
      const [chef, responsable, routier] = await Promise.all([
        loginAs('CHEF'),
        loginAs('RESPONSABLE'),
        loginAs('ROUTIER'),
      ]);
      const v1 = await publishedModule(chef, responsable);
      const v1Lesson = v1.current.lessons[0]!;

      // Une version publiée n'est jamais modifiée directement.
      await chef
        .patch(`/editor/lessons/${v1Lesson.id}`, {
          revision: v1Lesson.revision,
          title: 'Modif silencieuse',
        })
        .expect(409);

      let module = await json(
        chef.post(`/editor/modules/${v1.id}/versions`),
        201,
        editorModuleDetailSchema,
      );
      expect(module.current).toMatchObject({ version: 2, status: 'BROUILLON', basedOnVersion: 1 });
      await chef.post(`/editor/modules/${v1.id}/versions`).expect(409); // une seule version de travail
      const v2Lesson = module.current.lessons[0]!;
      expect(v2Lesson.id).not.toBe(v1Lesson.id);
      await chef
        .patch(`/editor/lessons/${v2Lesson.id}`, {
          revision: v2Lesson.revision,
          content: paragraph('Nouveau texte'),
        })
        .expect(204);

      // Pendant la rédaction : la version 1 reste servie, inchangée.
      let lesson = await json(
        routier.get(`/modules/${v1.slug}/lessons/${v1Lesson.id}`),
        200,
        catalogLessonSchema,
      );
      expect(lesson.lesson.content).toEqual(paragraph('Contenu'));
      await routier.get(`/modules/${v1.slug}/lessons/${v2Lesson.id}`).expect(404);

      module = await json(chef.get(`/editor/modules/${v1.id}`), 200, editorModuleDetailSchema);
      module = await submit(chef, module);
      const versionId = module.current.id;
      await responsable.post(`/admin/modules/${v1.id}/approve`, { versionId }).expect(204);
      await responsable.post(`/admin/modules/${v1.id}/publish`, { versionId }).expect(204);

      const detail = await json(routier.get(`/modules/${v1.slug}`), 200, catalogModuleDetailSchema);
      expect(detail.version).toBe(2);
      lesson = await json(
        routier.get(`/modules/${v1.slug}/lessons/${v2Lesson.id}`),
        200,
        catalogLessonSchema,
      );
      expect(lesson.lesson.content).toEqual(paragraph('Nouveau texte'));

      const versions = await prisma.moduleVersion.findMany({
        where: { moduleId: v1.id },
        orderBy: { version: 'asc' },
      });
      expect(versions.map((v) => v.status)).toEqual(['ARCHIVE', 'PUBLIE']);
      // L'ancienne version reste intacte et consultable par les rédacteurs.
      const old = await prisma.moduleLesson.findUniqueOrThrow({ where: { id: v1Lesson.id } });
      expect(old.content).toEqual(paragraph('Contenu'));

      const history = await json(
        responsable.get('/admin/modules/history'),
        200,
        paginatedSchema(publicationHistoryItemSchema),
      );
      expect(history.items.map((i) => i.action).slice(0, 3)).toEqual([
        'PUBLIEE',
        'REMPLACEE',
        'APPROUVEE',
      ]);

      // Archivage : le module disparaît de la bibliothèque.
      await responsable
        .post(`/admin/modules/${v1.id}/archive`, { versionId, comment: 'Programme révisé.' })
        .expect(204);
      await routier.get(`/modules/${v1.slug}`).expect(404);
    });

    it('les triggers bloquent toute modification hors brouillon et l’effacement de l’historique', async () => {
      const [chef, responsable] = await Promise.all([loginAs('CHEF'), loginAs('RESPONSABLE')]);
      const module = await publishedModule(chef, responsable);
      const lessonId = module.current.lessons[0]!.id;
      await expect(
        prisma.moduleLesson.update({ where: { id: lessonId }, data: { title: 'Contournement' } }),
      ).rejects.toThrow();
      await expect(
        prisma.moduleVersion.update({
          where: { id: module.current.id },
          data: { title: 'Contournement' },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.moduleVersion.update({
          where: { id: module.current.id },
          data: { status: 'BROUILLON' },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.moduleVersionEvent.deleteMany({ where: { moduleId: module.id } }),
      ).rejects.toThrow();
    });
  });

  describe('Bibliothèque', () => {
    it('tout routier lit tous les modules publiés, quelle que soit son étape ; recherche et filtres', async () => {
      const [chef, responsable, routier] = await Promise.all([
        loginAs('CHEF'),
        loginAs('RESPONSABLE'),
        loginAs('ROUTIER'),
      ]);
      const stages = await prisma.progressionStage.findMany({ orderBy: { position: 'asc' } });
      await prisma.scoutProfile.create({
        data: {
          userId: routier.user.id,
          firstName: 'Routier',
          lastName: 'Fictif',
          joinedAt: new Date('2026-10-01'),
          currentStageId: stages[0]!.id,
        },
      });
      await publishedModule(chef, responsable, 'Loi scoute', {
        stageId: stages[0]!.id,
        theme: 'Valeurs',
      });
      const advanced = await publishedModule(chef, responsable, 'Leadership', {
        stageId: stages[3]!.id,
        theme: 'Vie en équipe',
      });
      await createModule(chef, 'Brouillon caché');

      const all = await json(routier.get('/modules'), 200, catalogPageSchema);
      expect(all.items.map((m) => m.title)).toEqual(['Leadership', 'Loi scoute']);
      expect(all.themes).toEqual(['Valeurs', 'Vie en équipe']);
      expect(all.myStageId).toBe(stages[0]!.id);

      const search = await json(routier.get('/modules?search=lead'), 200, catalogPageSchema);
      expect(search.items.map((m) => m.title)).toEqual(['Leadership']);
      const byTheme = await json(routier.get('/modules?theme=Valeurs'), 200, catalogPageSchema);
      expect(byTheme.items.map((m) => m.title)).toEqual(['Loi scoute']);
      const byStage = await json(
        routier.get(`/modules?stageId=${stages[3]!.id}`),
        200,
        catalogPageSchema,
      );
      expect(byStage.items.map((m) => m.title)).toEqual(['Leadership']);

      // Module d'une autre étape : lecture libre (seules les évaluations seront contrôlées).
      const detail = await json(
        routier.get(`/modules/${advanced.slug}`),
        200,
        catalogModuleDetailSchema,
      );
      expect(detail.stage?.id).toBe(stages[3]!.id);
      const lesson = await json(
        routier.get(`/modules/${advanced.slug}/lessons/${detail.lessons[0]!.id}`),
        200,
        catalogLessonSchema,
      );
      expect(lesson.next).toBeNull();
      const printable = await json(
        routier.get(`/modules/${advanced.slug}/print`),
        200,
        printableModuleSchema,
      );
      expect(printable.lessons).toHaveLength(1);

      await routier.get('/modules/brouillon-cache').expect(404);
      const activity = await json(chef.get('/editor/activity'), 200, moduleActivityListSchema);
      expect(activity.items.length).toBeGreaterThan(0);
    });

    it('exige une session', async () => {
      await request(app.getHttpServer()).get('/api/v1/modules').expect(401);
    });
  });
  it('paquet hors ligne publié : version exacte, contenu complet et empreinte vérifiable', async () => {
    const chef = await loginAs('CHEF');
    const responsable = await loginAs('RESPONSABLE');
    const routier = await loginAs('ROUTIER');
    const module = await publishedModule(chef, responsable);
    const pkg = await json(
      routier.get(`/modules/${module.slug}/offline-package`),
      200,
      offlineModulePackageSchema,
    );
    expect(pkg.versionId).toBe(module.current.id);
    expect(pkg.content.lessons.length).toBeGreaterThan(0);
    expect(createHash('sha256').update(JSON.stringify(pkg.content)).digest('hex')).toBe(pkg.digest);
    const draft = await createModule(chef);
    await routier.get(`/modules/${draft.slug}/offline-package`).expect(404);
  });
});

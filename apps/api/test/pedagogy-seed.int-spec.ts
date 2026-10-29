import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  apiErrorSchema,
  catalogPageSchema,
  CSRF_HEADER,
  editorModuleDetailSchema,
} from '@tesla/shared';
import request from 'supertest';
import { type App } from 'supertest/types.js';
import { SCOUTISME_BASE_MODULES } from '../prisma/seeds/scoutisme-base.seed.js';
import { type ImportResult, importSourceModules } from '../prisma/seeds/source-modules.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { validateEnv } from '../src/config/env.js';
import { type Role } from '../src/generated/prisma/enums.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestPrisma, resetDatabase, testDatabaseUrl } from './int-database.js';

// Seed pédagogique « Bases du scoutisme » : création en brouillon, idempotence, absence d'écrasement,
// workflow d'approbation inchangé. Comptes exclusivement fictifs.
const PASSWORD = 'mot-de-passe-fictif-de-test';

function createdId(result: ImportResult | undefined): string {
  if (result?.outcome !== 'CREE') throw new Error(`Module non créé : ${result?.outcome}`);
  return result.moduleId;
}

describe('Seed pédagogique (intégration PostgreSQL)', () => {
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

  async function loginAs(role: Role) {
    counter += 1;
    const user = await prisma.user.create({
      data: {
        email: `seed${counter}@example.test`,
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
    const write = (method: 'post' | 'patch', path: string, body: object = {}) =>
      agent[method](`/api/v1${path}`).set(CSRF_HEADER, '1').send(body);
    return {
      user,
      get: (path: string) => agent.get(`/api/v1${path}`),
      post: (path: string, body?: object) => write('post', path, body),
      patch: (path: string, body: object) => write('patch', path, body),
    };
  }

  const importAll = (dryRun = false) =>
    importSourceModules(prisma, SCOUTISME_BASE_MODULES, { dryRun });

  /** État complet des tables concernées, pour vérifier qu'une réexécution n'écrit rien. */
  const snapshot = async () => ({
    modules: await prisma.pedagogicalModule.findMany({ orderBy: { number: 'asc' } }),
    versions: await prisma.moduleVersion.findMany({ orderBy: { id: 'asc' } }),
    lessons: await prisma.moduleLesson.findMany({ orderBy: { id: 'asc' } }),
    events: await prisma.moduleVersionEvent.count(),
    imports: await prisma.moduleSourceImport.count(),
    audit: await prisma.auditLog.count(),
  });

  it('crée exactement les quatre modules en brouillon, sans approbation ni accès routier', async () => {
    const results = await importAll();
    expect(results.map((r) => [r.key, r.outcome])).toEqual([
      ['NT-SCOUT-M01', 'CREE'],
      ['NT-SCOUT-M02', 'CREE'],
      ['NT-SCOUT-M03', 'CREE'],
      ['NT-SCOUT-M04', 'CREE'],
    ]);

    const modules = await prisma.pedagogicalModule.findMany({
      orderBy: { number: 'asc' },
      include: {
        sourceImport: true,
        versions: {
          include: { stage: true, lessons: { orderBy: { position: 'asc' } } },
        },
        events: true,
      },
    });
    expect(modules).toHaveLength(4);
    modules.forEach((module, index) => {
      const source = SCOUTISME_BASE_MODULES[index]!;
      expect(module.slug).toBe(source.slug);
      expect(module.createdById).toBeNull();
      expect(module.publishedVersionId).toBeNull();
      expect(module.sourceImport).toMatchObject({
        sourceKey: source.key,
        sourceDocument: 'BASE DU SCOUTISME.pdf',
        sourceSha256: source.sourceSha256,
      });
      expect(module.versions).toHaveLength(1);
      const version = module.versions[0]!;
      expect(version).toMatchObject({
        version: 1,
        status: 'BROUILLON',
        title: source.title,
        createdById: null,
        submittedAt: null,
        approvedAt: null,
        approvedById: null,
        publishedAt: null,
      });
      expect(version.stage?.code).toBe(source.stageCode);
      expect(version.lessons.map((l) => [l.position, l.title])).toEqual(
        source.lessons.map((l, position) => [position, l.title]),
      );
      expect(version.lessons.every((l) => l.createdById === null)).toBe(true);
      // Seule la création est tracée, sans acteur humain.
      expect(module.events.map((e) => [e.action, e.actorId])).toEqual([['CREEE', null]]);
    });
    expect(await prisma.moduleLesson.count()).toBe(21);
    expect(await prisma.evaluation.count()).toBe(0);
    expect(
      await prisma.auditLog.count({ where: { action: 'module.imported', actorId: null } }),
    ).toBe(4);

    const routier = await loginAs('ROUTIER');
    const catalog = catalogPageSchema.parse((await routier.get('/modules').expect(200)).body);
    expect(catalog.total).toBe(0);
    await routier.get(`/modules/${SCOUTISME_BASE_MODULES[0]!.slug}`).expect(404);
    await routier.get(`/editor/modules/${modules[0]!.id}`).expect(403);
  });

  it('prévisualisation sans écriture, puis réexécution sans doublon ni écriture', async () => {
    const preview = await importAll(true);
    expect(preview.every((r) => r.outcome === 'A_CREER')).toBe(true);
    expect(await prisma.pedagogicalModule.count()).toBe(0);

    await importAll();
    const before = await snapshot();
    const again = await importAll();
    expect(again).toEqual(
      again.map((r) => ({
        key: r.key,
        outcome: 'DEJA_IMPORTE',
        moduleId: expect.any(String) as string,
        differences: [],
        changesSinceImport: [],
      })),
    );
    expect(await importAll(true)).toEqual(again);
    expect(await snapshot()).toEqual(before);
  });

  it('le responsable consulte et modifie un brouillon importé ; la réexécution ne l’écrase pas', async () => {
    const [m01, , m03] = await importAll();
    const responsable = await loginAs('RESPONSABLE');
    const chef = await loginAs('CHEF');

    // Chef non invité : le brouillon système ne lui est pas révélé.
    await chef.get(`/editor/modules/${createdId(m03)}`).expect(404);

    const moduleId = createdId(m01);
    const detail = editorModuleDetailSchema.parse(
      (await responsable.get(`/editor/modules/${moduleId}`).expect(200)).body,
    );
    expect(detail.createdBy).toBeNull();
    expect(detail.events[0]!.actor).toBeNull();
    expect(detail.sourceImport?.sourceKey).toBe('NT-SCOUT-M01');
    expect(detail.sourceImport?.editorialNotes.length).toBeGreaterThan(0);
    expect(detail.permissions.canEdit).toBe(true);

    const lesson = detail.current.lessons[0]!;
    const edited = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Texte relu.' }] }],
    };
    await responsable
      .patch(`/editor/lessons/${lesson.id}`, { revision: lesson.revision, content: edited })
      .expect(204);

    const [rerun] = await importAll();
    expect(rerun).toMatchObject({
      outcome: 'DEJA_IMPORTE',
      differences: [],
      changesSinceImport: ['1 leçon(s) modifiée(s)'],
    });
    const stored = await prisma.moduleLesson.findUniqueOrThrow({ where: { id: lesson.id } });
    expect(stored.content).toEqual(edited);
    expect(await prisma.moduleLesson.count()).toBe(21);

    // Une leçon vide (à rédiger) bloque la soumission.
    const m03Id = createdId(m03);
    const m03Detail = editorModuleDetailSchema.parse(
      (await responsable.get(`/editor/modules/${m03Id}`).expect(200)).body,
    );
    const refused = await responsable
      .post(`/editor/modules/${m03Id}/submit`, {
        versionId: m03Detail.current.id,
        revision: m03Detail.current.revision,
      })
      .expect(422);
    expect(apiErrorSchema.parse(refused.body).code).toBe('MODULE_INCOMPLETE');
  });

  it('la publication suit le workflow humain ; une version publiée n’est jamais remplacée', async () => {
    const [m01] = await importAll();
    const moduleId = createdId(m01);
    const responsable = await loginAs('RESPONSABLE');
    const detail = editorModuleDetailSchema.parse(
      (await responsable.get(`/editor/modules/${moduleId}`).expect(200)).body,
    );
    const versionId = detail.current.id;
    await responsable
      .post(`/editor/modules/${moduleId}/submit`, {
        versionId,
        revision: detail.current.revision,
      })
      .expect(201);
    await responsable.post(`/admin/modules/${moduleId}/approve`, { versionId }).expect(204);
    await responsable.post(`/admin/modules/${moduleId}/publish`, { versionId }).expect(204);

    const events = await prisma.moduleVersionEvent.findMany({
      where: { moduleId },
      orderBy: { createdAt: 'asc' },
    });
    expect(events.map((e) => [e.action, e.actorId])).toEqual([
      ['CREEE', null],
      ['SOUMISE', responsable.user.id],
      ['APPROUVEE', responsable.user.id],
      ['PUBLIEE', responsable.user.id],
    ]);

    // Source modifiée depuis l'import : écarts signalés, rien n'est appliqué.
    const changedSource = structuredClone(SCOUTISME_BASE_MODULES[0]!);
    changedSource.title = 'Titre révisé dans la source';
    changedSource.lessons[1]!.content = { type: 'doc', content: [] };
    const before = await snapshot();
    const [rerun] = await importSourceModules(prisma, [changedSource]);
    expect(rerun).toMatchObject({
      outcome: 'DEJA_IMPORTE',
      differences: ['title modifié dans la source', 'leçon 2 : contenu modifié'],
      changesSinceImport: ["version 1 à l'état PUBLIE", 'version 1 publiée'],
    });
    expect(await snapshot()).toEqual(before);
    const module = await prisma.pedagogicalModule.findUniqueOrThrow({
      where: { id: moduleId },
      include: { publishedVersion: true },
    });
    expect(module.publishedVersionId).toBe(versionId);
    expect(module.publishedVersion?.title).toBe('Découvrir le scoutisme');
  });

  it('ignore un module dont l’adresse est déjà prise par un module rédigé', async () => {
    const chef = await loginAs('CHEF');
    const created = editorModuleDetailSchema.parse(
      (
        await chef
          .post('/editor/modules', { title: 'NT SCOUT M01 Découvrir le scoutisme', summary: 'x' })
          .expect(201)
      ).body,
    );
    expect(created.slug).toBe('nt-scout-m01-decouvrir-le-scoutisme');
    const results = await importAll();
    expect(results[0]).toMatchObject({ key: 'NT-SCOUT-M01', outcome: 'IGNORE' });
    expect(results.slice(1).every((r) => r.outcome === 'CREE')).toBe(true);
    expect(await prisma.pedagogicalModule.count()).toBe(4);
  });

  it('la base refuse une décision sans auteur et toute réécriture de la provenance', async () => {
    const [m01] = await importAll();
    const moduleId = createdId(m01);
    const version = await prisma.moduleVersion.findFirstOrThrow({ where: { moduleId } });
    await expect(
      prisma.moduleVersionEvent.create({
        data: {
          moduleId,
          versionId: version.id,
          actorId: null,
          action: 'APPROUVEE',
          fromStatus: 'SOUMIS',
          toStatus: 'APPROUVE',
        },
      }),
    ).rejects.toThrow(/module_version_events_system_actor_check/);
    // Requêtes SQL directes : le message du trigger est conservé tel quel.
    await expect(
      prisma.$executeRaw`UPDATE module_source_imports SET source_pages = 'p. 9' WHERE module_id = ${moduleId}::uuid`,
    ).rejects.toThrow(/ajout seul/);
    await expect(
      prisma.$executeRaw`DELETE FROM module_source_imports WHERE module_id = ${moduleId}::uuid`,
    ).rejects.toThrow(/ajout seul/);
  });
});

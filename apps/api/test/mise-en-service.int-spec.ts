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
import { releaseActor, releaseCatalog } from '../prisma/seeds/release-catalog.js';
import { FUNDAMENTAL_TEXTS, ROUTE_MODULES } from '../prisma/seeds/route-bibliotheque.seed.js';
import { ROUTE_QUIZZES } from '../prisma/seeds/route-questionnaires.js';
import { SCOUTISME_BASE_MODULES } from '../prisma/seeds/scoutisme-base.seed.js';
import { importSourceModules, type SourceModule } from '../prisma/seeds/source-modules.js';
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

// Mise en service du catalogue : suppression des brouillons vides, publication au nom du responsable,
// questionnaires publiés, support de cours PDF. Comptes exclusivement fictifs.
const PASSWORD = 'mot-de-passe-fictif-de-test';
/** Brouillons importés vides (une leçon « À rédiger » sans texte), comme l'ancien catalogue de découverte. */
const EMPTY_SOURCES: SourceModule[] = [1, 2, 3].map((n) => ({
  key: `NT-TEST-V0${n}`,
  slug: `nt-test-vide-${n}`,
  title: `Brouillon vide ${n}`,
  summary: '',
  objectives: [],
  stageCode: null,
  theme: 'Test',
  category: 'TRANSVERSAL',
  sourceDocument: 'Source fictive (tests)',
  sourceSha256: '0'.repeat(64),
  sourcePages: '—',
  lessons: [{ title: 'À rédiger', content: { type: 'doc', content: [] } }],
  notes: [],
}));
const ALL_SOURCES = [
  ...SCOUTISME_BASE_MODULES,
  ...EMPTY_SOURCES,
  ...FUNDAMENTAL_TEXTS,
  ...ROUTE_MODULES,
];

function binary(
  response: request.Response,
  callback: (error: Error | null, body: Buffer) => void,
): void {
  const chunks: Buffer[] = [];
  const stream = response as unknown as NodeJS.ReadableStream;
  stream.on('data', (chunk: Buffer) => chunks.push(chunk));
  stream.on('end', () => callback(null, Buffer.concat(chunks)));
}

describe('Mise en service du catalogue (intégration PostgreSQL)', () => {
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
    await importSourceModules(prisma, ALL_SOURCES);
  });

  async function loginAs(role: TestPersona) {
    counter += 1;
    const user = await prisma.user.create({
      data: {
        email: `release${counter}@example.test`,
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
    return {
      user,
      agent,
      get: (path: string) => agent.get(`/api/v1${path}`),
      post: (path: string, body: object = {}) =>
        agent.post(`/api/v1${path}`).set(CSRF_HEADER, '1').send(body),
    };
  }

  const moduleId = async (key: string) =>
    (await prisma.moduleSourceImport.findUniqueOrThrow({ where: { sourceKey: key } })).moduleId;

  const snapshot = async () => ({
    modules: await prisma.pedagogicalModule.findMany({ orderBy: { number: 'asc' } }),
    versions: await prisma.moduleVersion.findMany({ orderBy: { id: 'asc' } }),
    lessons: await prisma.moduleLesson.count(),
    evaluations: await prisma.evaluation.count(),
    audit: await prisma.auditLog.count(),
  });

  it('supprime un brouillon vide sur décision motivée du responsable, jamais un module rédigé', async () => {
    const responsable = await loginAs('RESPONSABLE');
    const chef = await loginAs('CHEF');
    const emptyId = await moduleId('NT-TEST-V01');
    const fullId = await moduleId('NT-ROUTE-M03');

    const empty = editorModuleDetailSchema.parse(
      (await responsable.get(`/editor/modules/${emptyId}`).expect(200)).body,
    );
    expect(empty.permissions.canPurge).toBe(true);
    const full = editorModuleDetailSchema.parse(
      (await responsable.get(`/editor/modules/${fullId}`).expect(200)).body,
    );
    expect(full.permissions.canPurge).toBe(false);

    // Hors fonction de suppression, les protections restent actives.
    await expect(
      prisma.$executeRaw`DELETE FROM pedagogical_modules WHERE id = ${emptyId}::uuid`,
    ).rejects.toThrow();
    await chef
      .post(`/admin/modules/${emptyId}/purge`, { versionId: empty.current.id, comment: 'Vide.' })
      .expect(403);
    const refused = await responsable
      .post(`/admin/modules/${fullId}/purge`, { versionId: full.current.id, comment: 'Essai.' })
      .expect(422);
    expect(apiErrorSchema.parse(refused.body).code).toBe('MODULE_NOT_EMPTY');
    await responsable
      .post(`/admin/modules/${emptyId}/purge`, { versionId: empty.current.id })
      .expect(400);

    await responsable
      .post(`/admin/modules/${emptyId}/purge`, { versionId: empty.current.id, comment: 'Vide.' })
      .expect(204);
    expect(await prisma.pedagogicalModule.findUnique({ where: { id: emptyId } })).toBeNull();
    expect(
      await prisma.moduleSourceImport.findUnique({ where: { sourceKey: 'NT-TEST-V01' } }),
    ).toBeNull();
    // Traçabilité : l'import et la suppression restent au journal.
    expect(
      await prisma.auditLog.findMany({
        where: { entityId: emptyId },
        select: { action: true, actorId: true },
        orderBy: { createdAt: 'asc' },
      }),
    ).toEqual([
      { action: 'module.imported', actorId: null },
      { action: 'module.purged', actorId: responsable.user.id },
    ]);
    // Un module rédigé reste intact.
    expect(await prisma.moduleLesson.count({ where: { version: { moduleId: fullId } } })).toBe(6);
  });

  it('publie le catalogue au nom du responsable avec ses questionnaires, sans doublon à la réexécution', async () => {
    const responsable = await loginAs('RESPONSABLE');
    const routier = await loginAs('ROUTIER');
    const actor = await releaseActor(prisma);
    expect(actor.userId).toBe(responsable.user.id);

    // Prévisualisation : aucune écriture.
    const before = await snapshot();
    const preview = await releaseCatalog(prisma, actor, { dryRun: true });
    expect(await snapshot()).toEqual(before);
    expect(preview.filter((line) => line.outcome === 'SUPPRIME')).toHaveLength(3);

    const lines = await releaseCatalog(prisma, actor);
    expect(lines.map(({ key, outcome }) => ({ key, outcome }))).toEqual(
      preview.map(({ key, outcome }) => ({ key, outcome })),
    );
    expect(lines.filter((line) => line.outcome === 'SUPPRIME')).toHaveLength(3);
    expect(lines.filter((line) => line.outcome === 'PUBLIE')).toHaveLength(15);
    expect(lines.filter((line) => line.outcome === 'QUESTIONNAIRE_PUBLIE')).toHaveLength(
      ROUTE_QUIZZES.length,
    );

    // Modules : tous publiés, décisions attribuées au responsable, aucune leçon vide publiée.
    const modules = await prisma.pedagogicalModule.findMany({
      include: { publishedVersion: { include: { lessons: true } }, events: true },
    });
    expect(modules).toHaveLength(15);
    for (const module of modules) {
      expect(module.publishedVersion?.status).toBe('PUBLIE');
      expect(module.publishedVersion?.publishedById).toBe(responsable.user.id);
      for (const lesson of module.publishedVersion!.lessons) {
        expect(JSON.stringify(lesson.content)).toContain('"text"');
      }
      expect(
        module.events.filter((event) => event.action !== 'CREEE').map((e) => e.actorId),
      ).toEqual(expect.arrayContaining([responsable.user.id]));
    }
    const methode = modules.find((m) => m.publishedVersion?.title === 'La méthode scoute')!;
    expect(methode.publishedVersion!.lessons).toHaveLength(1);

    // Questionnaires : publiés, rattachés à la version publiée du module, à son étape.
    const evaluations = await prisma.evaluation.findMany({
      include: { publishedVersion: { include: { questionItems: true } }, module: true },
    });
    expect(evaluations).toHaveLength(ROUTE_QUIZZES.length);
    for (const evaluation of evaluations) {
      expect(evaluation.publishedVersion?.publishedById).toBe(responsable.user.id);
      expect(evaluation.publishedVersion?.moduleVersionId).toBe(
        evaluation.module!.publishedVersionId,
      );
      expect(evaluation.publishedVersion!.questionItems.length).toBeGreaterThanOrEqual(4);
    }
    // Aucune étape officielle modifiée.
    expect(await prisma.scoutStageChange.count()).toBe(0);

    const catalog = catalogPageSchema.parse(
      (await routier.get('/modules?pageSize=50').expect(200)).body,
    );
    expect(catalog.total).toBe(15);

    // Réexécution : rien n'est réécrit.
    const after = await snapshot();
    const again = await releaseCatalog(prisma, actor);
    expect(new Set(again.map((line) => line.outcome))).toEqual(
      new Set(['DEJA_PUBLIE', 'QUESTIONNAIRE_EXISTANT']),
    );
    expect(await snapshot()).toEqual(after);
  });

  it('refuse la mise en service sans responsable habilité', async () => {
    const chef = await loginAs('CHEF');
    await expect(releaseActor(prisma)).rejects.toThrow(/responsable plein/);
    await expect(releaseActor(prisma, chef.user.email)).rejects.toThrow(/Habilitations/);
  });

  it('fournit le support de cours PDF d’un module publié uniquement', async () => {
    await loginAs('RESPONSABLE');
    const routier = await loginAs('ROUTIER');
    await routier.get(`/modules/${ROUTE_MODULES[0]!.slug}/pdf`).expect(404);

    await releaseCatalog(prisma, await releaseActor(prisma));
    const response = await routier
      .get(`/modules/${ROUTE_MODULES[0]!.slug}/pdf`)
      .buffer(true)
      .parse(binary)
      .expect(200);
    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.headers['content-disposition']).toMatch(
      /^attachment; filename="MOD-\d{3,}-route-m03/,
    );
    expect((response.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
  });
});

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  apiErrorSchema,
  catalogModuleDetailSchema,
  catalogPageSchema,
  CSRF_HEADER,
  editorModuleDetailSchema,
  textCandidateListSchema,
} from '@tesla/shared';
import request from 'supertest';
import { type App } from 'supertest/types.js';
import {
  FUNDAMENTAL_TEXTS,
  PRIERE_ROUTE_KEY,
  PRIERE_ROUTE_ORIGINAL,
  ROUTE_MODULES,
} from '../prisma/seeds/route-bibliotheque.seed.js';
import { type ImportResult, importSourceModules } from '../prisma/seeds/source-modules.js';
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

// Bibliothèque de la Route : catalogue initial, textes fondamentaux liés sans copie, duplication,
// workflow humain inchangé. Comptes exclusivement fictifs.
const PASSWORD = 'mot-de-passe-fictif-de-test';
const SOURCES = [...FUNDAMENTAL_TEXTS, ...ROUTE_MODULES];

function createdId(result: ImportResult | undefined): string {
  if (result?.outcome !== 'CREE') throw new Error(`Module non créé : ${result?.outcome}`);
  return result.moduleId;
}

describe('Bibliothèque de la Route (intégration PostgreSQL)', () => {
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
        email: `biblio${counter}@example.test`,
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
    const write = (method: 'post' | 'patch' | 'put', path: string, body: object = {}) =>
      agent[method](`/api/v1${path}`).set(CSRF_HEADER, '1').send(body);
    return {
      user,
      get: (path: string) => agent.get(`/api/v1${path}`),
      post: (path: string, body?: object) => write('post', path, body),
      patch: (path: string, body: object) => write('patch', path, body),
      put: (path: string, body: object) => write('put', path, body),
    };
  }
  type Session = Awaited<ReturnType<typeof loginAs>>;

  const importAll = (dryRun = false) => importSourceModules(prisma, SOURCES, { dryRun });

  const detailOf = async (session: Session, moduleId: string) =>
    editorModuleDetailSchema.parse(
      (await session.get(`/editor/modules/${moduleId}`).expect(200)).body,
    );

  /** Soumission, approbation et publication par le responsable (workflow habituel). */
  async function publish(responsable: Session, moduleId: string) {
    const detail = await detailOf(responsable, moduleId);
    const versionId = detail.current.id;
    await responsable
      .post(`/editor/modules/${moduleId}/submit`, { versionId, revision: detail.current.revision })
      .expect(201);
    await responsable.post(`/admin/modules/${moduleId}/approve`, { versionId }).expect(204);
    await responsable.post(`/admin/modules/${moduleId}/publish`, { versionId }).expect(204);
  }

  const snapshot = async () => ({
    modules: await prisma.pedagogicalModule.findMany({ orderBy: { number: 'asc' } }),
    versions: await prisma.moduleVersion.findMany({ orderBy: { id: 'asc' } }),
    lessons: await prisma.moduleLesson.findMany({ orderBy: { id: 'asc' } }),
    links: await prisma.moduleTextLink.findMany({ orderBy: { id: 'asc' } }),
    events: await prisma.moduleVersionEvent.count(),
    imports: await prisma.moduleSourceImport.count(),
    audit: await prisma.auditLog.count(),
  });

  it('importe le catalogue en brouillon, lie la prière sans la copier et ne publie rien', async () => {
    const results = await importAll();
    expect(results.map((r) => r.outcome)).toEqual(SOURCES.map(() => 'CREE'));
    const versions = await prisma.moduleVersion.findMany({
      include: { module: { include: { sourceImport: true } }, textLinks: true },
    });
    expect(versions).toHaveLength(11);
    for (const version of versions) {
      expect(version).toMatchObject({
        version: 1,
        status: 'BROUILLON',
        createdById: null,
        approvedAt: null,
        publishedAt: null,
        obligation: null,
        officialSource: null,
      });
      expect(version.module.publishedVersionId).toBeNull();
    }
    expect(await prisma.moduleLesson.count()).toBe(
      SOURCES.reduce((sum, source) => sum + source.lessons.length, 0),
    );
    expect(await prisma.evaluation.count()).toBe(0);

    const priere = versions.find((v) => v.module.sourceImport?.sourceKey === PRIERE_ROUTE_KEY)!;
    expect(priere.category).toBe('TEXTE_FONDAMENTAL');
    expect(JSON.stringify(priere.module.sourceImport!.editorialNotes)).toContain(
      PRIERE_ROUTE_ORIGINAL.slice(2, 30),
    );
    const m03 = versions.find((v) => v.module.sourceImport?.sourceKey === 'NT-ROUTE-M03')!;
    expect(m03.textLinks.map((l) => l.textModuleId)).toEqual([priere.moduleId]);
    // Le texte de la prière n'existe qu'une fois en base.
    const lessons = await prisma.moduleLesson.findMany();
    expect(
      lessons.filter((l) => JSON.stringify(l.content).includes('gardez notre cœur pur')),
    ).toHaveLength(1);
    // Charte : aucun contenu créé.
    expect(lessons.some((l) => /charte/i.test(l.title))).toBe(false);

    const routier = await loginAs('ROUTIER');
    expect(catalogPageSchema.parse((await routier.get('/modules').expect(200)).body).total).toBe(0);
    await routier.get('/modules/priere-de-la-route').expect(404);
    await routier.get('/editor/texts').expect(403);
  });

  it('prévisualise sans écrire puis réexécute sans doublon ni écrasement', async () => {
    expect((await importAll(true)).every((r) => r.outcome === 'A_CREER')).toBe(true);
    expect(await prisma.pedagogicalModule.count()).toBe(0);

    const [, m03] = await importAll();
    const responsable = await loginAs('RESPONSABLE');
    const detail = await detailOf(responsable, createdId(m03));
    const lesson = detail.current.lessons[0]!;
    const edited = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Relu par le responsable.' }] },
      ],
    };
    await responsable
      .patch(`/editor/lessons/${lesson.id}`, { revision: lesson.revision, content: edited })
      .expect(204);

    const before = await snapshot();
    const again = await importAll();
    expect(again.every((r) => r.outcome === 'DEJA_IMPORTE')).toBe(true);
    expect(again[1]).toMatchObject({
      differences: [],
      changesSinceImport: ['1 leçon(s) modifiée(s)'],
    });
    expect(await snapshot()).toEqual(before);
    expect(
      (await prisma.moduleLesson.findUniqueOrThrow({ where: { id: lesson.id } })).content,
    ).toEqual(edited);
  });

  it('refuse un module citant un texte non importé', async () => {
    const [result] = await importSourceModules(prisma, [ROUTE_MODULES[0]!]);
    expect(result).toMatchObject({ outcome: 'IGNORE' });
    expect(await prisma.pedagogicalModule.count()).toBe(0);
  });

  it('un texte cité n’apparaît dans la bibliothèque qu’une fois publié ; la nouvelle version garde le lien', async () => {
    const [priere, m03] = await importAll();
    const responsable = await loginAs('RESPONSABLE');
    const routier = await loginAs('ROUTIER');

    await publish(responsable, createdId(m03));
    const before = catalogModuleDetailSchema.parse(
      (await routier.get(`/modules/${ROUTE_MODULES[0]!.slug}`).expect(200)).body,
    );
    expect(before.texts).toEqual([]);

    await publish(responsable, createdId(priere));
    const after = catalogModuleDetailSchema.parse(
      (await routier.get(`/modules/${ROUTE_MODULES[0]!.slug}`).expect(200)).body,
    );
    expect(after.texts).toEqual([{ slug: 'priere-de-la-route', title: 'Prière de la Route' }]);
    const texts = catalogPageSchema.parse(
      (await routier.get('/modules?category=TEXTE_FONDAMENTAL').expect(200)).body,
    );
    expect(texts.items.map((m) => m.slug)).toEqual(['priere-de-la-route']);

    // Publié : le lien est figé (trigger), la nouvelle version le recopie.
    const published = await detailOf(responsable, createdId(m03));
    await expect(
      prisma.moduleTextLink.deleteMany({ where: { versionId: published.current.id } }),
    ).rejects.toThrow();
    await responsable.post(`/editor/modules/${createdId(m03)}/versions`).expect(201);
    const draft = await detailOf(responsable, createdId(m03));
    expect(draft.current.version).toBe(2);
    expect(draft.current.textLinks.map((t) => t.slug)).toEqual(['priere-de-la-route']);
  });

  it('l’encadrement crée un texte fondamental et l’associe à un module ; contrôles d’accès', async () => {
    const responsable = await loginAs('RESPONSABLE');
    const chef = await loginAs('CHEF');
    const routier = await loginAs('ROUTIER');

    // Charte ajoutée depuis l'administration, sans modification du code.
    const charte = editorModuleDetailSchema.parse(
      (
        await responsable
          .post('/editor/modules', { title: 'Charte de la Route', category: 'TEXTE_FONDAMENTAL' })
          .expect(201)
      ).body,
    );
    const course = editorModuleDetailSchema.parse(
      (await chef.post('/editor/modules', { title: 'Module du chef' }).expect(201)).body,
    );

    const candidates = textCandidateListSchema.parse(
      (await chef.get('/editor/texts').expect(200)).body,
    );
    // Brouillon du responsable non révélé au chef.
    expect(candidates.items).toEqual([]);
    const forResponsable = textCandidateListSchema.parse(
      (await responsable.get('/editor/texts').expect(200)).body,
    );
    expect(forResponsable.items.map((t) => t.moduleId)).toEqual([charte.id]);
    expect(forResponsable.items[0]!.published).toBe(false);

    const linked = editorModuleDetailSchema.parse(
      (
        await chef
          .put(`/editor/modules/${course.id}/texts`, {
            versionId: course.current.id,
            textModuleIds: [charte.id],
          })
          .expect(200)
      ).body,
    );
    expect(linked.current.textLinks).toMatchObject([{ moduleId: charte.id, published: false }]);

    // Un module ordinaire ne peut pas être cité ; un module ne se cite pas lui-même.
    const refused = await chef
      .put(`/editor/modules/${charte.id}/texts`, {
        versionId: charte.current.id,
        textModuleIds: [course.id],
      })
      .expect(404);
    expect(apiErrorSchema.parse(refused.body).code).toBe('MODULE_NOT_FOUND');
    const notText = await responsable
      .put(`/editor/modules/${charte.id}/texts`, {
        versionId: charte.current.id,
        textModuleIds: [course.id],
      })
      .expect(422);
    expect(apiErrorSchema.parse(notText.body).code).toBe('INVALID_TEXT_LINK');
    await responsable
      .put(`/editor/modules/${charte.id}/texts`, {
        versionId: charte.current.id,
        textModuleIds: [charte.id],
      })
      .expect(422);
    await routier
      .put(`/editor/modules/${course.id}/texts`, {
        versionId: course.current.id,
        textModuleIds: [],
      })
      .expect(403);

    // Retrait : liste vide.
    const cleared = editorModuleDetailSchema.parse(
      (
        await chef
          .put(`/editor/modules/${course.id}/texts`, {
            versionId: course.current.id,
            textModuleIds: [],
          })
          .expect(200)
      ).body,
    );
    expect(cleared.current.textLinks).toEqual([]);
  });

  it('duplique un module en brouillon sans modifier l’original', async () => {
    const [, m03] = await importAll();
    const responsable = await loginAs('RESPONSABLE');
    const chef = await loginAs('CHEF');
    const sourceId = createdId(m03);
    const before = await detailOf(responsable, sourceId);

    await chef.post(`/editor/modules/${sourceId}/duplicate`).expect(404);
    const copy = editorModuleDetailSchema.parse(
      (await responsable.post(`/editor/modules/${sourceId}/duplicate`).expect(201)).body,
    );
    expect(copy.id).not.toBe(sourceId);
    expect(copy.createdBy?.id).toBe(responsable.user.id);
    expect(copy.sourceImport).toBeNull();
    expect(copy.current).toMatchObject({
      version: 1,
      status: 'BROUILLON',
      title: `${before.current.title} (copie)`,
      obligation: null,
    });
    expect(copy.current.lessons.map((l) => [l.title, l.content])).toEqual(
      before.current.lessons.map((l) => [l.title, l.content]),
    );
    expect(copy.current.textLinks).toEqual(before.current.textLinks);
    expect(await detailOf(responsable, sourceId)).toEqual(before);
    expect(
      await prisma.auditLog.count({
        where: { action: 'module.duplicated', actorId: responsable.user.id },
      }),
    ).toBe(1);
  });
});

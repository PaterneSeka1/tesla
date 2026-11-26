import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  apiErrorSchema,
  CSRF_HEADER,
  editorModuleDetailSchema,
  type LessonDocument,
  lessonFileImageSrc,
  managedReferenceSchema,
  referenceCatalogSchema,
} from '@tesla/shared';
import request, { type Test as SupertestRequest } from 'supertest';
import { type App } from 'supertest/types.js';
import { type z } from 'zod';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { validateEnv } from '../src/config/env.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestPrisma, resetDatabase, testDatabaseUrl } from './int-database.js';

// Référentiel scout (D220, D221). PostgreSQL réel, données et contenus fictifs (jamais un texte réel).
const PASSWORD = 'mot-de-passe-fictif-de-test';

async function json<T>(req: SupertestRequest, status: number, schema: z.ZodType<T>): Promise<T> {
  const response = await req.expect(status);
  return schema.parse(response.body);
}

async function errorCode(req: SupertestRequest, status: number): Promise<string> {
  return (await json(req, status, apiErrorSchema)).code;
}

const text = (value: string): LessonDocument => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }],
});

describe('Référentiel scout (D220, D221, intégration PostgreSQL)', () => {
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

  async function login(role: 'ENCADREMENT' | 'ADMINISTRATEUR' | 'ROUTIER' | 'ADULTE') {
    counter += 1;
    const user = await prisma.user.create({
      data: {
        email: `referentiel${counter}@example.test`,
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
      post: (path: string, body: object = {}) =>
        agent.post(`/api/v1${path}`).set(CSRF_HEADER, '1').send(body),
      patch: (path: string, body: object = {}) =>
        agent.patch(`/api/v1${path}`).set(CSRF_HEADER, '1').send(body),
      delete: (path: string) => agent.delete(`/api/v1${path}`).set(CSRF_HEADER, '1'),
    };
  }
  type Client = Awaited<ReturnType<typeof login>>;

  async function plein() {
    const admin = await login('ADMINISTRATEUR');
    const responsable = await login('ENCADREMENT');
    await admin
      .post('/leadership/assignments', {
        userId: responsable.user.id,
        function: 'PLEIN',
        confirmReplacement: true,
      })
      .expect(201);
    return responsable;
  }

  /** Module « texte fondamental » avec ses leçons, en brouillon. */
  async function draftModule(author: Client, title: string, lessons: [string, LessonDocument][]) {
    const created = await json(
      author.post('/editor/modules', { title, category: 'TEXTE_FONDAMENTAL' }),
      201,
      editorModuleDetailSchema,
    );
    for (const [lessonTitle, content] of lessons) {
      await author
        .post(`/editor/modules/${created.id}/lessons`, {
          versionId: created.current.id,
          title: lessonTitle,
          content,
        })
        .expect(201);
    }
    return created.id;
  }

  async function submit(author: Client, moduleId: string) {
    const detail = await json(
      author.get(`/editor/modules/${moduleId}`),
      200,
      editorModuleDetailSchema,
    );
    return author.post(`/editor/modules/${moduleId}/submit`, {
      versionId: detail.current.id,
      revision: detail.current.revision,
    });
  }

  async function category(responsable: Client, title: string, ambiance = 'RECUEILLI') {
    const response = await responsable
      .post('/reference/categories', { title, ambiance, icon: 'coeur' })
      .expect(201);
    return (response.body as { id: string }).id;
  }

  it('montre aux routiers les seules rubriques non vides et ressources publiées', async () => {
    const responsable = await plein();
    const routier = await login('ROUTIER');
    const prieres = await category(responsable, 'Prières fictives');
    await category(responsable, 'Chants fictifs', 'MUSICAL'); // vide : jamais visible
    const published = await draftModule(responsable, 'Prière fictive A', [
      ['Prière fictive A', text('Texte fictif à mémoriser, Akwaba.')],
    ]);
    const draft = await draftModule(responsable, 'Prière fictive B', [
      ['Prière fictive B', text('Brouillon fictif.')],
    ]);
    for (const moduleId of [published, draft]) {
      await responsable.post('/reference/entries', { categoryId: prieres, moduleId }).expect(201);
    }
    // Le plein publie son propre travail en le soumettant (D188).
    expect((await submit(responsable, published)).status).toBe(201);

    const catalog = await json(routier.get('/reference'), 200, referenceCatalogSchema);
    expect(catalog.categories.map((item) => item.title)).toEqual(['Prières fictives']);
    expect(catalog.categories[0]!.entries.map((entry) => entry.title)).toEqual([
      'Prière fictive A',
    ]);
    expect(catalog.categories[0]!.entries[0]).toMatchObject({
      hasAudio: false,
      hasDialogue: false,
    });

    // Recherche dans le texte (accents ignorés) ; aucune correspondance : rien.
    const found = await json(routier.get('/reference?q=akwaba'), 200, referenceCatalogSchema);
    expect(found.categories[0]!.entries[0]!.match).toContain('Akwaba');
    const none = await json(routier.get('/reference?q=introuvable'), 200, referenceCatalogSchema);
    expect(none.categories).toEqual([]);

    // Gestion : rubriques vides et ressources non publiées visibles de l'encadrement seulement.
    const managed = await json(responsable.get('/reference/manage'), 200, managedReferenceSchema);
    expect(managed.canManageCategories).toBe(true);
    expect(managed.categories.map((item) => [item.title, item.visible])).toEqual([
      ['Prières fictives', true],
      ['Chants fictifs', false],
    ]);
    expect(managed.categories[0]!.entries.map((entry) => entry.state)).toEqual([
      'PUBLIEE',
      'NON_PUBLIEE',
    ]);
    expect(await errorCode(routier.get('/reference/manage'), 403)).toBe('FORBIDDEN');
  });

  it('range une seule leçon d’un module et suit son identité de version en version', async () => {
    const responsable = await plein();
    const routier = await login('ROUTIER');
    const textes = await category(responsable, 'Textes fictifs', 'DOCUMENTAIRE');
    const moduleId = await draftModule(responsable, 'Cours fictif', [
      ['Introduction fictive', text('Introduction.')],
      ['Loi fictive', text('Article fictif.')],
    ]);
    const detail = await json(
      responsable.get(`/editor/modules/${moduleId}`),
      200,
      editorModuleDetailSchema,
    );
    const lessonId = detail.current.lessons.find((lesson) => lesson.title === 'Loi fictive')!.id;
    await responsable
      .post('/reference/entries', { categoryId: textes, moduleId, lessonId })
      .expect(201);
    expect(
      await errorCode(
        responsable.post('/reference/entries', { categoryId: textes, moduleId, lessonId }),
        409,
      ),
    ).toBe('REFERENCE_ENTRY_EXISTS');
    expect((await submit(responsable, moduleId)).status).toBe(201);

    const catalog = await json(routier.get('/reference'), 200, referenceCatalogSchema);
    const entry = catalog.categories[0]!.entries[0]!;
    expect(entry.title).toBe('Loi fictive');
    const published = await prisma.moduleLesson.findFirst({
      where: { title: 'Loi fictive', version: { status: 'PUBLIE' } },
    });
    expect(entry.lessonId).toBe(published!.id);
    expect(entry.parts).toEqual([]);
  });

  it('réserve les rubriques au plein et les rangements aux rédacteurs du module', async () => {
    const responsable = await plein();
    const chef = await login('ENCADREMENT');
    const routier = await login('ROUTIER');
    const adulte = await login('ADULTE');
    for (const client of [chef, routier, adulte]) {
      expect(
        await errorCode(
          client.post('/reference/categories', { title: 'Interdite', ambiance: 'SOLENNEL' }),
          403,
        ),
      ).toBe('FORBIDDEN');
    }
    const rubrique = await category(responsable, 'Cérémonies fictives', 'SOLENNEL');
    const ofChef = await draftModule(chef, 'Texte du chef', [['Leçon', text('Fictif.')]]);
    const ofPlein = await draftModule(responsable, 'Texte du plein', [['Leçon', text('Fictif.')]]);
    // Le chef range son propre module, jamais celui d'un autre (404 : module non accessible).
    await chef.post('/reference/entries', { categoryId: rubrique, moduleId: ofChef }).expect(201);
    expect(
      await errorCode(
        chef.post('/reference/entries', { categoryId: rubrique, moduleId: ofPlein }),
        404,
      ),
    ).toBe('MODULE_NOT_FOUND');
    expect(
      await errorCode(
        routier.post('/reference/entries', { categoryId: rubrique, moduleId: ofChef }),
        403,
      ),
    ).toBe('FORBIDDEN');
    // Ordre et retrait de rubrique : plein seulement ; le chef ne réordonne pas.
    const managed = await json(chef.get('/reference/manage'), 200, managedReferenceSchema);
    expect(managed.canManageCategories).toBe(false);
    expect(
      await errorCode(chef.patch(`/reference/categories/${rubrique}`, { archived: true }), 403),
    ).toBe('FORBIDDEN');
    await responsable.patch(`/reference/categories/${rubrique}`, { archived: true }).expect(200);
    const after = await json(responsable.get('/reference/manage'), 200, managedReferenceSchema);
    expect(after.categories[0]!.archived).toBe(true);
    // Retirer un rangement ne touche pas le module.
    const entryId = after.categories[0]!.entries[0]!.id;
    await chef.delete(`/reference/entries/${entryId}`).expect(200);
    expect(await prisma.pedagogicalModule.count({ where: { id: ofChef } })).toBe(1);
    const audit = await prisma.auditLog.findMany({
      where: { action: { startsWith: 'reference.' } },
      orderBy: { createdAt: 'asc' },
      select: { action: true },
    });
    expect(audit.map((row) => row.action)).toEqual([
      'reference.category_created',
      'reference.entry_added',
      'reference.category_updated',
      'reference.entry_removed',
    ]);
  });

  it('enregistrement audio : fichier audio vérifié du module, droits confirmés avant soumission', async () => {
    const responsable = await plein();
    const moduleId = await draftModule(responsable, 'Chant fictif', []);
    const detail = await json(
      responsable.get(`/editor/modules/${moduleId}`),
      200,
      editorModuleDetailSchema,
    );
    const storedFile = (mimeType: string, key: string) =>
      prisma.storedFile.create({
        data: {
          category: 'MODULE_RESOURCE',
          status: 'VALIDE',
          validatedAt: new Date(),
          bucket: 'test',
          storageKey: `modules/${key}`,
          originalName: `fictif.${mimeType === 'audio/mpeg' ? 'mp3' : 'png'}`,
          mimeType,
          sizeBytes: 1024,
          sha256: 'a'.repeat(64),
          moduleId,
          createdById: responsable.user.id,
          uploadExpiresAt: new Date(Date.now() + 60_000),
        },
      });
    const audio = await storedFile('audio/mpeg', 'audio-fictif');
    const image = await storedFile('image/png', 'image-fictive');
    const song = (
      src: string,
      rights: 'INCONNUS' | 'AUTORISES',
      synced = false,
    ): LessonDocument => ({
      type: 'doc',
      content: [
        {
          type: 'audio',
          attrs: {
            src,
            title: 'Chant fictif',
            rights,
            download: true,
            segments: [
              { id: 'a1', text: 'Première phrase fictive', startMs: 0 },
              { id: 'a2', text: 'Seconde phrase fictive', startMs: 2500 },
            ],
            syncedSrc: synced ? src : null,
          },
        },
      ],
    });
    // Une image n'est pas un enregistrement.
    expect(
      await errorCode(
        responsable.post(`/editor/modules/${moduleId}/lessons`, {
          versionId: detail.current.id,
          title: 'Chant',
          content: song(lessonFileImageSrc(image.id), 'AUTORISES'),
        }),
        422,
      ),
    ).toBe('FILE_NOT_AVAILABLE');
    await responsable
      .post(`/editor/modules/${moduleId}/lessons`, {
        versionId: detail.current.id,
        title: 'Chant',
        content: song(lessonFileImageSrc(audio.id), 'INCONNUS', true),
      })
      .expect(201);
    const refused = await submit(responsable, moduleId);
    expect([refused.status, (refused.body as { code: string }).code]).toEqual([
      422,
      'AUDIO_RIGHTS_UNKNOWN',
    ]);
    const current = await prisma.moduleLesson.findFirstOrThrow({
      where: { title: 'Chant', version: { moduleId } },
    });
    await responsable
      .patch(`/editor/lessons/${current.id}`, {
        revision: current.revision,
        content: song(lessonFileImageSrc(audio.id), 'AUTORISES', true),
      })
      .expect(204);
    expect((await submit(responsable, moduleId)).status).toBe(201);
    const rubrique = await category(responsable, 'Chants fictifs', 'MUSICAL');
    await responsable.post('/reference/entries', { categoryId: rubrique, moduleId }).expect(201);
    const catalog = await json(
      responsable.get('/reference?q=seconde'),
      200,
      referenceCatalogSchema,
    );
    expect(catalog.categories[0]!.entries[0]).toMatchObject({ hasAudio: true });
    expect(catalog.categories[0]!.entries[0]!.match).toContain('Seconde phrase fictive');
  });
});

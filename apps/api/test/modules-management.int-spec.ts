import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  apiErrorSchema,
  catalogPageSchema,
  CSRF_HEADER,
  deleteDraftResultSchema,
  draftDeletionCheckSchema,
  editorModuleDetailSchema,
  editorModuleListItemSchema,
  editorModuleStatsSchema,
  type EditorModuleDetail,
  paginatedSchema,
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

// Gestion du catalogue (D171) : recherche et filtres serveur, distinction modules / versions,
// suppression individuelle des brouillons. Données exclusivement fictives.
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

describe('Gestion des modules V2 : liste, filtres et suppression de brouillons', () => {
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
        email: `gestion${counter}@example.test`,
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

  const listPage = paginatedSchema(editorModuleListItemSchema);
  const list = async (client: Client, query = '') =>
    json(client.get(`/editor/modules${query ? `?${query}` : ''}`), 200, listPage);
  const titles = async (client: Client, query = '') =>
    (await list(client, query)).items.map(
      (item) => (item.working ?? item.published ?? item.latest).title,
    );

  const approveAndPublish = async (responsable: Client, module: EditorModuleDetail) => {
    const versionId = module.current.id;
    await responsable.post(`/admin/modules/${module.id}/approve`, { versionId }).expect(204);
    await responsable.post(`/admin/modules/${module.id}/publish`, { versionId }).expect(204);
  };

  const newVersion = (client: Client, module: EditorModuleDetail) =>
    json(client.post(`/editor/modules/${module.id}/versions`), 201, editorModuleDetailSchema);

  const duplicate = (client: Client, module: EditorModuleDetail) =>
    json(client.post(`/editor/modules/${module.id}/duplicate`), 201, editorModuleDetailSchema);

  const checkDeletion = (client: Client, id: string) =>
    json(client.get(`/editor/modules/${id}/draft-deletion`), 200, draftDeletionCheckSchema);

  /**
   * Les trois cas de référence : « Prière de la Route » (v1 archivée, v2 publiée), « Découvrir le
   * scoutisme » (v1 publiée, v2 brouillon) et « Prière de la Route (copie) » (brouillon seul).
   */
  async function referenceCatalogue() {
    const chef = await loginAs('CHEF');
    const responsable = await loginAs('RESPONSABLE');
    let priere = await createModule(chef, 'Prière de la Route', {
      summary: 'Méditer en marchant.',
      theme: 'Spiritualité',
    });
    priere = await addLesson(chef, priere, 'Leçon 1');
    priere = await submit(chef, priere);
    await approveAndPublish(responsable, priere);
    priere = await newVersion(chef, priere);
    priere = await submit(chef, priere);
    await approveAndPublish(responsable, priere);

    let decouvrir = await createModule(chef, 'Découvrir le scoutisme', { theme: 'Histoire' });
    decouvrir = await addLesson(chef, decouvrir, 'Leçon 1');
    decouvrir = await submit(chef, decouvrir);
    await approveAndPublish(responsable, decouvrir);
    decouvrir = await newVersion(chef, decouvrir);

    priere = await json(chef.get(`/editor/modules/${priere.id}`), 200, editorModuleDetailSchema);
    const copie = await duplicate(chef, priere);
    return { chef, responsable, priere, decouvrir, copie };
  }

  describe('Modules et versions', () => {
    it('compte des modules distincts, jamais des versions', async () => {
      const { chef, responsable, priere, decouvrir, copie } = await referenceCatalogue();
      expect(copie.current).toMatchObject({ version: 1, status: 'BROUILLON' });
      expect(copie.current.title).toBe('Prière de la Route (copie)');

      const all = await list(responsable);
      expect(all.total).toBe(3);
      const byId = new Map(all.items.map((item) => [item.id, item]));
      expect(byId.get(priere.id)).toMatchObject({
        working: null,
        published: { version: 2, status: 'PUBLIE' },
        draftDeletion: null,
      });
      expect(byId.get(decouvrir.id)).toMatchObject({
        working: { version: 2, status: 'BROUILLON' },
        published: { version: 1, status: 'PUBLIE' },
        draftDeletion: 'VERSION',
      });
      expect(byId.get(copie.id)).toMatchObject({
        working: { version: 1 },
        published: null,
        draftDeletion: 'MODULE',
        imported: false,
      });

      const stats = await json(
        responsable.get('/editor/module-stats'),
        200,
        editorModuleStatsSchema,
      );
      expect(stats).toEqual({ accessible: 3, published: 2, neverPublished: 1, pendingApproval: 0 });
      // Le chef auteur voit les mêmes modules (il les a tous créés).
      expect((await list(chef)).total).toBe(3);

      // Statut éditorial et état de publication distincts.
      expect((await list(responsable, 'status=PUBLIE')).total).toBe(2);
      expect((await list(responsable, 'status=BROUILLON')).total).toBe(2);
      expect((await list(responsable, 'status=ARCHIVE')).total).toBe(0); // Prière reste publiée
      expect((await list(responsable, 'publication=never')).items.map((i) => i.id)).toEqual([
        copie.id,
      ]);
      expect((await list(responsable, 'publication=with_working')).items.map((i) => i.id)).toEqual([
        decouvrir.id,
      ]);
      expect(
        (await list(responsable, 'status=BROUILLON&publication=current')).items.map((i) => i.id),
      ).toEqual([decouvrir.id]);
    });
  });

  describe('Recherche et filtres', () => {
    it('recherche serveur insensible à la casse et aux accents, sur titre, code, résumé, thème et auteur', async () => {
      const { chef, responsable, priere, decouvrir } = await referenceCatalogue();
      expect(await titles(responsable, 'search=PRIERE&sort=title_asc')).toEqual([
        'Prière de la Route',
        'Prière de la Route (copie)',
      ]);
      expect(await titles(responsable, 'search=decouvrir')).toEqual(['Découvrir le scoutisme']);
      expect((await list(responsable, `search=${priere.code}`)).items.map((i) => i.id)).toEqual([
        priere.id,
      ]);
      const number = Number(decouvrir.code.slice(4));
      expect((await list(responsable, `search=${number}`)).items.map((i) => i.id)).toContain(
        decouvrir.id,
      );
      expect(await titles(responsable, 'search=M%C3%89DITER&sort=title_asc')).toEqual([
        'Prière de la Route',
        'Prière de la Route (copie)',
      ]);
      expect((await list(responsable, 'search=spiritualite')).total).toBe(2);
      expect(
        (await list(responsable, `search=${encodeURIComponent(chef.user.lastName)}`)).total,
      ).toBe(3);
      expect((await list(responsable, 'search=introuvable')).total).toBe(0);
      // Les jokers SQL saisis sont neutralisés.
      expect((await list(responsable, 'search=%25')).total).toBe(0);
      // Recherche combinée à un filtre.
      expect(await titles(responsable, 'search=priere&publication=current')).toEqual([
        'Prière de la Route',
      ]);
    });

    it('tri stable, pagination serveur et filtres d’auteur, de collaboration et de contenu', async () => {
      const { chef, responsable, copie } = await referenceCatalogue();
      const other = await loginAs('CHEF');
      await createModule(other, 'Autre module');

      const asc = await titles(responsable, 'sort=title_asc');
      expect(asc).toEqual([
        'Autre module',
        'Découvrir le scoutisme',
        'Prière de la Route',
        'Prière de la Route (copie)',
      ]);
      expect(await titles(responsable, 'sort=title_desc')).toEqual([...asc].reverse());
      const pages = [];
      for (const page of [1, 2, 3, 4]) {
        const result = await list(responsable, `sort=title_asc&pageSize=1&page=${page}`);
        expect(result.total).toBe(4);
        pages.push(...result.items.map((item) => (item.working ?? item.latest).title));
      }
      expect(pages).toEqual(asc);
      const codes = (await list(responsable, 'sort=code_desc')).items.map((item) => item.code);
      expect(codes).toEqual([...codes].sort().reverse());

      // Périmètre : chaque chef ne voit que ses modules ; le responsable voit tout.
      expect((await list(other)).total).toBe(1);
      expect((await list(chef, 'author=me')).total).toBe(3);
      expect((await list(responsable, `author=${other.user.id}`)).total).toBe(1);
      expect((await list(responsable, 'collaboration=mine')).total).toBe(0);
      expect((await list(other, 'collaboration=collaborating')).total).toBe(0);

      expect((await list(responsable, 'lessons=without')).items.map((i) => i.latest.title)).toEqual(
        ['Autre module'],
      );
      expect((await list(responsable, 'lessons=with')).total).toBe(3);
      expect((await list(responsable, 'evaluation=without')).total).toBe(4);
      expect((await list(responsable, 'evaluation=with')).total).toBe(0);
      expect((await list(responsable, 'origin=manual')).total).toBe(4);
      expect((await list(responsable, 'origin=import')).total).toBe(0);

      const today = new Date().toISOString().slice(0, 10);
      expect((await list(responsable, `dateField=created&from=${today}&to=${today}`)).total).toBe(
        4,
      );
      expect((await list(responsable, 'dateField=created&to=2000-01-01')).total).toBe(0);
      expect(
        await errorCode(responsable.get('/editor/modules?from=2026-02-01&to=2026-01-01'), 400),
      ).toBeTruthy();
      expect(await errorCode(responsable.get('/editor/modules?sort=inconnu'), 400)).toBeTruthy();

      // Soumission : « à approuver » et intervention attendue du responsable.
      await submit(chef, copie);
      expect((await list(responsable, 'collaboration=action')).items.map((i) => i.id)).toEqual([
        copie.id,
      ]);
      expect((await list(responsable, 'status=SOUMIS')).total).toBe(1);
      const stats = await json(
        responsable.get('/editor/module-stats'),
        200,
        editorModuleStatsSchema,
      );
      expect(stats.pendingApproval).toBe(1);
    });

    it('refuse la liste aux routiers et à l’administrateur', async () => {
      const routier = await loginAs('ROUTIER');
      const admin = await loginAs('ADMINISTRATEUR');
      await routier.get('/editor/modules').expect(403);
      await admin.get('/editor/modules').expect(403);
      await admin.get('/editor/module-stats').expect(403);
    });
  });

  describe('Suppression individuelle des brouillons', () => {
    it('supprime une copie brouillon avec leçons ; l’original publié reste intact', async () => {
      const { responsable, priere, copie } = await referenceCatalogue();
      const check = await checkDeletion(responsable, copie.id);
      expect(check).toMatchObject({
        kind: 'MODULE',
        allowed: true,
        lessonCount: 1,
        title: 'Prière de la Route (copie)',
        publishedVersion: null,
        blockers: [],
      });
      const result = await json(
        responsable.post(`/editor/modules/${copie.id}/draft-deletion`, {
          versionId: copie.current.id,
        }),
        200,
        deleteDraftResultSchema,
      );
      expect(result).toEqual({ kind: 'MODULE', moduleId: copie.id, versionId: copie.current.id });
      expect(await prisma.pedagogicalModule.count({ where: { id: copie.id } })).toBe(0);
      expect(await prisma.moduleLesson.count({ where: { versionId: copie.current.id } })).toBe(0);
      // Original : module, versions et historique conservés, toujours dans la bibliothèque.
      const original = await json(
        responsable.get(`/editor/modules/${priere.id}`),
        200,
        editorModuleDetailSchema,
      );
      expect(original.versions.map((v) => [v.version, v.status])).toEqual([
        [2, 'PUBLIE'],
        [1, 'ARCHIVE'],
      ]);
      const routier = await loginAs('ROUTIER');
      const catalogue = await json(routier.get('/modules'), 200, catalogPageSchema);
      expect(catalogue.items.map((item) => item.title)).toContain('Prière de la Route');
      // Journal d'audit.
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { action: 'module.draft_deleted', entityId: copie.id },
      });
      expect(audit.actorId).toBe(responsable.user.id);
      expect(audit.metadata).toMatchObject({ code: copie.code, lessonCount: 1 });
      // Seconde demande : le module n'existe plus.
      await responsable
        .post(`/editor/modules/${copie.id}/draft-deletion`, { versionId: copie.current.id })
        .expect(404);
    });

    it('abandonne la version de travail d’un module publié sans toucher la version publiée', async () => {
      const { chef, responsable, decouvrir } = await referenceCatalogue();
      const check = await checkDeletion(chef, decouvrir.id);
      expect(check).toMatchObject({
        kind: 'VERSION',
        allowed: true,
        version: 2,
        publishedVersion: 1,
      });
      const result = await json(
        chef.post(`/editor/modules/${decouvrir.id}/draft-deletion`, {
          versionId: decouvrir.current.id,
        }),
        200,
        deleteDraftResultSchema,
      );
      expect(result.kind).toBe('VERSION');
      const after = await json(
        responsable.get(`/editor/modules/${decouvrir.id}`),
        200,
        editorModuleDetailSchema,
      );
      expect(after.versions.map((v) => [v.version, v.status])).toEqual([[1, 'PUBLIE']]);
      expect(after.publishedVersionId).toBe(after.current.id);
      expect(
        await prisma.auditLog.count({ where: { action: 'module.draft_version_discarded' } }),
      ).toBe(1);
      // Une nouvelle version de travail peut être créée ensuite (numéro réutilisable : rien n'en dépendait).
      const again = await newVersion(chef, after);
      expect(again.current).toMatchObject({ version: 2, status: 'BROUILLON' });
    });

    it('interdit la suppression d’un module publié, d’un brouillon soumis et hors des personnes autorisées', async () => {
      const { chef, responsable, priere, copie } = await referenceCatalogue();
      // Module publié sans version de travail : rien à supprimer, archivage seulement.
      const published = await checkDeletion(responsable, priere.id);
      expect(published).toMatchObject({ kind: null, allowed: false });
      expect(published.blockers.map((b) => b.code)).toEqual(['NO_DRAFT']);
      expect(
        await errorCode(
          responsable.post(`/editor/modules/${priere.id}/draft-deletion`, {
            versionId: priere.current.id,
          }),
          422,
        ),
      ).toBe('DRAFT_NOT_DELETABLE');

      // Collaborateur : accès en rédaction mais pas de suppression ; chef sans accès : 404.
      const collaborator = await loginAs('CHEF');
      const outsider = await loginAs('CHEF');
      const routier = await loginAs('ROUTIER');
      const admin = await loginAs('ADMINISTRATEUR');
      const body = { versionId: copie.current.id };
      await chef
        .post(`/editor/modules/${copie.id}/collaborators`, { userId: collaborator.user.id })
        .expect(201);
      const forCollaborator = await checkDeletion(collaborator, copie.id);
      expect(forCollaborator.blockers.map((b) => b.code)).toContain('NOT_ALLOWED');
      expect(
        await errorCode(collaborator.post(`/editor/modules/${copie.id}/draft-deletion`, body), 403),
      ).toBe('FORBIDDEN');
      await outsider.post(`/editor/modules/${copie.id}/draft-deletion`, body).expect(404);
      await routier.post(`/editor/modules/${copie.id}/draft-deletion`, body).expect(403);
      await admin.post(`/editor/modules/${copie.id}/draft-deletion`, body).expect(403);

      // Dépendance protégée : un collaborateur a été associé (participation conservée).
      const blocked = await checkDeletion(responsable, copie.id);
      expect(blocked.blockers.map((b) => b.code)).toEqual(['COLLABORATORS']);
      expect(
        await errorCode(responsable.post(`/editor/modules/${copie.id}/draft-deletion`, body), 422),
      ).toBe('DRAFT_NOT_DELETABLE');

      // Brouillon soumis : décision attendue ; après demande de corrections : historique conservé.
      let draft = await createModule(chef, 'Brouillon soumis');
      draft = await addLesson(chef, draft, 'Leçon');
      draft = await submit(chef, draft);
      expect((await checkDeletion(chef, draft.id)).blockers.map((b) => b.code)).toEqual([
        'NO_DRAFT',
      ]);
      await responsable
        .post(`/admin/modules/${draft.id}/request-changes`, {
          versionId: draft.current.id,
          comment: 'À reprendre.',
        })
        .expect(204);
      await chef
        .post(`/editor/modules/${draft.id}/resume`, { versionId: draft.current.id })
        .expect(201);
      expect((await checkDeletion(chef, draft.id)).blockers.map((b) => b.code)).toEqual([
        'SUBMITTED',
      ]);
      await chef
        .post(`/editor/modules/${draft.id}/draft-deletion`, { versionId: draft.current.id })
        .expect(422);
      expect(await prisma.pedagogicalModule.count({ where: { id: draft.id } })).toBe(1);

      // Version désignée périmée.
      const own = await createModule(chef, 'Autre brouillon');
      expect(
        await errorCode(
          chef.post(`/editor/modules/${own.id}/draft-deletion`, { versionId: copie.current.id }),
          409,
        ),
      ).toBe('DRAFT_CHANGED');
      // Aucune route de suppression par lot.
      await responsable.post('/editor/modules/draft-deletion', { ids: [own.id] }).expect(404);
      await responsable.del('/editor/modules').expect(404);
    });

    it('l’auteur supprime son brouillon ; deux demandes simultanées ne suppriment qu’une fois', async () => {
      const chef = await loginAs('CHEF');
      let draft = await createModule(chef, 'Créé par erreur');
      draft = await addLesson(chef, draft, 'Leçon A');
      draft = await addLesson(chef, draft, 'Leçon B');
      const body = { versionId: draft.current.id };
      const responses = await Promise.all([
        chef.post(`/editor/modules/${draft.id}/draft-deletion`, body),
        chef.post(`/editor/modules/${draft.id}/draft-deletion`, body),
      ]);
      const statuses = responses.map((response) => response.status).sort();
      expect(statuses[0]).toBe(200);
      expect([404, 409]).toContain(statuses[1]);
      expect(await prisma.pedagogicalModule.count({ where: { id: draft.id } })).toBe(0);
      expect(await prisma.auditLog.count({ where: { action: 'module.draft_deleted' } })).toBe(1);
    });

    it('la fonction SQL refuse une version publiée même appelée directement', async () => {
      const { priere } = await referenceCatalogue();
      await expect(
        prisma.$executeRaw`SELECT delete_module_draft(${priere.id}::uuid, ${priere.current.id}::uuid)`,
      ).rejects.toThrow(/DRAFT_NOT_DELETABLE/);
    });
  });
});

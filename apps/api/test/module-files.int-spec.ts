import { createHash } from 'node:crypto';
import { type INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  apiErrorSchema,
  catalogModuleDetailSchema,
  CSRF_HEADER,
  editorModuleDetailSchema,
  type EditorModuleDetail,
  offlineModulePackageSchema,
  storedFileSchema,
  uploadTicketSchema,
} from '@tesla/shared';
import request, { type Test as SupertestRequest } from 'supertest';
import { type App } from 'supertest/types.js';
import { type z } from 'zod';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { validateEnv } from '../src/config/env.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { MemoryObjectStorage } from '../src/storage/memory-object-storage.js';
import { OBJECT_STORAGE } from '../src/storage/object-storage.js';
import { ABANDON_GRACE_MS, StoredFilesService } from '../src/storage/stored-files.service.js';
import {
  createTestPrisma,
  grantPersona,
  personaRole,
  resetDatabase,
  type TestPersona,
  testDatabaseUrl,
} from './int-database.js';

// Fichiers des modules (D143) : envoi direct autorisé, confirmation vérifiée par le serveur,
// lecture soumise à la publication, nettoyage. Le stockage R2 est remplacé par un stockage en
// mémoire : aucun appel à Cloudflare. Données exclusivement fictives.
const PASSWORD = 'mot-de-passe-fictif-de-test';

const PNG = new Uint8Array([
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
  ...new Array<number>(40).fill(7),
]);
const PDF = new TextEncoder().encode('%PDF-1.7\n% document fictif\n%%EOF\n');
const HTML = new TextEncoder().encode('<!DOCTYPE html><script>alert(1)</script>');
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

async function json<T>(req: SupertestRequest, status: number, schema: z.ZodType<T>): Promise<T> {
  const response = await req.expect(status);
  return schema.parse(response.body);
}

async function errorCode(req: SupertestRequest, status: number): Promise<string> {
  return (await json(req, status, apiErrorSchema)).code;
}

describe('Fichiers des modules (intégration PostgreSQL, stockage simulé)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let storage: MemoryObjectStorage;
  let passwordHash: string;
  let counter = 0;
  const logged: string[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl();
    prisma = createTestPrisma();
    storage = new MemoryObjectStorage();
    passwordHash = await hashPassword(PASSWORD);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(OBJECT_STORAGE)
      .useValue(storage)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    // Journal capturé pour vérifier l'absence d'URL signée et de clé d'objet.
    const capture = (message: unknown) => logged.push(String(message));
    for (const level of ['log', 'warn', 'error'] as const)
      vi.spyOn(Logger.prototype, level).mockImplementation(capture);
    configureApp(
      app,
      validateEnv({ NODE_ENV: 'test', DATABASE_URL: testDatabaseUrl(), SWAGGER_ENABLED: 'false' }),
    );
    await app.init();
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await app?.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    storage.objects.clear();
    logged.length = 0;
  });

  async function loginAs(role: TestPersona) {
    counter += 1;
    const user = await prisma.user.create({
      data: {
        email: `fichiers${counter}@example.test`,
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
      get: (path: string) => agent.get(`/api/v1${path}`),
      post: (path: string, body: object = {}) =>
        agent.post(`/api/v1${path}`).set(CSRF_HEADER, '1').send(body),
    };
  }

  type Client = Awaited<ReturnType<typeof loginAs>>;

  const createModule = (client: Client, title = 'Cartographie') =>
    json(
      client.post('/editor/modules', { title, summary: 'Résumé fictif.' }),
      201,
      editorModuleDetailSchema,
    );

  const requestUpload = (client: Client, moduleId: string, bytes: Uint8Array, extra: object = {}) =>
    client.post(`/editor/modules/${moduleId}/files`, {
      fileName: 'carte.png',
      mimeType: 'image/png',
      sizeBytes: bytes.length,
      sha256: sha256(bytes),
      ...extra,
    });

  /** Parcours complet : autorisation, envoi simulé du navigateur, confirmation. */
  async function upload(
    client: Client,
    module: EditorModuleDetail,
    bytes = PNG,
    extra: object = {},
  ) {
    const ticket = await json(
      requestUpload(client, module.id, bytes, extra),
      201,
      uploadTicketSchema,
    );
    storage.put(keyOf(ticket.uploadUrl), bytes, ticket.headers['Content-Type']!);
    return {
      ticket,
      confirm: () => client.post(`/editor/modules/${module.id}/files/${ticket.fileId}/complete`),
    };
  }

  const keyOf = (url: string) => new URL(url).pathname.replace(`/${storage.bucket}/`, '');

  async function publish(chef: Client, responsable: Client, module: EditorModuleDetail) {
    let current = await json(
      chef.post(`/editor/modules/${module.id}/lessons`, {
        versionId: module.current.id,
        title: 'Leçon',
        content: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
        },
      }),
      201,
      editorModuleDetailSchema,
    );
    current = await json(
      chef.post(`/editor/modules/${module.id}/submit`, {
        versionId: current.current.id,
        revision: current.current.revision,
      }),
      201,
      editorModuleDetailSchema,
    );
    const versionId = current.current.id;
    await responsable.post(`/admin/modules/${module.id}/approve`, { versionId }).expect(204);
    await responsable.post(`/admin/modules/${module.id}/publish`, { versionId }).expect(204);
    return current;
  }

  it('envoi valide : clé générée par le serveur, confirmation vérifiée et idempotente', async () => {
    const chef = await loginAs('CHEF');
    const module = await createModule(chef);
    const { ticket, confirm } = await upload(chef, module, PNG, {
      fileName: '../../secret carte.png',
    });
    expect(ticket.headers).toEqual({ 'Content-Type': 'image/png', 'If-None-Match': '*' });
    const key = keyOf(ticket.uploadUrl);
    expect(key).toMatch(/^test\/module-resources\/\d{4}\/\d{2}\/[0-9a-f-]{36}$/);
    expect(key).not.toContain('carte');

    const file = await json(confirm(), 200, storedFileSchema);
    expect(file).toMatchObject({
      status: 'VALIDE',
      originalName: 'secret carte.png',
      sizeBytes: PNG.length,
    });
    // Double confirmation : même résultat, aucune nouvelle écriture.
    expect(await json(confirm(), 200, storedFileSchema)).toEqual(file);
    // Aucun lien signé ni contenu en base ; aucune clé ni URL signée dans le journal.
    const row = await prisma.storedFile.findUniqueOrThrow({ where: { id: file.id } });
    expect(JSON.stringify(row)).not.toContain('X-Amz');
    expect(logged.join('\n')).not.toMatch(/X-Amz|module-resources\//);
  });

  it('fichier trop volumineux, type interdit ou extension trompeuse : refusés avant tout envoi', async () => {
    const chef = await loginAs('CHEF');
    const module = await createModule(chef);
    expect(
      await errorCode(requestUpload(chef, module.id, PNG, { sizeBytes: 6 * 1024 * 1024 }), 400),
    ).toBe('VALIDATION_ERROR');
    expect(
      await errorCode(
        requestUpload(chef, module.id, HTML, { fileName: 'page.html', mimeType: 'text/html' }),
        400,
      ),
    ).toBe('VALIDATION_ERROR');
    expect(
      await errorCode(requestUpload(chef, module.id, PNG, { fileName: 'carte.exe' }), 400),
    ).toBe('VALIDATION_ERROR');
    expect(await prisma.storedFile.count()).toBe(0);
  });

  it('fichier absent, contenu falsifié ou différent du type : jamais validé, objet supprimé', async () => {
    const chef = await loginAs('CHEF');
    const module = await createModule(chef);
    // Fichier inexistant : la confirmation est refusée, l'envoi reste possible.
    const missing = await json(requestUpload(chef, module.id, PNG), 201, uploadTicketSchema);
    expect(
      await errorCode(
        chef.post(`/editor/modules/${module.id}/files/${missing.fileId}/complete`),
        409,
      ),
    ).toBe('FILE_NOT_UPLOADED');
    expect(
      (await prisma.storedFile.findUniqueOrThrow({ where: { id: missing.fileId } })).status,
    ).toBe('EN_ATTENTE');

    // Contenu HTML envoyé à la place de l'image déclarée (même taille) : rejeté et supprimé.
    const disguised = new Uint8Array(PNG.length);
    disguised.set(HTML.subarray(0, PNG.length));
    const ticket = await json(requestUpload(chef, module.id, PNG), 201, uploadTicketSchema);
    storage.put(keyOf(ticket.uploadUrl), disguised, 'image/png');
    expect(
      await errorCode(
        chef.post(`/editor/modules/${module.id}/files/${ticket.fileId}/complete`),
        422,
      ),
    ).toBe('FILE_REJECTED');
    expect(storage.objects.has(keyOf(ticket.uploadUrl))).toBe(false);
    const rejected = await prisma.storedFile.findUniqueOrThrow({ where: { id: ticket.fileId } });
    expect(rejected).toMatchObject({
      status: 'REJETE',
      rejectionReason: 'Contenu différent du type déclaré.',
    });

    // Image valide mais empreinte différente de celle déclarée.
    const other = await json(
      requestUpload(chef, module.id, PNG, { sha256: 'b'.repeat(64) }),
      201,
      uploadTicketSchema,
    );
    storage.put(keyOf(other.uploadUrl), PNG, 'image/png');
    expect(
      await errorCode(
        chef.post(`/editor/modules/${module.id}/files/${other.fileId}/complete`),
        422,
      ),
    ).toBe('FILE_REJECTED');
    // Un fichier rejeté ne peut pas devenir une ressource.
    expect(
      await errorCode(
        chef.post(`/editor/modules/${module.id}/resources`, {
          versionId: module.current.id,
          kind: 'IMAGE',
          title: 'Carte',
          fileId: other.fileId,
        }),
        422,
      ),
    ).toBe('FILE_NOT_AVAILABLE');
  });

  it('échec du stockage : erreur 503 sans détail interne, fichier toujours en attente', async () => {
    const chef = await loginAs('CHEF');
    const module = await createModule(chef);
    const { ticket, confirm } = await upload(chef, module);
    storage.failNext('head');
    const response = await confirm().expect(503);
    expect(apiErrorSchema.parse(response.body).code).toBe('FILE_STORAGE_ERROR');
    expect(JSON.stringify(response.body)).not.toMatch(/InternalError|module-resources/);
    expect(
      (await prisma.storedFile.findUniqueOrThrow({ where: { id: ticket.fileId } })).status,
    ).toBe('EN_ATTENTE');
    await confirm().expect(200); // reprise après rétablissement
  });

  it('autorisations : routier, chef étranger au module et confirmation par un tiers refusés', async () => {
    const chef = await loginAs('CHEF');
    const otherChef = await loginAs('CHEF');
    const routier = await loginAs('ROUTIER');
    const module = await createModule(chef);
    expect(await errorCode(requestUpload(routier, module.id, PNG), 403)).toBe('FORBIDDEN');
    expect(await errorCode(requestUpload(otherChef, module.id, PNG), 404)).toBe('MODULE_NOT_FOUND');
    const { ticket } = await upload(chef, module);
    expect(
      await errorCode(
        otherChef.post(`/editor/modules/${module.id}/files/${ticket.fileId}/complete`),
        404,
      ),
    ).toBe('MODULE_NOT_FOUND');
    // Identifiant de fichier d'un autre module : introuvable (aucune substitution de référence).
    const otherModule = await createModule(chef, 'Autre module');
    expect(
      await errorCode(
        chef.post(`/editor/modules/${otherModule.id}/files/${ticket.fileId}/complete`),
        404,
      ),
    ).toBe('FILE_NOT_FOUND');
  });

  it('lecture : brouillon réservé aux rédacteurs, publication ouverte aux routiers, URL courte', async () => {
    const chef = await loginAs('CHEF');
    const responsable = await loginAs('RESPONSABLE');
    const routier = await loginAs('ROUTIER');
    const otherChef = await loginAs('CHEF');
    let module = await createModule(chef);
    const pdf = await upload(chef, module, PDF, {
      fileName: 'guide.pdf',
      mimeType: 'application/pdf',
    });
    const file = await json(pdf.confirm(), 200, storedFileSchema);
    module = await json(
      chef.post(`/editor/modules/${module.id}/resources`, {
        versionId: module.current.id,
        kind: 'DOCUMENT',
        title: 'Guide',
        fileId: file.id,
      }),
      201,
      editorModuleDetailSchema,
    );
    const resource = module.current.resources[0]!;
    expect(resource).toMatchObject({ url: '', file: { id: file.id, mimeType: 'application/pdf' } });

    // Non publié : l'objet existe dans le stockage, mais seul le rédacteur y accède.
    const draftRead = await chef.get(`/module-files/${file.id}`).expect(302);
    expect(draftRead.headers['cache-control']).toBe('no-store');
    expect(draftRead.headers.location).toContain('X-Amz-Expires=300');
    expect(await errorCode(routier.get(`/module-files/${file.id}`), 404)).toBe('FILE_NOT_FOUND');
    expect(await errorCode(otherChef.get(`/module-files/${file.id}`), 404)).toBe('FILE_NOT_FOUND');

    await publish(chef, responsable, module);
    await routier.get(`/module-files/${file.id}`).expect(302);
    const detail = await json(
      routier.get(`/modules/${module.slug}`),
      200,
      catalogModuleDetailSchema,
    );
    expect(detail.resources[0]).toMatchObject({ url: '', file: { id: file.id } });
    // Paquet hors ligne : empreinte cohérente avec la ressource fichier.
    const pkg = await json(
      routier.get(`/modules/${module.slug}/offline-package`),
      200,
      offlineModulePackageSchema,
    );
    expect(createHash('sha256').update(JSON.stringify(pkg.content)).digest('hex')).toBe(pkg.digest);
    // Le paquet ne contient jamais d'URL signée.
    expect(JSON.stringify(pkg)).not.toContain('X-Amz');
  });

  it('nouvelle version : la référence est recopiée, l’objet n’est ni dupliqué ni modifiable', async () => {
    const chef = await loginAs('CHEF');
    const responsable = await loginAs('RESPONSABLE');
    let module = await createModule(chef);
    const { confirm } = await upload(chef, module);
    const file = await json(confirm(), 200, storedFileSchema);
    module = await json(
      chef.post(`/editor/modules/${module.id}/resources`, {
        versionId: module.current.id,
        kind: 'IMAGE',
        title: 'Carte',
        fileId: file.id,
      }),
      201,
      editorModuleDetailSchema,
    );
    await publish(chef, responsable, module);
    const next = await json(
      chef.post(`/editor/modules/${module.id}/versions`),
      201,
      editorModuleDetailSchema,
    );
    expect(next.current.resources[0]!.file?.id).toBe(file.id);
    expect(storage.objects.size).toBe(1);

    // Tentative de modification de la clé ou de suppression de la fiche : refusée par la base.
    await expect(
      prisma.storedFile.update({ where: { id: file.id }, data: { storageKey: 'test/autre/cle' } }),
    ).rejects.toThrow();
    await expect(prisma.storedFile.delete({ where: { id: file.id } })).rejects.toThrow();
    // Une ressource ne peut porter à la fois une adresse et un fichier (CHECK).
    await expect(
      prisma.moduleResource.create({
        data: {
          versionId: next.current.id,
          kind: 'IMAGE',
          title: 'Double',
          url: 'https://example.test/x.png',
          fileId: file.id,
          createdById: chef.user.id,
        },
      }),
    ).rejects.toThrow();
  });

  it('nettoyage : envoi abandonné supprimé du stockage, fichier validé jamais touché', async () => {
    const chef = await loginAs('CHEF');
    const module = await createModule(chef);
    const kept = await upload(chef, module);
    await json(kept.confirm(), 200, storedFileSchema);
    const abandoned = await upload(chef, module, PDF, {
      fileName: 'brouillon.pdf',
      mimeType: 'application/pdf',
    });
    const files = app.get(StoredFilesService);
    const later = new Date(Date.now() + 300_000 + ABANDON_GRACE_MS + 1000);

    // Fiche réservée avant la suppression : l'échec du stockage laisse un abandon à retenter,
    // et une confirmation concurrente ne peut plus valider l'objet en cours de suppression.
    storage.failNext('delete');
    expect(await files.cleanupAbandoned(later)).toEqual({ abandoned: 1, failed: 1 });
    expect(storage.objects.has(keyOf(abandoned.ticket.uploadUrl))).toBe(true);
    expect(await errorCode(abandoned.confirm(), 422)).toBe('FILE_REJECTED');
    expect(await files.cleanupAbandoned(later)).toEqual({ abandoned: 0, failed: 0 });
    expect(await files.cleanupAbandoned(later)).toEqual({ abandoned: 0, failed: 0 }); // idempotent
    expect(storage.objects.has(keyOf(abandoned.ticket.uploadUrl))).toBe(false);
    expect(storage.objects.has(keyOf(kept.ticket.uploadUrl))).toBe(true);
    // Confirmation tardive d'un envoi abandonné : refusée.
    expect(await errorCode(abandoned.confirm(), 422)).toBe('FILE_REJECTED');

    // Indicateurs : fichier validé non référencé signalé comme orphelin après 7 jours (non supprimé).
    const stats = await files.stats(new Date(Date.now() + 8 * 24 * 3600 * 1000));
    expect(stats.orphans).toBe(1);
    expect(stats.byStatus.VALIDE).toEqual({ count: 1, bytes: PNG.length });
  });

  it('stockage non configuré : fonctions de fichiers indisponibles (503), le reste fonctionne', async () => {
    const service = new StoredFilesService(
      prisma,
      validateEnv({ DATABASE_URL: testDatabaseUrl() }),
      null,
    );
    expect(service.available).toBe(false);
    await expect(
      service.requestUpload({
        category: 'MODULE_RESOURCE',
        moduleId: null,
        createdById: '0190a0b0-0000-7000-8000-000000000001',
        fileName: 'a.png',
        mimeType: 'image/png',
        sizeBytes: 1,
        sha256: 'a'.repeat(64),
      }),
    ).rejects.toMatchObject({ status: 503 });
    expect(await service.cleanupAbandoned()).toEqual({ abandoned: 0, failed: 0 });
  });
});

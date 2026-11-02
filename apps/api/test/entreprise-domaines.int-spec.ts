import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  ACTION_DOMAINS,
  catalogModuleDetailSchema,
  CSRF_HEADER,
  offlineModulePackageSchema,
  PRACTICAL_SHEET_KEYS,
} from '@tesla/shared';
import request from 'supertest';
import { type App } from 'supertest/types.js';
import { auditCatalog } from '../prisma/seeds/pedagogy-audit.js';
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

// Entreprise routière et domaines d'action (2026-11-02) : mise en service complète du catalogue sur
// une base de test isolée, fiches pratiques, idempotence, habilitations et absence de corrigé.
// Comptes et brouillons exclusivement fictifs.
const PASSWORD = 'mot-de-passe-fictif-de-test';
const CATALOG = [...SCOUTISME_BASE_MODULES, ...FUNDAMENTAL_TEXTS, ...ROUTE_MODULES];
const M09 = ROUTE_MODULES.find((module) => module.key === 'NT-ROUTE-M09')!;
const M10 = ROUTE_MODULES.find((module) => module.key === 'NT-ROUTE-M10')!;
/** Brouillon vide du type « Découvrir la Route » (retiré à la mise en service, D129). */
const EMPTY_DRAFT: SourceModule = {
  key: 'NT-TEST-DEC-D20',
  slug: 'nt-test-presentation-des-flots',
  title: 'Présentation des flots',
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
};

describe('Entreprise et domaines d’action (intégration PostgreSQL)', () => {
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

  async function account(role: TestPersona) {
    counter += 1;
    const user = await prisma.user.create({
      data: {
        email: `entreprise${counter}@example.test`,
        firstName: 'Fictif',
        lastName: `${role} ${counter}`,
        role: personaRole(role),
        passwordHash,
      },
    });
    await grantPersona(prisma, user.id, role);
    return user;
  }

  async function loginAs(role: TestPersona) {
    const user = await account(role);
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/auth/login')
      .set(CSRF_HEADER, '1')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);
    return { user, get: (path: string) => agent.get(`/api/v1${path}`) };
  }

  it('met en service le catalogue complet, une seule fois, au nom du seul responsable habilité', async () => {
    await importSourceModules(prisma, [...CATALOG, EMPTY_DRAFT]);
    const routier = await loginAs('ROUTIER');
    // Avant publication : brouillons et fiches invisibles des routiers.
    await routier.get(`/modules/${M09.slug}`).expect(404);
    await routier.get(`/modules/${M09.slug}/sheets/budget/pdf`).expect(404);

    // Un chef n'est pas habilité à mettre en service.
    const chef = await account('CHEF');
    await expect(releaseActor(prisma, chef.email)).rejects.toThrow(/Habilitations insuffisantes/);
    // Sans responsable plein : refus explicite, aucune identité simulée.
    await expect(releaseActor(prisma)).rejects.toThrow(/Aucun responsable plein/);

    await account('RESPONSABLE');
    const actor = await releaseActor(prisma);
    // Prévisualisation : aucune écriture.
    const preview = await releaseCatalog(prisma, actor, { dryRun: true, acknowledgeNotes: true });
    expect(preview.filter((line) => line.outcome === 'PUBLIE')).toHaveLength(15);
    expect(await prisma.moduleVersion.count({ where: { status: 'PUBLIE' } })).toBe(0);

    const lines = await releaseCatalog(prisma, actor, { acknowledgeNotes: true });
    expect(lines.filter((line) => line.outcome === 'PUBLIE')).toHaveLength(15);
    expect(lines.filter((line) => line.outcome === 'QUESTIONNAIRE_PUBLIE')).toHaveLength(14);
    expect(lines.find((line) => line.key === EMPTY_DRAFT.key)?.outcome).toBe('SUPPRIME');
    expect(await prisma.moduleSourceImport.count({ where: { sourceKey: EMPTY_DRAFT.key } })).toBe(
      0,
    );

    // Publication : M10 contient exactement les dix domaines ; M09 ses treize leçons.
    const lessonsOf = async (key: string) =>
      (
        await prisma.moduleLesson.findMany({
          where: {
            version: { status: 'PUBLIE', module: { sourceImport: { sourceKey: key } } },
          },
          orderBy: { position: 'asc' },
          select: { title: true },
        })
      ).map((lesson) => lesson.title);
    expect(await lessonsOf(M10.key)).toEqual([...ACTION_DOMAINS]);
    expect(await lessonsOf(M09.key)).toEqual(M09.lessons.map((lesson) => lesson.title));
    const expectedQuestions = ROUTE_QUIZZES.reduce((sum, quiz) => sum + quiz.questions.length, 0);
    expect(
      await prisma.evaluationQuestion.count({ where: { version: { status: 'PUBLIE' } } }),
    ).toBe(expectedQuestions);

    // Audit après publication : aucune anomalie bloquante, aucune leçon vide, tout en classe F.
    const report = await auditCatalog(prisma);
    expect(report.summary.blockingModules).toBe(0);
    expect(report.summary.emptyLessons).toBe(0);
    expect(report.modules.every((entry) => entry.classification === 'F')).toBe(true);
    expect(report.modules.filter((entry) => entry.title === M10.title)).toHaveLength(1);

    // Réexécutions : rien n'est republié ni réimporté.
    const again = await releaseCatalog(prisma, actor, { acknowledgeNotes: true });
    expect(again.filter((line) => line.outcome === 'PUBLIE')).toEqual([]);
    expect(again.filter((line) => line.outcome === 'QUESTIONNAIRE_PUBLIE')).toEqual([]);
    const reimport = await importSourceModules(prisma, CATALOG, { applyRevisions: true });
    expect(reimport.every((result) => result.outcome === 'DEJA_IMPORTE')).toBe(true);
    expect(await prisma.moduleVersion.count({ where: { status: 'PUBLIE' } })).toBe(15);

    // Une source révisée ne touche jamais un module publié : la version publiée est conservée.
    const revisedM09: SourceModule = { ...structuredClone(M09), summary: 'Résumé révisé.' };
    const [result] = await importSourceModules(prisma, [revisedM09], { applyRevisions: true });
    expect(result).toMatchObject({ outcome: 'DEJA_IMPORTE', revisable: false });
    const published = await prisma.moduleVersion.findFirstOrThrow({
      where: { status: 'PUBLIE', module: { sourceImport: { sourceKey: M09.key } } },
    });
    expect(published.summary).toBe(M09.summary);
  });

  it('sert les fiches pratiques du module publié, et seulement celles-ci, sans corrigé', async () => {
    await importSourceModules(prisma, CATALOG);
    await account('RESPONSABLE');
    await releaseCatalog(prisma, await releaseActor(prisma), { acknowledgeNotes: true });
    const routier = await loginAs('ROUTIER');

    const m09 = catalogModuleDetailSchema.parse(
      (await routier.get(`/modules/${M09.slug}`).expect(200)).body,
    );
    expect(m09.practicalSheets.map((sheet) => sheet.key)).toEqual(PRACTICAL_SHEET_KEYS);
    for (const key of PRACTICAL_SHEET_KEYS) {
      const response = await routier.get(`/modules/${M09.slug}/sheets/${key}/pdf`).expect(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toBe(
        `attachment; filename="fiche-${key}.pdf"`,
      );
    }
    const m10 = catalogModuleDetailSchema.parse(
      (await routier.get(`/modules/${M10.slug}`).expect(200)).body,
    );
    expect(m10.practicalSheets).toEqual([]);
    await routier.get(`/modules/${M10.slug}/sheets/budget/pdf`).expect(404);
    await routier.get(`/modules/${M09.slug}/sheets/inconnue/pdf`).expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/modules/${M09.slug}/sheets/budget/pdf`)
      .expect(401);

    // Copie hors ligne préparée : leçons complètes, aucun corrigé (un module n'en contient pas).
    const offline = offlineModulePackageSchema.parse(
      (await routier.get(`/modules/${M10.slug}/offline-package`).expect(200)).body,
    );
    expect(offline.content.lessons.map((lesson) => lesson.title)).toEqual([...ACTION_DOMAINS]);
    // Questionnaire : aucune bonne réponse ni explication transmise au routier.
    const evaluation = await prisma.evaluation.findFirstOrThrow({
      where: { module: { sourceImport: { sourceKey: M10.key } } },
    });
    const view = await routier.get(`/evaluations/${evaluation.id}`);
    expect(JSON.stringify(view.body)).not.toMatch(
      /isCorrect|guidance|expectedAnswer|acceptedAnswers/,
    );
  });
});

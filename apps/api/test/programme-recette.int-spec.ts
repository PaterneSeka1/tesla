import { readFileSync, writeFileSync } from 'node:fs';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CSRF_HEADER, programmeImportReportSchema } from '@tesla/shared';
import request from 'supertest';
import { type App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { validateEnv } from '../src/config/env.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestPrisma, grantPersona, resetDatabase, testDatabaseUrl } from './int-database.js';

// Recette avec un classeur réel, jamais versionné : ignorée sans PROGRAMME_XLSX.
//   PROGRAMME_XLSX=/chemin/programme.xlsx RECETTE_OUT=/chemin/etat.json npm run test:int -w @tesla/api -- programme-recette
// Importe deux fois le classeur sur la base de test, vérifie l'idempotence et exporte l'état en base
// (RECETTE_OUT) pour une comparaison indépendante avec le fichier source.
const source = process.env.PROGRAMME_XLSX;

describe.skipIf(!source)('Recette : import du programme officiel (classeur réel)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl();
    prisma = createTestPrisma();
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
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  it('importe, réimporte sans doublon et exporte l’état enregistré', async () => {
    const password = 'mot-de-passe-fictif-de-recette';
    const user = await prisma.user.create({
      data: {
        email: 'recette@example.test',
        firstName: 'Responsable',
        lastName: 'Fictif',
        role: 'ENCADREMENT',
        passwordHash: await hashPassword(password),
      },
    });
    await grantPersona(prisma, user.id, 'RESPONSABLE');
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/auth/login')
      .set(CSRF_HEADER, '1')
      .send({ email: user.email, password })
      .expect(200);
    const programme = await prisma.programme.findFirstOrThrow();
    const body = {
      fileName: source!.split('/').at(-1)!,
      fileBase64: readFileSync(source!).toString('base64'),
    };
    const run = async () => {
      const preview = programmeImportReportSchema.parse(
        (
          await agent
            .post(`/api/v1/programmes/${programme.id}/import/excel/preview`)
            .set(CSRF_HEADER, '1')
            .send(body)
            .expect(201)
        ).body,
      );
      const applied = programmeImportReportSchema.parse(
        (
          await agent
            .post(`/api/v1/programmes/${programme.id}/import/excel`)
            .set(CSRF_HEADER, '1')
            .send({ ...body, fingerprint: preview.fingerprint })
            .expect(201)
        ).body,
      );
      return { preview, applied };
    };
    const first = await run();
    const second = await run();
    expect(second.applied.counts.CREER).toBe(0);
    expect(second.applied.counts.METTRE_A_JOUR).toBe(0);
    const activities = await prisma.activity.findMany({
      where: { programmeId: programme.id },
      include: {
        categories: { include: { category: true }, orderBy: { category: { position: 'asc' } } },
        _count: { select: { attendances: true } },
      },
      orderBy: { plannedOn: 'asc' },
    });
    if (process.env.RECETTE_OUT) {
      writeFileSync(
        process.env.RECETTE_OUT,
        JSON.stringify(
          {
            first: {
              counts: first.applied.counts,
              columns: first.preview.columns,
              issues: first.preview.issues,
            },
            second: { counts: second.applied.counts },
            attendances: await prisma.activityAttendance.count(),
            imports: await prisma.programmeImport.count(),
            activities: activities.map((a) => ({
              sourceNumber: a.sourceNumber,
              plannedOn: a.plannedOn.toISOString().slice(0, 10),
              title: a.title,
              theme: a.theme,
              status: a.status,
              sourceStatus: a.sourceStatus,
              plannedFormat: a.plannedFormat,
              leaderLabel: a.leaderLabel,
              sourceAttendanceCount: a.sourceAttendanceCount,
              planningNotes: a.planningNotes,
              attendances: a._count.attendances,
              categories: Object.fromEntries(
                a.categories.map((c) => [c.category.code, c.plannedContent]),
              ),
            })),
          },
          null,
          2,
        ),
      );
    }
  });
});

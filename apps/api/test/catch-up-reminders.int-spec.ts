import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  addCalendarDays,
  addCalendarMonths,
  civilDateAt,
  CSRF_HEADER,
  notificationListSchema,
  scoutPathwaySchema,
} from '@tesla/shared';
import request from 'supertest';
import { type App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { validateEnv } from '../src/config/env.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { NotificationsService } from '../src/modules/notifications/notifications.service.js';
import { CatchUpRemindersService } from '../src/modules/progression/catch-up-reminders.service.js';
import { StageAnnouncementsService } from '../src/modules/progression/stage-announcements.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestPrisma, resetDatabase, testDatabaseUrl } from './int-database.js';

// Rappels de rattrapage et notifications (D192), annonce du passage d'étape (D193). PostgreSQL réel, données fictives : arrivée à
// 20 ans, rattrapage du Noviciat échu dans 20 jours (21 jours par étape).
const PASSWORD = 'mot-de-passe-fictif-de-test';
const today = civilDateAt(new Date());
const bornYearsAgo = (years: number) => addCalendarDays(addCalendarMonths(today, -12 * years), -10);

describe('Rappels de rattrapage et notifications (intégration PostgreSQL)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordHash: string;
  let counter = 0;
  let stages: Record<string, string>;

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
    stages = Object.fromEntries(
      (await prisma.progressionStage.findMany()).map((stage) => [stage.code, stage.id]),
    );
  });

  /** Référentiel fictif 2026.2 en vigueur depuis 2000, avec ou sans fenêtre d'alerte. */
  async function ruleSet(catchUpAlertDays: number | null) {
    const periods = {
      NOVICIAT: [18, 0, 18, 1],
      APPRENTISSAGE: [18, 1, 19, 0],
      COMPAGNONNAGE: [19, 0, 20, 0],
      DEPART_ROUTIER: [20, 0, 21, 0],
    } as const;
    const row = await prisma.ageRuleSet.create({
      data: {
        version: 'test-rappels',
        sourceReference: 'Référentiel fictif (tests).',
        branchExitAgeYears: 21,
        catchUpDelayDays: 21,
        catchUpAlertDays,
        stages: {
          create: Object.entries(periods).map(([code, [sy, sm, ey, em]]) => ({
            stageId: stages[code]!,
            startYears: sy,
            startMonths: sm,
            endYears: ey,
            endMonths: em,
            sourceReference: 'Fictif (tests).',
          })),
        },
      },
    });
    await prisma.ageRuleSet.update({
      where: { id: row.id },
      data: {
        status: 'EN_VIGUEUR',
        effectiveFrom: new Date('2000-01-01T00:00:00Z'),
        activatedAt: new Date(),
      },
    });
  }

  async function login(role: 'ENCADREMENT' | 'ADMINISTRATEUR' | 'ROUTIER') {
    counter += 1;
    const user = await prisma.user.create({
      data: {
        email: `rappel${counter}@example.test`,
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
    };
  }

  async function mandatoryNoviciatModule() {
    const module = await prisma.pedagogicalModule.create({ data: { slug: 'rappel-noviciat' } });
    const version = await prisma.moduleVersion.create({
      data: {
        moduleId: module.id,
        version: 1,
        title: 'Module fictif du Noviciat',
        stageId: stages.NOVICIAT,
        category: 'ETAPE',
        obligation: 'OBLIGATOIRE',
        officialSource: 'Source officielle fictive (tests)',
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
  }

  async function setup(catchUpAlertDays: number | null) {
    await ruleSet(catchUpAlertDays);
    const admin = await login('ADMINISTRATEUR');
    const plein = await login('ENCADREMENT');
    const assistant = await login('ENCADREMENT');
    for (const [userId, fn] of [
      [plein.user.id, 'PLEIN'],
      [assistant.user.id, 'ASSISTANT'],
    ] as const) {
      await admin
        .post('/leadership/assignments', { userId, function: fn, confirmReplacement: true })
        .expect(201);
    }
    await mandatoryNoviciatModule();
    const routier = await login('ROUTIER');
    const profile = await prisma.scoutProfile.create({
      data: {
        userId: routier.user.id,
        firstName: 'Fictif',
        lastName: 'Arrivant',
        birthDate: new Date(`${bornYearsAgo(20)}T00:00:00Z`),
        joinedAt: new Date(`${today}T00:00:00Z`),
      },
    });
    return { admin, plein, assistant, routier, profile };
  }

  const reminders = () => app.get(CatchUpRemindersService);

  it('échéance proche puis retard : routier et plein notifiés une fois chacun, lecture par le titulaire seul', async () => {
    const { plein, assistant, routier, profile } = await setup(30);
    const pathway = scoutPathwaySchema.parse((await routier.get('/me/pathway').expect(200)).body);
    expect(pathway.catchUpLock).toMatchObject({
      active: true,
      dueOn: addCalendarDays(today, 20),
      deadline: 'PROCHE',
    });

    expect(await reminders().dispatch(today)).toEqual({ created: 2 });
    // Idempotence : un second passage le même jour (ou le lendemain) ne crée rien.
    expect(await reminders().dispatch(today)).toEqual({ created: 0 });
    expect(await reminders().dispatch(addCalendarDays(today, 1))).toEqual({ created: 0 });

    const mine = notificationListSchema.parse(
      (await routier.get('/me/notifications').expect(200)).body,
    );
    expect(mine.items).toHaveLength(1);
    expect(mine.items[0]).toMatchObject({
      kind: 'RATTRAPAGE_ECHEANCE_PROCHE',
      link: '/mes-rattrapages',
    });
    // Aucune règle interne pour le routier (D176).
    expect(mine.items[0]!.body).not.toMatch(/référentiel|test-rappels/);

    const lead = notificationListSchema.parse(
      (await plein.get('/me/notifications').expect(200)).body,
    );
    expect(lead.items).toHaveLength(1);
    expect(lead.items[0]!.body).toContain('Fictif Arrivant');
    expect(lead.items[0]!.link).toBe(`/administration/routiers/${profile.id}`);

    // L'assistant ne reçoit rien et ne peut pas marquer lue la notification d'autrui.
    const other = notificationListSchema.parse(
      (await assistant.get('/me/notifications').expect(200)).body,
    );
    expect(other.items).toHaveLength(0);
    const stolen = await assistant
      .post('/me/notifications/read', { ids: [mine.items[0]!.id] })
      .expect(200);
    expect(stolen.body).toEqual({ updated: 0 });

    await routier.post('/me/notifications/read', { ids: [mine.items[0]!.id] }).expect(200);
    const after = notificationListSchema.parse(
      (await routier.get('/me/notifications').expect(200)).body,
    );
    expect(after.items).toHaveLength(0);

    // Échéance dépassée : un rappel « en retard » à chacun, une seule fois.
    const late = addCalendarDays(today, 21);
    expect(await reminders().dispatch(late)).toEqual({ created: 2 });
    expect(await reminders().dispatch(late)).toEqual({ created: 0 });
    expect(await prisma.notification.count({ where: { kind: 'RATTRAPAGE_EN_RETARD' } })).toBe(2);

    // Entrée invalide.
    await routier.post('/me/notifications/read', { ids: ['pas-un-uuid'] }).expect(400);
  });

  it('sans fenêtre arbitrée : aucun rappel préalable, seul le retard est signalé', async () => {
    const { routier } = await setup(null);
    const pathway = scoutPathwaySchema.parse((await routier.get('/me/pathway').expect(200)).body);
    expect(pathway.catchUpLock.deadline).toBeNull();
    expect(await reminders().dispatch(today)).toEqual({ created: 0 });
    expect(await reminders().dispatch(addCalendarDays(today, 21))).toEqual({ created: 2 });
  });

  it('routier sans compte : seul le plein est notifié ; aucun e-mail sans SMTP', async () => {
    await ruleSet(30);
    const admin = await login('ADMINISTRATEUR');
    const plein = await login('ENCADREMENT');
    await admin
      .post('/leadership/assignments', {
        userId: plein.user.id,
        function: 'PLEIN',
        confirmReplacement: true,
      })
      .expect(201);
    await mandatoryNoviciatModule();
    const profile = await prisma.scoutProfile.create({
      data: {
        firstName: 'Fictif',
        lastName: 'SansCompte',
        birthDate: new Date(`${bornYearsAgo(20)}T00:00:00Z`),
        joinedAt: new Date(`${today}T00:00:00Z`),
      },
    });
    await plein.get(`/scouts/${profile.id}/pathway`).expect(200);
    expect(await reminders().dispatch(today)).toEqual({ created: 1 });
    expect(await app.get(NotificationsService).deliverEmails()).toEqual({ sent: 0, failed: 0 });
  });

  it('une notification n’est jamais supprimée ni réécrite (trigger)', async () => {
    const { routier } = await setup(30);
    await routier.get('/me/pathway').expect(200);
    await reminders().dispatch(today);
    const row = await prisma.notification.findFirstOrThrow({ where: { userId: routier.user.id } });
    await expect(prisma.notification.delete({ where: { id: row.id } })).rejects.toThrow();
    await expect(
      prisma.notification.update({ where: { id: row.id }, data: { body: 'modifié' } }),
    ).rejects.toThrow();
  });

  /** Routier dont la période d'Apprentissage (18 ans + 1 mois) a commencé il y a `days` jours. */
  async function apprentice(days: number, withAccount = true) {
    const account = withAccount ? await login('ROUTIER') : null;
    const birth = addCalendarMonths(addCalendarDays(today, -days), -(12 * 18 + 1));
    const profile = await prisma.scoutProfile.create({
      data: {
        userId: account?.user.id ?? null,
        firstName: 'Fictif',
        lastName: `Apprenti ${days}`,
        birthDate: new Date(`${birth}T00:00:00Z`),
      },
    });
    return { account, profile };
  }

  async function withPlein() {
    await ruleSet(7);
    const admin = await login('ADMINISTRATEUR');
    const plein = await login('ENCADREMENT');
    await admin
      .post('/leadership/assignments', {
        userId: plein.user.id,
        function: 'PLEIN',
        confirmReplacement: true,
      })
      .expect(201);
    return plein;
  }

  const announcements = () => app.get(StageAnnouncementsService);

  it('passage d’étape récent : routier et plein notifiés une fois, sans parler de cérémonie', async () => {
    const plein = await withPlein();
    const { account, profile } = await apprentice(3);
    expect(await announcements().dispatch(today)).toEqual({ created: 2 });
    expect(await announcements().dispatch(today)).toEqual({ created: 0 });
    expect(await announcements().dispatch(addCalendarDays(today, 1))).toEqual({ created: 0 });

    const mine = notificationListSchema.parse(
      (await account!.get('/me/notifications').expect(200)).body,
    );
    expect(mine.items).toHaveLength(1);
    expect(mine.items[0]).toMatchObject({ kind: 'ETAPE_NOUVELLE', link: '/progression' });
    expect(mine.items[0]!.body).toContain('Apprentissage');
    expect(mine.items[0]!.body).not.toMatch(/cérémonie|engagement|validé/i);

    const lead = notificationListSchema.parse(
      (await plein.get('/me/notifications').expect(200)).body,
    );
    expect(lead.items[0]!.link).toBe(`/administration/routiers/${profile.id}`);
  });

  it('passage ancien, exception de secours ou sortie : aucune annonce', async () => {
    const plein = await withPlein();
    await apprentice(30, false);
    const { profile } = await apprentice(2, false);
    await plein
      .post(`/scouts/${profile.id}/stage-overrides`, {
        stageCode: 'NOVICIAT',
        startsOn: today,
        endsOn: addCalendarDays(today, 30),
        reason: 'Retour après une longue absence (motif fictif).',
        confirm: true,
      })
      .expect(201);
    await prisma.scoutProfile.create({
      data: {
        firstName: 'Fictif',
        lastName: 'Sorti',
        birthDate: new Date(`${addCalendarMonths(addCalendarDays(today, -2), -12 * 21)}T00:00:00Z`),
      },
    });
    expect(await announcements().dispatch(today)).toEqual({ created: 0 });
  });
});

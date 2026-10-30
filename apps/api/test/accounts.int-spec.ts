import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  accountSchema,
  accountTokenInfoSchema,
  accountWithLinkSchema,
  addCalendarDays,
  apiErrorSchema,
  civilDateAt,
  CSRF_HEADER,
  delegationSchema,
  mandateSchema,
  meResponseSchema,
  paginatedSchema,
  revokedSessionsSchema,
  scoutDetailSchema,
  scoutYearSchema,
  sessionListSchema,
} from '@tesla/shared';
import request, { type Test as SupertestRequest } from 'supertest';
import { type App } from 'supertest/types.js';
import { type z } from 'zod';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { validateEnv } from '../src/config/env.js';
import { THROTTLE_LIMITS } from '../src/modules/auth/login-rate-limiter.js';
import { AccountsService } from '../src/modules/users/accounts.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestPrisma, resetDatabase, testDatabaseUrl } from './int-database.js';

// Cycle de vie des comptes (D118–D121) : installation, activation, réinitialisation, périmètres,
// désactivation, sessions, limitation persistante. PostgreSQL réel, comptes fictifs.
const PASSWORD = 'phrase-fictive-de-test-01';
const TODAY = civilDateAt(new Date());

async function json<T>(req: SupertestRequest, status: number, schema: z.ZodType<T>): Promise<T> {
  const response = await req.expect(status);
  return schema.parse(response.body);
}

async function errorCode(req: SupertestRequest, status: number): Promise<string> {
  return (await json(req, status, apiErrorSchema)).code;
}

describe('Comptes : création, activation, sessions (intégration PostgreSQL)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let counter = 0;

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
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  const server = () => request(app.getHttpServer());
  const publicPost = (path: string, body: object) =>
    server().post(`/api/v1${path}`).set(CSRF_HEADER, '1').send(body);

  /** Session HTTP (agent à cookies) pour un compte déjà activé. */
  async function signIn(email: string, password = PASSWORD) {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/auth/login')
      .set(CSRF_HEADER, '1')
      .send({ email, password })
      .expect(200);
    return {
      get: (path: string) => agent.get(`/api/v1${path}`),
      post: (path: string, body: object = {}) =>
        agent.post(`/api/v1${path}`).set(CSRF_HEADER, '1').send(body),
      patch: (path: string, body: object = {}) =>
        agent.patch(`/api/v1${path}`).set(CSRF_HEADER, '1').send(body),
    };
  }
  type Client = Awaited<ReturnType<typeof signIn>>;

  const activate = (token: string, password = PASSWORD) =>
    publicPost('/auth/account-link/complete', { token, password });

  /** Premier administrateur par la procédure d'installation, activé et connecté. */
  async function bootstrapAdmin() {
    counter += 1;
    const email = `admin${counter}@example.test`;
    const link = await app.get(AccountsService).bootstrapAdministrator({
      email,
      firstName: 'Fictif',
      lastName: 'Administration',
      recover: false,
    });
    await activate(link.token).expect(204);
    return { email, client: await signIn(email) };
  }

  async function createAccount(actor: Client, body: object) {
    counter += 1;
    return json(
      actor.post('/users', {
        email: `compte${counter}@example.test`,
        firstName: 'Fictif',
        lastName: `Compte ${counter}`,
        ...body,
      }),
      201,
      accountWithLinkSchema,
    );
  }

  /** Plein en exercice : compte d'encadrement créé et activé, année scoute et nomination consignées. */
  async function plein(admin: Client) {
    const created = await createAccount(admin, { role: 'ENCADREMENT' });
    await activate(created.link.token).expect(204);
    const year = Number(TODAY.slice(0, 4)) - (TODAY.slice(5) < '09-01' ? 1 : 0);
    const scoutYear = await json(
      admin.post('/scout-years', {
        label: `${year}-${year + 1}`,
        startsOn: `${year}-09-01`,
        endsOn: `${year + 1}-08-31`,
      }),
      201,
      scoutYearSchema,
    );
    await json(
      admin.post('/mandates', {
        userId: created.account.id,
        function: 'PLEIN',
        scoutYearId: scoutYear.id,
        kind: 'NOMINATION',
        appointingAuthority: 'Commissaire fictif',
        confirm: true,
      }),
      201,
      mandateSchema,
    );
    return { account: created.account, scoutYear, client: await signIn(created.account.email) };
  }

  it('installation : premier administrateur par lien à usage unique ; second refusé ; secours', async () => {
    const accounts = app.get(AccountsService);
    const { email } = await bootstrapAdmin();
    await expect(
      accounts.bootstrapAdministrator({
        email: 'autre@example.test',
        firstName: 'A',
        lastName: 'B',
        recover: false,
      }),
    ).rejects.toThrow(/existe déjà/);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.role).toBe('ADMINISTRATEUR');
    expect(user.passwordHash).not.toBeNull();
    // Aucun jeton en clair en base.
    const tokens = await prisma.accountToken.findMany({ where: { userId: user.id } });
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.usedAt).not.toBeNull();

    const recovery = await accounts.bootstrapAdministrator({
      email,
      firstName: 'x',
      lastName: 'y',
      recover: true,
    });
    expect(recovery.purpose).toBe('REINITIALISATION');
    await activate(recovery.token, 'nouvelle-phrase-fictive-02').expect(204);
    await signIn(email, 'nouvelle-phrase-fictive-02');
    await server()
      .post('/api/v1/auth/login')
      .set(CSRF_HEADER, '1')
      .send({ email, password: PASSWORD })
      .expect(401);
  });

  it('lien d’activation : vérification, usage unique, mot de passe trop court, lien remplacé', async () => {
    const { client: admin } = await bootstrapAdmin();
    const created = await createAccount(admin, { role: 'ENCADREMENT' });
    expect(created.account.status).toBe('A_ACTIVER');
    expect(created.link.purpose).toBe('ACTIVATION');
    // Compte non activé : connexion impossible, message indistinct.
    expect(
      await errorCode(
        server()
          .post('/api/v1/auth/login')
          .set(CSRF_HEADER, '1')
          .send({ email: created.account.email, password: PASSWORD }),
        401,
      ),
    ).toBe('INVALID_CREDENTIALS');

    const info = await json(
      publicPost('/auth/account-link/inspect', { token: created.link.token }),
      200,
      accountTokenInfoSchema,
    );
    expect(info).toMatchObject({ purpose: 'ACTIVATION', firstName: 'Fictif' });
    expect(await errorCode(activate(created.link.token, 'court'), 400)).toBe('VALIDATION_ERROR');

    // Nouveau lien : l'ancien est révoqué.
    const renewed = await json(
      admin.post(`/users/${created.account.id}/link`),
      201,
      accountWithLinkSchema,
    );
    expect(await errorCode(activate(created.link.token), 400)).toBe('INVALID_ACCOUNT_LINK');
    await activate(renewed.link.token).expect(204);
    expect(await errorCode(activate(renewed.link.token), 400)).toBe('INVALID_ACCOUNT_LINK');
    await signIn(created.account.email);

    // Lien expiré.
    const reset = await json(
      admin.post(`/users/${created.account.id}/link`),
      201,
      accountWithLinkSchema,
    );
    expect(reset.link.purpose).toBe('REINITIALISATION');
    await prisma.accountToken.updateMany({
      where: { userId: created.account.id, usedAt: null, revokedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await errorCode(activate(reset.link.token), 400)).toBe('INVALID_ACCOUNT_LINK');

    const audit = await prisma.auditLog.findMany({ where: { entityId: created.account.id } });
    expect(audit.map((entry) => entry.action)).toEqual(
      expect.arrayContaining(['account.created', 'account.link_issued', 'account.activated']),
    );
  });

  it('routier sans compte, compte créé plus tard et rattaché à sa fiche par le plein', async () => {
    const { client: admin } = await bootstrapAdmin();
    const { client: pleinClient } = await plein(admin);
    const stage = await prisma.progressionStage.findFirstOrThrow({ where: { code: 'NOVICIAT' } });
    const scout = await json(
      pleinClient.post('/scouts', {
        firstName: 'Fictif',
        lastName: 'Sans Compte',
        joinedAt: TODAY,
        currentStageId: stage.id,
      }),
      201,
      scoutDetailSchema,
    );
    expect(await prisma.user.count({ where: { role: 'ROUTIER' } })).toBe(0);

    const created = await createAccount(pleinClient, {
      role: 'ROUTIER',
      scoutProfileId: scout.id,
    });
    expect(created.account.scoutProfileId).toBe(scout.id);
    expect(await prisma.scoutProfile.count()).toBe(1);
    // Second compte sur la même fiche : refusé, aucun compte créé.
    expect(
      await errorCode(
        pleinClient.post('/users', {
          email: 'doublon@example.test',
          firstName: 'A',
          lastName: 'B',
          role: 'ROUTIER',
          scoutProfileId: scout.id,
        }),
        409,
      ),
    ).toBe('PROFILE_ALREADY_LINKED');
    expect(await prisma.user.count({ where: { email: 'doublon@example.test' } })).toBe(0);

    await activate(created.link.token).expect(204);
    const routier = await signIn(created.account.email);
    const me = await json(routier.get('/auth/me'), 200, meResponseSchema);
    expect(me.user).toMatchObject({ role: 'ROUTIER', scoutProfileId: scout.id });
  });

  it('périmètres : le plein ne gère que les routiers ; encadrement sans mandat et routier refusés', async () => {
    const { client: admin } = await bootstrapAdmin();
    const { client: pleinClient, account: pleinAccount } = await plein(admin);
    const staff = await createAccount(admin, { role: 'ENCADREMENT' });
    await activate(staff.link.token).expect(204);
    const staffClient = await signIn(staff.account.email);

    expect(
      await errorCode(
        pleinClient.post('/users', {
          email: 'encadrant@example.test',
          firstName: 'A',
          lastName: 'B',
          role: 'ENCADREMENT',
        }),
        403,
      ),
    ).toBe('ACCOUNT_OUT_OF_SCOPE');
    // Compte d'encadrement : invisible pour le plein (404, pas d'énumération).
    expect(await errorCode(pleinClient.get(`/users/${staff.account.id}`), 404)).toBe(
      'ACCOUNT_NOT_FOUND',
    );
    const list = await json(pleinClient.get('/users'), 200, paginatedSchema(accountSchema));
    expect(list.items.every((account) => account.role === 'ROUTIER')).toBe(true);

    await staffClient.get('/users').expect(403);
    await staffClient
      .post('/users', { email: 'x@example.test', firstName: 'A', lastName: 'B', role: 'ROUTIER' })
      .expect(403);

    const routier = await createAccount(pleinClient, { role: 'ROUTIER' });
    await activate(routier.link.token).expect(204);
    const routierClient = await signIn(routier.account.email);
    await routierClient.get('/users').expect(403);
    await routierClient
      .post(`/users/${pleinAccount.id}/deactivate`, { reason: 'Test' })
      .expect(403);
    // Requête d'écriture sans en-tête anti-CSRF : refusée.
    await server().post('/api/v1/auth/account-link/inspect').send({ token: 'x' }).expect(403);
  });

  it('désactivation : sessions révoquées immédiatement, réactivation, garde-fous', async () => {
    const { client: admin, email: adminEmail } = await bootstrapAdmin();
    const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: adminEmail } });
    const target = await createAccount(admin, { role: 'ENCADREMENT' });
    await activate(target.link.token).expect(204);
    const targetClient = await signIn(target.account.email);
    await targetClient.get('/auth/me').expect(200);

    expect(
      await errorCode(admin.post(`/users/${target.account.id}/deactivate`, { reason: '' }), 400),
    ).toBe('VALIDATION_ERROR');
    const deactivated = await json(
      admin.post(`/users/${target.account.id}/deactivate`, { reason: 'Départ fictif' }),
      200,
      accountSchema,
    );
    expect(deactivated).toMatchObject({ status: 'DESACTIVE', activeSessions: 0 });
    await targetClient.get('/auth/me').expect(401);
    await server()
      .post('/api/v1/auth/login')
      .set(CSRF_HEADER, '1')
      .send({ email: target.account.email, password: PASSWORD })
      .expect(401);
    expect(await errorCode(admin.post(`/users/${target.account.id}/link`), 409)).toBe(
      'ACCOUNT_INACTIVE',
    );

    await json(admin.post(`/users/${target.account.id}/reactivate`), 200, accountSchema);
    await signIn(target.account.email);

    expect(
      await errorCode(admin.post(`/users/${adminUser.id}/deactivate`, { reason: 'Moi' }), 409),
    ).toBe('CANNOT_DEACTIVATE_SELF');
    // Deux administrateurs se désactivent mutuellement en même temps : il en reste toujours un.
    const second = await createAccount(admin, { role: 'ADMINISTRATEUR' });
    await activate(second.link.token).expect(204);
    const secondClient = await signIn(second.account.email);
    const statuses = (
      await Promise.all([
        secondClient.post(`/users/${adminUser.id}/deactivate`, { reason: 'Rotation fictive' }),
        admin.post(`/users/${second.account.id}/deactivate`, { reason: 'Rotation fictive' }),
      ])
    ).map((response) => response.status);
    expect(statuses.filter((status) => status === 200)).toHaveLength(1);
    const actions = await prisma.auditLog.findMany({
      where: { action: { startsWith: 'account.' } },
      select: { action: true },
    });
    expect(actions.map((a) => a.action)).toEqual(
      expect.arrayContaining(['account.deactivated', 'account.reactivated']),
    );
    expect(await prisma.user.count({ where: { role: 'ADMINISTRATEUR', isActive: true } })).toBe(1);
  });

  it('compte personnel : mot de passe, sessions, profil', async () => {
    const { client: admin } = await bootstrapAdmin();
    const created = await createAccount(admin, { role: 'ENCADREMENT' });
    await activate(created.link.token).expect(204);
    const first = await signIn(created.account.email);
    const second = await signIn(created.account.email);

    const sessions = await json(first.get('/auth/sessions'), 200, sessionListSchema);
    expect(sessions.items).toHaveLength(2);
    expect(sessions.items.filter((s) => s.current)).toHaveLength(1);

    expect(
      await errorCode(
        first.post('/auth/password', {
          currentPassword: 'mauvais-mot-de-passe',
          newPassword: 'nouvelle-phrase-fictive-03',
        }),
        400,
      ),
    ).toBe('INVALID_CURRENT_PASSWORD');
    await first
      .post('/auth/password', {
        currentPassword: PASSWORD,
        newPassword: 'nouvelle-phrase-fictive-03',
      })
      .expect(204);
    await first.get('/auth/me').expect(200);
    await second.get('/auth/me').expect(401);
    await signIn(created.account.email, 'nouvelle-phrase-fictive-03');

    const revoked = await json(
      first.post('/auth/sessions/revoke-others'),
      200,
      revokedSessionsSchema,
    );
    expect(revoked.revoked).toBe(1);
    const other = (await json(first.get('/auth/sessions'), 200, sessionListSchema)).items;
    expect(other).toHaveLength(1);
    // Session d'un autre compte : introuvable.
    const adminSessions = await json(admin.get('/auth/sessions'), 200, sessionListSchema);
    await first.post(`/auth/sessions/${adminSessions.items[0]!.id}/revoke`).expect(404);

    const profile = await json(
      first.patch('/auth/profile', { firstName: 'Prénom', lastName: 'Modifié' }),
      200,
      meResponseSchema,
    );
    expect(profile.user).toMatchObject({ firstName: 'Prénom', lastName: 'Modifié' });
  });

  it('limitation persistante : blocage après échecs, conservé en base, sans e-mail en clair', async () => {
    const { email } = await bootstrapAdmin();
    for (let attempt = 0; attempt < THROTTLE_LIMITS.account; attempt += 1) {
      await server()
        .post('/api/v1/auth/login')
        .set(CSRF_HEADER, '1')
        .send({ email, password: 'mauvais-mot-de-passe' })
        .expect(401);
    }
    // Même le bon mot de passe est refusé pendant le blocage.
    expect(
      await errorCode(
        server()
          .post('/api/v1/auth/login')
          .set(CSRF_HEADER, '1')
          .send({ email, password: PASSWORD }),
        429,
      ),
    ).toBe('TOO_MANY_LOGIN_ATTEMPTS');
    const rows = await prisma.authThrottle.findMany();
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows.some((row) => row.key.includes('@'))).toBe(false);
    expect(rows.some((row) => row.blockedUntil && row.blockedUntil > new Date())).toBe(true);
  });

  it('une délégation cesse avec le mandat du délégataire', async () => {
    const { client: admin } = await bootstrapAdmin();
    const { client: pleinClient, scoutYear } = await plein(admin);
    const yesterday = addCalendarDays(TODAY, -1);
    // Une fin anticipée la veille n'est possible que si l'année a commencé avant aujourd'hui.
    if (yesterday < scoutYear.startsOn) return;
    const member = await createAccount(admin, { role: 'ENCADREMENT' });
    await activate(member.link.token).expect(204);
    const memberClient = await signIn(member.account.email);
    const mandate = await json(
      pleinClient.post('/mandates', {
        userId: member.account.id,
        function: 'ASSISTANT',
        scoutYearId: scoutYear.id,
        startsOn: yesterday,
        kind: 'NOMINATION',
        appointingAuthority: 'Responsable plein fictif',
        confirm: true,
      }),
      201,
      mandateSchema,
    );
    const delegation = await json(
      pleinClient.post('/delegations', {
        delegateId: member.account.id,
        permissions: ['team.manage'],
        startsOn: yesterday,
        endsOn: addCalendarDays(TODAY, 30),
        reason: 'Délégation fictive',
        confirm: true,
      }),
      201,
      delegationSchema,
    );
    expect(delegation.active).toBe(true);
    await memberClient.post('/teams', { name: 'Équipe déléguée' }).expect(201);

    await json(
      pleinClient.post(`/mandates/${mandate.id}/end`, {
        endedEarlyOn: yesterday,
        reason: 'Fin fictive du mandat',
        confirm: true,
      }),
      201,
      mandateSchema,
    );
    const me = await json(memberClient.get('/auth/me'), 200, meResponseSchema);
    expect(me.user.permissions).not.toContain('team.manage');
    await memberClient.post('/teams', { name: 'Équipe refusée' }).expect(403);
  });
});

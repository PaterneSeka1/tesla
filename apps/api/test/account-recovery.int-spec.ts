import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  accountTokenInfoSchema,
  accountWithLinkSchema,
  apiErrorSchema,
  CSRF_HEADER,
  passwordResetRequestResultSchema,
} from '@tesla/shared';
import request, { type Test as SupertestRequest } from 'supertest';
import { type App } from 'supertest/types.js';
import { type z } from 'zod';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { validateEnv } from '../src/config/env.js';
import { CODE_MAX_FAILURES, RATE_LIMIT_POLICY } from '../src/modules/auth/login-rate-limiter.js';
import { AccountMailer } from '../src/modules/users/account-mailer.js';
import { AccountsService } from '../src/modules/users/accounts.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestPrisma, resetDatabase, testDatabaseUrl } from './int-database.js';

// Inscription privée sur invitation (lien ou code, D162), mot de passe oublié (D166) et limitation
// persistante (D165). PostgreSQL réel, comptes fictifs, aucun envoi réel (transport simulé).
const PASSWORD = 'phrase-fictive-de-test-01';
const NEW_PASSWORD = 'autre phrase fictive très personnelle';

interface SentMail {
  to: string;
  purpose: string;
  token: string;
  code: string;
}

async function json<T>(req: SupertestRequest, status: number, schema: z.ZodType<T>): Promise<T> {
  const response = await req.expect(status);
  return schema.parse(response.body);
}

async function errorCode(req: SupertestRequest, status: number): Promise<string> {
  return (await json(req, status, apiErrorSchema)).code;
}

describe('Inscription sur invitation, récupération et limitation (intégration PostgreSQL)', () => {
  let prisma: PrismaService;
  const apps: INestApplication<App>[] = [];
  let app: INestApplication<App>;
  /** Application dont l'envoi SMTP est simulé (enabled, messages capturés). */
  let mailApp: INestApplication<App>;
  const sent: SentMail[] = [];
  let counter = 0;

  async function boot(mailer?: object): Promise<INestApplication<App>> {
    let builder = Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma);
    if (mailer) builder = builder.overrideProvider(AccountMailer).useValue(mailer);
    const instance: INestApplication<App> = (await builder.compile()).createNestApplication({
      logger: false,
    });
    configureApp(
      instance,
      validateEnv({ NODE_ENV: 'test', DATABASE_URL: testDatabaseUrl(), SWAGGER_ENABLED: 'false' }),
    );
    await instance.init();
    apps.push(instance);
    return instance;
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl();
    prisma = createTestPrisma();
    app = await boot();
    mailApp = await boot({
      enabled: true,
      sendAccountLink: (input: SentMail) => {
        sent.push(input);
        return Promise.resolve(true);
      },
    });
  });

  afterAll(async () => {
    for (const instance of apps) await instance.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    sent.length = 0;
  });

  const post = (target: INestApplication<App>, path: string, body: object, ip?: string) => {
    const req = request(target.getHttpServer())
      .post(`/api/v1${path}`)
      .set(CSRF_HEADER, '1')
      .send(body);
    return ip ? req.set('X-Forwarded-For', ip) : req;
  };
  const login = (email: string, password: string, target = app) =>
    post(target, '/auth/login', { email, password });

  /** Administrateur activé et connecté, puis compte routier créé (invitation émise). */
  async function invite(target = app) {
    counter += 1;
    const accounts = target.get(AccountsService);
    const adminEmail = `admin${counter}@example.test`;
    const adminLink = await accounts.bootstrapAdministrator({
      email: adminEmail,
      firstName: 'Fictif',
      lastName: 'Administration',
      recover: false,
    });
    await post(target, '/auth/activation/complete', {
      token: adminLink.token,
      password: PASSWORD,
    }).expect(204);
    const admin = request.agent(target.getHttpServer());
    await admin
      .post('/api/v1/auth/login')
      .set(CSRF_HEADER, '1')
      .send({ email: adminEmail, password: PASSWORD })
      .expect(200);
    const adminPost = (path: string, body: object = {}) =>
      admin.post(`/api/v1${path}`).set(CSRF_HEADER, '1').send(body);
    /** Autre routier invité par le même administrateur. */
    const another = async () => {
      counter += 1;
      const email = `routier${counter}@example.test`;
      const created = await json(
        adminPost('/users', { email, firstName: 'Routier', lastName: 'Fictif', role: 'ROUTIER' }),
        201,
        accountWithLinkSchema,
      );
      return { email, created };
    };
    return { ...(await another()), adminPost, another };
  }

  it('lien : vérification sans consommation, mot de passe choisi, usage unique, finalités séparées', async () => {
    const { email, created, adminPost } = await invite();
    expect(created.link.sentByEmail).toBe(false);
    expect(created.link.code).toMatch(/^[0-9A-Z]{5}-[0-9A-Z]{5}$/);
    const { token } = created.link;

    // Un jeton d'activation n'ouvre pas la récupération.
    expect(await errorCode(post(app, '/auth/password-reset/verify', { token }), 400)).toBe(
      'INVALID_ACCOUNT_LINK',
    );
    for (let i = 0; i < 2; i += 1) {
      const info = await json(
        post(app, '/auth/activation/verify', { token }),
        200,
        accountTokenInfoSchema,
      );
      expect(info).toMatchObject({ purpose: 'ACTIVATION', firstName: 'Routier' });
      expect(JSON.stringify(info)).not.toContain(email);
    }
    // Mot de passe courant ou trop court : refusé, jeton intact.
    for (const password of ['court', 'motdepasse123', 'aaaaaaaaaaaaaaa']) {
      await post(app, '/auth/activation/complete', { token, password }).expect(400);
    }
    await post(app, '/auth/activation/complete', { token, password: PASSWORD }).expect(204);
    await login(email, PASSWORD).expect(200);
    expect(
      await errorCode(post(app, '/auth/activation/complete', { token, password: PASSWORD }), 400),
    ).toBe('INVALID_ACCOUNT_LINK');

    // Compte actif : un nouveau lien est une réinitialisation, jamais une activation.
    const relink = await json(
      adminPost(`/users/${created.account.id}/link`),
      201,
      accountWithLinkSchema,
    );
    expect(relink.link.purpose).toBe('REINITIALISATION');
    await post(app, '/auth/activation/verify', { token: relink.link.token }).expect(400);
    expect(await prisma.user.count({ where: { email } })).toBe(1);
    // Aucun secret en clair en base.
    const rows = await prisma.accountToken.findMany();
    const stored = JSON.stringify(rows);
    expect(stored).not.toContain(token);
    expect(stored).not.toContain(created.link.code.replace('-', ''));
  });

  it('code : avec l’e-mail seulement, 5 essais par invitation, réponse identique pour un e-mail inconnu', async () => {
    const { email, created } = await invite();
    const code = created.link.code;
    // Saisie tolérante : minuscules, espaces.
    const loose = ` ${code.toLowerCase().replace('-', ' ')} `;
    await json(
      post(app, '/auth/activation/verify', { email, code: loose }),
      200,
      accountTokenInfoSchema,
    );
    expect(
      await errorCode(
        post(app, '/auth/activation/verify', { email: 'inconnu@example.test', code }),
        400,
      ),
    ).toBe('INVALID_ACCOUNT_CODE');
    const wrong = code.startsWith('0') ? `1${code.slice(1)}` : `0${code.slice(1)}`;
    for (let i = 0; i < CODE_MAX_FAILURES; i += 1) {
      expect(
        await errorCode(post(app, '/auth/activation/verify', { email, code: wrong }), 400),
      ).toBe('INVALID_ACCOUNT_CODE');
    }
    // Invitation révoquée : le bon code et le lien ne fonctionnent plus.
    await post(app, '/auth/activation/verify', { email, code }).expect(400);
    await post(app, '/auth/activation/verify', { token: created.link.token }).expect(400);
    const token = await prisma.accountToken.findFirstOrThrow({
      where: { user: { email } },
    });
    expect(token.revokedAt).not.toBeNull();
    expect(token.codeFailures).toBe(CODE_MAX_FAILURES);
    expect(await prisma.auditLog.count({ where: { action: 'account.code_locked' } })).toBe(1);
  });

  it('code : activation complète, fiche existante conservée, compte désactivé jamais réactivé', async () => {
    const { email, created, adminPost, another } = await invite();
    const profile = await prisma.scoutProfile.create({
      data: {
        firstName: 'Routier',
        lastName: 'Fictif',
        joinedAt: new Date('2026-10-01'),
        userId: created.account.id,
      },
    });
    await post(app, '/auth/activation/complete', {
      email,
      code: created.link.code,
      password: PASSWORD,
    }).expect(204);
    await login(email, PASSWORD).expect(200);
    const linked = await prisma.scoutProfile.findUniqueOrThrow({ where: { id: profile.id } });
    expect(linked.userId).toBe(created.account.id);
    expect(await prisma.scoutProfile.count()).toBe(1);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'account.activated', entityId: created.account.id },
    });
    expect(audit.metadata).toMatchObject({ method: 'code' });

    // Compte désactivé : lien révoqué, aucune activation possible.
    const second = await another();
    await adminPost(`/users/${second.created.account.id}/deactivate`, {
      reason: 'Départ fictif',
    });
    await post(app, '/auth/activation/complete', {
      token: second.created.link.token,
      password: PASSWORD,
    }).expect(400);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: second.created.account.id } });
    expect(user).toMatchObject({ isActive: false, passwordHash: null });
  });

  it('mot de passe oublié sans SMTP : réponse neutre « responsable », rien n’est émis', async () => {
    const { email, created } = await invite();
    await post(app, '/auth/activation/complete', {
      token: created.link.token,
      password: PASSWORD,
    }).expect(204);
    const known = await json(
      post(app, '/auth/password-reset/request', { email }),
      200,
      passwordResetRequestResultSchema,
    );
    const unknown = await json(
      post(app, '/auth/password-reset/request', { email: 'personne@example.test' }),
      200,
      passwordResetRequestResultSchema,
    );
    expect(known).toEqual({ channel: 'RESPONSABLE' });
    expect(unknown).toEqual(known);
    expect(await prisma.accountToken.count({ where: { purpose: 'REINITIALISATION' } })).toBe(0);
  });

  it('mot de passe oublié avec SMTP : lien ou code, sessions révoquées, ancien mot de passe refusé, usage unique, expiration', async () => {
    const { email, created } = await invite(mailApp);
    await post(mailApp, '/auth/activation/complete', {
      token: created.link.token,
      password: PASSWORD,
    }).expect(204);
    const session = request.agent(mailApp.getHttpServer());
    await session
      .post('/api/v1/auth/login')
      .set(CSRF_HEADER, '1')
      .send({ email, password: PASSWORD })
      .expect(200);
    sent.length = 0;

    const unknown = await json(
      post(mailApp, '/auth/password-reset/request', { email: 'personne@example.test' }),
      200,
      passwordResetRequestResultSchema,
    );
    const known = await json(
      post(mailApp, '/auth/password-reset/request', { email }),
      200,
      passwordResetRequestResultSchema,
    );
    expect(known).toEqual({ channel: 'EMAIL' });
    expect(unknown).toEqual(known);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    const mail = sent[0]!;
    expect(mail).toMatchObject({ to: email, purpose: 'REINITIALISATION' });

    // Le jeton de récupération n'ouvre pas l'activation.
    await post(mailApp, '/auth/activation/verify', { token: mail.token }).expect(400);
    await json(
      post(mailApp, '/auth/password-reset/verify', { email, code: mail.code }),
      200,
      accountTokenInfoSchema,
    );
    await post(mailApp, '/auth/password-reset/complete', {
      token: mail.token,
      password: NEW_PASSWORD,
    }).expect(204);
    await session.get('/api/v1/auth/me').expect(401);
    await login(email, PASSWORD, mailApp).expect(401);
    await login(email, NEW_PASSWORD, mailApp).expect(200);
    await post(mailApp, '/auth/password-reset/complete', {
      token: mail.token,
      password: PASSWORD,
    }).expect(400);

    // Demande expirée : refusée.
    await post(mailApp, '/auth/password-reset/request', { email }).expect(200);
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    await prisma.accountToken.updateMany({
      where: { usedAt: null, revokedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await post(mailApp, '/auth/password-reset/verify', { token: sent[1]!.token }).expect(400);
  });

  it('limitation : 429 avec Retry-After, requêtes simultanées, persistance après redémarrage, expiration', async () => {
    const email = 'cible@example.test';
    const limit = RATE_LIMIT_POLICY.resetAccount.limit;
    const responses = await Promise.all(
      Array.from({ length: limit + 3 }, () => post(app, '/auth/password-reset/request', { email })),
    );
    const statuses = responses.map((response) => response.status).sort();
    expect(statuses.filter((status) => status === 200)).toHaveLength(limit);
    const refused = responses.find((response) => response.status === 429)!;
    expect(Number(refused.headers['retry-after'])).toBeGreaterThan(0);
    expect(apiErrorSchema.parse(refused.body).code).toBe('TOO_MANY_LOGIN_ATTEMPTS');
    // Message identique pour un e-mail inconnu : aucune énumération.
    expect(JSON.stringify(refused.body)).not.toContain(email);

    // Nouvelle instance de l'API (redémarrage) : le blocage est conservé en base.
    const restarted = await boot();
    await post(restarted, '/auth/password-reset/request', { email }).expect(429);
    // Une autre personne derrière la même adresse IP n'est pas bloquée.
    await post(restarted, '/auth/password-reset/request', { email: 'voisin@example.test' }).expect(
      200,
    );

    // Échéance passée : la limite se lève d'elle-même (aucun blocage permanent), puis purge.
    await prisma.authThrottle.updateMany({
      data: {
        windowStart: new Date(Date.now() - 2 * 3_600_000),
        blockedUntil: new Date(Date.now() - 1000),
        updatedAt: new Date(Date.now() - 2 * 86_400_000),
      },
    });
    await post(app, '/auth/password-reset/request', { email }).expect(200);
    await prisma.authThrottle.updateMany({
      data: { updatedAt: new Date(Date.now() - 2 * 86_400_000), blockedUntil: null },
    });
    const { LoginRateLimiter } = await import('../src/modules/auth/login-rate-limiter.js');
    expect(await app.get(LoginRateLimiter).purge()).toBeGreaterThan(0);
  });

  it('limitation : connexions simultanées sous le seuil, plusieurs comptes derrière une IP, X-Forwarded-For ignoré sans proxy de confiance', async () => {
    const { email, created, another } = await invite();
    await post(app, '/auth/activation/complete', {
      token: created.link.token,
      password: PASSWORD,
    }).expect(204);
    const failures = await Promise.all(
      Array.from({ length: 10 }, () => login(email, 'mauvais-mot-de-passe')),
    );
    expect(failures.every((r) => r.status === 401 || r.status === 429)).toBe(true);
    // Adresses IP inventées dans X-Forwarded-For (TRUST_PROXY=false) : toujours bloqué.
    for (const ip of ['203.0.113.7', '198.51.100.9']) {
      await post(app, '/auth/login', { email, password: PASSWORD }, ip).expect(429);
    }
    // Un autre routier derrière la même adresse IP se connecte normalement.
    const other = await another();
    await post(app, '/auth/activation/complete', {
      token: other.created.link.token,
      password: PASSWORD,
    }).expect(204);
    await login(other.email, PASSWORD).expect(200);
    const keys = await prisma.authThrottle.findMany();
    expect(JSON.stringify(keys)).not.toContain('@');
  });
});

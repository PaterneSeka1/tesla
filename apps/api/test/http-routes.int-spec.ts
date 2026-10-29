import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  apiErrorSchema,
  CSRF_HEADER,
  meResponseSchema,
  observationRevisionListSchema,
  observationSchema,
  paginatedSchema,
  scoutDetailSchema,
  scoutListItemSchema,
  scoutPedagogicalHistorySchema,
  SESSION_COOKIE_NAME,
  teamAssignmentListSchema,
  teamDetailSchema,
  teamSchema,
} from '@tesla/shared';
import request, { type Test as SupertestRequest } from 'supertest';
import { type App } from 'supertest/types.js';
import { type z } from 'zod';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { validateEnv } from '../src/config/env.js';
import { type Role } from '../src/generated/prisma/enums.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestPrisma, resetDatabase, testDatabaseUrl } from './int-database.js';

// Routes HTTP de bout en bout (session, CSRF, permissions, transactions) sur PostgreSQL réel.
// Chaque réponse est validée par le contrat Zod partagé. Données exclusivement fictives.
const PASSWORD = 'mot-de-passe-fictif-de-test';

const scoutPage = paginatedSchema(scoutListItemSchema);
const teamPage = paginatedSchema(teamSchema);
const observationPage = paginatedSchema(observationSchema);

/** Vérifie le statut puis valide le corps avec le contrat attendu. */
async function json<T>(req: SupertestRequest, status: number, schema: z.ZodType<T>): Promise<T> {
  const response = await req.expect(status);
  return schema.parse(response.body);
}

/** Vérifie le statut d'erreur et renvoie son code stable. */
async function errorCode(req: SupertestRequest, status: number): Promise<string> {
  return (await json(req, status, apiErrorSchema)).code;
}

describe('Routes HTTP authentifiées (intégration PostgreSQL)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordHash: string;
  let emailCounter = 0;

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl(); // lu par ConfigModule
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

  /** Compte fictif avec adresse unique (le limiteur de connexion est partagé entre les tests). */
  async function createUser(role: Role, extra: { isActive?: boolean } = {}) {
    emailCounter += 1;
    return prisma.user.create({
      data: {
        email: `fictif${emailCounter}@example.test`,
        firstName: 'Fictif',
        lastName: `${role} ${emailCounter}`,
        role,
        passwordHash,
        ...extra,
      },
    });
  }

  const loginRequest = (body: object) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').set(CSRF_HEADER, '1').send(body);

  /** Agent Supertest connecté (cookie conservé) ; les écritures portent l'en-tête anti-CSRF. */
  async function loginAs(role: Role) {
    const user = await createUser(role);
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/auth/login')
      .set(CSRF_HEADER, '1')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);
    const write = (method: 'post' | 'patch', path: string, body: object = {}) =>
      agent[method](`/api/v1${path}`).set(CSRF_HEADER, '1').send(body);
    return {
      user,
      get: (path: string) => agent.get(`/api/v1${path}`),
      post: (path: string, body?: object) => write('post', path, body),
      patch: (path: string, body: object) => write('patch', path, body),
    };
  }

  type Client = Awaited<ReturnType<typeof loginAs>>;

  async function stageId(code: string): Promise<string> {
    return (await prisma.progressionStage.findUniqueOrThrow({ where: { code } })).id;
  }

  const scoutBody = (n: number, extra: object = {}) => ({
    firstName: 'Routier',
    lastName: `Fictif${n}`,
    joinedAt: '2026-10-01',
    ...extra,
  });

  const createTeam = (client: Client, name: string) =>
    json(client.post('/teams', { name }), 201, teamDetailSchema);

  const createScout = (client: Client, n: number, extra: object = {}) =>
    json(client.post('/scouts', scoutBody(n, extra)), 201, scoutDetailSchema);

  describe('Authentification et sessions', () => {
    it('connexion valide : cookie httpOnly SameSite=Lax, puis /auth/me', async () => {
      const user = await createUser('RESPONSABLE');
      const agent = request.agent(app.getHttpServer());
      const response = await agent
        .post('/api/v1/auth/login')
        .set(CSRF_HEADER, '1')
        .send({ email: user.email.toUpperCase(), password: PASSWORD })
        .expect(200);
      const cookie = String(response.headers['set-cookie']);
      expect(cookie).toContain(`${SESSION_COOKIE_NAME}=`);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(meResponseSchema.parse(response.body).user).toMatchObject({
        id: user.id,
        role: 'RESPONSABLE',
      });

      const me = await json(agent.get('/api/v1/auth/me'), 200, meResponseSchema);
      expect(me.user.email).toBe(user.email);
      const session = await prisma.session.findFirstOrThrow({ where: { userId: user.id } });
      // Seul le hash du jeton est stocké.
      expect(cookie).not.toContain(session.tokenHash);
    });

    it('connexion invalide : message unique (mot de passe faux, compte inconnu, compte désactivé)', async () => {
      const user = await createUser('CHEF');
      const inactive = await createUser('CHEF', { isActive: false });
      for (const body of [
        { email: user.email, password: 'faux' },
        { email: 'inconnu@example.test', password: PASSWORD },
        { email: inactive.email, password: PASSWORD },
      ]) {
        expect(await errorCode(loginRequest(body), 401)).toBe('INVALID_CREDENTIALS');
      }
      expect(await errorCode(loginRequest({ email: 'pas-un-email', password: 'x' }), 400)).toBe(
        'VALIDATION_ERROR',
      );
    });

    it('limite les tentatives de connexion (429)', async () => {
      const user = await createUser('CHEF');
      for (let i = 0; i < 5; i += 1) {
        await loginRequest({ email: user.email, password: 'faux' }).expect(401);
      }
      expect(await errorCode(loginRequest({ email: user.email, password: PASSWORD }), 429)).toBe(
        'TOO_MANY_LOGIN_ATTEMPTS',
      );
    });

    it('refuse une session expirée, révoquée ou d’un compte désactivé', async () => {
      const expired = await loginAs('CHEF');
      await prisma.session.updateMany({
        where: { userId: expired.user.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      expect(await errorCode(expired.get('/auth/me'), 401)).toBe('UNAUTHENTICATED');

      const revoked = await loginAs('CHEF');
      await revoked.post('/auth/logout').expect(204);
      await revoked.get('/auth/me').expect(401);
      const session = await prisma.session.findFirstOrThrow({ where: { userId: revoked.user.id } });
      expect(session.revokedAt).not.toBeNull();

      const deactivated = await loginAs('CHEF');
      await prisma.user.update({ where: { id: deactivated.user.id }, data: { isActive: false } });
      await deactivated.get('/scouts').expect(401);
    });

    it('refuse les accès sans session et les écritures d’une origine non autorisée', async () => {
      await request(app.getHttpServer()).get('/api/v1/teams').expect(401);
      const responsable = await loginAs('RESPONSABLE');
      expect((await json(responsable.get('/teams'), 200, teamPage)).total).toBe(0);
      const foreign = request(app.getHttpServer())
        .post('/api/v1/teams')
        .set(CSRF_HEADER, '1')
        .set('Origin', 'https://site-tiers.test')
        .send({ name: 'X' });
      expect(await errorCode(foreign, 403)).toBe('CSRF_REJECTED');
    });
  });

  describe('Permissions côté serveur', () => {
    it('un chef ne gère ni les équipes ni les fiches, et ne change pas une étape', async () => {
      const responsable = await loginAs('RESPONSABLE');
      const chef = await loginAs('CHEF');
      const scout = await createScout(responsable, 1);

      await chef.post('/teams', { name: 'Équipe fictive' }).expect(403);
      await chef.post('/scouts', scoutBody(2)).expect(403);
      const stageChange = chef.patch(`/scouts/${scout.id}`, {
        currentStageId: await stageId('APPRENTISSAGE'),
      });
      expect(await errorCode(stageChange, 403)).toBe('FORBIDDEN');
      await chef.post(`/scouts/${scout.id}/deactivate`).expect(403);
      // La consultation reste autorisée.
      await chef.get(`/scouts/${scout.id}`).expect(200);
      const unchanged = await prisma.scoutProfile.findUniqueOrThrow({ where: { id: scout.id } });
      expect(unchanged.currentStageId).toBeNull();
    });

    it('protège les informations individuelles', async () => {
      const responsable = await loginAs('RESPONSABLE');
      const chef = await loginAs('CHEF');
      const routier = await loginAs('ROUTIER');
      const account = await createUser('ROUTIER');
      const scout = await createScout(responsable, 1);
      await responsable
        .post(`/scouts/${scout.id}/link-account`, { email: account.email })
        .expect(201);

      await routier.get('/scouts').expect(403);
      await routier.get(`/scouts/${scout.id}`).expect(403);
      await routier.get(`/scouts/${scout.id}/observations`).expect(403);
      // L'e-mail du compte n'est communiqué qu'au responsable.
      const seenByChef = await json(chef.get(`/scouts/${scout.id}`), 200, scoutDetailSchema);
      expect(seenByChef.account).toMatchObject({ email: null });
      const seenByResponsable = await json(
        responsable.get(`/scouts/${scout.id}`),
        200,
        scoutDetailSchema,
      );
      expect(seenByResponsable.account?.email).toBe(account.email);
    });
  });

  describe('Parcours du responsable', () => {
    it('crée une équipe et un routier sans compte, l’affecte, change d’équipe sans perdre l’historique', async () => {
      const responsable = await loginAs('RESPONSABLE');
      const teamA = await createTeam(responsable, 'Équipe fictive A');
      const teamB = await createTeam(responsable, 'Équipe fictive B');
      expect(await errorCode(responsable.post('/teams', { name: 'équipe FICTIVE a' }), 409)).toBe(
        'TEAM_NAME_TAKEN',
      );

      const created = await createScout(responsable, 1, {
        matricule: '0000125 b',
        teamId: teamA.id,
      });
      expect(created).toMatchObject({
        matricule: '0000125B',
        hasAccount: false,
        account: null,
        team: { id: teamA.id },
      });
      expect(await prisma.user.count({ where: { role: 'ROUTIER' } })).toBe(0); // aucun compte créé

      // Recherche par nom et par matricule, filtres.
      expect((await json(responsable.get('/scouts?search=fictif1'), 200, scoutPage)).total).toBe(1);
      const byMatricule = await json(responsable.get('/scouts?search=0000125'), 200, scoutPage);
      expect(byMatricule.items[0]?.id).toBe(created.id);
      expect(
        (await json(responsable.get(`/scouts?teamId=${teamA.id}`), 200, scoutPage)).total,
      ).toBe(1);
      expect((await json(responsable.get('/scouts?account=without'), 200, scoutPage)).total).toBe(
        1,
      );

      const history = await json(
        responsable.post(`/scouts/${created.id}/teams/assign`, { teamId: teamB.id }),
        201,
        teamAssignmentListSchema,
      );
      expect(history.items).toHaveLength(2);
      const [current, previous] = history.items;
      expect(current).toMatchObject({ team: { id: teamB.id }, endedAt: null });
      expect(current?.assignedBy?.id).toBe(responsable.user.id);
      expect(previous).toMatchObject({ team: { id: teamA.id } });
      expect(previous?.endedAt).not.toBeNull();
      expect(previous?.endedBy?.id).toBe(responsable.user.id);

      expect(
        await errorCode(
          responsable.post(`/scouts/${created.id}/teams/assign`, { teamId: teamB.id }),
          409,
        ),
      ).toBe('ALREADY_IN_TEAM');
      const audit = await prisma.auditLog.count({
        where: { action: 'team_assignment.created', entityId: created.id },
      });
      expect(audit).toBe(1);
      const teamDetail = await json(responsable.get(`/teams/${teamB.id}`), 200, teamDetailSchema);
      expect(teamDetail.members).toHaveLength(1);
    });

    it('refuse un matricule en double et demande confirmation pour un homonyme', async () => {
      const responsable = await loginAs('RESPONSABLE');
      await createScout(responsable, 1, { matricule: '0000001A' });
      expect(
        await errorCode(responsable.post('/scouts', scoutBody(2, { matricule: '0000001a' })), 409),
      ).toBe('MATRICULE_ALREADY_USED');
      await responsable.post('/scouts', scoutBody(3, { matricule: '12' })).expect(400);

      expect(await errorCode(responsable.post('/scouts', scoutBody(1)), 409)).toBe(
        'POSSIBLE_DUPLICATE',
      );
      await createScout(responsable, 1, { confirmDuplicate: true });
    });

    it('archive une équipe sans supprimer l’historique', async () => {
      const responsable = await loginAs('RESPONSABLE');
      const team = await createTeam(responsable, 'Équipe fictive');
      const scout = await createScout(responsable, 1, { teamId: team.id });

      const archived = await json(
        responsable.post(`/teams/${team.id}/archive`),
        201,
        teamDetailSchema,
      );
      expect(archived.archivedAt).not.toBeNull();
      expect(archived.members).toHaveLength(0);
      await responsable.post(`/teams/${team.id}/archive`).expect(409);
      await responsable.patch(`/teams/${team.id}`, { name: 'Autre' }).expect(409);
      await responsable.post(`/scouts/${scout.id}/teams/assign`, { teamId: team.id }).expect(409);

      const history = await json(
        responsable.get(`/scouts/${scout.id}/teams/history`),
        200,
        teamAssignmentListSchema,
      );
      expect(history.items).toHaveLength(1);
      expect(history.items[0]).toMatchObject({ team: { id: team.id, archived: true } });
      expect(history.items[0]?.endedAt).not.toBeNull();
      expect((await json(responsable.get('/teams?status=archived'), 200, teamPage)).total).toBe(1);
      expect((await json(responsable.get('/teams'), 200, teamPage)).total).toBe(0);
    });

    it('sérialise des affectations simultanées : une seule affectation ouverte', async () => {
      const responsable = await loginAs('RESPONSABLE');
      const scout = await createScout(responsable, 1);
      const teams = await Promise.all(
        [1, 2, 3, 4, 5].map((n) => createTeam(responsable, `Équipe ${n}`)),
      );
      const results = await Promise.all(
        teams.map((team) =>
          responsable.post(`/scouts/${scout.id}/teams/assign`, { teamId: team.id }),
        ),
      );
      expect(results.some((response) => response.status === 201)).toBe(true);
      expect(results.every((response) => [201, 422].includes(response.status))).toBe(true);
      expect(
        await prisma.teamAssignment.count({ where: { scoutProfileId: scout.id, endedAt: null } }),
      ).toBe(1);
    });

    it('rattache plus tard un compte existant sans modifier le profil ni son historique', async () => {
      const responsable = await loginAs('RESPONSABLE');
      const team = await createTeam(responsable, 'Équipe fictive');
      const scout = await createScout(responsable, 1, { matricule: '0000002C', teamId: team.id });
      const chef = await createUser('CHEF');
      const account = await createUser('ROUTIER');

      expect(
        await errorCode(
          responsable.post(`/scouts/${scout.id}/link-account`, { email: chef.email }),
          409,
        ),
      ).toBe('ACCOUNT_NOT_ROUTIER');
      const linked = await json(
        responsable.post(`/scouts/${scout.id}/link-account`, { email: account.email }),
        201,
        scoutDetailSchema,
      );
      expect(linked).toMatchObject({
        id: scout.id,
        matricule: '0000002C',
        hasAccount: true,
        team: { id: team.id },
      });
      await responsable
        .post(`/scouts/${scout.id}/link-account`, { email: account.email })
        .expect(409);
      expect(await prisma.scoutProfile.count()).toBe(1);
      const history = await json(
        responsable.get(`/scouts/${scout.id}/teams/history`),
        200,
        teamAssignmentListSchema,
      );
      expect(history.items).toHaveLength(1);
    });

    it('désactive puis réactive un profil (affectation close, données conservées)', async () => {
      const responsable = await loginAs('RESPONSABLE');
      const team = await createTeam(responsable, 'Équipe fictive');
      const scout = await createScout(responsable, 1, { teamId: team.id });
      const deactivated = await json(
        responsable.post(`/scouts/${scout.id}/deactivate`),
        201,
        scoutDetailSchema,
      );
      expect(deactivated).toMatchObject({ isActive: false, team: null });
      expect((await json(responsable.get('/scouts'), 200, scoutPage)).total).toBe(0);
      expect((await json(responsable.get('/scouts?status=inactive'), 200, scoutPage)).total).toBe(
        1,
      );
      expect(
        await errorCode(
          responsable.post(`/scouts/${scout.id}/teams/assign`, { teamId: team.id }),
          409,
        ),
      ).toBe('SCOUT_INACTIVE');
      await responsable.post(`/scouts/${scout.id}/activate`).expect(201);
      const history = await json(
        responsable.get(`/scouts/${scout.id}/teams/history`),
        200,
        teamAssignmentListSchema,
      );
      expect(history.items).toHaveLength(1);
    });

    it('change l’étape (responsable uniquement) et la journalise dans l’historique pédagogique', async () => {
      const responsable = await loginAs('RESPONSABLE');
      const scout = await createScout(responsable, 1, {
        currentStageId: await stageId('NOVICIAT'),
      });
      await responsable
        .patch(`/scouts/${scout.id}`, { currentStageId: await stageId('APPRENTISSAGE') })
        .expect(200);
      const history = await json(
        responsable.get(`/scouts/${scout.id}/pedagogical-history`),
        200,
        scoutPedagogicalHistorySchema,
      );
      expect(history.attempts).toEqual([]);
      expect(history.stageChanges).toHaveLength(1);
      expect(history.stageChanges[0]).toMatchObject({
        from: { code: 'NOVICIAT' },
        to: { code: 'APPRENTISSAGE' },
        by: { id: responsable.user.id },
      });
    });
  });

  describe('Observations', () => {
    it('un chef saisit une observation ; le responsable la consulte ; l’étape ne change pas', async () => {
      const responsable = await loginAs('RESPONSABLE');
      const chef = await loginAs('CHEF');
      const scout = await createScout(responsable, 1);
      const path = `/scouts/${scout.id}/observations`;

      const created = await json(
        chef.post(path, {
          observedOn: '2026-10-24',
          content: 'Observation fictive : participation active au service.',
          category: 'Service',
        }),
        201,
        observationSchema,
      );
      expect(created).toMatchObject({
        author: { id: chef.user.id },
        visibility: 'ENCADREMENT',
        canEdit: true,
      });
      const list = await json(responsable.get(path), 200, observationPage);
      expect(list.total).toBe(1);
      expect(list.items[0]?.canEdit).toBe(false);
      await chef.post(path, { observedOn: 'hier', content: 'x' }).expect(400);
      const profile = await prisma.scoutProfile.findUniqueOrThrow({ where: { id: scout.id } });
      expect(profile.currentStageId).toBeNull();
    });

    it('respecte la visibilité et réserve la modification à l’auteur, avec historique', async () => {
      const responsable = await loginAs('RESPONSABLE');
      const chef1 = await loginAs('CHEF');
      const chef2 = await loginAs('CHEF');
      const scout = await createScout(responsable, 1);
      const path = `/scouts/${scout.id}/observations`;

      const restricted = await json(
        responsable.post(path, {
          observedOn: '2026-10-24',
          content: 'Note confidentielle fictive',
          visibility: 'RESPONSABLE',
        }),
        201,
        observationSchema,
      );
      const shared = await json(
        chef1.post(path, { observedOn: '2026-10-25', content: 'Première version' }),
        201,
        observationSchema,
      );

      expect((await json(chef2.get(path), 200, observationPage)).total).toBe(1);
      await chef2.get(`${path}/${restricted.id}/revisions`).expect(404);

      expect(
        await errorCode(chef2.patch(`${path}/${shared.id}`, { content: 'Tentative' }), 403),
      ).toBe('OBSERVATION_NOT_AUTHOR');
      const edited = await json(
        chef1.patch(`${path}/${shared.id}`, { content: 'Version corrigée' }),
        200,
        observationSchema,
      );
      expect(edited.editedAt).not.toBeNull();
      const revisions = await json(
        responsable.get(`${path}/${shared.id}/revisions`),
        200,
        observationRevisionListSchema,
      );
      expect(revisions.items).toHaveLength(1);
      expect(revisions.items[0]).toMatchObject({
        content: 'Première version',
        editor: { id: chef1.user.id },
      });

      // Ni suppression ni réécriture de l'historique en base.
      await expect(prisma.scoutObservation.delete({ where: { id: shared.id } })).rejects.toThrow();
      await expect(prisma.scoutObservationRevision.deleteMany({})).rejects.toThrow();
    });
  });
});

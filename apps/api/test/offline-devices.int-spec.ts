import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  apiErrorSchema,
  CSRF_HEADER,
  OFFLINE_DEVICE_MAX_ACTIVE,
  offlineDeviceKeySchema,
  offlineDeviceListSchema,
} from '@tesla/shared';
import request from 'supertest';
import { type App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { validateEnv } from '../src/config/env.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestPrisma, resetDatabase, testDatabaseUrl } from './int-database.js';

// Appareils préparés pour l'usage hors connexion (D180) : la clé d'appareil n'est remise qu'au
// titulaire dont la session est valide ; révocation définitive ; changement de mot de passe = les
// autres sessions ne peuvent plus l'obtenir. Données exclusivement fictives.
const PASSWORD = 'mot-de-passe-fictif-de-test';
const NEW_PASSWORD = 'nouveau-mot-de-passe-fictif';

describe('Appareils hors connexion (intégration PostgreSQL)', () => {
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

  beforeEach(() => resetDatabase(prisma));

  async function createUser() {
    counter += 1;
    return prisma.user.create({
      data: {
        email: `appareil${counter}@example.test`,
        firstName: 'Fictif',
        lastName: `Appareil ${counter}`,
        role: 'ROUTIER',
        passwordHash: await hashPassword(PASSWORD),
      },
    });
  }

  async function login(email: string, password = PASSWORD) {
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
    };
  }

  it('enregistrement : clé aléatoire de 32 octets, jamais en cache, relue par le titulaire seul', async () => {
    const user = await createUser();
    const other = await createUser();
    const owner = await login(user.email);
    const stranger = await login(other.email);
    const created = await owner
      .post('/auth/offline-devices', { label: 'Chrome sur Android' })
      .expect(201);
    expect(created.headers['cache-control']).toBe('no-store');
    const device = offlineDeviceKeySchema.parse(created.body);
    expect(Buffer.from(device.key, 'base64')).toHaveLength(32);

    const again = offlineDeviceKeySchema.parse(
      (await owner.post(`/auth/offline-devices/${device.deviceId}/key`).expect(200)).body,
    );
    expect(again.key).toBe(device.key);
    // Autre compte : appareil inconnu (aucune fuite d'existence).
    const refused = await stranger.post(`/auth/offline-devices/${device.deviceId}/key`).expect(404);
    expect(apiErrorSchema.parse(refused.body).code).toBe('OFFLINE_DEVICE_NOT_FOUND');
    // Liste : libellé et dates, jamais la clé.
    const list = await owner.get('/auth/offline-devices').expect(200);
    expect(offlineDeviceListSchema.parse(list.body).items).toHaveLength(1);
    expect(JSON.stringify(list.body)).not.toContain(device.key);
    // Sans session : refusé.
    await request(app.getHttpServer())
      .post(`/api/v1/auth/offline-devices/${device.deviceId}/key`)
      .set(CSRF_HEADER, '1')
      .expect(401);
  });

  it('révocation définitive et idempotente : la clé n’est plus jamais remise (410)', async () => {
    const user = await createUser();
    const owner = await login(user.email);
    const device = offlineDeviceKeySchema.parse(
      (await owner.post('/auth/offline-devices', { label: 'Tablette' }).expect(201)).body,
    );
    await owner.post(`/auth/offline-devices/${device.deviceId}/revoke`).expect(204);
    await owner.post(`/auth/offline-devices/${device.deviceId}/revoke`).expect(204);
    const gone = await owner.post(`/auth/offline-devices/${device.deviceId}/key`).expect(410);
    expect(apiErrorSchema.parse(gone.body).code).toBe('OFFLINE_DEVICE_REVOKED');
    expect(
      await prisma.auditLog.count({
        where: { entityId: device.deviceId, action: 'offline_device.revoked' },
      }),
    ).toBe(1);
  });

  it(`au plus ${OFFLINE_DEVICE_MAX_ACTIVE} appareils actifs par compte`, async () => {
    const user = await createUser();
    const owner = await login(user.email);
    for (let i = 0; i < OFFLINE_DEVICE_MAX_ACTIVE; i += 1) {
      await owner.post('/auth/offline-devices', { label: `Appareil ${i}` }).expect(201);
    }
    const refused = await owner.post('/auth/offline-devices', { label: 'De trop' }).expect(409);
    expect(apiErrorSchema.parse(refused.body).code).toBe('OFFLINE_DEVICE_LIMIT');
  });

  it('changement de mot de passe ailleurs : l’ancienne session ne peut plus obtenir la clé, la nouvelle connexion oui', async () => {
    const user = await createUser();
    const deviceSession = await login(user.email);
    const device = offlineDeviceKeySchema.parse(
      (await deviceSession.post('/auth/offline-devices', { label: 'Téléphone' }).expect(201)).body,
    );
    const elsewhere = await login(user.email);
    await elsewhere
      .post('/auth/password', { currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
      .expect(204);
    await deviceSession.post(`/auth/offline-devices/${device.deviceId}/key`).expect(401);
    const fresh = await login(user.email, NEW_PASSWORD);
    const key = offlineDeviceKeySchema.parse(
      (await fresh.post(`/auth/offline-devices/${device.deviceId}/key`).expect(200)).body,
    );
    expect(key.key).toBe(device.key);
  });

  it('libellé invalide refusé', async () => {
    const user = await createUser();
    const owner = await login(user.email);
    await owner.post('/auth/offline-devices', { label: '   ' }).expect(400);
  });
});

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { apiErrorSchema, healthResponseSchema } from '@tesla/shared';
import request from 'supertest';
import { type App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { validateEnv } from '../src/config/env.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('API (e2e, base simulée)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: () => Promise.resolve([1]), $disconnect: () => Promise.resolve() })
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app, validateEnv({ ...process.env, SWAGGER_ENABLED: 'false' }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health renvoie un état conforme au contrat partagé', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    const body = healthResponseSchema.parse(response.body);
    expect(body).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('renvoie une erreur 404 au format homogène', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/inexistant').expect(404);
    expect(apiErrorSchema.parse(response.body)).toMatchObject({
      code: 'NOT_FOUND',
      message: 'Ressource introuvable.',
      path: '/api/v1/inexistant',
    });
  });

  it('refuse une route protégée sans session (401)', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/scouts').expect(401);
    expect(apiErrorSchema.parse(response.body).code).toBe('UNAUTHENTICATED');
  });

  it('refuse une écriture sans en-tête anti-CSRF (403)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'x@x.test', password: 'x' })
      .expect(403);
    expect(apiErrorSchema.parse(response.body).code).toBe('CSRF_REJECTED');
  });
});

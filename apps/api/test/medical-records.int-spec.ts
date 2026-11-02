import { randomBytes } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { apiErrorSchema, CSRF_HEADER, medicalRecordSchema } from '@tesla/shared';
import request from 'supertest';
import { type App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { validateEnv } from '../src/config/env.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { MedicalRecordsService } from '../src/modules/medical/medical-records.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  createTestPrisma,
  grantPersona,
  personaRole,
  resetDatabase,
  type TestPersona,
  testDatabaseUrl,
} from './int-database.js';

// Fiches médicales personnelles (D135–D137) : une par compte, quelle que soit la fonction ;
// titulaire seul ; chiffrées en base ; audit sans contenu ; PDF sans URL prévisible.
// PostgreSQL réel, comptes et informations fictifs.
const PASSWORD = 'phrase-fictive-de-test-01';
const SECRET_TEXT = 'Allergie-fictive-au-pollen-XYZ';
const path = '/api/v1/me/medical-record';

const data = (allergies = SECRET_TEXT) => ({
  phone: '+225 07 00 00 00 01',
  emergencyContacts: [{ name: 'Contact Fictif', relation: 'Parent', phone: '07 11 22 33 44' }],
  allergies,
  precautions: 'Éviter les longues marches au soleil (fictif).',
});

describe('Fiches médicales (intégration PostgreSQL)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordHash: string;
  let counter = 0;

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl();
    process.env.MEDICAL_DATA_KEY = randomBytes(32).toString('base64');
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
    delete process.env.MEDICAL_DATA_KEY;
    await app?.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  async function loginAs(persona: TestPersona) {
    counter += 1;
    const user = await prisma.user.create({
      data: {
        email: `medical${counter}@example.test`,
        firstName: 'Fictif',
        lastName: `${persona} ${counter}`,
        role: personaRole(persona),
        passwordHash,
      },
    });
    await grantPersona(prisma, user.id, persona);
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/auth/login')
      .set(CSRF_HEADER, '1')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);
    return {
      user,
      get: (suffix = '') => agent.get(`${path}${suffix}`),
      put: (body: object) => agent.put(path).set(CSRF_HEADER, '1').send(body),
      delete: (body: object) => agent.delete(path).set(CSRF_HEADER, '1').send(body),
    };
  }

  const record = async (req: request.Test, status = 200) =>
    medicalRecordSchema.parse((await req.expect(status)).body);
  const code = async (req: request.Test, status: number) =>
    apiErrorSchema.parse((await req.expect(status)).body).code;

  it.each<TestPersona>(['ROUTIER', 'CHEF', 'RESPONSABLE'])(
    '%s : crée sa fiche puis la modifie autant de fois que nécessaire',
    async (persona) => {
      const me = await loginAs(persona);
      const empty = await record(me.get());
      expect(empty.record).toBeNull();
      expect(empty.holder.lastName).toBe(me.user.lastName);

      let current = await record(me.put({ expectedRevision: null, data: data() }));
      expect(current.record?.revision).toBe(1);
      expect(current.record?.data.allergies).toBe(SECRET_TEXT);
      for (let index = 1; index <= 5; index++) {
        current = await record(
          me.put({ expectedRevision: current.record!.revision, data: data(`Version ${index}`) }),
        );
      }
      expect(current.record?.revision).toBe(6);
      expect((await record(me.get())).record?.data.allergies).toBe('Version 5');
    },
  );

  it('identité du routier lue depuis sa fiche (matricule, naissance, équipe)', async () => {
    const me = await loginAs('ROUTIER');
    const team = await prisma.team.create({ data: { name: 'Équipe fictive' } });
    const profile = await prisma.scoutProfile.create({
      data: {
        userId: me.user.id,
        firstName: 'Prénom',
        lastName: 'Routier',
        matricule: '0000901A',
        birthDate: new Date('2007-03-15'),
        joinedAt: new Date('2025-10-01'),
      },
    });
    await prisma.teamAssignment.create({
      data: { scoutProfileId: profile.id, teamId: team.id, startedAt: new Date('2025-10-01') },
    });
    const { holder } = await record(me.get());
    expect(holder).toEqual({
      firstName: 'Prénom',
      lastName: 'Routier',
      birthDate: '2007-03-15',
      matricule: '0000901A',
      team: 'Équipe fictive',
    });
  });

  it('isole les fiches : personne ne lit celle d’autrui, aucune route par identifiant', async () => {
    const owner = await loginAs('ROUTIER');
    await record(owner.put({ expectedRevision: null, data: data() }));
    const row = await prisma.medicalRecord.findUniqueOrThrow({ where: { userId: owner.user.id } });

    for (const persona of ['ROUTIER', 'CHEF', 'RESPONSABLE'] as const) {
      const other = await loginAs(persona);
      const seen = await record(other.get());
      expect(seen.record, persona).toBeNull();
      expect(JSON.stringify(seen)).not.toContain(SECRET_TEXT);
      for (const suffix of [`/${row.id}`, `/${owner.user.id}`, `/${owner.user.id}/pdf`]) {
        await other.get(suffix).expect(404);
      }
      // Écrire « par-dessus » ne touche que sa propre fiche.
      await record(other.put({ expectedRevision: null, data: data('autre') }));
    }
    expect(
      (await prisma.medicalRecord.findUniqueOrThrow({ where: { userId: owner.user.id } })).revision,
    ).toBe(1);
    expect((await record(owner.get())).record?.data.allergies).toBe(SECRET_TEXT);
  });

  it('compte administrateur (technique, D142) : aucune fiche, aucun accès à celle d’autrui', async () => {
    const owner = await loginAs('ROUTIER');
    await record(owner.put({ expectedRevision: null, data: data() }));
    const admin = await loginAs('ADMINISTRATEUR');
    expect(await code(admin.get(), 403)).toBe('FORBIDDEN');
    expect(await code(admin.put({ expectedRevision: null, data: data() }), 403)).toBe('FORBIDDEN');
    expect(await code(admin.get('/pdf'), 403)).toBe('FORBIDDEN');
    expect(await code(admin.delete({ expectedRevision: 1 }), 403)).toBe('FORBIDDEN');
    await admin.get(`/${owner.user.id}`).expect(404);
    expect(await prisma.medicalRecord.count()).toBe(1);
  });

  it('refuse l’accès sans session et une écriture sans en-tête CSRF', async () => {
    await request(app.getHttpServer()).get(path).expect(401);
    const me = await loginAs('ROUTIER');
    await request(app.getHttpServer()).put(path).set(CSRF_HEADER, '1').send({}).expect(401);
    // Le contrôle CSRF précède la session : écriture sans en-tête refusée (403).
    await request(app.getHttpServer()).put(path).send({}).expect(403);
    await me.put({ expectedRevision: null, data: { inconnu: 1 } }).expect(400);
  });

  it('conflits : révision dépassée, créations concurrentes, sans écrasement', async () => {
    const me = await loginAs('CHEF');
    const results = await Promise.all([
      me.put({ expectedRevision: null, data: data('A') }),
      me.put({ expectedRevision: null, data: data('B') }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await prisma.medicalRecord.count({ where: { userId: me.user.id } })).toBe(1);

    const first = await record(me.get());
    await record(me.put({ expectedRevision: 1, data: data('C') }));
    expect(await code(me.put({ expectedRevision: 1, data: data('D') }), 409)).toBe(
      'MEDICAL_RECORD_CHANGED',
    );
    expect((await record(me.get())).record?.data.allergies).toBe('C');
    expect(first.record?.revision).toBe(1);
  });

  it('chiffre en base et n’écrit aucune information médicale dans le journal d’audit', async () => {
    const me = await loginAs('ROUTIER');
    await record(me.put({ expectedRevision: null, data: data() }));
    await record(me.put({ expectedRevision: 1, data: data() }));
    await me.get('/pdf').expect(200);

    const [raw] = await prisma.$queryRaw<{ dump: string }[]>`
      SELECT row_to_json(m)::text AS dump FROM medical_records m WHERE user_id = ${me.user.id}::uuid`;
    expect(raw?.dump).not.toContain(SECRET_TEXT);
    expect(raw?.dump).not.toContain('Contact Fictif');
    expect(Buffer.from(raw!.dump).toString('base64')).not.toContain(
      Buffer.from(SECRET_TEXT).toString('base64'),
    );

    const logs = await prisma.auditLog.findMany({
      where: { entityType: 'MedicalRecord' },
      orderBy: { createdAt: 'asc' },
    });
    expect(logs.map((log) => log.action)).toEqual([
      'medical.created',
      'medical.updated',
      'medical.exported',
    ]);
    const dump = JSON.stringify(logs);
    for (const secret of [SECRET_TEXT, 'Contact Fictif', '07 11 22 33 44', 'soleil']) {
      expect(dump).not.toContain(secret);
    }
  });

  it('PDF : réservé au titulaire, A4, jamais mis en cache ; 404 tant que la fiche n’existe pas', async () => {
    const me = await loginAs('CHEF');
    expect(await code(me.get('/pdf'), 404)).toBe('MEDICAL_RECORD_NOT_FOUND');
    await record(me.put({ expectedRevision: null, data: data() }));
    const response = await me
      .get('/pdf')
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(response.headers['content-type']).toBe('application/pdf');
    expect(response.headers['cache-control']).toBe('no-store');
    const body = response.body as Buffer;
    expect(body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(body.toString('latin1')).toMatch(/\/MediaBox \[0 0 595\.28 841\.89\]/);
    expect((await me.get()).headers['cache-control']).toBe('no-store');
  });

  it('supprime la fiche à la demande du titulaire, sans copie conservée', async () => {
    const me = await loginAs('ROUTIER');
    await record(me.put({ expectedRevision: null, data: data() }));
    expect(await code(me.delete({ expectedRevision: 2 }), 409)).toBe('MEDICAL_RECORD_CHANGED');
    await me.delete({ expectedRevision: 1 }).expect(204);
    expect((await record(me.get())).record).toBeNull();
    expect(await prisma.medicalRecord.count()).toBe(0);
    expect(
      await prisma.auditLog.count({ where: { action: 'medical.deleted', actorId: me.user.id } }),
    ).toBe(1);
  });

  it('sans clé configurée : indisponible (503), jamais stocké en clair', async () => {
    const service = new MedicalRecordsService(
      prisma,
      validateEnv({ NODE_ENV: 'test', DATABASE_URL: testDatabaseUrl() }),
    );
    const actor = {
      userId: '0190f0c4-0000-7000-8000-000000000001',
      role: 'ROUTIER' as const,
      leaderFunction: null,
    };
    await expect(service.read(actor)).rejects.toMatchObject({ status: 503 });
    await expect(service.save(actor, { expectedRevision: null, data: {} })).rejects.toMatchObject({
      status: 503,
    });
  });
});

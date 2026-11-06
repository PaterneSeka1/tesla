import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  activityDetailSchema,
  apiErrorSchema,
  CSRF_HEADER,
  programmeImportHistorySchema,
  programmeImportReportSchema,
  programmeListSchema,
  scoutDetailSchema,
} from '@tesla/shared';
import request, { type Test as SupertestRequest } from 'supertest';
import { type App } from 'supertest/types.js';
import { type z } from 'zod';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { validateEnv } from '../src/config/env.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  birthDateIsoForStage,
  createTestPrisma,
  grantPersona,
  personaRole,
  resetDatabase,
  testDatabaseUrl,
  type TestPersona,
} from './int-database.js';
import {
  buildXlsx,
  PROGRAMME_HEADER,
  programmeRow,
  programmeWorkbook,
  type FixtureCell,
} from './xlsx-fixture.js';

// Import Excel du programme annuel de bout en bout (D172) : PostgreSQL réel, routes HTTP
// authentifiées, classeurs synthétiques et données exclusivement fictives.
const PASSWORD = 'mot-de-passe-fictif-de-test';
const daysFromToday = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

async function json<T>(req: SupertestRequest, status: number, schema: z.ZodType<T>): Promise<T> {
  const response = await req.expect(status);
  return schema.parse(response.body);
}

async function errorCode(req: SupertestRequest, status: number): Promise<string> {
  return (await json(req, status, apiErrorSchema)).code;
}

const file = (buffer: Buffer, extra: object = {}) => ({
  fileName: 'programme-fictif.xlsx',
  fileBase64: buffer.toString('base64'),
  ...extra,
});

describe('Import Excel du programme annuel (intégration PostgreSQL)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordHash: string;
  let counter = 0;
  let programmeId: string;

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
    programmeId = (await prisma.programme.findFirstOrThrow()).id;
  });

  async function loginAs(role: TestPersona) {
    counter += 1;
    const user = await prisma.user.create({
      data: {
        email: `import${counter}@example.test`,
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
    const write = (method: 'post' | 'patch' | 'put', path: string, body: object = {}) =>
      agent[method](`/api/v1${path}`).set(CSRF_HEADER, '1').send(body);
    return {
      user,
      get: (path: string) => agent.get(`/api/v1${path}`),
      post: (path: string, body?: object) => write('post', path, body),
      patch: (path: string, body: object) => write('patch', path, body),
      put: (path: string, body: object) => write('put', path, body),
    };
  }
  type Client = Awaited<ReturnType<typeof loginAs>>;

  const preview = (client: Client, body: object) =>
    json(
      client.post(`/programmes/${programmeId}/import/excel/preview`, body),
      201,
      programmeImportReportSchema,
    );

  /** Prévisualise puis confirme avec l'empreinte obtenue. */
  async function importWorkbook(client: Client, buffer: Buffer, extra: object = {}) {
    const report = await preview(client, file(buffer, extra));
    return json(
      client.post(`/programmes/${programmeId}/import/excel`, {
        ...file(buffer, extra),
        fingerprint: report.fingerprint,
      }),
      201,
      programmeImportReportSchema,
    );
  }

  const sessions = () =>
    prisma.activity.findMany({
      where: { programmeId },
      include: { categories: true, _count: { select: { attendances: true } } },
      orderBy: { plannedOn: 'asc' },
    });

  it('analyse sans écrire, importe les quatre contenus puis réimporte sans doublon', async () => {
    const responsable = await loginAs('RESPONSABLE');
    const chef = await loginAs('CHEF');
    const routier = await loginAs('ROUTIER');
    const workbook = buildXlsx([
      {
        name: 'Programme annuel',
        rows: [
          ['PROGRAMME FICTIF'],
          [],
          PROGRAMME_HEADER,
          programmeRow(1, daysFromToday(-14), 'Reprise fictive', {
            status: 'Tenue',
            notes: 'Déroulé à renseigner',
          }),
          programmeRow(2, daysFromToday(-7), 'Accueil fictif'),
          programmeRow(3, daysFromToday(7), 'Atelier fictif'),
          [],
          ['NOTE  |  Texte fictif.'],
        ],
        merges: ['A1:K1', 'A8:N8'],
        comments: [{ ref: 'B4', text: 'Date fictive à confirmer' }],
      },
    ]);
    const path = `/programmes/${programmeId}/import/excel`;

    await chef.post(`${path}/preview`, file(workbook)).expect(403);
    await routier.post(`${path}/preview`, file(workbook)).expect(403);
    await chef.post(path, file(workbook)).expect(403);

    const report = await preview(responsable, file(workbook));
    expect(report).toMatchObject({
      applied: false,
      importId: null,
      source: { format: 'XLSX', sheet: 'Programme annuel', headerLine: 3, dataRows: 3 },
      counts: { CREER: 3, ERREUR: 0, A_DECIDER: 0 },
    });
    expect(report.columns.every((column) => column.field !== null && column.auto)).toBe(true);
    expect(report.issues.filter((i) => i.severity === 'ERREUR')).toEqual([]);
    expect(report.issues.some((i) => i.line === 8 && i.message.includes('NOTE'))).toBe(true);
    expect(report.rows[0]!.planned).toMatchObject({
      sourceStatusRecognized: 'REALISEE',
      categories: [
        { code: 'NOVICES', content: 'Contenu novices 1' },
        { code: 'ASPIRANTS', content: 'Contenu aspirants 1' },
        { code: 'COMPAGNONS', content: 'Contenu compagnons 1' },
        { code: 'CONFIRMES', content: 'Contenu confirmés 1' },
      ],
    });
    expect(report.rows[0]!.messages.join(' ')).toContain('créée « Planifiée »');
    expect(await prisma.activity.count()).toBe(0);
    expect(await prisma.programmeImport.count()).toBe(0);

    // La confirmation exige l'empreinte de la prévisualisation examinée.
    expect(await errorCode(responsable.post(path, file(workbook)), 422)).toBe(
      'IMPORT_PREVIEW_REQUIRED',
    );
    const applied = await json(
      responsable.post(path, { ...file(workbook), fingerprint: report.fingerprint }),
      201,
      programmeImportReportSchema,
    );
    expect(applied).toMatchObject({ applied: true, counts: { CREER: 3 } });
    expect(applied.importId).not.toBeNull();

    const created = await sessions();
    expect(created).toHaveLength(3);
    // Statut du fichier conservé comme information : aucune réalisation ni présence déduite.
    expect(created.map((s) => s.status)).toEqual(['PLANIFIEE', 'PLANIFIEE', 'PLANIFIEE']);
    expect(created[0]).toMatchObject({
      sourceStatus: 'Tenue',
      plannedFormat: 'Atelier',
      theme: 'Axe fictif',
      leaderLabel: null,
      sourceAttendanceCount: null,
      sourceNumber: 1,
      heldOn: null,
      planningNotes:
        'Déroulé à renseigner\nCommentaire (Date du samedi) : Date fictive à confirmer',
    });
    expect(created.every((s) => s.categories.length === 4 && s._count.attendances === 0)).toBe(
      true,
    );
    expect(await prisma.activityAttendance.count()).toBe(0);

    const detail = await json(chef.get(`/activities/${created[0]!.id}`), 200, activityDetailSchema);
    expect(detail).toMatchObject({
      imported: true,
      plannedFormat: 'Atelier',
      initialPlannedOn: daysFromToday(-14),
      categoryContents: [
        { label: 'Novices Routiers', content: 'Contenu novices 1' },
        { label: 'Aspirants Routiers', content: 'Contenu aspirants 1' },
        { label: 'Compagnons Routiers', content: 'Contenu compagnons 1' },
        { label: 'Routiers Confirmés', content: 'Contenu confirmés 1' },
      ],
    });
    expect(detail.events[0]).toMatchObject({ action: 'IMPORTEE' });
    expect(detail.events[0]!.comment).toContain('ligne 4 de « Programme annuel »');
    // Une séance commune compte pour une activité, pas quatre.
    const programmes = await json(chef.get('/programmes'), 200, programmeListSchema);
    expect(programmes.items[0]).toMatchObject({ activityCount: 3, realisedCount: 0 });

    // Deuxième import identique : aucun doublon, aucune écriture de séance.
    const again = await importWorkbook(responsable, workbook);
    expect(again.counts).toMatchObject({ CREER: 0, INCHANGEE: 3, METTRE_A_JOUR: 0 });
    expect(await prisma.activity.count()).toBe(3);
    expect(await prisma.activityEvent.count()).toBe(3);
    const history = await json(
      chef.get(`/programmes/${programmeId}/imports`),
      200,
      programmeImportHistorySchema,
    );
    expect(history.items).toHaveLength(2);
    expect(history.items[0]).toMatchObject({
      format: 'XLSX',
      fileName: 'programme-fictif.xlsx',
      sheet: 'Programme annuel',
      counts: { INCHANGEE: 3 },
    });
    expect(history.items[0]!.fileSha256).toMatch(/^[a-f0-9]{64}$/);
    // Historique en ajout seul.
    await expect(prisma.programmeImport.deleteMany()).rejects.toThrow();
  });

  it('réimport révisé : rapprochement décidé, réalisations et présences protégées', async () => {
    const responsable = await loginAs('RESPONSABLE');
    const chef = await loginAs('CHEF');
    const [a, b, c, d] = [-14, -7, 7, 14].map(daysFromToday);
    await importWorkbook(
      responsable,
      programmeWorkbook([
        programmeRow(1, a!, 'Séance A'),
        programmeRow(2, b!, 'Séance B'),
        programmeRow(3, c!, 'Séance C'),
        programmeRow(4, d!, 'Séance D'),
      ]),
    );
    const [sa, sb, sc, sd] = await sessions();

    // A réalisée avec compte rendu ; B avec une présence nominative.
    const realised = await json(
      chef.post(`/activities/${sa!.id}/status`, { status: 'REALISEE', revision: 1, heldOn: a }),
      201,
      activityDetailSchema,
    );
    await chef
      .patch(`/activities/${sa!.id}`, {
        revision: realised.revision,
        report: 'Compte rendu fictif',
        heldByLabel: 'Chef fictif',
        outcomes: 'Objectif fictif atteint',
      })
      .expect(200);
    const scout = await json(
      responsable.post('/scouts', {
        firstName: 'Routier',
        lastName: 'Fictif',
        joinedAt: '2026-10-01',
        birthDate: await birthDateIsoForStage(prisma, 'NOVICIAT'),
      }),
      201,
      scoutDetailSchema,
    );
    await chef
      .put(`/activities/${sb!.id}/attendance`, {
        entries: [{ scoutProfileId: scout.id, status: 'PRESENT' }],
      })
      .expect(200);

    const revised = programmeWorkbook([
      programmeRow(1, a!, 'Séance A', { theme: 'Axe révisé' }),
      programmeRow(2, daysFromToday(-6), 'Séance B'),
      programmeRow(3, c!, 'Séance C révisée'),
      programmeRow(5, daysFromToday(21), 'Séance E'),
    ]);
    const first = await preview(responsable, file(revised));
    expect(first.counts).toMatchObject({ CONSERVEE_MANUELLE: 1, A_DECIDER: 2, CREER: 1 });
    expect(first.absent.map((s) => s.id)).toEqual([sd!.id]);
    const rowB = first.rows.find((r) => r.title === 'Séance B')!;
    const rowC = first.rows.find((r) => r.title === 'Séance C révisée')!;
    expect(rowB.candidates.map((s) => s.id)).toEqual([sb!.id]);
    expect(rowC.candidates.map((s) => s.id)).toEqual([sc!.id]);
    const rowA = first.rows.find((r) => r.title === 'Séance A')!;
    expect(rowA.protection).toEqual(
      expect.arrayContaining(['statut « Réalisée »', 'compte rendu renseigné']),
    );
    expect(rowA.changes).toEqual([
      { field: 'theme', label: 'Axe / thème', from: 'Axe fictif', to: 'Axe révisé' },
    ]);
    // Rapprochements non tranchés : confirmation refusée.
    expect(
      await errorCode(
        responsable.post(`/programmes/${programmeId}/import/excel`, {
          ...file(revised),
          fingerprint: first.fingerprint,
        }),
        422,
      ),
    ).toBe('IMPORT_DECISIONS_REQUIRED');

    const decisions = [
      { line: rowB.line, action: 'METTRE_A_JOUR', activityId: sb!.id },
      { line: rowC.line, action: 'METTRE_A_JOUR', activityId: sc!.id },
    ];
    const applied = await importWorkbook(responsable, revised, { decisions });
    expect(applied.counts).toMatchObject({
      CONSERVEE_MANUELLE: 2,
      METTRE_A_JOUR: 1,
      CREER: 1,
      A_DECIDER: 0,
    });
    expect(applied.absent.map((s) => s.title)).toEqual(['Séance D']);

    const after = await prisma.activity.findMany({
      include: { _count: { select: { attendances: true } } },
    });
    const byId = new Map(after.map((s) => [s.id, s]));
    expect(after).toHaveLength(5);
    // A : réalisation intacte, planification non réécrite.
    expect(byId.get(sa!.id)).toMatchObject({
      status: 'REALISEE',
      theme: 'Axe fictif',
      report: 'Compte rendu fictif',
      heldByLabel: 'Chef fictif',
      outcomes: 'Objectif fictif atteint',
    });
    // B : présences et date conservées ; seul le rattachement est enregistré.
    expect(byId.get(sb!.id)!._count.attendances).toBe(1);
    expect(byId.get(sb!.id)!.plannedOn.toISOString().slice(0, 10)).toBe(b);
    // C : intitulé corrigé, même séance (aucun doublon).
    expect(byId.get(sc!.id)!.title).toBe('Séance C révisée');
    // D : absente du fichier, jamais supprimée.
    expect(byId.get(sd!.id)!.status).toBe('PLANIFIEE');
    const importEvents = await prisma.activityEvent.findMany({
      where: { activityId: sc!.id, action: 'IMPORTEE' },
      orderBy: { createdAt: 'asc' },
    });
    expect(importEvents[1]!.changes).toMatchObject({ fields: ['Intitulé'] });
    const record = await prisma.programmeImport.findFirstOrThrow({
      where: { id: applied.importId! },
    });
    expect(record.decisions).toEqual(decisions);

    // Réimport du fichier révisé : tout est rapproché exactement, plus aucune décision.
    const third = await importWorkbook(responsable, revised);
    expect(third.counts).toMatchObject({ A_DECIDER: 0, CREER: 0, METTRE_A_JOUR: 0 });
    expect(await prisma.activity.count()).toBe(5);

    // Une décision « Créer » est honorée ; « Ignorer » n'écrit rien.
    const moved = programmeWorkbook([programmeRow(4, daysFromToday(15), 'Séance D')]);
    const p = await preview(responsable, file(moved));
    expect(p.counts.A_DECIDER).toBe(1);
    const ignored = await importWorkbook(responsable, moved, {
      decisions: [{ line: p.rows[0]!.line, action: 'IGNORER' }],
    });
    expect(ignored.counts.IGNOREE).toBe(1);
    expect(await prisma.activity.count()).toBe(5);
    const createdAnyway = await importWorkbook(responsable, moved, {
      decisions: [{ line: p.rows[0]!.line, action: 'CREER' }],
    });
    expect(createdAnyway.counts.CREER).toBe(1);
    expect(await prisma.activity.count()).toBe(6);
  });

  it('refuse une prévisualisation périmée et sérialise les imports concurrents', async () => {
    const responsable = await loginAs('RESPONSABLE');
    const workbook = programmeWorkbook([
      programmeRow(1, daysFromToday(7), 'Séance A'),
      programmeRow(2, daysFromToday(14), 'Séance B'),
    ]);
    const report = await preview(responsable, file(workbook));
    const body = { ...file(workbook), fingerprint: report.fingerprint };
    const path = `/programmes/${programmeId}/import/excel`;
    const results = await Promise.all([responsable.post(path, body), responsable.post(path, body)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(apiErrorSchema.parse(results.find((r) => r.status === 409)!.body).code).toBe(
      'IMPORT_PREVIEW_STALE',
    );
    expect(await prisma.activity.count()).toBe(2);

    // Modification entre la prévisualisation et la confirmation.
    const next = await preview(
      responsable,
      file(
        programmeWorkbook([programmeRow(1, daysFromToday(7), 'Séance A', { format: 'Sortie' })]),
      ),
    );
    const session = await prisma.activity.findFirstOrThrow({ where: { title: 'Séance A' } });
    const chef = await loginAs('CHEF');
    await chef
      .patch(`/activities/${session.id}`, { revision: session.revision, plannedLocation: 'Lieu' })
      .expect(200);
    expect(
      await errorCode(
        responsable.post(path, {
          ...file(
            programmeWorkbook([
              programmeRow(1, daysFromToday(7), 'Séance A', { format: 'Sortie' }),
            ]),
          ),
          fingerprint: next.fingerprint,
        }),
        409,
      ),
    ).toBe('IMPORT_PREVIEW_STALE');
  });

  it('signale fichiers invalides, colonnes inconnues et feuilles multiples', async () => {
    const responsable = await loginAs('RESPONSABLE');
    const path = `/programmes/${programmeId}/import/excel`;
    expect(
      await errorCode(
        responsable.post(`${path}/preview`, file(Buffer.from('pas un classeur'))),
        422,
      ),
    ).toBe('IMPORT_FILE_INVALID');
    await responsable
      .post(`${path}/preview`, { fileName: 'programme.xls', fileBase64: 'AAAA' })
      .expect(400);
    // Corps au-delà de la limite propre à l'import Excel.
    await responsable
      .post(`${path}/preview`, { fileName: 'a.xlsx', fileBase64: 'A'.repeat(3_300_000) })
      .expect(413);
    // Les autres routes gardent la limite par défaut.
    await responsable
      .post(`/programmes/${programmeId}/import/preview`, { content: 'x'.repeat(150_000) })
      .expect(413);

    const header = [...PROGRAMME_HEADER, 'Budget'];
    const row = (cells: FixtureCell[]) => [...cells, '1 000 FCFA'];
    const extra = buildXlsx([
      { name: 'Notes', rows: [['Brouillon']] },
      {
        name: 'Programme',
        rows: [
          header,
          row(programmeRow(1, daysFromToday(7), 'Séance A')),
          row(['', 'pas une date', null, null, 'Séance B']),
        ],
      },
    ]);
    const first = await preview(responsable, file(extra));
    expect(first.source.sheets.map((s) => s.name)).toEqual(['Notes', 'Programme']);
    expect(first.source.sheet).toBe('Notes');
    expect(first.issues[0]?.message).toContain('Ligne d’en-tête introuvable');

    const report = await preview(responsable, file(extra, { sheet: 'Programme' }));
    expect(report.columns.at(-1)).toMatchObject({ key: 'O', header: 'Budget', field: null });
    expect(report.issues.filter((i) => i.severity === 'ERREUR')).toEqual([
      expect.objectContaining({ column: 'O' }),
      expect.objectContaining({ line: 3, column: 'B' }),
    ]);
    expect(
      await errorCode(
        responsable.post(path, {
          ...file(extra, { sheet: 'Programme' }),
          fingerprint: report.fingerprint,
        }),
        422,
      ),
    ).toBe('IMPORT_HAS_ERRORS');
    expect(await prisma.activity.count()).toBe(0);
    const mapped = await preview(
      responsable,
      file(extra, { sheet: 'Programme', mapping: { O: 'ignore' }, headerRow: 1 }),
    );
    expect(mapped.issues.filter((i) => i.severity === 'ERREUR')).toHaveLength(1);
    expect(mapped.counts).toMatchObject({ CREER: 1, ERREUR: 1 });
  });

  it('création volontaire des programmes, période contrôlée, Markdown sans effacement', async () => {
    const responsable = await loginAs('RESPONSABLE');
    const chef = await loginAs('CHEF');
    const input = {
      code: '2027-2028',
      title: 'Programme fictif 2027–2028',
      startsOn: '2027-09-01',
      endsOn: '2028-08-31',
    };
    await chef.post('/programmes', input).expect(403);
    const list = await json(responsable.post('/programmes', input), 201, programmeListSchema);
    expect(list.items.map((p) => p.code)).toEqual(['2027-2028', '2026-2027']);
    expect(await errorCode(responsable.post('/programmes', input), 409)).toBe(
      'PROGRAMME_CODE_TAKEN',
    );
    expect(
      await errorCode(
        responsable.patch(`/programmes/${programmeId}`, {
          startsOn: '2026-09-01',
          endsOn: '2027-09-30',
        }),
        409,
      ),
    ).toBe('PROGRAMME_PERIOD_OVERLAP');
    await responsable
      .patch(`/programmes/${programmeId}`, { startsOn: '2026-09-01', endsOn: '2027-08-31' })
      .expect(200);

    const outside = await preview(
      responsable,
      file(programmeWorkbook([programmeRow(1, '2027-10-02', 'Séance hors période')])),
    );
    expect(outside.rows[0]!.messages.join(' ')).toContain('en dehors de la période');

    // Un import Markdown ultérieur ne vide ni le format ni les contenus par catégorie.
    const date = daysFromToday(7);
    await importWorkbook(responsable, programmeWorkbook([programmeRow(1, date, 'Séance A')]));
    const markdown = [
      '| Date | Activité | Thème |',
      '| --- | --- | --- |',
      `| ${date} | Séance A | Thème Markdown |`,
    ].join('\n');
    const md = await json(
      responsable.post(`/programmes/${programmeId}/import`, { content: markdown }),
      201,
      programmeImportReportSchema,
    );
    expect(md.counts.METTRE_A_JOUR).toBe(1);
    const session = await prisma.activity.findFirstOrThrow({
      where: { title: 'Séance A' },
      include: { categories: true },
    });
    expect(session).toMatchObject({ theme: 'Thème Markdown', plannedFormat: 'Atelier' });
    expect(session.categories.filter((c) => c.plannedContent)).toHaveLength(4);

    // Fiche : saisie du réalisé, contenus conservés quand on change les catégories.
    const novices = await prisma.programmeCategory.findUniqueOrThrow({
      where: { code: 'NOVICES' },
    });
    const updated = await json(
      chef.patch(`/activities/${session.id}`, {
        revision: session.revision,
        heldByLabel: 'Chef fictif',
        followUp: 'Suite fictive',
        categoryIds: session.categories.map((c) => c.categoryId).filter((id) => id !== novices.id),
      }),
      200,
      activityDetailSchema,
    );
    expect(updated).toMatchObject({ heldByLabel: 'Chef fictif', followUp: 'Suite fictive' });
    expect(updated.categoryContents).toHaveLength(3);
    expect(updated.categoryContents.every((c) => c.content)).toBe(true);
    // Report : date initiale conservée et changement visible dans l'historique.
    const postponed = await json(
      chef.post(`/activities/${session.id}/status`, {
        status: 'REPORTEE',
        revision: updated.revision,
        postponedTo: daysFromToday(14),
        reason: 'Motif fictif',
      }),
      201,
      activityDetailSchema,
    );
    expect(postponed.initialPlannedOn).toBe(date);
    expect(postponed.events[0]!.plannedOnChange).toEqual({ from: date, to: daysFromToday(14) });
  });
});

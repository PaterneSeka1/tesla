import { inflateSync } from 'node:zlib';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  apiErrorSchema,
  attemptSessionSchema,
  availableEvaluationSchema,
  correctionDetailSchema,
  correctionListItemSchema,
  CSRF_HEADER,
  type EditorEvaluationDetail,
  editorEvaluationDetailSchema,
  evaluationReviewSchema,
  evaluationSubmissionListSchema,
  myAttemptSchema,
  paginatedSchema,
  waiverSchema,
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

// Phase 3 de bout en bout (HTTP) : rédaction et approbation des questionnaires, passation en ligne,
// tentatives papier (codes, PDF), correction, examen, dérogations. Données exclusivement fictives.
const PASSWORD = 'mot-de-passe-fictif-de-test';
const SECRET_ANSWER = 'Lord Baden-Powell';

async function json<T>(req: SupertestRequest, status: number, schema: z.ZodType<T>): Promise<T> {
  const response = await req.expect(status);
  return schema.parse(response.body);
}

async function errorCode(req: SupertestRequest, status: number): Promise<string> {
  return (await json(req, status, apiErrorSchema)).code;
}

/** Texte affiché d'un PDF pdfkit : flux décompressés, chaînes hexadécimales des opérateurs TJ. */
function pdfText(buffer: Buffer): string {
  const raw = buffer.toString('latin1');
  let text = '';
  for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let content: string;
    try {
      content = inflateSync(Buffer.from(match[1]!, 'latin1')).toString('latin1');
    } catch {
      continue;
    }
    for (const array of content.matchAll(/\[([^\]]*)\]\s*TJ/g)) {
      for (const hex of array[1]!.matchAll(/<([0-9a-fA-F]*)>/g)) {
        text += Buffer.from(hex[1]!, 'hex').toString('latin1');
      }
      text += '\n';
    }
  }
  return text;
}

/** Lecture binaire d'une réponse (supertest ne bufferise pas application/pdf par défaut). */
function binary(
  response: request.Response,
  callback: (error: Error | null, body: Buffer) => void,
): void {
  const chunks: Buffer[] = [];
  const stream = response as unknown as NodeJS.ReadableStream;
  stream.on('data', (chunk: Buffer) => chunks.push(chunk));
  stream.on('end', () => callback(null, Buffer.concat(chunks)));
}

const evaluationList = paginatedSchema(availableEvaluationSchema);
const correctionList = paginatedSchema(correctionListItemSchema);
const myAttempts = paginatedSchema(myAttemptSchema);

describe('Évaluations (intégration HTTP, PostgreSQL)', () => {
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
    const rows = await prisma.progressionStage.findMany();
    stages = Object.fromEntries(rows.map((stage) => [stage.code, stage.id]));
  });

  async function loginAs(role: Role, stageCode = 'NOVICIAT') {
    counter += 1;
    const user = await prisma.user.create({
      data: {
        email: `evaluation${counter}@example.test`,
        firstName: 'Fictif',
        lastName: `${role} ${counter}`,
        role,
        passwordHash,
      },
    });
    const profile =
      role === 'ROUTIER'
        ? await prisma.scoutProfile.create({
            data: {
              userId: user.id,
              firstName: 'Routier',
              lastName: `Connecté ${counter}`,
              joinedAt: new Date('2026-10-01'),
              currentStageId: stages[stageCode]!,
            },
          })
        : null;
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/auth/login')
      .set(CSRF_HEADER, '1')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);
    const write = (method: 'post' | 'patch' | 'delete', path: string, body: object = {}) =>
      agent[method](`/api/v1${path}`).set(CSRF_HEADER, '1').send(body);
    return {
      user,
      profile,
      get: (path: string) => agent.get(`/api/v1${path}`),
      post: (path: string, body?: object) => write('post', path, body),
      patch: (path: string, body: object) => write('patch', path, body),
      del: (path: string) => write('delete', path),
    };
  }

  type Client = Awaited<ReturnType<typeof loginAs>>;

  const scoutWithoutAccount = (n: number, stageCode = 'NOVICIAT') =>
    prisma.scoutProfile.create({
      data: {
        firstName: 'Sans',
        lastName: `Compte ${n}`,
        joinedAt: new Date('2026-10-01'),
        currentStageId: stages[stageCode]!,
      },
    });

  /** Questionnaire mêlant les cinq types de questions (8 points au total). */
  async function draftEvaluation(
    chef: Client,
    extra: object = {},
  ): Promise<EditorEvaluationDetail> {
    let detail = await json(
      chef.post('/editor/evaluations', {
        title: 'Histoire du scoutisme (fictif)',
        instructions: 'Répondez seul, sans document.',
        stageId: stages.NOVICIAT,
        ...extra,
      }),
      201,
      editorEvaluationDetailSchema,
    );
    const add = async (question: object) => {
      detail = await json(
        chef.post(`/editor/evaluations/${detail.id}/questions`, {
          versionId: detail.current.id,
          ...question,
        }),
        201,
        editorEvaluationDetailSchema,
      );
    };
    await add({
      type: 'CHOIX_UNIQUE',
      prompt: 'Qui a fondé le scoutisme ?',
      points: 2,
      options: [
        { label: SECRET_ANSWER, isCorrect: true },
        { label: 'Jules Verne', isCorrect: false },
      ],
    });
    await add({
      type: 'CHOIX_MULTIPLE',
      prompt: 'Quelles sont des étapes de la Route ?',
      points: 2,
      scoringPolicy: 'CREDIT_PARTIEL',
      options: [
        { label: 'Noviciat', isCorrect: true },
        { label: 'Compagnonnage', isCorrect: true },
        { label: 'Louveteaux', isCorrect: false },
      ],
    });
    await add({
      type: 'VRAI_FAUX',
      prompt: 'Le Départ routier est la dernière étape.',
      points: 1,
      options: [
        { label: 'Vrai', isCorrect: true },
        { label: 'Faux', isCorrect: false },
      ],
    });
    await add({
      type: 'REPONSE_COURTE',
      prompt: 'Citez la devise.',
      points: 1,
      expectedAnswer: 'Servir',
    });
    await add({
      type: 'REPONSE_DEVELOPPEE',
      prompt: 'Que signifie servir pour vous ?',
      points: 2,
      guidance: 'Engagement personnel, exemple concret.',
    });
    return detail;
  }

  async function publish(chef: Client, responsable: Client, detail: EditorEvaluationDetail) {
    const submitted = await json(
      chef.post(`/editor/evaluations/${detail.id}/submit`, {
        versionId: detail.current.id,
        revision: detail.current.revision,
      }),
      201,
      editorEvaluationDetailSchema,
    );
    await responsable
      .post(`/admin/evaluations/${detail.id}/approve`, { versionId: submitted.current.id })
      .expect(204);
    await responsable
      .post(`/admin/evaluations/${detail.id}/publish`, { versionId: submitted.current.id })
      .expect(204);
    return json(chef.get(`/editor/evaluations/${detail.id}`), 200, editorEvaluationDetailSchema);
  }

  const optionId = (detail: EditorEvaluationDetail, question: number, label: string) =>
    detail.current.questions[question]!.options.find((option) => option.label === label)!.id;

  it('1–4. un chef rédige ; seul le responsable approuve et publie ; une version publiée est figée', async () => {
    const chef = await loginAs('CHEF');
    const responsable = await loginAs('RESPONSABLE');
    const draft = await draftEvaluation(chef);
    expect(draft.current).toMatchObject({ status: 'BROUILLON', questionCount: 5, totalPoints: 8 });
    expect(draft.code).toMatch(/^EVAL-\d{3,}$/);

    const submitted = await json(
      chef.post(`/editor/evaluations/${draft.id}/submit`, {
        versionId: draft.current.id,
        revision: draft.current.revision,
      }),
      201,
      editorEvaluationDetailSchema,
    );
    // Un chef ne peut ni consulter la file, ni approuver, ni publier.
    await chef.get('/admin/evaluations/submissions').expect(403);
    expect(
      await errorCode(
        chef.post(`/admin/evaluations/${draft.id}/approve`, { versionId: draft.current.id }),
        403,
      ),
    ).toBe('FORBIDDEN');
    await chef
      .post(`/admin/evaluations/${draft.id}/publish`, { versionId: draft.current.id })
      .expect(403);
    // Soumis : plus modifiable par le chef.
    expect(
      await errorCode(
        chef.patch(`/editor/evaluations/${draft.id}`, {
          versionId: draft.current.id,
          revision: submitted.current.revision,
          title: 'Modification silencieuse',
        }),
        409,
      ),
    ).toBe('VERSION_NOT_EDITABLE');

    const queue = await json(
      responsable.get('/admin/evaluations/submissions'),
      200,
      evaluationSubmissionListSchema,
    );
    expect(queue.items.map((item) => item.evaluationId)).toEqual([draft.id]);
    const review = await json(
      responsable.get(`/admin/evaluations/${draft.id}/review`),
      200,
      evaluationReviewSchema,
    );
    expect(review.evaluation.current.questions[0]!.options[0]!.isCorrect).toBe(true);

    // Publication impossible avant approbation, puis approbation et publication.
    expect(
      await errorCode(
        responsable.post(`/admin/evaluations/${draft.id}/publish`, { versionId: draft.current.id }),
        409,
      ),
    ).toBe('VERSION_NOT_APPROVED');
    await responsable
      .post(`/admin/evaluations/${draft.id}/approve`, { versionId: draft.current.id })
      .expect(204);
    await responsable
      .post(`/admin/evaluations/${draft.id}/publish`, { versionId: draft.current.id })
      .expect(204);
    const published = await json(
      chef.get(`/editor/evaluations/${draft.id}`),
      200,
      editorEvaluationDetailSchema,
    );
    expect(published.published?.status).toBe('PUBLIE');
    expect(published.settingsEditable).toBe(false);

    // 4. Aucune modification directe d'une version publiée (API puis base).
    await chef
      .post(`/editor/evaluations/${draft.id}/questions`, {
        versionId: draft.current.id,
        type: 'REPONSE_COURTE',
        prompt: 'Ajout silencieux',
        points: 1,
      })
      .expect(409);
    await expect(
      prisma.evaluationVersion.update({
        where: { id: draft.current.id },
        data: { title: 'Modifié en base' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.evaluationQuestion.update({
        where: { id: draft.current.questions[0]!.id },
        data: { prompt: 'Modifié en base' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.evaluationAnswerOption.updateMany({
        where: { questionId: draft.current.questions[0]!.id },
        data: { isCorrect: false },
      }),
    ).rejects.toThrow();
    expect(await prisma.auditLog.count({ where: { action: { startsWith: 'evaluation.' } } })).toBe(
      2,
    );
  });

  it('cohérence module ↔ évaluation : publication refusée tant que le module évalué n’est pas publié', async () => {
    const chef = await loginAs('CHEF');
    const responsable = await loginAs('RESPONSABLE');
    const module = await prisma.pedagogicalModule.create({
      data: {
        slug: 'module-fictif',
        createdById: chef.user.id,
        versions: { create: { version: 1, title: 'Module fictif', createdById: chef.user.id } },
      },
    });
    const draft = await draftEvaluation(chef, { moduleId: module.id });
    expect(draft.module?.published).toBe(false);
    await chef
      .post(`/editor/evaluations/${draft.id}/submit`, {
        versionId: draft.current.id,
        revision: draft.current.revision,
      })
      .expect(201);
    await responsable
      .post(`/admin/evaluations/${draft.id}/approve`, { versionId: draft.current.id })
      .expect(204);
    expect(
      await errorCode(
        responsable.post(`/admin/evaluations/${draft.id}/publish`, { versionId: draft.current.id }),
        409,
      ),
    ).toBe('MODULE_NOT_PUBLISHED');
  });

  it('parcours numérique complet, 5–8 éligibilité et dérogations, 14 double remise, 17–18 examen sans changement d’étape', async () => {
    const chef = await loginAs('CHEF');
    const responsable = await loginAs('RESPONSABLE');
    const routier = await loginAs('ROUTIER');
    const outsider = await loginAs('ROUTIER', 'APPRENTISSAGE');
    const evaluation = await publish(chef, responsable, await draftEvaluation(chef));

    // 5. Le routier voit l'évaluation et son éligibilité, sans corrigé.
    const list = await json(routier.get('/evaluations'), 200, evaluationList);
    expect(list.items[0]).toMatchObject({ id: evaluation.id, questionCount: 5 });
    expect(list.items[0]!.eligibility).toMatchObject({ status: 'ELIGIBLE', allowed: true });

    // 6. Hors étape : refus côté serveur.
    const outsiderList = await json(outsider.get('/evaluations'), 200, evaluationList);
    expect(outsiderList.items[0]!.eligibility?.status).toBe('ETAPE_NON_CORRESPONDANTE');
    expect(await errorCode(outsider.post(`/evaluations/${evaluation.id}/attempts`), 403)).toBe(
      'EVALUATION_NOT_ELIGIBLE',
    );

    // 7. Dérogation du responsable (jamais d'un chef) ; 8. révoquée, elle ne permet plus le passage.
    const grant = {
      scoutProfileId: outsider.profile!.id,
      evaluationId: evaluation.id,
      reason: 'Retour de stage',
    };
    await chef.post('/admin/waivers', grant).expect(403);
    const { id: waiverId } = (await responsable.post('/admin/waivers', grant).expect(201)).body as {
      id: string;
    };
    const waived = await json(
      outsider.post(`/evaluations/${evaluation.id}/attempts`),
      200,
      attemptSessionSchema,
    );
    expect(waived.status).toBe('EN_COURS');
    await outsider.post(`/attempts/${waived.id}/submit`).expect(200);
    await responsable
      .post(`/admin/waivers/${waiverId}/revoke`, { reason: 'Fin de la dérogation' })
      .expect(200);
    const waiverList = await json(
      responsable.get('/admin/waivers?status=all'),
      200,
      paginatedSchema(waiverSchema),
    );
    expect(waiverList.items[0]).toMatchObject({ active: false, attemptCount: 1 });
    // Tentative précédente clôturée par annulation pour vérifier la seule condition d'étape.
    const outsiderAttempt = await prisma.evaluationAttempt.findUniqueOrThrow({
      where: { id: waived.id },
    });
    await chef
      .post(`/corrections/${outsiderAttempt.code}/cancel`, { reason: 'Test de révocation' })
      .expect(200);
    expect(await errorCode(outsider.post(`/evaluations/${evaluation.id}/attempts`), 403)).toBe(
      'EVALUATION_NOT_ELIGIBLE',
    );

    // Passation : démarrage idempotent (double clic), questions sans corrigé.
    const [first, second] = await Promise.all([
      routier.post(`/evaluations/${evaluation.id}/attempts`),
      routier.post(`/evaluations/${evaluation.id}/attempts`),
    ]);
    const session = attemptSessionSchema.parse(first.body);
    expect(attemptSessionSchema.parse(second.body).id).toBe(session.id);
    expect(JSON.stringify(first.body)).not.toMatch(/isCorrect|points|guidance|expectedAnswer/);
    expect(
      await prisma.evaluationAttempt.count({ where: { mode: 'EN_LIGNE', status: 'EN_COURS' } }),
    ).toBe(1);

    const q = session.questions;
    await json(
      routier.post(`/attempts/${session.id}/answers`, {
        answers: [
          { questionId: q[0]!.id, optionIds: [optionId(evaluation, 0, SECRET_ANSWER)] },
          { questionId: q[3]!.id, text: 'Servir' },
        ],
      }),
      200,
      attemptSessionSchema,
    );
    // Réponse invalide (proposition d'une autre question) refusée.
    await routier
      .post(`/attempts/${session.id}/answers`, {
        answers: [{ questionId: q[0]!.id, optionIds: [optionId(evaluation, 1, 'Noviciat')] }],
      })
      .expect(422);

    // 14. Remise définitive ; une remise concurrente ou répétée est refusée.
    const finalAnswers = {
      answers: [
        { questionId: q[1]!.id, optionIds: [optionId(evaluation, 1, 'Noviciat')] },
        { questionId: q[2]!.id, optionIds: [optionId(evaluation, 2, 'Vrai')] },
        { questionId: q[4]!.id, text: 'Rendre service à la communauté.' },
      ],
    };
    const submits = await Promise.all([
      routier.post(`/attempts/${session.id}/submit`, finalAnswers),
      routier.post(`/attempts/${session.id}/submit`, finalAnswers),
    ]);
    expect(submits.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      await errorCode(routier.post(`/attempts/${session.id}/answers`, finalAnswers), 409),
    ).toBe('ATTEMPT_ALREADY_SUBMITTED');

    // Questions objectives corrigées automatiquement : 2 + 1 (crédit partiel) + 1 = 4.
    const attempt = await prisma.evaluationAttempt.findUniqueOrThrow({ where: { id: session.id } });
    expect(attempt.status).toBe('A_CORRIGER');
    expect(Number(attempt.score)).toBe(4);

    // Correction humaine des réponses libres par un chef.
    const queue = await json(chef.get('/corrections?status=A_CORRIGER'), 200, correctionList);
    expect(queue.items.map((item) => item.code)).toContain(attempt.code);
    const copy = await json(chef.get(`/corrections/${attempt.code}`), 200, correctionDetailSchema);
    expect(copy.questions[4]!.answer?.text).toBe('Rendre service à la communauté.');
    await chef
      .post(`/corrections/${attempt.code}/answers`, {
        correctionRevision: copy.correctionRevision,
        answers: [{ questionId: q[3]!.id, text: 'Réécrite' }],
      })
      .expect(422);
    expect(
      await errorCode(
        chef.post(`/corrections/${attempt.code}/submit-review`, {
          correctionRevision: copy.correctionRevision,
        }),
        422,
      ),
    ).toBe('CORRECTION_INCOMPLETE');
    await chef
      .post(`/corrections/${attempt.code}/answers`, {
        correctionRevision: copy.correctionRevision,
        grades: [{ questionId: q[3]!.id, awardedPoints: 5 }],
      })
      .expect(422);
    const graded = await json(
      chef.post(`/corrections/${attempt.code}/answers`, {
        correctionRevision: copy.correctionRevision,
        grades: [
          { questionId: q[3]!.id, awardedPoints: 1, appreciation: 'Exact' },
          { questionId: q[4]!.id, awardedPoints: 1.5, comment: 'Développer un exemple.' },
        ],
        observations: 'Bonne participation.',
      }),
      200,
      correctionDetailSchema,
    );
    expect(graded).toMatchObject({ score: 6.5, maxScore: 8 });
    // Correction concurrente sur une révision périmée : refusée.
    expect(
      await errorCode(
        chef.post(`/corrections/${attempt.code}/answers`, {
          correctionRevision: copy.correctionRevision,
          grades: [],
        }),
        409,
      ),
    ).toBe('ATTEMPT_STATE_CHANGED');
    await json(
      chef.post(`/corrections/${attempt.code}/submit-review`, {
        correctionRevision: graded.correctionRevision,
      }),
      200,
      correctionDetailSchema,
    );

    // Avant examen : statut seul, sans résultat détaillé.
    const before = await json(routier.get('/me/attempts'), 200, myAttempts);
    expect(before.items[0]).toMatchObject({ status: 'SOUMISE', result: null });

    // 17. Examen par le responsable : demande de nouvelle correction motivée, puis acceptation.
    const pending = await json(
      responsable.get('/admin/attempts/pending-review'),
      200,
      correctionList,
    );
    expect(pending.items.map((item) => item.id)).toEqual([attempt.id]);
    await chef.post(`/admin/attempts/${attempt.id}/accept-review`, {}).expect(403);
    await responsable.post(`/admin/attempts/${attempt.id}/request-correction`, {}).expect(400);
    const back = await json(
      responsable.post(`/admin/attempts/${attempt.id}/request-correction`, {
        reason: 'Revoir la question 5.',
      }),
      200,
      correctionDetailSchema,
    );
    expect(back.status).toBe('A_CORRIGER');
    await chef
      .post(`/corrections/${attempt.code}/submit-review`, {
        correctionRevision: back.correctionRevision,
      })
      .expect(200);
    const accepted = await json(
      responsable.post(`/admin/attempts/${attempt.id}/accept-review`, {
        comment: 'Résultat cohérent.',
      }),
      200,
      correctionDetailSchema,
    );
    expect(accepted.status).toBe('VALIDEE');

    // 18. Aucun changement d'étape automatique.
    const profile = await prisma.scoutProfile.findUniqueOrThrow({
      where: { id: routier.profile!.id },
    });
    expect(profile.currentStageId).toBe(stages.NOVICIAT);

    // Le routier retrouve son résultat, sans les bonnes réponses.
    const after = await json(routier.get('/me/attempts'), 200, myAttempts);
    expect(after.items[0]!.result).toMatchObject({
      score: 6.5,
      maxScore: 8,
      comment: 'Résultat cohérent.',
    });
    expect(JSON.stringify(after)).not.toMatch(/isCorrect|expectedAnswer|guidance/);
  });

  it('parcours papier complet, 9–13 codes, réimpression, PDF et confidentialité du corrigé, 16 saisie, 15 et 20 versions', async () => {
    const chef = await loginAs('CHEF');
    const responsable = await loginAs('RESPONSABLE');
    const routier = await loginAs('ROUTIER');
    const evaluation = await publish(chef, responsable, await draftEvaluation(chef));
    const scout = await scoutWithoutAccount(1);

    // Éligibilité vérifiée avant création (vue chef pour un routier désigné).
    const eligible = await json(
      chef.get(`/evaluations?scoutProfileId=${scout.id}`),
      200,
      evaluationList,
    );
    expect(eligible.items[0]!.eligibility?.allowed).toBe(true);
    await routier
      .post('/paper-attempts', { scoutProfileId: scout.id, evaluationId: evaluation.id })
      .expect(403);

    // 9. Tentative papier pour un routier sans compte ; code émis par le serveur.
    const prepared = await json(
      chef.post('/paper-attempts', {
        scoutProfileId: scout.id,
        evaluationId: evaluation.id,
        plannedFor: '2027-01-09',
      }),
      201,
      correctionDetailSchema,
    );
    expect(prepared.scout.hasAccount).toBe(false);
    expect(prepared.code).toMatch(/^NT-\d{4}-\d{6}$/);
    await chef
      .post('/paper-attempts', { scoutProfileId: scout.id, evaluationId: evaluation.id })
      .expect(409);

    // 10. Codes uniques sous créations concurrentes.
    const others = await Promise.all(
      Array.from({ length: 8 }, (_, i) => scoutWithoutAccount(i + 10)),
    );
    const created = await Promise.all(
      others.map((other) =>
        chef.post('/paper-attempts', { scoutProfileId: other.id, evaluationId: evaluation.id }),
      ),
    );
    const codes = created.map((response) => correctionDetailSchema.parse(response.body).code);
    expect(new Set([...codes, prepared.code]).size).toBe(9);

    // 11. Réimpression : même code, aucune nouvelle tentative. 12. Questionnaire sans réponses.
    const count = await prisma.evaluationAttempt.count();
    const sheet = await chef
      .get(`/paper-attempts/${prepared.code}/pdf?document=questionnaire`)
      .buffer(true)
      .parse(binary)
      .expect(200);
    expect(sheet.headers['content-type']).toBe('application/pdf');
    const reprint = await chef
      .get(`/paper-attempts/${prepared.code.toLowerCase()}/pdf`)
      .buffer(true)
      .parse(binary)
      .expect(200);
    expect(await prisma.evaluationAttempt.count()).toBe(count);
    const sheetText = pdfText(sheet.body as Buffer);
    expect(sheetText).toContain(prepared.code);
    expect(sheetText).toContain('Qui a fondé le scoutisme ?');
    expect(sheetText).toContain('Sans');
    expect(sheetText).not.toContain('bonne réponse');
    expect(sheetText).not.toContain('Engagement personnel');
    expect(sheetText).not.toContain('Servir');
    expect(pdfText(reprint.body as Buffer)).toContain(prepared.code);

    const key = await chef
      .get(`/paper-attempts/${prepared.code}/pdf?document=corrige`)
      .buffer(true)
      .parse(binary)
      .expect(200);
    const keyText = pdfText(key.body as Buffer);
    expect(keyText).toContain('bonne réponse');
    expect(keyText).toContain('Engagement personnel');
    const grid = await chef
      .get(`/paper-attempts/${prepared.code}/pdf?document=grille`)
      .buffer(true)
      .parse(binary)
      .expect(200);
    expect(pdfText(grid.body as Buffer)).toContain('Nom du correcteur');

    // 13. Un routier n'accède ni au corrigé, ni à la grille, ni à la copie, même avec le code.
    for (const document of ['questionnaire', 'corrige', 'grille']) {
      await routier.get(`/paper-attempts/${prepared.code}/pdf?document=${document}`).expect(403);
    }
    await routier.get(`/corrections/${prepared.code}`).expect(403);
    await routier.get('/editor/evaluations').expect(403);

    // 16. Saisie et correction papier par un chef (transcription, notes, observations).
    const q = evaluation.current.questions;
    const saved = await json(
      chef.post(`/corrections/${prepared.code}/answers`, {
        correctionRevision: prepared.correctionRevision,
        completedAt: '2027-01-09T10:00:00.000Z',
        answers: [
          { questionId: q[0]!.id, optionIds: [optionId(evaluation, 0, SECRET_ANSWER)] },
          {
            questionId: q[1]!.id,
            optionIds: [
              optionId(evaluation, 1, 'Noviciat'),
              optionId(evaluation, 1, 'Compagnonnage'),
            ],
          },
          { questionId: q[2]!.id, optionIds: [optionId(evaluation, 2, 'Faux')] },
          { questionId: q[3]!.id, text: 'Servir' },
          { questionId: q[4]!.id, text: 'Aider les autres.' },
        ],
        grades: [
          { questionId: q[3]!.id, awardedPoints: 1 },
          { questionId: q[4]!.id, awardedPoints: 1, appreciation: 'À approfondir' },
        ],
        observations: 'Copie soignée.',
      }),
      200,
      correctionDetailSchema,
    );
    expect(saved).toMatchObject({ status: 'A_CORRIGER', score: 6, maxScore: 8 });
    expect(saved.questions[2]!.answer).toMatchObject({ awardedPoints: 0, autoScored: true });
    // Une fois saisie, la feuille n'est plus réimprimable comme questionnaire vierge.
    await chef.get(`/paper-attempts/${prepared.code}/pdf`).expect(409);
    await json(
      chef.post(`/corrections/${prepared.code}/submit-review`, {
        correctionRevision: saved.correctionRevision,
      }),
      200,
      correctionDetailSchema,
    );
    await responsable.post(`/admin/attempts/${prepared.id}/accept-review`, {}).expect(200);

    // 15 et 20. Nouvelle version publiée : l'ancienne copie reste liée à sa version et consultable.
    const v2 = await json(
      chef.post(`/editor/evaluations/${evaluation.id}/versions`),
      201,
      editorEvaluationDetailSchema,
    );
    expect(v2.current).toMatchObject({ version: 2, status: 'BROUILLON', questionCount: 5 });
    await json(
      chef.patch(`/editor/evaluations/${evaluation.id}`, {
        versionId: v2.current.id,
        revision: v2.current.revision,
        title: 'Histoire du scoutisme (version 2)',
      }),
      200,
      editorEvaluationDetailSchema,
    );
    await publish(
      chef,
      responsable,
      await json(
        chef.get(`/editor/evaluations/${evaluation.id}`),
        200,
        editorEvaluationDetailSchema,
      ),
    );
    const old = await json(chef.get(`/corrections/${prepared.code}`), 200, correctionDetailSchema);
    expect(old.version).toMatchObject({
      version: 1,
      isCurrent: false,
      title: 'Histoire du scoutisme (fictif)',
    });
    expect(old).toMatchObject({ status: 'VALIDEE', score: 6 });
    expect(old.questions[0]!.id).toBe(q[0]!.id);
    const versions = await prisma.evaluationVersion.findMany({
      where: { evaluationId: evaluation.id },
      orderBy: { version: 'asc' },
      select: { status: true },
    });
    expect(versions.map((v) => v.status)).toEqual(['ARCHIVE', 'PUBLIE']);

    // Une nouvelle préparation utilise la nouvelle version ; aucun changement d'étape.
    const next = await json(
      chef.post('/paper-attempts', { scoutProfileId: scout.id, evaluationId: evaluation.id }),
      201,
      correctionDetailSchema,
    );
    expect(next.version.version).toBe(2);
    expect(next.code).not.toBe(prepared.code);
    expect(
      (await prisma.scoutProfile.findUniqueOrThrow({ where: { id: scout.id } })).currentStageId,
    ).toBe(stages.NOVICIAT);
  });

  it('19. permissions appliquées côté serveur et rédaction réservée à l’auteur', async () => {
    const chef = await loginAs('CHEF');
    const otherChef = await loginAs('CHEF');
    const routier = await loginAs('ROUTIER');
    const draft = await draftEvaluation(chef);

    await otherChef.get(`/editor/evaluations/${draft.id}`).expect(404);
    await routier
      .post('/editor/evaluations', { title: 'Interdit', stageId: stages.NOVICIAT })
      .expect(403);
    await routier.get('/corrections').expect(403);
    await routier.get('/admin/attempts/pending-review').expect(403);
    await routier.get('/admin/waivers').expect(403);
    await chef.get('/admin/attempts/pending-review').expect(403);
    await chef.post(`/evaluations/${draft.id}/attempts`).expect(403);
    // Un brouillon n'est pas visible des routiers.
    await routier.get(`/evaluations/${draft.id}`).expect(404);
    // Sans session : 401. Sans en-tête anti-CSRF : écriture refusée.
    await request(app.getHttpServer()).get('/api/v1/evaluations').expect(401);
    await request(app.getHttpServer())
      .post(`/api/v1/editor/evaluations/${draft.id}/submit`)
      .send({})
      .expect((response) => expect([401, 403]).toContain(response.status));
    // Entrée invalide.
    await chef.post('/editor/evaluations', { title: 'x', stageId: 'pas-un-uuid' }).expect(400);
  });
});

/**
 * Fixture fictive de la recette navigateur du circuit papier collectif
 * (apps/web/test/paper-distribution.browser.mjs, D161–D164). Base « _test » uniquement
 * (TEST_DATABASE_URL), remise à zéro à chaque passage. Lancement depuis apps/api :
 *   TEST_DATABASE_URL=… npx tsx test/paper-browser-fixture.mts
 * Crée : un responsable plein, une assistante, un module publié et son questionnaire publié
 * (une question à choix, une réponse rédigée), deux routiers sans compte et un avec compte.
 */
import { hashPassword } from '../src/modules/auth/password.js';
import { createTestPrisma, grantPersona, resetDatabase } from './int-database.js';

const PASSWORD = 'phrase-fictive-recette-papier';
const db = createTestPrisma();
await resetDatabase(db);
const passwordHash = await hashPassword(PASSWORD);
const stage = await db.progressionStage.findFirstOrThrow({ orderBy: { position: 'asc' } });
const person = (email: string, lastName: string, role: 'ENCADREMENT' | 'ROUTIER') =>
  db.user.create({ data: { email, firstName: 'Fictif', lastName, role, passwordHash } });

const plein = await person('plein-papier@recette.test', 'Plein', 'ENCADREMENT');
await grantPersona(db, plein.id, 'RESPONSABLE');
const assistant = await person('assistant-papier@recette.test', 'Assistant', 'ENCADREMENT');
await db.leadershipAssignment.create({
  data: { userId: assistant.id, function: 'ASSISTANT', reason: 'Désignation fictive (recette)' },
});

const module = await db.pedagogicalModule.create({
  data: { slug: 'recette-papier', createdById: plein.id },
});
const version = await db.moduleVersion.create({
  data: {
    moduleId: module.id,
    version: 1,
    title: 'Recette papier',
    summary: 'Contenu fictif de recette.',
    createdById: plein.id,
  },
});
await db.moduleLesson.create({
  data: {
    createdById: plein.id,
    versionId: version.id,
    position: 1,
    title: 'Leçon fictive',
    content: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Texte fictif.' }] }],
    },
  },
});
for (const status of ['SOUMIS', 'APPROUVE', 'PUBLIE'] as const) {
  await db.moduleVersion.update({
    where: { id: version.id },
    data: { status, ...(status === 'PUBLIE' && { publishedAt: new Date() }) },
  });
}
await db.pedagogicalModule.update({
  where: { id: module.id },
  data: { publishedVersionId: version.id },
});

const evaluation = await db.evaluation.create({
  data: {
    title: 'Questionnaire fictif papier',
    stageId: stage.id,
    moduleId: module.id,
    createdById: plein.id,
  },
});
const evaluationVersion = await db.evaluationVersion.create({
  data: {
    evaluationId: evaluation.id,
    version: 1,
    title: evaluation.title,
    instructions: 'Répondez sur la feuille.',
    createdById: plein.id,
  },
});
await db.evaluationQuestion.create({
  data: {
    createdById: plein.id,
    versionId: evaluationVersion.id,
    type: 'CHOIX_UNIQUE',
    position: 0,
    prompt: 'Couleur fictive du ciel ?',
    points: 1,
    options: {
      create: [
        { position: 0, label: 'Bleu fictif', isCorrect: true },
        { position: 1, label: 'Vert fictif', isCorrect: false },
      ],
    },
  },
});
await db.evaluationQuestion.create({
  data: {
    createdById: plein.id,
    versionId: evaluationVersion.id,
    type: 'REPONSE_DEVELOPPEE',
    position: 1,
    prompt: 'Votre réponse fictive ?',
    points: 2,
    expectedAnswer: 'Réponse attendue confidentielle',
  },
});
for (const status of ['SOUMIS', 'APPROUVE', 'PUBLIE'] as const) {
  await db.evaluationVersion.update({
    where: { id: evaluationVersion.id },
    data: { status, ...(status === 'PUBLIE' && { publishedAt: new Date() }) },
  });
}
await db.evaluation.update({
  where: { id: evaluation.id },
  data: { publishedVersionId: evaluationVersion.id },
});

const team = await db.team.create({ data: { name: 'Équipe fictive' } });
for (const [lastName, withAccount] of [
  ['Alpha', false],
  ['Beta', false],
  ['Gamma', true],
] as const) {
  const account = withAccount
    ? await person(`routier-${lastName.toLowerCase()}@recette.test`, lastName, 'ROUTIER')
    : null;
  const scout = await db.scoutProfile.create({
    data: {
      firstName: 'Routier',
      lastName,
      matricule: `000000${lastName.length}${lastName[0]}`,
      currentStageId: stage.id,
      joinedAt: new Date(),
      userId: account?.id ?? null,
    },
  });
  await db.teamAssignment.create({
    data: {
      scoutProfileId: scout.id,
      teamId: team.id,
      startedAt: new Date(Date.now() - 86_400_000),
      assignedById: plein.id,
    },
  });
}
await db.$disconnect();
console.log('Fixture papier prête.');

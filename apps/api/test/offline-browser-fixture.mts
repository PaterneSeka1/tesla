/**
 * Fixture fictive de la recette navigateur hors ligne (apps/web/test/offline.browser.mjs).
 * Base « _test » uniquement (TEST_DATABASE_URL) ; rejouable : un module publié n'est plus modifié,
 * une nouvelle évaluation est créée à chaque passage. Lancement depuis apps/api :
 *   TEST_DATABASE_URL=… npx tsx test/offline-browser-fixture.mts
 */
import { writeFileSync } from 'node:fs';
import { hashPassword } from '../src/modules/auth/password.js';
import { createTestPrisma } from './int-database.js';

const db = createTestPrisma();
const passwordHash = await hashPassword('phrase-fictive-recette-phase5');
const stage = await db.progressionStage.findFirstOrThrow({ orderBy: { position: 'asc' } });
const user = await db.user.upsert({
  where: { email: 'phase5@recette.test' },
  update: {},
  create: {
    email: 'phase5@recette.test',
    firstName: 'Fictif',
    lastName: 'HorsLigne',
    role: 'ROUTIER',
    passwordHash,
  },
});
await db.scoutProfile.upsert({
  where: { userId: user.id },
  update: {},
  create: {
    userId: user.id,
    firstName: 'Fictif',
    lastName: 'HorsLigne',
    currentStageId: stage.id,
    joinedAt: new Date(),
  },
});
const chef = await db.user.upsert({
  where: { email: 'chef-phase5@recette.test' },
  update: {},
  create: {
    email: 'chef-phase5@recette.test',
    firstName: 'Chef',
    lastName: 'Fictif',
    role: 'CHEF',
    passwordHash,
  },
});
const module = await db.pedagogicalModule.upsert({
  where: { slug: 'recette-hors-ligne' },
  update: {},
  create: { slug: 'recette-hors-ligne', createdById: chef.id },
});
const version = await db.moduleVersion.upsert({
  where: { moduleId_version: { moduleId: module.id, version: 1 } },
  update: {},
  create: {
    moduleId: module.id,
    version: 1,
    title: 'Recette hors ligne',
    summary: 'Contenu fictif de recette.',
    createdById: chef.id,
  },
});
if (version.status === 'BROUILLON') {
  const lessons = ['Texte disponible sans connexion.', 'La position de lecture est conservée.'];
  for (const [index, text] of lessons.entries()) {
    await db.moduleLesson.create({
      data: {
        createdById: chef.id,
        versionId: version.id,
        position: index + 1,
        title: index ? 'Seconde leçon fictive' : 'Première leçon fictive',
        content: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
        },
      },
    });
  }
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
}
const evaluation = await db.evaluation.create({
  data: { title: 'Évaluation fictive hors ligne', stageId: stage.id, createdById: chef.id },
});
const evaluationVersion = await db.evaluationVersion.create({
  data: {
    evaluationId: evaluation.id,
    version: 1,
    title: evaluation.title,
    instructions: 'Données fictives pour tester le stockage.',
    createdById: chef.id,
  },
});
await db.evaluationQuestion.create({
  data: {
    createdById: chef.id,
    versionId: evaluationVersion.id,
    type: 'REPONSE_DEVELOPPEE',
    position: 1,
    prompt: 'Votre réponse fictive ?',
    points: 1,
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
writeFileSync(
  process.env.OFFLINE_FIXTURE ?? '/tmp/tesla-phase5-fixture.json',
  JSON.stringify({ evaluationId: evaluation.id, ownerId: user.id }),
);
await db.$disconnect();

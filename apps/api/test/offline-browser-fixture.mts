/**
 * Fixture fictive de la recette navigateur offline-first (apps/web/test/offline-first.browser.mjs).
 * Base « _test » uniquement (TEST_DATABASE_URL), remise à zéro à chaque passage. Lancement depuis
 * apps/api :
 *   TEST_DATABASE_URL=… npx tsx test/offline-browser-fixture.mts
 */
import { writeFileSync } from 'node:fs';
import { hashPassword } from '../src/modules/auth/password.js';
import { createTestPrisma, grantPersona, resetDatabase } from './int-database.js';

const db = createTestPrisma();
await resetDatabase(db);
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
    role: 'ENCADREMENT',
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
// Encadrement : responsable plein en exercice, deux routiers sans compte, une équipe, une activité
// passée (présences à saisir).
const responsable = await db.user.create({
  data: {
    email: 'responsable-offline@recette.test',
    firstName: 'Responsable',
    lastName: 'Fictif',
    role: 'ENCADREMENT',
    passwordHash,
  },
});
await grantPersona(db, responsable.id, 'RESPONSABLE');
const team = await db.team.create({ data: { name: 'Équipe fictive' } });
const scouts = [];
for (const lastName of ['Alpha', 'Beta']) {
  const scout = await db.scoutProfile.create({
    data: { firstName: 'Routier', lastName, currentStageId: stage.id, joinedAt: new Date() },
  });
  await db.teamAssignment.create({
    data: {
      scoutProfileId: scout.id,
      teamId: team.id,
      startedAt: new Date(Date.now() - 86_400_000),
      assignedById: responsable.id,
    },
  });
  scouts.push(scout.id);
}
const programme = await db.programme.findFirstOrThrow();
const activity = await db.activity.create({
  data: {
    title: 'Sortie fictive',
    origin: 'SUPPLEMENTAIRE',
    plannedOn: new Date(Date.now() - 2 * 86_400_000),
    programmeId: programme.id,
    createdById: responsable.id,
  },
});
writeFileSync(
  process.env.OFFLINE_FIXTURE ?? '/tmp/tesla-offline-fixture.json',
  JSON.stringify({
    evaluationId: evaluation.id,
    ownerId: user.id,
    responsableId: responsable.id,
    teamId: team.id,
    scouts,
    activityId: activity.id,
  }),
);
await db.$disconnect();

/**
 * Fixture fictive de la recette navigateur de la progression automatique et de l'exception de
 * secours (D176, apps/web/test/progression-exception.browser.mjs). Base « _test » uniquement
 * (TEST_DATABASE_URL), remise à zéro à chaque passage ; référentiels réels `2026.1` et `2026.2`.
 *   TEST_DATABASE_URL=… npx tsx test/progression-browser-fixture.mts
 */
import { addCalendarDays, addCalendarMonths, civilDateAt } from '@tesla/shared';
import { seedAgeRuleSet2026_2, seedInitialAgeRuleSet } from '../prisma/seeds/age-rules.seed.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { createTestPrisma, resetDatabase } from './int-database.js';

const db = createTestPrisma();
await resetDatabase(db);
await seedInitialAgeRuleSet(db);
await seedAgeRuleSet2026_2(db);
const passwordHash = await hashPassword('phrase-fictive-recette-progression');
const today = civilDateAt(new Date());
const born = (years: number, days: number) =>
  new Date(`${addCalendarDays(addCalendarMonths(today, -12 * years), -days)}T00:00:00Z`);

const person = (
  email: string,
  lastName: string,
  role: 'ROUTIER' | 'ENCADREMENT' | 'ADMINISTRATEUR',
) => db.user.create({ data: { email, firstName: 'Fictif', lastName, role, passwordHash } });

await person('admin-progression@recette.test', 'Administration', 'ADMINISTRATEUR');
for (const [email, fn] of [
  ['plein-progression@recette.test', 'PLEIN'],
  ['adjoint-progression@recette.test', 'ADJOINT'],
  ['assistant-progression@recette.test', 'ASSISTANT'],
] as const) {
  const user = await person(email, fn.toLowerCase(), 'ENCADREMENT');
  await db.leadershipAssignment.create({
    data: { userId: user.id, function: fn, reason: 'Désignation fictive (recette)' },
  });
}
// Arrivée tardive à 19 ans : Compagnonnage selon 2026.2.
const routier = await person('routier-progression@recette.test', 'Compagnon', 'ROUTIER');
await db.scoutProfile.create({
  data: {
    userId: routier.id,
    firstName: 'Fictif',
    lastName: 'Compagnon',
    birthDate: born(19, 10),
    joinedAt: new Date(`${today}T00:00:00Z`),
  },
});
// Sorti de la branche (21 ans révolus) : compte et dossier conservés.
const ancien = await person('ancien-progression@recette.test', 'Ancien', 'ROUTIER');
await db.scoutProfile.create({
  data: { userId: ancien.id, firstName: 'Fictif', lastName: 'Ancien', birthDate: born(21, 3) },
});
// Modules publiés fictifs (D177) : deux obligatoires à rattraper, un de la préparation au Départ,
// un transversal. Contournement des écrans, source officielle fictive.
const stageIds = Object.fromEntries(
  (await db.progressionStage.findMany()).map((stage) => [stage.code, stage.id]),
);
async function publishedModule(
  slug: string,
  title: string,
  stageCode: string | null,
  mandatory: boolean,
) {
  const module = await db.pedagogicalModule.create({ data: { slug } });
  const version = await db.moduleVersion.create({
    data: {
      moduleId: module.id,
      version: 1,
      title,
      stageId: stageCode ? stageIds[stageCode] : null,
      category: stageCode ? 'ETAPE' : 'TRANSVERSAL',
      obligation: mandatory ? 'OBLIGATOIRE' : 'FACULTATIF',
      officialSource: mandatory ? 'Source officielle fictive (recette)' : null,
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
}
await publishedModule('accueil-fictif', 'Accueil fictif', 'NOVICIAT', true);
await publishedModule('engagement-fictif', 'Engagement fictif', 'APPRENTISSAGE', true);
await publishedModule('service-fictif', 'Service fictif', 'DEPART_ROUTIER', false);
await publishedModule('culture-fictive', 'Culture fictive', null, false);
// Arrivée à 20 ans : trois étapes antérieures, deux modules obligatoires à rattraper.
const retard = await person('retard-progression@recette.test', 'Retardataire', 'ROUTIER');
await db.scoutProfile.create({
  data: {
    userId: retard.id,
    firstName: 'Fictif',
    lastName: 'Retardataire',
    birthDate: born(20, 10),
    joinedAt: new Date(`${today}T00:00:00Z`),
  },
});
console.log(
  'Fixture prête : administrateur, plein, adjoint, assistant, 3 routiers fictifs, 4 modules.',
);
await db.$disconnect();

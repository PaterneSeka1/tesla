/**
 * Fixture fictive de la recette navigateur des profils et de la progression automatique (D173,
 * apps/web/test/profil-progression.browser.mjs). Base « _test » uniquement (TEST_DATABASE_URL),
 * remise à zéro à chaque passage ; référentiel d'âge réel `2026.1` (noviciat et sortie seulement).
 *   TEST_DATABASE_URL=… npx tsx test/profil-browser-fixture.mts
 */
import { addCalendarDays, addCalendarMonths, civilDateAt } from '@tesla/shared';
import { seedInitialAgeRuleSet } from '../prisma/seeds/age-rules.seed.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { createTestPrisma, resetDatabase } from './int-database.js';

const db = createTestPrisma();
await resetDatabase(db);
await seedInitialAgeRuleSet(db);
const passwordHash = await hashPassword('phrase-fictive-recette-profils');
const today = civilDateAt(new Date());
const born = (years: number, days: number) =>
  new Date(`${addCalendarDays(addCalendarMonths(today, -12 * years), -days)}T00:00:00Z`);

const person = (
  email: string,
  lastName: string,
  role: 'ROUTIER' | 'ENCADREMENT' | 'ADMINISTRATEUR',
) => db.user.create({ data: { email, firstName: 'Fictif', lastName, role, passwordHash } });

await person('admin-profils@recette.test', 'Administration', 'ADMINISTRATEUR');
const plein = await person('plein-profils@recette.test', 'Plein', 'ENCADREMENT');
const assistant = await person('assistant-profils@recette.test', 'Assistant', 'ENCADREMENT');
await db.leadershipAssignment.create({
  data: { userId: plein.id, function: 'PLEIN', reason: 'Désignation fictive (recette)' },
});
await db.leadershipAssignment.create({
  data: { userId: assistant.id, function: 'ASSISTANT', reason: 'Désignation fictive (recette)' },
});
const team = await db.team.create({ data: { name: 'Équipe fictive Tesla' } });
const routier = await person('routier-profils@recette.test', 'Novice', 'ROUTIER');
const novice = await db.scoutProfile.create({
  data: {
    userId: routier.id,
    firstName: 'Fictif',
    lastName: 'Novice',
    matricule: '0000123A',
    birthDate: born(18, 10),
    joinedAt: new Date('2026-09-05T00:00:00Z'),
  },
});
await db.teamAssignment.create({
  data: {
    scoutProfileId: novice.id,
    teamId: team.id,
    startedAt: new Date(Date.now() - 86_400_000),
  },
});
// Routier de 19 ans : aucune règle validée après le noviciat → étape non déterminée.
await db.scoutProfile.create({
  data: {
    firstName: 'Fictif',
    lastName: 'Apprenti',
    birthDate: born(19, 40),
    joinedAt: new Date('2026-09-05T00:00:00Z'),
  },
});
// Pré-inscription incomplète : aucune valeur fictive.
await db.scoutProfile.create({ data: { firstName: 'Fictif', lastName: 'Incomplet' } });
console.log('Fixture prête : 1 administrateur, 1 plein, 1 assistant, 3 routiers fictifs.');
await db.$disconnect();

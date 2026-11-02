/**
 * Fixture de la recette navigateur du catalogue (apps/web/test/catalogue-lecture.browser.mjs), à
 * lancer après `offline-browser-fixture.mts` : importe le catalogue réel et le met en service au nom
 * du responsable fictif de la fixture. Base « _test » uniquement (TEST_DATABASE_URL). Depuis apps/api :
 *   TEST_DATABASE_URL=… npx tsx test/catalogue-browser-fixture.mts
 */
import {
  formatReleaseReport,
  releaseActor,
  releaseCatalog,
} from '../prisma/seeds/release-catalog.js';
import { FUNDAMENTAL_TEXTS, ROUTE_MODULES } from '../prisma/seeds/route-bibliotheque.seed.js';
import { SCOUTISME_BASE_MODULES } from '../prisma/seeds/scoutisme-base.seed.js';
import { importSourceModules } from '../prisma/seeds/source-modules.js';
import { createTestPrisma } from './int-database.js';

const db = createTestPrisma();
await importSourceModules(db, [...SCOUTISME_BASE_MODULES, ...FUNDAMENTAL_TEXTS, ...ROUTE_MODULES]);
const actor = await releaseActor(db);
// Données fictives de recette : l'acquittement des notes est simulé, jamais sur une base réelle.
console.log(formatReleaseReport(await releaseCatalog(db, actor, { acknowledgeNotes: true })));
await db.$disconnect();

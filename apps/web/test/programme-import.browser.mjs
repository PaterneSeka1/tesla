/**
 * Recette navigateur de l'import Excel du programme annuel et de la fiche « Prévu / Réalisé » (D172).
 * Base « _test » isolée préparée par `apps/api/test/offline-browser-fixture.mts` (comptes fictifs) ;
 * le classeur est fourni hors dépôt (PROGRAMME_XLSX) et n'est jamais versionné.
 *   PLAYWRIGHT_MODULE=…/playwright-core/index.mjs CHROMIUM_PATH=… PROGRAMME_XLSX=… SHOTS_DIR=… \
 *   node apps/web/test/programme-import.browser.mjs
 */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
const api = process.env.API_ORIGIN ?? 'http://localhost:4000/api/v1';
const workbook = process.env.PROGRAMME_XLSX;
const shots = process.env.SHOTS_DIR;
const PASSWORD = 'phrase-fictive-recette-phase5';
const RESPONSABLE = 'responsable-offline@recette.test';
const CHEF = 'chef-phase5@recette.test';
const PAGE = '/administration/programme-annuel';
assert.ok(workbook, 'PROGRAMME_XLSX est requis.');

if (shots) await mkdir(shots, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox'],
});
const errors = [];
let checks = 0;
const check = (label) => console.log(`${++checks}. ${label}`);

async function session(email, width = 1280) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: 'reduce',
    locale: 'fr-FR',
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${origin}/connexion`);
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: /se connecter/i }).click();
  await page.waitForURL(/\/accueil/);
  return { context, page };
}

const get = async (page, path) => {
  const response = await page.request.get(`${api}${path}`);
  return { status: response.status(), body: await response.json() };
};
const send = (page, method, path, data) =>
  page.request.fetch(`${api}${path}`, {
    method,
    headers: { 'x-tesla-csrf': '1', 'content-type': 'application/json' },
    data,
  });
const noHorizontalScroll = async (page) =>
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    `défilement horizontal sur ${page.url()} (${page.viewportSize().width} px)`,
  );
const shot = async (page, name) => {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
};
const stat = (page, label) =>
  page
    .locator('dl > div')
    .filter({ has: page.locator(`dt:text-is("${label}")`) })
    .locator('dd');
const fileInput = (page) => page.getByLabel(/Classeur Excel/);

const programmes = async (page) => (await get(page, '/programmes')).body.items;
/** Séances d'origine « programme » (la fixture contient une activité supplémentaire). */
const sessions = async (page, programmeId) => {
  const { items } = (
    await get(page, `/activities?programmeId=${programmeId}&origin=PROGRAMME&pageSize=100`)
  ).body;
  return { total: items.length, items };
};

// ─── Responsable ────────────────────────────────────────────────────────────
const { page } = await session(RESPONSABLE);
const [programme] = await programmes(page);
await page.goto(`${origin}${PAGE}`);
await page.getByRole('heading', { name: 'Importer un programme Excel' }).waitFor();
check('page « Programme annuel » : section d’import Excel visible pour le responsable');

// Hors connexion : rien n'est simulé.
await page.context().setOffline(true);
await fileInput(page).setInputFiles(workbook);
await page.getByText('L’import nécessite une connexion').waitFor();
await page.context().setOffline(false);
assert.equal((await sessions(page, programme.id)).total, 0);
check('hors connexion : import refusé avec un message clair, aucune écriture');

await page.reload();
await fileInput(page).setInputFiles(workbook);
await page.getByText('Prévisualisation (rien n’est enregistré)').waitFor({ timeout: 30_000 });
const created = Number(await stat(page, 'Créations').innerText());
assert.ok(created > 0, 'aucune séance reconnue');
assert.equal(await stat(page, 'Erreurs').innerText(), '0');
assert.equal((await sessions(page, programme.id)).total, 0);
check(`prévisualisation : ${created} séance(s) reconnue(s), 0 erreur, rien d’enregistré`);

await page.getByText('Colonnes reconnues').click();
const firstRow = page.locator('li details').first();
await firstRow.locator('summary').click();
for (const label of [
  'Novices Routiers',
  'Aspirants Routiers',
  'Compagnons Routiers',
  'Routiers Confirmés',
]) {
  await firstRow.getByText(label, { exact: true }).first().waitFor();
}
check('détail d’une séance : quatre contenus de catégorie affichés');
await shot(page, '01-previsualisation');

await page.getByRole('button', { name: /Confirmer l’import/ }).click();
await page.getByText('Import enregistré.').waitFor({ timeout: 30_000 });
const imported = await sessions(page, programme.id);
assert.equal(imported.total, created);
assert.ok(imported.items.every((s) => s.status === 'PLANIFIEE'));
assert.ok(
  imported.items.every(
    (s) => s.attendance.present + s.attendance.absent + s.attendance.excused === 0,
  ),
);
check(`confirmation : ${imported.total} séances créées, toutes planifiées, aucune présence`);

// Calendrier : le mois de la première séance affiche ses séances.
const first = imported.items[0];
await page.reload();
const months = (a, b) =>
  (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 +
  Number(b.slice(5, 7)) -
  Number(a.slice(5, 7));
const delta = months(new Date().toISOString().slice(0, 7), first.plannedOn.slice(0, 7));
const nav = page.getByRole('button', { name: delta < 0 ? /Mois précédent/i : /Mois suivant/i });
for (let i = 0; i < Math.abs(delta); i += 1) await nav.click();
await page.getByText(first.title, { exact: false }).first().waitFor();
check('calendrier : séance importée visible dans son mois');
await shot(page, '02-calendrier');

// Deuxième import identique : aucun doublon.
await fileInput(page).setInputFiles(workbook);
await page.getByText('Prévisualisation (rien n’est enregistré)').waitFor({ timeout: 30_000 });
assert.equal(await stat(page, 'Créations').innerText(), '0');
assert.equal(await stat(page, 'Inchangées').innerText(), String(created));
check('deuxième analyse du même fichier : 0 création, toutes inchangées');

// Fiche de séance prévu / réalisé.
const detailPath = `/administration/activites/${first.id}`;
const detail = (await get(page, `/activities/${first.id}`)).body;
const realised = await send(page, 'POST', `/activities/${first.id}/status`, {
  status: 'REALISEE',
  revision: detail.revision,
  heldOn: first.plannedOn,
});
assert.equal(realised.status(), 201);
const afterStatus = await realised.json();
assert.equal(
  (
    await send(page, 'PATCH', `/activities/${first.id}`, {
      revision: afterStatus.revision,
      heldByLabel: 'Chef fictif de recette',
      contentDone: 'Activité fictive menée',
      outcomes: 'Objectif fictif atteint',
      report: 'Compte rendu fictif',
    })
  ).status(),
  200,
);
await page.goto(`${origin}${detailPath}`);
await page
  .getByText(/Réalisée le/)
  .first()
  .waitFor();
await page.getByText('Contenus prévus par catégorie').waitFor();
check('fiche : en-tête avec date réelle, programme prévu et contenus par catégorie');
await page.getByRole('tab', { name: 'Réalisation' }).click();
await page.getByRole('tabpanel').getByText('Compte rendu fictif').waitFor();
await page.getByRole('tab', { name: 'Prévu / réalisé' }).click();
await page.getByRole('tabpanel').getByText('Chef fictif de recette').waitFor();
await page.getByRole('tabpanel').getByText('Objectif fictif atteint').waitFor();
check('fiche : réalisation et comparaison prévu / réalisé');
await shot(page, '03-fiche-comparaison');
await page.getByRole('tab', { name: 'Historique' }).click();
await page.getByRole('tabpanel').getByText('Importée du programme').first().waitFor();
await page.getByRole('tabpanel').getByText('Statut modifié').first().waitFor();
check('fiche : historique (import, statut, modification)');
await page.getByRole('tab', { name: 'Présences' }).click();
await page.getByText(/non renseignée reste distincte/).waitFor();
check('fiche : onglet présences (saisie nominative existante)');

// Réimport : la séance réalisée est protégée.
await page.goto(`${origin}${PAGE}`);
await fileInput(page).setInputFiles(workbook);
await page.getByText('Prévisualisation (rien n’est enregistré)').waitFor({ timeout: 30_000 });
assert.equal(await stat(page, 'Protégées').innerText(), '1');
await page.getByRole('button', { name: /Confirmer l’import/ }).click();
await page.getByText('Import enregistré.').waitFor({ timeout: 30_000 });
const kept = (await get(page, `/activities/${first.id}`)).body;
assert.equal(kept.status, 'REALISEE');
assert.equal(kept.report, 'Compte rendu fictif');
assert.equal((await sessions(page, programme.id)).total, created);
const history = (await get(page, `/programmes/${programme.id}/imports`)).body.items;
assert.equal(history.length, 2);
check(
  'réimport : séance réalisée protégée, compte rendu intact, aucun doublon, historique 2 imports',
);

// Mobile 360 px.
const mobile = await session(RESPONSABLE, 360);
await mobile.page.goto(`${origin}${PAGE}`);
await fileInput(mobile.page).setInputFiles(workbook);
await mobile.page
  .getByText('Prévisualisation (rien n’est enregistré)')
  .waitFor({ timeout: 30_000 });
await noHorizontalScroll(mobile.page);
await shot(mobile.page, '04-import-360');
await mobile.page.goto(`${origin}${detailPath}`);
for (const tab of [
  'Programme prévu',
  'Réalisation',
  'Présences',
  'Prévu / réalisé',
  'Historique',
]) {
  await mobile.page.getByRole('tab', { name: tab }).click();
  await noHorizontalScroll(mobile.page);
}
await shot(mobile.page, '05-fiche-360');
check('360 px : import et cinq onglets de la fiche sans défilement horizontal');

// Chef : consultation sans import.
const chef = await session(CHEF);
await chef.page.goto(`${origin}${PAGE}`);
await chef.page.getByRole('heading', { name: 'Séances', exact: true }).waitFor();
assert.equal(
  await chef.page.getByRole('heading', { name: 'Importer un programme Excel' }).count(),
  0,
);
const forbidden = await send(
  chef.page,
  'POST',
  `/programmes/${programme.id}/import/excel/preview`,
  {
    fileName: 'a.xlsx',
    fileBase64: 'UEsDBA==',
  },
);
assert.equal(forbidden.status(), 403);
await chef.page.goto(`${origin}${detailPath}`);
await chef.page.getByText('Contenus prévus par catégorie').waitFor();
check('chef : consultation du programme et de la fiche, import refusé (403)');

assert.deepEqual(errors, []);
check('aucune erreur JavaScript');
await browser.close();
console.log(`\n${checks} contrôles réussis.`);

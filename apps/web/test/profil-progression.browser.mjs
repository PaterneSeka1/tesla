/**
 * Recette navigateur des profils protégés et de la progression automatique (D173).
 * Base « _test » isolée préparée par `apps/api/test/profil-browser-fixture.mts` (comptes fictifs).
 *   PLAYWRIGHT_MODULE=…/playwright-core/index.mjs CHROMIUM_PATH=… SHOTS_DIR=… \
 *   node apps/web/test/profil-progression.browser.mjs
 */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
const api = process.env.API_ORIGIN ?? 'http://localhost:4000/api/v1';
const shots = process.env.SHOTS_DIR;
const PASSWORD = 'phrase-fictive-recette-profils';
const ROUTIER = 'routier-profils@recette.test';
const PLEIN = 'plein-profils@recette.test';
const ASSISTANT = 'assistant-profils@recette.test';
const ADMIN = 'admin-profils@recette.test';
const WIDTHS = [360, 390, 768, 1024, 1440];

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
  page.on('pageerror', (error) => errors.push(`${email} : ${error.message}`));
  await page.goto(`${origin}/connexion`);
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: /se connecter/i }).click();
  await page.waitForURL(/\/accueil/);
  return { context, page };
}

const send = (page, method, path, data) =>
  page.request.fetch(`${api}${path}`, {
    method,
    headers: { 'x-tesla-csrf': '1', 'content-type': 'application/json' },
    data,
  });
const noHorizontalScroll = async (page, label) =>
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    `défilement horizontal : ${label}`,
  );
const shot = (page, name) =>
  shots ? page.screenshot({ path: `${shots}/${name}.png`, fullPage: true }) : Promise.resolve();

async function scoutId(page, lastName) {
  const response = await page.request.get(`${api}/scouts?search=${encodeURIComponent(lastName)}`);
  return (await response.json()).items[0].id;
}

// ─── Routier : profil en lecture seule, responsive ──────────────────────────────────────────
for (const width of WIDTHS) {
  const { context, page } = await session(ROUTIER, width);
  await page.goto(`${origin}/compte`);
  await page.getByText('Identité', { exact: true }).waitFor();
  for (const title of ['Informations personnelles et Route', 'Progression', 'Compte']) {
    await page.getByText(title, { exact: true }).first().waitFor();
  }
  await page.getByText('Noviciat').first().waitFor();
  await page.getByText('0000123A').waitFor();
  // Aucune zone de saisie pour l'identité (le seul formulaire est le mot de passe).
  assert.equal(await page.getByLabel('Nom', { exact: true }).count(), 0);
  assert.equal(await page.getByLabel('Prénom', { exact: true }).count(), 0);
  await noHorizontalScroll(page, `/compte ${width}`);
  await shot(page, `compte-routier-${width}`);
  await context.close();
}
check(
  `routier : « Mon profil » en sections, lecture seule, sans défilement horizontal (${WIDTHS.join(', ')} px)`,
);

{
  const { context, page } = await session(ROUTIER, 390);
  await page.goto(`${origin}/progression`);
  for (const title of ['Modules de mon étape', 'Modules à rattraper', 'Modules déjà acquis']) {
    await page.getByRole('heading', { name: title }).waitFor();
  }
  await noHorizontalScroll(page, '/progression 390');
  await shot(page, 'progression-routier-390');
  check('routier : trois catégories de modules distinctes');

  assert.equal((await send(page, 'PATCH', '/auth/profile', { lastName: 'Moi' })).status(), 404);
  const own = await (await page.request.get(`${api}/auth/profile`)).json();
  assert.equal(own.scout.stage.code, 'NOVICIAT');
  const response = await send(page, 'PATCH', '/scouts/00000000-0000-7000-8000-000000000000', {
    birthDate: '2000-01-01',
  });
  assert.equal(response.status(), 403);
  check('routier : aucune modification possible par appel direct (404 profil, 403 fiche)');
  await context.close();
}

// ─── Responsable plein : données manquantes, complétion, correction motivée ──────────────────
{
  const { context, page } = await session(PLEIN, 1280);
  const incomplete = await scoutId(page, 'Incomplet');
  await page.goto(`${origin}/administration/routiers/${incomplete}`);
  for (const text of [
    'Matricule non renseigné',
    'Date d’entrée non renseignée',
    'Date de naissance non renseignée',
  ]) {
    await page.getByText(text).waitFor();
  }
  await page.getByText('Étape non déterminée').first().waitFor();
  check('plein : données manquantes affichées sans valeur fictive');

  await page.goto(`${origin}/administration/routiers/${incomplete}/modifier`);
  assert.equal(await page.getByLabel(/Étape de progression/).count(), 0);
  assert.equal(await page.getByLabel('Date d’entrée à la Route').inputValue(), '');
  await page.getByLabel('Date d’entrée à la Route').fill('2026-09-05');
  assert.equal(await page.getByText('Correction d’informations déjà renseignées').count(), 0);
  await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();
  await page.waitForURL(new RegExp(`/administration/routiers/${incomplete}$`));
  await page.getByText('5 septembre 2026').first().waitFor();
  check('plein : complétion sans motif, aucune saisie d’étape, aucune date par défaut');

  const novice = await scoutId(page, 'Novice');
  await page.goto(`${origin}/administration/routiers/${novice}/modifier`);
  await page.getByLabel('Date de naissance').fill('2006-01-15');
  await page.getByText('Correction d’informations déjà renseignées').waitFor();
  await page.getByText(/Étape : Noviciat →/).waitFor();
  await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();
  await page.getByText(/Indiquez le motif de la correction/).waitFor();
  await page.getByLabel('Motif de la correction').fill('Acte de naissance fictif vérifié.');
  await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();
  await page.getByText('Confirmez la correction.').waitFor();
  await shot(page, 'correction-plein-1280');
  await page.getByLabel('Je confirme cette correction.').check();
  await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();
  await page.waitForURL(new RegExp(`/administration/routiers/${novice}$`));
  const fiche = await (await page.request.get(`${api}/scouts/${novice}`)).json();
  assert.equal(fiche.stage, null);
  assert.equal(fiche.stageReason, 'AUCUNE_REGLE');
  check(
    'plein : correction de la date de naissance avec aperçu, motif et confirmation ; étape recalculée',
  );

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${origin}/administration/routiers/${novice}/modifier`);
    await page.getByLabel('Date de naissance').waitFor();
    await noHorizontalScroll(page, `modifier ${width}`);
    await page.goto(`${origin}/administration/routiers/${novice}`);
    await page.getByText('Informations', { exact: true }).waitFor();
    await noHorizontalScroll(page, `fiche ${width}`);
    await shot(page, `fiche-plein-${width}`);
  }
  check('plein : fiche et formulaire sans défilement horizontal aux cinq largeurs');
  await context.close();
}

// ─── Administrateur et assistant ───────────────────────────────────────────────────────────
{
  const { context, page } = await session(ADMIN, 1280);
  const incomplete = await scoutId(page, 'Incomplet');
  await page.goto(`${origin}/administration/routiers/${incomplete}`);
  await page.getByRole('link', { name: 'Compléter ou corriger' }).waitFor();
  assert.equal(await page.getByText('Dossier pédagogique').count(), 0);
  assert.equal(await page.getByText('Âge, parcours et rattrapages').count(), 0);
  assert.equal(await page.getByRole('button', { name: /équipe/i }).count(), 0);
  await shot(page, 'fiche-admin-1280');
  check('administrateur : gestion administrative de la fiche, aucun accès pédagogique');
  await context.close();
}
{
  const { context, page } = await session(ASSISTANT, 1280);
  const novice = await scoutId(page, 'Novice');
  await page.goto(`${origin}/administration/routiers/${novice}`);
  await page.getByText('Informations', { exact: true }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Compléter ou corriger' }).count(), 0);
  assert.equal(
    (await send(page, 'PATCH', `/scouts/${novice}`, { matricule: '0000999Z' })).status(),
    403,
  );
  check('assistant : consultation seule, modification refusée par l’API');
  await context.close();
}

await browser.close();
assert.deepEqual(errors, [], `erreurs JavaScript : ${errors.join(' | ')}`);
check('aucune erreur JavaScript');
console.log(`Recette réussie : ${checks}/${checks} contrôles.`);

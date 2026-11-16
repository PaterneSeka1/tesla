/**
 * Recette navigateur du parcours officiel et du parcours antérieur (D181).
 * Base « _test » isolée préparée par `apps/api/test/progression-browser-fixture.mts` (comptes fictifs,
 * référentiel 2026.2). API et web compilés.
 *   PLAYWRIGHT_MODULE=…/playwright-core/index.mjs CHROMIUM_PATH=… SHOTS_DIR=… \
 *   node apps/web/test/parcours-anterieur.browser.mjs
 */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
const api = process.env.API_ORIGIN ?? 'http://localhost:4000/api/v1';
const shots = process.env.SHOTS_DIR;
const PASSWORD = 'phrase-fictive-recette-progression';
const account = (name) => `${name}-progression@recette.test`;
const WIDTHS = [360, 768, 1440];

if (shots) await mkdir(shots, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox'],
});
const errors = [];
let checks = 0;
const check = (label) => console.log(`${++checks}. ${label}`);

async function session(name, width = 1280) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: 'reduce',
    locale: 'fr-FR',
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`${name} : ${error.message}`));
  await page.goto(`${origin}/connexion`);
  await page.getByLabel('Adresse e-mail').fill(account(name));
  await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: /se connecter/i }).click();
  await page.waitForURL(/\/accueil/);
  return { context, page };
}
const noHorizontalScroll = async (page, label) =>
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    `défilement horizontal : ${label}`,
  );
const shot = (page, name) =>
  shots ? page.screenshot({ path: `${shots}/${name}.png`, fullPage: true }) : Promise.resolve();
const bodyText = (page) => page.locator('body').innerText();
const civil = (date) => date.toISOString().slice(0, 10);
const bornYearsAgo = (years, days = 10) => {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - years);
  date.setUTCDate(date.getUTCDate() - days);
  return civil(date);
};

async function fillIdentity(page, lastName, birthDate) {
  await page.goto(`${origin}/administration/routiers/nouveau`);
  await page.locator('#lastName').fill(lastName);
  await page.locator('#firstName').fill('Fictif');
  await page.locator('#birthDate').fill(birthDate);
}

// ─── Scénarios A, B, G : le plein inscrit, à chaque largeur ──────────────────────────────────
for (const width of WIDTHS) {
  const { context, page } = await session('plein', width);
  // Trop jeune : étape indéterminable, inscription bloquée et expliquée (aucune étape attribuée).
  await fillIdentity(page, `Jeune${width}`, bornYearsAgo(17));
  await page.getByText('Impossible de déterminer l’étape actuelle').waitFor();
  assert.ok(await page.getByRole('button', { name: 'Enregistrer le routier' }).isDisabled());
  await noHorizontalScroll(page, `formulaire bloqué ${width}`);
  check(`${width} px : inscription bloquée pour une étape indéterminable`);

  // Nouveau routier : étape proposée par le serveur, enregistrement.
  await fillIdentity(page, `Nouveau${width}`, bornYearsAgo(19));
  await page.getByText(/Étape actuelle : Compagnonnage/).waitFor();
  await shot(page, `inscription-${width}`);
  await page.getByRole('button', { name: 'Enregistrer le routier' }).click();
  await page.waitForURL(/\/administration\/routiers\/[0-9a-f-]{36}$/);
  await page.getByText('Routier enregistré avec succès.', { exact: true }).waitFor();
  await page.getByText('Parcours et progression').waitFor();
  const fresh = await bodyText(page);
  assert.match(fresh, /Compagnonnage/);
  assert.match(fresh, /Aucun compte/);
  assert.doesNotMatch(fresh, /Sans étape|Fiche à régulariser/);
  check(`${width} px : nouveau routier sans compte enregistré avec une étape valide (A, G)`);

  // Ancien routier : noviciat et apprentissage reconnus dès l'inscription.
  await fillIdentity(page, `Ancien${width}`, bornYearsAgo(19));
  await page.getByText(/Étape actuelle : Compagnonnage/).waitFor();
  await page.getByText('Routier ayant déjà un parcours').click();
  await page.getByRole('checkbox', { name: 'Noviciat' }).check();
  await page.getByRole('checkbox', { name: 'Apprentissage' }).check();
  await noHorizontalScroll(page, `formulaire parcours antérieur ${width}`);
  await shot(page, `inscription-parcours-${width}`);
  await page.getByRole('button', { name: 'Enregistrer le routier' }).click();
  await page.waitForURL(/\/administration\/routiers\/[0-9a-f-]{36}$/);
  await page.getByText('Parcours antérieur', { exact: true }).waitFor();
  await page.reload();
  const timeline = page.getByRole('list', { name: 'Mon parcours' });
  await timeline.waitFor();
  const steps = await timeline.innerText();
  assert.equal(steps.match(/Parcours antérieur reconnu/g)?.length, 2, steps);
  assert.match(steps, /Compagnonnage\s*En cours/);
  await noHorizontalScroll(page, `fiche ${width}`);
  await shot(page, `fiche-parcours-${width}`);
  check(`${width} px : parcours antérieur reconnu, conservé après actualisation (B)`);
  await context.close();
}

// ─── Reconnaissance et révocation depuis la fiche ─────────────────────────────────────────────
{
  const { context, page } = await session('plein', 1280);
  await fillIdentity(page, 'Fiche', bornYearsAgo(20));
  await page.getByText(/Étape actuelle : Préparation au Départ routier/).waitFor();
  await page.getByRole('button', { name: 'Enregistrer le routier' }).click();
  await page.waitForURL(/\/administration\/routiers\/[0-9a-f-]{36}$/);
  await page.getByRole('button', { name: 'Reconnaître une étape antérieure' }).click();
  await page.locator('#prior-stage').selectOption({ label: 'Compagnonnage' });
  await page.getByRole('button', { name: 'Reconnaître l’étape' }).click();
  await page.getByText('Le parcours antérieur a été reconnu.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Corriger' }).click();
  await page.getByRole('dialog').locator('textarea').fill('Saisie erronée fictive.');
  await page.getByRole('button', { name: 'Révoquer' }).click();
  await page.getByText('Reconnaissance révoquée.', { exact: true }).waitFor();
  const text = await bodyText(page);
  assert.match(text, /Révoquée le/);
  assert.match(text, /Saisie erronée fictive\./);
  check('Fiche : reconnaissance puis révocation motivée, historique visible');
  await context.close();
}

// ─── Administrateur : inscrit, mais ne reconnaît pas de parcours ──────────────────────────────
{
  const { context, page } = await session('admin', 1280);
  await fillIdentity(page, 'ParAdmin', bornYearsAgo(19));
  await page.getByText('Routier ayant déjà un parcours').click();
  await page.getByText(/relève du responsable plein/).waitFor();
  assert.equal(await page.getByRole('checkbox', { name: 'Noviciat' }).count(), 0);
  check('Administrateur : aucune case de reconnaissance (décision du plein)');
  await context.close();
}

// ─── Scénarios C, D, E : lecture libre, aucune validation, refus serveur ──────────────────────
for (const width of WIDTHS) {
  const { context, page } = await session('retard', width);
  const before = await (await page.request.get(`${api}/me/pathway`)).json();
  await page.goto(`${origin}/modules`);
  await page.getByRole('link', { name: /Culture fictive/ }).click();
  await page.waitForURL(/\/modules\/culture-fictive$/);
  await page.getByRole('heading', { name: 'Culture fictive' }).waitFor();
  await noHorizontalScroll(page, `module ${width}`);
  const after = await (await page.request.get(`${api}/me/pathway`)).json();
  assert.equal(after.stage.code, before.stage.code);
  assert.deepEqual(
    after.stageModules.map((m) => m.studied),
    before.stageModules.map((m) => m.studied),
  );
  check(`${width} px : cours hors étape lu pendant un rattrapage, rien de validé (C, D)`);
  await context.close();
}
{
  const { context, page } = await session('routier', 1280);
  await page.goto(`${origin}/progression`);
  const timeline = page.getByRole('list', { name: 'Mon parcours' });
  await timeline.waitFor();
  assert.match(await timeline.innerText(), /Compagnonnage\s*En cours/);
  await page.getByText('Étapes reconnues (parcours antérieur)').waitFor();
  const me = await (await page.request.get(`${api}/me/pathway`)).json();
  const stages = (await (await page.request.get(`${api}/progression/stages`)).json()).items;
  const response = await page.request.post(`${api}/scouts/${me.scout.id}/prior-stages`, {
    headers: { 'x-tesla-csrf': '1' },
    data: { stageId: stages[0].id },
  });
  assert.equal(response.status(), 403);
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await noHorizontalScroll(page, `progression ${width}`);
    await shot(page, `progression-${width}`);
  }
  check('Routier : frise visible, reconnaissance par soi-même refusée par le serveur (E)');
  await context.close();
}

await browser.close();
assert.deepEqual(errors, [], `erreurs JavaScript : ${errors.join(' | ')}`);
console.log(`Recette parcours antérieur : ${checks} contrôles réussis.`);

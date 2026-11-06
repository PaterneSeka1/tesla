/**
 * Recette navigateur de la progression automatique et de l'exception de secours (D176).
 * Base « _test » isolée préparée par `apps/api/test/progression-browser-fixture.mts` (comptes fictifs).
 *   PLAYWRIGHT_MODULE=…/playwright-core/index.mjs CHROMIUM_PATH=… SHOTS_DIR=… \
 *   node apps/web/test/progression-exception.browser.mjs
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
const SECRET_REASON = 'Motif confidentiel de recette fictive';

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
async function scoutId(page, lastName) {
  const response = await page.request.get(`${api}/scouts?search=${encodeURIComponent(lastName)}`);
  return (await response.json()).items[0].id;
}

// ─── Routier : étape actuelle, aucune explication du calcul ───────────────────────────────────
for (const width of WIDTHS) {
  const { context, page } = await session('routier', width);
  await page.goto(`${origin}/progression`);
  await page.getByRole('heading', { name: 'Modules de mon étape' }).waitFor();
  await page.getByText('Compagnonnage').first().waitFor();
  const text = await bodyText(page);
  assert.ok(!/référentiel d’âge|déterminée par l’âge|calculée/i.test(text), 'explication visible');
  await noHorizontalScroll(page, `/progression ${width}`);
  await page.goto(`${origin}/compte`);
  await page.getByText('Compagnonnage').first().waitFor();
  assert.ok(!/référentiel/i.test(await bodyText(page)));
  await noHorizontalScroll(page, `/compte ${width}`);
  await shot(page, `routier-progression-${width}`);
  await context.close();
}
check(
  `routier arrivé à 19 ans : Compagnonnage, sans explication interne (${WIDTHS.join(', ')} px)`,
);

// ─── Plein : supervision et exception de secours ─────────────────────────────────────────────
let compagnon;
for (const width of [360, 1440]) {
  const { context, page } = await session('plein', width);
  compagnon = await scoutId(page, 'Compagnon');
  await page.goto(`${origin}/administration/routiers/${compagnon}`);
  await page.getByText('Supervision de la progression').waitFor();
  await page.getByText('Préparation au Départ routier').first().waitFor();
  await page.getByText(/Sortie de la branche le .* à 00 h 00/).waitFor();
  await noHorizontalScroll(page, `fiche plein ${width}`);
  await shot(page, `plein-supervision-${width}`);
  await context.close();
}
check('plein : périodes 2026.2, étape normale et sortie à 00 h 00 visibles (360, 1440 px)');

{
  const { context, page } = await session('plein', 1280);
  await page.goto(`${origin}/administration/routiers/${compagnon}`);
  await page.getByRole('button', { name: 'Correction exceptionnelle de l’étape' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Étape exceptionnelle').selectOption({ label: 'Apprentissage' });
  const end = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
  await dialog.getByLabel('Au (inclus)').fill(end);
  await dialog.getByLabel('Motif').fill(SECRET_REASON);
  // Confirmation sans aperçu : refusée côté interface.
  await dialog.getByRole('button', { name: 'Appliquer l’exception' }).click();
  await dialog.getByText('Prévisualisez d’abord les conséquences.').waitFor();
  await dialog.getByRole('button', { name: 'Prévisualiser' }).click();
  await dialog.getByText(/Rattrapages ouverts conservés/).waitFor();
  await dialog.getByRole('button', { name: 'Appliquer l’exception' }).click();
  await page.getByText(/Exception jusqu’au/).waitFor();
  await page.locator('main p', { hasText: SECRET_REASON }).waitFor();
  await shot(page, 'plein-exception-active');
  check('plein : aperçu obligatoire puis exception appliquée, motif dans l’historique');
  await context.close();
}

// ─── Routier, adjoint, assistant, administrateur : étape appliquée, rien de réservé ──────────
{
  const { context, page } = await session('routier', 390);
  await page.goto(`${origin}/progression`);
  await page.getByText('Apprentissage').first().waitFor();
  assert.ok(!(await bodyText(page)).includes(SECRET_REASON));
  const raw = await (await page.request.get(`${api}/me/pathway`)).text();
  assert.ok(!raw.includes(SECRET_REASON) && !raw.includes('2026.2'));
  check('routier : étape appliquée affichée, ni motif ni référentiel transmis');
  await context.close();
}
for (const name of ['adjoint', 'assistant', 'admin']) {
  const { context, page } = await session(name, 1280);
  await page.goto(`${origin}/administration/routiers/${compagnon}`);
  await page.getByText('Informations', { exact: true }).waitFor();
  assert.equal(await page.getByText('Supervision de la progression').count(), 0);
  assert.equal(
    await page.getByRole('button', { name: 'Correction exceptionnelle de l’étape' }).count(),
    0,
  );
  assert.ok(!(await bodyText(page)).includes(SECRET_REASON));
  for (const path of [`/scouts/${compagnon}/stage-supervision`, '/age-rules']) {
    assert.equal((await page.request.get(`${api}${path}`)).status(), 403, `${name} ${path}`);
  }
  // Menu : le référentiel d'âge n'apparaît pas.
  assert.equal(await page.getByRole('link', { name: 'Référentiel d’âge' }).count(), 0);
  await context.close();
}
check('adjoint, assistant, administrateur : aucun outil ni motif, API refusée (403)');

// ─── Levée : retour immédiat à l'étape normale ───────────────────────────────────────────────
{
  const { context, page } = await session('plein', 1280);
  await page.goto(`${origin}/administration/routiers/${compagnon}`);
  await page.getByRole('button', { name: 'Lever', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Motif de la levée').fill('Levée de recette fictive.');
  await dialog.getByRole('button', { name: 'Lever l’exception' }).click();
  await page.getByText('Levée', { exact: true }).waitFor();
  assert.equal(await page.getByText(/Exception jusqu’au/).count(), 0);
  check('plein : levée motivée, exception conservée dans l’historique');
  await context.close();
}
{
  const { context, page } = await session('routier', 390);
  await page.goto(`${origin}/progression`);
  await page.getByText('Compagnonnage').first().waitFor();
  check('routier : retour automatique au Compagnonnage');
  await context.close();
}

// ─── Routier sorti à 21 ans : compte conservé, sortie affichée ───────────────────────────────
{
  const { context, page } = await session('ancien', 390);
  await page.goto(`${origin}/progression`);
  await page.getByText(/limite d’âge de la branche/).waitFor();
  await noHorizontalScroll(page, 'ancien 390');
  check('routier de 21 ans : sortie affichée, connexion et dossier conservés');
  await context.close();
}

await browser.close();
assert.deepEqual(errors, [], `erreurs JavaScript : ${errors.join(' | ')}`);
console.log(`Recette progression et exception : ${checks}/${checks} contrôles réussis.`);

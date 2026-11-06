/**
 * Recette navigateur des rattrapages par étape et du verrou des autres cours (D177).
 * Base « _test » isolée préparée par `apps/api/test/progression-browser-fixture.mts` (comptes fictifs).
 *   PLAYWRIGHT_MODULE=…/playwright-core/index.mjs CHROMIUM_PATH=… SHOTS_DIR=… \
 *   node apps/web/test/rattrapages.browser.mjs
 */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
const api = process.env.API_ORIGIN ?? 'http://localhost:4000/api/v1';
const shots = process.env.SHOTS_DIR;
const PASSWORD = 'phrase-fictive-recette-progression';
const account = (name) => `${name}-progression@recette.test`;

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
const dateIn = (days) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toLocaleDateString('fr-FR', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

for (const width of [360, 1440]) {
  const { context, page } = await session('retard', width);
  // Rattrapages : étape en cours et échéance (21 jours).
  await page.goto(`${origin}/mes-rattrapages`);
  await page
    .getByText(`Rattrapage en cours : Noviciat, à terminer avant le ${dateIn(20)}`)
    .waitFor();
  await noHorizontalScroll(page, `/mes-rattrapages ${width}`);
  await shot(page, `rattrapages-${width}`);
  // Catalogue : seul le module de l'étape en cours de rattrapage est ouvert.
  await page.goto(`${origin}/modules`);
  await page.getByText('Terminez d’abord vos rattrapages').waitFor();
  assert.equal(await page.getByRole('link', { name: /Accueil fictif/ }).count(), 1);
  for (const title of ['Engagement fictif', 'Service fictif', 'Culture fictive']) {
    await page.getByText(title).waitFor();
    assert.equal(await page.getByRole('link', { name: new RegExp(title) }).count(), 0, title);
  }
  await noHorizontalScroll(page, `/modules ${width}`);
  await shot(page, `catalogue-verrouille-${width}`);
  await context.close();
}
check(
  'routier arrivé à 20 ans : Noviciat à rattraper en 21 jours, autres cours fermés (360, 1440 px)',
);

{
  const { context, page } = await session('retard', 1280);
  // Accès direct : refusé par l'API et affiché comme tel.
  const response = await page.request.get(`${api}/modules/service-fictif`);
  assert.equal(response.status(), 403);
  assert.equal((await response.json()).code, 'CATCH_UP_LOCKED');
  await page.goto(`${origin}/modules/service-fictif`);
  await page
    .getByText(/Terminez d’abord vos rattrapages/)
    .first()
    .waitFor();
  await page.goto(`${origin}/modules/accueil-fictif`);
  await page.getByRole('heading', { name: 'Accueil fictif' }).first().waitFor();
  check('routier : module fermé refusé (403 CATCH_UP_LOCKED), module à rattraper ouvert');

  await page.goto(`${origin}/progression`);
  await page.getByText('Préparation au Départ routier').first().waitFor();
  await page.getByText('Fermé').first().waitFor();
  check('routier : étape normale conservée (aucune rétrogradation), modules de l’étape fermés');
  await context.close();
}

{
  const { context, page } = await session('assistant', 1280);
  await page.goto(`${origin}/modules/service-fictif`);
  await page.getByRole('heading', { name: 'Service fictif' }).first().waitFor();
  check('encadrement : aucun verrou');
  await context.close();
}

await browser.close();
assert.deepEqual(errors, [], `erreurs JavaScript : ${errors.join(' | ')}`);
console.log(`Recette rattrapages : ${checks}/${checks} contrôles réussis.`);

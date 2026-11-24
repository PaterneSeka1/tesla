/**
 * Contrôle automatique d'accessibilité (axe-core, règles WCAG 2.0 / 2.1 / 2.2 niveaux A et AA) des
 * écrans principaux : pages publiques, parcours routier, parcours chef, menu « Plus », à 390 et
 * 1280 px. Échec sur toute violation d'impact « serious » ou « critical » ; les autres sont listées.
 * Ne remplace pas une revue manuelle (lecteur d'écran, clavier réel). Base « _test » préparée par
 * `apps/api/test/offline-browser-fixture.mts` ; données fictives.
 *   PLAYWRIGHT_MODULE=… CHROMIUM_PATH=… AXE_PATH=…/axe.min.js WEB_ORIGIN=… API_ORIGIN=… \
 *   node apps/web/test/accessibilite.browser.mjs
 */
import { readFile } from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
const api = process.env.API_ORIGIN ?? 'http://localhost:4000/api/v1';
const axeSource = await readFile(process.env.AXE_PATH, 'utf8');
const PASSWORD = 'phrase-fictive-recette-phase5';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox'],
});
const blocking = [];
const minor = [];
let scanned = 0;

async function scan(page, label) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
  await page.addScriptTag({ content: axeSource });
  const result = await page.evaluate(
    (tags) => window.axe.run(document, { runOnly: { type: 'tag', values: tags } }),
    TAGS,
  );
  scanned++;
  for (const violation of result.violations) {
    const entry = `${label} — ${violation.id} (${violation.impact}) : ${violation.help} — ${violation.nodes
      .slice(0, 3)
      .map((node) => node.target.join(' '))
      .join(' | ')}`;
    (['serious', 'critical'].includes(violation.impact) ? blocking : minor).push(entry);
  }
}

async function context(width) {
  return browser.newContext({
    viewport: { width, height: width < 1024 ? 844 : 900 },
    reducedMotion: 'reduce',
    locale: 'fr-FR',
  });
}

async function login(ctx, email) {
  const page = await ctx.newPage();
  await page.goto(`${origin}/connexion`);
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: /se connecter/i }).click();
  await page.waitForURL(/\/accueil/);
  return page;
}

for (const width of [390, 1280]) {
  const anonymous = await (await context(width)).newPage();
  for (const path of ['/connexion', '/mot-de-passe-oublie']) {
    await anonymous.goto(`${origin}${path}`);
    await scan(anonymous, `${width}px ${path}`);
  }

  const routier = await login(await context(width), 'phase5@recette.test');
  const catalog = await (
    await routier.request.get(`${api}/modules/recette-hors-ligne`, {
      headers: { 'x-tesla-csrf': '1' },
    })
  ).json();
  for (const path of [
    '/accueil',
    '/modules',
    '/modules/recette-hors-ligne',
    `/modules/recette-hors-ligne/lecons/${catalog.lessons[0].id}`,
    '/progression',
    '/evaluations',
    '/compte',
    // Expérience immersive (D194–D200) : défis, une partie, carnet.
    '/defis',
    '/defis/textes',
    '/carnet',
  ]) {
    await routier.goto(`${origin}${path}`);
    await scan(routier, `${width}px routier ${path}`);
  }
  if (width < 1024) {
    await routier.getByRole('button', { name: /^Plus/ }).click();
    await routier.getByRole('dialog', { name: 'Plus' }).waitFor();
    await scan(routier, `${width}px routier menu « Plus »`);
  }

  const chef = await login(await context(width), 'chef-phase5@recette.test');
  const scouts = await (
    await chef.request.get(`${api}/scouts?page=1&pageSize=1`, { headers: { 'x-tesla-csrf': '1' } })
  ).json();
  const modules = await (
    await chef.request.get(`${api}/editor/modules?page=1&pageSize=1`, {
      headers: { 'x-tesla-csrf': '1' },
    })
  ).json();
  for (const path of [
    '/accueil',
    '/administration/routiers',
    `/administration/routiers/${scouts.items[0].id}`,
    '/administration/routiers/nouveau',
    '/administration/equipes',
    '/encadrement/modules',
    `/encadrement/modules/${modules.items[0].id}/modifier?section=contenu`,
  ]) {
    await chef.goto(`${origin}${path}`);
    await scan(chef, `${width}px chef ${path}`);
  }
}

await browser.close();
console.log(`Écrans analysés : ${scanned}`);
for (const entry of minor) console.log(`  [mineur] ${entry}`);
for (const entry of blocking) console.log(`  [BLOQUANT] ${entry}`);
if (blocking.length > 0) {
  console.error(`\n${blocking.length} violation(s) grave(s) ou critique(s).`);
  process.exit(1);
}
console.log(`\nAccessibilité : aucune violation grave ou critique (${minor.length} mineure(s)).`);

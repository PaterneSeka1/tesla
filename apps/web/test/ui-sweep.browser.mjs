/**
 * Balayage de l'interface (Chromium réel) : pour chaque profil fictif de la fixture offline-first
 * (routier, chef, responsable plein, administrateur), visite de chaque entrée du menu et des pages
 * personnelles, à sept largeurs. Contrôles : titre de page, aucun défilement horizontal, aucune
 * erreur JavaScript, aucun libellé technique (rôle interne, statut d'API, valeur brute).
 * Captures (390 et 1440 px) dans SHOT_DIR si défini.
 *   PLAYWRIGHT_MODULE=… OFFLINE_FIXTURE=… LINK_FILE=… [SHOT_DIR=…] node apps/web/test/ui-sweep.browser.mjs
 * LINK_FILE : sortie de `create-admin.js` (lien d'activation de l'administrateur fictif).
 */
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
const api = process.env.API_ORIGIN ?? 'http://localhost:4000/api/v1';
const shots = process.env.SHOT_DIR;
const PASSWORD = 'phrase-fictive-recette-phase5';
const ADMIN_PASSWORD = 'phrase-fictive-recette-balayage';
const WIDTHS = [320, 375, 390, 430, 768, 1024, 1440];
const SHOT_WIDTHS = new Set([390, 1440]);
// Libellés qui ne doivent jamais apparaître : rôles internes, détails d'infrastructure, valeurs brutes.
const TECHNICAL =
  /\b(ROUTIER|ENCADREMENT|ADMINISTRATEUR|undefined|NaN|\[object Object\]|statut API|serveur disponible|requête réussie|Internal Server Error)\b/;

// Sortie de create-admin : la ligne du lien (la suivante porte le code de secours, D162).
const link = (await readFile(process.env.LINK_FILE, 'utf8'))
  .split('\n')
  .find((line) => /^https?:\/\//.test(line.trim()))
  .trim();
const token = link.split('#')[1];
const activated = await fetch(`${api}/auth/account-link/complete`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-tesla-csrf': '1', Origin: origin },
  body: JSON.stringify({ token, password: ADMIN_PASSWORD }),
});
assert.equal(activated.status, 204, 'activation de l’administrateur fictif');
const adminEmail = process.env.ADMIN_EMAIL ?? 'admin-recette@recette.test';

const personas = [
  ['routier', 'phase5@recette.test', PASSWORD],
  ['chef', 'chef-phase5@recette.test', PASSWORD],
  ['responsable', 'responsable-offline@recette.test', PASSWORD],
  ['administrateur', adminEmail, ADMIN_PASSWORD],
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const problems = [];
let visits = 0;
if (shots) await mkdir(shots, { recursive: true });
try {
  for (const [persona, email, password] of personas) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${origin}/connexion`);
    await page.getByLabel('Adresse e-mail').fill(email);
    await page.getByLabel('Mot de passe', { exact: true }).fill(password);
    await page.getByRole('button', { name: /Se connecter/ }).click();
    await page.waitForURL('**/accueil');
    // Pages du menu (permissions effectives) + pages personnelles communes.
    const menu = await page
      .locator('nav a[href^="/"]')
      .evaluateAll((links) => links.map((a) => a.getAttribute('href')));
    const allowed = (p) =>
      p && !/^\/(connexion|api\/)|\/imprimer|\.pdf|#/.test(p) && !p.includes('?');
    const paths = [...new Set(['/accueil', ...menu, '/compte', '/appareil'])].filter(allowed);
    // Second niveau : liens internes des rubriques (listes, détails), au plus 40 pages par profil.
    for (const path of [...paths]) {
      await page.goto(`${origin}${path}`);
      await page.waitForLoadState('networkidle');
      const inner = await page
        .locator('main a[href^="/"]')
        .evaluateAll((links) => links.map((a) => a.getAttribute('href')));
      for (const href of inner)
        if (allowed(href) && !paths.includes(href) && paths.length < 40) paths.push(href);
    }
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: width < 768 ? 800 : 900 });
      for (const path of paths) {
        errors.length = 0;
        await page.goto(`${origin}${path}`);
        await page.waitForLoadState('networkidle');
        await page.locator('h1').first().waitFor({ timeout: 15_000 });
        visits++;
        const where = `${persona} ${path} @${width}px`;
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        if (overflow > 1) problems.push(`${where} : défilement horizontal (${overflow} px)`);
        const mains = await page.locator('main:visible').count();
        if (mains !== 1) problems.push(`${where} : ${mains} éléments <main>`);
        const text = await page.locator('main:visible').first().innerText();
        const technical = text.match(TECHNICAL);
        if (technical) problems.push(`${where} : libellé technique « ${technical[0]} »`);
        if (/Erreur|Une erreur est survenue|impossible de charger/i.test(text))
          problems.push(`${where} : message d’erreur affiché`);
        if (errors.length) problems.push(`${where} : erreur JavaScript ${errors[0]}`);
        if (shots && SHOT_WIDTHS.has(width))
          await page.screenshot({
            path: `${shots}/${persona}${path.replaceAll('/', '_')}-${width}.png`,
            fullPage: true,
          });
      }
    }
    console.log(`${persona} : ${paths.length} pages × ${WIDTHS.length} largeurs`);
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(`${visits} affichages contrôlés.`);
if (problems.length) {
  console.error(`${problems.length} problème(s) :\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('Aucun problème détecté.');

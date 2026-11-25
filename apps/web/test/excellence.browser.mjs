/**
 * Recette navigateur du chantier « excellence immersive » (D204–D209) : captures des écrans clés
 * aux largeurs mobiles et bureau, et vérifications de comportement (reprise exacte d'une activité
 * après actualisation, carte d'aventure, absence de défilement horizontal, erreurs de page).
 * Base « _test » préparée par `apps/api/test/immersive-browser-fixture.mts`.
 *   PLAYWRIGHT_MODULE=…/playwright-core/index.mjs CHROMIUM_PATH=… SHOTS_DIR=… \
 *   [ONLY_SHOTS=1] node apps/web/test/excellence.browser.mjs
 * `ONLY_SHOTS=1` : captures seulement (état initial, avant les modifications visuelles).
 */
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
const shots = process.env.SHOTS_DIR;
const onlyShots = process.env.ONLY_SHOTS === '1';
const PASSWORD = 'phrase-fictive-recette-immersive';
const account = (name) => `${name}-immersif@recette.test`;
const WIDTHS = (process.env.WIDTHS ?? '390').split(',').map(Number);

if (shots) await mkdir(shots, { recursive: true });
// Accessibilité automatique (axe-core, WCAG A/AA) des écrans nouveaux ou modifiés : facultative.
const axeSource = process.env.AXE_PATH ? await readFile(process.env.AXE_PATH, 'utf8') : null;
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const violations = [];
let scanned = 0;
async function scan(page, label) {
  if (!axeSource) return;
  await page.addScriptTag({ content: axeSource });
  const result = await page.evaluate(
    (tags) => window.axe.run(document, { runOnly: { type: 'tag', values: tags } }),
    TAGS,
  );
  scanned++;
  for (const violation of result.violations)
    violations.push(
      `${label} — ${violation.id} (${violation.impact}) : ${violation.nodes
        .slice(0, 3)
        .map((node) => node.target.join(' '))
        .join(' | ')}`,
    );
}
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox'],
});
const errors = [];
let checks = 0;
const check = (label) => console.log(`${++checks}. ${label}`);
const shot = (page, name, fullPage = true) =>
  shots ? page.screenshot({ path: `${shots}/${name}.png`, fullPage }) : Promise.resolve();
const noHorizontalScroll = async (page, label) =>
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    `défilement horizontal : ${label}`,
  );

async function session(name, width = 390) {
  const context = await browser.newContext({
    viewport: { width, height: width < 700 ? 844 : 900 },
    reducedMotion: 'reduce',
    locale: 'fr-FR',
    hasTouch: width < 700,
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`${name}@${width} : ${error.message}`));
  await page.goto(`${origin}/connexion`);
  await page.getByLabel('Adresse e-mail').fill(account(name));
  await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: /se connecter/i }).click();
  await page.waitForURL('**/accueil');
  // Présentation de première visite : passée si elle s'affiche.
  const skip = page.getByRole('button', { name: /passer|plus tard|commencer/i }).first();
  if (await skip.isVisible().catch(() => false)) await skip.click();
  return { context, page };
}

const settle = (page) => page.waitForLoadState('networkidle').catch(() => {});

for (const width of WIDTHS) {
  const tag = `${width}`;
  const { context, page } = await session('routier', width);
  const screens = [
    ['accueil', '/accueil'],
    ['module', '/modules/recette-entrainement'],
    ['module-catalogue', '/modules'],
    ['defis', '/defis'],
    ['ascension', '/defis/ascension'],
    ['memoire', '/defis/memoire'],
    ['frises', '/defis/frises'],
    ['cartes', '/defis/cartes'],
    ['carnet', '/carnet'],
  ];
  for (const [name, path] of screens) {
    await page.goto(`${origin}${path}`);
    await settle(page);
    await page.waitForTimeout(400);
    await shot(page, `${tag}-routier-${name}`);
    if (!onlyShots) await noHorizontalScroll(page, `${name}@${width}`);
    if (!onlyShots && width === 390) await scan(page, name);
  }
  check(`routier ${width} px : ${screens.length} écrans capturés`);
  await context.close();
}

if (!onlyShots) {
  // Reprise exacte d'une activité interrompue (D204) : réponse donnée, actualisation, même état.
  const { context, page } = await session('routier', 390);
  await page.goto(`${origin}/defis/vrai-faux`);
  await settle(page);
  const start = page.getByRole('button', { name: /c’est parti/i });
  if (await start.isVisible().catch(() => false)) await start.click();
  const group = page.getByRole('group', { name: 'Propositions' });
  await group.getByRole('button').first().click();
  await page.getByRole('status').first().waitFor();
  await page.waitForTimeout(700);
  await page.reload();
  await settle(page);
  await page.getByRole('status').first().waitFor({ timeout: 10_000 });
  assert.ok(
    await group.getByRole('button').first().isDisabled(),
    'la réponse donnée avant actualisation est reprise',
  );
  check('activité : réponse en cours reprise après actualisation');

  // Carte d'aventure : haltes cliquables, vue liste conservée.
  await page.goto(`${origin}/modules/recette-entrainement`);
  await settle(page);
  const map = page.getByRole('region', { name: /haltes/i });
  const links = map.getByRole('link');
  assert.ok((await links.count()) >= 3, 'haltes de la carte');
  await page.getByRole('button', { name: 'Liste' }).click();
  assert.ok((await map.getByRole('link').count()) >= 3, 'vue liste');
  await page.getByRole('button', { name: 'Carte' }).click();
  check('carte d’aventure : haltes accessibles, bascule liste / carte');

  // Enquête (D206) : indices révélés un à un, erreur sans blocage, solution expliquée.
  await page.goto(`${origin}/defis/enquetes`);
  await settle(page);
  const go = page.getByRole('button', { name: /c’est parti/i });
  if (await go.isVisible().catch(() => false)) await go.click();
  const notebook = page.getByRole('region', { name: 'Carnet d’enquête' });
  assert.equal(await notebook.getByRole('listitem').count(), 1, 'un seul indice au départ');
  await page.getByRole('button', { name: /indice suivant/i }).click();
  assert.equal(await notebook.getByRole('listitem').count(), 2, 'indice révélé');
  await shot(page, '390-routier-enquete');
  await scan(page, 'enquête');
  await page.getByRole('button', { name: 'Personnage A' }).click();
  await page.getByText('Pas encore. Relisez les indices.').waitFor();
  await page.getByRole('button', { name: 'Personnage B' }).click();
  await page.getByText(/Solution fictive/).waitFor();
  await shot(page, '390-routier-enquete-resolue');
  check('enquête : indices progressifs, nouvel essai, solution expliquée');

  // Frise (D206) : repères temporels révélés seulement à la vérification.
  await page.goto(`${origin}/defis/frises?module=recette-entrainement`);
  await settle(page);
  const frise = page.getByRole('list', { name: 'Frise chronologique' });
  if (await frise.isVisible().catch(() => false)) {
    assert.equal(await frise.getByText('1907').count(), 0, 'date cachée avant vérification');
    await page.getByRole('button', { name: 'Vérifier' }).click();
    await frise.getByText('1907').waitFor();
    await shot(page, '390-routier-frise');
    check('frise : repères révélés à la vérification');
  } else console.log('   (frise non tirée dans cette partie : vérifiée par les tests unitaires)');

  // Expédition (D207) : halte lue, retour automatique, reprise après actualisation.
  await page.goto(`${origin}/modules/recette-entrainement`);
  await settle(page);
  await page.getByRole('link', { name: 'Partir en expédition' }).click();
  await page.waitForURL('**/expedition');
  await settle(page);
  await shot(page, '390-routier-expedition');
  await scan(page, 'expédition');
  await page.getByRole('link', { name: /lire la halte|relire/i }).click();
  await page.waitForURL('**/lecons/**');
  for (let index = 0; index < 25; index++) {
    const back = page.getByRole('link', { name: 'Continuer l’expédition' });
    if (await back.isVisible().catch(() => false)) break;
    const next = page.getByRole('button', { name: /^(continuer|passer|suivant)/i }).last();
    if (!(await next.isVisible().catch(() => false))) {
      await page.mouse.wheel(0, 2000);
      await page.waitForTimeout(200);
      continue;
    }
    await next.click();
    await page.waitForTimeout(250);
  }
  await page.getByRole('link', { name: 'Continuer l’expédition' }).click();
  await page.waitForURL(/\/expedition$/);
  await settle(page);
  const stepAfter = await page.locator('main').innerText();
  assert.ok(!/Halte 1\b/.test(stepAfter), 'la halte lue est franchie');
  await page.reload();
  await settle(page);
  assert.equal(
    await page.locator('main').innerText(),
    stepAfter,
    'expédition reprise à l’identique',
  );
  await shot(page, '390-routier-expedition-suite');
  check('expédition : halte lue, retour, reprise après actualisation');

  // Carnet personnel (D209) : favori et note depuis le lecteur, visibles dans le carnet.
  await page.goto(`${origin}/modules/recette-entrainement`);
  await settle(page);
  await page.getByRole('button', { name: 'Liste' }).click();
  await page
    .getByRole('region', { name: /haltes/i })
    .getByRole('link')
    .first()
    .click();
  await page.waitForURL('**/lecons/**');
  await settle(page);
  const favorite = page.getByRole('button', { name: /ajouter aux favoris|retirer des favoris/i });
  if ((await favorite.getAttribute('aria-pressed')) !== 'true') await favorite.click();
  await page.getByRole('button', { name: 'Retirer des favoris' }).waitFor();
  await page.getByRole('button', { name: /prendre une note|ma note/i }).click();
  await page.getByLabel('Ma note sur cette leçon').fill('Note fictive de recette.');
  await shot(page, '390-routier-note', false);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await noHorizontalScroll(page, 'lecteur avec favoris et note');
  await page.goto(`${origin}/carnet`);
  await settle(page);
  await page.getByText(/Mes notes · 1/).click();
  await page.getByText('Note fictive de recette.').waitFor();
  await shot(page, '390-routier-carnet-notes');
  await scan(page, 'carnet (notes ouvertes)');
  check('carnet : favori et note privée enregistrés depuis le lecteur');
  await context.close();
}

// Hors ligne (D207, D209) : appareil activé, puis expédition, défi et carnet sans réseau.
if (!onlyShots) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
    locale: 'fr-FR',
    hasTouch: true,
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`hors ligne : ${error.message}`));
  await page.goto(`${origin}/connexion`);
  await page.getByLabel('Adresse e-mail').fill(account('routier'));
  await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Utiliser aussi cet appareil sans connexion').check();
  await page.getByRole('button', { name: /se connecter/i }).click();
  await page.waitForURL('**/appareil?preparer=1');
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, {
    timeout: 30_000,
  });
  const ready = page
    .getByText(/Prêt pour une utilisation sans connexion\.|Préparation incomplète/)
    .first();
  await ready.waitFor({ timeout: 240_000 });
  assert.match(
    await ready.innerText(),
    /Prêt pour une utilisation sans connexion/,
    'préparation complète',
  );
  await context.setOffline(true);
  await page.goto(`${origin}/modules/recette-entrainement/expedition`);
  await page.getByRole('progressbar', { name: 'Progression de l’expédition' }).waitFor();
  await shot(page, '390-hors-ligne-expedition');
  await page.goto(`${origin}/defis/enquetes`);
  const rules = page.getByRole('button', { name: /c’est parti/i });
  await rules
    .or(page.getByText('Retrouver le personnage fictif décrit par les indices.'))
    .first()
    .waitFor();
  if (await rules.isVisible()) await rules.click();
  await page.getByText('Retrouver le personnage fictif décrit par les indices.').waitFor();
  await page.goto(`${origin}/carnet`);
  await page.getByText(/Mes notes · 1/).waitFor();
  await context.setOffline(false);
  check('hors ligne : expédition, enquête et carnet (notes) rouverts sans réseau');
  await context.close();
}

// Encadrement : tableau communautaire et éditeur (captures mobile et bureau).
for (const width of WIDTHS) {
  const { context, page } = await session('plein', width);
  for (const [name, path] of [
    ['parcours', '/administration/parcours'],
    ['modules', '/encadrement/modules'],
  ]) {
    await page.goto(`${origin}${path}`);
    await settle(page);
    await page.waitForTimeout(300);
    await shot(page, `${width}-plein-${name}`);
    if (!onlyShots) await noHorizontalScroll(page, `${name}@${width} (plein)`);
    if (!onlyShots && width === 390) await scan(page, `${name} (plein)`);
  }
  check(`encadrement ${width} px : tableau communautaire et modules capturés`);
  await context.close();
}

await browser.close();
if (axeSource)
  console.log(`Accessibilité : ${scanned} écrans analysés, ${violations.length} violation(s).`);
assert.deepEqual(violations, [], `violations d'accessibilité :\n${violations.join('\n')}`);
assert.deepEqual(errors, [], `erreurs de page :\n${errors.join('\n')}`);
console.log(`Recette excellence : ${checks} vérifications réussies.`);

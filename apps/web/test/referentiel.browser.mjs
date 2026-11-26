/**
 * Recette navigateur du référentiel scout (D220–D222) : rubriques, cérémonies (fiche, Mon rôle,
 * préparation, mode cérémonie), prière (mémorisation), enregistrement de test et paroles
 * synchronisées (défilement, sélection d'une phrase, déplacement, vitesse, chant collectif), lecture
 * sans réseau, largeurs 320 à 1280 px, absence de défilement horizontal. Données préparées sur une
 * base de développement isolée (contenus publiés par le compte du responsable plein de
 * démonstration, enregistrement **synthétique** « non officiel »). Le fichier audio est servi par
 * interception (`AUDIO_FILE`), le stockage objet n'étant pas configuré en développement.
 *   PLAYWRIGHT_MODULE=… CHROMIUM_PATH=… WEB_ORIGIN=http://localhost:3100 EMAIL=… PASSWORD=… \
 *   AUDIO_FILE=…/tonalites.wav SHOTS=…/captures node apps/web/test/referentiel.browser.mjs
 */
import { mkdir, readFile } from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3100';
const shots = process.env.SHOTS;
const audio = await readFile(process.env.AUDIO_FILE);
if (shots) await mkdir(shots, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const results = [];
const check = (label, ok, detail = '') => {
  results.push({ label, ok });
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const shot = (page, name) =>
  shots ? page.screenshot({ path: `${shots}/${name}.png`, fullPage: false }) : null;
const noHorizontalScroll = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
// Stockage objet émulé avec requêtes partielles (comme R2) : indispensable au déplacement dans l'audio.
await context.route('**/api/v1/module-files/**', (route) => {
  const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range ?? '');
  if (!range) {
    return route.fulfill({
      status: 200,
      headers: { 'content-type': 'audio/wav', 'accept-ranges': 'bytes' },
      body: audio,
    });
  }
  const start = Number(range[1]);
  const end = range[2] ? Math.min(Number(range[2]), audio.length - 1) : audio.length - 1;
  return route.fulfill({
    status: 206,
    headers: {
      'content-type': 'audio/wav',
      'accept-ranges': 'bytes',
      'content-range': `bytes ${start}-${end}/${audio.length}`,
    },
    body: audio.subarray(start, end + 1),
  });
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

await page.goto(`${origin}/connexion`);
await page.getByLabel(/e-mail/i).fill(process.env.EMAIL);
await page
  .getByLabel(/mot de passe/i)
  .first()
  .fill(process.env.PASSWORD);
await page.getByRole('button', { name: /se connecter/i }).click();
await page.waitForURL(/accueil/, { timeout: 60_000 });

// Rubriques
await page.goto(`${origin}/referentiel`);
await page.getByRole('heading', { name: 'Cérémonies' }).waitFor({ timeout: 60_000 });
const headings = await page.locator('main h2').allInnerTexts();
check(
  'rubriques non vides seulement',
  !headings.includes('Rubrique vide de recette'),
  headings.join(', '),
);
check(
  'neuf fiches du cérémonial listées',
  (await page.getByRole('link', { name: /^(La c|C)érémonie/ }).count()) === 9,
);
await shot(page, '01-referentiel-390');

// Recherche (texte des cérémonies)
await page.getByLabel(/Rechercher/).fill('Akwaba');
await page
  .getByText(/traditionnel Akwaba/)
  .first()
  .waitFor({ timeout: 20_000 });
check('recherche dans le texte', true);
await page.getByLabel(/Rechercher/).fill('');

// Fiche : cérémonie d'accueil
await page.getByRole('link', { name: 'La cérémonie d’accueil' }).click();
await page.getByText('Route pour…').first().waitFor();
check(
  'intervenants affichés tels qu’écrits',
  (await page.getByText('Le CC', { exact: true }).count()) >= 3,
);
check(
  'indication scénique en italique',
  await page
    .getByText(/porte au nouveau routier le foulard/)
    .evaluate((el) => getComputedStyle(el.closest('div')).fontStyle === 'italic'),
);
check('aucun défilement horizontal (fiche)', await noHorizontalScroll(page));
await shot(page, '02-fiche-accueil');

await page.getByRole('button', { name: 'Mon rôle' }).click();
await page.getByLabel('Mon rôle dans cette cérémonie').selectOption('Routiers');
check(
  'mode Mon rôle : repère avant la réplique',
  (await page.getByText('Avant votre réplique').count()) >= 1,
);
await shot(page, '03-mon-role');

await page.getByRole('button', { name: 'Préparation' }).click();
const points = page.getByRole('checkbox');
check('préparation : phrases du document', (await points.count()) === 2);
await points.first().check();
await page.reload();
await page.getByRole('button', { name: 'Préparation' }).click();
check('préparation conservée sur l’appareil', await page.getByRole('checkbox').first().isChecked());

await page.getByRole('button', { name: 'Mode cérémonie' }).click();
const stage = page.getByRole('dialog', { name: /Mode cérémonie/ });
await stage.waitFor();
await stage.getByRole('button', { name: 'Suivant' }).click();
await stage.getByRole('button', { name: 'Suivant' }).click();
await page.keyboard.press('ArrowRight');
const position = await stage.locator('footer span').first().innerText();
check('mode cérémonie : navigation', position.startsWith('4 /'), position);
await stage.getByRole('button', { name: 'Agrandir le texte' }).click();
await shot(page, '04-mode-ceremonie');
await page.keyboard.press('Escape');
await page.getByRole('button', { name: 'Mode cérémonie' }).click();
check(
  'mode cérémonie : reprise de la position',
  (await stage.locator('footer span').first().innerText()).startsWith('4 /'),
);
await page.keyboard.press('Escape');

// Lecture intégrale
await page.goto(`${origin}/referentiel`);
await page.getByRole('link', { name: 'Cérémonial de la Route' }).click();
await page.getByRole('link', { name: 'Lecture intégrale' }).click();
await page.locator('article section[aria-labelledby^="fiche-"]').nth(8).waitFor();
check(
  'lecture intégrale : neuf cérémonies',
  (await page.locator('article section[aria-labelledby^="fiche-"]').count()) === 9,
);

// Prière scoute
await page.goto(`${origin}/referentiel`);
await page.getByRole('link', { name: 'Prière scoute' }).click();
await page.getByText('À donner sans compter,').waitFor();
check(
  'prière scoute : texte exact',
  (await page.getByText("À nous dépenser, sans attendre d'autre récompense,").count()) === 1,
);
await page.getByText('Apprendre par cœur').click();
await page.getByRole('button', { name: 'Remettre en ordre' }).click();
await page.getByRole('button', { name: 'Seigneur Jésus, apprenez-nous :' }).click();
check('remise en ordre sans score', (await page.getByText(/score|points|XP/i).count()) === 0);
await shot(page, '05-priere');

// Enregistrement de test et paroles synchronisées
await page.goto(`${origin}/referentiel`);
await page.getByRole('link', { name: /Enregistrement de test/ }).click();
const player = page.getByRole('region', { name: /Enregistrement/ });
await player.waitFor();
await page.getByRole('button', { name: 'Lecture' }).click();
await page.waitForTimeout(1500);
const playing = await page.evaluate(() => !document.querySelector('audio').paused);
check('lecture audio', playing);
await page.evaluate(() => {
  document.querySelector('audio').currentTime = 8.5;
});
await page.waitForTimeout(600);
const active = await page.locator('[aria-current="true"]').first().innerText();
check('phrase active recalculée après déplacement', active.includes('troisième'), active);
await page
  .getByRole('button', { name: /quatrième/ })
  .first()
  .click();
await page.waitForTimeout(500);
const time = await page.evaluate(() => document.querySelector('audio').currentTime);
check('sélection d’une phrase déplace la lecture', time >= 12 && time < 13.5, String(time));
await page.getByLabel('Vitesse').first().selectOption('1.25');
check(
  'vitesse réelle appliquée',
  (await page.evaluate(() => document.querySelector('audio').playbackRate)) === 1.25,
);
await page.getByRole('button', { name: 'Pause' }).click();
const paused = await page.locator('[aria-current="true"]').first().innerText();
await page.waitForTimeout(800);
check(
  'pause : phrase figée',
  (await page.locator('[aria-current="true"]').first().innerText()) === paused,
);
await page.getByRole('button', { name: 'Paroles intégrales' }).click();
check(
  'paroles intégrales : refrain signalé',
  (await page.getByText('Refrain', { exact: true }).count()) >= 1,
);
await shot(page, '06-lecteur');
await page.getByRole('button', { name: /Chant collectif/ }).click();
await page.getByRole('dialog', { name: /Chant collectif/ }).waitFor();
await shot(page, '07-chant-collectif');
await page.keyboard.press('Escape');

// Largeurs
for (const width of [320, 360, 430, 768, 1280]) {
  await page.setViewportSize({ width, height: 900 });
  for (const path of ['/referentiel']) {
    await page.goto(`${origin}${path}`);
    await page.getByRole('heading', { name: 'Cérémonies' }).waitFor();
    check(`sans défilement horizontal ${width} px`, await noHorizontalScroll(page));
  }
  if (width === 320) await shot(page, '08-referentiel-320');
  if (width === 1280) await shot(page, '09-referentiel-1280');
}

// Hors ligne : le texte déjà consulté reste lisible (service worker : build de production seulement).
if (process.env.PRODUCTION === '1') {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/appareil`);
  await page.getByLabel('Mot de passe', { exact: true }).fill(process.env.PASSWORD);
  await page.getByRole('button', { name: 'Préparer cet appareil' }).click();
  await page
    .getByText(/Prêt pour une utilisation sans connexion\.|Préparation incomplète/)
    .first()
    .waitFor({ timeout: 180_000 });
  check(
    'appareil préparé (référentiel compris)',
    (await page.getByText('Prêt pour une utilisation sans connexion.').count()) > 0,
  );
  await page.goto(`${origin}/referentiel`);
  await page.getByRole('link', { name: /Enregistrement de test/ }).click();
  await page.getByRole('button', { name: 'Télécharger pour écouter hors ligne' }).click();
  await page.getByText(/Disponible hors ligne/).waitFor({ timeout: 30_000 });
  check('enregistrement téléchargé sur l’appareil', true);
  const songUrl = page.url();
  await context.setOffline(true);
  await page.goto(`${origin}/referentiel`);
  const offlineOk = await page
    .getByRole('heading', { name: 'Cérémonies' })
    .waitFor({ timeout: 20_000 })
    .then(() => true)
    .catch(() => false);
  check('référentiel sans réseau', offlineOk);
  await page.getByRole('link', { name: 'Cérémonie de remise de l’étoile dorée' }).click();
  check(
    'fiche sans réseau',
    await page
      .getByText(/signe de bravoure et de succès/)
      .waitFor({ timeout: 20_000 })
      .then(() => true)
      .catch(() => false),
  );
  await page.goto(`${origin}/referentiel`);
  await page.getByRole('link', { name: 'Prière scoute' }).click();
  check(
    'prière sans réseau',
    await page
      .getByText('À donner sans compter,')
      .waitFor({ timeout: 20_000 })
      .then(() => true)
      .catch(() => false),
  );
  await page.goto(songUrl);
  await page.getByRole('button', { name: 'Lecture' }).click();
  await page.waitForTimeout(1200);
  const local = await page.evaluate(() => {
    const element = document.querySelector('audio');
    return { blob: element.currentSrc.startsWith('blob:'), playing: !element.paused };
  });
  check(
    'écoute hors ligne depuis la copie locale',
    local.blob && local.playing,
    JSON.stringify(local),
  );
  await shot(page, '10-hors-ligne');
  await context.setOffline(false);
} else console.log('– hors ligne : non vérifié (service worker inactif hors build de production)');

check('aucune erreur JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} contrôles réussis`);
process.exit(failed.length ? 1 : 0);

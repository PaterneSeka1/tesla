/**
 * Recette : le logo s'affiche hors connexion même quand les copies optimisées (`/_next/image`)
 * ne sont plus disponibles (affichées avant que le service worker contrôle la page, copie du
 * cache HTTP expirée). Coupure réelle : toute requête réseau, y compris celles du service worker,
 * est abandonnée (`context.route`) ; seules les réponses du cache du service worker restent.
 * Base « _test » préparée par `apps/api/test/offline-browser-fixture.mts` ; données fictives.
 *   PLAYWRIGHT_MODULE=… CHROMIUM_PATH=… WEB_ORIGIN=… node apps/web/test/logo-hors-ligne.browser.mjs
 */
import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox'],
});
let checks = 0;
const check = (label) => console.log(`${++checks}. ${label}`);
const LOGO = 'img[alt^="Logo de la Communauté"]';
const visibleLogos = (page) =>
  page.evaluate(
    (selector) =>
      [...document.querySelectorAll(selector)]
        .filter((img) => img.offsetParent !== null)
        .map((img) => ({ src: img.currentSrc, loaded: img.complete && img.naturalWidth > 0 })),
    LOGO,
  );

try {
  for (const width of [390, 1280]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      deviceScaleFactor: width < 1024 ? 3 : 1,
      reducedMotion: 'reduce',
      locale: 'fr-FR',
    });
    const page = await context.newPage();
    // En ligne : connexion, service worker actif et contrôlant la page, accueil mis en cache.
    await page.goto(`${origin}/connexion`);
    await page.getByLabel('Adresse e-mail').fill('phase5@recette.test');
    await page.getByLabel('Mot de passe', { exact: true }).fill('phrase-fictive-recette-phase5');
    await page.getByRole('button', { name: /se connecter/i }).click();
    await page.waitForURL(/\/accueil/);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await page.getByRole('heading', { name: 'Accueil', exact: true }).waitFor();

    // Copies optimisées absentes ou expirées : seul ce que le service worker a préchargé reste.
    await page.evaluate(async () => {
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const request of await cache.keys())
          if (new URL(request.url).pathname.startsWith('/_next/image')) await cache.delete(request);
      }
    });
    await (await context.newCDPSession(page)).send('Network.clearBrowserCache');

    // Coupure réelle (page et service worker), puis écrans ouverts sans réseau : connexion (écran
    // d'ouverture de l'application installée) et page de secours, tous deux préchargés.
    await context.route('**/*', (route) => route.abort('internetdisconnected'));
    await context.setOffline(true);
    for (const path of ['/connexion', '/hors-ligne']) {
      await page.goto(`${origin}${path}`);
      await page.waitForLoadState('load');
      await page
        .waitForFunction(
          (selector) => {
            const logos = [...document.querySelectorAll(selector)].filter(
              (img) => img.offsetParent !== null,
            );
            return logos.length > 0 && logos.every((img) => img.complete);
          },
          LOGO,
          { timeout: 10_000 },
        )
        .catch(() => {});
      const logos = await visibleLogos(page);
      assert.ok(logos.length > 0, `aucun logo visible sur ${path}`);
      for (const logo of logos)
        assert.ok(logo.loaded, `logo non chargé hors connexion sur ${path} : ${logo.src}`);
      check(`${width} px, ${path} : logo affiché hors connexion`);
    }
    await context.close();
  }
  console.log(`\nRecette logo hors ligne : ${checks}/${checks} contrôles réussis.`);
} finally {
  await browser.close();
}

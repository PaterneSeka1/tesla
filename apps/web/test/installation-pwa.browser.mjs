/**
 * Recette : invitation à installer l'application (D184), sans API ni données (page de connexion).
 * iPhone émulé sous WebKit, Android émulé sous Chromium ; l'invitation native de Chromium
 * (`beforeinstallprompt`) est simulée, un navigateur sans interface ne l'émettant pas.
 *   PLAYWRIGHT_MODULE=… CHROMIUM_PATH=… WEB_ORIGIN=… node apps/web/test/installation-pwa.browser.mjs
 */
import assert from 'node:assert/strict';

const { chromium, webkit, devices } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

let checks = 0;
const check = (label) => console.log(`${++checks}. ${label}`);
const DIALOG = 'Installer Nikola Tesla Académie';
const dialog = (page) => page.getByRole('dialog', { name: DIALOG });
const absent = async (page, label) => {
  await page.waitForTimeout(2000);
  assert.equal(await dialog(page).count(), 0, label);
};
/**
 * Session fictive (aucune API, aucune donnée réelle) : `/auth/me` répond un routier inventé, toute
 * autre lecture échoue proprement. Suffit à afficher le menu.
 */
const fakeSession = async (context) => {
  // Le proxy Next ne vérifie que la présence du cookie ; l'API simulée fait le reste.
  await context.addCookies([{ name: SESSION_COOKIE, value: 'fictif', url: origin }]);
  await context.route('**/api/v1/**', (route) =>
    route.request().url().endsWith('/auth/me')
      ? route.fulfill({
          json: {
            user: {
              id: '00000000-0000-7000-8000-000000000001',
              email: 'routier.fictif@example.invalid',
              firstName: 'Routier',
              lastName: 'Fictif',
              role: 'ROUTIER',
              scoutProfileId: null,
              leaderFunction: null,
              permissions: ['progression.readOwn', 'module.read', 'evaluation.take'],
            },
          },
        })
      : route.fulfill({
          status: 404,
          json: { statusCode: 404, code: 'NOT_FOUND', message: 'Introuvable.' },
        }),
  );
};
const SESSION_COOKIE = process.env.SESSION_COOKIE ?? 'tesla_session';
const INSTALL_ENTRY = 'Installer l’application';
const noHorizontalScroll = async (page, label) =>
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    `défilement horizontal : ${label}`,
  );

// ─── iPhone (WebKit) ─────────────────────────────────────────────────────────────────────────
const safari = await webkit.launch();
{
  const context = await safari.newContext({ ...devices['iPhone 13'] });
  const page = await context.newPage();
  await page.goto(`${origin}/connexion`);
  await dialog(page).waitFor();
  await page.getByText('Sur l’écran d’accueil').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Installer' }).count(), 0);
  await noHorizontalScroll(page, 'iPhone');
  check('iPhone : étapes Partager → Sur l’écran d’accueil → Ajouter');

  await page.getByRole('button', { name: 'Plus tard' }).click();
  await dialog(page).waitFor({ state: 'detached' });
  await page.reload();
  await absent(page, '« Plus tard » vaut pour l’onglet');
  check('iPhone : « Plus tard » respecté jusqu’à la fermeture de l’onglet');

  const next = await context.newPage();
  await next.goto(`${origin}/connexion`);
  await dialog(next).waitFor();
  await next.getByRole('button', { name: 'Elle est déjà installée' }).click();
  const again = await context.newPage();
  await again.goto(`${origin}/connexion`);
  await absent(again, 'déjà installée : plus d’invitation');
  check('iPhone : nouvel onglet ⇒ nouvelle invitation ; « déjà installée » mémorisé');
  await context.close();
}
{
  const context = await safari.newContext({ ...devices['iPhone 13'] });
  const page = await context.newPage();
  await page.goto(`${origin}/activation`);
  await absent(page, 'lien d’activation : jeton préservé');
  check('iPhone : aucune invitation sur un lien d’activation');
  await context.close();
}
{
  const context = await safari.newContext({ ...devices['iPhone 13'] });
  await context.addInitScript(() =>
    Object.defineProperty(navigator, 'standalone', { value: true }),
  );
  const page = await context.newPage();
  await page.goto(`${origin}/connexion`);
  await absent(page, 'application installée ouverte');
  check('iPhone : aucune invitation dans l’application installée');
  await context.close();
}
{
  const iphone = devices['iPhone 13'];
  const context = await safari.newContext({
    ...iphone,
    userAgent: `${iphone.userAgent} [FBAN/FBIOS;FBAV/500.0]`,
  });
  const page = await context.newPage();
  await page.goto(`${origin}/connexion`);
  await dialog(page).waitFor();
  await page.getByText('Ouvrir dans le navigateur').waitFor();
  check('Navigateur intégré (Facebook) : ouvrir dans Safari');
  await context.close();
}

// ─── Entrée de menu « Installer l'application » (navigateur seulement) ──────────────────────
{
  const context = await safari.newContext({ ...devices['iPhone 13'] });
  await fakeSession(context);
  const page = await context.newPage();
  await page.goto(`${origin}/accueil`);
  await dialog(page).waitFor();
  await page.getByRole('button', { name: 'Plus tard' }).click();
  await page.getByRole('button', { name: 'Plus', exact: true }).click();
  await page.getByRole('button', { name: INSTALL_ENTRY }).click();
  await dialog(page).waitFor();
  await page.getByText('Sur l’écran d’accueil').waitFor();
  check('iPhone, navigateur : « Plus » → « Installer l’application » rouvre l’invitation');
  await context.close();
}
{
  const context = await safari.newContext({ ...devices['iPhone 13'] });
  await fakeSession(context);
  await context.addInitScript(() =>
    Object.defineProperty(navigator, 'standalone', { value: true }),
  );
  const page = await context.newPage();
  await page.goto(`${origin}/accueil`);
  await page.getByRole('button', { name: 'Plus', exact: true }).click();
  await page.getByRole('button', { name: 'Se déconnecter' }).waitFor();
  assert.equal(await page.getByRole('button', { name: INSTALL_ENTRY }).count(), 0);
  check('iPhone, application installée : aucune entrée « Installer l’application »');
  await context.close();
}
await safari.close();

// ─── Android (Chromium) ──────────────────────────────────────────────────────────────────────
const chrome = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox'],
});
{
  const context = await chrome.newContext({ ...devices['Pixel 7'] });
  const page = await context.newPage();
  await page.goto(`${origin}/connexion`);
  await absent(page, 'sans invitation native (déjà installée ou incompatible)');
  check('Android : rien sans invitation native du navigateur');

  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    window.__promptCalls = 0;
    event.prompt = async () => {
      window.__promptCalls += 1;
    };
    event.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(event);
  });
  await dialog(page).waitFor();
  await page.getByRole('button', { name: 'Installer' }).click();
  await dialog(page).waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => window.__promptCalls), 1);
  check('Android : bouton « Installer » ⇒ installation native du navigateur');
  await context.close();
}
{
  const context = await chrome.newContext({ viewport: { width: 1280, height: 800 } });
  await fakeSession(context);
  const page = await context.newPage();
  await page.goto(`${origin}/accueil`);
  await page.getByRole('button', { name: 'Se déconnecter' }).waitFor();
  assert.equal(await page.getByRole('button', { name: INSTALL_ENTRY }).count(), 0);
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = async () => {};
    event.userChoice = Promise.resolve({ outcome: 'dismissed' });
    window.dispatchEvent(event);
  });
  await dialog(page).waitFor();
  await page.getByRole('button', { name: 'Plus tard' }).click();
  await page.getByRole('button', { name: INSTALL_ENTRY }).click();
  await page.getByRole('button', { name: 'Installer', exact: true }).waitFor();
  check(
    'Ordinateur : entrée dans le menu latéral seulement si le navigateur propose l’installation',
  );
  await context.close();
}
await chrome.close();

console.log(`\n${checks} vérifications réussies.`);

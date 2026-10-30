/**
 * Recette navigateur des comptes (D118–D121) : activation par lien à usage unique, connexion,
 * gestion des comptes, compte personnel. API et web de production sur une base « _test » ; lien
 * produit par la commande d'installation (comptes fictifs) :
 *   DATABASE_URL=…/tesla_test node apps/api/dist/jobs/create-admin.js --email admin-recette@recette.test \
 *     --web-url http://localhost:3000 > /chemin/lien.txt
 *   PLAYWRIGHT_MODULE=… CHROMIUM_PATH=… LINK_FILE=/chemin/lien.txt NEW_PASSWORD=… [VIEWPORT_WIDTH=1280] \
 *     node apps/web/test/accounts.browser.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
const width = Number(process.env.VIEWPORT_WIDTH ?? 390);
const link = (await readFile(process.env.LINK_FILE, 'utf8')).trim().split('\n').pop();
const PASSWORD = process.env.NEW_PASSWORD ?? 'phrase-fictive-recette-comptes';
const staffEmail = `encadrant-${Date.now()}@recette.test`;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox'],
});
const context = await browser.newContext({ viewport: { width, height: 844 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
let n = 0;
const check = (label) => console.log(`${++n}. ${label}`);
const noScroll = async (label) => {
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  assert(w <= width, `${label} : défilement horizontal ${w}`);
};
try {
  await page.goto(link);
  await page.getByRole('heading', { name: /Activer votre compte|Nouveau mot de passe/ }).waitFor();
  await noScroll('activation');
  await page.getByLabel('Mot de passe', { exact: true }).fill('court');
  await page.getByLabel('Confirmation').fill('autre');
  await page.getByRole('button', { name: 'Enregistrer le mot de passe' }).click();
  await page
    .getByText(/au moins 12 caractères/)
    .first()
    .waitFor();
  check('mot de passe trop court refusé côté formulaire');
  await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirmation').fill(PASSWORD);
  await page.getByRole('button', { name: 'Enregistrer le mot de passe' }).click();
  await page.getByText('Mot de passe enregistré').waitFor();
  assert.equal(new URL(page.url()).hash, '', 'jeton encore dans l’adresse');
  check('activation réussie, jeton retiré de l’adresse');
  await page.goto('about:blank');
  await page.goto(link);
  await page.getByText('Lien inutilisable').waitFor();
  check('lien déjà utilisé refusé');

  await page.goto(`${origin}/connexion`);
  await page.getByLabel('Adresse e-mail').fill('admin-recette@recette.test');
  await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await page.waitForURL('**/accueil');
  check('connexion de l’administrateur, arrivée sur l’accueil');

  await page.goto(`${origin}/administration/comptes`);
  await page.getByRole('heading', { name: 'Comptes' }).waitFor();
  await page.getByRole('button', { name: 'Nouveau compte' }).click();
  await page.getByLabel('Adresse e-mail').fill(staffEmail);
  await page.getByLabel('Prénom').fill('Fictif');
  await page.getByLabel(/^Nom/).fill('Encadrant');
  await page.getByLabel('Accès').selectOption('ENCADREMENT');
  await page.getByRole('button', { name: 'Créer le compte' }).click();
  const shown = page.getByLabel('Lien à transmettre');
  await shown.waitFor();
  const newLink = await shown.inputValue();
  assert.match(newLink, /\/activation#[A-Za-z0-9_-]{43}$/);
  check('compte créé, lien d’activation affiché une fois');
  await page.getByRole('button', { name: 'Fermer' }).first().click();
  const row = page.getByRole('row', { name: new RegExp(staffEmail.replace('.', '\\.')) });
  await row.getByText('À activer').waitFor();
  await noScroll('comptes');
  check('compte listé « À activer », sans défilement horizontal');

  await row.getByRole('button', { name: 'Désactiver' }).click();
  await page.getByRole('button', { name: 'Désactiver' }).last().click();
  await page
    .getByText(/Indiquez le motif|Opération impossible/)
    .first()
    .waitFor();
  check('désactivation sans motif refusée');
  await page.getByLabel('Motif').fill('Recette fictive');
  await page.getByRole('button', { name: 'Désactiver' }).last().click();
  await page.getByText('Compte désactivé').first().waitFor();
  check('désactivation motivée');

  await page.goto(`${origin}/compte`);
  await page.getByRole('heading', { name: 'Mon compte' }).waitFor();
  await page.getByRole('main').getByText('Cet appareil', { exact: true }).waitFor();
  await noScroll('compte');
  await page.getByLabel('Mot de passe actuel').fill('mauvais-mot-de-passe');
  await page.getByLabel('Nouveau mot de passe').fill('phrase-recette-admin-02');
  await page.getByRole('button', { name: 'Modifier le mot de passe' }).click();
  await page.getByText('Le mot de passe actuel est incorrect.').first().waitFor();
  check('« Mon compte » : sessions affichées, mot de passe actuel vérifié');
  assert.deepEqual(errors, []);
  console.log(`\n${n} contrôles réussis.`);
} catch (error) {
  console.error('Échec :', error);
  console.error(
    await page
      .locator('body')
      .innerText()
      .catch(() => ''),
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}

/**
 * Recette navigateur de la saisie du référentiel d'âge (D173, D175) : brouillon prérempli depuis le
 * référentiel en vigueur, périodes incohérentes refusées, mise en vigueur explicite, étape recalculée,
 * consultation seule pour l'assistant. Valeurs de période **fictives** (aucune règle réelle).
 * Base « _test » isolée préparée par `apps/api/test/profil-browser-fixture.mts` :
 *   PLAYWRIGHT_MODULE=… CHROMIUM_PATH=… [SHOTS_DIR=…] node apps/web/test/referentiel-age.browser.mjs
 */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
const api = process.env.API_ORIGIN ?? 'http://localhost:4000/api/v1';
const shots = process.env.SHOTS_DIR;
const PASSWORD = 'phrase-fictive-recette-profils';
const PAGE = '/administration/referentiel-age';
const VERSION = 'recette-fictive-2';

if (shots) await mkdir(shots, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox'],
});
const errors = [];
let checks = 0;
const check = (label) => console.log(`${++checks}. ${label}`);

async function session(email, width = 1280) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: 'reduce',
    locale: 'fr-FR',
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`${email} : ${error.message}`));
  await page.goto(`${origin}/connexion`);
  await page.getByLabel('Adresse e-mail').fill(email);
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

try {
  // ─── Assistant : consultation seule ─────────────────────────────────────────────────────────
  {
    const { context, page } = await session('assistant-profils@recette.test', 390);
    await page.goto(`${origin}${PAGE}`);
    await page.getByText('Version 2026.1').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Nouveau référentiel' }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Mettre en vigueur' }).count(), 0);
    const denied = await page.request.fetch(`${api}/age-rules`, {
      method: 'POST',
      headers: { 'x-tesla-csrf': '1', 'content-type': 'application/json' },
      data: { version: 'refus', sourceReference: 'Refus fictif', stages: [] },
    });
    assert.equal(denied.status(), 403);
    check('assistant : référentiel consultable, aucune saisie (403 par l’API)');
    await context.close();
  }

  // ─── Plein : brouillon, contrôles, mise en vigueur ─────────────────────────────────────────
  for (const width of [360, 1280]) {
    const { context, page } = await session('plein-profils@recette.test', width);
    await page.goto(`${origin}${PAGE}`);
    await page.getByRole('button', { name: 'Nouveau référentiel' }).click();
    await page.getByRole('heading', { name: 'Nouveau référentiel' }).waitFor();
    // Prérempli depuis le référentiel en vigueur (période de noviciat et sortie).
    assert.equal(await page.getByLabel('Étape').first().inputValue(), 'NOVICIAT');
    assert.equal(await page.getByLabel('Sortie de la branche (âge)').inputValue(), '21');
    await noHorizontalScroll(page, `formulaire ${width}`);
    if (width === 360) {
      if (shots) await page.screenshot({ path: `${shots}/referentiel-360.png`, fullPage: true });
      await page.getByRole('button', { name: 'Annuler' }).click();
      await context.close();
      continue;
    }
    check(
      'plein : formulaire prérempli depuis le référentiel en vigueur, sans défilement à 360 px',
    );

    await page.getByLabel('Version').fill(VERSION);
    await page.getByRole('button', { name: 'Ajouter une période' }).click();
    await page.getByLabel('Étape').nth(1).selectOption('APPRENTISSAGE');
    await page.getByLabel('Début (ans)').nth(1).fill('18');
    await page.getByLabel('Fin (ans)').nth(1).fill('20');
    await page.getByLabel('Source de la période').nth(1).fill('Source fictive de recette');
    await page.getByRole('button', { name: 'Enregistrer le brouillon' }).click();
    await page.getByText('Cette période chevauche une autre période.').first().waitFor();
    check('période chevauchante refusée avant tout envoi');

    // Début après la fin du noviciat (18 ans et 1 mois) : valeurs fictives de recette.
    await page.getByLabel('et (mois)').nth(2).fill('1');
    await page.getByRole('button', { name: 'Enregistrer le brouillon' }).click();
    await page.getByText('Brouillon enregistré').first().waitFor();
    const card = page.locator('[data-slot="card"]', { hasText: `Version ${VERSION}` });
    await card.getByText('Brouillon', { exact: true }).waitFor();
    check('brouillon enregistré, sans effet tant qu’il n’est pas en vigueur');

    await card.getByRole('button', { name: 'Mettre en vigueur' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Mettre en vigueur' }).click();
    await dialog.getByText('Choisissez la date d’entrée en vigueur.').waitFor();
    await dialog.getByLabel('Date d’entrée en vigueur').fill(new Date().toISOString().slice(0, 10));
    await dialog.getByRole('button', { name: 'Mettre en vigueur' }).click();
    await dialog.getByText('Cochez la confirmation.').waitFor();
    await dialog.getByLabel('Je confirme les périodes et leurs sources.').check();
    await dialog.getByRole('button', { name: 'Mettre en vigueur' }).click();
    await page.getByText(`Version ${VERSION} en vigueur`).first().waitFor();
    await card.getByText('En vigueur (figé)').waitFor();
    await card.getByText('Applicable aujourd’hui').waitFor();
    assert.equal(await card.getByRole('button', { name: 'Mettre en vigueur' }).count(), 0);
    check('mise en vigueur : date et confirmation exigées, référentiel figé');

    const search = await page.request.get(`${api}/scouts?search=Apprenti`);
    const apprenti = (await search.json()).items[0];
    await page.goto(`${origin}/administration/routiers/${apprenti.id}`);
    await page.getByText('Apprentissage').first().waitFor();
    check('étape recalculée d’après le nouveau référentiel (routier de 19 ans : Apprentissage)');
    await context.close();
  }

  assert.deepEqual(errors, []);
  check('aucune erreur JavaScript');
  console.log(`\nRecette réussie : ${checks}/${checks} contrôles.`);
} catch (error) {
  console.error('Échec :', error);
  process.exitCode = 1;
} finally {
  await browser.close();
}

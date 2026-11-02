/**
 * Recette navigateur du catalogue publié (voir docs/OFFLINE_FIRST.md § Recette) : mêmes serveurs et
 * même fixture que la recette offline-first, complétée par `apps/api/test/catalogue-browser-fixture.mts`
 * (catalogue réel mis en service sur la base « _test »). Lecture mobile, encadrés pédagogiques,
 * références, navigation entre leçons, questionnaires visibles et lecture sans réseau.
 *   PLAYWRIGHT_MODULE=…/playwright-core/index.mjs CHROMIUM_PATH=… PROFILE_DIR=… \
 *   node apps/web/test/catalogue-lecture.browser.mjs
 */
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
const api = process.env.API_ORIGIN ?? 'http://localhost:4000/api/v1';
const profile = process.env.PROFILE_DIR;
const EMAIL = 'phase5@recette.test';
const PASSWORD = 'phrase-fictive-recette-phase5';
const PHRASE = 'phrase-locale-fictive-de-recette';
const viewport = { width: Number(process.env.VIEWPORT_WIDTH ?? 390), height: 844 };

await rm(profile, { recursive: true, force: true });
const errors = [];
let checks = 0;
const check = (label) => console.log(`${++checks}. ${label}`);

const context = await chromium.launchPersistentContext(profile, {
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox'],
  viewport,
});
const page = context.pages()[0] ?? (await context.newPage());
page.on('pageerror', (e) => errors.push(e.message));
page.on('dialog', (d) => d.accept());
const noHorizontalScroll = async () =>
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    `défilement horizontal sur ${page.url()}`,
  );

try {
  await page.goto(`${origin}/connexion`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Adresse e-mail').fill(EMAIL);
  await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/connexion'));

  // Bibliothèque : seuls les modules publiés, aucun brouillon.
  const catalog = await (await page.request.get(`${api}/modules?pageSize=100`)).json();
  const titles = catalog.items.map((item) => item.title);
  for (const title of ['Découvrir le scoutisme', 'La méthode scoute', 'Le Raid routier']) {
    assert.ok(titles.includes(title), `module publié absent : ${title}`);
  }
  assert.ok(!titles.some((title) => /^Brouillon|À rédiger/.test(title)));
  await page.goto(`${origin}/modules`);
  await page.getByText('La méthode scoute').first().waitFor();
  await noHorizontalScroll();
  check(`bibliothèque routier : ${catalog.total} modules publiés, aucun brouillon`);

  // Leçon rédigée lors de la finalisation : encadrés, références, navigation.
  const methode = catalog.items.find((item) => item.title === 'Loi, principes et vertus');
  const detail = await (await page.request.get(`${api}/modules/${methode.slug}`)).json();
  const lesson = detail.lessons.find((l) => l.title.startsWith('Comprendre et appliquer'));
  await page.goto(`${origin}/modules/${methode.slug}/lecons/${lesson.id}`);
  await page.getByRole('heading', { name: lesson.title }).waitFor();
  for (const label of ['Pour réfléchir', 'À retenir']) {
    assert.equal(await page.locator(`aside[aria-label="${label}"]`).count(), 1, label);
  }
  assert.match(
    await page.locator('.lesson-content footer').innerText(),
    /Source : « Base du scoutisme »/,
  );
  assert.ok((await page.getByText('Leçon 4 sur 4').count()) > 0);
  await noHorizontalScroll();
  check(
    'leçon complétée : encadrés « Pour réfléchir » et « À retenir », références en pied de leçon',
  );
  await page.getByRole('link', { name: /Précédente/ }).click();
  await page.getByRole('heading', { name: 'Les dix articles de la loi scoute' }).waitFor();
  check('navigation vers la leçon précédente');

  // Questionnaire d'entraînement publié et accessible à l'étape du routier, corrigé jamais transmis.
  const evaluations = await (await page.request.get(`${api}/evaluations?pageSize=100`)).json();
  const quiz = (evaluations.items ?? evaluations).find((e) =>
    e.title.includes('Loi, principes et vertus'),
  );
  assert.ok(quiz, 'questionnaire du module absent pour le routier');
  const body = JSON.stringify(
    await (await page.request.get(`${api}/evaluations/${quiz.id}`)).json(),
  );
  assert.ok(!/isCorrect|guidance|acceptedAnswers/.test(body), 'corrigé transmis au routier');
  check('questionnaire publié visible, sans corrigé dans la réponse');

  // Préparation de l'appareil puis lecture sans réseau d'une leçon du catalogue.
  await page.goto(`${origin}/appareil`);
  await page.getByLabel('Phrase de déverrouillage locale').fill(PHRASE);
  await page.getByRole('button', { name: /Activer sur cet appareil|Déverrouiller/ }).click();
  await page.getByRole('button', { name: 'Préparer cet appareil' }).click();
  await page
    .getByText(/Prêt pour une utilisation sans connexion\.|Préparation incomplète/)
    .first()
    .waitFor({ timeout: 180_000 });
  await context.setOffline(true);
  await page.goto(`${origin}/modules/${methode.slug}/lecons/${lesson.id}`).catch(() => {});
  await page.getByRole('heading', { name: lesson.title }).waitFor({ timeout: 30_000 });
  assert.equal(await page.locator('aside[aria-label="À retenir"]').count(), 1);
  check('leçon du catalogue lue sans réseau, mise en forme conservée');
  await context.setOffline(false);

  assert.deepEqual(errors, [], `erreurs de page : ${errors.join(' | ')}`);
  check(`aucune erreur de page, aucun défilement horizontal à ${viewport.width} px`);
  console.log(`\n${checks} contrôles réussis.`);
} finally {
  await context.close();
}

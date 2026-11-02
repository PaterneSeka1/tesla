/**
 * Recette navigateur du circuit papier collectif (D161–D164) : distribution depuis la bibliothèque
 * par une assistante, PDF collectif et ZIP, réimpression sans doublon, saisie et transmission sans
 * corrigé, correction, validation et publication par le responsable plein, fiche routier.
 * API et web de production sur une base « _test » préparée par apps/api/test/paper-browser-fixture.mts :
 *   PLAYWRIGHT_MODULE=… CHROMIUM_PATH=… [VIEWPORT_WIDTH=390] node apps/web/test/paper-distribution.browser.mjs
 */
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
const api = process.env.API_ORIGIN ?? 'http://localhost:4000/api/v1';
const width = Number(process.env.VIEWPORT_WIDTH ?? 390);
const PASSWORD = 'phrase-fictive-recette-papier';
const SECRET = 'Réponse attendue confidentielle';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox'],
});
const errors = [];
let n = 0;
const check = (label) => console.log(`${++n}. ${label}`);

async function signIn(email) {
  const context = await browser.newContext({ viewport: { width, height: 844 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${origin}/connexion`);
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await page.waitForURL('**/accueil');
  return page;
}
const noScroll = async (page, label) => {
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  assert(w <= width, `${label} : défilement horizontal ${w}`);
};
const confirm = async (page, trigger, label) => {
  await page.getByRole('button', { name: trigger }).click();
  await page.getByRole('dialog').getByRole('button', { name: label }).click();
};

let current;
try {
  // 1. Distribution collective par l'assistante, depuis la bibliothèque.
  const assistant = (current = await signIn('assistant-papier@recette.test'));
  await assistant.goto(`${origin}/modules/recette-papier`);
  await assistant.getByRole('link', { name: 'Préparer une distribution' }).click();
  await assistant.getByRole('heading', { name: 'Préparer une distribution' }).waitFor();
  await assistant.getByText('3 destinataires sur 3 affichés').waitFor();
  await assistant.getByLabel('Compte').selectOption('sans');
  await assistant.getByText('2 destinataires sur 2 affichés').waitFor();
  await assistant.getByLabel('Compte').selectOption('tous');
  await noScroll(assistant, 'distribution');
  check('distribution : 3 destinataires, filtre « sans compte » à 2');

  await assistant.getByRole('button', { name: 'Préparer 3 copies' }).click();
  await assistant.getByText('3 copies prêtes').waitFor();
  await assistant.getByText(/3 nouvelles, 0 réutilisée/).waitFor();
  const pdfHref = await assistant.getByRole('link', { name: 'PDF collectif' }).getAttribute('href');
  const zipHref = await assistant
    .getByRole('link', { name: 'ZIP (un PDF par routier)' })
    .getAttribute('href');
  const pdf = await assistant.request.get(pdfHref);
  assert.equal(pdf.status(), 200);
  assert.equal(pdf.headers()['content-type'], 'application/pdf');
  const pdfBody = await pdf.body();
  assert.equal(pdfBody.subarray(0, 5).toString(), '%PDF-');
  assert(!pdfBody.toString('latin1').includes('confidentielle'), 'corrigé dans le PDF');
  const zip = await assistant.request.get(zipHref);
  assert.equal(zip.headers()['content-type'], 'application/zip');
  assert.equal((await zip.body()).readUInt32LE(0), 0x04034b50);
  check('3 copies préparées ; PDF collectif et ZIP téléchargés, sans corrigé');

  await assistant.getByRole('button', { name: 'Préparer 3 copies' }).click();
  await assistant.getByText(/0 nouvelle, 3 réutilisées/).waitFor();
  check('nouvel envoi du lot : 3 copies réutilisées, aucune nouvelle tentative');

  // 2. Saisie et transmission par l'assistante, sans corrigé ni note.
  await assistant.goto(`${origin}/encadrement/corrections`);
  await assistant.getByRole('heading', { name: 'Copies' }).waitFor();
  await assistant.getByRole('link', { name: /ALPHA Routier/ }).click();
  await assistant.getByText('Saisie des réponses', { exact: true }).waitFor();
  const body = await assistant.locator('main').innerText();
  assert(!body.includes('bonne réponse') && !body.includes(SECRET), 'corrigé visible');
  assert.equal(await assistant.getByRole('link', { name: /Corrigé/ }).count(), 0);
  const code = (await assistant.locator('main p.font-mono').first().innerText()).trim();
  const key = await assistant.request.get(`${api}/paper-attempts/${code}/pdf?document=corrige`);
  assert.equal(key.status(), 403);
  check('copie vue par l’assistante sans corrigé ; corrigé PDF refusé (403) par appel direct');

  await assistant.getByLabel('Bleu fictif').check();
  await assistant.getByLabel('Réponse transcrite').fill('Réponse manuscrite fictive');
  await assistant.getByText('2 / 2 questions renseignées').waitFor();
  await assistant.getByRole('button', { name: 'Enregistrer la saisie' }).click();
  await assistant.getByText('Saisie enregistrée').first().waitFor();
  await assistant.getByRole('button', { name: 'Transmettre pour correction' }).waitFor();
  await noScroll(assistant, 'saisie');
  await confirm(assistant, 'Transmettre pour correction', 'Transmettre');
  await assistant.getByText(/Transmise pour correction le/).waitFor();
  assert.equal(await assistant.getByRole('button', { name: 'Enregistrer la saisie' }).count(), 0);
  check('saisie provisoire puis transmission ; saisie close pour l’assistante');

  // 3. Correction, validation et publication par le responsable plein.
  const plein = (current = await signIn('plein-papier@recette.test'));
  await plein.goto(`${origin}/encadrement/corrections`);
  await plein.getByRole('heading', { name: 'Copies à corriger' }).waitFor();
  await plein.getByRole('link', { name: /ALPHA Routier/ }).click();
  await plein.getByText(`Attendu : ${SECRET}`).waitFor();
  await plein.getByText('bonne réponse').first().waitFor();
  await plein.getByLabel('Note').fill('1,5');
  await plein.getByRole('button', { name: 'Enregistrer la correction' }).click();
  await plein.getByText('Correction enregistrée').first().waitFor();
  await plein.getByRole('button', { name: 'Valider la note' }).waitFor();
  await confirm(plein, 'Valider la note', 'Valider la note');
  await plein.getByText('Note validée', { exact: true }).first().waitFor();
  await confirm(plein, 'Publier le résultat', 'Publier');
  await plein.getByText('Résultat accepté').first().waitFor();
  await plein.getByText('2,5 / 3').first().waitFor();
  await noScroll(plein, 'correction');
  check('plein : corrigé visible, note, validation et publication (2,5 / 3)');

  // 4. Fiche routier : « Saisir les réponses » pour une copie encore à saisir.
  await plein.goto(`${origin}/administration/routiers`);
  await plein
    .getByRole('link', { name: /BETA Routier/ })
    .first()
    .click();
  await plein.getByRole('tab', { name: 'Évaluations' }).click();
  await plein.getByRole('link', { name: 'Saisir les réponses' }).first().waitFor();
  check('fiche routier : « Saisir les réponses » sur la copie préparée');

  assert.deepEqual(errors, []);
  console.log(`\n${n} contrôles réussis.`);
} catch (error) {
  console.error('Échec :', error);
  console.error(
    await current
      ?.locator('body')
      .innerText()
      .catch(() => ''),
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}

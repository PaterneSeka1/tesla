/**
 * Recette navigateur de l'éditeur pédagogique (refonte lot 1) : sections Présentation / Contenu /
 * Vérification / Soumission, espace de rédaction à deux zones, enregistrement automatique, changement
 * de leçon sans perte, coupure réseau, reprise d'un brouillon local après fermeture, conflit
 * d'édition, blocs pédagogiques, réorganisation, contrôle des images, aperçu ordinateur/téléphone,
 * soumission, petit écran (360 px). Base « _test » préparée par `offline-browser-fixture.mts` ;
 * données fictives.
 *   PLAYWRIGHT_MODULE=…/playwright-core/index.mjs CHROMIUM_PATH=… [SHOTS_DIR=…] \
 *   node apps/web/test/editeur-pedagogique.browser.mjs
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
const api = process.env.API_ORIGIN ?? 'http://localhost:4000/api/v1';
const shots = process.env.SHOTS_DIR;
const PASSWORD = 'phrase-fictive-recette-phase5';
const CHEF = 'chef-phase5@recette.test';

if (shots) await mkdir(shots, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox'],
});
const errors = [];
let checks = 0;
const check = (label) => console.log(`${++checks}. ${label}`);
const shot = async (page, name) => {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
};

async function login(context, email) {
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${origin}/connexion`);
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: /se connecter/i }).click();
  await page.waitForURL(/\/accueil/);
  return page;
}
const send = (page, method, path, data) =>
  page.request.fetch(`${api}${path}`, {
    method,
    headers: { 'x-tesla-csrf': '1', 'content-type': 'application/json' },
    data,
  });
const editorDetail = async (page, id) => (await send(page, 'GET', `/editor/modules/${id}`)).json();
const lessonText = (lesson) => JSON.stringify(lesson.content);
const noHorizontalScroll = async (page) =>
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    `défilement horizontal sur ${page.url()} (${page.viewportSize().width} px)`,
  );
const status = (page) => page.getByRole('status').filter({ hasText: /Enregistr|Hors connexion|Conflit|Modifications en cours|Échec/ }).first();
const saved = (page) => status(page).filter({ hasText: /^Enregistré/ }).waitFor({ timeout: 15_000 });
const editor = (page) => page.getByRole('textbox', { name: /Contenu de la leçon/ });

const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  reducedMotion: 'reduce',
  locale: 'fr-FR',
});
const page = await login(context, CHEF);
process.on('uncaughtException', async (error) => {
  console.error(error);
  await shot(page, 'echec').catch(() => {});
  console.error('URL :', page.url(), '\nErreurs :', errors.join(' | '));
  process.exit(1);
});

// 1. Création minimale puis ouverture de l'éditeur sur la section Présentation.
const created = await (
  await send(page, 'POST', '/editor/modules', { title: 'Recette éditeur', summary: '' })
).json();
const editorUrl = `${origin}/encadrement/modules/${created.id}/modifier`;
await page.goto(editorUrl);
await page.getByRole('tab', { name: /Présentation/, selected: true }).waitFor();
assert.ok(await page.getByText('Informations complémentaires').isVisible());
assert.ok(!(await page.getByLabel('Prérequis').isVisible()), 'informations complémentaires repliées');
check('module vide : section Présentation, champs complémentaires repliés');

// 2. Contenu : première leçon, puis seconde ; la nouvelle leçon s'ouvre.
await page.getByRole('tab', { name: /Contenu/ }).click();
await page.getByLabel('Nouvelle leçon').fill('Orientation');
await page.getByRole('button', { name: 'Ajouter la leçon' }).click();
await editor(page).waitFor();
await page.getByLabel('Nouvelle leçon').first().fill('Bivouac');
await page.getByRole('button', { name: 'Ajouter la leçon' }).first().click();
await page.getByLabel('Titre de la leçon 2').waitFor();
assert.equal(await page.getByLabel('Titre de la leçon 2').inputValue(), 'Bivouac');
check('ajout de deux leçons, la nouvelle leçon est ouverte');

// 3. Rédaction et enregistrement automatique (sans bouton « Enregistrer »).
const nav = page.getByRole('navigation', { name: 'Leçons du module' }).last();
await nav.getByRole('button', { name: /Orientation/ }).click();
await editor(page).click();
await page.keyboard.type('La boussole indique le nord magnétique.');
await saved(page);
let detail = await editorDetail(page, created.id);
assert.match(lessonText(detail.current.lessons[0]), /nord magnétique/);
check('enregistrement automatique confirmé par le serveur');

// 4. Bloc pédagogique « À retenir ».
await page.getByRole('button', { name: 'Bloc pédagogique' }).click();
await page.getByRole('menuitem', { name: /À retenir/ }).click();
await page.keyboard.type('Toujours vérifier la déclinaison.');
await saved(page);
detail = await editorDetail(page, created.id);
assert.match(lessonText(detail.current.lessons[0]), /"level":3.*À retenir/);
check('bloc « À retenir » inséré (titre de niveau 3 + contenu)');

// 5. Changement de leçon immédiatement après la saisie : rien n'est perdu.
await editor(page).click();
await page.keyboard.press('End');
await page.keyboard.type(' Relevé au crayon.');
await nav.getByRole('button', { name: /Bivouac/ }).click();
await page.getByLabel('Titre de la leçon 2').waitFor();
await page.waitForTimeout(1500);
detail = await editorDetail(page, created.id);
assert.match(lessonText(detail.current.lessons[0]), /Relevé au crayon/);
check('changement de leçon pendant la saisie : modification envoyée');

// 6. Coupure réseau : saisie conservée, état « Hors connexion », envoi au retour.
await editor(page).click();
await context.setOffline(true);
await page.keyboard.type('Monter la tente avant la nuit.');
await status(page).filter({ hasText: /Hors connexion/ }).waitFor({ timeout: 10_000 });
await shot(page, 'editeur-hors-connexion');
await context.setOffline(false);
await page.evaluate(() => window.dispatchEvent(new Event('online')));
await saved(page);
detail = await editorDetail(page, created.id);
assert.match(lessonText(detail.current.lessons[1]), /Monter la tente/);
check('coupure réseau : état affiché, envoi au retour du réseau');

// 7. Fermeture avant l'envoi (hors connexion) puis reprise du brouillon local.
await context.setOffline(true);
await editor(page).click();
await page.keyboard.press('End');
await page.keyboard.type(' Vérifier les sardines.');
await status(page).filter({ hasText: /Hors connexion/ }).waitFor({ timeout: 10_000 });
const lessonId = detail.current.lessons[1].id;
await page.goto('about:blank');
await context.setOffline(false);
await page.goto(`${editorUrl}?section=contenu&lecon=${lessonId}`);
await page.getByText(/Modifications non envoyées retrouvées/).waitFor();
await saved(page);
detail = await editorDetail(page, created.id);
assert.match(lessonText(detail.current.lessons[1]), /Vérifier les sardines/);
check('brouillon local retrouvé après fermeture et enregistré');

// 8. Conflit : modification par ailleurs, la saisie locale n'écrase rien sans décision.
const remote = detail.current.lessons[1];
assert.equal(
  (
    await send(page, 'PATCH', `/editor/lessons/${remote.id}`, {
      revision: remote.revision,
      title: 'Bivouac (modifié ailleurs)',
    })
  ).status(),
  204,
);
await editor(page).click();
await page.keyboard.type(' Saisie concurrente.');
await page.getByText(/modifiée par une autre personne/).first().waitFor({ timeout: 15_000 });
detail = await editorDetail(page, created.id);
assert.equal(detail.current.lessons[1].title, 'Bivouac (modifié ailleurs)');
assert.doesNotMatch(lessonText(detail.current.lessons[1]), /Saisie concurrente/);
await shot(page, 'editeur-conflit');
await page.getByRole('button', { name: 'Reprendre la version enregistrée' }).click();
await page.getByRole('dialog').getByRole('button', { name: 'Abandonner ma saisie' }).click();
await page.getByLabel('Titre de la leçon 2').waitFor();
assert.equal(await page.getByLabel('Titre de la leçon 2').inputValue(), 'Bivouac (modifié ailleurs)');
check('conflit détecté, version distante préservée, choix explicite');

// 9. Réorganisation (clavier) et vérification.
await nav.getByRole('button', { name: /Bivouac/ }).focus();
await page.keyboard.press('Alt+ArrowUp');
await page.waitForTimeout(800);
detail = await editorDetail(page, created.id);
assert.equal(detail.current.lessons[0].title, 'Bivouac (modifié ailleurs)');
check('réorganisation au clavier (Alt + flèche)');

// 10. Leçon vide → bloquant dans la vérification, « Corriger » ouvre la leçon.
await page.getByLabel('Nouvelle leçon').first().fill('Leçon vide');
await page.getByRole('button', { name: 'Ajouter la leçon' }).first().click();
await page.getByLabel('Titre de la leçon 3').waitFor();
await page.getByRole('tab', { name: /Vérification/ }).click();
await page.getByText(/La leçon « Leçon vide » est vide/).waitFor();
await page.getByRole('button', { name: 'Corriger' }).first().click();
await page.getByLabel('Titre de la leçon 3').waitFor();
await page.getByRole('button', { name: 'Supprimer la leçon' }).click();
await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click();
await page.getByRole('tab', { name: /Vérification/ }).click();
await page.getByText('Aucun point bloquant.').waitFor();
check('vérification : point bloquant, accès direct à la leçon, suppression confirmée');

// 11. Image : contrôle du format et de la taille avant tout envoi.
await page.getByRole('tab', { name: /Contenu/ }).click();
await page.getByRole('button', { name: 'Image', exact: true }).click();
const dir = join(tmpdir(), `tesla-editeur-${process.pid}`);
await mkdir(dir, { recursive: true });
await writeFile(join(dir, 'page.html'), '<html></html>');
await page.getByLabel('Image depuis l’appareil').setInputFiles(join(dir, 'page.html'));
await page.getByText(/Format non accepté/).waitFor();
await writeFile(join(dir, 'lourde.png'), Buffer.alloc(3 * 1024 * 1024 + 10, 1));
await page.getByLabel('Image depuis l’appareil').setInputFiles(join(dir, 'lourde.png'));
await page.getByText(/Image trop lourde/).waitFor();
await page.getByRole('button', { name: 'Annuler' }).first().click();
check('image : format et taille refusés avant envoi');

// 12. Aperçu ordinateur / téléphone, bloc rendu en encadré.
await page.goto(`${origin}/encadrement/modules/${created.id}/apercu`);
await page.getByRole('complementary', { name: 'À retenir' }).waitFor();
await page.getByRole('button', { name: 'Téléphone' }).click();
assert.equal(await page.getByRole('button', { name: 'Téléphone' }).getAttribute('aria-pressed'), 'true');
await shot(page, 'apercu-telephone');
check('aperçu : encadré « À retenir », largeur téléphone');

// 13. Soumission depuis la section dédiée.
await page.goto(`${editorUrl}?section=soumission`);
await page.getByText('Ce qui se passe ensuite').waitFor();
await page.getByRole('button', { name: 'Envoyer pour validation' }).click();
await page.getByRole('dialog').getByRole('button', { name: 'Envoyer pour validation' }).click();
await page.getByText(/Envoyé pour validation/).first().waitFor();
detail = await editorDetail(page, created.id);
assert.equal(detail.current.status, 'SOUMIS');
check('soumission : récapitulatif, conséquences, envoi');

// 14. Petit écran : panneau des leçons, aucun débordement horizontal.
const mobile = await browser.newContext({
  viewport: { width: 360, height: 760 },
  reducedMotion: 'reduce',
  locale: 'fr-FR',
});
const phone = await login(mobile, CHEF);
const draft = await (
  await send(phone, 'POST', '/editor/modules', { title: 'Recette mobile', summary: '' })
).json();
await send(phone, 'POST', `/editor/modules/${draft.id}/lessons`, {
  versionId: draft.current.id,
  title: 'Première leçon au titre assez long pour tester la troncature',
});
await phone.goto(`${origin}/encadrement/modules/${draft.id}/modifier?section=contenu`);
await phone.getByRole('button', { name: /Leçon 1 sur 1/ }).click();
await phone.getByRole('navigation', { name: 'Leçons du module' }).first().waitFor();
await noHorizontalScroll(phone);
await editor(phone).click();
await phone.keyboard.type('Rédaction sur téléphone.');
await saved(phone);
await phone.getByRole('button', { name: 'Plus d’options de mise en forme' }).waitFor();
await shot(phone, 'editeur-360');
check('360 px : liste des leçons repliable, rédaction et enregistrement, sans débordement');

await browser.close();
assert.deepEqual(errors, [], `erreurs de page : ${errors.join(' | ')}`);
console.log(`Recette éditeur : ${checks} contrôles réussis.`);

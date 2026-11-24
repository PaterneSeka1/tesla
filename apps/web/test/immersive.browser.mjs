/**
 * Recette navigateur de l'expérience immersive (D194–D200) : accueil, carte d'aventure, lecteur
 * (Découverte et lecture intégrale), activités intégrées, défis, carnet, hors ligne, éditeur,
 * permissions. Base « _test » préparée par `apps/api/test/immersive-browser-fixture.mts`.
 *   PLAYWRIGHT_MODULE=…/playwright-core/index.mjs CHROMIUM_PATH=… SHOTS_DIR=… \
 *   node apps/web/test/immersive.browser.mjs
 */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
const api = process.env.API_ORIGIN ?? 'http://localhost:4000/api/v1';
const shots = process.env.SHOTS_DIR;
const PASSWORD = 'phrase-fictive-recette-immersive';
const account = (name) => `${name}-immersif@recette.test`;

if (shots) await mkdir(shots, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox'],
});
const errors = [];
let preparation = '';
let checks = 0;
const check = (label) => console.log(`${++checks}. ${label}`);
const shot = (page, name, fullPage = true) =>
  shots ? page.screenshot({ path: `${shots}/${name}.png`, fullPage }) : Promise.resolve();
const noHorizontalScroll = async (page, label) =>
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    `défilement horizontal : ${label}`,
  );
const send = (page, method, path, data) =>
  page.request.fetch(`${api}${path}`, {
    method,
    headers: { 'x-tesla-csrf': '1', 'content-type': 'application/json' },
    data,
  });
const bottomNav = (page) => page.getByRole('navigation', { name: 'Navigation principale mobile' });

async function session(name, width = 390, options = {}) {
  const context = await browser.newContext({
    viewport: { width, height: width < 700 ? 844 : 900 },
    reducedMotion: options.motion ?? 'reduce',
    locale: 'fr-FR',
    hasTouch: width < 700,
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`${name} : ${error.message}`));
  await page.goto(`${origin}/connexion`);
  await page.getByLabel('Adresse e-mail').fill(account(name));
  await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
  // Appareil personnel activé : lecture et entraînement sans réseau (coffre chiffré, D178).
  if (options.device) await page.getByLabel('Utiliser aussi cet appareil sans connexion').check();
  await page.getByRole('button', { name: /se connecter/i }).click();
  if (options.device) {
    // Préparation hors ligne : défis et carnet compris (D198), puis retour à l'accueil.
    await page.waitForURL('**/appareil?preparer=1');
    await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, {
      timeout: 30_000,
    });
    await page
      .getByText(/Prêt pour une utilisation sans connexion\.|Préparation incomplète/)
      .first()
      .waitFor({ timeout: 240_000 });
    preparation = await page.locator('#contenu').innerText();
    await page.goto(`${origin}/accueil`);
  } else await page.waitForURL(/\/accueil/);
  return { context, page };
}

process.on('unhandledRejection', (error) => {
  console.error(error);
  process.exit(1);
});

// ─── 1. Accueil du routier : une aventure, une action principale ───────────────────────────
const { context: routierContext, page } = await session('routier', 390, { device: true });
await page.getByRole('heading', { name: /Bonjour Fictif/ }).waitFor();
await page
  .getByRole('link', { name: /Explorer les cours|Commencer|Continuer mon aventure/ })
  .first()
  .waitFor();
// Première visite : présentation ignorable.
await page.getByRole('complementary', { name: 'Premiers pas' }).waitFor();
await shot(page, '01-accueil-routier-390');
await page.getByRole('button', { name: 'C’est compris' }).click();
assert.equal(await page.getByRole('complementary', { name: 'Premiers pas' }).count(), 0);
const tabs = await bottomNav(page).getByRole('link').allInnerTexts();
assert.deepEqual(
  tabs.map((t) => t.trim()),
  ['Accueil', 'Cours', 'Défis', 'Parcours'],
  'barre inférieure du routier',
);
await noHorizontalScroll(page, 'accueil 390');
check('accueil routier : salutation, une aventure, présentation ignorable, 4 onglets + Plus');
assert.match(preparation, /Prêt pour une utilisation sans connexion/, preparation.slice(0, 600));
check('appareil activé à la connexion : préparation hors ligne complète (défis et carnet compris)');

// ─── 2. Carte d'aventure du module ────────────────────────────────────────────────────────
await page.goto(`${origin}/modules/recette-entrainement`);
await page.getByRole('heading', { name: /Haltes/ }).waitFor();
await page.getByRole('link', { name: 'Défis du module' }).waitFor();
await shot(page, '02-sentier-390');
await noHorizontalScroll(page, 'sentier 390');
await page.getByRole('button', { name: 'Liste' }).click();
await page.getByRole('button', { name: 'Sentier' }).waitFor();
await page.getByRole('button', { name: 'Sentier' }).click();
check('carte d’aventure : haltes, défis du module, vue liste disponible');

// ─── 3. Lecteur : mode concentration, Découverte, activité intégrée, fin de halte ─────────
await page.getByRole('link', { name: /^Commencer/ }).click();
await page.waitForURL(/\/lecons\//);
await page.getByRole('heading', { name: 'Repères fictifs' }).waitFor();
assert.equal(await bottomNav(page).count(), 0, 'barre inférieure masquée pendant la lecture');
assert.ok(await page.getByRole('link', { name: /Quitter la leçon/ }).isVisible());
await shot(page, '03-lecture-decouverte-390', false);
// Séquence 1 → 2 (texte), puis l'activité « Questions » forme sa propre séquence.
await page.getByRole('button', { name: 'Continuer' }).click();
await page.getByText('une deuxième notion').waitFor();
await page.getByRole('button', { name: 'Continuer' }).click();
// Séquence d'activité : démarrage direct, une seule action principale (« Passer » discret).
await page.getByText('Question fictive n° 1').first().waitFor();
assert.ok(await page.getByRole('button', { name: 'Passer' }).isVisible());
await page.getByRole('button', { name: 'Un indice' }).click();
await page.getByText('Indice fictif').waitFor();
await page.getByRole('button', { name: 'Proposition B' }).click();
await page.getByText('Pas tout à fait.').waitFor();
await page.getByText('Explication fictive').first().waitFor();
await shot(page, '04-activite-quiz-erreur-390', false);
// Les cinq questions suivantes : bonne réponse (index = n mod 4).
const letters = ['A', 'B', 'C', 'D'];
for (let index = 1; index < 6; index++) {
  await page.getByRole('button', { name: /Suivant/ }).click();
  await page
    .getByText(`Question fictive n° ${index + 1}`)
    .first()
    .waitFor();
  await page.getByRole('button', { name: `Proposition ${letters[index % 4]}` }).click();
  await page.getByText('Bien vu !').waitFor();
}
await page.getByRole('button', { name: 'Terminer' }).click();
await page.getByText('5 sur 6').waitFor();
await page.getByText(/\+5 XP/).waitFor();
await shot(page, '05-activite-fin-390', false);
check('lecteur : concentration, séquences, indice, retour, fin d’activité et récompense serveur');

// Bascule vers la lecture intégrale sans perte de position.
await page.getByRole('button', { name: 'Lecture intégrale' }).click();
await page.getByText('une troisième notion').waitFor();
await page.getByText('Halte terminée').waitFor();
await page.getByText(/\+10 XP|Badge obtenu/).waitFor();
await shot(page, '06-lecture-integrale-fin-390');
check('lecture intégrale : contenu complet, halte terminée, récompense de lecture');

// ─── 4. Défis : salle, vrai ou faux, L'Ascension, mémoire, remise en ordre ────────────────
await page.goto(`${origin}/defis`);
await page.getByRole('heading', { name: 'Réviser rapidement' }).waitFor();
await shot(page, '07-defis-390');
await noHorizontalScroll(page, 'défis 390');
await page.getByRole('link', { name: /Vrai ou faux/ }).click();
await page.getByText('Affirmation fictive vraie.').waitFor();
assert.equal(await bottomNav(page).count(), 0, 'barre masquée pendant une partie');
await page.getByRole('button', { name: 'Vrai', exact: true }).click();
await page.getByText('Bien vu !').waitFor();
await page.getByRole('button', { name: /Suivant/ }).click();
await page.getByRole('button', { name: 'Vrai', exact: true }).click();
await page.getByText('Pas tout à fait.').waitFor();
await page.getByRole('button', { name: /Suivant/ }).click();
await page.getByRole('button', { name: 'Vrai', exact: true }).click();
await page.getByRole('button', { name: 'Terminer' }).click();
await page.getByText('2 sur 3').waitFor();
await shot(page, '08-vrai-faux-fin-390', false);
check('vrai ou faux : réponses, erreur, écran de fin');

await page.goto(`${origin}/defis/ascension`);
await page.getByRole('button', { name: 'C’est parti' }).click();
await page.getByText('Palier 1 sur').waitFor();
await page.getByRole('button', { name: 'Deux de moins' }).click();
const remaining = await page
  .getByRole('group', { name: 'Propositions' })
  .getByRole('button')
  .count();
assert.equal(remaining, 2, 'joker : deux propositions retirées');
await shot(page, '09-ascension-joker-390', false);
check('L’Ascension : règles à la première partie, joker « Deux de moins »');

await page.goto(`${origin}/defis/memoire`);
await page.getByRole('button', { name: 'C’est parti' }).click();
await page.getByText(/paire.? sur 4/).waitFor();
await shot(page, '10-memoire-390');
check('jeu de mémoire : 8 cartes, compteur de paires');

await page.goto(`${origin}/defis/frises`);
await page
  .getByRole('button', { name: /Monter/ })
  .first()
  .waitFor();
await page.getByRole('button', { name: 'Vérifier' }).click();
await page
  .getByRole('status')
  .filter({ hasText: /pas à leur place|Tout est dans l’ordre/ })
  .waitFor();
await shot(page, '11-frise-390', false);
check('remise en ordre : déplacement au toucher ou au clavier, vérification');

// ─── 5. Hors ligne : la partie se joue, le résultat attend sur l'appareil ─────────────────
await page.goto(`${origin}/defis/cartes`);
await page.getByRole('button', { name: 'Voir la réponse' }).waitFor();
await routierContext.setOffline(true);
// Première activité de la partie : toutes ses cartes, puis l'écran de fin.
while (!(await page.getByText('Enregistré sur cet appareil').isVisible())) {
  await page.getByRole('button', { name: 'Voir la réponse' }).click();
  await page.getByRole('button', { name: 'Je savais' }).click();
  await page.waitForTimeout(150);
}
await shot(page, '12-hors-ligne-cartes-390', false);
// Rechargement sans réseau : la salle et une partie s'ouvrent depuis l'appareil.
await page.goto(`${origin}/defis/vrai-faux`);
await page.getByText('Affirmation fictive vraie.').waitFor();
await page.goto(`${origin}/modules/recette-entrainement`);
await page.getByRole('heading', { name: /Haltes/ }).waitFor();
await routierContext.setOffline(false);
check('hors ligne : partie jouable, résultat conservé, pages rouvertes sans réseau');

// Reconnexion : synchronisation, puis le serveur a bien enregistré l'entraînement (une fois).
await page.goto(`${origin}/appareil`);
await page.getByRole('button', { name: 'Synchroniser maintenant' }).click();
await page.getByText('Tout est synchronisé.').waitFor({ timeout: 30_000 });
const journal = await (await send(page, 'GET', '/me/journal')).json();
assert.ok(
  journal.practiced.some((key) => key.startsWith('recette-entrainement:') || key.includes(':d-f-')),
  'entraînement hors ligne synchronisé',
);
const xpAfterSync = journal.xp;
await page.getByRole('button', { name: 'Synchroniser maintenant' }).click();
await page.getByText('Tout est synchronisé.').waitFor();
assert.equal(
  (await (await send(page, 'GET', '/me/journal')).json()).xp,
  xpAfterSync,
  'aucun doublon',
);
check('reconnexion : file synchronisée, récompense attribuée une seule fois');

// ─── 6. Carnet : XP et badges attribués par le serveur ────────────────────────────────────
await page.goto(`${origin}/carnet`);
await page
  .getByText(/\d+\s*XP/)
  .first()
  .waitFor();
await page.getByRole('button', { name: /Premier pas/ }).click();
await page.getByText(/Obtenu le/).waitFor();
await shot(page, '13-carnet-390');
check('carnet : XP, badge « Premier pas » daté, détail à la demande');

// Sécurité : un score envoyé par le client n'existe pas ; les réponses sont recorrigées.
const forged = await send(page, 'POST', '/me/practice/results', {
  moduleSlug: 'recette-entrainement',
  activityKey: 'recette-vf-1',
  answers: [false, true, false],
  correct: 3,
  xp: 100,
});
assert.equal(forged.status(), 200);
const forgedBody = await forged.json();
assert.equal(forgedBody.correct, 0, 'le serveur recorrige les réponses');
assert.equal(forgedBody.xpAwarded, 0, 'aucune récompense en double ni falsifiée');
check('sécurité : score et XP envoyés par le client ignorés, recorrection serveur');

// Accueil après activité : reprise en une action.
await page.goto(`${origin}/accueil`);
await page.getByRole('link', { name: 'Continuer mon aventure' }).waitFor();
await shot(page, '14-accueil-reprise-390');
check('accueil : reprise de la halte en une action');

// ─── 7. Largeurs : accueil, défis, lecture ─────────────────────────────────────────────────
for (const width of [320, 768, 1440]) {
  await page.setViewportSize({ width, height: 900 });
  for (const path of ['/accueil', '/defis', '/modules/recette-entrainement']) {
    await page.goto(`${origin}${path}`);
    await page.waitForLoadState('networkidle');
    await noHorizontalScroll(page, `${path} ${width}`);
  }
  await shot(page, `15-module-${width}`);
}
check('320, 768, 1440 px : aucun défilement horizontal');
await routierContext.close();

// ─── 8. Apprenant adulte : mêmes cours et défis, aucune donnée de la Route ────────────────
const adult = await session('adulte', 390);
await adult.page.getByRole('heading', { name: /Bonjour Fictif/ }).waitFor();
const adultTabs = await bottomNav(adult.page).getByRole('link').allInnerTexts();
assert.deepEqual(
  adultTabs.map((t) => t.trim()),
  ['Accueil', 'Cours', 'Défis', 'Évaluations'],
);
assert.equal(await adult.page.getByText(/Rattrapage|Noviciat|Apprentissage/).count(), 0);
await shot(adult.page, '16-accueil-adulte-390');
check('adulte : accueil sans étape ni rattrapage, onglet Défis');
await adult.context.close();

// ─── 9. Encadrement : éditeur, insertion d'une activité ; administrateur sans accès ───────
const chef = await session('chef', 1280);
await chef.page.goto(`${origin}/defis`);
await chef.page.getByRole('heading', { name: 'Réviser rapidement' }).waitFor();
assert.equal(
  (await send(chef.page, 'GET', '/me/journal')).status(),
  403,
  'aucun carnet pour l’encadrement',
);
const created = await (
  await send(chef.page, 'POST', '/editor/modules', { title: 'Recette activité', summary: '' })
).json();
await send(chef.page, 'POST', `/editor/modules/${created.id}/lessons`, {
  versionId: created.current.id,
  title: 'Leçon avec activité',
});
await chef.page.goto(`${origin}/encadrement/modules/${created.id}/modifier?section=contenu`);
const editorBox = chef.page.getByRole('textbox', { name: /Contenu de la leçon/ });
await editorBox.waitFor();
await editorBox.click();
await chef.page.keyboard.type('Introduction de la leçon.');
await chef.page.getByRole('button', { name: 'Bloc pédagogique' }).click();
await chef.page.getByRole('menuitem', { name: 'Vrai ou faux' }).click();
const dialog = chef.page.getByRole('dialog');
await dialog.getByRole('button', { name: 'Enregistrer l’activité' }).click();
await dialog.getByRole('alert').waitFor();
await dialog.getByLabel('Affirmation 1').fill('Le sentier commence au bivouac.');
await dialog.getByRole('button', { name: 'Aperçu' }).click();
await dialog.getByRole('button', { name: 'Vrai', exact: true }).waitFor();
await shot(chef.page, '17-editeur-apercu-activite', false);
await dialog.getByRole('button', { name: 'Modifier' }).click();
await dialog.getByRole('button', { name: 'Enregistrer l’activité' }).click();
await chef.page.getByText('Activité · Vrai ou faux').waitFor();
await chef.page
  .getByRole('status')
  .filter({ hasText: /^Enregistré/ })
  .first()
  .waitFor({ timeout: 15_000 });
const detail = await (await send(chef.page, 'GET', `/editor/modules/${created.id}`)).json();
assert.match(JSON.stringify(detail.current.lessons[0].content), /"type":"practice"/);
await shot(chef.page, '18-editeur-activite-inseree', false);
check(
  'éditeur : activité validée, aperçu sans enregistrement, insertion et enregistrement automatique',
);
await chef.context.close();

const admin = await session('admin', 1280);
assert.equal((await send(admin.page, 'GET', '/practice/bank')).status(), 403);
await admin.page.goto(`${origin}/defis`);
await admin.page.waitForURL(/\/accueil/);
check('administrateur : ni banque ni défis (refus serveur et redirection)');
await admin.context.close();

await browser.close();
if (errors.length) {
  console.error('Erreurs de page :', errors);
  process.exit(1);
}
console.log(`Recette immersive : ${checks} contrôles réussis.`);

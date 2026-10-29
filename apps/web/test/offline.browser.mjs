/** Recette réelle : API sur tesla_test + web de production + fixture fictive (voir OFFLINE_FIRST.md). */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const fixture = JSON.parse(
  await readFile(process.env.OFFLINE_FIXTURE ?? '/tmp/tesla-phase5-fixture.json', 'utf8'),
);
const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3105';
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox'],
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const errors = [];
let checks = 0;
const check = (label) => {
  checks++;
  console.log(`${checks}. ${label}`);
};
let page = await context.newPage();
page.on('pageerror', (e) => errors.push(e.message));
page.on('dialog', (d) => d.accept());
const phrase = 'phrase-locale-fictive-de-recette';
async function unlock() {
  await page.getByLabel('Phrase de déverrouillage locale').fill(phrase);
  await page.getByRole('button', { name: /Déverrouiller|Activer sur cet appareil/ }).click();
  await page.getByRole('button', { name: 'Verrouiller', exact: true }).waitFor();
}
try {
  await page.goto(`${origin}/connexion`);
  await page.getByLabel('Adresse e-mail').fill('phase5@recette.test');
  await page.getByLabel('Mot de passe', { exact: true }).fill('phrase-fictive-recette-phase5');
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await page.waitForURL('**/routier');
  await page.goto(`${origin}/telechargements`);
  await unlock();
  check('activation du stockage chiffré');
  await page.getByRole('link', { name: 'Bibliothèque en ligne', exact: true }).click();
  await page.locator('a[href="/modules/recette-hors-ligne"]:visible').first().click();
  await page.getByRole('button', { name: 'Télécharger pour lire hors ligne' }).click();
  await page
    .getByText('Disponible hors ligne. Les ressources externes nécessitent une connexion.', {
      exact: true,
    })
    .waitFor();
  check('téléchargement complet confirmé');
  await page.locator('a[href="/evaluations"]:visible').first().click();
  await page.locator(`a[href="/evaluations/${fixture.evaluationId}"]:visible`).first().click();
  await page.getByRole('link', { name: 'Préparer ou reprendre hors ligne' }).click();
  await page.getByRole('button', { name: 'Vérifier mes droits et préparer' }).click();
  await page.waitForURL('**/hors-ligne#attempt:*');
  const attemptHash = new URL(page.url()).hash;
  await unlock();
  await page.getByRole('heading', { name: 'Évaluation fictive hors ligne', exact: true }).waitFor();
  check('paquet préparé côté serveur puis retrouvé après rechargement');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const cachesBefore = await page.evaluate(async () =>
    (
      await Promise.all(
        (await caches.keys()).map(async (k) =>
          (await (await caches.open(k)).keys()).map((r) => r.url),
        ),
      )
    ).flat(),
  );
  // Chemins exacts : les chunks statiques `/_next/static/chunks/app/connexion/…` sont légitimes.
  const cachedPaths = cachesBefore.map((url) => new URL(url).pathname);
  assert(
    !cachedPaths.some(
      (path) => path.startsWith('/api/') || path.includes('/v1/') || path === '/connexion',
    ),
    cachedPaths.join('\n'),
  );
  assert(cachedPaths.includes('/hors-ligne'));
  check('API et connexion exclues du cache');
  await context.setOffline(true);
  await page
    .getByLabel('Votre réponse', { exact: true })
    .fill('Réponse fictive conservée sans réseau.');
  await page.getByText('Réponses enregistrées sur cet appareil.', { exact: true }).waitFor();
  check('réponse libre sauvegardée hors ligne');
  await page.close();
  page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto(`${origin}/hors-ligne${attemptHash}`);
  await unlock();
  await page.getByLabel('Votre réponse', { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel('Votre réponse', { exact: true }).inputValue(),
    'Réponse fictive conservée sans réseau.',
  );
  check('fermeture, réouverture hors réseau, déverrouillage et reprise');
  await page.getByRole('button', { name: 'Remettre localement' }).click();
  await page.getByText(/En attente de synchronisation\. Aucun résultat officiel/).waitFor();
  assert(await page.getByLabel('Votre réponse', { exact: true }).isDisabled());
  check('remise locale immuable sans confirmation serveur prématurée');
  await page.getByRole('link', { name: /Recette hors ligne · v1/ }).click();
  await page.getByText('Texte disponible sans connexion.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Leçon suivante', exact: true }).click();
  await page.getByText('La position de lecture est conservée.', { exact: true }).waitFor();
  await page.reload();
  await unlock();
  await page.getByText('La position de lecture est conservée.', { exact: true }).waitFor();
  check('lecture locale et position conservée après rechargement');
  await page.getByRole('button', { name: 'Verrouiller', exact: true }).click();
  assert.equal(
    await page.getByText('La position de lecture est conservée.', { exact: true }).count(),
    0,
  );
  await page.getByLabel('Phrase de déverrouillage locale').fill('phrase-incorrecte');
  await page.getByRole('button', { name: 'Déverrouiller', exact: true }).click();
  await page.getByText('Phrase de déverrouillage incorrecte.', { exact: true }).waitFor();
  check('verrouillage masque le contenu et mauvaise phrase refusée');
  await unlock();
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Synchroniser maintenant', exact: true }).click();
  await page.getByText('SYNCHRONISE · 0 envoi(s) échoué(s)', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Synchroniser maintenant', exact: true }).click();
  check('reconnexion et confirmation serveur, répétition sans doublon');
  const encrypted = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open('tesla-academie', 2);
      r.onsuccess = () => resolve(r.result);
      r.onerror = reject;
    });
    const rows = await new Promise((resolve) => {
      const r = db.transaction('records').objectStore('records').getAll();
      r.onsuccess = () => resolve(r.result);
    });
    db.close();
    return JSON.stringify(rows);
  });
  assert(!encrypted.includes('Réponse fictive') && !encrypted.includes('Texte disponible'));
  check('réponses et leçons absentes en clair dans IndexedDB');
  await page.getByRole('button', { name: 'Supprimer localement', exact: true }).click();
  await page.getByText('Aucun module disponible hors ligne.', { exact: false }).waitFor();
  assert(await page.getByRole('link', { name: /Évaluation fictive hors ligne · NT-/ }).count());
  check('suppression du module sans suppression de la copie');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByRole('button', { name: 'Déconnexion', exact: true }).click();
  await page.waitForURL('**/connexion');
  await page.goto(`${origin}/hors-ligne`);
  await page.getByLabel('Phrase de déverrouillage locale').waitFor();
  assert.equal(
    await page.getByRole('link', { name: /Évaluation fictive hors ligne · NT-/ }).count(),
    0,
  );
  check('déconnexion verrouille les données privées ; affichage mobile sans débordement');
  assert.deepEqual(errors, []);
  console.log(
    `RÉUSSI : ${checks} contrôles Chromium desktop émulant 390 px. Aucun appareil physique testé.`,
  );
} finally {
  await browser.close();
}

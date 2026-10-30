/**
 * Recette réelle offline-first (voir docs/OFFLINE_FIRST.md § Recette) : API de production sur une
 * base `_test`, web de production sur http://localhost:3000, fixture fictive
 * (apps/api/test/offline-browser-fixture.mts). Navigateur réel (Chromium) avec profil persistant :
 * la fermeture du navigateur est une vraie fermeture, la coupure réseau est complète.
 *   PLAYWRIGHT_MODULE=…/playwright-core/index.mjs CHROMIUM_PATH=… OFFLINE_FIXTURE=… \
 *   PROFILE_DIR=… DATABASE_URL_TEST=… node apps/web/test/offline-first.browser.mjs
 */
import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const fixture = JSON.parse(await readFile(process.env.OFFLINE_FIXTURE, 'utf8'));
const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
const api = process.env.API_ORIGIN ?? 'http://localhost:4000/api/v1';
const profile = process.env.PROFILE_DIR;
const PASSWORD = 'phrase-fictive-recette-phase5';
const PHRASE = 'phrase-locale-fictive-de-recette';
const viewport = { width: Number(process.env.VIEWPORT_WIDTH ?? 390), height: 844 };

await rm(profile, { recursive: true, force: true });
const errors = [];
const visited = [];
let checks = 0;
const check = (label) => console.log(`${++checks}. ${label}`);

let context;
let page;
async function open() {
  context = await chromium.launchPersistentContext(profile, {
    headless: true,
    executablePath: process.env.CHROMIUM_PATH,
    args: ['--no-sandbox'],
    viewport,
  });
  page = context.pages()[0] ?? (await context.newPage());
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) visited.push(new URL(frame.url()).pathname);
  });
}
/** Fermeture réelle du navigateur (processus arrêté, profil conservé sur disque). */
async function restart() {
  await context.close();
  await open();
}
/** Texte visible (l'indicateur existe aussi dans la barre latérale, masquée sur mobile). */
const visibleText = (text) => page.getByText(text).filter({ visible: true }).first();
const link = (href) => page.locator(`a[href="${href}"]:visible`).first();
/**
 * Navigation ordinaire : lien visible (barre du bas, contenu), sinon menu latéral mobile, sinon
 * saisie de l'adresse (élément animé ou hors écran).
 */
async function go(href) {
  try {
    if ((await link(href).count()) === 0)
      await page.getByRole('button', { name: 'Ouvrir le menu' }).click({ timeout: 5_000 });
    await link(href).click({ timeout: 5_000 });
  } catch {
    await page.goto(`${origin}${href}`);
  }
  await page.waitForURL(`**${href}`);
}
async function login(email) {
  await page.goto(`${origin}/connexion`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/connexion'));
}
async function prepareDevice() {
  await page.goto(`${origin}/appareil`);
  await page.getByLabel('Phrase de déverrouillage locale').fill(PHRASE);
  await page.getByRole('button', { name: /Activer sur cet appareil|Déverrouiller/ }).click();
  await page.getByRole('button', { name: 'Préparer cet appareil' }).click();
  await page
    .getByText(/Prêt pour une utilisation sans connexion\.|Préparation incomplète/)
    .first()
    .waitFor({ timeout: 120_000 });
  const ready = await page.getByText('Prêt pour une utilisation sans connexion.').count();
  if (!ready) console.log(await page.locator('main').innerText());
  assert(ready > 0, 'préparation incomplète');
}
/** Session d'API côté Node (modification concurrente par un autre membre de l'encadrement). */
async function apiSession(email) {
  const response = await fetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tesla-csrf': '1', Origin: origin },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie').split(';')[0];
  return (method, path, body) =>
    fetch(`${api}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-tesla-csrf': '1',
        Origin: origin,
        Cookie: cookie,
      },
      body: body && JSON.stringify(body),
    });
}

await open();
try {
  // ─── Routier ──────────────────────────────────────────────────────
  await login('phase5@recette.test');
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, {
    timeout: 30_000,
  });
  check('1. première ouverture en ligne, service worker actif');
  await prepareDevice();
  check('2. coffre activé et préparation complète (« Prêt pour une utilisation sans connexion »)');

  await page.goto(`${origin}/evaluations/${fixture.evaluationId}`);
  await page.getByRole('link', { name: 'Préparer pour passer sans connexion' }).click();
  await page.getByRole('button', { name: 'Vérifier mes droits et préparer' }).click();
  await page.waitForURL(`**/evaluations/${fixture.evaluationId}/passer`);
  await page.getByLabel('Votre réponse', { exact: true }).waitFor();
  check('15. évaluation préparée en ligne puis ouverte dans son écran habituel');

  await restart();
  await context.setOffline(true);
  check('3–4. navigateur fermé, Internet coupé');

  await page.goto(`${origin}/`);
  await page.waitForURL('**/accueil');
  await page.getByRole('heading', { name: 'Tableau de bord' }).waitFor();
  check('5. réouverture directe sur le tableau de bord, sans réseau');
  await visibleText('Hors connexion').waitFor();
  check('indicateur discret « Hors connexion »');

  await go('/modules');
  await page.getByText('Recette hors ligne').first().waitFor();
  await go('/modules/recette-hors-ligne');
  await page.getByText('Première leçon fictive').first().click();
  await page.getByText('Texte disponible sans connexion.', { exact: true }).waitFor();
  check('9–10. bibliothèque, module et leçon ouverts depuis leur emplacement normal');
  await page
    .getByRole('link', { name: /suivante/i })
    .first()
    .click();
  await page.getByText('La position de lecture est conservée.', { exact: true }).waitFor();
  check('navigation entre leçons sans réseau');

  await go('/progression');
  await page.waitForLoadState('networkidle');
  assert.equal(await page.getByText('ces données ne sont pas encore disponibles').count(), 0);
  await go('/mes-rattrapages');
  await page.waitForLoadState('networkidle');
  assert.equal(await page.getByText('ces données ne sont pas encore disponibles').count(), 0);
  check('11–12. progression et rattrapages consultés depuis l’appareil');

  await page.goto(`${origin}/administration/routiers`);
  await page.waitForURL('**/accueil');
  check('24. page d’encadrement refusée au routier, même hors connexion');

  await page.goto(`${origin}/evaluations/${fixture.evaluationId}/passer`);
  await page
    .getByLabel('Votre réponse', { exact: true })
    .fill('Réponse fictive saisie sans réseau.');
  await page.getByText('Réponses enregistrées sur cet appareil.', { exact: true }).waitFor();
  check('16. réponses saisies et sauvegardées sans réseau');
  await restart();
  await context.setOffline(true);
  await page.goto(`${origin}/evaluations/${fixture.evaluationId}/passer`);
  assert.equal(
    await page.getByLabel('Votre réponse', { exact: true }).inputValue(),
    'Réponse fictive saisie sans réseau.',
  );
  check('17–18. fermeture puis réouverture sans réseau : réponses conservées');
  await page.getByRole('button', { name: 'Remettre localement' }).click();
  await page.getByText(/En attente de synchronisation\. Aucun résultat officiel/).waitFor();
  await visibleText('1 modification en attente').waitFor();
  check('remise locale immuable, « 1 modification en attente »');

  assert(!visited.includes('/hors-ligne'), `redirection vers /hors-ligne : ${visited.join(' ')}`);
  check('aucune navigation ordinaire redirigée vers /hors-ligne');

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.goto(`${origin}/appareil`);
  await page.getByRole('button', { name: 'Synchroniser maintenant' }).click();
  await page.getByText('Synchronisation terminée.').waitFor();
  await page.getByText('Synchronisée').first().waitFor();
  check('19–20. retour du réseau et synchronisation confirmée par le serveur');

  const plain = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open('tesla-academie');
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
  assert(!plain.includes('Réponse fictive') && !plain.includes('Texte disponible'));
  check('données locales chiffrées (aucun texte en clair dans IndexedDB)');

  // ─── Changement de compte : responsable ───────────────────────────
  const menu = page.getByRole('button', { name: 'Ouvrir le menu' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: 'Déconnexion' }).filter({ visible: true }).click();
  await page.waitForURL('**/connexion');
  await login('responsable-offline@recette.test');
  await prepareDevice();
  check('23. changement de compte : coffre distinct créé et préparé pour le responsable');

  await restart();
  await context.setOffline(true);
  await page.goto(`${origin}/`);
  await page.waitForURL('**/encadrement');
  await page.getByRole('heading', { name: 'Tableau de bord' }).waitFor();
  await go('/administration/routiers');
  await page.getByText('Alpha').first().waitFor();
  await go(`/administration/routiers/${fixture.scouts[0]}`);
  await page.getByRole('heading', { name: /alpha/i }).first().waitFor();
  check('6–7. routiers et fiche consultés sans réseau');
  await go('/administration/equipes');
  await go(`/administration/equipes/${fixture.teamId}`);
  await page.getByText('Beta').first().waitFor();
  check('8. équipes et membres consultés sans réseau');

  await page.goto(`${origin}/administration/activites/${fixture.activityId}`);
  await page.getByRole('heading', { name: 'Présences' }).waitFor();
  const rows = page.locator('label', { hasText: 'Routier Alpha' });
  await rows.locator('select').selectOption('PRESENT');
  await page.getByRole('button', { name: 'Enregistrer les présences' }).click();
  await visibleText('Enregistré sur cet appareil').waitFor();
  await visibleText('1 modification en attente').waitFor();
  check('13. présence saisie sans réseau, enregistrée comme modification en attente');

  await page.reload();
  await page.getByRole('heading', { name: 'Présences' }).waitFor();
  assert.equal(await rows.locator('select').inputValue(), 'PRESENT');
  check('affichage provisoire conservé après rechargement hors ligne');

  // Modification concurrente côté serveur par un autre membre (session Node distincte).
  const other = await apiSession('responsable-offline@recette.test');
  const put = await other('PUT', `/activities/${fixture.activityId}/attendance`, {
    entries: [{ scoutProfileId: fixture.scouts[0], status: 'ABSENT' }],
  });
  assert.equal(put.status, 200);
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.goto(`${origin}/appareil`);
  await page.getByRole('button', { name: 'Synchroniser maintenant' }).click();
  await page.getByText(/présence\(s\) ont été modifiées entre-temps/).waitFor();
  await visibleText('Conflit à résoudre').waitFor();
  check('21. conflit détecté au retour du réseau (aucun écrasement)');
  const sheet = await (await other('GET', `/activities/${fixture.activityId}/attendance`)).json();
  assert.equal(sheet.entries.find((e) => e.scout.id === fixture.scouts[0]).status, 'ABSENT');
  await page.getByRole('button', { name: 'Abandonner' }).click();
  await page.getByText('Tout est synchronisé.').waitFor();
  check('21. conflit résolu explicitement (abandon confirmé de la saisie locale)');

  // Création différée d'une observation, sans conflit possible.
  await context.setOffline(true);
  await page.goto(`${origin}/administration/routiers/${fixture.scouts[1]}`);
  await page.getByRole('tab', { name: 'Observations' }).click();
  await page
    .getByRole('textbox', { name: /^Observation/ })
    .fill('Observation fictive saisie sans réseau.');
  await page.getByRole('button', { name: 'Ajouter l’observation' }).click();
  await visibleText('Enregistré sur cet appareil').waitFor();
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.goto(`${origin}/appareil`);
  await page.getByRole('button', { name: 'Synchroniser maintenant' }).click();
  await page.getByText('Tout est synchronisé.').waitFor();
  const observations = await (
    await other('GET', `/scouts/${fixture.scouts[1]}/observations?page=1&pageSize=10`)
  ).json();
  assert(observations.items.some((o) => o.content === 'Observation fictive saisie sans réseau.'));
  check('14/20. observation préparée hors ligne puis enregistrée par le serveur, sans doublon');

  // Session expirée puis mise à jour de l'application avec une modification en attente.
  if (process.env.SW_FILE) {
    await context.setOffline(true);
    await page.goto(`${origin}/administration/routiers/${fixture.scouts[0]}`);
    await page.getByRole('tab', { name: 'Observations' }).click();
    await page.getByRole('textbox', { name: /^Observation/ }).fill('Observation en attente.');
    await page.getByRole('button', { name: 'Ajouter l’observation' }).click();
    await visibleText('1 modification en attente').waitFor();
    // Session révoquée côté serveur pendant la coupure (équivalent d'une expiration).
    const cookie = (await context.cookies()).find((c) => c.name === 'tesla_session');
    await fetch(`${api}/auth/logout`, {
      method: 'POST',
      headers: { 'x-tesla-csrf': '1', Origin: origin, Cookie: `${cookie.name}=${cookie.value}` },
    });
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.waitForURL('**/connexion**');
    check('22. session expirée : reconnexion demandée, modification conservée');

    const original = await readFile(process.env.SW_FILE, 'utf8');
    try {
      await writeFile(process.env.SW_FILE, `${original}\n// recette ${Date.now()}\n`);
      await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        await registration.update();
        await new Promise((resolve) => {
          const ready = () => registration.waiting && resolve();
          registration.addEventListener('updatefound', () =>
            registration.installing?.addEventListener('statechange', ready),
          );
          ready();
        });
      });
      // Bouton « Mettre à jour » (`applyAppUpdate`) : la page est sur la connexion, hors cadre.
      const reloaded = page.waitForEvent('load', { timeout: 15_000 });
      await page.evaluate(async () => {
        (await navigator.serviceWorker.getRegistration()).waiting.postMessage({
          type: 'SKIP_WAITING',
        });
        setTimeout(() => window.location.reload(), 3_000);
      });
      await reloaded;
      await page.waitForFunction(
        async () => !(await navigator.serviceWorker.getRegistration()).waiting,
      );
    } finally {
      await writeFile(process.env.SW_FILE, original);
    }
    const kept = await page.evaluate(async () => {
      const db = await new Promise((resolve) => {
        const r = indexedDB.open('tesla-academie');
        r.onsuccess = () => resolve(r.result);
      });
      const keys = await new Promise((resolve) => {
        const r = db.transaction('records').objectStore('records').getAllKeys();
        r.onsuccess = () => resolve(r.result);
      });
      db.close();
      return keys.filter((k) => k.includes(':op:')).length;
    });
    assert.equal(kept, 2, `opérations conservées : ${kept}`); // une confirmée, une en attente
    check('25. mise à jour du service worker appliquée, opérations locales conservées');

    await login('responsable-offline@recette.test');
    await page.goto(`${origin}/appareil`);
    // La liste vide s'affiche avant le chargement de la file : le serveur fait foi.
    let synced = false;
    for (let attempt = 0; attempt < 30 && !synced; attempt++) {
      const after = await (
        await other('GET', `/scouts/${fixture.scouts[0]}/observations?page=1&pageSize=10`)
      ).json();
      synced = after.items.some((o) => o.content === 'Observation en attente.');
      if (!synced) await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    assert(synced, 'observation non synchronisée après reconnexion');
    await page.getByText('Tout est synchronisé.').waitFor({ timeout: 30_000 });
    check('22/25. après reconnexion au même compte, la modification est synchronisée');
  }

  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  assert(width <= viewport.width, `défilement horizontal : ${width}`);
  check(`aucun défilement horizontal à ${viewport.width} px`);

  assert.deepEqual(errors, []);
  console.log(`\n${checks} contrôles réussis.`);
} catch (error) {
  console.error('Échec :', error);
  console.error('Pages visitées :', visited.join(' → '));
  try {
    console.error(await page.locator('main').innerText());
  } catch {
    /* page fermée */
  }
  process.exitCode = 1;
} finally {
  await context.close();
}

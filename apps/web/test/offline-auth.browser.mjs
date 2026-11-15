/**
 * Recette navigateur du mot de passe unique hors connexion (refonte lot 3, D180). Navigateur réel
 * (Chromium, profil persistant, service worker de production), base « _test » préparée par
 * `offline-browser-fixture.mts` (comptes fictifs). Le mot de passe d'un compte fictif est changé
 * pendant la recette : relancer la fixture avant toute autre recette.
 *   PLAYWRIGHT_MODULE=…/playwright-core/index.mjs CHROMIUM_PATH=… PROFILE_DIR=/chemin/profil \
 *   [SHOTS_DIR=…] node apps/web/test/offline-auth.browser.mjs
 */
import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
const api = process.env.API_ORIGIN ?? 'http://localhost:4000/api/v1';
const shots = process.env.SHOTS_DIR;
const profile = process.env.PROFILE_DIR;
assert.ok(profile, 'PROFILE_DIR requis');
const PASSWORD = 'phrase-fictive-recette-phase5';
const NEW_PASSWORD = 'nouveau-mot-de-passe-recette-1';
const THIRD_PASSWORD = 'troisieme-mot-de-passe-recette';
const ROUTIER = 'phase5@recette.test';
const CHEF = 'chef-phase5@recette.test';

await rm(profile, { recursive: true, force: true });
if (shots) await mkdir(shots, { recursive: true });
const errors = [];
let checks = 0;
const check = (label) => console.log(`${++checks}. ${label}`);
let context;
let page;

async function open() {
  context = await chromium.launchPersistentContext(profile, {
    headless: true,
    executablePath: process.env.CHROMIUM_PATH,
    args: ['--no-sandbox'],
    viewport: { width: 390, height: 844 },
    locale: 'fr-FR',
  });
  page = context.pages()[0] ?? (await context.newPage());
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
}
async function restart() {
  await context.close();
  await open();
}
const shot = async (name) => {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
};
async function login(email, password, { offline = false } = {}) {
  await page.goto(`${origin}/connexion`);
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  if (offline) await page.getByLabel(/Utiliser aussi cet appareil sans connexion/).check();
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/connexion'));
}
async function logoutViaApi() {
  await page.request.post(`${api}/auth/logout`, { headers: { 'x-tesla-csrf': '1' } });
}
/** Session d'API côté Node : « un autre appareil » du même compte. */
async function otherDevice(email, password) {
  const response = await fetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tesla-csrf': '1', Origin: origin },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200, `connexion ${email}`);
  const cookie = response.headers.get('set-cookie').split(';')[0];
  return (method, path, body) =>
    fetch(`${api}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-tesla-csrf': '1', Origin: origin, Cookie: cookie },
      body: body && JSON.stringify(body),
    });
}
async function lockFromDevicePage() {
  await page.goto(`${origin}/appareil`);
  await page.getByRole('button', { name: 'Verrouiller' }).click();
}
/** Sans réseau : ouverture de l'application et déverrouillage local. */
async function unlockOffline(password) {
  await page.goto(`${origin}/`).catch(() => {});
  await page.getByText('Vous utilisez Nikola Tesla Académie hors ligne.').first().waitFor({ timeout: 30_000 });
  await page.getByLabel('Mot de passe', { exact: true }).last().fill(password);
  await page.getByRole('button', { name: /Ouvrir mon espace/ }).click();
}

await open();
try {
  // 1–2. Connexion en ligne avec préparation de l'appareil (un seul mot de passe saisi).
  await login(ROUTIER, PASSWORD, { offline: true });
  await page.waitForURL('**/appareil?preparer=1');
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 30_000 });
  await page
    .getByText(/Prêt pour une utilisation sans connexion\.|Préparation incomplète/)
    .first()
    .waitFor({ timeout: 180_000 });
  assert.ok(await page.getByText('Prêt pour une utilisation sans connexion.').count(), 'préparation incomplète');
  await page.getByText('Appareils préparés (1)').waitFor();
  await page.getByText('cet appareil', { exact: true }).waitFor();
  check('connexion + « Utiliser aussi cet appareil sans connexion » : coffre créé, appareil prêt');
  const stored = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('tesla-academie');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const all = (store) =>
      new Promise((resolve) => {
        const request = db.transaction(store).objectStore(store).getAll();
        request.onsuccess = () => resolve(request.result);
      });
    return JSON.stringify([await all('settings'), Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])]);
  });
  assert.ok(!stored.includes(PASSWORD), 'mot de passe en clair sur l’appareil');
  check('aucun mot de passe en clair dans IndexedDB ni localStorage');

  // 3–8. Fermeture, coupure, réouverture, mauvais mot de passe, bon mot de passe, lecture.
  await lockFromDevicePage();
  await restart();
  await context.setOffline(true);
  await unlockOffline('mauvais-mot-de-passe');
  await page.getByText('Mot de passe incorrect.').waitFor();
  await page.getByText(/Mot de passe changé récemment sur un autre appareil/).waitFor();
  await shot('hors-ligne-mauvais-mot-de-passe');
  check('hors connexion : message clair, mauvais mot de passe refusé');
  for (let i = 0; i < 2; i += 1) {
    await page.getByLabel('Mot de passe', { exact: true }).last().fill(`faux-${i}`);
    await page.getByRole('button', { name: /Ouvrir mon espace/ }).click();
    await page.waitForTimeout(400);
  }
  await page.getByRole('button', { name: /Patientez \d+ s/ }).waitFor({ timeout: 15_000 });
  check('essais répétés : attente imposée entre deux saisies');
  await page.getByRole('button', { name: /Ouvrir mon espace/ }).waitFor({ timeout: 15_000 });
  await page.getByLabel('Mot de passe', { exact: true }).last().fill(PASSWORD);
  await page.getByRole('button', { name: /Ouvrir mon espace/ }).click();
  await page.waitForURL('**/accueil', { timeout: 30_000 });
  check('hors connexion : le même mot de passe ouvre l’espace préparé');
  await page.goto(`${origin}/modules/recette-hors-ligne`).catch(() => {});
  await page.getByText('Première leçon fictive').first().click();
  await page.getByText('Texte disponible sans connexion.', { exact: true }).waitFor({ timeout: 20_000 });
  check('lecture d’un cours téléchargé sans réseau');
  await page.goto(`${origin}/administration/statistiques`).catch(() => {});
  await page.waitForFunction(
    () =>
      location.pathname === '/accueil' ||
      /Page non disponible sans connexion|pas encore disponibles sur cet appareil/.test(document.body.innerText),
    null,
    { timeout: 20_000 },
  );
  check('contenu non préparé : refus explicite, aucune page cassée');

  // 10–12. Retour du réseau, changement de mot de passe sur un autre appareil.
  await context.setOffline(false);
  const elsewhere = await otherDevice(ROUTIER, PASSWORD);
  assert.equal(
    (await elsewhere('POST', '/auth/password', { currentPassword: PASSWORD, newPassword: NEW_PASSWORD })).status,
    204,
  );
  // La session de cet appareil a été fermée par le serveur : reconnexion avec le nouveau mot de passe.
  await page.goto(`${origin}/accueil`);
  await page.waitForURL('**/connexion**', { timeout: 30_000 });
  await login(ROUTIER, NEW_PASSWORD);
  await page.waitForURL('**/accueil');
  check('mot de passe changé ailleurs : session fermée, reconnexion avec le nouveau');
  await lockFromDevicePage();
  await context.setOffline(true);
  await unlockOffline(PASSWORD);
  await page.getByText('Mot de passe incorrect.').waitFor();
  await page.waitForTimeout(1500);
  await page.getByLabel('Mot de passe', { exact: true }).last().fill(NEW_PASSWORD);
  await page.getByRole('button', { name: /Ouvrir mon espace/ }).click();
  await page.waitForURL('**/accueil', { timeout: 30_000 });
  check('données reprotégées : l’ancien mot de passe n’ouvre plus, le nouveau oui (aucune perte)');

  // 12 bis. Changement depuis cet appareil (Mon profil).
  await context.setOffline(false);
  await page.goto(`${origin}/accueil`);
  await page.goto(`${origin}/compte`);
  await page.getByLabel('Mot de passe actuel').fill(NEW_PASSWORD);
  await page.getByLabel(/^Nouveau mot de passe/).first().fill(THIRD_PASSWORD);
  const confirm = page.getByLabel(/Confirmer|Confirmation/);
  if (await confirm.count()) await confirm.fill(THIRD_PASSWORD);
  await page.getByRole('button', { name: /Modifier le mot de passe|Changer le mot de passe|Enregistrer/ }).click();
  await page.getByText(/Utilisez ce nouveau mot de passe, en ligne comme hors connexion/).first().waitFor({ timeout: 20_000 });
  await lockFromDevicePage();
  await context.setOffline(true);
  await unlockOffline(THIRD_PASSWORD);
  await page.waitForURL('**/accueil', { timeout: 30_000 });
  check('changement depuis cet appareil : nouveau mot de passe aussitôt valable hors connexion');
  await context.setOffline(false);

  // 16. Deux comptes sur le même navigateur : chacun son coffre, le mot de passe désigne le sien.
  await page.goto(`${origin}/accueil`);
  await logoutViaApi();
  await login(CHEF, PASSWORD, { offline: true });
  await page.waitForURL('**/appareil?preparer=1');
  await page
    .getByText(/Prêt pour une utilisation sans connexion\.|Préparation incomplète/)
    .first()
    .waitFor({ timeout: 180_000 });
  await lockFromDevicePage();
  await context.setOffline(true);
  await unlockOffline(PASSWORD);
  await page.waitForURL('**/accueil', { timeout: 30_000 });
  // Le menu de l'encadrement (« Routiers ») prouve que c'est le coffre du chef qui est ouvert.
  await page.waitForFunction(() => /Routiers/.test(document.body.innerText), null, { timeout: 20_000 });
  check('deux comptes : le mot de passe du chef ouvre son seul espace, sans liste de comptes');
  await context.setOffline(false);

  // 15. Appareil retiré depuis un autre appareil : données détruites au retour du réseau.
  const chefElsewhere = await otherDevice(CHEF, PASSWORD);
  const devices = await (await chefElsewhere('GET', '/auth/offline-devices')).json();
  const active = devices.items.filter((d) => !d.revokedAt);
  assert.equal(active.length, 1);
  assert.equal((await chefElsewhere('POST', `/auth/offline-devices/${active[0].id}/revoke`)).status, 204);
  await page.goto(`${origin}/appareil`);
  await page.getByText('Appareil retiré de votre compte', { exact: true }).waitFor({ timeout: 30_000 });
  await shot('appareil-retire');
  check('appareil retiré : détecté au retour du réseau, données illisibles, effacement proposé');
  await lockFromDevicePage().catch(() => {});
  await context.setOffline(true);
  await unlockOffline(PASSWORD);
  await page.getByText('Mot de passe incorrect.').waitFor();
  check('appareil retiré : le mot de passe n’ouvre plus ses données hors connexion');
  await context.setOffline(false);
  await page.goto(`${origin}/appareil`);
  await page.getByRole('button', { name: 'Effacer les données de cet appareil' }).click();
  await page.getByLabel(/J’accepte la perte définitive/).check();
  await page.getByRole('button', { name: 'Effacer les données de cet appareil' }).last().click();
  await page.getByText('Utiliser Tesla sans connexion', { exact: true }).waitFor({ timeout: 20_000 });
  check('effacement expliqué et confirmé, appareil de nouveau préparable');

  // 17. Ancien coffre à phrase locale (avant la mise à jour) : conversion unique, données conservées.
  await logoutViaApi();
  await page.goto(`${origin}/connexion`);
  const legacyUserId = await page.evaluate(
    async ({ api: base, email, password }) => {
      const res = await fetch(`${base}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-tesla-csrf': '1' },
        body: JSON.stringify({ email, password }),
      });
      const { user } = await res.json();
      await fetch(`${base}/auth/logout`, { method: 'POST', credentials: 'include', headers: { 'x-tesla-csrf': '1' } });
      const enc = new TextEncoder();
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const material = await crypto.subtle.importKey('raw', enc.encode('ancienne phrase locale'), 'PBKDF2', false, ['deriveKey']);
      const key = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
        material,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      );
      const seal = async (value, aad) => {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const bytes = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv, additionalData: enc.encode(aad) },
          key,
          enc.encode(JSON.stringify(value)),
        );
        return { iv: [...iv], bytes: [...new Uint8Array(bytes)] };
      };
      const id = `vault:${user.id}`;
      const db = await new Promise((resolve) => {
        const r = indexedDB.open('tesla-academie');
        r.onsuccess = () => resolve(r.result);
      });
      const put = (store, value) =>
        new Promise((resolve) => {
          const tx = db.transaction(store, 'readwrite');
          tx.objectStore(store).put(value);
          tx.oncomplete = resolve;
        });
      await put('settings', { id, revision: 1, salt: [...salt], check: await seal({ ownerId: user.id }, id) });
      const recordId = `${user.id}:reading:last`;
      await put('records', { id: recordId, revision: 1, cipher: await seal({ slug: 'recette-hors-ligne', note: 'conservée' }, recordId) });
      return user.id;
    },
    { api, email: CHEF, password: PASSWORD },
  );
  assert.ok(legacyUserId);
  await login(CHEF, PASSWORD);
  await page.waitForURL('**/appareil');
  await page.getByText(/préparé avec une phrase locale/).waitFor();
  await page.getByLabel('Ancienne phrase locale').fill('ancienne phrase locale');
  await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Utiliser mon mot de passe' }).click();
  await page.getByRole('button', { name: 'Verrouiller' }).waitFor({ timeout: 60_000 });
  const converted = await page.evaluate(async (userId) => {
    const db = await new Promise((resolve) => {
      const r = indexedDB.open('tesla-academie');
      r.onsuccess = () => resolve(r.result);
    });
    return new Promise((resolve) => {
      const r = db.transaction('settings').objectStore('settings').get(`vault:${userId}`);
      r.onsuccess = () => resolve(r.result?.format);
    });
  }, legacyUserId);
  assert.equal(converted, 3);
  await page.getByRole('button', { name: 'Verrouiller' }).click();
  await context.setOffline(true);
  await unlockOffline(PASSWORD);
  await page.waitForURL('**/accueil', { timeout: 30_000 });
  check('ancienne phrase convertie une fois : ensuite le seul mot de passe ouvre les données');
  await context.setOffline(false);

  // 17 bis. Données locales corrompues : refus propre, aucune exception non gérée.
  await page.goto(`${origin}/appareil`);
  await page.getByRole('button', { name: 'Verrouiller' }).click();
  await page.evaluate(async (userId) => {
    const db = await new Promise((resolve) => {
      const r = indexedDB.open('tesla-academie');
      r.onsuccess = () => resolve(r.result);
    });
    const header = await new Promise((resolve) => {
      const r = db.transaction('settings').objectStore('settings').get(`vault:${userId}`);
      r.onsuccess = () => resolve(r.result);
    });
    header.password.bytes[0] = (header.password.bytes[0] + 1) % 256;
    await new Promise((resolve) => {
      const tx = db.transaction('settings', 'readwrite');
      tx.objectStore('settings').put(header);
      tx.oncomplete = resolve;
    });
  }, legacyUserId);
  await context.setOffline(true);
  await unlockOffline(PASSWORD);
  await page.getByText('Mot de passe incorrect.').waitFor();
  check('coffre altéré : ouverture refusée sans erreur de page');
  // En ligne, la clé d'appareil répare la protection par mot de passe à la connexion suivante.
  await context.setOffline(false);
  await page.goto(`${origin}/connexion`);
  await logoutViaApi();
  await login(CHEF, PASSWORD);
  await page.goto(`${origin}/appareil`);
  await page.getByRole('button', { name: 'Verrouiller' }).click();
  await context.setOffline(true);
  await unlockOffline(PASSWORD);
  await page.waitForURL('**/accueil', { timeout: 30_000 });
  check('protection altérée réparée à la connexion suivante grâce à la clé d’appareil');
  await context.setOffline(false);
} catch (error) {
  await shot('echec').catch(() => {});
  console.error('URL :', page?.url());
  throw error;
} finally {
  await context?.close();
}
assert.deepEqual(errors, [], `erreurs de page : ${errors.join(' | ')}`);
console.log(`Recette mot de passe unique hors connexion : ${checks} contrôles réussis.`);

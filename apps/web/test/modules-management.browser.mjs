/**
 * Recette navigateur de la gestion des modules V2 (D171) : recherche, filtres, vues rapides, URL,
 * retour arrière, pagination, suppression individuelle d'un brouillon et abandon d'une version de
 * travail, responsive (360 → 1440 px), droits du chef. Base « _test » isolée préparée par
 * `offline-browser-fixture.mts` puis `catalogue-browser-fixture.mts` ; données fictives.
 *   PLAYWRIGHT_MODULE=…/playwright-core/index.mjs CHROMIUM_PATH=… SHOTS_DIR=… \
 *   node apps/web/test/modules-management.browser.mjs
 */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
const api = process.env.API_ORIGIN ?? 'http://localhost:4000/api/v1';
const shots = process.env.SHOTS_DIR;
const PASSWORD = 'phrase-fictive-recette-phase5';
const RESPONSABLE = 'responsable-offline@recette.test';
const CHEF = 'chef-phase5@recette.test';
const LIST = '/administration/modules';

if (shots) await mkdir(shots, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox'],
});
const errors = [];
let checks = 0;
const check = (label) => console.log(`${++checks}. ${label}`);

async function session(email, width = 1440) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: 'reduce',
    locale: 'fr-FR',
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${origin}/connexion`);
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: /se connecter/i }).click();
  await page.waitForURL(/\/accueil/);
  return { context, page };
}

const send = (page, method, path, data) =>
  page.request.fetch(`${api}${path}`, {
    method,
    headers: { 'x-tesla-csrf': '1', 'content-type': 'application/json' },
    data,
  });

const noHorizontalScroll = async (page) =>
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    `défilement horizontal sur ${page.url()} (${page.viewportSize().width} px)`,
  );

const shot = async (page, name) => {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
};

/** Attend la fin du chargement de la liste puis compare le nombre de résultats affiché. */
const expectTotal = async (page, expected) => {
  let shown = null;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const loading = await page.locator('.opacity-70').count();
    const text = await page
      .getByText(/^\d+ modules?$/)
      .first()
      .textContent({ timeout: 10_000 });
    shown = Number(text.split(' ')[0]);
    if (!loading && shown === expected) return;
    await page.waitForTimeout(200);
  }
  assert.equal(shown, expected, `nombre de modules sur ${page.url()}`);
};

const stat = async (page, label) =>
  Number(
    await page
      .locator('dl > div')
      .filter({ has: page.getByText(label, { exact: true }) })
      .locator('dd')
      .textContent(),
  );

const expectStat = async (page, label, expected) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if ((await stat(page, label)) === expected) return;
    await page.waitForTimeout(200);
  }
  assert.equal(await stat(page, label), expected, label);
};

const settle = (page) => page.waitForLoadState('networkidle');

// ─── Responsable plein, ordinateur ────────────────────────────────────────
const { context, page } = await session(RESPONSABLE);
await page.goto(`${origin}${LIST}`);
await page.getByRole('heading', { name: 'Tous les modules' }).waitFor();
await settle(page);
await expectTotal(page, 16);
await expectStat(page, 'Modules accessibles', 16);
await expectStat(page, 'Publiés', 16);
await expectStat(page, 'Jamais publiés', 0);
// Quatre contrôles principaux visibles, filtres avancés repliés.
for (const label of ['Rechercher', 'Statut', 'Étape', 'Tri']) {
  assert.ok(await page.getByLabel(label, { exact: true }).isVisible(), label);
}
assert.equal(await page.getByLabel('Publication').isVisible(), false);
assert.equal(await page.locator('canvas, svg.recharts-surface').count(), 0);
await noHorizontalScroll(page);
await shot(page, '01-liste-1440');
check('liste, 4 indicateurs réels, 4 contrôles visibles, aucun graphique');

// Recherche serveur insensible aux accents et à la casse, conservée dans l'URL.
await page.getByLabel('Rechercher', { exact: true }).fill('PRIERE');
await page.waitForURL(/search=PRIERE/);
await settle(page);
await expectTotal(page, 1);
assert.ok(await page.getByRole('link', { name: 'Prière de la Route' }).first().isVisible());
const priere = await (await send(page, 'GET', '/editor/modules?search=priere')).json();
const code = priere.items[0].code;
await page.getByLabel('Rechercher', { exact: true }).fill(code.toLowerCase());
await page.waitForURL(new RegExp(`search=${code.toLowerCase()}`));
await expectTotal(page, 1);
assert.ok(await page.locator('table').getByText(code).isVisible());
await page.getByLabel('Rechercher', { exact: true }).fill('introuvable-xyz');
await page.waitForURL(/introuvable/);
await page.getByText('Aucun module ne correspond').waitFor();
await page.getByRole('button', { name: 'Réinitialiser les filtres' }).click();
await page.waitForURL((url) => url.search === '');
await settle(page);
assert.equal(await page.getByLabel('Rechercher', { exact: true }).inputValue(), '');
check('recherche serveur (accents, casse, code), état vide et réinitialisation');

// Filtres avancés combinés, pastilles, suppression individuelle d'une pastille.
await page.getByRole('button', { name: /Filtres avancés/ }).click();
await page.getByLabel('Provenance').selectOption('manual');
await page.waitForURL(/origin=manual/);
await settle(page);
await expectTotal(page, 1);
await page.getByLabel('Questionnaire').selectOption('with');
await page.waitForURL(/evaluation=with/);
await expectTotal(page, 0);
await page.getByText('Aucun module ne correspond').waitFor();
const chips = page.getByRole('list', { name: 'Filtres actifs' }).getByRole('button');
assert.equal(await chips.count(), 2);
await shot(page, '02-filtres-avances-1440');
await page.getByRole('button', { name: 'Retirer le filtre Création manuelle' }).click();
await page.waitForURL((url) => !url.search.includes('origin'));
await expectTotal(page, 14);
await page.getByRole('button', { name: 'Réinitialiser' }).click();
await page.waitForURL((url) => url.search === '');
check('filtres avancés combinés, pastilles supprimables, réinitialisation');

// Vues rapides = préréglages.
await page.getByRole('button', { name: 'Publiés', exact: true }).click();
await page.waitForURL(/publication=current/);
assert.equal(
  await page.getByRole('button', { name: 'Publiés', exact: true }).getAttribute('aria-pressed'),
  'true',
);
await page.getByRole('button', { name: 'Sans questionnaire' }).click();
await page.waitForURL(/evaluation=without/);
await expectTotal(page, 2);
await page.getByRole('button', { name: 'Tous', exact: true }).click();
await page.waitForURL((url) => url.search === '');
check('vues rapides (Publiés, Sans questionnaire, Tous)');

// Duplication depuis le menu ; retour à la liste filtrée depuis l'éditeur.
await page.getByLabel('Rechercher', { exact: true }).fill('prière');
await page.waitForURL(/search=/);
await settle(page);
await page.getByRole('button', { name: 'Actions pour Prière de la Route' }).click();
await page.getByRole('menuitem', { name: 'Dupliquer' }).click();
await page.waitForURL(/\/encadrement\/modules\/[^/]+\/modifier\?retour=/);
await page.getByRole('heading', { name: 'Prière de la Route (copie)' }).waitFor();
await page.getByRole('link', { name: 'Tous les modules' }).click();
await page.waitForURL(/\/administration\/modules\?search=pri%C3%A8re|search=pri/);
await settle(page);
assert.equal(await page.getByLabel('Rechercher', { exact: true }).inputValue(), 'prière');
await expectTotal(page, 2);
await expectStat(page, 'Jamais publiés', 1);
check('duplication, retour à la liste avec la recherche conservée, compteurs à jour');

// Bouton « Précédent » : filtres restaurés.
await page.getByLabel('Statut').selectOption('BROUILLON');
await page.waitForURL(/status=BROUILLON/);
await settle(page);
await page.getByRole('link', { name: 'Prière de la Route (copie)' }).first().click();
await page.waitForURL(/modifier/);
await page.goBack();
await page.waitForURL(/status=BROUILLON/);
assert.equal(await page.getByLabel('Statut').inputValue(), 'BROUILLON');
assert.equal(await page.getByLabel('Rechercher', { exact: true }).inputValue(), 'prière');
check('retour arrière : recherche et statut conservés');

// Module publié : pas de suppression proposée, archivage via la révision.
await page.getByRole('button', { name: 'Tous', exact: true }).click();
await page.waitForURL((url) => url.search === '');
await expectTotal(page, 17);
await page.getByLabel('Rechercher', { exact: true }).fill('prière');
await page.waitForURL(/search=/);
await settle(page);
await page.getByRole('button', { name: 'Actions pour Prière de la Route', exact: true }).click();
const menu = page.getByRole('menu');
assert.equal(await menu.getByRole('menuitem', { name: /Supprimer/ }).count(), 0);
assert.equal(await menu.getByRole('menuitem', { name: /Archiver la publication/ }).count(), 1);
await page.keyboard.press('Escape');
check('module publié : aucune suppression, archivage proposé');

// Suppression individuelle confirmée de la copie (avec leçons), double clic neutralisé.
await page.getByRole('button', { name: 'Actions pour Prière de la Route (copie)' }).click();
await page.getByRole('menuitem', { name: 'Supprimer le brouillon…' }).click();
const dialog = page.getByRole('dialog');
await dialog
  .getByText('Vous allez supprimer le brouillon « Prière de la Route (copie) »')
  .waitFor();
assert.ok(await dialog.getByText(/^MOD-\d{3,}$/).isVisible());
assert.ok(await dialog.getByText('Ses leçons non publiées seront supprimées.').isVisible());
await shot(page, '03-confirmation-suppression-1440');
let deleteCalls = 0;
page.on('request', (request) => {
  if (request.method() === 'POST' && request.url().includes('/draft-deletion')) deleteCalls += 1;
});
const confirm = dialog.getByRole('button', { name: 'Supprimer le brouillon' });
await confirm.dblclick();
await page.getByText('Brouillon supprimé', { exact: true }).waitFor();
await dialog.waitFor({ state: 'detached' });
await settle(page);
assert.equal(deleteCalls, 1, 'une seule requête malgré le double clic');
await expectTotal(page, 1);
await expectStat(page, 'Jamais publiés', 0);
assert.ok(await page.getByRole('link', { name: 'Prière de la Route' }).first().isVisible());
check('brouillon avec leçons supprimé après confirmation ; original publié intact');

// Abandon d'une version de travail d'un module publié.
await page.getByRole('button', { name: 'Actions pour Prière de la Route', exact: true }).click();
await page.getByRole('menuitem', { name: 'Créer une nouvelle version' }).click();
await page.waitForURL(/modifier/);
await page.goto(`${origin}${LIST}?publication=with_working`);
await settle(page);
await expectTotal(page, 1);
await page.getByRole('button', { name: 'Actions pour Prière de la Route' }).click();
await page.getByRole('menuitem', { name: 'Abandonner la version de travail…' }).click();
await dialog.getByText('La version 1 déjà publiée reste en ligne, inchangée.').waitFor();
await dialog.getByRole('button', { name: 'Abandonner la version' }).click();
await page.getByText('Version de travail abandonnée', { exact: true }).waitFor();
await settle(page);
await page.getByText('Aucun module ne correspond').waitFor();
await page.goto(`${origin}${LIST}?search=priere`);
await settle(page);
assert.ok(await page.getByText('En ligne · v1').first().isVisible());
check('version de travail abandonnée ; version publiée conservée');

// Pagination serveur et correction de la page devenue vide après suppression.
for (let index = 1; index <= 5; index += 1) {
  const response = await send(page, 'POST', '/editor/modules', {
    title: `Brouillon de recette ${index}`,
    summary: 'Données fictives.',
  });
  assert.equal(response.status(), 201);
}
await page.goto(`${origin}${LIST}?sort=code_asc&page=2`);
await settle(page);
await expectTotal(page, 21);
assert.ok(await page.getByText('Page 2 sur 2').isVisible());
await page.getByRole('button', { name: 'Actions pour Brouillon de recette 5' }).click();
await page.getByRole('menuitem', { name: 'Supprimer le brouillon…' }).click();
await dialog.getByRole('button', { name: 'Supprimer le brouillon' }).click();
await page.getByText('Brouillon supprimé', { exact: true }).waitFor();
await page.waitForURL((url) => !url.search.includes('page=2'));
await settle(page);
await expectTotal(page, 20);
check('pagination serveur ; page vide corrigée après suppression');

// Tri par titre stable.
await page.goto(`${origin}${LIST}?sort=title_asc`);
await settle(page);
const titles = await page.locator('table tbody tr td:first-child a').allTextContents();
assert.deepEqual(
  titles,
  [...titles].sort((a, b) => a.localeCompare(b, 'fr')),
);
check('tri par titre (ordre alphabétique)');

// Responsive : cartes et menu sur mobile, tableau masqué, aucun défilement horizontal.
for (const width of [360, 390, 768, 1024, 1440]) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${origin}${LIST}?status=BROUILLON`);
  await settle(page);
  await noHorizontalScroll(page);
  const table = await page.locator('table').isVisible();
  assert.equal(table, width >= 768, `tableau à ${width} px`);
  if (width < 768) {
    await page.getByRole('button', { name: 'Actions pour Brouillon de recette 1' }).click();
    assert.ok(await page.getByRole('menuitem', { name: 'Supprimer le brouillon…' }).isVisible());
    const box = await page.getByRole('menuitem').first().boundingBox();
    assert.ok(box.height >= 40, 'zone tactile ≥ 40 px');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /Filtres avancés/ }).click();
    await noHorizontalScroll(page);
  }
  await shot(page, `04-brouillons-${width}`);
}
check('responsive 360 / 390 / 768 / 1024 / 1440 px');
await context.close();

// ─── Chef : périmètre et actions limitées ─────────────────────────────────
const chef = await session(CHEF, 390);
await chef.page.goto(`${origin}/encadrement/modules`);
await chef.page.getByRole('heading', { name: 'Mes modules' }).waitFor();
await settle(chef.page);
assert.equal(await chef.page.getByRole('button', { name: 'À approuver' }).count(), 0);
await expectTotal(chef.page, 1); // le chef ne voit que ses modules
await chef.page.getByRole('button', { name: 'Actions pour Recette hors ligne' }).click();
const chefMenu = chef.page.getByRole('menu');
assert.equal(
  await chefMenu.getByRole('menuitem', { name: /Archiver|Supprimer|Approuver/ }).count(),
  0,
);
await chef.page.keyboard.press('Escape');
// Appel direct à l'API sur le brouillon d'un autre : refusé sans révéler son existence.
const other = await (
  await send(chef.page, 'GET', '/editor/modules?search=Brouillon%20de%20recette', undefined)
).json();
assert.equal(other.total, 0);
await shot(chef.page, '05-chef-390');
check('chef : ses modules seulement, aucune décision ni suppression proposée');
await chef.context.close();

await browser.close();
assert.deepEqual(errors, [], `erreurs JavaScript : ${errors.join(' | ')}`);
console.log(`Recette gestion des modules : ${checks} contrôles réussis.`);

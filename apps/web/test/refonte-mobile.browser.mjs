/**
 * Recette navigateur de la refonte mobile (D182) : barre inférieure commune (routier, encadrement),
 * menu « Plus », sidebar repliable, pages publiques sans navigation, largeurs 320 → 1440 px, puis
 * scénario module → leçons : « Prières et textes de la Route » (3 leçons, réorganisation,
 * publication), ajout d'une 4e leçon à un module en ligne sans le recréer, lecture côté routier,
 * brouillon invisible, reprise de lecture après republication, coupure réseau, contrôle d'accès.
 * Base « _test » préparée par `apps/api/test/offline-browser-fixture.mts` ; données fictives.
 *   PLAYWRIGHT_MODULE=…/playwright-core/index.mjs CHROMIUM_PATH=… WEB_ORIGIN=… API_ORIGIN=… \
 *   [SHOTS_DIR=…] [BROWSER=webkit] node apps/web/test/refonte-mobile.browser.mjs
 */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const playwright = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
/** Moteur : `chromium` (défaut) ou `webkit` (moteur de Safari, image Docker Playwright). */
const engine = process.env.BROWSER ?? 'chromium';
const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
const api = process.env.API_ORIGIN ?? 'http://localhost:4000/api/v1';
const shots = process.env.SHOTS_DIR;
const PASSWORD = 'phrase-fictive-recette-phase5';
const ROUTIER = 'phase5@recette.test';
const CHEF = 'chef-phase5@recette.test';
const RESPONSABLE = 'responsable-offline@recette.test';
const MODULE_TITLE = 'Prières et textes de la Route';

if (shots) await mkdir(shots, { recursive: true });
const browser = await playwright[engine].launch(
  engine === 'chromium'
    ? { headless: true, executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] }
    : { headless: true },
);
const errors = [];
let checks = 0;
const check = (label) => console.log(`${++checks}. ${label}`);
const shot = async (page, name) => {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: false });
};
const opened = [];
process.on('uncaughtException', async (error) => {
  console.error(error);
  for (const [index, page] of opened.entries()) {
    await shot(page, `echec-${index}`).catch(() => {});
    console.error(`URL ${index} :`, page.url());
  }
  console.error('Erreurs page :', errors.join(' | '));
  process.exit(1);
});

async function session(email, width = 390, height = 844) {
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion: 'reduce',
    locale: 'fr-FR',
    hasTouch: width < 1024,
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => {
    // WebKit signale ainsi une requête (préchargement, requête en cours) annulée par une
    // navigation ; une vraie erreur CORS ferait échouer les vérifications fonctionnelles.
    // Même chose pour le repli du service worker (`Response.error()` sur une charge RSC
    // indisponible, notamment pendant la coupure réseau simulée), que Next.js transforme en
    // navigation complète.
    if (
      engine === 'webkit' &&
      /due to access control checks|Response served by service worker is an error/.test(
        error.message,
      )
    )
      return;
    errors.push(error.message);
  });
  opened.push(page);
  await page.goto(`${origin}/connexion`);
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: /se connecter/i }).click();
  await page.waitForURL(/\/accueil/);
  return page;
}
const send = async (page, method, path, data) => {
  const response = await page.request.fetch(`${api}${path}`, {
    method,
    headers: { 'x-tesla-csrf': '1', 'content-type': 'application/json' },
    data,
  });
  return response;
};
const json = async (page, method, path, data) => {
  const response = await send(page, method, path, data);
  assert.ok(response.ok(), `${method} ${path} → ${response.status()} ${await response.text()}`);
  return response.status() === 204 ? null : response.json();
};
const noHorizontalScroll = async (page) =>
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    `défilement horizontal sur ${page.url()} (${page.viewportSize().width} px)`,
  );
const bottomNav = (page) => page.getByRole('navigation', { name: 'Navigation principale mobile' });
const tabLabels = async (page) =>
  (await bottomNav(page).locator('li').allInnerTexts()).map((text) => text.trim().split('\n')[0]);
const activeTab = async (page) =>
  (await bottomNav(page).locator('[aria-current="page"]').allInnerTexts()).map((t) => t.trim());
const paragraph = (text) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

// ---------------------------------------------------------------------------------------------
// 1. Pages publiques : aucune navigation authentifiée.
{
  const context = await browser.newContext({ viewport: { width: 360, height: 780 } });
  const page = await context.newPage();
  for (const path of ['/connexion', '/mot-de-passe-oublie']) {
    await page.goto(`${origin}${path}`);
    await page.waitForLoadState('networkidle');
    assert.equal(await bottomNav(page).count(), 0, `barre inférieure sur ${path}`);
    await noHorizontalScroll(page);
  }
  await context.close();
  check('pages publiques (connexion, mot de passe oublié) : aucune barre de navigation');
}

// 2. Routier : quatre onglets, ordre stable, onglet actif, liens profonds, « Plus », retour.
const routier = await session(ROUTIER, 390);
await bottomNav(routier).waitFor();
assert.deepEqual(await tabLabels(routier), ['Accueil', 'Cours', 'Défis', 'Parcours', 'Plus']);
assert.deepEqual(await activeTab(routier), ['Accueil']);
await shot(routier, '01-routier-accueil-390');
await bottomNav(routier).getByRole('link', { name: 'Cours', exact: true }).click();
await routier.waitForURL(/\/modules$/);
assert.deepEqual(await activeTab(routier), ['Cours']);
await bottomNav(routier).getByRole('link', { name: 'Parcours', exact: true }).click();
await routier.waitForURL(/\/progression$/);
assert.deepEqual(await activeTab(routier), ['Parcours']);
await routier.goBack();
await routier.waitForURL(/\/modules$/);
assert.deepEqual(await activeTab(routier), ['Cours']);
check('routier : Accueil · Cours · Parcours · Plus, onglet actif suivi, retour arrière');

await routier.goto(`${origin}/modules/recette-hors-ligne`);
await routier.getByRole('heading', { level: 1 }).waitFor();
assert.deepEqual(await activeTab(routier), ['Cours']);
check('lien profond vers un module : onglet Cours actif');

await bottomNav(routier).getByRole('button', { name: /Plus/ }).click();
const sheet = routier.getByRole('dialog', { name: 'Plus' });
await sheet.waitFor();
assert.ok(await sheet.getByRole('link', { name: 'Évaluations' }).isVisible());
assert.ok(await sheet.getByRole('link', { name: 'Mon profil' }).isVisible());
assert.ok(await sheet.getByRole('button', { name: 'Se déconnecter' }).isVisible());
assert.equal(
  await sheet.getByRole('link', { name: 'Bibliothèque' }).count(),
  0,
  'doublon d’onglet',
);
await shot(routier, '02-routier-plus-390');
await routier.keyboard.press('Escape');
await sheet.waitFor({ state: 'hidden' });
await bottomNav(routier).getByRole('button', { name: /Plus/ }).click();
// Page d'une rubrique sans onglet (D198 : les évaluations relèvent désormais de « Parcours »).
await sheet.getByRole('link', { name: 'Mon profil' }).click();
await routier.waitForURL(/\/compte$/);
await sheet.waitFor({ state: 'hidden' });
assert.deepEqual(await activeTab(routier), []);
assert.match(await bottomNav(routier).getByRole('button', { name: /Plus/ }).innerText(), /Plus/);
check(
  'menu « Plus » : rubriques secondaires, profil, déconnexion, Échap, fermeture à la navigation',
);

// Barre fixe, au-dessus du contenu, zones tactiles ≥ 48 px, aucun recouvrement du bas de page.
const box = await bottomNav(routier).boundingBox();
assert.ok(box && Math.abs(box.y + box.height - 844) <= 1, 'barre collée au bas de l’écran');
for (const link of await bottomNav(routier).locator('a, button').all()) {
  const target = await link.boundingBox();
  assert.ok(
    target.height >= 48 && target.width >= 48,
    `zone tactile ${target.width}×${target.height}`,
  );
}
await routier.goto(`${origin}/modules`);
await routier.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
const lastBottom = await routier.evaluate(() => {
  const main = document.getElementById('contenu');
  return main.getBoundingClientRect().bottom;
});
assert.ok(lastBottom <= box.y + 1, 'le contenu se termine au-dessus de la barre');
check('barre fixe en bas, zones tactiles ≥ 48 px, contenu jamais recouvert');

for (const width of [320, 360, 375, 390, 430, 768]) {
  await routier.setViewportSize({ width, height: 800 });
  for (const path of ['/accueil', '/modules', '/progression']) {
    await routier.goto(`${origin}${path}`);
    await bottomNav(routier).waitFor();
    await noHorizontalScroll(routier);
  }
}
await routier.setViewportSize({ width: 1280, height: 900 });
await routier.goto(`${origin}/accueil`);
await routier.getByRole('navigation', { name: 'Navigation principale' }).waitFor();
assert.ok(!(await bottomNav(routier).isVisible()), 'barre inférieure masquée sur ordinateur');
check('320 → 768 px sans défilement horizontal ; barre masquée à 1280 px');

// 3. Sidebar repliable, préférence conservée au rechargement.
const sidebarWidth = () =>
  routier.evaluate(() => document.querySelector('aside').getBoundingClientRect().width);
const wide = await sidebarWidth();
await routier.getByRole('button', { name: 'Replier le menu' }).click();
await routier.getByRole('button', { name: 'Déplier le menu' }).waitFor();
await routier
  .waitForFunction(
    () => document.querySelector('aside').getBoundingClientRect().width < 100,
    null,
    {
      timeout: 5_000,
    },
  )
  .catch(() => {});
const narrow = await sidebarWidth();
assert.ok(narrow < 100 && wide > 200, `sidebar ${wide} → ${narrow}`);
assert.ok(await routier.getByRole('link', { name: 'Cours', exact: true }).first().isVisible());
await shot(routier, '03-sidebar-repliee-1280');
await routier.reload();
await routier.getByRole('button', { name: 'Déplier le menu' }).waitFor();
await routier.getByRole('button', { name: 'Déplier le menu' }).click();
await routier.getByRole('button', { name: 'Replier le menu' }).waitFor();
check('sidebar : repli à côté du logo, icônes libellées, préférence conservée au rechargement');

// 4. Encadrement : Accueil · Routiers · Cours · Plus.
const chef = await session(CHEF, 375);
await bottomNav(chef).waitFor();
assert.deepEqual(await tabLabels(chef), ['Accueil', 'Routiers', 'Cours', 'Plus']);
await bottomNav(chef).getByRole('link', { name: 'Cours', exact: true }).click();
await chef.waitForURL(/\/encadrement\/modules$/);
assert.deepEqual(await activeTab(chef), ['Cours']);
await bottomNav(chef).getByRole('link', { name: 'Routiers', exact: true }).click();
await chef.waitForURL(/\/administration\/routiers$/);
assert.deepEqual(await activeTab(chef), ['Routiers']);
await noHorizontalScroll(chef);
await shot(chef, '04-chef-routiers-375');
check('encadrement : Accueil · Routiers · Cours · Plus, Cours = gestion pédagogique');

// Lot 5 : liste des routiers sur téléphone (filtres repliés, lignes tactiles), fiche compacte.
assert.ok(!(await chef.getByLabel('Équipe', { exact: true }).isVisible()), 'filtres repliés');
await chef.getByRole('button', { name: /^Filtres/ }).click();
await chef.getByLabel('Équipe', { exact: true }).waitFor();
await chef.getByLabel('Statut').selectOption('all');
await chef.getByRole('button', { name: 'Filtres (1)' }).waitFor();
const rows = chef.getByRole('list', { name: 'Liste des routiers' }).getByRole('link');
assert.ok((await rows.count()) >= 3, 'routiers listés en lignes');
const firstRow = await rows.first().boundingBox();
assert.ok(firstRow.height >= 56, `ligne tactile ${firstRow.height} px`);
assert.match(await rows.first().innerText(), /Noviciat/);
await rows.first().click();
await chef.waitForURL(/\/administration\/routiers\/[0-9a-f-]+$/);
await chef.getByText('Informations', { exact: true }).waitFor();
await noHorizontalScroll(chef);
assert.deepEqual(await activeTab(chef), ['Routiers']);
await chef.goBack();
await chef.waitForURL(/\/administration\/routiers$/);
await chef.setViewportSize({ width: 1280, height: 900 });
assert.ok(await chef.getByRole('table').isVisible(), 'tableau sur ordinateur');
await chef.setViewportSize({ width: 375, height: 812 });
check(
  'routiers (375 px) : filtres repliés avec compteur, lignes tactiles avec étape, fiche sans débordement',
);

// ---------------------------------------------------------------------------------------------
// 5. Module « Prières et textes de la Route » : trois leçons ajoutées depuis le téléphone.
const created = await json(chef, 'POST', '/editor/modules', {
  title: MODULE_TITLE,
  summary: 'Prières et textes fondamentaux de la Branche Route (fictif).',
});
const moduleId = created.id;
const editorUrl = `${origin}/encadrement/modules/${moduleId}/modifier`;
await chef.goto(`${editorUrl}?section=contenu`);
await chef.getByLabel('Nouvelle leçon').fill('Prière scoute');
await chef.getByRole('button', { name: 'Ajouter la leçon' }).click();
await chef.getByRole('button', { name: /Leçon 1 sur 1/ }).waitFor();
for (const [index, title] of [
  [2, 'Prière route'],
  [3, 'Charte des routiers'],
]) {
  // Bouton « Ajouter une leçon » visible sans ouvrir la liste des leçons.
  await chef.getByRole('button', { name: 'Ajouter une leçon' }).click();
  const input = chef.locator('input[data-new-lesson]:visible');
  await chef.waitForFunction(() => document.activeElement?.hasAttribute('data-new-lesson'), null, {
    timeout: 5_000,
  });
  await input.fill(title);
  await chef.getByRole('button', { name: 'Ajouter la leçon' }).first().click();
  await chef.getByRole('button', { name: new RegExp(`Leçon ${index} sur ${index}`) }).waitFor();
}
let detail = await json(chef, 'GET', `/editor/modules/${moduleId}`);
assert.deepEqual(
  detail.current.lessons.map((lesson) => lesson.title),
  ['Prière scoute', 'Prière route', 'Charte des routiers'],
);
check('trois leçons ajoutées au même module depuis 375 px, module parent jamais redemandé');

// 6. Rédaction au clavier : la barre inférieure libère la place, enregistrement confirmé.
const editorBox = chef.getByRole('textbox', { name: /Contenu de la leçon/ });
await editorBox.click();
await chef.keyboard.type('Seigneur, apprenez-nous à servir (texte fictif).');
assert.ok(!(await bottomNav(chef).isVisible()), 'barre masquée pendant la saisie');
await chef
  .getByRole('status')
  .filter({ hasText: /^Enregistré/ })
  .first()
  .waitFor({ timeout: 15_000 });
await shot(chef, '05-chef-redaction-375');
await chef.getByRole('button', { name: /Leçon 3 sur 3/ }).focus();
await bottomNav(chef).waitFor();
detail = await json(chef, 'GET', `/editor/modules/${moduleId}`);
const charte = detail.current.lessons[2];
assert.match(JSON.stringify(charte.content), /apprenez-nous/);
check('saisie : barre masquée pendant le clavier, « Enregistré » après confirmation serveur');

// Coupure réseau pendant la rédaction : rien n'est déclaré enregistré, reprise au retour.
await editorBox.click();
await chef.context().setOffline(true);
await chef.keyboard.type(' Hors ligne.');
await chef
  .getByRole('status')
  .filter({ hasText: /Hors connexion|Échec/ })
  .first()
  .waitFor({ timeout: 15_000 });
await chef.context().setOffline(false);
await chef
  .getByRole('status')
  .filter({ hasText: /^Enregistré/ })
  .first()
  .waitFor({ timeout: 20_000 });
detail = await json(chef, 'GET', `/editor/modules/${moduleId}`);
assert.match(JSON.stringify(detail.current.lessons[2].content), /Hors ligne/);
check('coupure réseau : « Hors connexion » puis enregistrement au retour du réseau');

// Contenu des deux autres leçons (API), puis réorganisation au bouton.
for (const lesson of detail.current.lessons.slice(0, 2)) {
  await json(chef, 'PATCH', `/editor/lessons/${lesson.id}`, {
    revision: lesson.revision,
    content: paragraph(`Texte fictif de « ${lesson.title} ».`),
  });
}
await chef.reload();
await chef.getByRole('button', { name: /Leçon \d sur 3/ }).click();
await chef.getByRole('button', { name: 'Monter la leçon 3' }).first().click();
await chef.waitForResponse((r) => r.url().includes('/lessons/reorder') && r.ok());
detail = await json(chef, 'GET', `/editor/modules/${moduleId}`);
assert.deepEqual(
  detail.current.lessons.map((lesson) => lesson.title),
  ['Prière scoute', 'Charte des routiers', 'Prière route'],
);
await chef.reload();
await chef.getByRole('button', { name: /Leçon \d sur 3/ }).waitFor();
check('réorganisation par boutons, ordre conservé après rechargement');

// Aperçu, puis contrôles d'accès : routier ni rédaction ni brouillon.
await chef.goto(`${origin}/encadrement/modules/${moduleId}/apercu`);
await chef.getByText('Charte des routiers').first().waitFor();
assert.equal(
  (
    await send(routier, 'POST', `/editor/modules/${moduleId}/lessons`, {
      versionId: detail.current.id,
      title: 'Intrusion',
    })
  ).status(),
  403,
);
const slug = detail.slug;
assert.equal((await send(routier, 'GET', `/modules/${slug}`)).status(), 404);
assert.equal(
  (await send(routier, 'GET', `/modules/${slug}/lessons/${detail.current.lessons[0].id}`)).status(),
  404,
);
// Le chef ne publie pas lui-même.
assert.equal(
  (
    await send(chef, 'POST', `/admin/modules/${moduleId}/publish`, {
      versionId: detail.current.id,
    })
  ).status(),
  403,
);
check(
  'aperçu ; routier : 403 en rédaction, brouillon introuvable par URL ; chef : publication refusée',
);

// 7. Soumission par le chef, approbation et publication par le responsable plein.
const responsable = await session(RESPONSABLE, 1280);
async function publish(versionId) {
  const fresh = await json(chef, 'GET', `/editor/modules/${moduleId}`);
  await json(chef, 'POST', `/editor/modules/${moduleId}/submit`, {
    versionId,
    revision: fresh.current.revision,
  });
  await json(responsable, 'POST', `/admin/modules/${moduleId}/approve`, { versionId });
  await json(responsable, 'POST', `/admin/modules/${moduleId}/publish`, { versionId });
}
await publish(detail.current.id);
check('publication selon le workflow : soumission (chef), approbation et publication (plein)');

// 8. Lecture côté routier : trois leçons, précédente / suivante.
await routier.setViewportSize({ width: 390, height: 844 });
await routier.goto(`${origin}/modules/${slug}`);
await routier.getByRole('heading', { name: MODULE_TITLE }).waitFor();
await routier.getByRole('link', { name: /^Commencer/ }).click();
await routier.getByRole('heading', { name: 'Prière scoute' }).waitFor();
await routier
  .getByRole('link', { name: /suivante/i })
  .first()
  .click();
await routier.getByRole('heading', { name: 'Charte des routiers' }).waitFor();
const oldCharteUrl = routier.url();
await routier
  .getByRole('link', { name: /suivante/i })
  .first()
  .click();
await routier.getByRole('heading', { name: 'Prière route' }).waitFor();
await routier
  .getByRole('link', { name: /précédente/i })
  .first()
  .click();
await routier.getByRole('heading', { name: 'Charte des routiers' }).waitFor();
await noHorizontalScroll(routier);
await shot(routier, '06-routier-lecon-390');
check('routier : trois leçons dans l’ordre, navigation précédente / suivante à 390 px');

// 9. Ajout d'une quatrième leçon au module en ligne, sans le recréer.
await chef.goto(`${editorUrl}?section=contenu`);
await chef.getByRole('button', { name: 'Ajouter une leçon' }).click();
const fourth = chef.locator('input[data-new-lesson]:visible');
await fourth.waitFor();
await chef.waitForFunction(() => document.activeElement?.hasAttribute('data-new-lesson'));
await fourth.fill('Prière du soir');
await chef.getByRole('button', { name: 'Ajouter la leçon' }).first().click();
await chef.getByRole('button', { name: /Leçon 4 sur 4/ }).waitFor();
detail = await json(chef, 'GET', `/editor/modules/${moduleId}`);
assert.equal(detail.id, moduleId);
assert.deepEqual(
  detail.current.lessons.map((lesson) => lesson.title),
  ['Prière scoute', 'Charte des routiers', 'Prière route', 'Prière du soir'],
);
assert.notEqual(detail.current.id, detail.publishedVersionId, 'nouvelle version de travail');
const draftLesson = detail.current.lessons[3];
await json(chef, 'PATCH', `/editor/lessons/${draftLesson.id}`, {
  revision: draftLesson.revision,
  content: paragraph('Texte fictif de la prière du soir.'),
});
await shot(chef, '07-chef-ajout-4e-lecon-375');
// Tant qu'elle n'est pas publiée, la 4e leçon reste invisible du routier.
let catalog = await json(routier, 'GET', `/modules/${slug}`);
assert.equal(catalog.lessons.length, 3);
assert.equal(
  (await send(routier, 'GET', `/modules/${slug}/lessons/${draftLesson.id}`)).status(),
  404,
);
check('module en ligne : « Ajouter une leçon » ouvre une version de travail ; brouillon invisible');

await publish(detail.current.id);
catalog = await json(routier, 'GET', `/modules/${slug}`);
assert.deepEqual(
  catalog.lessons.map((lesson) => lesson.title),
  ['Prière scoute', 'Charte des routiers', 'Prière route', 'Prière du soir'],
);
check('après publication : même module, quatre leçons, anciennes leçons conservées');

// 10. Ancien lien vers une leçon de la version remplacée (la reprise par titre, qui suppose un
// appareil préparé hors ligne, est couverte par `reading-position.test.ts`).
await routier.goto(oldCharteUrl);
await routier.getByText('Cette leçon n’est plus disponible').waitFor();
await routier.getByRole('link', { name: 'Ouvrir le module' }).click();
await routier.getByRole('heading', { name: MODULE_TITLE }).waitFor();
check('ancien lien de leçon après republication → message clair et retour au module');

// 11. Persistance en base après rechargement complet.
await chef.reload();
await chef.getByRole('button', { name: /Leçon \d sur 4/ }).waitFor();
check('rechargement : quatre leçons persistées');

assert.deepEqual(errors, [], `erreurs JavaScript : ${errors.join(' | ')}`);
console.log(`\nRecette refonte mobile : ${checks}/${checks} vérifications réussies.`);
await browser.close();

/**
 * Mesures de performance de laboratoire (D194–D200) : LCP, CLS, octets JavaScript transférés et
 * latence d'une interaction de jeu (Event Timing), sur build de production, Chromium, 390 px,
 * CPU ralenti ×4 et réseau « 4G lente » émulé (1,6 Mbit/s, 150 ms). Indicatif : une mesure locale
 * ne garantit pas le comportement sur tous les téléphones.
 * Fixture : `apps/api/test/immersive-browser-fixture.mts`.
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox'],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  locale: 'fr-FR',
});
const page = await context.newPage();
await page.goto(`${origin}/connexion`);
await page.getByLabel('Adresse e-mail').fill('routier-immersif@recette.test');
await page.getByLabel('Mot de passe', { exact: true }).fill('phrase-fictive-recette-immersive');
await page.getByRole('button', { name: /se connecter/i }).click();
await page.waitForURL(/\/accueil/);

const cdp = await context.newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await cdp.send('Network.emulateNetworkConditions', {
  offline: false,
  latency: 150,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
});
await page.addInitScript(() => {
  window.__perf = { lcp: 0, cls: 0, inp: 0 };
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) window.__perf.lcp = entry.startTime;
  }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries())
      if (!entry.hadRecentInput) window.__perf.cls += entry.value;
  }).observe({ type: 'layout-shift', buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries())
      window.__perf.inp = Math.max(window.__perf.inp, entry.duration);
  }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
});

const rows = [];
async function measure(label, path, interact) {
  let js = 0;
  const onResponse = async (response) => {
    if (response.request().resourceType() !== 'script') return;
    const length = Number((await response.headerValue('content-length').catch(() => null)) ?? 0);
    js += length || (await response.body().catch(() => Buffer.alloc(0))).length;
  };
  page.on('response', onResponse);
  await page.goto(`${origin}${path}`, { waitUntil: 'networkidle' });
  if (interact) await interact();
  await page.waitForTimeout(800);
  const perf = await page.evaluate(() => window.__perf);
  page.off('response', onResponse);
  rows.push({
    écran: label,
    'LCP (ms)': Math.round(perf.lcp),
    CLS: Number(perf.cls.toFixed(3)),
    'interaction (ms)': interact ? Math.round(perf.inp) : '—',
    'JS (ko)': Math.round(js / 1024),
  });
}

await measure('Accueil', '/accueil');
await measure('Module (carte illustrée)', '/modules/recette-entrainement');
await measure('Défis', '/defis');
await measure('Vrai ou faux (réponse)', '/defis/vrai-faux', async () => {
  await page.getByRole('button', { name: 'Vrai', exact: true }).click();
  await page.getByText(/Bien vu|Pas tout à fait/).waitFor();
});
await measure('Carnet', '/carnet');
// Chantier 3 (D206, D207) : expédition et enquête.
await measure('Expédition', '/modules/recette-entrainement/expedition');
await measure('Enquête (indice)', '/defis/enquetes', async () => {
  const rules = page.getByRole('button', { name: /c’est parti/i });
  if (await rules.isVisible().catch(() => false)) await rules.click();
  await page.getByRole('button', { name: /indice suivant/i }).click();
});
console.table(rows);
await browser.close();

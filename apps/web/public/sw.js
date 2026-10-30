// Service worker de Nikola Tesla Académie — offline-first global (voir docs/OFFLINE_FIRST.md, D114).
// Règles :
// - aucune réponse d'API n'est mise en cache ici (les données passent par le coffre chiffré) ;
// - les pages HTML et charges RSC mises en cache sont génériques : Next.js les rend sans cookie ni
//   donnée de compte ; tout contenu personnel est lu ensuite dans le coffre de l'utilisateur ;
// - une mise à jour ne touche jamais à IndexedDB (opérations locales conservées).
const VERSION = 'v4';
const SHELL_CACHE = `tesla-shell-${VERSION}`;
const PAGES_CACHE = 'tesla-pages';
const STATIC_CACHE = 'tesla-static';
const RSC_CACHE = 'tesla-rsc';
const KEPT_CACHES = [SHELL_CACHE, PAGES_CACHE, STATIC_CACHE, RSC_CACHE];
/** En-têtes qui déterminent une charge RSC (le paramètre `_rsc` n'en est qu'une empreinte). */
const RSC_HEADERS = [
  'rsc',
  'next-router-prefetch',
  'next-router-segment-prefetch',
  'next-router-state-tree',
  'next-url',
];
const FALLBACK_URL = '/hors-ligne';
const SHELL_URLS = [FALLBACK_URL, '/connexion'];
const PRECACHE_URLS = [
  ...SHELL_URLS,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/brand/logo-communaute.png',
];

/** Ressources versionnées référencées par une page (balises et charge RSC) ou une feuille de style. */
function referencedAssets(text) {
  const found = new Set();
  for (const match of text.matchAll(/(?:\/_next\/)?static\/(?:chunks|css|media)\/[\w\-./~%]+/g)) {
    const path = match[0].startsWith('/_next/') ? match[0] : `/_next/${match[0]}`;
    found.add(new URL(path.replace(/[.)]+$/, ''), self.location.origin).href);
  }
  for (const match of text.matchAll(/(?:src|href)=["']([^"']*\/_next\/image[^"']*)["']/g))
    found.add(new URL(match[1].replaceAll('&amp;', '&'), self.location.origin).href);
  return [...found];
}

async function cacheAssets(urls) {
  const cache = await caches.open(STATIC_CACHE);
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      if (await cache.match(url)) return;
      const response = await fetch(url);
      if (!response.ok) throw new Error(url);
      if (url.endsWith('.css')) await cacheAssets(referencedAssets(await response.clone().text()));
      await cache.put(url, response);
    }),
  );
  return results.filter((r) => r.status === 'rejected').length;
}

const pageKey = (url) => new URL(url.pathname, self.location.origin).href;

/** Page générique réellement servie pour ce chemin (pas une redirection vers la connexion). */
function isStorablePage(response, url) {
  return (
    response.ok &&
    !response.redirected &&
    new URL(response.url || url.href).pathname === url.pathname &&
    (response.headers.get('content-type') ?? '').includes('text/html')
  );
}

/**
 * Clé d'une charge RSC : chemin et en-têtes du routeur, indépendamment de l'algorithme de `_rsc`.
 * Sur une route dynamique, Next.js ne sert qu'une coquille HTML sans paramètres puis demande le
 * segment complet (`next-router-segment-prefetch: /_full`) : cette réponse doit être disponible
 * hors connexion.
 */
function rscKey(url, headers) {
  const signature = RSC_HEADERS.map((name) => `${name}=${headers.get(name) ?? ''}`).join('&');
  return `${self.location.origin}/__rsc__${url.pathname}?${new URLSearchParams({ signature })}`;
}

async function storeRsc(key, response) {
  if (!response.ok || !(response.headers.get('content-type') ?? '').includes('text/x-component'))
    return 1;
  const text = await response.clone().text();
  await (await caches.open(RSC_CACHE)).put(key, response);
  return cacheAssets(referencedAssets(text));
}

/** Segment complet d'une page, tel que demandé après le chargement de sa coquille HTML. */
const fullSegmentHeaders = () =>
  new Headers({ RSC: '1', 'Next-Router-Prefetch': '1', 'Next-Router-Segment-Prefetch': '/_full' });

async function prepareFullSegment(url) {
  const headers = fullSegmentHeaders();
  // Sans `_rsc`, le serveur redirige vers l'URL attendue par le navigateur (même en-têtes).
  const response = await fetch(url, { headers, credentials: 'include', cache: 'no-store' });
  return storeRsc(rscKey(url, headers), response);
}

async function rsc(event, url) {
  const key = rscKey(url, event.request.headers);
  try {
    const response = await fetch(event.request);
    if (response.ok) event.waitUntil(storeRsc(key, response.clone()));
    return response;
  } catch {
    // Charge inconnue (navigation client depuis un autre état) : l'erreur fait basculer Next.js
    // sur une navigation complète, servie depuis la page conservée.
    return (await caches.match(key, { cacheName: RSC_CACHE })) ?? Response.error();
  }
}

async function storePage(url, response) {
  const html = await response.clone().text();
  await (await caches.open(PAGES_CACHE)).put(pageKey(url), response);
  return cacheAssets(referencedAssets(html));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      await cache.addAll(PRECACHE_URLS);
      for (const url of SHELL_URLS) {
        const page = await cache.match(url);
        if (page) await cacheAssets(referencedAssets(await page.text()));
      }
    }),
  );
  // Pas d'activation forcée : l'application propose la mise à jour (message SKIP_WAITING).
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('tesla-') && !KEPT_CACHES.includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/image') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/brand/')
  );
}

async function navigate(event, url) {
  try {
    const response = await fetch(event.request);
    if (isStorablePage(response, url)) event.waitUntil(storePage(url, response.clone()));
    return response;
  } catch {
    // Accueil public : l'application installée s'ouvre sur la connexion, qui oriente vers le
    // tableau de bord (session ou identité locale déverrouillée).
    if (url.pathname === '/') return Response.redirect('/connexion', 302);
    const cached =
      (await caches.match(pageKey(url), { cacheName: PAGES_CACHE })) ??
      (await caches.match(pageKey(url), { cacheName: SHELL_CACHE }));
    return (
      cached ?? (await caches.match(FALLBACK_URL, { cacheName: SHELL_CACHE })) ?? Response.error()
    );
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // API et ressources externes : réseau direct
  if (url.pathname.startsWith('/api/')) return;
  if (request.headers.get('RSC') === '1' || url.searchParams.has('_rsc')) {
    event.respondWith(rsc(event, url));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(navigate(event, url));
    return;
  }
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy)));
            }
            return response;
          }),
      ),
    );
  }
});

/** Préparation des pages (voir `src/lib/offline/preparation.ts`), état, nettoyage, mise à jour. */
self.addEventListener('message', (event) => {
  const { data } = event;
  const port = event.ports[0];
  if (data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
    return;
  }
  if (data?.type === 'PREPARE_PAGES' && port) {
    event.waitUntil(
      (async () => {
        const failed = [];
        let done = 0;
        for (const path of data.paths) {
          const url = new URL(path, self.location.origin);
          try {
            const response = await fetch(url, { credentials: 'include', cache: 'no-store' });
            if (!isStorablePage(response, url)) throw new Error('page');
            if ((await storePage(url, response)) > 0) throw new Error('ressources');
            if ((await prepareFullSegment(url)) > 0) throw new Error('segment');
          } catch {
            failed.push(path);
          }
          port.postMessage({ type: 'progress', done: ++done, total: data.paths.length });
        }
        port.postMessage({ type: 'done', failed });
      })(),
    );
    return;
  }
  if (data?.type === 'PAGES_STATUS' && port) {
    event.waitUntil(
      (async () => {
        const missing = [];
        for (const path of data.paths) {
          const url = new URL(path, self.location.origin);
          const page = await caches.match(pageKey(url));
          const segment = await caches.match(rscKey(url, fullSegmentHeaders()));
          if (!page || !segment) missing.push(path);
        }
        port.postMessage({ type: 'status', missing, version: VERSION });
      })(),
    );
    return;
  }
  if (data?.type === 'PRUNE_STATIC') {
    // Supprime les ressources que plus aucune page conservée ne référence (anciennes versions).
    event.waitUntil(
      (async () => {
        const keep = new Set();
        for (const name of [SHELL_CACHE, PAGES_CACHE, RSC_CACHE]) {
          const cache = await caches.open(name);
          for (const request of await cache.keys()) {
            const page = await cache.match(request);
            if (page) for (const asset of referencedAssets(await page.text())) keep.add(asset);
          }
        }
        const statics = await caches.open(STATIC_CACHE);
        for (const request of await statics.keys()) {
          const path = new URL(request.url).pathname;
          if (path.startsWith('/_next/static/media/') || path.endsWith('.css')) continue;
          if (path.startsWith('/_next/static/') && !keep.has(request.url))
            await statics.delete(request);
        }
      })(),
    );
  }
});

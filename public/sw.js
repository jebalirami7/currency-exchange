/**
 * Keeps the app openable without a network.
 *
 * Nothing is precached by name: the build fingerprints its assets, so a list
 * written here would name last build's files. Everything is cached as it is
 * first fetched instead, which needs no coordination with the build at all.
 */
const CACHE = 'currency-exchange-v1';

/** Rates are not cached here — the app keeps its own last snapshot. */
const isRateRequest = (url) =>
  url.hostname.endsWith('er-api.com') || url.hostname.endsWith('frankfurter.app');

/** Everything the app is built from, wherever it is served from. */
const isAppAsset = (url) =>
  url.origin === self.location.origin ||
  url.hostname === 'fonts.googleapis.com' ||
  url.hostname === 'fonts.gstatic.com';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (isRateRequest(url)) return;

  // A page is fetched fresh when there is a network, so a deploy is picked up
  // on the next launch rather than whenever the cache happens to turn over.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isAppAsset(url)) {
    event.respondWith(cacheFirst(request));
  }
});

/**
 * The first visit loads the app before this worker is controlling anything,
 * so none of it passes through the handler above and none of it is cached —
 * the app would only survive going offline from the second visit onwards.
 * The page sends what it loaded once it is up, and it is fetched again here.
 */
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'warm') return;

  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const urls = event.data.urls.filter((url) => isAppAsset(new URL(url)));

      await Promise.all(
        urls.map(async (url) => {
          if (await cache.match(url)) return;
          try {
            const response = await fetch(url);
            if (response.ok) await cache.put(url, response);
          } catch {
            // Offline already, or the asset has gone; nothing to do.
          }
        }),
      );
    })(),
  );
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    void put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error('Offline and nothing cached for this page');
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  void put(request, response.clone());
  return response;
}

async function put(request, response) {
  // An error page or an opaque cross-origin reply is not worth keeping.
  if (!response.ok) return;

  const cache = await caches.open(CACHE);
  await cache.put(request, response);
}

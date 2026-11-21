/* global self, caches */
const CACHE_PREFIX = 'lajur-static-';
const CACHE_NAME = CACHE_PREFIX + '__LAJUR_CACHE_VERSION__';
const OFFLINE_URL = new URL('offline.html', self.registration.scope).href;
const MAX_ASSETS = 192;
const MAX_ASSET_BYTES = 2 * 1024 * 1024;
const IMMUTABLE_ASSET = /^\/assets\/[^/]+-[\w-]{8,}\.(?:js|css|woff2?|png|webp|svg|ico)$/i;
let maintenance = Promise.resolve();
let assetUrls;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: 'reload', credentials: 'omit' }))),
  );
});

// An initial visit already fetching its chunks keeps the HTTP path until its next navigation.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Let the browser request the next document while it wakes the worker.
      await self.registration.navigationPreload?.enable().catch(() => {});
      for (const name of await caches.keys()) {
        if (name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME) await caches.delete(name);
      }
    })(),
  );
});

const putAsset = async (cache, request, response) => {
  // Let Cache Storage stream writes in parallel. Only the shared eviction order
  // needs serialization, and the directory is read once per worker lifetime.
  await cache.put(request, response);
  maintenance = maintenance
    .catch(() => {})
    .then(async () => {
      assetUrls ??= new Set((await cache.keys()).map(({ url }) => url).filter((url) => url !== OFFLINE_URL));
      assetUrls.add(request.url);
      while (assetUrls.size > MAX_ASSETS) {
        const oldest = assetUrls.values().next().value;
        await cache.delete(oldest, { ignoreVary: true });
        assetUrls.delete(oldest);
      }
    });
  return maintenance;
};

const looksLikeAsset = (response) => {
  const type = response.headers.get('Content-Type') ?? '';
  const size = Number(response.headers.get('Content-Length'));
  return (
    response.ok &&
    !response.redirected &&
    !/\b(?:private|no-store)\b/i.test(response.headers.get('Cache-Control') ?? '') &&
    size <= MAX_ASSET_BYTES &&
    /^(?:text\/css|text\/javascript|application\/javascript|font\/|image\/)/i.test(type)
  );
};

const networkNavigation = async (event) => {
  let originResponse;
  try {
    const preloaded = await event.preloadResponse?.catch(() => undefined);
    originResponse = preloaded ?? (await fetch(event.request));
    if (originResponse.status < 500) return originResponse;
  } catch {
    // Navigations use the same offline page even when the server cannot answer.
  }
  const fallback = await caches.match(OFFLINE_URL, { cacheName: CACHE_NAME }).catch(() => undefined);
  if (!fallback) return originResponse ?? Response.error();
  if (!originResponse && self.navigator.onLine === false) return fallback;

  const html = (await fallback.text())
    .replaceAll('Tidak ada koneksi internet', 'Layanan Lajur. belum bisa dihubungi')
    .replace('Periksa koneksi internet, lalu coba lagi.', 'Coba lagi beberapa saat.');
  return new Response(html, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
};

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // Leave API, operator tools and authentication callbacks entirely on the network.
    if (/^\/(?:api|helper|oauth|\.well-known)(?:\/|$)/.test(url.pathname)) return;
    event.respondWith(networkNavigation(event));
    return;
  }

  if (!IMMUTABLE_ASSET.test(url.pathname) || url.search || request.headers.has('Range')) return;
  const cacheTask = caches.open(CACHE_NAME).catch(() => null);
  const result = cacheTask.then(async (cache) => {
    const cached = await cache?.match(request).catch(() => undefined);
    if (cached) return { response: cached };
    const response = await fetch(request);
    const write = cache && looksLikeAsset(response) ? putAsset(cache, request, response.clone()) : undefined;
    return { response, write };
  });
  event.respondWith(result.then(({ response }) => response));
  event.waitUntil(result.then(({ write }) => write).catch(() => {}));
});

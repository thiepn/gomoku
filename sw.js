const CACHE_NAME = 'gomoku-v12.5.0-p22-client-resilience-analysis-2.1.0-review-ux-2.1.0-learning-1.1.0-course-2.0.0-ai-2.0.0-gamefeel-2.0.0-postgame-2.0.0-competitive-2.0.0-online-2.0.0';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

const scopeURL = new URL('./', self.location.href);
const shellURL = new URL('index.html', scopeURL).href;
const shellPath = new URL(shellURL).pathname;
const assetPaths = new Set(APP_SHELL.map((path) => new URL(path, scopeURL).pathname));

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('gomoku-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== scopeURL.origin || !url.pathname.startsWith(scopeURL.pathname)) return;

  const isShell = url.pathname === scopeURL.pathname || url.pathname === shellPath;

  if (request.mode === 'navigate') {
    // Only the Gomoku shell may refresh the cached shell. Documentation or
    // sibling pages inside the service-worker scope must remain normal pages.
    if (!isShell) return;

    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME).catch(() => null);
      let response = null;
      try {
        response = await fetch(request);
      } catch {}

      if (response?.ok) {
        if (cache) await cache.put(shellURL, response.clone()).catch(() => {});
        return response;
      }

      const cached = cache ? await cache.match(shellURL).catch(() => null) : null;
      return cached || response || Response.error();
    })());
    return;
  }

  // The worker is deliberately not a generic same-origin HTTP cache. Room
  // APIs, Hub routes, generated reports and arbitrary files must bypass it.
  if (!assetPaths.has(url.pathname)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME).catch(() => null);
    const cached = cache
      ? await cache.match(request, { ignoreSearch: true }).catch(() => null)
      : null;
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response?.ok && cache) {
        const canonical = new URL(url.pathname, scopeURL.origin).href;
        await cache.put(canonical, response.clone()).catch(() => {});
      }
      return response;
    } catch {
      return Response.error();
    }
  })());
});

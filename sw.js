// FX Trade Tracker - Service Worker
const CACHE_NAME = 'fx-trader-v43';
const STATIC_ASSETS = [
  './index.html',
  './manifest.json',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: remove old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for static, network-first for CDN
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 非 GET（POST/PATCH/DELETE 等）は SW が触らずブラウザに任せる
  // （Cache API は GET しか保存できず、Supabase 同期の POST を壊すため）
  if (event.request.method !== 'GET') return;

  // Supabase API は絶対にキャッシュしない（常に最新を取得 = iPhone 同期遅延の防止）
  if (url.hostname.endsWith('.supabase.co')) {
    return; // SW を通さずブラウザの fetch にそのまま任せる
  }

  // Network-first for CDN resources (Charts.js, Tailwind)
  if (url.origin !== location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for local assets
  event.respondWith(
    caches.match(event.request).then(
      (cached) => cached || fetch(event.request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return res;
      })
    )
  );
});

// StastistikDompet — Service Worker
// Menaikkan CACHE_VERSION akan otomatis membersihkan cache lama saat update dirilis.
const CACHE_VERSION = 'sd-v1';
const STATIC_CACHE = `stastistikdompet-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `stastistikdompet-runtime-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './Sytle.css',
  './Scrip.js',
  './manifest.json',
  './icons/icon-72.png',
  './icons/icon-96.png',
  './icons/icon-128.png',
  './icons/icon-144.png',
  './icons/icon-152.png',
  './icons/icon-192.png',
  './icons/icon-256.png',
  './icons/icon-384.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png'
];

// Install: simpan app shell ke cache supaya aplikasi bisa dibuka offline
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activate: bersihkan cache versi lama
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - Navigasi (buka halaman) -> network dulu, jatuh ke cache index.html kalau offline
// - Aset app shell sendiri -> cache-first (cepat & hemat kuota)
// - Aset eksternal (CDN Chart.js, Google Fonts) -> cache-first dengan fallback network, disimpan di runtime cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Navigasi halaman (misal buka app dari homescreen)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Aset dari origin sendiri
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Aset eksternal (Chart.js CDN, Google Fonts)
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// Terima pesan dari halaman untuk langsung aktifkan versi baru (dipakai tombol "Update tersedia")
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

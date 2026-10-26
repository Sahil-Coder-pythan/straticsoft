const CACHE_NAME = 'stratic-market-shell-v3-local-photo';
const SHELL = ['/static/css/shop.css?v=20261026-local-photo', '/static/css/main.css', '/static/img/stratic-icon-192.svg', '/static/img/stratic-icon-512.svg', '/static/img/categories/womens-fashion.webp', '/static/img/categories/clothing.webp', '/static/img/categories/sneakers.webp', '/static/img/categories/beauty.webp', '/static/img/categories/home-living.webp', '/static/img/categories/jewellery.webp', '/static/img/categories/books.webp', '/static/img/categories/toys.webp', '/static/img/categories/headphones.webp'];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.destination === 'document') return; // Always fetch live shop/product/account data.
  event.respondWith(fetch(request).then((response) => {
    if (response.ok && (request.destination === 'style' || request.destination === 'script' || request.destination === 'image')) {
      const copy = response.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
    }
    return response;
  }).catch(() => caches.match(request)));
});

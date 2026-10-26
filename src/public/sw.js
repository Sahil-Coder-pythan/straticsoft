const CACHE_NAME = 'stratic-market-shell-v2-local-art';
const SHELL = ['/static/css/shop.css?v=20261026-local-art', '/static/css/main.css', '/static/img/stratic-icon-192.svg', '/static/img/stratic-icon-512.svg', '/static/img/categories/womens-fashion.svg', '/static/img/categories/clothing.svg', '/static/img/categories/sneakers.svg', '/static/img/categories/beauty.svg', '/static/img/categories/home-living.svg', '/static/img/categories/jewellery.svg', '/static/img/categories/books.svg', '/static/img/categories/toys.svg', '/static/img/categories/headphones.svg'];
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

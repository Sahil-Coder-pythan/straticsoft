const CACHE_NAME = 'stratic-market-shell-v4-hashed-assets';
const SHELL = ['/static/css/main.css', '/static/img/stratic-icon-192.svg', '/static/img/stratic-icon-512.svg', '/static/img/categories/womens-fashion.webp', '/static/img/categories/clothing.webp', '/static/img/categories/sneakers.webp', '/static/img/categories/beauty.webp', '/static/img/categories/home-living.webp', '/static/img/categories/jewellery.webp', '/static/img/categories/books.webp', '/static/img/categories/toys.webp', '/static/img/categories/headphones.webp'];
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
  // CSS/JS requested with a content hash (?v=<10 hex>, see services/assets.js) never change: serve from cache first.
  // A changed file has a different hash, so it is fetched once; older copies of the same file are removed.
  const reqUrl = new URL(request.url);
  if ((request.destination === 'style' || request.destination === 'script') && /^[0-9a-f]{10}$/.test(reqUrl.searchParams.get('v') || '')) {
    event.respondWith(caches.open(CACHE_NAME).then((cache) => cache.match(request).then((hit) => hit || fetch(request).then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
        cache.keys().then((keys) => keys.forEach((k) => { if (k.url !== request.url && new URL(k.url).pathname === reqUrl.pathname) cache.delete(k); }));
      }
      return response;
    }))));
    return;
  }
  event.respondWith(fetch(request).then((response) => {
    if (response.ok && (request.destination === 'style' || request.destination === 'script' || request.destination === 'image')) {
      const copy = response.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
    }
    return response;
  }).catch(() => caches.match(request)));
});

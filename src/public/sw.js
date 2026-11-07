const CACHE_NAME = 'stratic-market-shell-v12-push';
const SHELL = ['/static/css/shop.css?v=20261028-lux', '/static/css/main.css', '/static/img/stratic-icon-192.svg', '/static/img/stratic-icon-512.svg', '/static/img/categories/womens-fashion.webp', '/static/img/categories/clothing.webp', '/static/img/categories/sneakers.webp', '/static/img/categories/beauty.webp', '/static/img/categories/home-living.webp', '/static/img/categories/jewellery.webp', '/static/img/categories/books.webp', '/static/img/categories/toys.webp', '/static/img/categories/headphones.webp'];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (new URL(request.url).pathname.indexOf('/shop/api/') === 0) return; // never cache private API/QR responses
  if (request.destination === 'document') return; // Always fetch live shop/product/account data.
  event.respondWith(fetch(request).then((response) => {
    if (response.ok && (request.destination === 'style' || request.destination === 'script' || request.destination === 'image')) {
      const copy = response.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
    }
    return response;
  }).catch(() => caches.match(request)));
});

// ================= Chat notifications (Web Push) =================
const ICON = '/static/img/stratic-icon-192.png';
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { title: '✦ New message', body: event.data ? event.data.text() : '' }; }
  const opts = {
    body: (d.product ? d.product + '\n' : '') + (d.body || ''),
    icon: ICON, badge: ICON,
    tag: d.tag || 'chat', renotify: true,
    vibrate: [140, 70, 140], timestamp: Date.now(),
    data: { url: d.url || '/shop/', threadId: d.threadId || '', replyToken: d.replyToken || '', tag: d.tag || 'chat' },
    actions: d.replyToken ? [
      { action: 'reply', type: 'text', title: 'Reply', placeholder: 'Write a reply…' },
      { action: 'open', title: 'Open chat' },
    ] : [],
  };
  event.waitUntil(Promise.all([
    self.registration.showNotification(d.title || '✦ Stratic Market', opts),
    (self.navigator && self.navigator.setAppBadge && d.count) ? self.navigator.setAppBadge(d.count).catch(() => {}) : Promise.resolve(),
  ]));
});

self.addEventListener('notificationclick', (event) => {
  const n = event.notification, d = n.data || {};
  n.close();
  const typed = typeof event.reply === 'string' ? event.reply.trim() : '';
  if (event.action === 'reply' && typed && d.replyToken) {
    // Answer straight from the notification, without opening the app.
    event.waitUntil(
      fetch('/shop/api/push/reply', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-sgm': '1' }, body: JSON.stringify({ token: d.replyToken, text: typed }) })
        .then((r) => r.json().catch(() => ({})).then((j) => { if (!r.ok) throw new Error(j.error || 'failed'); }))
        .then(() => self.registration.showNotification('✦ Reply sent', { body: typed.slice(0, 120), icon: ICON, badge: ICON, tag: (d.tag || 'chat') + '-sent', silent: true, data: { url: d.url } }))
        .then(() => new Promise((res) => setTimeout(res, 2500)))
        .then(() => self.registration.getNotifications({ tag: (d.tag || 'chat') + '-sent' }).then((l) => l.forEach((x) => x.close())))
        .catch((err) => self.registration.showNotification('Reply not sent', { body: String((err && err.message) || 'Tap to open the chat and try again.'), icon: ICON, badge: ICON, tag: (d.tag || 'chat') + '-fail', data: { url: d.url, threadId: d.threadId } }))
    );
    return;
  }
  const url = d.url || '/shop/';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if (c.url.indexOf(self.location.origin + '/shop') === 0 && 'focus' in c) {
        c.postMessage({ type: 'open-chat', threadId: d.threadId });
        return c.focus();
      }
    }
    return self.clients.openWindow(url);
  }));
});

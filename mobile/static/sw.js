// Minimal service worker — exists only to satisfy the browser's PWA
// installability check (Chrome/Edge require a registered service worker
// with a fetch handler before showing the "Install app" affordance). It
// does not cache anything: this is an admin tool where stale data (points
// balances, review queues, receipt status) would be actively misleading, so
// every request always goes straight to the network, same as without a
// service worker at all.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

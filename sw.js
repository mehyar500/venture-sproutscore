/* SproutScore service worker — cache-first shell, network-first API and data. */
const CACHE = "sproutscore-v2";
const SHELL = [
  "/index.html", "/search.html", "/center.html", "/report.html",
  "/success.html", "/privacy.html", "/terms.html", "/unsubscribe.html",
  "/styles.css", "/app.js", "/manifest.json",
  "/assets/icon-192.png", "/assets/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      for (const url of SHELL) {
        try { await cache.add(url); } catch (err) { /* one bad asset never bricks install */ }
      }
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith("/api/")) return; // API always hits the network
  if (url.pathname.startsWith("/assets/data/")) {
    // Data bundles are network-first: a data swap must reach returning
    // visitors without waiting for a cache-busting deploy. Cache falls back offline.
    e.respondWith(
      fetch(e.request).then(
        (res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
          }
          return res;
        },
        () => caches.match(e.request)
      )
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request))
  );
});

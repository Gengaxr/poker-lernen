// Service Worker für „Poker lernen“. scripts/build-site.mjs setzt Version und Dateiliste ein (sw.js entsteht beim Bauen von site/).
// Strategie: zuerst das Netz (damit neue Versionen sofort ankommen), ohne Netz oder bei Fehler die Kopie aus dem Cache.
const VERSION = '6f35155cb182';
const FILES = ["./","index.html","manifest.webmanifest","icon-180.png","icon-192.png","icon-512.png"];
const CACHE = 'poker-' + VERSION;
const NETWORK_LIMIT_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      // nur eigene, ältere Caches löschen: auf github.io teilen sich alle Projekte eines Kontos dieselbe Herkunft
      .then((names) => Promise.all(names.filter((name) => name.startsWith('poker-') && name !== CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  // Bei einer Navigation auf eine unbekannte Adresse (z. B. mit Suchteil) die Startseite zeigen.
  const cached = (await cache.match(request)) || (request.mode === 'navigate' ? await cache.match('./') : undefined);
  const network = fetch(request, { cache: 'no-cache' }).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
      return response;
    }
    return cached || response; // eine Fehlerantwort des Servers ersetzt keine gute Kopie
  }, (error) => {
    if (cached) return cached;
    throw error;
  });
  if (!cached) return network;
  // Ist das Netz zu langsam, gewinnt die Kopie; die Antwort aktualisiert den Cache trotzdem noch.
  return Promise.race([network, new Promise((resolve) => setTimeout(() => resolve(cached), NETWORK_LIMIT_MS))]);
}

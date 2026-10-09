// Service worker: păstrează fișierele aplicației pentru pornire fără rețea.
// Mereu încearcă întâi rețeaua (ca să primești ultima versiune); copia locală e doar rezervă.
// Cererile către Supabase (alt domeniu) nu trec pe aici, deci datele nu se salvează niciodată în cache.
const CACHE = "moneyapp-v1";
const FISIERE = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/app.css",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
  "js/vendor/supabase.js",
  "js/app.js",
  "js/calc.js",
  "js/categorii.js",
  "js/comun.js",
  "js/config.js",
  "js/csv.js",
  "js/db.js",
  "js/export.js",
  "js/format.js",
  "js/grafice.js",
  "js/imprumuturi.js",
  "js/nav.js",
  "js/tranzactii.js",
  "js/ui.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FISIERE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((nume) => Promise.all(nume.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((r) => {
        if (r.ok) {
          const copie = r.clone();
          caches.open(CACHE).then((c) => c.put(req, copie));
        }
        return r;
      })
      .catch(async () => (await caches.match(req, { ignoreSearch: true })) ??
        (req.mode === "navigate" ? caches.match("index.html") : Response.error()))
  );
});

// 404 Studio mobile PWA: cached static assets are served instantly while revalidated.
const CACHE = "404-studio-v15";
const CORE = [
  "./","./index.html","./app.css","./app.js","./icon.svg",
  "./manifest.webmanifest","./data/scene.json","./data/characters.json",
  "./data/dialogue.json","./quick-preview.html","./quick-preview.js","./free-gpu.html","./free-gpu.js","./voice-studio.html","./voice-studio.js",
  "./library.html","./library.js","./media-vault.js","./character-bank.js","./voice-audio-vault.js"
];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE)
    .then(cache => cache.addAll(CORE))
    .then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  // Never cache cross-origin traffic or authenticated API responses.
  if (event.request.method !== "GET" ||
      url.origin !== self.location.origin ||
      url.pathname.includes("/api/")) return;

  event.respondWith(caches.match(event.request).then(cached => {
    const update = fetch(event.request).then(async response => {
      if (response.ok) {
        const store = await caches.open(CACHE);
        await store.put(event.request, response.clone());
      }
      return response;
    });
    // Keep refresh alive when returning cached assets immediately.
    if (cached) {
      event.waitUntil(update.catch(() => {}));
      return cached;
    }
    return update.catch(() => caches.match(event.request));
  }));
});

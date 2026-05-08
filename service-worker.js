// Service Worker — Siddur Zéjer Dov
// Cachea el siddur completo y las fuentes para uso offline

const CACHE_NAME = ‘siddur-zejer-dov-v1’;
const ESSENTIAL_FILES = [
‘./’,
‘./index.html’,
‘./manifest.json’
];

// Patrones de URLs externos que también cacheamos (Google Fonts)
const CACHEABLE_HOSTS = [
‘fonts.googleapis.com’,
‘fonts.gstatic.com’
];

// INSTALL — pre-cache de archivos esenciales
self.addEventListener(‘install’, (event) => {
event.waitUntil(
caches.open(CACHE_NAME).then((cache) => {
return cache.addAll(ESSENTIAL_FILES);
}).then(() => self.skipWaiting())
);
});

// ACTIVATE — limpiar cachés viejos
self.addEventListener(‘activate’, (event) => {
event.waitUntil(
caches.keys().then((keys) => {
return Promise.all(
keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
);
}).then(() => self.clients.claim())
);
});

// FETCH — strategy: cache-first, fallback a red
// Si la red trae algo nuevo, lo guarda para la próxima
self.addEventListener(‘fetch’, (event) => {
const url = new URL(event.request.url);

// Solo cacheamos GET
if (event.request.method !== ‘GET’) return;

// Decide si vale la pena cachear este request
const isEssential = ESSENTIAL_FILES.some(f =>
event.request.url.endsWith(f.replace(’./’, ‘/’)) ||
event.request.url.endsWith(f.replace(’./’, ‘’))
);
const isCacheableExternal = CACHEABLE_HOSTS.includes(url.host);
const sameOrigin = url.origin === self.location.origin;

if (!sameOrigin && !isCacheableExternal) {
return; // dejar pasar normalmente
}

event.respondWith(
caches.match(event.request).then((cached) => {
if (cached) {
// Tenemos versión en caché — la devolvemos inmediatamente
// y en paralelo refrescamos en segundo plano (stale-while-revalidate)
const fetchAndUpdate = fetch(event.request).then((response) => {
if (response && response.status === 200) {
const clone = response.clone();
caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
}
return response;
}).catch(() => null);
return cached;
}
// No está en caché — pedir a la red y guardar
return fetch(event.request).then((response) => {
if (!response || response.status !== 200) return response;
const clone = response.clone();
caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
return response;
}).catch(() => {
// Si falla la red y no hay caché, al menos devolver el siddur
if (event.request.mode === ‘navigate’) {
return caches.match(’./index.html’);
}
});
})
);
});

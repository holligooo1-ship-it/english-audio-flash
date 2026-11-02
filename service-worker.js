const CACHE_NAME = 'audio-flash-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './data/decks.json',
  './data/frases.json',
  './data/palabras.json',
  'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js',
  'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;600;700;800&display=swap'
];

// 1. Instalar y guardar en caché los archivos principales
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 2. Activar y limpiar cachés viejos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Interceptar peticiones (Estrategia: Red primero, si falla, usa el caché)
self.addEventListener('fetch', event => {
  // Ignorar peticiones que no sean GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Si la red responde, guardamos una copia nueva en caché
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Si falla la red (no hay internet), buscamos en el caché
        return caches.match(event.request);
      })
  );
});

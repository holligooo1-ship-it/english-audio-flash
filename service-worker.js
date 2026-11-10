// 👇 SUBIMOS A v4 PARA FORZAR LA ACTUALIZACIÓN
const CACHE_NAME = 'audio-flash-v4'; 
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

// 1. Instalar
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 2. Activar y limpiar versiones viejas
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

// 3. Interceptar peticiones
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // 👇 TRATO ESPECIAL PARA LOS AUDIOS MP3 👇
  if (url.includes('/audios/') && url.endsWith('.mp3')) {
    event.respondWith(
      caches.match(url).then(cachedResponse => {
        // Si ya está en caché, lo devolvemos
        if (cachedResponse) {
          return cachedResponse;
        }
        // Si no, lo descargamos completo (sin rangos) para poder guardarlo
        return fetch(url).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(url, clone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // 👇 TRATO NORMAL PARA EL RESTO DE LA APP (HTML, CSS, JS, JSON) 👇
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Si no hay internet, usa el caché
        return caches.match(event.request);
      })
  );
});

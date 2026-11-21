// Service Worker Offline-First para o GPS Náutico Independente
// Funciona 100% no telemóvel mesmo com o computador desligado e sem internet no mar.

const CACHE_NAME = 'gps-nautico-offline-v10';
const TILE_CACHE_NAME = 'gps-nautico-tiles-v1';

const RECURSOS_ESSENCIAIS = [
  './',
  './index.html',
  './manifest.json',
  './static/gps.css',
  './static/gps.js',
  './static/aorus.js',
  './static/pasta_eventos.js',
  './static/avatar.jpg',
  './static/vendor/leaflet.css',
  './static/vendor/leaflet.js',
  './static/vendor/MarkerCluster.css',
  './static/vendor/MarkerCluster.Default.css',
  './static/vendor/leaflet.markercluster.js',
  './static/vendor/togeojson.umd.js',
  './static/curvas_submarinas_5m.geojson',
  './static/pesqueiros/lista.json',
  './static/pesqueiros/54_Bolinhas_completo_Esferas.gpx',
  './static/pesqueiros/viegas%20novogps.gpx',
  './static/pesqueiros/54_Bolinhas_Completo.gpx',
  './static/pesqueiros/caladas.gpx'
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Normalizar URLs em relação ao scope da aplicação
      const urlsParaGuardar = RECURSOS_ESSENCIAIS.map(caminho => new URL(caminho, self.registration.scope).href);
      return cache.addAll(urlsParaGuardar).catch((err) => {
        console.warn('Pré-carregamento parcial de recursos:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((chaves) => {
      return Promise.all(
        chaves.map((chave) => {
          if (chave !== CACHE_NAME && chave !== TILE_CACHE_NAME) {
            return caches.delete(chave);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (evento) => {
  const url = new URL(evento.request.url);

  // 1. Intercetar azulejos de mapas online (OSM, OpenSeaMap, Satélite Esri, CartoDB) e guardar para offline no mar
  if (url.hostname.includes('tile.openstreetmap.org') || 
      url.hostname.includes('openseamap.org') || 
      url.hostname.includes('arcgisonline.com') ||
      url.hostname.includes('cartocdn.com')) {
    evento.respondWith(
      caches.open(TILE_CACHE_NAME).then((tileCache) => {
        return tileCache.match(evento.request).then((emCache) => {
          if (emCache) return emCache;
          return fetch(evento.request).then((respRede) => {
            if (respRede && respRede.status === 200) {
              tileCache.put(evento.request, respRede.clone());
            }
            return respRede;
          }).catch(() => {
            return new Response('', { status: 408, headers: { 'Content-Type': 'image/png' } });
          });
        });
      })
    );
    return;
  }

  // 2. Navegação Principal (Network-First quando há rede, Cache-First offline no mar)
  if (evento.request.mode === 'navigate') {
    evento.respondWith(
      fetch(evento.request)
        .then((respRede) => {
          if (respRede && respRede.status === 200) {
            const clone = respRede.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(new URL('./', self.registration.scope).href, clone.clone());
              cache.put(new URL('./index.html', self.registration.scope).href, clone);
            });
          }
          return respRede;
        })
        .catch(() => {
          return caches.match(new URL('./', self.registration.scope).href)
            .then((cached) => cached || caches.match(new URL('./index.html', self.registration.scope).href));
        })
    );
    return;
  }

  // 3. Recursos Locais (Network-First para código da app; Cache-First offline no mar)
  const ehCodigoApp = url.origin === self.location.origin && (
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('/gps.js') ||
    url.pathname.endsWith('/pasta_eventos.js') ||
    url.pathname.endsWith('/aorus.js') ||
    url.pathname.endsWith('/manifest.json')
  );

  if (ehCodigoApp) {
    evento.respondWith(
      fetch(evento.request)
        .then((respostaRede) => {
          if (respostaRede && respostaRede.status === 200 && evento.request.method === 'GET') {
            const clone = respostaRede.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(evento.request, clone));
          }
          return respostaRede;
        })
        .catch(() => caches.match(evento.request))
    );
    return;
  }

  evento.respondWith(
    caches.match(evento.request).then((respostaCache) => {
      if (respostaCache) {
        return respostaCache;
      }
      return fetch(evento.request).then((respostaRede) => {
        if (respostaRede && respostaRede.status === 200 && evento.request.method === 'GET') {
          const clone = respostaRede.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(evento.request, clone));
        }
        return respostaRede;
      }).catch((err) => {
        if (evento.request.headers.get('accept')?.includes('text/html')) {
          return caches.match(new URL('./', self.registration.scope).href);
        }
      });
    })
  );
});

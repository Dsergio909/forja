/* ==========================================================================
   FORJA - Service Worker (sw.js)
   Versión de caché: forja-v3
   Garantiza funcionamiento 100% offline y actualizaciones sin fricción.
   Estrategia:
   - RED PRIMERO con respaldo en caché para: index.html, js/*.js, styles.css, fonts/* y data/*.json.
   - CACHÉ PRIMERO para: multimedia (media/) y librerías/modelos externos (CDN).
   ========================================================================== */

const CACHE_NAME = 'forja-20261107-1807';

// Lista completa de archivos de la app para precaché
const ARCHIVOS_APP = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './icon.svg',
  './fonts/fuentes.css',
  './fonts/BricolageGrotesque-normal-latin-ext.woff2',
  './fonts/BricolageGrotesque-normal-latin.woff2',
  './fonts/InstrumentSerif-italic-latin-ext.woff2',
  './fonts/InstrumentSerif-italic-latin.woff2',
  './fonts/InstrumentSerif-normal-latin-ext.woff2',
  './fonts/InstrumentSerif-normal-latin.woff2',
  './js/iconos.js',
  './js/config.js',
  './js/db.js',
  './js/ui.js',
  './js/app.js',
  './js/datos.js',
  './js/hoy.js',
  './js/registro.js',
  './js/parser.js',
  './js/progreso.js',
  './js/cuerpo.js',
  './js/camara.js',
  './js/comida.js',
  './js/guia.js',
  './js/coach.js',
  './js/ajustes.js',
  './js/calculos.js',
  './js/graficas.js',
  './js/qr.js',
  './js/markdown.js',
  './js/mapa_musculos.js',
  './data/ejercicios.json',
  './data/alimentos.json',
  './data/rutina.json',
  './data/guia/indice.json',
  './data/guia/01_hipertrofia.md',
  './data/guia/02_fuerza.md',
  './data/guia/03_definicion_recomposicion.md',
  './data/guia/04_pecho.md',
  './data/guia/05_espalda.md',
  './data/guia/06_hombros.md',
  './data/guia/07_brazos_antebrazos.md',
  './data/guia/08_pierna_gluteo.md',
  './data/guia/09_core_cuello.md',
  './data/guia/10_movilidad_estiramiento.md',
  './data/guia/11_columna_postura_altura.md',
  './data/guia/12_recuperacion_suplementos_lesiones.md',
  './data/guia/13_nutricion_colombia.md',
  './data/guia/14_camara_medicion_tecnica.md',
  './data/guia/15_ia_local_celular.md',
  './data/guia/16_imagenes_videos_ejercicios.md'
];

// Dominios CDN externos permitidos (MediaPipe, WebLLM, etc.)
const CDNS_PERMITIDOS = [
  'cdn.jsdelivr.net',
  'esm.run',
  'storage.googleapis.com'
];

// --- Instalación: precachear archivos locales de la PWA ---
self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      const peticiones = ARCHIVOS_APP.map(async (url) => {
        try {
          const respuesta = await fetch(url, { cache: 'no-cache' });
          if (respuesta.ok) {
            await cache.put(url, respuesta);
          }
        } catch (error) {
          console.warn(`[SW] Precache ignorado o no encontrado: ${url}`);
        }
      });
      await Promise.allSettled(peticiones);
      return self.skipWaiting();
    })
  );
});

// --- Activación: limpiar versiones anteriores de caché (ej. forja-v1, forja-v2) ---
self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((claves) => {
      return Promise.all(
        claves.map((clave) => {
          if (clave.startsWith('forja-') && clave !== CACHE_NAME) {
            console.log(`[SW] Eliminando caché antiguo: ${clave}`);
            return caches.delete(clave);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// --- Intercepción de peticiones (Fetch) ---
self.addEventListener('fetch', (evento) => {
  const request = evento.request;

  // Solo peticiones GET
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // 1. CACHÉ PRIMERO para multimedia (media/) y librerías/modelos de CDNs
  const esCDN = CDNS_PERMITIDOS.some((host) => url.hostname.includes(host));
  const esMedia = url.pathname.includes('/media/');

  if (esCDN || esMedia) {
    evento.respondWith(manejarCachePrimero(request));
    return;
  }

  // 2. RED PRIMERO para todo lo demás: index.html, js/*.js, styles.css, fonts/*, data/*.json,
  // manifest, iconos y artículos de la guía (con respaldo de caché si no hay internet)
  evento.respondWith(manejarRedPrimero(request));
});

/**
 * Estrategia: Caché Primero con guardado en primer uso.
 * Entrega inmediatamente desde la caché si existe; si no, descarga de la red y lo cachea.
 */
async function manejarCachePrimero(request) {
  const cache = await caches.open(CACHE_NAME);
  const cacheHit = await cache.match(request);
  if (cacheHit) {
    return cacheHit;
  }

  try {
    const respuestaRed = await fetch(request);
    if (respuestaRed && (respuestaRed.status === 200 || respuestaRed.type === 'opaque')) {
      cache.put(request, respuestaRed.clone());
    }
    return respuestaRed;
  } catch (error) {
    return new Response('Recurso no disponible sin conexión', { status: 503 });
  }
}

/**
 * Estrategia: Red Primero con respaldo en Caché.
 * Prioriza la red para obtener de inmediato las últimas actualizaciones de código y datos.
 * Si no hay conexión o la red falla, entrega la copia almacenada en caché.
 */
async function manejarRedPrimero(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const respuestaRed = await fetch(request);
    if (respuestaRed && respuestaRed.status === 200) {
      cache.put(request, respuestaRed.clone());
    }
    return respuestaRed;
  } catch (error) {
    // Si la red falló, buscar en caché
    const respuestaCache = await cache.match(request);
    if (respuestaCache) {
      return respuestaCache;
    }

    // Fallback de navegación si está offline y no hubo coincidencia exacta
    if (request.mode === 'navigate') {
      const indexFallback = await cache.match('./index.html') || await cache.match('index.html');
      if (indexFallback) {
        return indexFallback;
      }
    }

    // Respuesta JSON de contingencia para datos si no hay caché ni red
    const esJson = request.url.endsWith('.json') || request.headers.get('accept')?.includes('application/json');
    if (esJson) {
      return new Response(JSON.stringify({ error: 'Sin conexión y recurso no en caché' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Recurso no disponible sin conexión', { status: 503 });
  }
}

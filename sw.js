/* ==========================================================================
   FORJA - Service Worker (sw.js)
   Versión de caché: forja-20261107-v5
   Garantiza funcionamiento 100% offline y actualizaciones sin fricción.
   Estrategia:
   - EXCLUIR (dejar pasar sin interceptar ni clonar): modelos de WebLLM/HuggingFace/GitHub
     y cualquier dominio que no sea de la app ni del CDN de librerías (SW-01).
   - RED PRIMERO (con tiempo límite de 3 s y respaldo en caché) para: index.html, js/*.js,
     styles.css, fonts/* y data/*.json (SW-02).
   - CACHÉ PRIMERO para: multimedia local (media/) y librerías del CDN permitido.
   - NOTIFICACIONES: maneja notificationclick para enfocar la app y navegar a #registrar (C2-02).
   ========================================================================== */

const CACHE_NAME = 'forja-20261107-2210';
const TIEMPO_LIMITE_RED_MS = 3000;

// Lista completa de archivos de la app para precaché
const ARCHIVOS_APP = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
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

// Dominios CDN externos de librerías permitidos (MediaPipe, paquete JS de WebLLM)
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

// --- Activación: limpiar versiones anteriores de caché (ej. forja-v1...v4) ---
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

  let url;
  try {
    url = new URL(request.url);
  } catch (_) {
    return;
  }

  const host = url.hostname;
  const esMismoOrigen = url.origin === self.location.origin;
  const esCDN = CDNS_PERMITIDOS.some((cdn) => host === cdn || host.endsWith('.' + cdn));

  // 0. SW-01: Dejar pasar SIN tocar ni clonar todos los archivos de modelos de WebLLM/HuggingFace/GitHub
  // y cualquier petición que no sea de la app ni del CDN de librerías.
  if (
    host.includes('huggingface.co') ||
    host.includes('hf.co') ||
    host.includes('githubusercontent.com') ||
    url.pathname.endsWith('.bin') ||
    (!esMismoOrigen && !esCDN)
  ) {
    return;
  }

  // 1. CACHÉ PRIMERO para multimedia local (media/) y librerías del CDN permitido
  const esMedia = esMismoOrigen && url.pathname.includes('/media/');
  if (esCDN || esMedia) {
    evento.respondWith(manejarCachePrimero(request));
    return;
  }

  // 2. RED PRIMERO (con tope de 3 s) para archivos de la app: index.html, js/*.js,
  // styles.css, fonts/*, data/*.json, manifest, iconos y artículos de la guía
  evento.respondWith(manejarRedPrimero(request));
});

// --- Notificación interactiva en Android (C2-02 pantallas_flujo) ---
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientes) => {
      for (const cliente of clientes) {
        if ('focus' in cliente) {
          cliente.focus();
          if ('navigate' in cliente) {
            cliente.navigate('./#registrar');
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('./#registrar');
      }
    })
  );
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
 * Estrategia: Red Primero con tiempo límite de 3 s (SW-02) y respaldo en Caché.
 * Prioriza la red para obtener actualizaciones de código y datos sin bloquearse en conexiones lentas.
 * Si la red tarda más de 3 s o no hay conexión, entrega inmediatamente la copia en caché.
 */
async function manejarRedPrimero(request) {
  const cache = await caches.open(CACHE_NAME);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIEMPO_LIMITE_RED_MS);

  try {
    const respuestaRed = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    if (respuestaRed && respuestaRed.status === 200) {
      cache.put(request, respuestaRed.clone());
    }
    return respuestaRed;
  } catch (error) {
    clearTimeout(timer);

    // Si la red falló o superó los 3 s, buscar en caché
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

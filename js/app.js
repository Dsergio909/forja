/* ==========================================================================
   FORJA - Router y Controlador Principal (js/app.js)
   Firmas y comportamiento exactos según CONTRATOS.md y DIRECCION_FORJA_v2.md
   Router por hash con import() dinámico resiliente, barra flotante persistente
   y CERO emojis en todo el núcleo (iconografía vectorial SVG uniforme).
   ========================================================================== */

import * as db from './db.js';
import * as ui from './ui.js';
import { icono } from './iconos.js';

// Mapa de rutas de la aplicación Forja
const RUTAS = {
  hoy: { archivo: 'hoy.js', titulo: 'Hoy', nav: 'hoy' },
  registrar: { archivo: 'registro.js', titulo: 'Registrar', nav: 'registrar' },
  progreso: { archivo: 'progreso.js', titulo: 'Progreso', nav: 'progreso' },
  cuerpo: { archivo: 'cuerpo.js', titulo: 'Cuerpo', nav: 'cuerpo' },
  camara: { archivo: 'camara.js', titulo: 'Cámara', nav: null, anchoExtendido: true, oscuro: true },
  comida: { archivo: 'comida.js', titulo: 'Comida', nav: null },
  guia: { archivo: 'guia.js', titulo: 'Guía', nav: 'guia' },
  coach: { archivo: 'coach.js', titulo: 'Coach', nav: null },
  ajustes: { archivo: 'ajustes.js', titulo: 'Ajustes', nav: null }
};

let moduloActual = null;
let contadorNavegacion = 0;

/**
 * Sanitiza un segmento de ruta proveniente de window.location.hash
 * para prevenir ataques de XSS reflejado (Hallazgo Seguridad 1) en las pantallas
 * que interpolan parámetros de URL en plantillas HTML.
 * @param {string} segmento
 * @returns {string}
 */
function sanitizarParametroRuta(segmento) {
  let texto = String(segmento || '');
  try {
    texto = decodeURIComponent(texto);
  } catch (_) {
    // Conservar cadena original si contiene secuencias % malformadas
  }
  return texto
    .replace(/[<>"'`]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

/**
 * Navega a una ruta mediante su hash.
 * @param {string} hash Hash destino (ej. '#hoy', '#progreso/press_banca', '#camara')
 */
export function ir(hash) {
  if (!hash.startsWith('#')) {
    hash = '#' + hash;
  }
  window.location.hash = hash;
}

/**
 * Inicializa y puebla los iconos vectoriales SVG en la cabecera y barra de navegación.
 * Cero emojis en toda la interfaz estructural.
 */
function inicializarIconosUI() {
  // 1. Cabecera limpia: Coach y Ajustes
  const btnCoach = document.getElementById('btn-coach');
  if (btnCoach && !btnCoach.hasChildNodes()) {
    btnCoach.appendChild(icono('coach', 22));
  }

  const btnAjustes = document.getElementById('btn-ajustes');
  if (btnAjustes && !btnAjustes.hasChildNodes()) {
    btnAjustes.appendChild(icono('ajustes', 22));
  }

  // 2. Barra flotante inferior: Hoy, Registrar, Progreso, Cuerpo, Guía
  const itemsBarra = document.querySelectorAll('#barra-abajo [data-icono-nav]');
  itemsBarra.forEach((span) => {
    const nombreIcono = span.getAttribute('data-icono-nav');
    if (nombreIcono && !span.hasChildNodes()) {
      span.appendChild(icono(nombreIcono, 20));
    }
  });
}

/**
 * Procesa el hash actual de la URL, carga dinámicamente el módulo correspondiente
 * y lo monta en el contenedor principal sin romper la barra inferior ni la cabecera.
 */
async function cargarRuta() {
  const renderId = ++contadorNavegacion;

  const hashCompleto = window.location.hash || '#hoy';
  const limpio = hashCompleto.replace(/^#\/?/, '');
  const partes = limpio.split('/').map(sanitizarParametroRuta).filter(Boolean);
  const nombreRuta = partes[0] || 'hoy';
  const params = partes.slice(1);

  const rutaConfig = RUTAS[nombreRuta] || RUTAS.hoy;

  // Desmontar inmediatamente la pantalla previa ANTES de montar la nueva
  if (moduloActual && typeof moduloActual.desmontar === 'function') {
    try {
      moduloActual.desmontar();
    } catch (errDesmontar) {
      console.warn('[Router] Error al desmontar pantalla previa:', errDesmontar);
    }
  }
  moduloActual = null;

  // Configurar modos especiales en el contenedor principal (ancho extendido o modo oscuro en cámara)
  const appContenedor = document.getElementById('app');
  if (appContenedor) {
    if (rutaConfig.anchoExtendido) {
      appContenedor.classList.add('ancho-extendido');
    } else {
      appContenedor.classList.remove('ancho-extendido');
    }

    if (rutaConfig.oscuro) {
      appContenedor.classList.add('oscuro');
    } else {
      appContenedor.classList.remove('oscuro');
    }
  }

  // Actualizar título en cabecera
  const tituloEl = document.getElementById('titulo-pantalla');
  if (tituloEl) {
    tituloEl.textContent = rutaConfig.titulo;
  }

  // Actualizar estado activo en la barra flotante
  const navItems = document.querySelectorAll('#barra-abajo .nav-item');
  navItems.forEach((item) => {
    if (item.dataset.hash === rutaConfig.nav) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  const vista = document.getElementById('vista');
  if (!vista) return;

  // Limpiar y mostrar indicador de carga editorial con SVG
  vista.innerHTML = '';
  const cargando = ui.h('div', { class: 'vacio' },
    ui.h('div', { class: 'cargando-icono' }, icono('chispa', 28)),
    ui.h('p', { class: 'sutil' }, `Cargando ${rutaConfig.titulo}...`)
  );
  vista.appendChild(cargando);

  // Crear un contenedor independiente para montar la nueva pantalla
  const contenedorNuevo = ui.h('div', {
    class: 'contenedor-pantalla-activa',
    style: 'width: 100%; min-height: 100%;'
  });

  // Carga dinámica del módulo
  let modulo;
  try {
    modulo = await import(`./${rutaConfig.archivo}`);
  } catch (error) {
    if (renderId !== contadorNavegacion) {
      return;
    }
    console.warn(`[Router] No se pudo cargar '${rutaConfig.archivo}':`, error);
    mostrarErrorEnVista(vista, rutaConfig, error);
    return;
  }

  if (renderId !== contadorNavegacion) {
    return;
  }

  // Montar en el nuevo contenedor. Va DENTRO de la página (invisible) mientras monta, para que las pantallas que
  // buscan sus elementos con document.getElementById (cámara, cuerpo…) los encuentren y midan bien (fix 7-nov).
  contenedorNuevo.style.cssText += 'visibility: hidden; position: absolute; inset: 0;';
  vista.appendChild(contenedorNuevo);
  try {
    if (typeof modulo.montar !== 'function') {
      throw new Error(`El módulo '${rutaConfig.archivo}' no exporta la función requerida 'montar(contenedor, params)'.`);
    }
    await modulo.montar(contenedorNuevo, params);
  } catch (error) {
    contenedorNuevo.remove();
    if (typeof modulo.desmontar === 'function') {
      try { modulo.desmontar(); } catch (e) {}
    }
    if (renderId !== contadorNavegacion) {
      return;
    }
    console.warn(`[Router] Error al montar '${rutaConfig.archivo}':`, error);
    mostrarErrorEnVista(vista, rutaConfig, error);
    return;
  }

  if (renderId !== contadorNavegacion) {
    contenedorNuevo.remove();
    if (typeof modulo.desmontar === 'function') {
      try {
        modulo.desmontar();
      } catch (errDesmontar) {
        console.warn('[Router] Error al desmontar módulo superado:', errDesmontar);
      }
    }
    return;
  }

  // Mostrar la nueva pantalla y quitar lo demás (el aviso de «Cargando…»)
  moduloActual = modulo;
  [...vista.children].forEach((n) => { if (n !== contenedorNuevo) n.remove(); });
  contenedorNuevo.style.visibility = '';
  contenedorNuevo.style.position = '';
  contenedorNuevo.style.inset = '';
}

/**
 * Muestra una tarjeta de error en la vista sin romper la barra inferior ni la cabecera.
 * Utiliza icono vectorial SVG y tipografía Bricolage Grotesque (cero monospace).
 */
function mostrarErrorEnVista(vista, rutaConfig, error) {
  vista.innerHTML = '';
  const vistaError = ui.h('div', { class: 'pantalla' },
    ui.h('div', { class: 'tarjeta error-pantalla' },
      ui.h('div', { class: 'icono-error' }, icono('info', 36)),
      ui.h('h2', { class: 'titulo-seccion' }, `${rutaConfig.titulo} no disponible`),
      ui.h('p', { class: 'sutil' }, 'Este módulo está siendo preparado por otro componente o presentó un problema al inicializarse.'),
      ui.h('div', {
        style: 'font-family: var(--fuente); font-variant-numeric: tabular-nums; font-size: 0.75rem; color: var(--alerta-texto, var(--alerta)); white-space: pre-wrap; word-break: break-all; max-width: 100%; text-align: left; background: var(--papel2); padding: 12px 16px; border-radius: 28px;'
      }, error?.message || String(error)),
      ui.h('div', { class: 'fila', style: 'margin-top: 10px; justify-content: center; width: 100%; gap: 10px;' },
        ui.h('button', {
          class: 'btn primario',
          type: 'button',
          on: { click: () => cargarRuta() }
        }, 'Reintentar'),
        ui.h('button', {
          class: 'btn fantasma',
          type: 'button',
          on: { click: () => ir('#hoy') }
        }, 'Volver a Hoy')
      )
    )
  );
  vista.appendChild(vistaError);
}

/**
 * Inicialización completa de la aplicación Forja:
 * 1. Inicializa iconos vectoriales de cabecera y barra de navegación.
 * 2. Abre IndexedDB ('forja' v1).
 * 3. Asistente inicial si primeraVez !== false.
 * 4. PIN opcional.
 * 5. Registro de sw.js.
 * 6. Router por hash.
 */
async function iniciar() {
  try {
    // 0. Modo sin internet desde el primer segundo (antes esperaba al asistente inicial; fix 7-nov)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch((errSw) => {
        console.warn('[App] Advertencia al registrar sw.js:', errSw);
      });
    }

    // 1. Iconos vectoriales
    inicializarIconosUI();

    // 2. Base de datos
    await db.abrir();

    // 3. Comprobar primera vez (asistente inicial)
    const primeraVez = await db.ajuste('primeraVez', true);
    if (primeraVez !== false) {
      try {
        const ajustesMod = await import('./ajustes.js');
        if (typeof ajustesMod.asistenteInicial === 'function') {
          await ajustesMod.asistenteInicial();
        }
      } catch (e) {
        console.info('[App] Asistente inicial pendiente o módulo ajustes en construcción.');
      }
    }

    // 4. Comprobar seguridad por PIN si existe
    const pin = await db.ajuste('pin', null);
    if (pin) {
      try {
        const ajustesMod = await import('./ajustes.js');
        if (typeof ajustesMod.pedirPin === 'function') {
          const pinValido = await ajustesMod.pedirPin();
          if (!pinValido) {
            ui.aviso('Acceso bloqueado: PIN incorrecto', 'error');
            const vista = document.getElementById('vista');
            if (vista) {
              vista.innerHTML = '';
              const bloqueo = ui.h('div', { class: 'pantalla' },
                ui.h('div', { class: 'tarjeta error-pantalla' },
                  ui.h('div', { class: 'icono-error' }, icono('ajustes', 36)),
                  ui.h('h2', { class: 'titulo-seccion' }, 'Acceso bloqueado'),
                  ui.h('p', { class: 'sutil' }, 'Debes ingresar el PIN correcto para acceder a tus datos de Forja.'),
                  ui.h('button', {
                    class: 'btn primario',
                    type: 'button',
                    on: { click: () => location.reload() }
                  }, 'Reintentar')
                )
              );
              vista.appendChild(bloqueo);
            }
            return;
          }
        }
      } catch (e) {
        console.warn('[App] No se pudo invocar pedirPin():', e);
      }
    }

    // 5. (El service worker ya se registró en el paso 0)

    // 6. Configurar escuchador de hash y cargar vista
    window.addEventListener('hashchange', cargarRuta);

    // Cargar ruta actual o redirigir a #hoy
    if (!window.location.hash) {
      window.location.hash = '#hoy';
    } else {
      cargarRuta();
    }
  } catch (errorFatal) {
    console.error('[App] Error fatal al iniciar Forja:', errorFatal);
    ui.aviso('Error al inicializar la base de datos de Forja', 'error');
  }
}

// Exponer en window solo para depuración según contrato
window.forja = { ir };

// Iniciar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciar);
} else {
  iniciar();
}

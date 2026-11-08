/**
 * js/registro.js — Pantalla «Registrar» de Forja.
 *
 * Ronda de Diseño v2 y Auditoría — Dirección de arte «Revista de sala»:
 * - Sin emojis: usa icono(nombre) de ./iconos.js (mas, menos, check, microfono, reloj, borrar, editar, etc.).
 * - Modo serie por serie con video/foto del ejercicio arriba (<video autoplay muted loop playsinline class='foto-ejercicio'>).
 * - Números héroe de kg y reps con clase .grande (76-96px) en Bricolage Grotesque tabular-nums.
 * - Botones − / + redondos grandes táctiles (>= 48px).
 * - Esfuerzo en 5 píldoras canónicas (Fácil 3 · 2 · 1 · 0 · Fallo) en grilla adaptable a 360px y >= 48px de alto.
 * - Botón principal lima píldora «Guardar serie N de M» con burbuja de icono check.
 * - Temporizador de descanso resiliente (C-01): guarda hora de fin en localStorage, sobrevive al bloqueo del celular
 *   (visibilitychange + WakeLock + Notification) y a cambiar de pantalla (barra flotante global + temporizadorActivo()).
 * - Al cambiar de ejercicio limpia el estado sucio y carga pesoSugerido() de la última sesión (C-02).
 * - Cumple con todos los contratos de CONTRATOS.md y requerimientos de ENCARGO_APP.md.
 */

import { nuevoId, guardar, borrar, filtrar } from './db.js';
import { h, aviso, dialogo, confirmar, hoyISO, fechaBonita, formatoKg, vibrar, sonido } from './ui.js';
import { ejercicios } from './datos.js';
import { DESCANSO } from './config.js';
import { pesoSugerido } from './calculos.js';
import { entenderTexto } from './parser.js';
import { icono } from './iconos.js';

let contenedorRaiz = null;
let fechaSeleccionada = hoyISO();
let listaEjercicios = [];
let modoActivo = 'serie'; // 'serie' | 'texto' (por defecto serie por serie según v2)

let reconocimientoVoz = null;
let escuchandoVoz = false;
let intervaloTimer = null;
let wakeLockSentinel = null;
let listenersGlobalesRegistrados = false;

const STORAGE_TIMER_INICIO = 'forja_descanso_inicio';
const STORAGE_TIMER_DURACION = 'forja_descanso_duracion';
const STORAGE_TIMER_FIN = 'forja_descanso_fin';
const STORAGE_TIMER_EJERCICIO = 'forja_descanso_ejercicio';

const estadoSerie = {
  ejercicioId: '',
  kg: 20,
  unidad: 'kg',
  esPesoCorporal: false,
  porLado: false,
  reps: 8,
  rir: 1,
  fallo: false,
  maquina: '',
  nota: ''
};

let vistaPreviaItems = [];
let vistaPreviaDudas = [];

/**
 * Respaldo seguro de iconos SVG vectoriales (trazo 1.75px redondeado).
 * Se usan si icono(nombre) devuelve cadena o para asegurar renderizado de nodos en h().
 */
const ICONOS_FALLBACK = {
  mas: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
  menos: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
  check: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
  microfono: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
  reloj: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  borrar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  editar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  cruz: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  chevron_izq: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>',
  chevron_der: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>',
  lista: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  alerta: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
};

/**
 * Obtiene el nodo de icono llamando a icono(nombre) de ./iconos.js.
 * Si devuelve string SVG o Element, lo adapta para ser insertado en h().
 * @param {string} nombre
 * @returns {Node|string}
 */
function ico(nombre) {
  let val = null;
  try {
    if (typeof icono === 'function') {
      val = icono(nombre);
    }
  } catch (e) {
    val = null;
  }
  if (!val && ICONOS_FALLBACK[nombre]) {
    val = ICONOS_FALLBACK[nombre];
  }
  if (!val) return '';
  if (val instanceof Node) return val;
  if (typeof val === 'string') {
    const t = document.createElement('template');
    t.innerHTML = val.trim();
    return t.content.firstElementChild || val;
  }
  return val;
}

/**
 * Determina si un ejercicio es naturalmente de peso corporal.
 * @param {Object|null} ej
 * @returns {boolean}
 */
function esCorporalPorDefecto(ej) {
  if (!ej) return false;
  const txt = `${ej.equipo || ''} ${ej.tipo || ''} ${ej.nombre || ''} ${ej.id || ''}`.toLowerCase();
  return txt.includes('corporal') || txt.includes('dominada') ||
         txt.includes('flexion') || txt.includes('flexión') ||
         txt.includes('fondo') || txt.includes('plancha') ||
         txt.includes('colgado') || txt.includes('barra de dominadas');
}

/**
 * Carga y limpia el estado para un ejercicio seleccionado, evitando arrastrar
 * kilos, placas, modo corporal o notas del ejercicio anterior (C-02).
 * @param {string} ejercicioId
 * @param {string} fecha
 */
async function cargarEstadoParaEjercicio(ejercicioId, fecha) {
  estadoSerie.ejercicioId = ejercicioId || '';
  estadoSerie.maquina = '';
  estadoSerie.nota = '';
  estadoSerie.fallo = false;

  const ej = listaEjercicios.find(e => e.id === ejercicioId) || null;
  const rirRec = ej && typeof ej.rir_recomendado === 'number' ? ej.rir_recomendado : 1;
  estadoSerie.rir = Math.max(0, Math.min(3, rirRec));

  if (!ejercicioId) {
    estadoSerie.kg = 20;
    estadoSerie.reps = 8;
    estadoSerie.unidad = 'kg';
    estadoSerie.porLado = false;
    estadoSerie.esPesoCorporal = false;
    return;
  }

  try {
    const todasPrevias = await filtrar('series', s => s.ejercicioId === ejercicioId && s.fecha <= fecha);
    if (todasPrevias && todasPrevias.length > 0) {
      todasPrevias.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || ((b.hora || 0) - (a.hora || 0)));
      const ultimaFecha = todasPrevias[0].fecha;
      const seriesUltima = todasPrevias
        .filter(s => s.fecha === ultimaFecha)
        .sort((a, b) => (a.hora || 0) - (b.hora || 0));

      // Si las series son de una sesión previa, calculamos doble progresión con pesoSugerido;
      // si ya hizo una serie hoy en esta misma fecha, mantenemos la carga recién usada hoy.
      if (ultimaFecha === fecha) {
        const refHoy = seriesUltima[seriesUltima.length - 1];
        estadoSerie.esPesoCorporal = (refHoy.kg === null || refHoy.kg === undefined);
        estadoSerie.kg = !estadoSerie.esPesoCorporal ? Number(refHoy.kg) : 20;
        estadoSerie.reps = Number(refHoy.reps) || 8;
        estadoSerie.unidad = refHoy.unidad === 'placa' ? 'placa' : 'kg';
        estadoSerie.porLado = Boolean(refHoy.porLado);
        estadoSerie.maquina = refHoy.maquina || '';
        return;
      }

      const sug = pesoSugerido(seriesUltima, ej || {});
      if (sug) {
        estadoSerie.esPesoCorporal = (sug.kg === null);
        estadoSerie.kg = sug.kg !== null && !isNaN(Number(sug.kg)) ? Number(sug.kg) : 20;
        estadoSerie.reps = Number(sug.reps) || 8;
        estadoSerie.unidad = sug.unidad === 'placa' ? 'placa' : 'kg';
        estadoSerie.porLado = Boolean(sug.porLado);
        return;
      }
    }
  } catch (e) {
    // Fallback limpio si falla la lectura de historial
  }

  // Sin historial previo para este ejercicio: inicializar valores limpios según el ejercicio
  let sugVacia = null;
  try {
    sugVacia = pesoSugerido([], ej || {});
  } catch (e) {}

  estadoSerie.esPesoCorporal = esCorporalPorDefecto(ej);
  estadoSerie.kg = 20;
  estadoSerie.reps = Number(sugVacia?.reps) || 8;
  estadoSerie.unidad = 'kg';
  estadoSerie.porLado = Boolean(ej?.equipo && /mancuerna/i.test(ej.equipo));
}

/**
 * Obtiene o crea la sesión correspondiente a una fecha.
 * @param {string} fecha ISO 'AAAA-MM-DD'
 * @returns {Promise<Object>}
 */
async function obtenerOCrearSesion(fecha) {
  const existentes = await filtrar('sesiones', s => s.fecha === fecha);
  if (existentes?.length > 0) return existentes[0];
  const nueva = { id: nuevoId(), fecha, inicio: Date.now(), fin: null, nota: '' };
  await guardar('sesiones', nueva);
  return nueva;
}

/**
 * Calcula los segundos de descanso recomendados para un ejercicio.
 * @param {string} ejercicioId
 * @returns {number}
 */
function obtenerDescansoSeg(ejercicioId) {
  const ej = listaEjercicios.find(e => e.id === ejercicioId);
  if (ej && typeof ej.descanso_seg === 'number' && ej.descanso_seg > 0) return ej.descanso_seg;
  const esComp = ej && ej.tipo === 'compuesto';
  if (DESCANSO && typeof DESCANSO.compuesto === 'number') {
    return esComp ? DESCANSO.compuesto : (DESCANSO.aislamiento || 75);
  }
  return esComp ? 120 : 75;
}

/**
 * Solicita mantener la pantalla encendida (Wake Lock API) durante el descanso.
 */
async function adquirirWakeLock() {
  try {
    if ('wakeLock' in navigator && navigator.wakeLock && typeof navigator.wakeLock.request === 'function') {
      if (!wakeLockSentinel) {
        wakeLockSentinel = await navigator.wakeLock.request('screen');
        wakeLockSentinel.addEventListener('release', () => {
          wakeLockSentinel = null;
        });
      }
    }
  } catch (e) {
    wakeLockSentinel = null;
  }
}

/**
 * Libera el bloqueo de pantalla activa cuando el temporizador finaliza o se cancela.
 */
async function liberarWakeLock() {
  try {
    if (wakeLockSentinel && typeof wakeLockSentinel.release === 'function') {
      await wakeLockSentinel.release();
    }
  } catch (e) {}
  wakeLockSentinel = null;
}

/**
 * Lee el estado actual del temporizador desde localStorage usando la hora de fin (C-01).
 * @returns {{inicio: number, duracion: number, fin: number, restante: number, ejercicio: string}|null}
 */
function leerDatosTemporizador() {
  try {
    const finStr = localStorage.getItem(STORAGE_TIMER_FIN);
    const iniStr = localStorage.getItem(STORAGE_TIMER_INICIO);
    const durStr = localStorage.getItem(STORAGE_TIMER_DURACION);
    const ejNom = localStorage.getItem(STORAGE_TIMER_EJERCICIO) || 'Descanso';

    if (!finStr && (!iniStr || !durStr)) return null;

    const inicio = iniStr ? parseInt(iniStr, 10) : Date.now();
    const duracion = durStr ? parseInt(durStr, 10) : 60000;
    const fin = finStr ? parseInt(finStr, 10) : (inicio + duracion);

    if (isNaN(fin) || isNaN(duracion) || duracion <= 0) return null;

    const restante = fin - Date.now();
    return { inicio, duracion, fin, restante, ejercicio: ejNom };
  } catch (e) {
    return null;
  }
}

/**
 * Remueve la barra flotante global de descanso si existe.
 */
function removerBarraFlotante() {
  const barra = document.getElementById('forja-timer-flotante');
  if (barra) barra.remove();
}

/**
 * Crea o actualiza la barra flotante pequeña de descanso en cualquier pantalla cuando el usuario
 * no está viendo el temporizador completo de la pantalla Registrar (C-01).
 * @param {{inicio: number, duracion: number, fin: number, restante: number, ejercicio: string}|null} estado
 */
function sincronizarBarraFlotante(estado) {
  if (typeof document === 'undefined' || !document.body) return;
  if (!estado || estado.restante <= 0) {
    removerBarraFlotante();
    return;
  }

  // Si el widget grande de Registrar está visible en el DOM actual, ocultamos la barra flotante para no duplicar
  const domGrande = document.getElementById('reg-timer-display');
  if (domGrande && document.body.contains(domGrande)) {
    removerBarraFlotante();
    return;
  }

  inyectarEstilos();

  const total = Math.max(0, Math.ceil(estado.restante / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  const textoTiempo = `${m}:${s < 10 ? '0' : ''}${s}`;

  let barra = document.getElementById('forja-timer-flotante');
  if (!barra) {
    barra = h('div', {
      id: 'forja-timer-flotante',
      class: 'reg-timer-flotante oscuro',
      role: 'status',
      'aria-live': 'polite'
    },
      h('button', {
        type: 'button',
        class: 'reg-timer-flotante-info',
        on: {
          click: () => {
            window.location.hash = '#registrar';
          }
        }
      },
        h('span', { class: 'reg-timer-flotante-icono' }, ico('reloj')),
        h('span', { class: 'reg-timer-flotante-tiempo', id: 'forja-timer-flotante-tiempo' }, textoTiempo),
        h('span', { class: 'reg-timer-flotante-ej', id: 'forja-timer-flotante-ej' }, estado.ejercicio)
      ),
      h('div', { class: 'reg-timer-flotante-acciones' },
        h('button', {
          type: 'button',
          class: 'reg-timer-flotante-btn',
          'aria-label': 'Sumar 30 segundos al descanso',
          on: { click: async () => { await ajustarTiempoTemporizador(30); } }
        }, '+30 s'),
        h('button', {
          type: 'button',
          class: 'reg-timer-flotante-btn lima',
          'aria-label': 'Saltar descanso',
          on: { click: async () => { await detenerTemporizador(); } }
        }, 'Saltar')
      )
    );
    document.body.appendChild(barra);
  } else {
    const elTiempo = document.getElementById('forja-timer-flotante-tiempo');
    const elEj = document.getElementById('forja-timer-flotante-ej');
    if (elTiempo) elTiempo.textContent = textoTiempo;
    if (elEj) elEj.textContent = estado.ejercicio;
  }
}

/**
 * Envía una notificación del sistema si la página está oculta o el celular bloqueado.
 * @param {string} ejercicio
 */
function notificarFinDescanso(ejercicio) {
  try {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
      const titulo = '¡Descanso terminado!';
      const opciones = {
        body: `Siguiente serie de ${ejercicio || 'tu ejercicio'}`,
        vibrate: [300, 150, 300, 150, 600],
        tag: 'forja-descanso'
      };
      if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(reg => {
          if (reg && typeof reg.showNotification === 'function') {
            reg.showNotification(titulo, opciones).catch(() => {});
          }
        }).catch(() => {});
      } else {
        new Notification(titulo, opciones);
      }
    }
  } catch (e) {}
}

/**
 * Inicia el temporizador de descanso basado en la hora de inicio y la hora de fin (C-01).
 * @param {string} nombreEjercicio
 * @param {number} segundos
 */
async function iniciarTemporizador(nombreEjercicio, segundos) {
  const ahora = Date.now();
  const duracionMs = Math.max(1000, segundos * 1000);
  const finMs = ahora + duracionMs;

  try {
    localStorage.setItem(STORAGE_TIMER_INICIO, ahora.toString());
    localStorage.setItem(STORAGE_TIMER_DURACION, duracionMs.toString());
    localStorage.setItem(STORAGE_TIMER_FIN, finMs.toString());
    localStorage.setItem(STORAGE_TIMER_EJERCICIO, nombreEjercicio || 'Descanso');
  } catch (e) {}

  try {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  } catch (e) {}

  adquirirWakeLock();
  registrarListenersGlobalesTimer();
  iniciarLoopTemporizador();

  if (contenedorRaiz) {
    await actualizarUI();
  } else {
    sincronizarBarraFlotante(leerDatosTemporizador());
  }
}

/**
 * Detiene y limpia el temporizador de descanso sin destruir el formulario activo (A-04).
 */
async function detenerTemporizador() {
  if (intervaloTimer) {
    clearInterval(intervaloTimer);
    intervaloTimer = null;
  }
  await liberarWakeLock();
  try {
    localStorage.removeItem(STORAGE_TIMER_INICIO);
    localStorage.removeItem(STORAGE_TIMER_DURACION);
    localStorage.removeItem(STORAGE_TIMER_FIN);
    localStorage.removeItem(STORAGE_TIMER_EJERCICIO);
  } catch (e) {}

  // A-04: Remover únicamente el nodo del temporizador sin borrar lo que el usuario está escribiendo
  const widgetTimer = document.querySelector('.reg-descanso-container');
  if (widgetTimer) {
    widgetTimer.remove();
  }
  removerBarraFlotante();
}

/**
 * Ajusta la duración y hora de fin del descanso sumando o restando segundos.
 * Actualiza el DOM puntualmente sin borrar inputs activos.
 * @param {number} deltaSeg
 */
async function ajustarTiempoTemporizador(deltaSeg) {
  const estado = leerDatosTemporizador();
  if (!estado) return;

  const deltaMs = deltaSeg * 1000;
  const nuevoFin = Math.max(Date.now() + 5000, estado.fin + deltaMs);
  const nuevaDuracion = Math.max(5000, estado.duracion + deltaMs);

  try {
    localStorage.setItem(STORAGE_TIMER_FIN, nuevoFin.toString());
    localStorage.setItem(STORAGE_TIMER_DURACION, nuevaDuracion.toString());
  } catch (e) {}

  actualizarNodosTemporizador();
}

/**
 * Verifica y actualiza los nodos del temporizador (tanto el bloque grande en Registrar
 * como la barra flotante en otras pantallas). Si llegó a 0, dispara la alerta.
 */
function actualizarNodosTemporizador() {
  const estado = leerDatosTemporizador();
  if (!estado) {
    if (intervaloTimer) {
      clearInterval(intervaloTimer);
      intervaloTimer = null;
    }
    removerBarraFlotante();
    return;
  }

  const { duracion, restante, ejercicio } = estado;

  if (restante <= 0) {
    detenerTemporizador();
    sonido();
    vibrar([300, 150, 300, 150, 600]);
    notificarFinDescanso(ejercicio);
    aviso('¡Descanso terminado! Siguiente serie.', 'ok');
    return;
  }

  const total = Math.ceil(restante / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  const textoTiempo = `${m}:${s < 10 ? '0' : ''}${s}`;

  const domDisplay = document.getElementById('reg-timer-display');
  const domCircle = document.getElementById('reg-timer-circle');
  if (domDisplay) {
    domDisplay.textContent = textoTiempo;
  }
  if (domCircle) {
    const ratio = Math.max(0, Math.min(1, restante / duracion));
    const offset = 722.5 * (1 - ratio);
    domCircle.style.strokeDashoffset = offset.toString();
  }

  sincronizarBarraFlotante(estado);
}

/**
 * Bucle de actualización reactivo del temporizador de descanso.
 */
function iniciarLoopTemporizador() {
  if (intervaloTimer) clearInterval(intervaloTimer);
  actualizarNodosTemporizador();
  intervaloTimer = setInterval(actualizarNodosTemporizador, 500);
}

/**
 * Registra escuchadores de ciclo de vida (visibilitychange, focus, hashchange)
 * para que el temporizador sobreviva al bloqueo del celular y al cambio de pantalla (C-01).
 */
function registrarListenersGlobalesTimer() {
  if (listenersGlobalesRegistrados || typeof window === 'undefined') return;
  listenersGlobalesRegistrados = true;

  const alRecuperarVisibilidad = () => {
    const estado = leerDatosTemporizador();
    if (!estado) return;
    if (document.visibilityState === 'visible') {
      adquirirWakeLock();
    }
    actualizarNodosTemporizador();
    if (!intervaloTimer && leerDatosTemporizador()) {
      iniciarLoopTemporizador();
    }
  };

  document.addEventListener('visibilitychange', alRecuperarVisibilidad);
  window.addEventListener('focus', alRecuperarVisibilidad);
  window.addEventListener('hashchange', () => {
    setTimeout(() => {
      const estado = leerDatosTemporizador();
      if (estado) sincronizarBarraFlotante(estado);
    }, 60);
  });
}

/**
 * Verifica si hay un temporizador de descanso corriendo en localStorage,
 * mantiene activa la barra flotante en cualquier pantalla y devuelve su estado (C-01).
 * Puede ser invocada por app.js u otros módulos al cambiar de ruta.
 * @returns {{activo: boolean, ejercicio: string, inicio: number, fin: number, duracion: number, restanteMs: number, restanteSeg: number}|null}
 */
export function temporizadorActivo() {
  registrarListenersGlobalesTimer();
  const estado = leerDatosTemporizador();
  if (!estado) {
    removerBarraFlotante();
    return null;
  }
  if (estado.restante <= 0) {
    actualizarNodosTemporizador();
    return null;
  }
  inyectarEstilos();
  if (!intervaloTimer) {
    iniciarLoopTemporizador();
  } else {
    sincronizarBarraFlotante(estado);
  }
  return {
    activo: true,
    ejercicio: estado.ejercicio,
    inicio: estado.inicio,
    fin: estado.fin,
    duracion: estado.duracion,
    restanteMs: estado.restante,
    restanteSeg: Math.ceil(estado.restante / 1000)
  };
}

/**
 * Activa o desactiva el dictado por voz mediante Web Speech API.
 * @param {Function} onTexto Callback con el texto reconocido
 */
async function toggleVoz(onTexto) {
  const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Speech) {
    aviso('Reconocimiento de voz no disponible en este navegador. Usa el teclado.', 'info');
    return;
  }
  if (escuchandoVoz && reconocimientoVoz) {
    reconocimientoVoz.stop();
    escuchandoVoz = false;
    await actualizarUI();
    return;
  }
  try {
    reconocimientoVoz = new Speech();
    reconocimientoVoz.lang = 'es-CO';
    reconocimientoVoz.continuous = false;
    reconocimientoVoz.onstart = async () => {
      escuchandoVoz = true;
      aviso('Escuchando... Di tus series (ej: jalon 45 6 6 5)', 'info');
      await actualizarUI();
    };
    reconocimientoVoz.onresult = async (e) => {
      const txt = e.results?.[0]?.[0]?.transcript;
      if (txt && onTexto) await onTexto(txt);
    };
    reconocimientoVoz.onerror = async (err) => {
      escuchandoVoz = false;
      aviso(err.error === 'network' ? 'Sin conexión para voz. Usa el teclado.' : `Aviso voz: ${err.error}`, 'info');
      await actualizarUI();
    };
    reconocimientoVoz.onend = async () => {
      escuchandoVoz = false;
      await actualizarUI();
    };
    reconocimientoVoz.start();
  } catch (e) {
    escuchandoVoz = false;
    aviso('No se pudo activar el micrófono.', 'info');
    await actualizarUI();
  }
}

/**
 * Obtiene el resumen de la última sesión para un ejercicio dado («La vez pasada: 40 × 5, 5, 5»).
 * @param {string} ejercicioId
 * @param {string} fechaActual
 * @returns {Promise<string|null>}
 */
async function obtenerTextoUltimaSesion(ejercicioId, fechaActual) {
  try {
    const previas = await filtrar('series', s => s.ejercicioId === ejercicioId && s.fecha < fechaActual);
    if (!previas || previas.length === 0) return null;
    previas.sort((a, b) => b.fecha.localeCompare(a.fecha) || ((b.hora || 0) - (a.hora || 0)));
    const ultimaFecha = previas[0].fecha;
    const seriesSesion = previas.filter(s => s.fecha === ultimaFecha);
    seriesSesion.sort((a, b) => (a.hora || 0) - (b.hora || 0));
    if (!seriesSesion.length) return null;

    const primera = seriesSesion[0];
    const carga = primera.unidad === 'placa'
      ? `placa ${primera.kg}`
      : (primera.kg !== null ? `${primera.kg}${primera.porLado ? ' kg/lado' : ''}` : 'Peso corporal');
    const repsList = seriesSesion.map(s => s.reps).join(', ');
    return `La vez pasada: ${carga} × ${repsList}`;
  } catch (e) {
    return null;
  }
}

/**
 * Calcula N (número de serie actual hoy + 1) y M (meta de series).
 * @param {string} ejercicioId
 * @param {string} fecha
 * @returns {Promise<{n: number, m: number}>}
 */
async function obtenerNumerosSerie(ejercicioId, fecha) {
  const seriesFecha = await filtrar('series', s => s.fecha === fecha && s.ejercicioId === ejercicioId);
  const n = (seriesFecha?.length || 0) + 1;
  let m = 3;
  const ej = listaEjercicios.find(e => e.id === ejercicioId);
  if (ej?.series_reps_hipertrofia) {
    const match = String(ej.series_reps_hipertrofia).match(/^(\d+)/);
    if (match) m = parseInt(match[1], 10);
  }
  return { n, m: Math.max(n, m) };
}

/**
 * Renderiza la barra superior de selección de fecha.
 * @returns {HTMLElement}
 */
function renderBarraFecha() {
  const cambiarDia = async (delta) => {
    const [y, m, d] = fechaSeleccionada.split('-').map(Number);
    const fechaObj = new Date(y, m - 1, d);
    fechaObj.setDate(fechaObj.getDate() + delta);
    fechaSeleccionada = `${fechaObj.getFullYear()}-${String(fechaObj.getMonth() + 1).padStart(2, '0')}-${String(fechaObj.getDate()).padStart(2, '0')}`;
    await actualizarUI();
  };

  return h('div', { class: 'tarjeta fila reg-barra-fecha' },
    h('button', {
      class: 'btn fantasma reg-btn-fecha',
      'aria-label': 'Día anterior',
      on: { click: async () => { await cambiarDia(-1); } }
    }, ico('chevron_izq')),
    h('div', { class: 'col reg-centro' },
      h('label', { class: 'reg-etiqueta-fecha' },
        h('span', { class: 'reg-texto-fecha' }, fechaBonita(fechaSeleccionada)),
        h('input', {
          type: 'date', class: 'reg-input-fecha-oculto', value: fechaSeleccionada,
          on: { change: async (e) => { if (e.target.value) { fechaSeleccionada = e.target.value; await actualizarUI(); } } }
        })
      ),
      fechaSeleccionada !== hoyISO() ? h('button', {
        class: 'chip alerta reg-btn-hoy',
        on: { click: async () => { fechaSeleccionada = hoyISO(); await actualizarUI(); } }
      }, 'Volver a hoy') : null
    ),
    h('button', {
      class: 'btn fantasma reg-btn-fecha',
      'aria-label': 'Día siguiente',
      on: { click: async () => { await cambiarDia(1); } }
    }, ico('chevron_der'))
  );
}

/**
 * Renderiza el widget de temporizador de descanso idéntico a Pantalla 3 de DIRECCION_FORJA_v2.md.
 * @returns {HTMLElement|null}
 */
function renderWidgetTemporizador() {
  const estado = leerDatosTemporizador();
  if (!estado || estado.restante <= 0) return null;

  const { duracion, restante, ejercicio: ejNom } = estado;
  const total = Math.ceil(restante / 1000), m = Math.floor(total / 60), s = total % 60;
  const ratio = Math.max(0, Math.min(1, restante / duracion));
  const offset = 722.5 * (1 - ratio);

  return h('div', { class: 'tarjeta reg-descanso-container oscuro screen-descanso-content' },
    h('div', { class: 'descanso-header-box' },
      h('span', { class: 'micro-label' }, 'Recuperación activa'),
      h('h2', { class: 'descanso-quote' }, h('em', {}, 'Respira y prepara el agarre'))
    ),
    h('div', { class: 'timer-ring-container' },
      h('svg', { class: 'timer-ring-svg', viewBox: '0 0 260 260' },
        h('circle', { cx: '130', cy: '130', r: '115', stroke: '#232328', 'stroke-width': '3', fill: 'none' }),
        h('circle', {
          id: 'reg-timer-circle',
          cx: '130', cy: '130', r: '115',
          stroke: '#C8F03C', 'stroke-width': '3.5', fill: 'none',
          'stroke-linecap': 'round',
          'stroke-dasharray': '722.5',
          'stroke-dashoffset': offset.toString()
        })
      ),
      h('div', { class: 'timer-center-text' },
        h('span', { class: 'timer-countdown grande', id: 'reg-timer-display' }, `${m}:${s < 10 ? '0' : ''}${s}`),
        h('span', { class: 'timer-caption' }, 'minutos restantes')
      )
    ),
    h('div', { class: 'next-set-card' },
      h('span', { class: 'next-set-title' }, `Descanso: ${ejNom}`),
      h('span', { class: 'next-set-sub' }, 'Recupera el ritmo respiratorio para mantener la intensidad de la serie.')
    ),
    h('div', { class: 'descanso-actions-row' },
      h('button', {
        class: 'btn-timer-secondary', id: 'btnAddTime',
        on: { click: async () => { await ajustarTiempoTemporizador(30); } }
      }, '+30 s'),
      h('button', {
        class: 'btn-timer-skip', id: 'btnSkipTimer',
        on: { click: async () => { await detenerTemporizador(); } }
      }, 'Saltar')
    )
  );
}

/**
 * Renderiza el selector de pestañas entre «Serie por serie» y «Texto rápido».
 * @returns {HTMLElement}
 */
function renderSelectorModo() {
  return h('div', { class: 'fila reg-pestanas' },
    h('button', {
      class: `btn reg-pestana ${modoActivo === 'serie' ? 'activo' : 'inactivo'}`,
      on: { click: async () => { modoActivo = 'serie'; await actualizarUI(); } }
    }, 'Serie por serie'),
    h('button', {
      class: `btn reg-pestana ${modoActivo === 'texto' ? 'activo' : 'inactivo'}`,
      on: { click: async () => { modoActivo = 'texto'; await actualizarUI(); } }
    }, 'Texto rápido')
  );
}

/**
 * Renderiza el video o foto del ejercicio respetando la prioridad editorial.
 * @param {Object} ej
 * @returns {HTMLElement}
 */
function renderMediaEjercicio(ej) {
  const box = h('div', { class: 'registro-video-box' });
  if (ej?.video) {
    const vid = h('video', {
      autoplay: true,
      muted: true,
      loop: true,
      playsinline: true,
      class: 'foto-ejercicio'
    }, h('source', { src: ej.video, type: 'video/mp4' }));
    box.appendChild(vid);
  } else if (ej?.imagen) {
    const img = h('img', {
      src: ej.imagen,
      alt: ej.nombre || 'Ejercicio',
      class: 'foto-ejercicio'
    });
    box.appendChild(img);
  } else {
    box.appendChild(h('div', { class: 'reg-placeholder-media' },
      h('span', {}, ej?.nombre || 'Ejercicio')
    ));
  }
  return box;
}

/**
 * Renderiza la pantalla Modo Serie según el diseño de Pantalla 2 de DIRECCION_FORJA_v2.md.
 * @returns {Promise<HTMLElement>}
 */
async function renderModoSerie() {
  const contenedor = h('div', { class: 'col reg-modo-serie' });

  if (!estadoSerie.ejercicioId && listaEjercicios.length > 0) {
    await cargarEstadoParaEjercicio(listaEjercicios[0].id, fechaSeleccionada);
  }
  const ejAct = listaEjercicios.find(e => e.id === estadoSerie.ejercicioId);
  const { n, m } = await obtenerNumerosSerie(estadoSerie.ejercicioId, fechaSeleccionada);
  const textoPrevio = (await obtenerTextoUltimaSesion(estadoSerie.ejercicioId, fechaSeleccionada)) || 'Primera vez registrando este ejercicio';

  // 1. Barra superior con selector de ejercicio y chip con badge de serie
  const topBar = h('div', { class: 'registro-top-bar' });
  const select = h('select', {
    class: 'reg-select-ejercicio',
    on: {
      change: async (e) => {
        await cargarEstadoParaEjercicio(e.target.value, fechaSeleccionada);
        await actualizarUI();
      }
    }
  });

  for (const ej of listaEjercicios) {
    select.appendChild(h('option', {
      value: ej.id, selected: ej.id === estadoSerie.ejercicioId ? 'selected' : undefined
    }, `${ej.nombre} (${ej.musculos_principales?.[0] || 'General'})`));
  }
  topBar.appendChild(select);
  topBar.appendChild(h('span', { class: 'chip-serie-badge' }, `SERIE ${n} DE ${m}`));
  contenedor.appendChild(topBar);

  // 2. Video o foto del ejercicio pequeño (160 px, radio 28)
  contenedor.appendChild(renderMediaEjercicio(ejAct));

  // 3. Área héroe con números 96 px en Bricolage Grotesque tabular-nums
  const gridHeroes = h('div', { class: 'registro-inputs-grid' });

  // Tarjeta Kilos
  const cardKg = h('div', { class: 'counter-card' });
  let etiquetaKg = 'kg';
  if (estadoSerie.esPesoCorporal) etiquetaKg = 'peso corporal';
  else if (estadoSerie.unidad === 'placa') etiquetaKg = 'placas';
  else if (estadoSerie.porLado) etiquetaKg = 'kg / lado';

  cardKg.appendChild(h('span', { class: 'counter-label' }, etiquetaKg));

  const valorKgTexto = estadoSerie.esPesoCorporal
    ? 'Corporal'
    : (estadoSerie.kg % 1 === 0 ? String(estadoSerie.kg) : estadoSerie.kg.toFixed(1));
  cardKg.appendChild(h('span', {
    class: `counter-number grande ${estadoSerie.esPesoCorporal ? 'texto-corporal' : ''}`,
    id: 'kgValue'
  }, valorKgTexto));

  const modKg = async (delta) => {
    if (estadoSerie.esPesoCorporal) estadoSerie.esPesoCorporal = false;
    const paso = estadoSerie.unidad === 'placa' ? 1 : 2.5;
    const cambio = delta * paso;
    estadoSerie.kg = Math.max(0, Math.round((estadoSerie.kg + cambio) * 10) / 10);
    await actualizarUI();
  };

  const steppersKg = h('div', { class: 'stepper-controls' },
    h('button', {
      class: 'btn-stepper btn redondo',
      'aria-label': 'Restar carga',
      on: { click: async () => { await modKg(-1); } }
    }, ico('menos')),
    h('button', {
      class: 'btn-stepper btn redondo',
      'aria-label': 'Sumar carga',
      on: { click: async () => { await modKg(1); } }
    }, ico('mas'))
  );
  cardKg.appendChild(steppersKg);

  // Chips sutiles para tipo de peso
  const chipsPeso = h('div', { class: 'reg-chips-row' },
    h('button', {
      class: `reg-chip-toggle ${estadoSerie.esPesoCorporal ? 'activo' : ''}`,
      on: {
        click: async () => {
          estadoSerie.esPesoCorporal = !estadoSerie.esPesoCorporal;
          if (estadoSerie.esPesoCorporal) estadoSerie.unidad = 'kg';
          await actualizarUI();
        }
      }
    }, 'Peso corporal'),
    h('button', {
      class: `reg-chip-toggle ${estadoSerie.unidad === 'placa' ? 'activo' : ''}`,
      on: {
        click: async () => {
          estadoSerie.unidad = estadoSerie.unidad === 'placa' ? 'kg' : 'placa';
          if (estadoSerie.unidad === 'placa') estadoSerie.esPesoCorporal = false;
          await actualizarUI();
        }
      }
    }, 'Placa'),
    h('button', {
      class: `reg-chip-toggle ${estadoSerie.porLado ? 'activo' : ''}`,
      on: {
        click: async () => {
          estadoSerie.porLado = !estadoSerie.porLado;
          await actualizarUI();
        }
      }
    }, 'Por lado')
  );
  cardKg.appendChild(chipsPeso);
  gridHeroes.appendChild(cardKg);

  // Tarjeta Repeticiones
  const cardReps = h('div', { class: 'counter-card' });
  cardReps.appendChild(h('span', { class: 'counter-label' }, 'repeticiones'));
  cardReps.appendChild(h('span', { class: 'counter-number grande', id: 'repsValue' }, String(estadoSerie.reps)));

  const modReps = async (delta) => {
    estadoSerie.reps = Math.max(1, estadoSerie.reps + delta);
    await actualizarUI();
  };

  const steppersReps = h('div', { class: 'stepper-controls' },
    h('button', {
      class: 'btn-stepper btn redondo',
      'aria-label': 'Restar repetición',
      on: { click: async () => { await modReps(-1); } }
    }, ico('menos')),
    h('button', {
      class: 'btn-stepper btn redondo',
      'aria-label': 'Sumar repetición',
      on: { click: async () => { await modReps(1); } }
    }, ico('mas'))
  );
  cardReps.appendChild(steppersReps);
  gridHeroes.appendChild(cardReps);
  contenedor.appendChild(gridHeroes);

  // 4. Selector de esfuerzo en 5 píldoras (Fácil 3 · 2 · 1 · 0 · Fallo)
  const effortSection = h('div', { class: 'effort-section' },
    h('span', { class: 'effort-label' }, 'Esfuerzo percibido en reserva (RIR)'),
    h('div', { class: 'effort-pills-row' },
      h('button', {
        type: 'button',
        class: `effort-pill ${!estadoSerie.fallo && estadoSerie.rir === 3 ? 'selected' : ''}`,
        on: { click: async () => { estadoSerie.fallo = false; estadoSerie.rir = 3; await actualizarUI(); } }
      }, 'Fácil 3'),
      h('button', {
        type: 'button',
        class: `effort-pill ${!estadoSerie.fallo && estadoSerie.rir === 2 ? 'selected' : ''}`,
        on: { click: async () => { estadoSerie.fallo = false; estadoSerie.rir = 2; await actualizarUI(); } }
      }, '2'),
      h('button', {
        type: 'button',
        class: `effort-pill ${!estadoSerie.fallo && estadoSerie.rir === 1 ? 'selected' : ''}`,
        on: { click: async () => { estadoSerie.fallo = false; estadoSerie.rir = 1; await actualizarUI(); } }
      }, '1'),
      h('button', {
        type: 'button',
        class: `effort-pill ${!estadoSerie.fallo && estadoSerie.rir === 0 ? 'selected' : ''}`,
        on: { click: async () => { estadoSerie.fallo = false; estadoSerie.rir = 0; await actualizarUI(); } }
      }, '0'),
      h('button', {
        type: 'button',
        class: `effort-pill fallo-pill ${estadoSerie.fallo ? 'selected' : ''}`,
        on: { click: async () => { estadoSerie.fallo = true; estadoSerie.rir = 0; await actualizarUI(); } }
      }, 'Fallo')
    )
  );
  contenedor.appendChild(effortSection);

  // 5. Texto de comparación previa
  contenedor.appendChild(h('p', { class: 'previous-record-text' }, textoPrevio));

  // 6. Campos opcionales de máquina y nota (sin bordes toscos)
  const extraFields = h('div', { class: 'reg-campos-extra grid2' },
    h('div', { class: 'col' },
      h('label', { class: 'sutil' }, 'Máquina:'),
      h('input', {
        type: 'text', class: 'campo', placeholder: 'ej. torre 2', value: estadoSerie.maquina || '',
        on: { input: (e) => { estadoSerie.maquina = e.target.value; } }
      })
    ),
    h('div', { class: 'col' },
      h('label', { class: 'sutil' }, 'Nota:'),
      h('input', {
        type: 'text', class: 'campo', placeholder: 'ej. agarre neutro', value: estadoSerie.nota || '',
        on: { input: (e) => { estadoSerie.nota = e.target.value; } }
      })
    )
  );
  contenedor.appendChild(extraFields);

  // 7. Botón Lima Píldora «Guardar serie N de M»
  const btnGuardar = h('button', {
    class: 'btn-primary-lima',
    on: {
      click: async () => {
        if (!estadoSerie.ejercicioId) {
          aviso('Selecciona un ejercicio primero', 'alerta');
          return;
        }
        const sesion = await obtenerOCrearSesion(fechaSeleccionada);
        await guardar('series', {
          id: nuevoId(),
          fecha: fechaSeleccionada,
          hora: Date.now(),
          ejercicioId: estadoSerie.ejercicioId,
          kg: estadoSerie.esPesoCorporal ? null : estadoSerie.kg,
          unidad: estadoSerie.esPesoCorporal ? 'kg' : (estadoSerie.unidad || 'kg'),
          porLado: Boolean(estadoSerie.porLado),
          reps: Number(estadoSerie.reps) || 1,
          rir: estadoSerie.fallo ? 0 : estadoSerie.rir,
          fallo: Boolean(estadoSerie.fallo),
          maquina: (estadoSerie.maquina || '').trim(),
          nota: (estadoSerie.nota || '').trim(),
          sesionId: sesion.id
        });
        aviso('Serie registrada', 'ok');
        const ej = listaEjercicios.find(e => e.id === estadoSerie.ejercicioId);
        // M-02: Solo iniciar el temporizador si se está registrando en la fecha de hoy
        if (fechaSeleccionada === hoyISO()) {
          await iniciarTemporizador(ej ? ej.nombre : 'Descanso', obtenerDescansoSeg(estadoSerie.ejercicioId));
        } else {
          await actualizarUI();
        }
      }
    }
  },
    h('span', {}, `Guardar serie ${n} de ${m}`),
    h('div', { class: 'btn-icon-bubble' }, ico('check'))
  );
  contenedor.appendChild(btnGuardar);

  return contenedor;
}

/**
 * Renderiza la pantalla Modo Texto rápido con lenguaje natural.
 * @returns {HTMLElement}
 */
function renderModoTexto() {
  const contenedor = h('div', { class: 'col reg-modo-texto' });
  const inputTexto = h('textarea', {
    class: 'reg-textarea',
    rows: '3',
    placeholder: 'Ej: dorian 40/lado 6 6 5, martillo 10 4 · bayesiano 10kg 6 6, 7,5kg 7 · femoral placa 5 8 8 7'
  });

  const parsear = (val) => {
    if (!val.trim()) {
      vistaPreviaItems = [];
      vistaPreviaDudas = [];
    } else {
      const res = entenderTexto(val, listaEjercicios);
      vistaPreviaItems = res.items;
      vistaPreviaDudas = res.dudas;
    }
    renderPrevia();
  };

  inputTexto.addEventListener('input', (e) => parsear(e.target.value));

  const contenedorPrevia = h('div', { id: 'reg-previa-bloque' });
  const renderPrevia = () => {
    contenedorPrevia.innerHTML = '';
    if (vistaPreviaDudas.length > 0) {
      contenedorPrevia.appendChild(h('div', { class: 'chip alerta fila reg-alinear-centro reg-mb-half' },
        ico('alerta'),
        h('span', { class: 'reg-ml-half' }, `Dudas: "${vistaPreviaDudas.join(', ')}"`)
      ));
    }
    if (!vistaPreviaItems.length) {
      if (inputTexto.value.trim()) {
        contenedorPrevia.appendChild(h('div', { class: 'sutil reg-mb-half' }, 'Escribe un ejercicio y repeticiones.'));
      }
      return;
    }

    contenedorPrevia.appendChild(h('div', { class: 'titulo-seccion' }, 'Vista previa editable (revisa antes de guardar):'));

    vistaPreviaItems.forEach((item, itemIdx) => {
      const tarjeta = h('div', { class: 'reg-item-previa col' });
      const etiquetasSeriesDom = [];

      const formatearCargaSerie = (s) => {
        const uSerie = s.unidad || item.unidad || 'kg';
        const pesoSerie = (s.kg !== undefined && s.kg !== null) ? s.kg : item.kg;
        return pesoSerie !== null
          ? (uSerie === 'placa' ? `placa ${pesoSerie}` : `${pesoSerie}${item.porLado ? ' kg/lado' : ' kg'}`)
          : 'Peso corporal';
      };

      // Encabezado
      const encabezado = h('div', { class: 'fila reg-espacio-entre reg-alinear-centro reg-mb-half' },
        h('strong', {}, `Ejercicio ${itemIdx + 1}${vistaPreviaItems.length > 1 ? ` de ${vistaPreviaItems.length}` : ''}`),
        h('div', { class: 'fila reg-alinear-centro' },
          h('button', {
            class: `reg-chip-toggle ${item.unidad === 'placa' ? 'activo' : ''} reg-mr-half`,
            on: {
              click: () => {
                item.unidad = item.unidad === 'placa' ? 'kg' : 'placa';
                for (const s of item.series) s.unidad = item.unidad;
                renderPrevia();
              }
            }
          }, item.unidad === 'placa' ? 'Placas' : 'Kilos'),
          vistaPreviaItems.length > 1 ? h('button', {
            class: 'btn fantasma reg-btn-chico',
            title: 'Quitar este ejercicio',
            on: { click: () => { vistaPreviaItems.splice(itemIdx, 1); renderPrevia(); } }
          }, ico('cruz')) : null
        )
      );
      tarjeta.appendChild(encabezado);

      // Selector de ejercicio
      const select = h('select', {
        class: 'campo',
        on: { change: (e) => { item.ejercicioId = e.target.value; renderPrevia(); } }
      }, h('option', { value: '' }, 'Selecciona ejercicio...'));

      for (const ej of listaEjercicios) {
        select.appendChild(h('option', {
          value: ej.id, selected: ej.id === item.ejercicioId ? 'selected' : undefined
        }, `${ej.nombre} (${ej.musculos_principales?.[0] || 'General'})`));
      }
      tarjeta.appendChild(h('div', { class: 'col' }, h('label', { class: 'sutil' }, 'Ejercicio:'), select));

      // Chips con sugerencias
      if (Array.isArray(item.opciones) && item.opciones.length > 1) {
        const chips = h('div', { class: 'fila reg-sug-chips reg-mt-half' }, h('span', { class: 'sutil' }, '¿Sugerencias?: '));
        for (const opcId of item.opciones) {
          const ejOpc = listaEjercicios.find(e => e.id === opcId);
          if (ejOpc) {
            chips.appendChild(h('button', {
              class: `chip ${opcId === item.ejercicioId ? 'ok' : ''}`,
              on: { click: () => { item.ejercicioId = opcId; select.value = opcId; renderPrevia(); } }
            }, ejOpc.nombre));
          }
        }
        tarjeta.appendChild(chips);
      }

      // Carga y Por lado (A-02: sincronizar s.kg de todas las series hijas al editar el peso general)
      const etiquetaCarga = item.unidad === 'placa' ? 'Placa / Pin:' : 'Kilos:';
      tarjeta.appendChild(h('div', { class: 'fila reg-mt-half reg-alinear-centro' },
        h('div', { class: 'col' },
          h('label', { class: 'sutil' }, etiquetaCarga),
          h('input', {
            type: 'number', step: '0.5', class: 'campo reg-input-num',
            placeholder: item.unidad === 'placa' ? 'Placa' : 'Corporal',
            value: item.kg !== null ? item.kg : '',
            on: {
              input: (e) => {
                const v = parseFloat(String(e.target.value).replace(',', '.'));
                item.kg = !isNaN(v) ? v : null;
                if (Array.isArray(item.series)) {
                  for (const s of item.series) {
                    s.kg = item.kg;
                  }
                }
                etiquetasSeriesDom.forEach(({ nodo, serie }) => {
                  nodo.textContent = `${formatearCargaSerie(serie)} × `;
                });
              },
              change: () => {
                renderPrevia();
              }
            }
          })
        ),
        h('label', { class: 'fila reg-alinear-centro reg-ml-1' },
          h('input', {
            type: 'checkbox', checked: item.porLado ? 'checked' : undefined,
            on: { change: (e) => { item.porLado = e.target.checked; renderPrevia(); } }
          }),
          h('span', { class: 'reg-ml-half' }, '¿Por lado?')
        )
      ));

      // Máquina y nota
      tarjeta.appendChild(h('div', { class: 'grid2 reg-mt-half' },
        h('div', { class: 'col' },
          h('label', { class: 'sutil' }, 'Máquina:'),
          h('input', {
            type: 'text', class: 'campo', placeholder: 'ej. torre 2', value: item.maquina || '',
            on: { input: (e) => { item.maquina = e.target.value; } }
          })
        ),
        h('div', { class: 'col' },
          h('label', { class: 'sutil' }, 'Nota:'),
          h('input', {
            type: 'text', class: 'campo', placeholder: 'ej. agarre neutro', value: item.nota || '',
            on: { input: (e) => { item.nota = e.target.value; } }
          })
        )
      ));

      // Series
      const filaSeries = h('div', { class: 'col reg-mt-half' }, h('label', { class: 'sutil' }, 'Series:'));
      item.series.forEach((s, sIdx) => {
        const nodoCarga = h('strong', {}, `${formatearCargaSerie(s)} × `);
        etiquetasSeriesDom.push({ nodo: nodoCarga, serie: s });

        filaSeries.appendChild(h('div', { class: 'fila reg-alinear-centro reg-mb-half' },
          h('span', { class: 'sutil reg-mr-half' }, `S${sIdx + 1}:`),
          nodoCarga,
          h('input', {
            type: 'number', class: 'campo reg-input-num reg-ml-half', value: s.reps, min: '1', max: '100',
            on: { input: (e) => { s.reps = parseInt(e.target.value, 10) || 1; } }
          }),
          h('span', { class: 'sutil reg-ml-half' }, 'reps'),
          h('button', {
            class: 'btn fantasma reg-btn-chico',
            on: { click: () => { item.series.splice(sIdx, 1); renderPrevia(); } }
          }, ico('cruz'))
        ));
      });

      filaSeries.appendChild(h('button', {
        class: 'btn fantasma reg-btn-chico',
        on: {
          click: () => {
            item.series.push({
              kg: item.kg,
              reps: item.series[item.series.length - 1]?.reps || 8,
              unidad: item.unidad || 'kg'
            });
            renderPrevia();
          }
        }
      }, '+ Agregar serie'));

      tarjeta.appendChild(filaSeries);
      contenedorPrevia.appendChild(tarjeta);
    });

    const totalSeries = vistaPreviaItems.reduce((acc, it) => acc + (it.series?.length || 0), 0);
    contenedorPrevia.appendChild(h('button', {
      class: 'btn-primary-lima',
      on: {
        click: async () => {
          let n = 0, ultimoId = null;
          const sesion = await obtenerOCrearSesion(fechaSeleccionada);

          for (const item of vistaPreviaItems) {
            if (!item.ejercicioId) continue;
            ultimoId = item.ejercicioId;
            const unidadItem = item.unidad === 'placa' ? 'placa' : 'kg';

            for (const s of item.series) {
              const uSerie = s.unidad === 'placa' ? 'placa' : unidadItem;
              await guardar('series', {
                id: nuevoId(),
                fecha: fechaSeleccionada,
                hora: Date.now(),
                ejercicioId: item.ejercicioId,
                kg: s.kg !== undefined && s.kg !== null ? Number(s.kg) : item.kg,
                unidad: uSerie,
                porLado: Boolean(item.porLado),
                reps: Number(s.reps) || 1,
                rir: null,
                fallo: false,
                maquina: (item.maquina || '').trim(),
                nota: (item.nota || '').trim(),
                sesionId: sesion.id
              });
              n++;
            }
          }

          if (n > 0) {
            aviso(`¡${n} series guardadas!`, 'ok');
            inputTexto.value = '';
            vistaPreviaItems = [];
            vistaPreviaDudas = [];
            renderPrevia();
            // M-02: Solo iniciar el temporizador si la fecha activa es hoy
            if (ultimoId && fechaSeleccionada === hoyISO()) {
              const ej = listaEjercicios.find(e => e.id === ultimoId);
              await iniciarTemporizador(ej ? ej.nombre : 'Descanso', obtenerDescansoSeg(ultimoId));
            } else {
              await actualizarUI();
            }
          } else {
            aviso('Selecciona un ejercicio primero', 'alerta');
          }
        }
      }
    },
      h('span', {}, `Guardar series reconocidas (${totalSeries})`),
      h('div', { class: 'btn-icon-bubble' }, ico('check'))
    ));
  };

  contenedor.appendChild(h('div', { class: 'reg-caja-texto col' },
    h('div', { class: 'fila reg-espacio-entre reg-alinear-centro' },
      h('label', { class: 'sutil' }, 'Escribe o dicta como hablas:'),
      h('button', {
        class: `btn ${escuchandoVoz ? 'alerta' : 'fantasma'} reg-btn-chico fila reg-alinear-centro`,
        on: {
          click: async () => {
            await toggleVoz(async (txt) => {
              inputTexto.value = inputTexto.value ? `${inputTexto.value}\n${txt}` : txt;
              parsear(inputTexto.value);
            });
          }
        }
      },
        ico('microfono'),
        h('span', { class: 'reg-ml-half' }, escuchandoVoz ? 'Escuchando...' : 'Micrófono')
      )
    ),
    inputTexto,
    h('p', { class: 'sutil reg-nota-privacidad-voz' },
      'El dictado por voz utiliza el motor del navegador (puede requerir conexión según la configuración de tu teléfono). Todo lo demás funciona 100% sin internet.'
    ),
    h('div', { class: 'fila reg-espacio-entre reg-mt-half' },
      h('button', { class: 'btn primario', on: { click: () => parsear(inputTexto.value) } }, 'Interpretar'),
      h('button', { class: 'btn fantasma', on: { click: () => { inputTexto.value = ''; parsear(''); } } }, 'Limpiar')
    )
  ));
  contenedor.appendChild(contenedorPrevia);
  return contenedor;
}

/**
 * Renderiza la lista de series guardadas de la fecha elegida con opciones de editar y borrar.
 * @returns {Promise<HTMLElement>}
 */
async function renderListaSeries() {
  const seriesFecha = await filtrar('series', s => s.fecha === fechaSeleccionada);
  seriesFecha.sort((a, b) => (a.hora || 0) - (b.hora || 0));

  const contenedor = h('div', { class: 'col reg-series-bloque' },
    h('div', { class: 'fila reg-espacio-entre reg-alinear-centro' },
      h('div', { class: 'titulo-seccion' }, `Series registradas (${seriesFecha.length})`),
      seriesFecha.length > 0 ? h('span', { class: 'sutil' }, fechaBonita(fechaSeleccionada)) : null
    )
  );

  if (!seriesFecha.length) {
    contenedor.appendChild(h('div', { class: 'vacio' },
      h('div', { class: 'grande' }, ico('lista')),
      h('div', {}, 'No hay series registradas en esta fecha.'),
      h('div', { class: 'sutil' }, 'Usa la caja de texto o el modo serie por serie.')
    ));
    return contenedor;
  }

  const grupos = {};
  for (const s of seriesFecha) {
    if (!grupos[s.ejercicioId]) grupos[s.ejercicioId] = [];
    grupos[s.ejercicioId].push(s);
  }

  for (const [ejId, lista] of Object.entries(grupos)) {
    const ej = listaEjercicios.find(e => e.id === ejId);
    const tarjeta = h('div', { class: 'reg-tarjeta-ejercicio col' },
      h('div', { class: 'fila reg-espacio-entre reg-alinear-centro reg-mb-half' },
        h('strong', {}, ej ? ej.nombre : ejId),
        h('span', { class: 'chip ok' }, `${lista.length} ${lista.length === 1 ? 'serie' : 'series'}`)
      )
    );
    const listaDom = h('div', { class: 'lista' });

    lista.forEach((s, idx) => {
      const textoCarga = s.unidad === 'placa'
        ? `placa ${s.kg}`
        : formatoKg(s.kg, s.porLado);

      listaDom.appendChild(h('div', { class: 'reg-item-serie' },
        h('div', { class: 'col' },
          h('div', { class: 'fila reg-alinear-centro' },
            h('span', { class: 'sutil reg-mr-half' }, `#${idx + 1}`),
            h('strong', {}, textoCarga),
            h('span', {}, ` × ${s.reps} reps`),
            s.fallo ? h('span', { class: 'chip alerta reg-ml-half' }, 'Fallo')
                    : (s.rir !== null ? h('span', { class: 'chip ok reg-ml-half' }, `RIR ${s.rir}`) : null)
          ),
          (s.maquina || s.nota) ? h('div', { class: 'sutil reg-texto-chico' },
            [s.maquina ? `Máquina: ${s.maquina}` : '', s.nota ? `"${s.nota}"` : ''].filter(Boolean).join(' · ')
          ) : null
        ),
        h('div', { class: 'reg-acciones-serie' },
          h('button', {
            class: 'reg-btn-icono',
            'aria-label': 'Editar serie',
            on: { click: async () => { await editarSerieDialogo(s); } }
          }, ico('editar')),
          h('button', {
            class: 'reg-btn-icono',
            'aria-label': 'Eliminar serie',
            on: {
              click: async () => {
                if (await confirmar('¿Seguro que deseas borrar esta serie?')) {
                  await borrar('series', s.id);
                  aviso('Serie eliminada', 'info');
                  await actualizarUI();
                }
              }
            }
          }, ico('borrar'))
        )
      ));
    });
    tarjeta.appendChild(listaDom);
    contenedor.appendChild(tarjeta);
  }
  return contenedor;
}

/**
 * Diálogo interactivo para editar una serie ya guardada (con scroll interno A-03 y refresco de etiqueta B-02).
 * @param {Object} s Serie a editar
 */
async function editarSerieDialogo(s) {
  let kg = s.kg;
  let unidad = s.unidad || 'kg';
  let reps = s.reps;
  let rir = s.rir;
  let fallo = s.fallo;
  let maquina = s.maquina || '';
  let nota = s.nota || '';
  let porLado = Boolean(s.porLado);

  const etiquetaCargaEl = h('label', { class: 'sutil', id: 'reg-dialogo-label-carga' },
    unidad === 'placa' ? 'Placa / Pin:' : 'Kilos (vacío para peso corporal):'
  );

  const cuerpo = h('div', { class: 'col reg-dialogo-cuerpo-scroll' },
    h('div', { class: 'fila reg-espacio-entre reg-alinear-centro' },
      etiquetaCargaEl,
      h('label', { class: 'fila reg-alinear-centro reg-texto-chico' },
        h('input', {
          type: 'checkbox',
          checked: unidad === 'placa' ? 'checked' : undefined,
          on: {
            change: (e) => {
              unidad = e.target.checked ? 'placa' : 'kg';
              etiquetaCargaEl.textContent = unidad === 'placa'
                ? 'Placa / Pin:'
                : 'Kilos (vacío para peso corporal):';
            }
          }
        }),
        h('span', { class: 'reg-ml-half' }, '¿Es placa/pin?')
      )
    ),
    h('input', {
      type: 'number', step: '0.5', class: 'campo', value: kg !== null ? kg : '',
      on: { input: (e) => { const v = parseFloat(String(e.target.value).replace(',', '.')); kg = !isNaN(v) ? v : null; } }
    }),
    h('label', { class: 'fila reg-alinear-centro reg-mt-half' },
      h('input', { type: 'checkbox', checked: porLado ? 'checked' : undefined, on: { change: (e) => { porLado = e.target.checked; } } }),
      h('span', { class: 'reg-ml-half' }, '¿Por lado?')
    ),
    h('label', { class: 'sutil reg-mt-half' }, 'Repeticiones:'),
    h('input', {
      type: 'number', class: 'campo', value: reps, min: '1',
      on: { input: (e) => { reps = parseInt(e.target.value, 10) || 1; } }
    }),
    h('label', { class: 'sutil reg-mt-half' }, 'Esfuerzo:'),
    h('div', { class: 'fila reg-mt-half' },
      h('label', { class: 'fila reg-alinear-centro' },
        h('input', { type: 'checkbox', checked: fallo ? 'checked' : undefined, on: { change: (e) => { fallo = e.target.checked; } } }),
        h('span', { class: 'reg-ml-half' }, 'Fallo')
      ),
      h('input', {
        type: 'number', class: 'campo reg-input-num reg-ml-1', placeholder: 'RIR', value: rir !== null ? rir : '', min: '0', max: '5',
        on: { input: (e) => { const v = parseInt(e.target.value, 10); rir = !isNaN(v) ? v : null; } }
      })
    ),
    h('label', { class: 'sutil reg-mt-half' }, 'Máquina:'),
    h('input', { type: 'text', class: 'campo', value: maquina, on: { input: (e) => { maquina = e.target.value; } } }),
    h('label', { class: 'sutil reg-mt-half' }, 'Nota:'),
    h('input', { type: 'text', class: 'campo', value: nota, on: { input: (e) => { nota = e.target.value; } } })
  );

  const res = await dialogo({
    titulo: 'Editar serie', cuerpo,
    botones: [
      { texto: 'Cancelar', valor: 'cancelar', tipo: '' },
      { texto: 'Guardar cambios', valor: 'guardar', tipo: 'primario' }
    ]
  });

  if (res === 'guardar') {
    s.kg = kg;
    s.unidad = unidad;
    s.reps = reps;
    s.rir = fallo ? 0 : rir;
    s.fallo = fallo;
    s.porLado = porLado;
    s.maquina = maquina.trim();
    s.nota = nota.trim();
    await guardar('series', s);
    aviso('Serie actualizada', 'ok');
    await actualizarUI();
  }
}

/**
 * Inyecta los estilos de diseño canónico Forja v2 para la pantalla Registrar.
 */
function inyectarEstilos() {
  if (typeof document === 'undefined' || document.getElementById('forja-reg-styles')) return;
  document.head.appendChild(h('style', { id: 'forja-reg-styles' }, `
    :root {
      --tinta: #17171A;
      --tinta-tarjeta: #232328;
      --papel: #F3F0E8;
      --papel-2: #E9E4D8;
      --tinta-suave: #5D5951;
      --lima: #C8F03C;
    }

    .reg-pantalla { display: flex; flex-direction: column; gap: 16px; padding-bottom: 96px; max-width: 520px; margin: 0 auto; }

    /* Diálogo con scroll interno para móvil con teclado virtual (A-03) */
    .dialogo-caja { max-height: 85dvh; overflow-y: auto; -webkit-overflow-scrolling: touch; }
    .dialogo-cuerpo { overflow-y: visible; }
    .reg-dialogo-cuerpo-scroll { max-height: 62dvh; overflow-y: auto; -webkit-overflow-scrolling: touch; padding-right: 4px; }

    /* Barra de fecha */
    .reg-barra-fecha { align-items: center; justify-content: space-between; padding: 10px 16px; border-radius: 999px; background-color: var(--superficie2, #E9E4D8); }
    .reg-btn-fecha { width: 48px; height: 48px; min-width: 48px; min-height: 48px; border-radius: 999px; display: flex; align-items: center; justify-content: center; padding: 0; color: var(--texto, #17171A); border: none; }
    .reg-centro { align-items: center; text-align: center; }
    .reg-etiqueta-fecha { position: relative; cursor: pointer; font-weight: 600; font-size: 15px; }
    .reg-input-fecha-oculto { opacity: 0; position: absolute; inset: 0; cursor: pointer; width: 100%; height: 100%; }
    .reg-btn-hoy { margin-top: 4px; font-size: 11px; border-radius: 999px; padding: 4px 10px; cursor: pointer; border: none; }

    /* Selector de pestañas */
    .reg-pestanas { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .reg-pestana { min-height: 48px; border-radius: 999px; font-weight: 600; font-size: 14px; cursor: pointer; border: none; }
    .reg-pestana.activo { background-color: var(--tinta, #17171A); color: var(--papel, #F3F0E8); }
    .reg-pestana.inactivo { background-color: var(--superficie2, #E9E4D8); color: var(--texto, #17171A); }

    /* Modo Serie: Top bar & Video */
    .registro-top-bar { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 4px; }
    .reg-select-ejercicio { flex: 1; min-height: 48px; border-radius: 999px; border: none; background-color: var(--superficie2, #E9E4D8); color: var(--texto, #17171A); padding: 8px 14px; font-weight: 600; font-size: 14px; outline: none; }
    .chip-serie-badge { background-color: var(--superficie2, #E9E4D8); border-radius: 999px; padding: 6px 14px; color: var(--texto, #17171A); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 700; white-space: nowrap; }
    .registro-video-box { width: 100%; height: 160px; border-radius: 28px; overflow: hidden; position: relative; background-color: var(--tinta, #17171A); margin-bottom: 4px; }
    .foto-ejercicio { width: 100%; height: 100%; object-fit: cover; display: block; filter: contrast(1.05) saturate(0.9); }
    .reg-placeholder-media { display: flex; align-items: center; justify-content: center; height: 100%; background: linear-gradient(180deg, rgba(23,23,26,0.6) 0%, #17171A 100%); color: #F3F0E8; font-family: 'Instrument Serif', Georgia, serif; font-size: 22px; }

    /* Modo Serie: Inputs Grid y Héroes */
    .registro-inputs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 4px; }
    .counter-card { background-color: var(--superficie2, #E9E4D8); border-radius: 28px; padding: 16px 12px 14px; display: flex; flex-direction: column; align-items: center; text-align: center; }
    .counter-label { font-size: 13px; font-weight: 500; color: var(--tinta-suave, #5D5951); margin-bottom: 2px; }
    .counter-number.grande, .counter-card .grande { font-family: 'Bricolage Grotesque', sans-serif; font-size: 76px; font-weight: 800; line-height: 0.95; color: var(--texto, #17171A); font-variant-numeric: tabular-nums; margin-bottom: 10px; letter-spacing: -0.03em; }
    @media (min-width: 420px) { .counter-number.grande, .counter-card .grande { font-size: 96px; } }
    .counter-number.grande.texto-corporal { font-size: 32px; line-height: 1.2; margin: 18px 0 18px; letter-spacing: -0.02em; }
    .stepper-controls { display: flex; gap: 8px; width: 100%; justify-content: center; }
    .btn-stepper { width: 48px; height: 48px; min-width: 48px; min-height: 48px; background-color: var(--superficie, #F3F0E8); border: none; border-radius: 999px; color: var(--texto, #17171A); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform 120ms ease; }
    .btn-stepper:active { transform: scale(0.93); }

    /* Selector de esfuerzo en 5 píldoras (>= 48px ALTO-03 y grilla 360px MEDIO-04) */
    .effort-section { display: flex; flex-direction: column; gap: 8px; margin-bottom: 4px; }
    .effort-label { font-size: 13px; font-weight: 500; color: var(--tinta-suave, #5D5951); padding-left: 4px; }
    .effort-pills-row { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; width: 100%; }
    .effort-pill { min-height: 48px; height: 48px; padding: 0 6px; background-color: var(--superficie2, #E9E4D8); border-radius: 999px; border: none; color: var(--texto, #17171A); font-family: 'Bricolage Grotesque', sans-serif; font-size: 13px; font-weight: 600; white-space: nowrap; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background-color 160ms, color 160ms, transform 120ms; }
    .effort-pill:active { transform: scale(0.95); }
    .effort-pill.selected { background-color: var(--tinta, #17171A); color: var(--papel, #F3F0E8); }
    .effort-pill.fallo-pill { color: #A02B14; }
    .effort-pill.fallo-pill.selected { background-color: #E2553A; color: var(--papel, #F3F0E8); }

    /* Comparativa previa */
    .previous-record-text { text-align: center; font-size: 14px; color: var(--tinta-suave, #5D5951); margin: 6px 0 10px; font-weight: 400; }

    /* Botón Canónico Lima Píldora */
    .btn-primary-lima { width: 100%; height: 60px; background-color: var(--lima, #C8F03C); border: none; border-radius: 999px; color: var(--tinta, #17171A); font-family: 'Bricolage Grotesque', sans-serif; font-size: 17px; font-weight: 600; display: flex; align-items: center; justify-content: space-between; padding: 0 10px 0 26px; cursor: pointer; text-decoration: none; transition: transform 160ms cubic-bezier(.2,.8,.2,1); }
    .btn-primary-lima:active { transform: scale(0.97); }
    .btn-icon-bubble { width: 44px; height: 44px; background-color: var(--tinta, #17171A); border-radius: 999px; display: flex; align-items: center; justify-content: center; color: var(--lima, #C8F03C); flex-shrink: 0; }

    /* Temporizador Descanso estilo Pantalla 3 (modo oscuro / fondo tinta, paleta unificada BAJO-03) */
    .screen-descanso-content.oscuro { background-color: var(--tinta, #17171A); color: var(--papel, #F3F0E8); border-radius: 28px; padding: 24px 20px; display: flex; flex-direction: column; align-items: center; text-align: center; box-shadow: 0 10px 30px rgba(23,23,26,.18); }
    .descanso-header-box { display: flex; flex-direction: column; align-items: center; gap: 6px; }
    .descanso-header-box .micro-label { color: var(--lima, #C8F03C); font-size: 12px; font-weight: 600; }
    .descanso-quote { font-family: 'Instrument Serif', Georgia, serif; font-size: 26px; color: var(--papel, #F3F0E8); font-weight: 400; }
    .descanso-quote em { font-style: italic; }
    .timer-ring-container { position: relative; width: 240px; height: 240px; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 12px 0; }
    .timer-ring-svg { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
    .timer-center-text { position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; }
    .timer-countdown.grande { font-family: 'Bricolage Grotesque', sans-serif; font-size: 76px; font-weight: 800; color: var(--papel, #F3F0E8); line-height: 0.95; font-variant-numeric: tabular-nums; letter-spacing: -0.03em; }
    .timer-caption { font-size: 13px; color: var(--papel-2, #E9E4D8); opacity: 0.72; margin-top: 6px; font-weight: 500; }
    .next-set-card { width: 100%; background-color: var(--tinta-tarjeta, #232328); border-radius: 28px; padding: 16px 20px; text-align: left; display: flex; flex-direction: column; gap: 4px; margin-bottom: 16px; }
    .next-set-title { font-size: 15px; font-weight: 600; color: var(--papel, #F3F0E8); }
    .next-set-sub { font-size: 13px; color: var(--papel-2, #E9E4D8); opacity: 0.75; line-height: 1.4; }
    .descanso-actions-row { width: 100%; display: flex; gap: 12px; }
    .btn-timer-secondary { flex: 1; height: 56px; background-color: var(--tinta-tarjeta, #232328); border: none; border-radius: 999px; color: var(--papel, #F3F0E8); font-family: 'Bricolage Grotesque', sans-serif; font-size: 16px; font-weight: 600; cursor: pointer; transition: transform 140ms ease; }
    .btn-timer-secondary:active { transform: scale(0.97); }
    .btn-timer-skip { flex: 1; height: 56px; background-color: var(--lima, #C8F03C); border: none; border-radius: 999px; color: var(--tinta, #17171A); font-family: 'Bricolage Grotesque', sans-serif; font-size: 16px; font-weight: 600; cursor: pointer; transition: transform 140ms ease; }
    .btn-timer-skip:active { transform: scale(0.97); }

    /* Barra flotante global de descanso en otras pantallas (C-01) */
    .reg-timer-flotante { position: fixed; left: 50%; transform: translateX(-50%); bottom: 92px; width: calc(100% - 32px); max-width: 480px; background-color: var(--tinta, #17171A); color: var(--papel, #F3F0E8); border-radius: 999px; padding: 8px 10px 8px 16px; display: flex; align-items: center; justify-content: space-between; gap: 10px; box-shadow: 0 10px 30px rgba(23,23,26,.18); z-index: 450; }
    .reg-timer-flotante-info { display: flex; align-items: center; gap: 10px; background: none; border: none; color: inherit; cursor: pointer; padding: 0; text-align: left; min-width: 0; flex: 1; min-height: 44px; }
    .reg-timer-flotante-icono { color: var(--lima, #C8F03C); display: inline-flex; align-items: center; flex-shrink: 0; }
    .reg-timer-flotante-tiempo { font-family: 'Bricolage Grotesque', sans-serif; font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--lima, #C8F03C); flex-shrink: 0; }
    .reg-timer-flotante-ej { font-size: 13px; font-weight: 500; color: var(--papel, #F3F0E8); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .reg-timer-flotante-acciones { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
    .reg-timer-flotante-btn { min-height: 40px; padding: 0 14px; border-radius: 999px; border: none; background-color: var(--tinta-tarjeta, #232328); color: var(--papel, #F3F0E8); font-family: 'Bricolage Grotesque', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; }
    .reg-timer-flotante-btn.lima { background-color: var(--lima, #C8F03C); color: var(--tinta, #17171A); }

    /* Chips y ajustes de Modo Serie */
    .reg-chips-row { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-top: 8px; }
    .reg-chip-toggle { border-radius: 999px; border: none; padding: 8px 14px; min-height: 36px; font-size: 12px; font-weight: 600; background-color: var(--superficie, #F3F0E8); color: var(--texto, #17171A); cursor: pointer; }
    .reg-chip-toggle.activo { background-color: var(--tinta, #17171A); color: var(--papel, #F3F0E8); }
    .reg-campos-extra { background-color: var(--superficie2, #E9E4D8); border-radius: 28px; padding: 14px 18px; margin-bottom: 6px; }

    /* Modo Texto (radio canónico 28px MEDIO-02) */
    .reg-caja-texto { background-color: var(--superficie2, #E9E4D8); border-radius: 28px; padding: 18px; display: flex; flex-direction: column; gap: 10px; }
    .reg-textarea { width: 100%; min-height: 88px; resize: vertical; border-radius: 28px; border: none; background-color: var(--superficie, #F3F0E8); color: var(--texto, #17171A); padding: 16px 20px; font-family: inherit; font-size: 15px; outline: none; }
    .reg-nota-privacidad-voz { font-size: 12px; line-height: 1.4; margin: 0; color: var(--tinta-suave, #5D5951); }
    .reg-item-previa { background-color: var(--superficie2, #E9E4D8); border-radius: 28px; padding: 18px; margin-bottom: 12px; }

    /* Lista de series (sin bordes de 1px BAJO-01 y botones >= 48px ALTO-03) */
    .reg-tarjeta-ejercicio { background-color: var(--superficie2, #E9E4D8); border-radius: 28px; padding: 18px; margin-bottom: 12px; }
    .reg-item-serie { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; margin-bottom: 6px; border-radius: 28px; background-color: var(--superficie, #F3F0E8); }
    .reg-item-serie:last-child { margin-bottom: 0; }
    .reg-acciones-serie { display: flex; gap: 6px; }
    .reg-btn-icono { min-width: 48px; min-height: 48px; width: 48px; height: 48px; padding: 12px; border-radius: 999px; border: none; background-color: var(--superficie2, #E9E4D8); color: var(--texto, #17171A); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }

    /* Utilidades */
    .reg-espacio-entre { justify-content: space-between; }
    .reg-alinear-centro { align-items: center; }
    .reg-mb-half { margin-bottom: 6px; }
    .reg-mt-half { margin-top: 6px; }
    .reg-mr-half { margin-right: 6px; }
    .reg-ml-half { margin-left: 6px; }
    .reg-ml-1 { margin-left: 12px; }
    .reg-texto-chico { font-size: 12px; }
    .reg-input-num { max-width: 80px; text-align: center; }
  `));
}

/**
 * Actualiza y re-renderiza toda la interfaz de la pantalla Registrar.
 */
async function actualizarUI() {
  if (!contenedorRaiz) return;
  contenedorRaiz.innerHTML = '';
  const pantalla = h('div', { class: 'pantalla reg-pantalla' });

  pantalla.appendChild(renderBarraFecha());

  const timer = renderWidgetTemporizador();
  if (timer) {
    pantalla.appendChild(timer);
    removerBarraFlotante();
  }

  pantalla.appendChild(renderSelectorModo());

  if (modoActivo === 'serie') {
    pantalla.appendChild(await renderModoSerie());
  } else {
    pantalla.appendChild(renderModoTexto());
  }

  pantalla.appendChild(await renderListaSeries());
  contenedorRaiz.appendChild(pantalla);
}

/**
 * Monta la pantalla Registrar en el contenedor provisto.
 * @param {HTMLElement} contenedor
 * @param {Array<string>} [params=[]]
 */
export async function montar(contenedor, params = []) {
  contenedorRaiz = contenedor;
  inyectarEstilos();
  registrarListenersGlobalesTimer();

  try {
    listaEjercicios = await ejercicios();
    if (!Array.isArray(listaEjercicios)) listaEjercicios = [];
  } catch (e) {
    listaEjercicios = [];
  }

  let idElegido = estadoSerie.ejercicioId;
  let debeRecargarEstado = false;

  if (params?.[0] && listaEjercicios.some(e => e.id === params[0])) {
    if (estadoSerie.ejercicioId !== params[0]) {
      debeRecargarEstado = true;
    }
    idElegido = params[0];
    modoActivo = 'serie';
  } else if (!idElegido) {
    debeRecargarEstado = true;
    // Sin ejercicio elegido: el primero de la rutina de hoy al que le falten series (fix 7-nov).
    try {
      const { rutina } = await import('./datos.js');
      const r = await rutina();
      const dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
      const delDia = r?.dias?.[dias[new Date().getDay()]]?.ejercicios || [];
      const hoy = await filtrar('series', s => s.fecha === hoyISO());
      const pendiente = delDia.find(x => hoy.filter(s => s.ejercicioId === x.id).length < (x.series || 3)) || delDia[0];
      if (pendiente && listaEjercicios.some(e => e.id === pendiente.id)) {
        idElegido = pendiente.id;
      }
    } catch (e) { /* si falla, queda el primero de la lista */ }

    if (!idElegido && listaEjercicios.length > 0) {
      idElegido = listaEjercicios[0].id;
    }
  }

  if (debeRecargarEstado && idElegido) {
    await cargarEstadoParaEjercicio(idElegido, fechaSeleccionada);
  }

  if (leerDatosTemporizador()) {
    iniciarLoopTemporizador();
  }
  await actualizarUI();
}

/**
 * Desmonta la pantalla Registrar y libera recursos locales de la vista,
 * manteniendo vivo el temporizador de descanso en segundo plano y su barra flotante (C-01).
 */
export function desmontar() {
  if (reconocimientoVoz && escuchandoVoz) {
    try { reconocimientoVoz.stop(); } catch (e) {}
    escuchandoVoz = false;
  }
  contenedorRaiz = null;

  const estado = leerDatosTemporizador();
  if (estado && estado.restante > 0) {
    sincronizarBarraFlotante(estado);
    if (!intervaloTimer) {
      iniciarLoopTemporizador();
    }
  } else if (intervaloTimer) {
    clearInterval(intervaloTimer);
    intervaloTimer = null;
  }
}

// Auto-inicialización pasiva si hay un descanso activo en localStorage al cargarse el módulo
if (typeof window !== 'undefined') {
  try {
    if (localStorage.getItem(STORAGE_TIMER_FIN) || localStorage.getItem(STORAGE_TIMER_INICIO)) {
      temporizadorActivo();
    }
  } catch (e) {}
}

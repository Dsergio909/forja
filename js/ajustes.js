/**
 * ajustes.js - Sección 9: Ajustes y Configuración de Forja (Dirección de Arte v2 «Revista de Sala»)
 *
 * Características v2 y Correcciones de Auditoría (Rondas 1 y 2):
 * - Titulares en Instrument Serif cursivo (emocionales, limpios, elegantes).
 * - Campos de formulario con fondo papel 2 (#E9E4D8) o papel (#F3F0E8) y radio estricto de 28px.
 * - Botones en píldora canónica (border-radius: 999px, min-height: 48px) con acento único Lima (#C8F03C).
 * - Cero emojis y cero backdrop-filter: iconos vectoriales limpios vía icono() de ./iconos.js y contraste accesible (#5D5951, #B83218).
 * - Seguridad PIN (Seguridad R1 Hallazgos 3 y 4):
 *   1. No exporta ni importa el hash/sal del PIN en copias de seguridad JSON.
 *   2. Exige ingresar el PIN actual para quitarlo o cambiarlo.
 *   3. Bloqueo temporal de 30 segundos tras 5 intentos fallidos consecutivos (persistido en localStorage).
 * - Importación unificada y deduplicación defensiva (logica_datos.md CRÍTICO-02, ALTO-05 y Seguridad R1 5):
 *   1. Control de tamaño máximo de archivo a 50 MB para prevenir DoS por memoria (seguridad_privacidad.md Hallazgo Nuevo 3).
 *   2. Deduplicación robusta de series y sesiones sin ID mediante Set de IDs asignados, impidiendo colapso de series idénticas (CRÍTICO-02).
 *   3. En fotos importadas, solo acepta esquemas data:image/ (bloquea URLs externas) y preserva Blobs locales existentes (CRÍTICO-01).
 *   4. Asigna IDs automáticos determinísticos a medidas, comidas, chat y cámara sin ID para que nunca sean descartadas (ALTO-01).
 * - Sincronización de modelos IA (CFG-01): importa WEBLLM_MODELO y WEBLLM_MODELO_RESPALDO desde ./config.js.
 * - Asistente inicial canónico con estilos garantizados y atajo «¿Ya tienes tu archivo de Forja? Cárgalo aquí».
 */

import { ajuste, ponerAjuste, guardar, todos, nuevoId, exportarTodo, importarTodo } from './db.js';
import { h, aviso, dialogo, confirmar, hoyISO } from './ui.js';
import { perfil as cargarPerfil, rutina as cargarRutina, rutinaBase, ejercicios as cargarEjercicios } from './datos.js';
import { grasaNavy } from './calculos.js';
import { WEBLLM_URL, WEBLLM_MODELO, WEBLLM_MODELO_RESPALDO } from './config.js';
import { descargarModelo, borrarModelo } from './coach.js';
import { icono } from './iconos.js';

const CLAVE_PIN_INTENTOS = 'forja_pin_intentos';
const CLAVE_PIN_BLOQUEO = 'forja_pin_bloqueo_hasta';
const MAX_INTENTOS_PIN = 5;
const SEGUNDOS_BLOQUEO_PIN = 30;
const TAMANO_MAX_BACKUP = 50 * 1024 * 1024; // 50 MB (Seguridad Hallazgo Nuevo 3)

let contenedorActual = null;
let perfilDatos = null;
let rutinaDatos = null;
let pinActual = null;
let iaAjustes = null;
let intentosFallidosMemoria = 0;
let bloqueadoHastaMemoria = 0;

/**
 * Monta la pantalla de ajustes
 */
export async function montar(contenedor, params = []) {
  contenedorActual = contenedor;
  await recargarDatos();
  await renderizar();
}

/**
 * Desmonta la pantalla
 */
export function desmontar() {
  contenedorActual = null;
}

/**
 * Helper resiliente para renderizar iconos SVG sin emojis
 * Invoca icono() de ./iconos.js con respaldo vectorial exacto de 1.75px stroke
 */
function iconoNodo(nombre, fallbackSvg = '') {
  try {
    if (typeof icono === 'function') {
      const nodo = icono(nombre);
      if (nodo instanceof Node) return nodo;
      if (typeof nodo === 'string' && nodo.trim().startsWith('<svg')) {
        const wrap = document.createElement('div');
        wrap.innerHTML = nodo.trim();
        if (wrap.firstElementChild) return wrap.firstElementChild;
      }
    }
  } catch (e) {
    // Si iconos.js no existe aún en el árbol de integración
  }

  if (fallbackSvg) {
    const wrap = document.createElement('div');
    wrap.innerHTML = fallbackSvg.trim();
    if (wrap.firstElementChild) return wrap.firstElementChild;
  }
  return document.createTextNode('');
}

// Iconos vectoriales canónicos Forja v2 (trazo 1.75px, sin emojis)
const ICONOS_SVGS = {
  perfil: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  calendario: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  candado: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  disco: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
  ia: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.04z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.04z"/></svg>',
  retroceso: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></svg>',
  descargar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  subir: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  cerrar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  alerta: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  basura: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
};

/**
 * Carga o refresca todos los ajustes en memoria (sincronizado con config.js - CFG-01)
 */
async function recargarDatos() {
  perfilDatos = await cargarPerfil();
  rutinaDatos = await cargarRutina();
  pinActual = await ajuste('pin', null);
  const modeloPrincipal = WEBLLM_MODELO || 'Qwen3.5-2B-q4f16_1-MLC';
  const modeloRespaldo = WEBLLM_MODELO_RESPALDO || 'Qwen3.5-0.8B-q4f16_1-MLC';
  iaAjustes = await ajuste('ia', { activa: false, modelo: modeloPrincipal });
  if (!iaAjustes || typeof iaAjustes !== 'object') {
    iaAjustes = { activa: false, modelo: modeloPrincipal };
  }
  if (iaAjustes.modelo !== modeloPrincipal && iaAjustes.modelo !== modeloRespaldo) {
    iaAjustes.modelo = modeloPrincipal;
  }
}

/**
 * Genera una sal criptográfica aleatoria en hexadecimal
 */
function generarSal() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Calcula el hash SHA-256 de una contraseña/PIN con sal
 */
async function hashSha256(texto, sal) {
  const enc = new TextEncoder();
  const data = enc.encode(sal + texto);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function leerEstadoBloqueoPin() {
  try {
    const intGuardados = Number(localStorage.getItem(CLAVE_PIN_INTENTOS) || 0);
    const bloqGuardado = Number(localStorage.getItem(CLAVE_PIN_BLOQUEO) || 0);
    intentosFallidosMemoria = Math.max(intentosFallidosMemoria, isNaN(intGuardados) ? 0 : intGuardados);
    bloqueadoHastaMemoria = Math.max(bloqueadoHastaMemoria, isNaN(bloqGuardado) ? 0 : bloqGuardado);
  } catch (_) {}
  return {
    intentos: intentosFallidosMemoria,
    bloqueadoHasta: bloqueadoHastaMemoria
  };
}

function guardarEstadoBloqueoPin(intentos, bloqueadoHasta) {
  intentosFallidosMemoria = intentos;
  bloqueadoHastaMemoria = bloqueadoHasta;
  try {
    localStorage.setItem(CLAVE_PIN_INTENTOS, String(intentos));
    localStorage.setItem(CLAVE_PIN_BLOQUEO, String(bloqueadoHasta));
  } catch (_) {}
}

/**
 * Estilos que necesitan el asistente y el PIN. Se cargan al abrirlos porque aparecen ANTES de la pantalla de
 * Ajustes (que es la que cargaba estas clases): sin esto los botones salían grises y los campos se desbordaban.
 */
function asegurarEstilosAsistente() {
  if (document.getElementById('forja-estilos-asistente')) return;
  document.head.appendChild(h('style', { id: 'forja-estilos-asistente' }, `
    .v2-asistente-overlay *, .v2-asistente-overlay *::before, .v2-asistente-overlay *::after { box-sizing: border-box; }
    .v2-asistente-overlay .v2-btn-pildora { min-height: 48px; border-radius: 999px; border: none; padding: 0 22px;
      font-family: inherit; font-size: 15px; font-weight: 600; display: inline-flex; align-items: center;
      justify-content: center; gap: 8px; cursor: pointer; background-color: #E9E4D8; color: #17171A; }
    .v2-asistente-overlay .v2-btn-pildora:active { transform: scale(0.97); }
    .v2-asistente-overlay .v2-btn-lima { background-color: #C8F03C; color: #17171A; font-size: 16px; min-height: 52px; }
    .v2-asistente-overlay .v2-input-redondo { background-color: #E9E4D8; color: #17171A; border: none; border-radius: 28px;
      padding: 14px 18px; font-family: inherit; font-size: 16px; outline: none; width: 100%; min-width: 0; }
    .v2-asistente-overlay .v2-input-redondo::placeholder { color: #6B675F; }
    .v2-asistente-overlay .v2-input-redondo:focus { box-shadow: 0 0 0 2px #17171A; }
    .v2-asistente-overlay label { display: block; margin-bottom: 6px; }
    .v2-asistente-overlay [style*="grid-template-columns"] > div { min-width: 0; }
    .v2-asistente-overlay .v2-enlace { background: none; border: none; padding: 8px 0; font: inherit; font-size: 14px;
      font-weight: 600; color: #17171A; text-decoration: underline; cursor: pointer; text-align: left; }
  `));
}

/**
 * CONTRATO: Asistente inicial de 3 pasos al abrir la app por primera vez
 * Adaptado a la estética Forja v2 (titulares serif, campos papel 2 y radio 28, botones píldora, sin backdrop-filter)
 * Mantiene intacto el botón canónico «¿Ya tienes tu archivo de Forja? Cárgalo aquí»
 * @returns {Promise<boolean>}
 */
export function asistenteInicial() {
  asegurarEstilosAsistente();
  return new Promise((resolve) => {
    let pasoActual = 1;
    // Versión pública: campos vacíos (cada persona escribe lo suyo). Sergio usa su archivo personal (botón de abajo).
    const datosAsistente = {
      nombre: '',
      metaNombre: '',
      metaFecha: '',
      metaMes: '',
      estaturaCm: '',
      peso: '',
      cintura: '',
      cuello: '',
      kcal: 2200,
      proteina: 120,
      aguaVasos: 10,
      pasos: 8000
    };

    const modal = h('div', {
      class: 'v2-asistente-overlay',
      style: 'position: fixed; inset: 0; background: rgba(23, 23, 26, 0.76); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 16px;'
    });

    function actualizarPaso() {
      modal.innerHTML = '';
      const contenedorPaso = h('div', {
        style: 'width: 100%; max-width: 440px; background-color: #F3F0E8; border-radius: 28px; padding: 28px; display: flex; flex-direction: column; gap: 16px; box-shadow: 0 10px 30px rgba(23,23,26,.22); font-family: "Bricolage Grotesque", sans-serif; color: #17171A;'
      });

      if (pasoActual === 1) {
        // Paso 1: Identidad y Meta
        const inputNombre = h('input', {
          class: 'v2-input-redondo',
          type: 'text',
          value: datosAsistente.nombre,
          placeholder: 'Tu nombre'
        });
        const inputMetaNom = h('input', {
          class: 'v2-input-redondo',
          type: 'text',
          value: datosAsistente.metaNombre,
          placeholder: 'Ej.: verme mejor para mi grado'
        });
        const inputMetaFec = h('input', {
          class: 'v2-input-redondo',
          type: 'date',
          value: datosAsistente.metaFecha
        });

        contenedorPaso.append(
          h('div', { style: 'font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 700; color: #5D5951;' }, 'PASO 1 DE 3 · BIENVENIDO'),
          h('h2', { style: 'font-family: "Instrument Serif", Georgia, serif; font-size: 32px; font-weight: 400; line-height: 1.1;' }, 'Comencemos tu ', h('em', {}, 'Forja')),
          h('p', { style: 'font-size: 14px; color: #5D5951; line-height: 1.4;' }, 'Tu diario personal de entrenamiento y nutrición 100% privado en tu teléfono.'),
          h('label', { style: 'font-size: 13px; font-weight: 600; color: #5D5951; margin-top: 4px;' }, '¿Cómo te llamas?'),
          inputNombre,
          h('label', { style: 'font-size: 13px; font-weight: 600; color: #5D5951; margin-top: 4px;' }, 'Meta principal:'),
          inputMetaNom,
          h('label', { style: 'font-size: 13px; font-weight: 600; color: #5D5951; margin-top: 4px;' }, 'Fecha objetivo:'),
          inputMetaFec,
          h('div', { style: 'display: flex; justify-content: flex-end; margin-top: 10px;' },
            h('button', {
              class: 'v2-btn-pildora v2-btn-lima',
              style: 'width: auto; min-height: 48px; padding: 0 28px;',
              on: {
                click: () => {
                  datosAsistente.nombre = inputNombre.value.trim() || '';
                  datosAsistente.metaNombre = inputMetaNom.value.trim() || 'Mi Meta';
                  datosAsistente.metaFecha = inputMetaFec.value;
                  pasoActual = 2;
                  actualizarPaso();
                }
              }
            }, 'Siguiente')
          ),
          // Atajo para quien ya tiene su archivo de Forja (respaldo o archivo personal): todo queda listo sin escribir.
          (() => {
            const entrada = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
            entrada.addEventListener('change', async () => {
              const archivo = entrada.files && entrada.files[0];
              if (!archivo) return;
              try {
                if (archivo.size > TAMANO_MAX_BACKUP) throw new Error('El archivo supera el límite permitido (máx. 50 MB).');
                const obj = JSON.parse(await archivo.text());
                if (!obj || typeof obj !== 'object' || !obj.datos) throw new Error('No parece un archivo de Forja.');
                const r = await importarTodo(obj);
                await ponerAjuste('primeraVez', false);
                modal.remove();
                aviso(`Listo: se cargaron ${r.agregados} datos de tu archivo.`, 'ok');
                resolve(true);
              } catch (err) {
                aviso('No se pudo cargar el archivo: ' + (err && err.message ? err.message : err), 'error');
              }
            });
            return h('div', { style: 'border-top: 1px solid rgba(23,23,26,.10); padding-top: 12px; margin-top: 4px;' },
              h('button', { class: 'v2-enlace', type: 'button', on: { click: () => entrada.click() } },
                '¿Ya tienes tu archivo de Forja? Cárgalo aquí'),
              entrada);
          })()
        );
      } else if (pasoActual === 2) {
        // Paso 2: Medidas corporales
        const inEstatura = h('input', { class: 'v2-input-redondo', type: 'number', value: datosAsistente.estaturaCm });
        const inPeso = h('input', { class: 'v2-input-redondo', type: 'number', step: '0.1', value: datosAsistente.peso });
        const inCintura = h('input', { class: 'v2-input-redondo', type: 'number', step: '0.5', value: datosAsistente.cintura });
        const inCuello = h('input', { class: 'v2-input-redondo', type: 'number', step: '0.5', value: datosAsistente.cuello });

        contenedorPaso.append(
          h('div', { style: 'font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 700; color: #5D5951;' }, 'PASO 2 DE 3 · CUERPO'),
          h('h2', { style: 'font-family: "Instrument Serif", Georgia, serif; font-size: 32px; font-weight: 400; line-height: 1.1;' }, 'Tu punto de ', h('em', {}, 'partida')),
          h('p', { style: 'font-size: 14px; color: #5D5951; line-height: 1.4;' }, 'Tus medidas se almacenan únicamente en la memoria local de este dispositivo.'),
          h('div', { style: 'display: grid; grid-template-columns: 1fr 1fr; gap: 10px;' },
            h('div', {}, h('label', { style: 'font-size: 12px; font-weight: 600; color: #5D5951;' }, 'Estatura (cm)'), inEstatura),
            h('div', {}, h('label', { style: 'font-size: 12px; font-weight: 600; color: #5D5951;' }, 'Peso (kg)'), inPeso),
            h('div', {}, h('label', { style: 'font-size: 12px; font-weight: 600; color: #5D5951;' }, 'Cintura (cm)'), inCintura),
            h('div', {}, h('label', { style: 'font-size: 12px; font-weight: 600; color: #5D5951;' }, 'Cuello (cm)'), inCuello)
          ),
          h('div', { style: 'display: flex; justify-content: space-between; margin-top: 10px;' },
            h('button', {
              class: 'v2-btn-pildora',
              style: 'background-color: #E9E4D8; min-height: 48px;',
              on: { click: () => { pasoActual = 1; actualizarPaso(); } }
            }, 'Atrás'),
            h('button', {
              class: 'v2-btn-pildora v2-btn-lima',
              style: 'width: auto; min-height: 48px; padding: 0 28px;',
              on: {
                click: () => {
                  datosAsistente.estaturaCm = Number(inEstatura.value) || 175;
                  datosAsistente.peso = Number(inPeso.value) || 70;
                  datosAsistente.cintura = Number(inCintura.value) || null;
                  datosAsistente.cuello = Number(inCuello.value) || null;
                  pasoActual = 3;
                  actualizarPaso();
                }
              }
            }, 'Siguiente')
          )
        );
      } else {
        // Paso 3: Metas diarias
        const inKcal = h('input', { class: 'v2-input-redondo', type: 'number', value: datosAsistente.kcal });
        const inProt = h('input', { class: 'v2-input-redondo', type: 'number', value: datosAsistente.proteina });
        const inAgua = h('input', { class: 'v2-input-redondo', type: 'number', value: datosAsistente.aguaVasos });
        const inPasos = h('input', { class: 'v2-input-redondo', type: 'number', value: datosAsistente.pasos });

        contenedorPaso.append(
          h('div', { style: 'font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 700; color: #5D5951;' }, 'PASO 3 DE 3 · OBJETIVOS'),
          h('h2', { style: 'font-family: "Instrument Serif", Georgia, serif; font-size: 32px; font-weight: 400; line-height: 1.1;' }, 'Tus metas ', h('em', {}, 'diarias')),
          h('p', { style: 'font-size: 14px; color: #5D5951; line-height: 1.4;' }, 'Podrás modificar estas metas cuando quieras desde Ajustes.'),
          h('div', { style: 'display: grid; grid-template-columns: 1fr 1fr; gap: 10px;' },
            h('div', {}, h('label', { style: 'font-size: 12px; font-weight: 600; color: #5D5951;' }, 'Calorías (kcal)'), inKcal),
            h('div', {}, h('label', { style: 'font-size: 12px; font-weight: 600; color: #5D5951;' }, 'Proteína (g)'), inProt),
            h('div', {}, h('label', { style: 'font-size: 12px; font-weight: 600; color: #5D5951;' }, 'Agua (vasos)'), inAgua),
            h('div', {}, h('label', { style: 'font-size: 12px; font-weight: 600; color: #5D5951;' }, 'Pasos diarios'), inPasos)
          ),
          h('div', { style: 'display: flex; justify-content: space-between; margin-top: 10px;' },
            h('button', {
              class: 'v2-btn-pildora',
              style: 'background-color: #E9E4D8; min-height: 48px;',
              on: { click: () => { pasoActual = 2; actualizarPaso(); } }
            }, 'Atrás'),
            h('button', {
              class: 'v2-btn-pildora v2-btn-lima',
              style: 'width: auto; min-height: 48px; padding: 0 28px;',
              on: {
                click: async () => {
                  datosAsistente.kcal = Number(inKcal.value) || 2200;
                  datosAsistente.proteina = Number(inProt.value) || 128;
                  datosAsistente.aguaVasos = Number(inAgua.value) || 10;
                  datosAsistente.pasos = Number(inPasos.value) || 9000;

                  // Guardar perfil inicial
                  await ponerAjuste('perfil', {
                    nombre: datosAsistente.nombre,
                    estaturaCm: datosAsistente.estaturaCm,
                    metaNombre: datosAsistente.metaNombre,
                    metaFecha: datosAsistente.metaFecha,
                    metaMes: datosAsistente.metaMes,
                    kcal: datosAsistente.kcal,
                    proteina: datosAsistente.proteina,
                    aguaVasos: datosAsistente.aguaVasos,
                    pasos: datosAsistente.pasos
                  });

                  // Guardar primera medida en IndexedDB
                  const gNavy = (datosAsistente.cintura && datosAsistente.cuello && datosAsistente.estaturaCm)
                    ? grasaNavy(datosAsistente.cintura, datosAsistente.cuello, datosAsistente.estaturaCm)
                    : null;

                  await guardar('medidas', {
                    id: nuevoId(),
                    fecha: hoyISO(),
                    peso: datosAsistente.peso,
                    cintura: datosAsistente.cintura,
                    cuello: datosAsistente.cuello,
                    pecho: null,
                    brazo: null,
                    hombros: null,
                    cadera: null,
                    grasaNavy: gNavy,
                    origen: 'manual'
                  });

                  await ponerAjuste('primeraVez', false);
                  modal.remove();
                  aviso('¡Configuración inicial completada! Bienvenido a Forja.', 'ok');
                  resolve(true);
                }
              }
            }, 'Comenzar en Forja')
          )
        );
      }

      modal.appendChild(contenedorPaso);
    }

    actualizarPaso();
    document.body.appendChild(modal);
  });
}

/**
 * CONTRATO: Pide el PIN si está configurado. Retorna Promise<boolean>
 * Incluye límite de 5 intentos fallidos con espera de 30 segundos (Seguridad Hallazgo 4).
 * @param {Object} opciones - Opciones internas ({ cancelar: boolean, subtitulo: string })
 */
export async function pedirPin(opciones = {}) {
  asegurarEstilosAsistente();
  const pinGuardado = await ajuste('pin', null);
  if (!pinGuardado || !pinGuardado.hash) return true;

  return new Promise((resolve) => {
    let pinEntrada = '';
    let timerBloqueo = null;
    const botonesTeclado = [];

    const overlay = h('div', {
      class: 'v2-pin-overlay',
      style: 'position: fixed; inset: 0; background-color: #F3F0E8; color: #17171A; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 10000; padding: 24px; font-family: "Bricolage Grotesque", sans-serif;'
    });

    const visor = h('div', {
      style: 'display: flex; gap: 16px; margin: 28px 0 20px;'
    }, ...[0, 1, 2, 3].map(i => h('div', {
      id: `v2-pin-dot-${i}`,
      style: 'width: 20px; height: 20px; border-radius: 999px; border: 2px solid #17171A; background-color: transparent; transition: background-color 160ms ease;'
    })));

    const mensajeError = h('div', {
      style: 'min-height: 24px; color: #A02B14; font-size: 14px; font-weight: 600; text-align: center; font-variant-numeric: tabular-nums;'
    });

    function establecerEstadoTeclado(deshabilitado) {
      botonesTeclado.forEach(btn => {
        btn.disabled = deshabilitado;
        btn.style.opacity = deshabilitado ? '0.45' : '1';
        btn.style.cursor = deshabilitado ? 'not-allowed' : 'pointer';
      });
    }

    function iniciarCuentaRegresivaBloqueo(hastaMs) {
      if (timerBloqueo) clearInterval(timerBloqueo);
      pinEntrada = '';
      actualizarVisor();
      establecerEstadoTeclado(true);

      const tick = () => {
        const restantes = Math.ceil((hastaMs - Date.now()) / 1000);
        if (restantes <= 0) {
          clearInterval(timerBloqueo);
          timerBloqueo = null;
          guardarEstadoBloqueoPin(0, 0);
          establecerEstadoTeclado(false);
          mensajeError.textContent = '';
        } else {
          mensajeError.textContent = `Demasiados intentos fallidos. Espera ${restantes} s.`;
        }
      };

      tick();
      timerBloqueo = setInterval(tick, 500);
    }

    async function teclear(num) {
      const { bloqueadoHasta } = leerEstadoBloqueoPin();
      if (Date.now() < bloqueadoHasta) {
        iniciarCuentaRegresivaBloqueo(bloqueadoHasta);
        return;
      }

      if (pinEntrada.length < 4) {
        pinEntrada += num;
        actualizarVisor();
      }
      if (pinEntrada.length === 4) {
        const intentoActual = pinEntrada;
        pinEntrada = '';
        const hashIntento = await hashSha256(intentoActual, pinGuardado.sal);
        if (hashIntento === pinGuardado.hash) {
          if (timerBloqueo) clearInterval(timerBloqueo);
          guardarEstadoBloqueoPin(0, 0);
          overlay.remove();
          resolve(true);
        } else {
          const estadoPrevio = leerEstadoBloqueoPin();
          const nuevosIntentos = estadoPrevio.intentos + 1;

          if (nuevosIntentos >= MAX_INTENTOS_PIN) {
            const hasta = Date.now() + SEGUNDOS_BLOQUEO_PIN * 1000;
            guardarEstadoBloqueoPin(0, hasta);
            iniciarCuentaRegresivaBloqueo(hasta);
          } else {
            guardarEstadoBloqueoPin(nuevosIntentos, 0);
            mensajeError.textContent = `PIN incorrecto (${nuevosIntentos}/${MAX_INTENTOS_PIN}). Intenta de nuevo.`;
            setTimeout(() => {
              actualizarVisor();
              if (!timerBloqueo) mensajeError.textContent = '';
            }, 900);
          }
        }
      }
    }

    function borrarDigito() {
      const { bloqueadoHasta } = leerEstadoBloqueoPin();
      if (Date.now() < bloqueadoHasta) return;
      if (pinEntrada.length > 0) {
        pinEntrada = pinEntrada.slice(0, -1);
        actualizarVisor();
      }
    }

    function actualizarVisor() {
      for (let i = 0; i < 4; i++) {
        const dot = overlay.querySelector(`#v2-pin-dot-${i}`);
        if (dot) {
          dot.style.backgroundColor = i < pinEntrada.length ? '#C8F03C' : 'transparent';
        }
      }
    }

    const crearBotonTecla = (contenido, accion, titulo = '') => {
      const btn = h('button', {
        type: 'button',
        class: 'v2-btn-pildora',
        title: titulo,
        style: 'min-height: 60px; height: 60px; font-size: 24px; font-weight: 700; background-color: #E9E4D8; color: #17171A; border-radius: 999px; border: none;',
        on: { click: accion }
      }, contenido);
      botonesTeclado.push(btn);
      return btn;
    };

    const tecladoGrid = h('div', {
      style: 'display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; width: 100%; max-width: 280px; margin-top: 12px;'
    },
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => crearBotonTecla(n.toString(), () => teclear(n.toString()))),
      h('div', {}),
      crearBotonTecla('0', () => teclear('0')),
      crearBotonTecla(iconoNodo('retroceso', ICONOS_SVGS.retroceso), borrarDigito, 'Borrar')
    );

    const btnCancelar = opciones && opciones.cancelar
      ? h('button', {
          type: 'button',
          class: 'v2-btn-pildora',
          style: 'margin-top: 18px; min-height: 48px; height: 48px; padding: 0 24px; background-color: #E9E4D8; color: #17171A; border-radius: 999px; border: none; font-weight: 600; cursor: pointer;',
          on: {
            click: () => {
              if (timerBloqueo) clearInterval(timerBloqueo);
              overlay.remove();
              resolve(false);
            }
          }
        }, 'Cancelar')
      : null;

    overlay.append(
      h('div', { style: 'margin-bottom: 8px;' }, iconoNodo('candado', ICONOS_SVGS.candado)),
      h('h2', { style: 'font-family: "Instrument Serif", Georgia, serif; font-size: 34px; font-weight: 400; text-align: center;' },
        opciones && opciones.subtitulo ? 'Verifica tu ' : 'Ingresa tu ',
        h('em', {}, 'PIN')
      ),
      h('p', { style: 'font-size: 14px; color: #5D5951; text-align: center;' },
        (opciones && opciones.subtitulo) || 'Acceso seguro a tu diario de entrenamiento'
      ),
      visor,
      mensajeError,
      tecladoGrid,
      btnCancelar
    );

    const estadoInicial = leerEstadoBloqueoPin();
    if (Date.now() < estadoInicial.bloqueadoHasta) {
      iniciarCuentaRegresivaBloqueo(estadoInicial.bloqueadoHasta);
    }

    document.body.appendChild(overlay);
  });
}

/**
 * Renderizado de la pantalla completa de Ajustes con Dirección de Arte Forja v2
 */
async function renderizar() {
  if (!contenedorActual) return;
  contenedorActual.innerHTML = '';

  const estiloV2 = h('style', {}, `
    .forja-ajustes-v2 {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 8px 16px 88px;
      background-color: #F3F0E8;
      color: #17171A;
      font-family: 'Bricolage Grotesque', system-ui, sans-serif;
    }
    .v2-tarjeta {
      background-color: #E9E4D8;
      border-radius: 28px;
      padding: 24px;
      border: none;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .v2-serif-title {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 26px;
      font-weight: 400;
      color: #17171A;
      letter-spacing: -0.01em;
      line-height: 1.1;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .v2-serif-title em {
      font-style: italic;
    }
    .v2-subtitulo-card {
      font-size: 13px;
      font-weight: 600;
      color: #5D5951;
      text-transform: none;
      letter-spacing: normal;
      line-height: 1.2;
    }
    .v2-btn-pildora {
      min-height: 48px;
      height: 48px;
      border-radius: 999px;
      border: none;
      padding: 0 20px;
      font-family: inherit;
      font-size: 15px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      cursor: pointer;
      background-color: #F3F0E8;
      color: #17171A;
      text-decoration: none;
      transition: transform 140ms ease, background-color 140ms ease;
    }
    .v2-btn-pildora:active {
      transform: scale(0.97);
    }
    .v2-btn-lima {
      background-color: #C8F03C;
      color: #17171A;
      font-size: 16px;
      font-weight: 600;
      min-height: 52px;
      height: 52px;
      width: 100%;
    }
    .v2-btn-peligro {
      background-color: #B83218;
      color: #FFFFFF;
    }
    .v2-input-redondo {
      background-color: #F3F0E8;
      color: #17171A;
      border: none;
      border-radius: 28px;
      padding: 14px 18px;
      font-family: inherit;
      font-size: 15px;
      outline: none;
      width: 100%;
      box-sizing: border-box;
      transition: box-shadow 160ms ease;
    }
    .v2-input-redondo:focus {
      box-shadow: 0 0 0 2px #17171A;
    }
    .v2-barra-track {
      width: 100%;
      height: 8px;
      background-color: rgba(23, 23, 26, 0.08);
      border-radius: 999px;
      overflow: hidden;
    }
    .v2-barra-lima {
      height: 100%;
      background-color: #C8F03C;
      border-radius: 999px;
      transition: width 240ms ease;
    }
  `);

  const seccionPerfil = renderizarSeccionPerfil();
  const seccionRutina = renderizarSeccionRutina();
  const seccionSeguridad = renderizarSeccionSeguridad();
  const seccionDatos = renderizarSeccionDatos();
  const seccionIA = renderizarSeccionIA();

  const vista = h('div', { class: 'forja-ajustes-v2' },
    estiloV2,
    h('div', { style: 'padding: 8px 4px 0;' },
      h('h1', { style: 'font-family: "Instrument Serif", Georgia, serif; font-size: 36px; font-weight: 400; color: #17171A;' },
        'Ajustes de ', h('em', {}, 'Forja')
      ),
      h('p', { style: 'font-size: 14px; color: #5D5951; margin-top: 4px;' },
        'Configuración personal, metas físicas y seguridad local.'
      )
    ),
    seccionPerfil,
    seccionRutina,
    seccionSeguridad,
    seccionDatos,
    seccionIA
  );

  contenedorActual.appendChild(vista);
}

/**
 * 1. Sección Perfil y Metas
 */
function renderizarSeccionPerfil() {
  const p = perfilDatos || {};
  const inNombre = h('input', { class: 'v2-input-redondo', type: 'text', value: p.nombre || '' });
  const inEstatura = h('input', { class: 'v2-input-redondo', type: 'number', value: p.estaturaCm || '' });
  const inMetaNom = h('input', { class: 'v2-input-redondo', type: 'text', value: p.metaNombre || '' });
  const inMetaFec = h('input', { class: 'v2-input-redondo', type: 'date', value: p.metaFecha || '' });
  const inMetaMes = h('input', { class: 'v2-input-redondo', type: 'text', value: p.metaMes || '' });

  const inKcal = h('input', { class: 'v2-input-redondo', type: 'number', value: p.kcal || 2200 });
  const inProt = h('input', { class: 'v2-input-redondo', type: 'number', value: p.proteina || 128 });
  const inAgua = h('input', { class: 'v2-input-redondo', type: 'number', value: p.aguaVasos || 10 });
  const inPasos = h('input', { class: 'v2-input-redondo', type: 'number', value: p.pasos || 9000 });

  return h('div', { class: 'v2-tarjeta' },
    h('h2', { class: 'v2-serif-title' },
      iconoNodo('perfil', ICONOS_SVGS.perfil),
      'Perfil y ', h('em', {}, 'metas')
    ),
    h('div', { style: 'display: grid; grid-template-columns: 1fr 1fr; gap: 10px;' },
      h('div', {}, h('label', { style: 'font-size: 12px; font-weight: 600; color: #5D5951; display: block; margin-bottom: 4px;' }, 'Nombre'), inNombre),
      h('div', {}, h('label', { style: 'font-size: 12px; font-weight: 600; color: #5D5951; display: block; margin-bottom: 4px;' }, 'Estatura (cm)'), inEstatura),
      h('div', {}, h('label', { style: 'font-size: 12px; font-weight: 600; color: #5D5951; display: block; margin-bottom: 4px;' }, 'Meta Principal'), inMetaNom),
      h('div', {}, h('label', { style: 'font-size: 12px; font-weight: 600; color: #5D5951; display: block; margin-bottom: 4px;' }, 'Fecha Meta'), inMetaFec)
    ),
    h('div', {},
      h('label', { style: 'font-size: 12px; font-weight: 600; color: #5D5951; display: block; margin-bottom: 4px;' }, 'Meta del mes:'),
      inMetaMes
    ),
    h('div', { style: 'margin-top: 4px;' },
      h('span', { class: 'v2-subtitulo-card' }, 'Objetivos diarios'),
      h('div', { style: 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 8px;' },
        h('div', {}, h('label', { style: 'font-size: 11px; font-weight: 600; color: #5D5951;' }, 'Kcal'), inKcal),
        h('div', {}, h('label', { style: 'font-size: 11px; font-weight: 600; color: #5D5951;' }, 'Prot (g)'), inProt),
        h('div', {}, h('label', { style: 'font-size: 11px; font-weight: 600; color: #5D5951;' }, 'Agua (v)'), inAgua),
        h('div', {}, h('label', { style: 'font-size: 11px; font-weight: 600; color: #5D5951;' }, 'Pasos'), inPasos)
      )
    ),
    h('button', {
      class: 'v2-btn-pildora v2-btn-lima',
      on: {
        click: async () => {
          perfilDatos = {
            nombre: inNombre.value.trim(),
            estaturaCm: Number(inEstatura.value) || null,
            metaNombre: inMetaNom.value.trim(),
            metaFecha: inMetaFec.value,
            metaMes: inMetaMes.value.trim(),
            kcal: Number(inKcal.value) || 2200,
            proteina: Number(inProt.value) || 128,
            aguaVasos: Number(inAgua.value) || 10,
            pasos: Number(inPasos.value) || 9000
          };
          await ponerAjuste('perfil', perfilDatos);
          aviso('Perfil y metas actualizados', 'ok');
        }
      }
    }, iconoNodo('check', ICONOS_SVGS.check), 'Guardar perfil')
  );
}

/**
 * 2. Sección Días de Gym y Rutina
 */
function renderizarSeccionRutina() {
  const diasSemana = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  const diasRutina = rutinaDatos?.dias || {};

  const contenedorDias = h('div', { style: 'display: flex; flex-direction: column; gap: 6px; margin: 6px 0;' },
    diasSemana.map(d => {
      const configDia = diasRutina[d];
      const entrenar = !!configDia;
      return h('div', {
        style: 'background-color: #F3F0E8; border-radius: 999px; padding: 10px 18px; display: flex; justify-content: space-between; align-items: center;'
      },
        h('span', { style: 'text-transform: capitalize; font-weight: 600; font-size: 14px;' }, d),
        h('span', {
          style: `font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 999px; background-color: ${entrenar ? '#C8F03C' : '#E9E4D8'}; color: #17171A;`
        },
          entrenar ? `${configDia.nombre || 'Entrena'} (${configDia.ejercicios?.length || 0} ej.)` : 'Descanso'
        )
      );
    })
  );

  return h('div', { class: 'v2-tarjeta' },
    h('h2', { class: 'v2-serif-title' },
      iconoNodo('calendario', ICONOS_SVGS.calendario),
      'Días de gym y ', h('em', {}, 'rutina')
    ),
    h('p', { style: 'font-size: 13px; color: #5D5951;' }, 'Rutina activa programada en la memoria del teléfono:'),
    contenedorDias,
    h('div', { style: 'display: flex; gap: 8px;' },
      h('button', {
        class: 'v2-btn-pildora',
        style: 'flex: 1;',
        on: {
          click: async () => {
            const conf = await confirmar('¿Restablecer la rutina de partida original?');
            if (!conf) return;
            const base = await rutinaBase();
            await ponerAjuste('rutina', base);
            rutinaDatos = base;
            aviso('Rutina restablecida', 'ok');
            await renderizar();
          }
        }
      }, 'Restablecer fábrica'),
      h('button', {
        class: 'v2-btn-pildora',
        style: 'flex: 1; background-color: #C8F03C;',
        on: { click: async () => { await abrirEditorRutina(); } }
      }, 'Editar rutina')
    )
  );
}

/**
 * Editor modal de la rutina semanal (sin backdrop-filter)
 */
async function abrirEditorRutina() {
  const baseDias = rutinaDatos?.dias || {};
  const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

  const modal = h('div', {
    class: 'v2-modal-overlay',
    style: 'position: fixed; inset: 0; background: rgba(23, 23, 26, 0.76); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px;'
  });

  const listaInputs = {};

  const contenido = h('div', {
    style: 'width: 100%; max-width: 480px; max-height: 85vh; overflow-y: auto; background-color: #F3F0E8; border-radius: 28px; padding: 24px; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 10px 30px rgba(23,23,26,.2); font-family: "Bricolage Grotesque", sans-serif;'
  },
    h('div', { style: 'display: flex; justify-content: space-between; align-items: center;' },
      h('h3', { style: 'font-family: "Instrument Serif", Georgia, serif; font-size: 26px; font-weight: 400;' }, 'Personalizar ', h('em', {}, 'rutina')),
      h('button', {
        class: 'v2-btn-pildora',
        style: 'width: 48px; height: 48px; min-width: 48px; min-height: 48px; padding: 0; background-color: #E9E4D8;',
        on: { click: () => modal.remove() }
      }, iconoNodo('cerrar', ICONOS_SVGS.cerrar))
    ),
    h('div', { style: 'display: flex; flex-direction: column; gap: 8px;' },
      dias.map(dia => {
        const activo = !!baseDias[dia];
        const nom = baseDias[dia]?.nombre || '';
        const chk = h('input', { type: 'checkbox', checked: activo, style: 'width: 24px; height: 24px; accent-color: #C8F03C; cursor: pointer;' });
        const txt = h('input', {
          class: 'v2-input-redondo',
          type: 'text',
          value: nom,
          placeholder: 'Nombre sesión (ej. Pierna)',
          style: 'flex: 1; height: 48px; padding: 10px 16px; background-color: #E9E4D8;'
        });
        listaInputs[dia] = { chk, txt, ejer: baseDias[dia]?.ejercicios || [] };

        return h('div', {
          style: 'background-color: #E9E4D8; border-radius: 28px; padding: 8px 16px; display: flex; align-items: center; gap: 10px;'
        },
          chk,
          h('span', { style: 'width: 75px; text-transform: capitalize; font-size: 13px; font-weight: 600;' }, dia),
          txt
        );
      })
    ),
    h('button', {
      class: 'v2-btn-pildora v2-btn-lima',
      on: {
        click: async () => {
          const nuevaRutina = { dias: {} };
          for (const dia of dias) {
            if (listaInputs[dia].chk.checked) {
              nuevaRutina.dias[dia] = {
                nombre: listaInputs[dia].txt.value.trim() || 'Entrenamiento',
                ejercicios: listaInputs[dia].ejer
              };
            }
          }
          await ponerAjuste('rutina', nuevaRutina);
          rutinaDatos = nuevaRutina;
          modal.remove();
          aviso('Rutina guardada correctamente', 'ok');
          await renderizar();
        }
      }
    }, iconoNodo('check', ICONOS_SVGS.check), 'Guardar cambios de rutina')
  );

  modal.appendChild(contenido);
  document.body.appendChild(modal);
}

/**
 * 3. Sección PIN de Seguridad (Seguridad Hallazgos 3 y 4)
 * Pide el PIN actual antes de permitir quitarlo o cambiarlo.
 */
function renderizarSeccionSeguridad() {
  const tienePin = !!(pinActual && pinActual.hash);

  return h('div', { class: 'v2-tarjeta' },
    h('h2', { class: 'v2-serif-title' },
      iconoNodo('candado', ICONOS_SVGS.candado),
      'PIN de ', h('em', {}, 'seguridad')
    ),
    h('div', { style: 'display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; background-color: #F3F0E8; border-radius: 28px; padding: 16px 20px;' },
      h('div', { style: 'flex: 1; min-width: 160px;' },
        h('div', { style: 'font-weight: 600; font-size: 15px;' }, tienePin ? 'PIN activado' : 'Sin PIN'),
        h('div', { style: 'font-size: 12px; color: #5D5951; margin-top: 2px;' },
          tienePin
            ? 'Se pide un código de 4 dígitos al abrir. Bloqueo de 30 s tras 5 fallos.'
            : 'La app abre directamente sin solicitar clave.'
        )
      ),
      tienePin
        ? h('div', { style: 'display: flex; gap: 8px; flex-wrap: wrap;' },
            h('button', {
              class: 'v2-btn-pildora',
              style: 'min-height: 48px; height: 48px; width: auto; padding: 0 18px; background-color: #E9E4D8;',
              on: {
                click: async () => {
                  const verificado = await pedirPin({
                    cancelar: true,
                    subtitulo: 'Ingresa tu PIN actual para cambiarlo'
                  });
                  if (!verificado) {
                    aviso('Debes verificar tu PIN actual para cambiarlo', 'error');
                    return;
                  }
                  await configurarNuevoPin(true);
                }
              }
            }, 'Cambiar PIN'),
            h('button', {
              class: 'v2-btn-pildora v2-btn-peligro',
              style: 'min-height: 48px; height: 48px; width: auto; padding: 0 18px;',
              on: {
                click: async () => {
                  const verificado = await pedirPin({
                    cancelar: true,
                    subtitulo: 'Ingresa tu PIN actual para desactivarlo'
                  });
                  if (!verificado) {
                    aviso('PIN actual no verificado. No se desactivó el PIN.', 'error');
                    return;
                  }
                  await ponerAjuste('pin', null);
                  pinActual = null;
                  guardarEstadoBloqueoPin(0, 0);
                  aviso('PIN desactivado correctamente', 'info');
                  await renderizar();
                }
              }
            }, 'Quitar PIN')
          )
        : h('button', {
            class: 'v2-btn-pildora v2-btn-lima',
            style: 'min-height: 48px; height: 48px; width: auto; padding: 0 20px;',
            on: {
              click: async () => {
                await configurarNuevoPin(false);
              }
            }
          }, 'Configurar PIN')
    ),
    h('p', { style: 'font-size: 12px; color: #5D5951; margin: 0 4px;' },
      'Nota: El PIN es un bloqueo de pantalla local de la aplicación y no cifra el almacenamiento físico del dispositivo.'
    )
  );
}

/**
 * Modal para configurar un nuevo PIN de 4 dígitos
 * Si ya existe un PIN y no ha sido verificado previamente, exige ingresar el PIN actual primero.
 */
async function configurarNuevoPin(yaVerificado = false) {
  if (pinActual && pinActual.hash && !yaVerificado) {
    const ok = await pedirPin({
      cancelar: true,
      subtitulo: 'Ingresa tu PIN actual para continuar'
    });
    if (!ok) {
      aviso('PIN actual incorrecto o cancelado', 'error');
      return;
    }
  }

  const inputPin1 = h('input', {
    class: 'v2-input-redondo',
    type: 'password',
    inputMode: 'numeric',
    maxLength: '4',
    placeholder: '••••',
    style: 'font-size: 24px; text-align: center; letter-spacing: 0.3em; background-color: #E9E4D8;'
  });
  const inputPin2 = h('input', {
    class: 'v2-input-redondo',
    type: 'password',
    inputMode: 'numeric',
    maxLength: '4',
    placeholder: 'Confirma el PIN',
    style: 'font-size: 16px; text-align: center; letter-spacing: 0.1em; background-color: #E9E4D8;'
  });

  const modal = h('div', {
    class: 'v2-modal-overlay',
    style: 'position: fixed; inset: 0; background: rgba(23, 23, 26, 0.76); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px;'
  },
    h('div', {
      style: 'width: 100%; max-width: 360px; background-color: #F3F0E8; border-radius: 28px; padding: 24px; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 10px 30px rgba(23,23,26,.2); font-family: "Bricolage Grotesque", sans-serif;'
    },
      h('h3', { style: 'font-family: "Instrument Serif", Georgia, serif; font-size: 28px; font-weight: 400;' },
        pinActual && pinActual.hash ? 'Cambiar ' : 'Crear ',
        h('em', {}, 'PIN')
      ),
      h('p', { style: 'font-size: 13px; color: #5D5951;' }, 'Elige 4 números para proteger tu app:'),
      inputPin1,
      inputPin2,
      h('div', { style: 'display: flex; gap: 8px; margin-top: 6px;' },
        h('button', {
          class: 'v2-btn-pildora',
          style: 'flex: 1; background-color: #E9E4D8;',
          on: { click: () => modal.remove() }
        }, 'Cancelar'),
        h('button', {
          class: 'v2-btn-pildora v2-btn-lima',
          style: 'flex: 1;',
          on: {
            click: async () => {
              const p1 = inputPin1.value.trim();
              const p2 = inputPin2.value.trim();
              if (p1.length !== 4 || !/^\d{4}$/.test(p1)) {
                aviso('El PIN debe contener exactamente 4 números', 'error');
                return;
              }
              if (p1 !== p2) {
                aviso('Los dos PIN no coinciden', 'error');
                return;
              }
              const sal = generarSal();
              const hash = await hashSha256(p1, sal);
              pinActual = { sal, hash };
              await ponerAjuste('pin', pinActual);
              guardarEstadoBloqueoPin(0, 0);
              modal.remove();
              aviso('PIN configurado con éxito', 'ok');
              await renderizar();
            }
          }
        }, 'Guardar PIN')
      )
    )
  );

  document.body.appendChild(modal);
}

/**
 * 4. Sección Copia de Seguridad y Datos
 * Seguridad 3: Excluye el hash y la sal del PIN al exportar el respaldo JSON.
 */
function renderizarSeccionDatos() {
  const chkFotos = h('input', {
    type: 'checkbox',
    style: 'width: 20px; height: 20px; accent-color: #C8F03C; cursor: pointer;'
  });

  const inputCopiaFile = h('input', {
    type: 'file',
    accept: '.json',
    style: 'display: none;',
    on: {
      change: async (e) => {
        const archivo = e.target.files && e.target.files[0];
        await procesarArchivoImportar(archivo, 'todo');
        e.target.value = '';
      }
    }
  });

  const inputHistorialFile = h('input', {
    type: 'file',
    accept: '.json',
    style: 'display: none;',
    on: {
      change: async (e) => {
        const archivo = e.target.files && e.target.files[0];
        await procesarArchivoImportar(archivo, 'historial');
        e.target.value = '';
      }
    }
  });

  return h('div', { class: 'v2-tarjeta' },
    inputCopiaFile,
    inputHistorialFile,
    h('h2', { class: 'v2-serif-title' },
      iconoNodo('disco', ICONOS_SVGS.disco),
      'Copia de ', h('em', {}, 'seguridad')
    ),
    h('p', { style: 'font-size: 13px; color: #5D5951;' },
      'Tus datos viven exclusivamente en este dispositivo. Descarga una copia periódicamente (el PIN nunca se exporta).'
    ),
    h('label', { style: 'display: flex; align-items: center; gap: 10px; font-size: 13px; cursor: pointer; min-height: 36px;' },
      chkFotos,
      h('span', {}, 'Incluir fotos de progreso en la copia (pesa más)')
    ),
    h('div', { style: 'display: flex; gap: 8px; flex-wrap: wrap;' },
      h('button', {
        class: 'v2-btn-pildora v2-btn-lima',
        style: 'flex: 1; min-width: 140px;',
        on: {
          click: async () => {
            aviso('Generando copia de seguridad...', 'info');
            const copia = await exportarTodo({ conFotos: chkFotos.checked });
            // Seguridad 3: Excluir estrictamente el hash y sal del PIN de la exportación
            if (copia && copia.datos && Array.isArray(copia.datos.ajustes)) {
              copia.datos.ajustes = copia.datos.ajustes.filter(aj => aj && aj.id !== 'pin');
            }
            if (copia && copia.datos && copia.datos.pin) {
              delete copia.datos.pin;
            }
            const blob = new Blob([JSON.stringify(copia, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = h('a', { href: url, download: `forja-backup-${hoyISO()}.json` });
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            aviso('Copia descargada correctamente', 'ok');
          }
        }
      }, iconoNodo('descargar', ICONOS_SVGS.descargar), 'Exportar todo (.json)'),
      h('button', {
        class: 'v2-btn-pildora',
        style: 'flex: 1; min-width: 140px;',
        on: { click: () => inputCopiaFile.click() }
      }, iconoNodo('subir', ICONOS_SVGS.subir), 'Importar copia')
    ),
    h('button', {
      class: 'v2-btn-pildora',
      style: 'background-color: #F3F0E8; width: 100%; margin-top: 4px;',
      on: { click: () => inputHistorialFile.click() }
    }, iconoNodo('subir', ICONOS_SVGS.subir), 'Importar historial de sesiones pasadas')
  );
}

/**
 * Lee, valida y procesa un archivo JSON para importación usando importarTodo()
 * - Validación de tamaño máximo (50 MB) para prevenir DoS por memoria (seguridad_privacidad.md Hallazgo Nuevo 3).
 * - Acepta formato { datos: {...} } y también colecciones en la raíz { sesiones: [...], series: [...] } (ALTO-05).
 * - Deduplicación segura con Set de IDs asignados en series y sesiones sin id (CRÍTICO-02).
 * - Seguridad 3: Filtra cualquier clave 'pin' en ajustes importados.
 * - Seguridad 5: En fotos, solo permite cadenas data:image/ y bloquea cualquier URL externa (http/https/etc.).
 * - CRÍTICO-01: Preserva el Blob de fotos locales existentes si el respaldo importado viene sin foto.
 * - ALTO-01: Genera IDs automáticos a medidas, comidas, chat y cámara sin ID para no descartarlas.
 */
async function procesarArchivoImportar(archivo, tipo) {
  if (!archivo) return;
  if (archivo.size > TAMANO_MAX_BACKUP) {
    aviso('El archivo seleccionado supera el límite permitido (máx. 50 MB)', 'error');
    return;
  }

  try {
    const texto = await archivo.text();
    const obj = JSON.parse(texto);
    if (!obj || typeof obj !== 'object') {
      throw new Error('Estructura JSON inválida');
    }

    const storesconocidos = ['sesiones', 'series', 'medidas', 'fotos', 'comidas', 'ajustes', 'chat', 'camara'];
    const datosNormalizados = {};

    // 1. Extraer tanto de obj.datos como del nivel raíz de obj
    const fuenteDatos = (obj.datos && typeof obj.datos === 'object') ? obj.datos : {};
    for (const store of storesconocidos) {
      if (Array.isArray(fuenteDatos[store])) {
        datosNormalizados[store] = fuenteDatos[store].map(item => (item && typeof item === 'object' ? { ...item } : item));
      } else if (Array.isArray(obj[store])) {
        datosNormalizados[store] = obj[store].map(item => (item && typeof item === 'object' ? { ...item } : item));
      }
    }

    // Si es un array directo de series o sesiones
    if (Array.isArray(obj) && obj.length > 0) {
      if (obj[0].ejercicioId !== undefined || obj[0].reps !== undefined) {
        datosNormalizados.series = obj.map(item => ({ ...item }));
      } else if (obj[0].fecha !== undefined) {
        datosNormalizados.sesiones = obj.map(item => ({ ...item }));
      }
    }

    // 2. Seguridad 3: Nunca importar ni sobrescribir el ajuste 'pin'
    if (Array.isArray(datosNormalizados.ajustes)) {
      datosNormalizados.ajustes = datosNormalizados.ajustes.filter(aj => aj && aj.id !== 'pin');
    }

    // 3. Evitar duplicados en sesiones sin id (ALTO-05 / CRÍTICO-02)
    if (Array.isArray(datosNormalizados.sesiones)) {
      const sesionesExistentes = await todos('sesiones');
      const idsSesionesAsignadas = new Set();
      datosNormalizados.sesiones.forEach((s, idx) => {
        if (!s || typeof s !== 'object') return;
        if (!s.id) {
          const existente = sesionesExistentes.find(e => !idsSesionesAsignadas.has(e.id) && e.fecha && s.fecha && e.fecha === s.fecha);
          if (existente) {
            s.id = existente.id;
            idsSesionesAsignadas.add(existente.id);
          } else {
            s.id = `sesion-${s.fecha || idx}-${nuevoId().slice(0, 6)}`;
          }
        }
      });
    }

    // 4. Evitar duplicados y colapso de series idénticas sin id (CRÍTICO-02 logica_datos.md)
    if (Array.isArray(datosNormalizados.series)) {
      const seriesExistentes = await todos('series');
      const idsYaAsignados = new Set();
      datosNormalizados.series.forEach((se, idx) => {
        if (!se || typeof se !== 'object') return;
        if (!se.id) {
          const existente = seriesExistentes.find(e =>
            !idsYaAsignados.has(e.id) &&
            e.fecha === se.fecha &&
            e.ejercicioId === se.ejercicioId &&
            ((e.hora && se.hora && Math.abs(e.hora - se.hora) < 2000) ||
             (!se.hora && Number(e.kg || 0) === Number(se.kg || 0) && Number(e.reps || 0) === Number(se.reps || 0) && (e.nota || '') === (se.nota || '')))
          );
          if (existente) {
            se.id = existente.id;
            idsYaAsignados.add(existente.id);
          } else {
            se.id = `serie-${se.fecha || 'f'}-${se.ejercicioId || 'ej'}-${se.hora || idx}-${se.kg ?? 'bw'}-${se.reps ?? 0}-${nuevoId().slice(0, 6)}`;
          }
        }
      });
    }

    // 5. Garantizar que medidas, comidas, chat y cámara sin id reciban nuevoId() para no ser descartadas (ALTO-01 logica_datos.md)
    for (const st of ['medidas', 'comidas', 'chat', 'camara']) {
      if (Array.isArray(datosNormalizados[st])) {
        datosNormalizados[st].forEach((item) => {
          if (item && typeof item === 'object' && !item.id) {
            item.id = nuevoId();
          }
        });
      }
    }

    // 6. Seguridad 5 y CRÍTICO-01 en fotos: validar solo data:image/ y preservar Blob existente si falta
    let urlsExternasRechazadas = 0;
    if (Array.isArray(datosNormalizados.fotos)) {
      const fotosLocales = await todos('fotos');
      const mapaFotosLocales = new Map(fotosLocales.map(f => [f.id, f]));

      for (const foto of datosNormalizados.fotos) {
        if (!foto || typeof foto !== 'object') continue;

        if (foto.dataUrl !== undefined && foto.dataUrl !== null) {
          const urlStr = typeof foto.dataUrl === 'string' ? foto.dataUrl.trim() : '';
          if (!urlStr.startsWith('data:image/')) {
            // Bloquear cualquier URL externa (http:, https:, javascript:, etc.)
            delete foto.dataUrl;
            urlsExternasRechazadas++;
          }
        }

        // Preservar el Blob local si el registro importado no trae imagen
        if (!foto.blob && !foto.dataUrl && foto.id && mapaFotosLocales.has(foto.id)) {
          const fotoPrevia = mapaFotosLocales.get(foto.id);
          if (fotoPrevia && fotoPrevia.blob) {
            foto.blob = fotoPrevia.blob;
          }
        }
      }
    }

    // 7. Ejecutar importarTodo con estructura canónica { version, fecha, datos }
    const payload = {
      version: obj.version || 1,
      fecha: obj.fecha || new Date().toISOString(),
      datos: datosNormalizados
    };

    const res = await importarTodo(payload);
    const agregados = res?.agregados || 0;
    const actualizados = res?.actualizados || 0;

    if (urlsExternasRechazadas > 0) {
      aviso(`Se bloquearon ${urlsExternasRechazadas} URL(s) externas en fotos (solo se acepta data:image/)`, 'error');
    } else {
      const prefijo = tipo === 'historial' ? 'Historial importado' : 'Copia importada';
      aviso(`${prefijo}: ${agregados} agregados, ${actualizados} actualizados`, 'ok');
    }

    await recargarDatos();
    await renderizar();
  } catch (err) {
    console.error('Error al importar:', err);
    aviso('Error al leer el archivo JSON: formato inválido', 'error');
  }
}

/**
 * 5. Sección IA Local (WebLLM)
 * Sincronizado con WEBLLM_MODELO y WEBLLM_MODELO_RESPALDO de config.js (CFG-01)
 */
function renderizarSeccionIA() {
  const tieneWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator && !!navigator.gpu;
  const activa = !!iaAjustes?.activa;
  const modeloPrincipal = WEBLLM_MODELO || 'Qwen3.5-2B-q4f16_1-MLC';
  const modeloRespaldo = WEBLLM_MODELO_RESPALDO || 'Qwen3.5-0.8B-q4f16_1-MLC';

  if (iaAjustes.modelo !== modeloPrincipal && iaAjustes.modelo !== modeloRespaldo) {
    iaAjustes.modelo = modeloPrincipal;
  }

  const barraProg = h('div', { class: 'v2-barra-track', style: 'display: none; margin-top: 8px;' },
    h('div', { class: 'v2-barra-lima', style: 'width: 0%;' })
  );
  const textoProgreso = h('div', { style: 'font-size: 12px; color: #5D5951; margin-top: 4px; display: none;' });

  const selectModelo = h('select', {
    class: 'v2-input-redondo',
    style: 'margin-top: 4px;',
    on: {
      change: async (e) => {
        iaAjustes.modelo = e.target.value;
        await ponerAjuste('ia', { activa: iaAjustes.activa, modelo: iaAjustes.modelo });
        aviso(`Modelo seleccionado: ${iaAjustes.modelo}`, 'info');
      }
    }
  },
    h('option', { value: modeloPrincipal, selected: iaAjustes.modelo === modeloPrincipal },
      `2B ≈ 1,3 GB (Recomendado: ${modeloPrincipal})`
    ),
    h('option', { value: modeloRespaldo, selected: iaAjustes.modelo === modeloRespaldo },
      `0.8B ≈ 0,5 GB (Ligero: ${modeloRespaldo})`
    )
  );

  return h('div', { class: 'v2-tarjeta' },
    h('h2', { class: 'v2-serif-title' },
      iconoNodo('ia', ICONOS_SVGS.ia),
      'IA local en el ', h('em', {}, 'teléfono')
    ),
    h('p', { style: 'font-size: 13px; color: #5D5951;' },
      'Entrenador inteligente que analiza tus datos sin internet mediante WebGPU.'
    ),
    !tieneWebGPU
      ? h('div', {
          style: 'background-color: #F3F0E8; border-radius: 999px; padding: 10px 16px; font-size: 13px; color: #A02B14; font-weight: 600; display: flex; align-items: center; gap: 8px;'
        },
          iconoNodo('alerta', ICONOS_SVGS.alerta),
          'Tu navegador o dispositivo no tiene WebGPU activo. El Coach responderá con reglas sin internet.'
        )
      : h('div', {
          style: 'background-color: #F3F0E8; border-radius: 999px; padding: 8px 16px; font-size: 12px; font-weight: 600; color: #17171A; display: inline-flex; align-items: center; gap: 6px; width: fit-content;'
        },
          iconoNodo('check', ICONOS_SVGS.check),
          'WebGPU disponible en este dispositivo'
        ),
    h('div', {},
      h('label', { style: 'font-size: 12px; font-weight: 600; color: #5D5951;' }, 'Modelo de IA local:'),
      selectModelo
    ),
    h('div', { style: 'display: flex; justify-content: space-between; align-items: center; background-color: #F3F0E8; border-radius: 28px; padding: 14px 20px;' },
      h('div', {},
        h('div', { style: 'font-weight: 600; font-size: 15px;' }, 'Activar IA en Coach'),
        h('div', { style: 'font-size: 12px; color: #5D5951;' }, `Estado: ${activa ? 'Activada' : 'Desactivada'}`)
      ),
      h('button', {
        class: `v2-btn-pildora ${activa ? 'v2-btn-lima' : ''}`,
        style: 'min-height: 48px; height: 48px; width: auto; padding: 0 18px; background-color: ' + (activa ? '#C8F03C' : '#E9E4D8') + ';',
        on: {
          click: async () => {
            iaAjustes.activa = !activa;
            await ponerAjuste('ia', { activa: iaAjustes.activa, modelo: iaAjustes.modelo });
            aviso(iaAjustes.activa ? 'IA Local activada' : 'IA Local desactivada', 'info');
            await renderizar();
          }
        }
      }, activa ? 'Activada' : 'Desactivada')
    ),
    barraProg,
    textoProgreso,
    h('div', { style: 'display: flex; gap: 8px;' },
      h('button', {
        class: 'v2-btn-pildora',
        style: 'flex: 1;',
        disabled: !tieneWebGPU,
        on: {
          click: async () => {
            try {
              barraProg.style.display = 'block';
              textoProgreso.style.display = 'block';
              textoProgreso.textContent = 'Iniciando descarga del modelo...';
              const relleno = barraProg.querySelector('.v2-barra-lima');

              await ponerAjuste('ia', { activa: iaAjustes.activa, modelo: iaAjustes.modelo });

              await descargarModelo((report) => {
                const pct = Math.round((report.progress || 0) * 100);
                if (relleno) relleno.style.width = `${pct}%`;
                textoProgreso.textContent = report.text || `${pct}% completado`;
              });

              iaAjustes.activa = true;
              await ponerAjuste('ia', { activa: true, modelo: iaAjustes.modelo });

              aviso('¡Modelo descargado y listo para usar sin conexión!', 'ok');
              textoProgreso.textContent = `Modelo listo en caché del navegador (${iaAjustes.modelo}).`;
              await renderizar();
            } catch (e) {
              console.error('Error al descargar modelo WebLLM:', e);
              aviso('Error descargando el modelo: ' + (e.message || 'Fallo de red o memoria'), 'error');
              textoProgreso.textContent = 'Fallo en la descarga.';
            }
          }
        }
      }, iconoNodo('descargar', ICONOS_SVGS.descargar), 'Descargar modelo'),
      h('button', {
        class: 'v2-btn-pildora',
        style: 'flex: 1; color: #A02B14;',
        on: {
          click: async () => {
            const conf = await confirmar('¿Borrar los archivos del modelo IA del caché para liberar espacio?');
            if (!conf) return;
            try {
              await borrarModelo();
              iaAjustes.activa = false;
              await ponerAjuste('ia', { activa: false, modelo: iaAjustes.modelo });
              aviso('Archivos del modelo eliminados del caché', 'info');
              await renderizar();
            } catch (e) {
              aviso('No se pudo limpiar el caché: ' + e.message, 'error');
            }
          }
        }
      }, iconoNodo('basura', ICONOS_SVGS.basura), 'Borrar modelo')
    )
  );
}

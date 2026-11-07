/**
 * ajustes.js - Sección 9: Ajustes y Configuración de Forja (Dirección de Arte v2 «Revista de Sala»)
 *
 * Características v2:
 * - Titulares en Instrument Serif cursivo (emocionales, limpios, elegantes).
 * - Campos de formulario con fondo papel 2 (#E9E4D8) o papel (#F3F0E8) y radio estricto de 28px.
 * - Botones en píldora canónica (border-radius: 999px) con acento único Lima (#C8F03C).
 * - Cero emojis: reemplazados por iconos vectoriales limpios vía icono() de ./iconos.js.
 * - Sin estilos inline obsoletos ni bordes duros de 1px.
 * - Asistente inicial de 3 pasos (asistenteInicial) completamente adaptado a la dirección de arte v2.
 * - Teclado de PIN de seguridad (pedirPin y configurarNuevoPin) con visor de puntos y diseño editorial.
 * - Gestión de perfil, metas, rutina semanal, copia de seguridad (exportar/importar) e IA local con WebLLM.
 * - Cumple rigurosamente con CONTRATOS.md y correcciones de REVISION.md (3.4 coach.js, 3.5 await).
 */

import { ajuste, ponerAjuste, guardar, nuevoId, exportarTodo, importarTodo } from './db.js';
import { h, aviso, dialogo, confirmar, hoyISO } from './ui.js';
import { perfil as cargarPerfil, rutina as cargarRutina, rutinaBase, ejercicios as cargarEjercicios } from './datos.js';
import { grasaNavy } from './calculos.js';
import { WEBLLM_URL, WEBLLM_MODELO } from './config.js';
import { descargarModelo, borrarModelo } from './coach.js';
import { icono } from './iconos.js';

let contenedorActual = null;
let perfilDatos = null;
let rutinaDatos = null;
let pinActual = null;
let iaAjustes = null;

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
  alerta: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
};

/**
 * Carga o refresca todos los ajustes en memoria
 */
async function recargarDatos() {
  perfilDatos = await cargarPerfil();
  rutinaDatos = await cargarRutina();
  pinActual = await ajuste('pin', null);
  const modeloPorDefecto = WEBLLM_MODELO || 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';
  iaAjustes = await ajuste('ia', { activa: false, modelo: modeloPorDefecto });
  if (!iaAjustes || typeof iaAjustes !== 'object') {
    iaAjustes = { activa: false, modelo: modeloPorDefecto };
  }
  if (!iaAjustes.modelo) {
    iaAjustes.modelo = modeloPorDefecto;
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

/**
 * CONTRATO: Asistente inicial de 3 pasos al abrir la app por primera vez
 * Adaptado a la estética Forja v2 (titulares serif, campos papel 2 y radio 28, botones píldora)
 * @returns {Promise<boolean>}
 */
export function asistenteInicial() {
  return new Promise((resolve) => {
    let pasoActual = 1;
    const datosAsistente = {
      nombre: '',
      metaNombre: 'Grado universitario',
      metaFecha: '',
      metaMes: 'Constancia 4 días a la semana',
      estaturaCm: 175,
      peso: 70,
      cintura: 82,
      cuello: 38,
      kcal: 2200,
      proteina: 130,
      aguaVasos: 10,
      pasos: 9000
    };

    const modal = h('div', {
      class: 'v2-asistente-overlay',
      style: 'position: fixed; inset: 0; background: rgba(23,23,26,0.75); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 16px;'
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
          placeholder: 'Grado universitario'
        });
        const inputMetaFec = h('input', {
          class: 'v2-input-redondo',
          type: 'date',
          value: datosAsistente.metaFecha
        });

        contenedorPaso.append(
          h('div', { style: 'font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 700; color: #6B675F;' }, 'PASO 1 DE 3 · BIENVENIDO'),
          h('h2', { style: 'font-family: "Instrument Serif", Georgia, serif; font-size: 32px; font-weight: 400; line-height: 1.1;' }, 'Comencemos tu ', h('em', {}, 'Forja')),
          h('p', { style: 'font-size: 14px; color: #6B675F; line-height: 1.4;' }, 'Tu diario personal de entrenamiento y nutrición 100% privado en tu teléfono.'),
          h('label', { style: 'font-size: 13px; font-weight: 600; color: #6B675F; margin-top: 4px;' }, '¿Cómo te llamas?'),
          inputNombre,
          h('label', { style: 'font-size: 13px; font-weight: 600; color: #6B675F; margin-top: 4px;' }, 'Meta principal:'),
          inputMetaNom,
          h('label', { style: 'font-size: 13px; font-weight: 600; color: #6B675F; margin-top: 4px;' }, 'Fecha objetivo:'),
          inputMetaFec,
          h('div', { style: 'display: flex; justify-content: flex-end; margin-top: 10px;' },
            h('button', {
              class: 'v2-btn-pildora v2-btn-lima',
              style: 'width: auto; padding: 0 28px;',
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
          )
        );
      } else if (pasoActual === 2) {
        // Paso 2: Medidas corporales
        const inEstatura = h('input', { class: 'v2-input-redondo', type: 'number', value: datosAsistente.estaturaCm });
        const inPeso = h('input', { class: 'v2-input-redondo', type: 'number', step: '0.1', value: datosAsistente.peso });
        const inCintura = h('input', { class: 'v2-input-redondo', type: 'number', step: '0.5', value: datosAsistente.cintura });
        const inCuello = h('input', { class: 'v2-input-redondo', type: 'number', step: '0.5', value: datosAsistente.cuello });

        contenedorPaso.append(
          h('div', { style: 'font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 700; color: #6B675F;' }, 'PASO 2 DE 3 · CUERPO'),
          h('h2', { style: 'font-family: "Instrument Serif", Georgia, serif; font-size: 32px; font-weight: 400; line-height: 1.1;' }, 'Tu punto de ', h('em', {}, 'partida')),
          h('p', { style: 'font-size: 14px; color: #6B675F; line-height: 1.4;' }, 'Tus medidas se almacenan únicamente en la memoria local de este dispositivo.'),
          h('div', { style: 'display: grid; grid-template-columns: 1fr 1fr; gap: 10px;' },
            h('div', {}, h('label', { style: 'font-size: 12px; font-weight: 600; color: #6B675F;' }, 'Estatura (cm)'), inEstatura),
            h('div', {}, h('label', { style: 'font-size: 12px; font-weight: 600; color: #6B675F;' }, 'Peso (kg)'), inPeso),
            h('div', {}, h('label', { style: 'font-size: 12px; font-weight: 600; color: #6B675F;' }, 'Cintura (cm)'), inCintura),
            h('div', {}, h('label', { style: 'font-size: 12px; font-weight: 600; color: #6B675F;' }, 'Cuello (cm)'), inCuello)
          ),
          h('div', { style: 'display: flex; justify-content: space-between; margin-top: 10px;' },
            h('button', {
              class: 'v2-btn-pildora',
              style: 'background-color: #E9E4D8;',
              on: { click: () => { pasoActual = 1; actualizarPaso(); } }
            }, 'Atrás'),
            h('button', {
              class: 'v2-btn-pildora v2-btn-lima',
              style: 'width: auto; padding: 0 28px;',
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
          h('div', { style: 'font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 700; color: #6B675F;' }, 'PASO 3 DE 3 · OBJETIVOS'),
          h('h2', { style: 'font-family: "Instrument Serif", Georgia, serif; font-size: 32px; font-weight: 400; line-height: 1.1;' }, 'Tus metas ', h('em', {}, 'diarias')),
          h('p', { style: 'font-size: 14px; color: #6B675F; line-height: 1.4;' }, 'Podrás modificar estas metas cuando quieras desde Ajustes.'),
          h('div', { style: 'display: grid; grid-template-columns: 1fr 1fr; gap: 10px;' },
            h('div', {}, h('label', { style: 'font-size: 12px; font-weight: 600; color: #6B675F;' }, 'Calorías (kcal)'), inKcal),
            h('div', {}, h('label', { style: 'font-size: 12px; font-weight: 600; color: #6B675F;' }, 'Proteína (g)'), inProt),
            h('div', {}, h('label', { style: 'font-size: 12px; font-weight: 600; color: #6B675F;' }, 'Agua (vasos)'), inAgua),
            h('div', {}, h('label', { style: 'font-size: 12px; font-weight: 600; color: #6B675F;' }, 'Pasos diarios'), inPasos)
          ),
          h('div', { style: 'display: flex; justify-content: space-between; margin-top: 10px;' },
            h('button', {
              class: 'v2-btn-pildora',
              style: 'background-color: #E9E4D8;',
              on: { click: () => { pasoActual = 2; actualizarPaso(); } }
            }, 'Atrás'),
            h('button', {
              class: 'v2-btn-pildora v2-btn-lima',
              style: 'width: auto; padding: 0 28px;',
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
 * Adaptado a la estética Forja v2 (titulares serif, teclado en píldoras, visor de puntos)
 */
export async function pedirPin() {
  const pinGuardado = await ajuste('pin', null);
  if (!pinGuardado || !pinGuardado.hash) return true;

  return new Promise((resolve) => {
    let pinEntrada = '';

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

    const mensajeError = h('div', { style: 'min-height: 24px; color: #E2553A; font-size: 14px; font-weight: 500;' });

    async function teclear(num) {
      if (pinEntrada.length < 4) {
        pinEntrada += num;
        actualizarVisor();
      }
      if (pinEntrada.length === 4) {
        const hashIntento = await hashSha256(pinEntrada, pinGuardado.sal);
        if (hashIntento === pinGuardado.hash) {
          overlay.remove();
          resolve(true);
        } else {
          mensajeError.textContent = 'PIN incorrecto. Intenta de nuevo.';
          pinEntrada = '';
          setTimeout(() => {
            actualizarVisor();
            mensajeError.textContent = '';
          }, 600);
        }
      }
    }

    function borrarDigito() {
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

    const tecladoGrid = h('div', {
      style: 'display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; width: 100%; max-width: 280px; margin-top: 12px;'
    },
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => h('button', {
        class: 'v2-btn-pildora',
        style: 'height: 60px; font-size: 24px; font-weight: 700; background-color: #E9E4D8; color: #17171A; border-radius: 999px;',
        on: { click: () => teclear(n.toString()) }
      }, n.toString())),
      h('div', {}),
      h('button', {
        class: 'v2-btn-pildora',
        style: 'height: 60px; font-size: 24px; font-weight: 700; background-color: #E9E4D8; color: #17171A; border-radius: 999px;',
        on: { click: () => teclear('0') }
      }, '0'),
      h('button', {
        class: 'v2-btn-pildora',
        style: 'height: 60px; background-color: #E9E4D8; color: #17171A; border-radius: 999px;',
        title: 'Borrar',
        on: { click: borrarDigito }
      }, iconoNodo('retroceso', ICONOS_SVGS.retroceso))
    );

    overlay.append(
      h('div', { style: 'margin-bottom: 8px;' }, iconoNodo('candado', ICONOS_SVGS.candado)),
      h('h2', { style: 'font-family: "Instrument Serif", Georgia, serif; font-size: 34px; font-weight: 400; text-align: center;' }, 'Ingresa tu ', h('em', {}, 'PIN')),
      h('p', { style: 'font-size: 14px; color: #6B675F;' }, 'Acceso seguro a tu diario de entrenamiento'),
      visor,
      mensajeError,
      tecladoGrid
    );

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
    .v2-micro-label {
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      font-weight: 700;
      color: #6B675F;
      line-height: 1;
    }
    .v2-btn-pildora {
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
      height: 52px;
      width: 100%;
    }
    .v2-btn-peligro {
      background-color: #E2553A;
      color: #F3F0E8;
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
      h('p', { style: 'font-size: 14px; color: #6B675F; margin-top: 4px;' },
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
      h('div', {}, h('label', { style: 'font-size: 12px; font-weight: 600; color: #6B675F; display: block; margin-bottom: 4px;' }, 'Nombre'), inNombre),
      h('div', {}, h('label', { style: 'font-size: 12px; font-weight: 600; color: #6B675F; display: block; margin-bottom: 4px;' }, 'Estatura (cm)'), inEstatura),
      h('div', {}, h('label', { style: 'font-size: 12px; font-weight: 600; color: #6B675F; display: block; margin-bottom: 4px;' }, 'Meta Principal'), inMetaNom),
      h('div', {}, h('label', { style: 'font-size: 12px; font-weight: 600; color: #6B675F; display: block; margin-bottom: 4px;' }, 'Fecha Meta'), inMetaFec)
    ),
    h('div', {},
      h('label', { style: 'font-size: 12px; font-weight: 600; color: #6B675F; display: block; margin-bottom: 4px;' }, 'Meta del mes:'),
      inMetaMes
    ),
    h('div', { style: 'margin-top: 4px;' },
      h('span', { class: 'v2-micro-label' }, 'OBJETIVOS DIARIOS'),
      h('div', { style: 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 8px;' },
        h('div', {}, h('label', { style: 'font-size: 11px; font-weight: 600; color: #6B675F;' }, 'Kcal'), inKcal),
        h('div', {}, h('label', { style: 'font-size: 11px; font-weight: 600; color: #6B675F;' }, 'Prot (g)'), inProt),
        h('div', {}, h('label', { style: 'font-size: 11px; font-weight: 600; color: #6B675F;' }, 'Agua (v)'), inAgua),
        h('div', {}, h('label', { style: 'font-size: 11px; font-weight: 600; color: #6B675F;' }, 'Pasos'), inPasos)
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
    h('p', { style: 'font-size: 13px; color: #6B675F;' }, 'Rutina activa programada en la memoria del teléfono:'),
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
 * Editor modal de la rutina semanal
 */
async function abrirEditorRutina() {
  const baseDias = rutinaDatos?.dias || {};
  const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

  const modal = h('div', {
    class: 'v2-modal-overlay',
    style: 'position: fixed; inset: 0; background: rgba(23,23,26,0.7); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px;'
  });

  const listaInputs = {};

  const contenido = h('div', {
    style: 'width: 100%; max-width: 480px; max-height: 85vh; overflow-y: auto; background-color: #F3F0E8; border-radius: 28px; padding: 24px; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 10px 30px rgba(23,23,26,.2); font-family: "Bricolage Grotesque", sans-serif;'
  },
    h('div', { style: 'display: flex; justify-content: space-between; align-items: center;' },
      h('h3', { style: 'font-family: "Instrument Serif", Georgia, serif; font-size: 26px; font-weight: 400;' }, 'Personalizar ', h('em', {}, 'rutina')),
      h('button', {
        class: 'v2-btn-pildora',
        style: 'width: 40px; height: 40px; padding: 0;',
        on: { click: () => modal.remove() }
      }, iconoNodo('cerrar', ICONOS_SVGS.cerrar))
    ),
    h('div', { style: 'display: flex; flex-direction: column; gap: 8px;' },
      dias.map(dia => {
        const activo = !!baseDias[dia];
        const nom = baseDias[dia]?.nombre || '';
        const chk = h('input', { type: 'checkbox', checked: activo, style: 'width: 20px; height: 20px; accent-color: #C8F03C; cursor: pointer;' });
        const txt = h('input', {
          class: 'v2-input-redondo',
          type: 'text',
          value: nom,
          placeholder: 'Nombre sesión (ej. Pierna)',
          style: 'flex: 1; height: 44px; padding: 10px 16px; background-color: #E9E4D8;'
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
 * 3. Sección PIN de Seguridad
 */
function renderizarSeccionSeguridad() {
  const tienePin = !!(pinActual && pinActual.hash);

  return h('div', { class: 'v2-tarjeta' },
    h('h2', { class: 'v2-serif-title' },
      iconoNodo('candado', ICONOS_SVGS.candado),
      'PIN de ', h('em', {}, 'seguridad')
    ),
    h('div', { style: 'display: flex; justify-content: space-between; align-items: center; background-color: #F3F0E8; border-radius: 28px; padding: 14px 20px;' },
      h('div', {},
        h('div', { style: 'font-weight: 600; font-size: 15px;' }, tienePin ? 'PIN activado' : 'Sin PIN'),
        h('div', { style: 'font-size: 12px; color: #6B675F; margin-top: 2px;' },
          tienePin ? 'Se pide un código de 4 dígitos al abrir.' : 'La app abre directamente sin solicitar clave.'
        )
      ),
      h('button', {
        class: `v2-btn-pildora ${tienePin ? 'v2-btn-peligro' : 'v2-btn-lima'}`,
        style: 'height: 42px; width: auto; padding: 0 18px;',
        on: {
          click: async () => {
            if (tienePin) {
              const quitar = await confirmar('¿Deseas quitar el PIN de seguridad?');
              if (quitar) {
                await ponerAjuste('pin', null);
                pinActual = null;
                aviso('PIN desactivado', 'info');
                await renderizar();
              }
            } else {
              configurarNuevoPin();
            }
          }
        }
      }, tienePin ? 'Quitar PIN' : 'Configurar PIN')
    )
  );
}

/**
 * Modal para configurar un nuevo PIN de 4 dígitos
 */
function configurarNuevoPin() {
  const inputPin1 = h('input', {
    class: 'v2-input-redondo',
    type: 'password',
    maxLength: '4',
    placeholder: '••••',
    style: 'font-size: 24px; text-align: center; letter-spacing: 0.3em; background-color: #E9E4D8;'
  });
  const inputPin2 = h('input', {
    class: 'v2-input-redondo',
    type: 'password',
    maxLength: '4',
    placeholder: 'Confirma el PIN',
    style: 'font-size: 16px; text-align: center; letter-spacing: 0.1em; background-color: #E9E4D8;'
  });

  const modal = h('div', {
    class: 'v2-modal-overlay',
    style: 'position: fixed; inset: 0; background: rgba(23,23,26,0.7); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px;'
  },
    h('div', {
      style: 'width: 100%; max-width: 360px; background-color: #F3F0E8; border-radius: 28px; padding: 24px; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 10px 30px rgba(23,23,26,.2); font-family: "Bricolage Grotesque", sans-serif;'
    },
      h('h3', { style: 'font-family: "Instrument Serif", Georgia, serif; font-size: 28px; font-weight: 400;' }, 'Crear ', h('em', {}, 'PIN')),
      h('p', { style: 'font-size: 13px; color: #6B675F;' }, 'Elige 4 números para proteger tu app:'),
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
 */
function renderizarSeccionDatos() {
  const chkFotos = h('input', {
    type: 'checkbox',
    style: 'width: 18px; height: 18px; accent-color: #C8F03C; cursor: pointer;'
  });

  const inputCopiaFile = h('input', {
    type: 'file',
    accept: '.json',
    style: 'display: none;',
    on: { change: async (e) => { await procesarArchivoImportar(e.target.files[0], 'todo'); } }
  });

  const inputHistorialFile = h('input', {
    type: 'file',
    accept: '.json',
    style: 'display: none;',
    on: { change: async (e) => { await procesarArchivoImportar(e.target.files[0], 'historial'); } }
  });

  return h('div', { class: 'v2-tarjeta' },
    inputCopiaFile,
    inputHistorialFile,
    h('h2', { class: 'v2-serif-title' },
      iconoNodo('disco', ICONOS_SVGS.disco),
      'Copia de ', h('em', {}, 'seguridad')
    ),
    h('p', { style: 'font-size: 13px; color: #6B675F;' },
      'Tus datos viven exclusivamente en este dispositivo. Descarga una copia periódicamente.'
    ),
    h('label', { style: 'display: flex; align-items: center; gap: 10px; font-size: 13px; cursor: pointer;' },
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
 * Lee y procesa un archivo JSON para importación
 */
async function procesarArchivoImportar(archivo, tipo) {
  if (!archivo) return;
  try {
    const texto = await archivo.text();
    const obj = JSON.parse(texto);

    if (tipo === 'todo') {
      const res = await importarTodo(obj);
      aviso(`Copia importada: ${res.agregados || 0} nuevos, ${res.actualizados || 0} actualizados`, 'ok');
      await recargarDatos();
      await renderizar();
    } else {
      let contSesiones = 0;
      let contSeries = 0;

      if (obj.sesiones && Array.isArray(obj.sesiones)) {
        for (const s of obj.sesiones) {
          await guardar('sesiones', s);
          contSesiones++;
        }
      }
      if (obj.series && Array.isArray(obj.series)) {
        for (const se of obj.series) {
          await guardar('series', se);
          contSeries++;
        }
      }

      aviso(`Historial importado: ${contSesiones} sesiones y ${contSeries} series`, 'ok');
    }
  } catch (err) {
    console.error('Error al importar:', err);
    aviso('Error al leer el archivo JSON: formato inválido', 'error');
  }
}

/**
 * 5. Sección IA Local (WebLLM)
 */
function renderizarSeccionIA() {
  const tieneWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator && !!navigator.gpu;
  const activa = !!iaAjustes?.activa;
  const modeloPrincipal = WEBLLM_MODELO || 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';
  const modeloRespaldo = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC';

  if (iaAjustes.modelo !== modeloPrincipal && iaAjustes.modelo !== modeloRespaldo) {
    iaAjustes.modelo = modeloPrincipal;
  }

  const barraProg = h('div', { class: 'v2-barra-track', style: 'display: none; margin-top: 8px;' },
    h('div', { class: 'v2-barra-lima', style: 'width: 0%;' })
  );
  const textoProgreso = h('div', { style: 'font-size: 12px; color: #6B675F; margin-top: 4px; display: none;' });

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
      `1.5B ≈ 1,1 GB (Recomendado: ${modeloPrincipal})`
    ),
    h('option', { value: modeloRespaldo, selected: iaAjustes.modelo === modeloRespaldo },
      `0.5B ≈ 0,4 GB (Ligero: ${modeloRespaldo})`
    )
  );

  return h('div', { class: 'v2-tarjeta' },
    h('h2', { class: 'v2-serif-title' },
      iconoNodo('ia', ICONOS_SVGS.ia),
      'IA local en el ', h('em', {}, 'teléfono')
    ),
    h('p', { style: 'font-size: 13px; color: #6B675F;' },
      'Entrenador inteligente que analiza tus datos sin internet mediante WebGPU.'
    ),
    !tieneWebGPU
      ? h('div', {
          style: 'background-color: #F3F0E8; border-radius: 999px; padding: 10px 16px; font-size: 13px; color: #E2553A; display: flex; align-items: center; gap: 8px;'
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
      h('label', { style: 'font-size: 12px; font-weight: 600; color: #6B675F;' }, 'Modelo de IA local:'),
      selectModelo
    ),
    h('div', { style: 'display: flex; justify-content: space-between; align-items: center; background-color: #F3F0E8; border-radius: 28px; padding: 14px 20px;' },
      h('div', {},
        h('div', { style: 'font-weight: 600; font-size: 15px;' }, 'Activar IA en Coach'),
        h('div', { style: 'font-size: 12px; color: #6B675F;' }, `Estado: ${activa ? 'Activada' : 'Desactivada'}`)
      ),
      h('button', {
        class: `v2-btn-pildora ${activa ? 'v2-btn-lima' : ''}`,
        style: 'height: 42px; width: auto; padding: 0 18px;',
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
        style: 'flex: 1; color: #E2553A;',
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

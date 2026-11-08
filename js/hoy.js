// js/hoy.js - Pantalla «Hoy» de Forja (Dirección de Arte v2 «Revista de Sala»)
// Portada editorial: saludo con día y rutina, titular Instrument Serif enorme,
// caja «¿Cómo te fue hoy?» para consulta rápida al Coach, tarjeta de nivel,
// chips del día (proteína, agua, pasos, sueño) con barra fina lima, tarjeta de ejercicio hero de 420px,
// carrusel horizontal de ejercicios y botón lima canónico adaptativo.

import { todos, filtrar, ajuste, ponerAjuste } from './db.js';
import { h, aviso, dialogo, hoyISO, fechaBonita, formatoKg } from './ui.js';
import { ejercicios, rutina, perfil } from './datos.js';
import { pesoSugerido } from './calculos.js';
import { ir } from './app.js';
import { icono } from './iconos.js';
import { tarjetaNivel } from './logros.js';

let cleanupFn = null;
let fechaVista = null;

/**
 * Formatea el peso o carga de una serie respetando unidad ('kg' | 'placa').
 * Muestra 'placa N' cuando unidad === 'placa'.
 *
 * @param {object} s - Serie {kg, porLado, unidad}
 * @returns {string}
 */
function formatearCargaSerie(s) {
  if (!s) return 'peso corporal';
  if (s.unidad === 'placa') {
    return s.kg != null ? `placa ${s.kg}` : 'placa';
  }
  return s.kg != null ? formatoKg(s.kg, s.porLado) : 'peso corporal';
}

/**
 * Suma o resta días a una fecha ISO 'AAAA-MM-DD' en hora local.
 *
 * @param {string} iso - Fecha 'AAAA-MM-DD'
 * @param {number} deltaDias - Días a desplazar
 * @returns {string} Nueva fecha 'AAAA-MM-DD'
 */
function desplazarFechaISO(iso, deltaDias) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + deltaDias);
  const anio = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

/**
 * Monta la pantalla «Hoy» en el contenedor provisto.
 *
 * @param {HTMLElement} contenedor - Elemento DOM donde se renderiza la vista
 * @param {Array<string>} [params=[]] - Parámetros de la ruta
 */
export async function montar(contenedor, params = []) {
  contenedor.innerHTML = '';

  const hoyReal = hoyISO();

  // Sincronización de fecha activa con sessionStorage (B-04 y A2-02 de pantallas_flujo)
  if (params && params[0] && /^\d{4}-\d{2}-\d{2}$/.test(params[0])) {
    fechaVista = params[0];
  } else {
    try {
      const guardada = sessionStorage.getItem('forja_fecha_activa');
      if (guardada && /^\d{4}-\d{2}-\d{2}$/.test(guardada)) {
        fechaVista = guardada;
      } else if (!fechaVista) {
        fechaVista = hoyReal;
      }
    } catch (_) {
      if (!fechaVista) fechaVista = hoyReal;
    }
  }

  // Persistir la fecha actual en sessionStorage para sincronizar con Registrar y Comida
  try {
    sessionStorage.setItem('forja_fecha_activa', fechaVista);
  } catch (_) {}

  const hoyStr = fechaVista;

  const pantalla = h('div', { class: 'pantalla hoy-pantalla' });

  // Estilos editoriales v2 «Revista de sala» (SOLO radios 28px y 999px, sin bordes 1px, táctil >= 48px)
  const estilo = h('style', {}, `
    .hoy-pantalla {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 4px 20px 104px;
      background-color: var(--fondo, #F3F0E8);
      color: var(--texto, #17171A);
      font-family: 'Bricolage Grotesque', system-ui, -apple-system, sans-serif;
    }
    .hoy-header {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-top: 4px;
    }
    /* MEDIO-01: Evitar colisión en 360 px con flex-wrap y elipsis */
    .hoy-saludo-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }
    .hoy-saludo {
      font-size: 14px;
      color: var(--sutil, #5D5951);
      font-weight: 500;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1 1 140px;
    }
    .hoy-fecha-controles {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }
    .hoy-btn-dia {
      min-width: 48px;
      min-height: 48px;
      border-radius: 999px;
      border: none;
      background-color: var(--superficie2, #E9E4D8);
      color: var(--texto, #17171A);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      padding: 0 12px;
      font-family: inherit;
      font-size: 12px;
      font-weight: 700;
      transition: transform 120ms ease;
    }
    .hoy-btn-dia:active {
      transform: scale(0.96);
    }
    .hoy-btn-dia.volver-hoy {
      background-color: var(--lima, #C8F03C);
      color: #17171A;
    }
    .hoy-titular {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 40px;
      font-weight: 400;
      color: var(--texto, #17171A);
      line-height: 1.05;
      letter-spacing: -0.02em;
    }
    .hoy-titular em {
      font-style: italic;
    }
    .hoy-meta-mes {
      font-size: 13px;
      color: var(--sutil, #5D5951);
      font-weight: 500;
      line-height: 1.35;
      margin-top: 2px;
    }
    /* Estilos para la caja rápida del Coach y tarjeta de nivel */
    .hoy-caja-coach {
      background-color: var(--superficie2, #E9E4D8);
      border-radius: 28px;
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      cursor: pointer;
      transition: transform 120ms ease;
    }
    .hoy-caja-coach:active {
      transform: scale(0.99);
    }
    .hoy-caja-coach-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    .hoy-caja-coach-titulo-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .hoy-caja-coach-titulo {
      font-weight: 700;
      font-size: 15px;
      color: var(--texto, #17171A);
      margin: 0;
    }
    .hoy-caja-coach-sublink {
      font-size: 12px;
      font-weight: 600;
      color: var(--sutil, #5D5951);
    }
    .hoy-caja-coach-form {
      display: flex;
      gap: 8px;
      align-items: center;
      margin: 0;
    }
    .hoy-caja-coach-input {
      flex: 1;
      min-width: 0;
      height: 44px;
      border-radius: 999px;
      border: none;
      background-color: var(--fondo, #F3F0E8);
      padding: 0 16px;
      font-size: 13px;
      font-family: inherit;
      color: var(--texto, #17171A);
    }
    .hoy-caja-coach-input:focus {
      outline: 2px solid var(--lima, #C8F03C);
    }
    .hoy-caja-coach-btn {
      min-width: 44px;
      min-height: 44px;
      width: 44px;
      height: 44px;
      border-radius: 999px;
      border: none;
      background-color: var(--lima, #C8F03C);
      color: #17171A;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      transition: transform 120ms ease;
    }
    .hoy-caja-coach-btn:active {
      transform: scale(0.92);
    }
    .tarjeta-nivel-widget {
      transition: transform 120ms ease;
    }
    .tarjeta-nivel-widget:active {
      transform: scale(0.98);
    }
    .chips-nutricion-row {
      display: flex;
      gap: 10px;
    }
    .chip-nutricion {
      flex: 1;
      min-height: 60px;
      background-color: var(--superficie2, #E9E4D8);
      border-radius: 28px;
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 6px;
      cursor: pointer;
      user-select: none;
      transition: transform 120ms ease;
    }
    .chip-nutricion:active {
      transform: scale(0.98);
    }
    .chip-nutricion-info {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-size: 13px;
      font-weight: 700;
      color: var(--texto, #17171A);
      gap: 4px;
    }
    .chip-nutricion-info span.meta-sutil {
      color: var(--sutil, #5D5951);
      font-weight: 500;
      font-size: 11px;
    }
    /* ALTO-01 y MEDIO-02: Botones de agua independientes con touch target >= 48px */
    .chip-agua-contenedor {
      flex: 1;
      min-height: 60px;
      background-color: var(--superficie2, #E9E4D8);
      border-radius: 28px;
      padding: 8px 12px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 6px;
    }
    .chip-agua-fila-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .chip-agua-texto {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .chip-agua-cantidad {
      font-size: 13px;
      font-weight: 700;
      color: var(--texto, #17171A);
      line-height: 1.1;
    }
    .chip-agua-meta-sub {
      font-size: 11px;
      color: var(--sutil, #5D5951);
      font-weight: 500;
    }
    .chip-agua-botones {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .chip-agua-btn-touch {
      min-width: 44px;
      min-height: 44px;
      width: 44px;
      height: 44px;
      border-radius: 999px;
      border: none;
      background-color: var(--fondo, #F3F0E8);
      color: var(--texto, #17171A);
      font-family: inherit;
      font-size: 15px;
      font-weight: 800;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      padding: 0;
      transition: transform 120ms ease, background-color 120ms ease;
    }
    .chip-agua-btn-touch:active {
      transform: scale(0.92);
      background-color: var(--lima, #C8F03C);
    }
    .chip-agua-btn-touch.sumar {
      background-color: var(--lima, #C8F03C);
      color: #17171A;
    }
    .progress-bar-track {
      width: 100%;
      height: 3px;
      background-color: rgba(23, 23, 26, 0.08);
      border-radius: 999px;
      overflow: hidden;
    }
    .progress-bar-fill {
      height: 100%;
      background-color: var(--lima, #C8F03C);
      border-radius: 999px;
      transition: width 240ms ease;
    }
    .hoy-acciones-secundarias {
      display: flex;
      gap: 10px;
    }
    .hoy-pildora-link {
      flex: 1;
      min-height: 48px;
      height: 48px;
      background-color: var(--superficie2, #E9E4D8);
      border: none;
      border-radius: 999px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      text-decoration: none;
      color: var(--texto, #17171A);
      font-family: inherit;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 140ms ease;
    }
    .hoy-pildora-link:active {
      transform: scale(0.97);
    }
    .hero-exercise-card {
      width: 100%;
      height: 420px;
      border-radius: 28px;
      position: relative;
      overflow: hidden;
      background-color: #17171A;
      flex-shrink: 0;
      cursor: pointer;
    }
    .media-treated {
      filter: contrast(1.05) saturate(0.9);
      object-fit: cover;
      display: block;
      width: 100%;
      height: 100%;
    }
    .hero-exercise-card video,
    .hero-exercise-card img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }
    .hero-exercise-gradient {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(23,23,26,0.1) 20%, rgba(23,23,26,0.4) 55%, rgba(23,23,26,0.92) 100%);
      z-index: 2;
    }
    .hero-exercise-content {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 24px 22px;
      z-index: 3;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .micro-label {
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      font-weight: 700;
      line-height: 1;
      color: var(--lima, #C8F03C);
    }
    /* CRÍTICO-02: Contraste legible de micro-label sobre fondo beige de la tarjeta de descanso */
    .hoy-descanso-card .micro-label {
      color: var(--sutil, #5D5951);
      letter-spacing: 0.14em;
    }
    .hero-exercise-title {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 32px;
      font-weight: 400;
      color: #F3F0E8;
      line-height: 1.1;
      letter-spacing: -0.01em;
    }
    .hero-exercise-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 2px;
    }
    .hero-exercise-pill {
      align-self: flex-start;
      background-color: #F3F0E8;
      color: #17171A;
      border-radius: 999px;
      padding: 6px 14px;
      font-size: 13px;
      font-weight: 600;
    }
    .hero-exercise-pill.sugerido {
      background-color: var(--lima, #C8F03C);
      color: #17171A;
    }
    .section-headline {
      font-size: 14px;
      font-weight: 600;
      color: var(--texto, #17171A);
      margin-top: 6px;
    }
    .horizontal-scroll-list {
      display: flex;
      gap: 12px;
      overflow-x: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
      margin: 0 -20px;
      padding: 0 20px;
    }
    .horizontal-scroll-list::-webkit-scrollbar {
      display: none;
    }
    .mini-exercise-card {
      width: 148px;
      height: 160px;
      border-radius: 28px;
      background-color: var(--superficie2, #E9E4D8);
      position: relative;
      overflow: hidden;
      flex-shrink: 0;
      cursor: pointer;
      transition: transform 140ms ease;
    }
    .mini-exercise-card:active {
      transform: scale(0.97);
    }
    .mini-exercise-card img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .mini-exercise-gradient {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(23,23,26,0) 30%, rgba(23,23,26,0.85) 100%);
      z-index: 1;
    }
    .mini-exercise-info {
      position: absolute;
      bottom: 12px;
      left: 14px;
      right: 14px;
      z-index: 2;
    }
    .mini-exercise-name {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 18px;
      color: #F3F0E8;
      line-height: 1.15;
    }
    .mini-exercise-series {
      font-size: 11px;
      color: var(--lima, #C8F03C);
      font-weight: 600;
      margin-top: 2px;
    }
    .btn-primary-lima {
      width: 100%;
      min-height: 60px;
      height: 60px;
      background-color: var(--lima, #C8F03C);
      border: none;
      border-radius: 999px;
      color: #17171A;
      font-family: 'Bricolage Grotesque', system-ui, -apple-system, sans-serif;
      font-size: 17px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 10px 0 26px;
      cursor: pointer;
      text-decoration: none;
      transition: transform 160ms cubic-bezier(.2,.8,.2,1);
      margin-top: 6px;
    }
    .btn-primary-lima:active {
      transform: scale(0.97);
    }
    .btn-primary-lima .btn-icon-bubble {
      width: 44px;
      height: 44px;
      background-color: #17171A;
      border-radius: 999px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--lima, #C8F03C);
      flex-shrink: 0;
    }
    .hoy-descanso-card {
      width: 100%;
      height: 360px;
      border-radius: 28px;
      background-color: var(--superficie2, #E9E4D8);
      padding: 32px 24px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      text-align: left;
    }
    .hoy-descanso-titular {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 34px;
      color: var(--texto, #17171A);
      line-height: 1.1;
    }
    .hoy-descanso-sub {
      font-size: 14px;
      color: var(--sutil, #5D5951);
      line-height: 1.45;
      margin-top: 8px;
    }
  `);
  pantalla.appendChild(estilo);

  // Cargar datos en paralelo incluyendo diario-AAAA-MM-DD para pasos y sueño
  const [
    datosPerfil,
    datosRutina,
    catalogoEjercicios,
    seriesTotales,
    comidasHoy,
    aguaVasos,
    diarioHoy
  ] = await Promise.all([
    perfil(),
    rutina(),
    ejercicios(),
    todos('series'),
    filtrar('comidas', c => c.fecha === hoyStr),
    ajuste('agua-' + hoyStr, 0),
    ajuste('diario-' + hoyStr, { pasos: 0, suenoH: null })
  ]);

  // Cargar widget de tarjeta de nivel (desde ./logros.js)
  let nodoNivel = null;
  try {
    if (typeof tarjetaNivel === 'function') {
      nodoNivel = await tarjetaNivel();
    }
  } catch (err) {
    console.warn('Error al cargar tarjetaNivel:', err);
  }

  if (!nodoNivel) {
    nodoNivel = h('div', {
      class: 'tarjeta tarjeta-nivel-widget',
      style: 'background-color: var(--superficie2, #E9E4D8); border-radius: 28px; padding: 18px 20px; display: flex; flex-direction: column; gap: 10px; cursor: pointer; text-decoration: none; color: inherit;',
      on: { click: () => ir('#logros') }
    },
      h('div', { style: 'display: flex; justify-content: space-between; align-items: baseline;' },
        h('div', { style: 'display: flex; align-items: center; gap: 8px;' },
          icono('coach', 18),
          h('span', { style: 'font-weight: 700; font-size: 15px; color: var(--texto, #17171A);' }, 'Nivel 1 · Hierro crudo')
        ),
        h('span', { style: 'font-size: 13px; font-weight: 700; color: var(--texto, #17171A);' }, '0%')
      ),
      h('div', { style: 'width: 100%; height: 6px; background-color: rgba(23, 23, 26, 0.08); border-radius: 999px; overflow: hidden;' },
        h('div', { style: 'width: 0%; height: 100%; background-color: var(--lima, #C8F03C); border-radius: 999px;' })
      ),
      h('div', { style: 'display: flex; justify-content: space-between; align-items: center;' },
        h('span', { style: 'font-size: 12px; color: var(--sutil, #6B675F);' }, '0 XP acumulada'),
        h('span', { style: 'font-size: 13px; font-weight: 700; color: var(--texto, #17171A); text-decoration: underline;' }, 'Ver logros')
      )
    );
  }

  const mapaCatalogo = new Map(catalogoEjercicios.map(e => [e.id, e]));

  // ==========================================
  // 1. SALUDO, SELECTOR DE FECHA Y TITULAR INSTRUMENT SERIF
  // ==========================================
  const fechaHoyDate = new Date(hoyStr + 'T12:00:00');
  const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const diaClaveHoy = diasSemana[fechaHoyDate.getDay()];
  const rutinaHoy = datosRutina?.dias?.[diaClaveHoy];

  // Saludo pequeño con día y rutina: "Sábado 7 · espalda y brazos"
  const nombreDiaCapitalizado = fechaBonita(hoyStr);
  const nombreRutina = rutinaHoy?.nombre ? rutinaHoy.nombre.toLowerCase() : 'descanso programado';
  const textoSaludo = `${nombreDiaCapitalizado} · ${nombreRutina}`;

  // Titular serif enorme: «N días para <meta>» (cursiva en «N días»)
  let textoMetaEm = '21 días';
  let textoMetaResto = 'para el grado';

  if (datosPerfil?.metaFecha) {
    const fMeta = new Date(datosPerfil.metaFecha + 'T12:00:00');
    const diffMs = fMeta.getTime() - new Date(hoyReal + 'T12:00:00').getTime();
    const numeroDias = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
    const nombreMeta = datosPerfil.metaNombre || 'la meta';

    if (numeroDias > 0) {
      textoMetaEm = `${numeroDias} días`;
      textoMetaResto = `para ${nombreMeta}`;
    } else if (numeroDias === 0) {
      textoMetaEm = '¡Hoy es el día';
      textoMetaResto = `de ${nombreMeta}!`;
    } else {
      textoMetaEm = '¡Meta alcanzada!';
      textoMetaResto = nombreMeta;
    }
  } else if (datosPerfil?.metaNombre) {
    textoMetaEm = 'Meta activa:';
    textoMetaResto = datosPerfil.metaNombre;
  }

  // Controles de navegación de fecha con sincronización en sessionStorage (A2-02)
  const controlesFecha = h('div', { class: 'hoy-fecha-controles' },
    h('button', {
      class: 'hoy-btn-dia',
      type: 'button',
      'aria-label': 'Día anterior',
      on: {
        click: async () => {
          fechaVista = desplazarFechaISO(hoyStr, -1);
          try { sessionStorage.setItem('forja_fecha_activa', fechaVista); } catch (_) {}
          await montar(contenedor, [fechaVista]);
        }
      }
    }, icono('atras', 16)),
    hoyStr !== hoyReal ? h('button', {
      class: 'hoy-btn-dia volver-hoy',
      type: 'button',
      on: {
        click: async () => {
          fechaVista = hoyReal;
          try { sessionStorage.setItem('forja_fecha_activa', fechaVista); } catch (_) {}
          await montar(contenedor, []);
        }
      }
    }, 'Hoy') : null,
    h('button', {
      class: 'hoy-btn-dia',
      type: 'button',
      'aria-label': 'Día siguiente',
      on: {
        click: async () => {
          fechaVista = desplazarFechaISO(hoyStr, 1);
          try { sessionStorage.setItem('forja_fecha_activa', fechaVista); } catch (_) {}
          await montar(contenedor, [fechaVista]);
        }
      }
    }, icono('flecha', 16))
  );

  const headerHoy = h('div', { class: 'hoy-header' },
    h('div', { class: 'hoy-saludo-row' },
      h('span', { class: 'hoy-saludo' }, textoSaludo),
      controlesFecha
    ),
    h('h2', { class: 'hoy-titular' },
      h('em', {}, textoMetaEm),
      ' ' + textoMetaResto
    ),
    datosPerfil?.metaMes ? h('p', { class: 'hoy-meta-mes' }, `Meta del mes: ${datosPerfil.metaMes}`) : null
  );
  pantalla.appendChild(headerHoy);

  // ==========================================
  // CAJA «¿CÓMO TE FUE HOY?» Y TARJETA DE NIVEL
  // (SIEMPRE visibles todos los días debajo del titular, antes de la rutina o descanso)
  // ==========================================
  const inputCoach = h('input', {
    type: 'text',
    class: 'hoy-caja-coach-input',
    placeholder: '«Dormí 5 horas y me duele el hombro» o «Hice jalón 45 8 8 6»',
    'aria-label': 'Mensaje para el coach'
  });

  const enviarAlCoach = (texto) => {
    const t = String(texto || '').trim();
    if (t) {
      try {
        sessionStorage.setItem('forja-coach-pendiente', t);
      } catch (_) {}
    }
    ir('#coach');
  };

  inputCoach.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      enviarAlCoach(inputCoach.value);
    }
  });

  inputCoach.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  const cajaCoach = h('div', {
    class: 'tarjeta hoy-caja-coach',
    on: { click: () => ir('#coach') }
  },
    h('div', { class: 'hoy-caja-coach-top' },
      h('div', { class: 'hoy-caja-coach-titulo-wrap' },
        icono('coach', 18),
        h('h3', { class: 'hoy-caja-coach-titulo' }, '¿Cómo te fue hoy?')
      ),
      h('span', { class: 'hoy-caja-coach-sublink' }, 'Preguntar al Coach')
    ),
    h('form', {
      class: 'hoy-caja-coach-form',
      on: {
        submit: (e) => {
          e.preventDefault();
          enviarAlCoach(inputCoach.value);
        }
      }
    },
      inputCoach,
      h('button', {
        type: 'submit',
        class: 'hoy-caja-coach-btn',
        'aria-label': 'Enviar al Coach'
      }, icono('flecha-derecha', 18))
    )
  );

  // Se muestran SIEMPRE, todos los días, debajo del titular, antes de la rutina o del aviso de descanso
  pantalla.appendChild(cajaCoach);
  pantalla.appendChild(nodoNivel);

  // ==========================================
  // 2. CHIPS DEL DÍA: PROTEÍNA, AGUA, PASOS Y SUEÑO
  // ==========================================
  const proteinaMeta = Number(datosPerfil?.proteina || 128);
  const proteinaTotalHoy = comidasHoy.reduce((acc, c) => acc + (Number(c.proteina) || 0), 0);
  const pctProteina = Math.min(100, Math.round((proteinaTotalHoy / proteinaMeta) * 100));

  const aguaMetaVasos = Number(datosPerfil?.aguaVasos || 10);
  const vasosActuales = Number(aguaVasos || 0);
  const pctAgua = Math.min(100, Math.round((vasosActuales / aguaMetaVasos) * 100));
  const aguaLitros = (vasosActuales * 0.25).toFixed(1);
  const metaAguaLitros = (aguaMetaVasos * 0.25).toFixed(1);

  // Fila de Nutrición: Proteína y Agua (ALTO-01 y MEDIO-02 resueltos con controles accesibles)
  const filaNutricion = h('div', { class: 'chips-nutricion-row' },
    // Chip Proteína (tocar navega a #comida sincronizando fecha)
    h('div', {
      class: 'chip-nutricion',
      on: {
        click: () => {
          try { sessionStorage.setItem('forja_fecha_activa', hoyStr); } catch (_) {}
          ir('#comida');
        }
      }
    },
      h('div', { class: 'chip-nutricion-info' },
        h('span', {}, `${Math.round(proteinaTotalHoy)} g`),
        h('span', { class: 'meta-sutil' }, `/ ${proteinaMeta} g prote`)
      ),
      h('div', { class: 'progress-bar-track' },
        h('div', { class: 'progress-bar-fill', style: `width: ${pctProteina}%;` })
      )
    ),
    // Tarjeta Agua con botones dedicados de 44-48 px
    h('div', { class: 'chip-agua-contenedor' },
      h('div', { class: 'chip-agua-fila-top' },
        h('div', { class: 'chip-agua-texto' },
          h('span', { class: 'chip-agua-cantidad' }, `${aguaLitros} L agua`),
          h('span', { class: 'chip-agua-meta-sub' }, `meta: ${metaAguaLitros} L`)
        ),
        h('div', { class: 'chip-agua-botones' },
          vasosActuales > 0 ? h('button', {
            type: 'button',
            class: 'chip-agua-btn-touch',
            'aria-label': 'Restar 1 vaso de agua',
            on: {
              click: async (e) => {
                e.stopPropagation();
                const nuevoTotal = Math.max(0, vasosActuales - 1);
                await ponerAjuste('agua-' + hoyStr, nuevoTotal);
                aviso(`−1 vaso de agua (${nuevoTotal}/${aguaMetaVasos})`, 'info');
                await montar(contenedor, params);
              }
            }
          }, '−') : null,
          h('button', {
            type: 'button',
            class: 'chip-agua-btn-touch sumar',
            'aria-label': 'Sumar 1 vaso de agua',
            on: {
              click: async (e) => {
                e.stopPropagation();
                const nuevoTotal = vasosActuales + 1;
                await ponerAjuste('agua-' + hoyStr, nuevoTotal);
                aviso(`+1 vaso de agua (${nuevoTotal}/${aguaMetaVasos})`, 'ok');
                await montar(contenedor, params);
              }
            }
          }, '+')
        )
      ),
      h('div', { class: 'progress-bar-track' },
        h('div', { class: 'progress-bar-fill', style: `width: ${pctAgua}%;` })
      )
    )
  );
  pantalla.appendChild(filaNutricion);

  // Segunda fila de chips del día: Pasos (manual) y Sueño (manual) en diario-AAAA-MM-DD
  const pasosMeta = Number(datosPerfil?.pasos || 9000);
  const pasosHoy = Number(diarioHoy?.pasos || 0);
  const pctPasos = Math.min(100, Math.round((pasosHoy / pasosMeta) * 100));

  const suenoMeta = 8;
  const suenoHoy = diarioHoy?.suenoH != null ? Number(diarioHoy.suenoH) : null;
  const pctSueno = suenoHoy != null ? Math.min(100, Math.round((suenoHoy / suenoMeta) * 100)) : 0;

  const filaDiario = h('div', { class: 'chips-nutricion-row' },
    // Chip Pasos
    h('div', {
      class: 'chip-nutricion',
      on: {
        click: async () => {
          const inputPasos = h('input', {
            type: 'number',
            min: '0',
            step: '500',
            value: String(pasosHoy || ''),
            placeholder: String(pasosMeta),
            style: 'width: 100%; height: 48px; border-radius: 999px; border: none; background: var(--superficie2, #E9E4D8); padding: 0 18px; font-size: 16px; font-weight: 700; color: var(--texto, #17171A);'
          });
          const resp = await dialogo({
            titulo: 'Pasos del día',
            cuerpo: h('div', { class: 'col', style: 'gap: 8px;' },
              h('span', { style: 'font-size: 13px; color: var(--sutil, #5D5951);' }, `Meta diaria: ${pasosMeta} pasos`),
              inputPasos
            ),
            botones: [
              { texto: 'Cancelar', valor: false, tipo: 'fantasma' },
              { texto: 'Guardar', valor: true, tipo: 'primario' }
            ]
          });
          if (resp) {
            const val = Math.max(0, parseInt(inputPasos.value || '0', 10) || 0);
            await ponerAjuste('diario-' + hoyStr, { ...(diarioHoy || {}), pasos: val });
            aviso(`Pasos actualizados: ${val}`, 'ok');
            await montar(contenedor, params);
          }
        }
      }
    },
      h('div', { class: 'chip-nutricion-info' },
        h('span', {}, `${pasosHoy}`),
        h('span', { class: 'meta-sutil' }, `/ ${pasosMeta} pasos`)
      ),
      h('div', { class: 'progress-bar-track' },
        h('div', { class: 'progress-bar-fill', style: `width: ${pctPasos}%;` })
      )
    ),
    // Chip Sueño
    h('div', {
      class: 'chip-nutricion',
      on: {
        click: async () => {
          const inputSueno = h('input', {
            type: 'number',
            min: '0',
            max: '24',
            step: '0.5',
            value: suenoHoy != null ? String(suenoHoy) : '7.5',
            placeholder: '8',
            style: 'width: 100%; height: 48px; border-radius: 999px; border: none; background: var(--superficie2, #E9E4D8); padding: 0 18px; font-size: 16px; font-weight: 700; color: var(--texto, #17171A);'
          });
          const resp = await dialogo({
            titulo: 'Horas de sueño',
            cuerpo: h('div', { class: 'col', style: 'gap: 8px;' },
              h('span', { style: 'font-size: 13px; color: var(--sutil, #5D5951);' }, '¿Cuántas horas dormiste anoche?'),
              inputSueno
            ),
            botones: [
              { texto: 'Cancelar', valor: false, tipo: 'fantasma' },
              { texto: 'Guardar', valor: true, tipo: 'primario' }
            ]
          });
          if (resp) {
            const valNum = parseFloat(String(inputSueno.value || '').replace(',', '.'));
            const val = !isNaN(valNum) ? Math.max(0, Math.min(24, Math.round(valNum * 10) / 10)) : null;
            await ponerAjuste('diario-' + hoyStr, { ...(diarioHoy || {}), suenoH: val });
            aviso(val != null ? `Sueño registrado: ${val} h` : 'Sueño actualizado', 'ok');
            await montar(contenedor, params);
          }
        }
      }
    },
      h('div', { class: 'chip-nutricion-info' },
        h('span', {}, `${suenoHoy != null ? suenoHoy + ' h' : '— h'}`),
        h('span', { class: 'meta-sutil' }, `/ ${suenoMeta} h sueño`)
      ),
      h('div', { class: 'progress-bar-track' },
        h('div', { class: 'progress-bar-fill', style: `width: ${pctSueno}%;` })
      )
    )
  );
  pantalla.appendChild(filaDiario);

  // ==========================================
  // 3. ACCESOS DIRECTOS A #comida Y #camara (Sin emojis)
  // ==========================================
  const accesosSecundarios = h('div', { class: 'hoy-acciones-secundarias' },
    h('button', {
      class: 'hoy-pildora-link',
      on: {
        click: () => {
          try { sessionStorage.setItem('forja_fecha_activa', hoyStr); } catch (_) {}
          ir('#comida');
        }
      }
    },
      icono('comida'),
      h('span', {}, 'Registrar comida')
    ),
    h('button', {
      class: 'hoy-pildora-link',
      on: { click: () => ir('#camara') }
    },
      icono('camara'),
      h('span', {}, 'Cámara y medidas')
    )
  );
  pantalla.appendChild(accesosSecundarios);

  // ==========================================
  // 4. TARJETA-VIDEO DEL PRIMER EJERCICIO QUE FALTA
  //    Y CARRUSEL HORIZONTAL DE LOS DEMÁS
  // ==========================================
  const ejerciciosHoy = Array.isArray(rutinaHoy?.ejercicios) ? rutinaHoy.ejercicios : [];
  let primerPendiente = null;
  let todosCompletados = false;

  if (ejerciciosHoy.length > 0) {
    // Clasificar ejercicios: completados vs pendientes hoy
    const datosEjerciciosHoy = ejerciciosHoy.map(item => {
      const ejInfo = mapaCatalogo.get(item.id) || { id: item.id, nombre: item.id };
      const ejercicioCompleto = { ...ejInfo, ...item };

      // Series históricas ordenadas cronológicamente
      const seriesEsteEj = seriesTotales
        .filter(s => s && s.ejercicioId === item.id)
        .sort((a, b) => (a.fecha > b.fecha ? 1 : a.fecha < b.fecha ? -1 : (a.hora || 0) - (b.hora || 0)));

      const seriesDeHoy = seriesEsteEj.filter(s => s.fecha === hoyStr);
      const completadoHoy = seriesDeHoy.length >= (item.series || 3);

      // Última sesión previa
      const fechasUnicas = [...new Set(seriesEsteEj.map(s => s.fecha))];
      const fechasPrevias = fechasUnicas.filter(f => f < hoyStr);
      const fechaUltima = fechasPrevias.length > 0
        ? fechasPrevias[fechasPrevias.length - 1]
        : (fechasUnicas.length > 0 && seriesDeHoy.length === 0 ? fechasUnicas[fechasUnicas.length - 1] : null);

      const seriesUltima = fechaUltima
        ? seriesEsteEj.filter(s => s.fecha === fechaUltima)
        : [];

      const sugerencia = pesoSugerido(seriesUltima, ejercicioCompleto);

      // Resumen de la última sesión para la píldora papel
      let resumenUltima = 'Primera sesión';
      if (seriesUltima.length > 0) {
        const pSerie = seriesUltima[seriesUltima.length - 1];
        const cargaTxt = formatearCargaSerie(pSerie);
        const repsLista = seriesUltima.map(s => s.reps).join(', ');
        resumenUltima = `${cargaTxt} · ${repsLista}`;
      }

      // Resumen de peso sugerido con doble progresión (+1 rep cuando no llegó al tope)
      const textoSugerido = sugerencia.kg != null
        ? `Sugerido: ${formatearCargaSerie(sugerencia)} × ${sugerencia.reps}`
        : `Objetivo: ${sugerencia.reps} reps`;

      return {
        item,
        ejInfo,
        ejercicioCompleto,
        seriesDeHoy,
        completadoHoy,
        seriesUltima,
        sugerencia,
        resumenUltima,
        textoSugerido
      };
    });

    todosCompletados = datosEjerciciosHoy.every(d => d.completadoHoy);

    // Encontrar el primer ejercicio que aún falta hoy, o el primero si todos están listos
    primerPendiente = datosEjerciciosHoy.find(d => !d.completadoHoy) || datosEjerciciosHoy[0];

    const restantes = datosEjerciciosHoy.filter(d => d.item.id !== primerPendiente.item.id);

    // TARJETA HÉROE grande (alto 420px, radio 28, degradado oscuro abajo, nombre en serif blanco, píldora con última vez)
    // Sincroniza fecha activa con sessionStorage antes de navegar
    const ejHeroId = primerPendiente.item.id;
    const rutaVideo = primerPendiente.ejInfo.video || null;
    const rutaFotoHero = primerPendiente.ejInfo.imagen || null;

    const tarjetaVideoHero = h('div', {
      class: 'hero-exercise-card',
      on: {
        click: () => {
          try { sessionStorage.setItem('forja_fecha_activa', hoyStr); } catch (_) {}
          ir('#registrar/' + ejHeroId);
        }
      }
    },
      rutaVideo
        ? h('video', Object.assign({
            autoplay: true,
            muted: true,
            loop: true,
            playsinline: true,
            class: 'media-treated',
            src: rutaVideo
          }, rutaFotoHero ? { poster: rutaFotoHero } : {}))
        : (rutaFotoHero
          ? h('img', { src: rutaFotoHero, class: 'media-treated', alt: primerPendiente.ejInfo.nombre, style: 'object-fit: cover;' })
          : h('div', { style: 'width: 100%; height: 100%; background: linear-gradient(135deg, #232328 0%, #17171A 100%);' })),
      h('div', { class: 'hero-exercise-gradient' }),
      h('div', { class: 'hero-exercise-content' },
        h('span', { class: 'micro-label' },
          todosCompletados ? '¡SESIÓN COMPLETADA!' : (primerPendiente.completadoHoy ? 'COMPLETADO HOY' : 'PRIMER EJERCICIO')
        ),
        h('h3', { class: 'hero-exercise-title' }, primerPendiente.ejInfo.nombre || ejHeroId),
        h('div', { class: 'hero-exercise-pills' },
          h('div', { class: 'hero-exercise-pill' }, primerPendiente.resumenUltima),
          h('div', { class: 'hero-exercise-pill sugerido' }, primerPendiente.textoSugerido)
        )
      )
    );
    pantalla.appendChild(tarjetaVideoHero);

    // CARRUSEL HORIZONTAL de los demás ejercicios del día como fotos verticales
    if (restantes.length > 0) {
      pantalla.appendChild(h('h4', { class: 'section-headline' }, 'A continuación'));

      const carrusel = h('div', { class: 'horizontal-scroll-list' });

      for (const otro of restantes) {
        const otroId = otro.item.id;
        const fotoOtro = otro.ejInfo.imagen || null;

        const miniCard = h('div', {
          class: 'mini-exercise-card',
          on: {
            click: () => {
              try { sessionStorage.setItem('forja_fecha_activa', hoyStr); } catch (_) {}
              ir('#registrar/' + otroId);
            }
          }
        },
          fotoOtro ? h('img', { src: fotoOtro, alt: otro.ejInfo.nombre, class: 'media-treated' }) : h('div'),
          h('div', { class: 'mini-exercise-gradient' }),
          h('div', { class: 'mini-exercise-info' },
            h('div', { class: 'mini-exercise-name' }, otro.ejInfo.nombre || otroId),
            h('div', { class: 'mini-exercise-series' },
              otro.completadoHoy ? 'Listo hoy' : `${otro.item.series || 3} × ${otro.item.reps || '8-12'}`
            )
          )
        );
        carrusel.appendChild(miniCard);
      }

      pantalla.appendChild(carrusel);
    }
  } else {
    // Tarjeta editorial de descanso si no hay rutina programada hoy
    // CRÍTICO-02: micro-label con contraste >= 4.5:1 en CSS (.hoy-descanso-card .micro-label)
    const tarjetaDescanso = h('div', { class: 'hoy-descanso-card' },
      h('div', {},
        h('span', { class: 'micro-label' }, 'RECUPERACIÓN ACTIVA'),
        h('h3', { class: 'hoy-descanso-titular', style: 'margin-top: 8px;' }, 'Día de descanso programado'),
        h('p', { class: 'hoy-descanso-sub' },
          'Los músculos crecen cuando descansas y te alimentas bien. Si prefieres entrenar, puedes registrar una sesión libre.'
        )
      ),
      h('div', { class: 'hero-exercise-pill', style: 'align-self: flex-start; margin-top: 16px;' },
        'Sueño y alimentación en foco'
      )
    );
    pantalla.appendChild(tarjetaDescanso);
  }

  // ==========================================
  // 5. BOTÓN PRINCIPAL LIMA CANÓNICO
  //    (M2-03: si la rutina está 100% completada hoy, felicita e invita a ver Progreso)
  // ==========================================
  let textoBtn = 'Empezar a registrar';
  let accionBtn = () => {
    try { sessionStorage.setItem('forja_fecha_activa', hoyStr); } catch (_) {}
    const ruta = primerPendiente ? `#registrar/${primerPendiente.item.id}` : '#registrar';
    ir(ruta);
  };

  if (todosCompletados) {
    textoBtn = '¡Entrenamiento completado! · Ver progreso';
    accionBtn = () => ir('#progreso');
  }

  const btnRegistrar = h('button', {
    class: 'btn-primary-lima',
    on: { click: accionBtn }
  },
    h('span', {}, textoBtn),
    h('div', { class: 'btn-icon-bubble' },
      icono('flecha-derecha')
    )
  );
  pantalla.appendChild(btnRegistrar);

  // Inyectar vista completa en el contenedor
  contenedor.appendChild(pantalla);
}

/**
 * Función opcional de desmontaje.
 */
export function desmontar() {
  if (typeof cleanupFn === 'function') {
    cleanupFn();
    cleanupFn = null;
  }
}

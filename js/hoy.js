// js/hoy.js - Pantalla «Hoy» de Forja (Dirección de Arte v2 «Revista de Sala»)
// Portada editorial: saludo con día y rutina, titular Instrument Serif enorme,
// chips del día (proteína, agua, pasos, sueño) con barra fina lima, tarjeta-video de 420px
// del primer ejercicio que falta, carrusel horizontal de ejercicios y botón lima canónico.

import { todos, filtrar, ajuste, ponerAjuste } from './db.js';
import { h, aviso, dialogo, hoyISO, fechaBonita, formatoKg } from './ui.js';
import { ejercicios, rutina, perfil } from './datos.js';
import { pesoSugerido } from './calculos.js';
import { ir } from './app.js';
import { icono } from './iconos.js';

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
  if (params && params[0] && /^\d{4}-\d{2}-\d{2}$/.test(params[0])) {
    fechaVista = params[0];
  } else if (!fechaVista) {
    fechaVista = hoyReal;
  }
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
    .hoy-saludo-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .hoy-saludo {
      font-size: 14px;
      color: var(--sutil, #5D5951);
      font-weight: 500;
    }
    .hoy-fecha-controles {
      display: flex;
      align-items: center;
      gap: 4px;
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
    .chips-nutricion-row {
      display: flex;
      gap: 10px;
    }
    .chip-nutricion {
      flex: 1;
      min-height: 52px;
      background-color: var(--superficie2, #E9E4D8);
      border-radius: 999px;
      padding: 10px 16px;
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
      align-items: center;
      font-size: 12px;
      font-weight: 600;
      color: var(--texto, #17171A);
      gap: 4px;
    }
    .chip-nutricion-info span.meta-sutil {
      color: var(--sutil, #5D5951);
      font-weight: 500;
    }
    .chip-agua-menos {
      min-width: 28px;
      height: 22px;
      border-radius: 999px;
      border: none;
      background-color: var(--fondo, #F3F0E8);
      color: var(--texto, #17171A);
      font-family: inherit;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
      padding: 0 6px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
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

  // Cargar datos en paralelo incluyendo diario-AAAA-MM-DD para pasos y sueño (M-03)
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
      // Corrección B-03: evitar texto negativo cuando la meta ya se alcanzó
      textoMetaEm = '¡Meta alcanzada!';
      textoMetaResto = nombreMeta;
    }
  } else if (datosPerfil?.metaNombre) {
    textoMetaEm = 'Meta activa:';
    textoMetaResto = datosPerfil.metaNombre;
  }

  const controlesFecha = h('div', { class: 'hoy-fecha-controles' },
    h('button', {
      class: 'hoy-btn-dia',
      type: 'button',
      'aria-label': 'Día anterior',
      on: {
        click: async () => {
          fechaVista = desplazarFechaISO(hoyStr, -1);
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
  // 2. CHIPS DEL DÍA: PROTEÍNA, AGUA, PASOS Y SUEÑO (M-03 y B-01)
  // ==========================================
  const proteinaMeta = Number(datosPerfil?.proteina || 128);
  const proteinaTotalHoy = comidasHoy.reduce((acc, c) => acc + (Number(c.proteina) || 0), 0);
  const pctProteina = Math.min(100, Math.round((proteinaTotalHoy / proteinaMeta) * 100));

  const aguaMetaVasos = Number(datosPerfil?.aguaVasos || 10);
  const vasosActuales = Number(aguaVasos || 0);
  const pctAgua = Math.min(100, Math.round((vasosActuales / aguaMetaVasos) * 100));
  const aguaLitros = (vasosActuales * 0.25).toFixed(1);
  const metaAguaLitros = (aguaMetaVasos * 0.25).toFixed(1);

  const filaNutricion = h('div', { class: 'chips-nutricion-row' },
    // Chip Proteína (tocar navega a #comida)
    h('div', {
      class: 'chip-nutricion',
      on: { click: () => ir('#comida') }
    },
      h('div', { class: 'chip-nutricion-info' },
        h('span', {}, `${Math.round(proteinaTotalHoy)} g proteína`),
        h('span', { class: 'meta-sutil' }, `/ ${proteinaMeta} g`)
      ),
      h('div', { class: 'progress-bar-track' },
        h('div', { class: 'progress-bar-fill', style: `width: ${pctProteina}%;` })
      )
    ),
    // Chip Agua (tocar suma +1 vaso, botón − permite restar si se tocó por error: B-01)
    h('div', {
      class: 'chip-nutricion',
      on: {
        click: async () => {
          const nuevoTotal = vasosActuales + 1;
          await ponerAjuste('agua-' + hoyStr, nuevoTotal);
          aviso(`+1 vaso de agua (${nuevoTotal}/${aguaMetaVasos})`, 'ok');
          await montar(contenedor, params);
        }
      }
    },
      h('div', { class: 'chip-nutricion-info' },
        h('span', {}, `${aguaLitros} L agua`),
        h('div', { style: 'display: flex; align-items: center; gap: 6px;' },
          vasosActuales > 0 ? h('button', {
            type: 'button',
            class: 'chip-agua-menos',
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
          }, '−1') : null,
          h('span', { class: 'meta-sutil' }, `/ ${metaAguaLitros} L`)
        )
      ),
      h('div', { class: 'progress-bar-track' },
        h('div', { class: 'progress-bar-fill', style: `width: ${pctAgua}%;` })
      )
    )
  );
  pantalla.appendChild(filaNutricion);

  // Segunda fila de chips del día: Pasos (manual) y Sueño (manual) en diario-AAAA-MM-DD (M-03)
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
        h('span', {}, `${pasosHoy} pasos`),
        h('span', { class: 'meta-sutil' }, `/ ${pasosMeta}`)
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
        h('span', {}, `${suenoHoy != null ? suenoHoy + ' h' : '— h'} sueño`),
        h('span', { class: 'meta-sutil' }, `/ ${suenoMeta} h`)
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
      on: { click: () => ir('#comida') }
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

      // Resumen de peso sugerido con doble progresión
      const textoSugerido = sugerencia.kg != null
        ? `Hoy: ${formatearCargaSerie(sugerencia)} × ${sugerencia.reps}`
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

    // Encontrar el primer ejercicio que aún falta hoy
    primerPendiente = datosEjerciciosHoy.find(d => !d.completadoHoy) || datosEjerciciosHoy[0];

    const restantes = datosEjerciciosHoy.filter(d => d.item.id !== primerPendiente.item.id);

    // TARJETA-VIDEO grande (alto 420px, radio 28, degradado oscuro abajo, nombre en serif blanco, píldora con última vez)
    // Corrección A-01: ir directamente a #registrar/<ejercicioId>
    const ejHeroId = primerPendiente.item.id;
    const rutaVideo = primerPendiente.ejInfo.video || null;
    const rutaFotoHero = primerPendiente.ejInfo.imagen || null;

    const tarjetaVideoHero = h('div', {
      class: 'hero-exercise-card',
      on: { click: () => ir('#registrar/' + ejHeroId) }
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
          : h('div')),
      h('div', { class: 'hero-exercise-gradient' }),
      h('div', { class: 'hero-exercise-content' },
        h('span', { class: 'micro-label' }, primerPendiente.completadoHoy ? 'COMPLETADO HOY' : 'PRIMER EJERCICIO'),
        h('h3', { class: 'hero-exercise-title' }, primerPendiente.ejInfo.nombre || ejHeroId),
        h('div', { class: 'hero-exercise-pills' },
          h('div', { class: 'hero-exercise-pill' }, primerPendiente.resumenUltima),
          h('div', { class: 'hero-exercise-pill sugerido' }, primerPendiente.textoSugerido)
        )
      )
    );
    pantalla.appendChild(tarjetaVideoHero);

    // CARRUSEL HORIZONTAL de los demás ejercicios del día como fotos verticales
    // Corrección A-01: cada tarjeta abre su propio ejercicio en #registrar/<id>
    if (restantes.length > 0) {
      pantalla.appendChild(h('h4', { class: 'section-headline' }, 'A continuación'));

      const carrusel = h('div', { class: 'horizontal-scroll-list' });

      for (const otro of restantes) {
        const otroId = otro.item.id;
        const fotoOtro = otro.ejInfo.imagen || null;

        const miniCard = h('div', {
          class: 'mini-exercise-card',
          on: { click: () => ir('#registrar/' + otroId) }
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
  // 5. BOTÓN LIMA «EMPEZAR A REGISTRAR» (A-01)
  // ==========================================
  const rutaRegistrar = primerPendiente ? `#registrar/${primerPendiente.item.id}` : '#registrar';
  const btnRegistrar = h('button', {
    class: 'btn-primary-lima',
    on: { click: () => ir(rutaRegistrar) }
  },
    h('span', {}, 'Empezar a registrar'),
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

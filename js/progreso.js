// js/progreso.js - Pantalla «Progreso» de Forja (Dirección de Arte v2 «Revista de Sala»)
// Gráficas de 1RM, peso máximo y volumen por ejercicio con PRs,
// series duras semanales por músculo contra la meta (10-20),
// récord personal con titular Instrument Serif cursivo y números héroe en .grande.

import { todos, filtrar, obtener } from './db.js';
import { h, aviso, fechaBonita, formatoKg, hoyISO } from './ui.js';
import { ejercicios, ejercicio } from './datos.js';
import { unoRM, epley, brzycki, seriesPorMusculo, prs, normalizarMusculo } from './calculos.js';
import { lineas, barras } from './graficas.js';
import { FORMULA_1RM, SERIES_META } from './config.js';
import { ir } from './app.js';
import { icono } from './iconos.js';

let cleanupFn = null;

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
 * Monta la pantalla «Progreso» en el contenedor provisto.
 *
 * @param {HTMLElement} contenedor - Elemento DOM contenedor
 * @param {Array<string>} [params=[]] - Parámetros de ruta (ej: [ejercicioId])
 */
export async function montar(contenedor, params = []) {
  contenedor.innerHTML = '';

  const pantalla = h('div', { class: 'pantalla progreso-pantalla' });

  // Estilos editoriales v2: Papel, Papel 2, Tinta, Lima de tiza, radios 28px y 999px
  const estilo = h('style', {}, `
    .progreso-pantalla {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 4px 20px 104px;
      background-color: var(--fondo, #F3F0E8);
      color: var(--texto, #17171A);
      font-family: 'Bricolage Grotesque', system-ui, -apple-system, sans-serif;
    }
    .progreso-header {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-top: 4px;
    }
    .progreso-saludo {
      font-size: 14px;
      color: var(--sutil, #6B675F);
      font-weight: 500;
    }
    .progreso-titular-seccion {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 38px;
      font-weight: 400;
      color: var(--texto, #17171A);
      line-height: 1.05;
      letter-spacing: -0.02em;
    }
    .progreso-titular-seccion em {
      font-style: italic;
    }
    .progreso-tabs {
      display: flex;
      gap: 8px;
      background: var(--superficie2, #E9E4D8);
      padding: 5px;
      border-radius: 999px;
    }
    .progreso-tab-btn {
      flex: 1;
      height: 40px;
      border: none;
      background: transparent;
      color: var(--sutil, #6B675F);
      font-family: 'Bricolage Grotesque', sans-serif;
      font-weight: 600;
      font-size: 13px;
      border-radius: 999px;
      cursor: pointer;
      text-align: center;
      transition: background-color 160ms ease, color 160ms ease, transform 120ms ease;
    }
    .progreso-tab-btn:active {
      transform: scale(0.97);
    }
    .progreso-tab-btn.activo {
      background-color: var(--texto, #17171A);
      color: var(--fondo, #F3F0E8);
    }
    .progreso-subtabs {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      scrollbar-width: none;
      padding-bottom: 2px;
    }
    .progreso-subtabs::-webkit-scrollbar {
      display: none;
    }
    .progreso-subtab-chip {
      height: 38px;
      padding: 0 16px;
      border-radius: 999px;
      border: none;
      background: var(--superficie2, #E9E4D8);
      color: var(--texto, #17171A);
      font-family: 'Bricolage Grotesque', sans-serif;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: background-color 140ms ease, color 140ms ease;
    }
    .progreso-subtab-chip.activo {
      background-color: var(--lima, #C8F03C);
      color: #17171A;
    }
    .progreso-card-papel {
      background-color: var(--superficie2, #E9E4D8);
      border-radius: 28px;
      padding: 22px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .progreso-record-hero {
      background-color: #17171A;
      color: #F3F0E8;
      border-radius: 28px;
      padding: 24px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 6px;
      position: relative;
      overflow: hidden;
    }
    .progreso-record-hero .micro-label {
      color: var(--lima, #C8F03C);
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      font-weight: 700;
    }
    .progreso-record-serif {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 42px;
      font-weight: 400;
      color: #F3F0E8;
      line-height: 1.05;
      letter-spacing: -0.02em;
    }
    .progreso-record-serif em {
      font-style: italic;
    }
    .progreso-record-metric {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin: 8px 0 4px;
    }
    .progreso-record-metric .grande {
      font-family: 'Bricolage Grotesque', sans-serif;
      font-size: 72px;
      font-weight: 800;
      line-height: 0.95;
      color: #F3F0E8;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.03em;
    }
    .record-underline-svg {
      width: 200px;
      height: 18px;
      margin-top: -4px;
    }
    .record-underline-path {
      stroke: var(--lima, #C8F03C);
      stroke-width: 4;
      stroke-linecap: round;
      fill: none;
    }
    .record-pill-fuerza {
      background-color: var(--fondo, #F3F0E8);
      color: #17171A;
      border-radius: 999px;
      padding: 6px 16px;
      font-size: 13px;
      font-weight: 600;
      margin-top: 4px;
    }
    .progreso-racha-card {
      background-color: var(--superficie2, #E9E4D8);
      border-radius: 28px;
      padding: 24px 18px;
      display: flex;
      align-items: center;
      justify-content: space-around;
      text-align: center;
    }
    .progreso-racha-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .progreso-racha-item .grande {
      font-family: 'Bricolage Grotesque', sans-serif;
      font-size: 64px;
      font-weight: 800;
      line-height: 0.95;
      font-variant-numeric: tabular-nums;
      color: var(--texto, #17171A);
      letter-spacing: -0.03em;
    }
    .progreso-racha-caption {
      font-size: 13px;
      color: var(--sutil, #6B675F);
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .progreso-cal-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 6px;
      text-align: center;
    }
    .progreso-cal-celda {
      aspect-ratio: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      background: var(--fondo, #F3F0E8);
      font-size: 13px;
      font-weight: 600;
      position: relative;
      color: var(--texto, #17171A);
    }
    .progreso-cal-celda.entrenado {
      background: var(--lima, #C8F03C);
      color: #17171A;
      font-weight: 800;
    }
    .progreso-cal-celda.hoy {
      outline: 2px solid #17171A;
      outline-offset: -2px;
    }
    .progreso-cal-celda.fuera-mes {
      opacity: 0.2;
    }
    .progreso-select-ej {
      width: 100%;
      height: 48px;
      background-color: var(--superficie2, #E9E4D8);
      border: none;
      border-radius: 999px;
      padding: 0 20px;
      font-family: 'Bricolage Grotesque', sans-serif;
      font-size: 15px;
      font-weight: 600;
      color: var(--texto, #17171A);
      cursor: pointer;
      outline: none;
    }
    .progreso-sesion-item {
      background-color: var(--superficie2, #E9E4D8);
      border-radius: 999px;
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .progreso-sesion-fecha {
      font-weight: 600;
      font-size: 14px;
      color: var(--texto, #17171A);
    }
    .progreso-sesion-reps {
      font-size: 13px;
      color: var(--sutil, #6B675F);
    }
  `);
  pantalla.appendChild(estilo);

  // Cargar datos
  const [todasSeries, catalogo] = await Promise.all([
    todos('series'),
    ejercicios()
  ]);

  const mapaEjercicios = new Map(catalogo.map(e => [e.id, e]));

  // Determinar pestaña activa: 'musculos' | 'ejercicio' | 'calendario'
  let tabActiva = (params && params[0]) ? 'ejercicio' : 'musculos';
  let ejercicioSeleccionadoId = (params && params[0]) ? params[0] : null;
  let metricaSeleccionada = '1rm'; // '1rm' | 'peso' | 'volumen'
  let formulaActiva = (typeof FORMULA_1RM === 'string' ? FORMULA_1RM.toLowerCase() : 'epley');

  // Si no hay ejercicio por parámetro, elegir el que tenga más series
  if (!ejercicioSeleccionadoId) {
    const conteo = {};
    for (const s of todasSeries) {
      if (s?.ejercicioId) {
        conteo[s.ejercicioId] = (conteo[s.ejercicioId] || 0) + 1;
      }
    }
    const ordenados = Object.entries(conteo).sort((a, b) => b[1] - a[1]);
    if (ordenados.length > 0) {
      ejercicioSeleccionadoId = ordenados[0][0];
    } else if (catalogo.length > 0) {
      ejercicioSeleccionadoId = catalogo[0].id;
    }
  }

  // Encabezado de la pantalla
  const cabeceraProgreso = h('div', { class: 'progreso-header' },
    h('span', { class: 'progreso-saludo' }, 'Evolución y marcas'),
    h('h2', { class: 'progreso-titular-seccion' },
      h('em', {}, 'Tu progreso'),
      ' en el tiempo'
    )
  );
  pantalla.appendChild(cabeceraProgreso);

  // Pestañas superiores en píldora
  const navTabs = h('div', { class: 'progreso-tabs' },
    h('button', {
      class: `progreso-tab-btn ${tabActiva === 'musculos' ? 'activo' : ''}`,
      on: {
        click: () => {
          tabActiva = 'musculos';
          actualizarBotonesTabs();
          renderizar();
        }
      }
    }, 'Músculos'),
    h('button', {
      class: `progreso-tab-btn ${tabActiva === 'ejercicio' ? 'activo' : ''}`,
      on: {
        click: () => {
          tabActiva = 'ejercicio';
          actualizarBotonesTabs();
          renderizar();
        }
      }
    }, 'Por ejercicio'),
    h('button', {
      class: `progreso-tab-btn ${tabActiva === 'calendario' ? 'activo' : ''}`,
      on: {
        click: () => {
          tabActiva = 'calendario';
          actualizarBotonesTabs();
          renderizar();
        }
      }
    }, 'Racha y días')
  );
  pantalla.appendChild(navTabs);

  function actualizarBotonesTabs() {
    const botones = navTabs.querySelectorAll('.progreso-tab-btn');
    botones.forEach((btn, idx) => {
      const tabs = ['musculos', 'ejercicio', 'calendario'];
      if (tabs[idx] === tabActiva) {
        btn.classList.add('activo');
      } else {
        btn.classList.remove('activo');
      }
    });
  }

  // Contenedor dinámico del cuerpo
  const cuerpoSeccion = h('div', { class: 'col', style: 'gap: 14px;' });
  pantalla.appendChild(cuerpoSeccion);

  // Función de renderizado reactivo
  function renderizar() {
    cuerpoSeccion.innerHTML = '';

    // ==========================================
    // TAB 1: SERIES DURAS POR MÚSCULO ESTA SEMANA
    // ==========================================
    if (tabActiva === 'musculos') {
      const hoyStr = hoyISO();
      const fHoy = new Date(hoyStr + 'T12:00:00');
      const diaSemNum = fHoy.getDay();
      const diasDesdeLunes = diaSemNum === 0 ? 6 : diaSemNum - 1;
      const lunesDate = new Date(fHoy.getTime() - diasDesdeLunes * 24 * 60 * 60 * 1000);
      const anioL = lunesDate.getFullYear();
      const mesL = String(lunesDate.getMonth() + 1).padStart(2, '0');
      const diaL = String(lunesDate.getDate()).padStart(2, '0');
      const lunesISO = `${anioL}-${mesL}-${diaL}`;

      const conteoMusculos = seriesPorMusculo(todasSeries, catalogo, lunesISO);

      const gruposBase = [
        'dorsal ancho',
        'pectoral',
        'deltoides lateral',
        'biceps',
        'triceps',
        'cuadriceps',
        'isquiotibiales',
        'gluteo',
        'gemelos',
        'abdomen'
      ];

      const todosMusculos = Array.from(new Set([
        ...gruposBase,
        ...Object.keys(conteoMusculos).map(m => normalizarMusculo(m))
      ]));

      const metaMin = SERIES_META?.min || 10;
      const metaMax = SERIES_META?.max || 20;

      const datosBarras = todosMusculos.map(m => {
        const val = conteoMusculos[m] || 0;
        return {
          label: m,
          valor: val,
          metaMin,
          metaMax
        };
      }).sort((a, b) => b.valor - a.valor);

      const enMeta = datosBarras.filter(d => d.valor >= metaMin).length;

      const tarjetaMusculos = h('div', { class: 'progreso-card-papel' },
        h('div', { class: 'fila', style: 'justify-content: space-between; align-items: flex-start;' },
          h('div', { class: 'col', style: 'gap: 2px;' },
            h('span', { class: 'micro-label', style: 'color: var(--sutil, #6B675F);' }, 'SEMANA EN CURSO'),
            h('h3', { style: 'font-size: 20px; font-weight: 700; color: #17171A; margin-top: 2px;' }, 'Series duras por músculo'),
            h('span', { style: 'font-size: 13px; color: var(--sutil, #6B675F);' },
              `Del ${fechaBonita(lunesISO)} al ${fechaBonita(hoyStr)}`
            )
          ),
          h('div', {
            style: 'background-color: var(--lima, #C8F03C); color: #17171A; border-radius: 999px; padding: 6px 14px; font-size: 12px; font-weight: 700;'
          }, `${enMeta} en meta`)
        ),
        h('p', { style: 'font-size: 13px; color: var(--sutil, #6B675F); line-height: 1.4;' },
          `Meta semanal: ${metaMin} a ${metaMax} series duras (RIR ≤ 3 o fallo). Principal cuenta 1, secundario 0.5.`
        ),
        // Gráfica de barras en Tinta y Lima
        barras(datosBarras, { metaMin, metaMax, unidad: 'series' }),
        // Leyenda editorial mínima
        h('div', { class: 'fila', style: 'justify-content: space-between; margin-top: 8px; font-size: 12px; font-weight: 600;' },
          h('div', { class: 'fila', style: 'align-items: center; gap: 6px;' },
            h('span', { style: 'width: 10px; height: 10px; border-radius: 999px; background: var(--lima, #C8F03C);' }),
            h('span', { style: 'color: #17171A;' }, `En meta (${metaMin}+)`)
          ),
          h('div', { class: 'fila', style: 'align-items: center; gap: 6px;' },
            h('span', { style: 'width: 10px; height: 10px; border-radius: 999px; background: #17171A;' }),
            h('span', { style: 'color: #17171A;' }, 'En progreso')
          ),
          h('div', { class: 'fila', style: 'align-items: center; gap: 6px;' },
            h('span', { style: 'width: 10px; height: 10px; border-radius: 999px; background: rgba(23,23,26,0.12);' }),
            h('span', { style: 'color: var(--sutil, #6B675F);' }, 'Sin series')
          )
        )
      );

      cuerpoSeccion.appendChild(tarjetaMusculos);
    }

    // ==========================================
    // TAB 2: PROGRESO POR EJERCICIO Y RÉCORD
    // ==========================================
    else if (tabActiva === 'ejercicio') {
      const mapaPRs = prs(todasSeries);
      const prActual = ejercicioSeleccionadoId ? mapaPRs[ejercicioSeleccionadoId] : null;

      // Selector estilizado
      const ejerciciosConSeries = new Set(todasSeries.map(s => s.ejercicioId).filter(Boolean));
      const listaOpciones = catalogo.slice().sort((a, b) => {
        const tieneA = ejerciciosConSeries.has(a.id);
        const tieneB = ejerciciosConSeries.has(b.id);
        if (tieneA && !tieneB) return -1;
        if (!tieneA && tieneB) return 1;
        return a.nombre.localeCompare(b.nombre);
      });

      const selectorEj = h('select', {
        class: 'progreso-select-ej',
        on: {
          change: (e) => {
            ejercicioSeleccionadoId = e.target.value;
            renderizar();
          }
        }
      },
        ...listaOpciones.map(ej => {
          const opt = h('option', { value: ej.id }, ej.nombre + (ejerciciosConSeries.has(ej.id) ? ' •' : ''));
          if (ej.id === ejercicioSeleccionadoId) opt.selected = true;
          return opt;
        })
      );
      cuerpoSeccion.appendChild(selectorEj);

      // Subtabs de métricas en píldoras
      const subtabsMetrica = h('div', { class: 'progreso-subtabs' },
        h('button', {
          class: `progreso-subtab-chip ${metricaSeleccionada === '1rm' ? 'activo' : ''}`,
          on: { click: () => { metricaSeleccionada = '1rm'; renderizar(); } }
        }, `1RM (${formulaActiva === 'brzycki' ? 'Brzycki' : 'Epley'})`),
        h('button', {
          class: `progreso-subtab-chip ${metricaSeleccionada === 'peso' ? 'activo' : ''}`,
          on: { click: () => { metricaSeleccionada = 'peso'; renderizar(); } }
        }, 'Peso máximo'),
        h('button', {
          class: `progreso-subtab-chip ${metricaSeleccionada === 'volumen' ? 'activo' : ''}`,
          on: { click: () => { metricaSeleccionada = 'volumen'; renderizar(); } }
        }, 'Volumen total')
      );
      cuerpoSeccion.appendChild(subtabsMetrica);

      // Si es 1RM, alternador de fórmula en píldoras finas
      if (metricaSeleccionada === '1rm') {
        const toggleFormula = h('div', { class: 'fila', style: 'justify-content: flex-end; align-items: center; gap: 8px;' },
          h('span', { style: 'font-size: 12px; color: var(--sutil, #6B675F); font-weight: 500;' }, 'Fórmula:'),
          h('button', {
            class: `progreso-subtab-chip ${formulaActiva === 'epley' ? 'activo' : ''}`,
            style: 'height: 28px; padding: 0 12px; font-size: 11px;',
            on: { click: () => { formulaActiva = 'epley'; renderizar(); } }
          }, 'Epley'),
          h('button', {
            class: `progreso-subtab-chip ${formulaActiva === 'brzycki' ? 'activo' : ''}`,
            style: 'height: 28px; padding: 0 12px; font-size: 11px;',
            on: { click: () => { formulaActiva = 'brzycki'; renderizar(); } }
          }, 'Brzycki')
        );
        cuerpoSeccion.appendChild(toggleFormula);
      }

      // TARJETA HÉROE DE RÉCORD PERSONAL: titular serif cursivo y números grandes en .grande
      const nombreEjSel = mapaEjercicios.get(ejercicioSeleccionadoId)?.nombre || ejercicioSeleccionadoId;
      const cardRecord = h('div', { class: 'progreso-record-hero' },
        h('span', { class: 'micro-label' }, 'HITO HISTÓRICO'),
        h('h3', { class: 'progreso-record-serif' },
          h('em', {}, 'Nuevo récord')
        ),
        h('span', { style: 'font-size: 14px; color: var(--lima, #C8F03C); font-weight: 600;' }, nombreEjSel),
        prActual ? h('div', { class: 'progreso-record-metric' },
          h('span', { class: 'grande' }, `${prActual.kg != null ? prActual.kg : 'PC'} × ${prActual.reps}`),
          h('svg', { class: 'record-underline-svg', viewBox: '0 0 230 18' },
            h('path', { class: 'record-underline-path', d: 'M 6 13 C 65 5, 120 15, 222 8' })
          ),
          h('div', { class: 'record-pill-fuerza' },
            prActual.unidad === 'placa'
              ? `1RM aprox: ${prActual.unoRM} placas`
              : `1RM estimado: ${prActual.unoRM} kg`
          ),
          prActual.fecha ? h('span', { style: 'font-size: 12px; color: #8E8A82; margin-top: 6px;' },
            `Logrado el ${fechaBonita(prActual.fecha)}`
          ) : null
        ) : h('div', { style: 'margin: 16px 0; font-size: 14px; color: #8E8A82;' },
          'Aún no has registrado series de este ejercicio.'
        )
      );
      cuerpoSeccion.appendChild(cardRecord);

      // Series históricas del ejercicio
      const seriesEsteEj = todasSeries
        .filter(s => s && s.ejercicioId === ejercicioSeleccionadoId)
        .sort((a, b) => (a.fecha > b.fecha ? 1 : a.fecha < b.fecha ? -1 : (a.hora || 0) - (b.hora || 0)));

      const usaPlacas = seriesEsteEj.some(s => s.unidad === 'placa');

      // Agrupar por fecha
      const sesionesPorFecha = new Map();
      for (const s of seriesEsteEj) {
        if (!s.fecha) continue;
        if (!sesionesPorFecha.has(s.fecha)) {
          sesionesPorFecha.set(s.fecha, []);
        }
        sesionesPorFecha.get(s.fecha).push(s);
      }

      // Preparar puntos de la gráfica
      const puntosGrafica = [];
      for (const [fecha, arrSeries] of sesionesPorFecha.entries()) {
        let valorCalculado = 0;
        let esPR = false;

        if (metricaSeleccionada === '1rm') {
          for (const s of arrSeries) {
            const kgEfectivo = s.kg != null ? (s.porLado ? s.kg * 2 : s.kg) : 0;
            const r = Number(s.reps || 0);
            const val1rm = formulaActiva === 'brzycki' ? brzycki(kgEfectivo, r) : epley(kgEfectivo, r);
            if (val1rm > valorCalculado) valorCalculado = val1rm;
          }
          if (prActual && prActual.fecha === fecha && Math.abs(valorCalculado - prActual.unoRM) < 0.2) {
            esPR = true;
          }
        } else if (metricaSeleccionada === 'peso') {
          for (const s of arrSeries) {
            const kg = Number(s.kg || 0);
            if (kg > valorCalculado) valorCalculado = kg;
          }
        } else if (metricaSeleccionada === 'volumen') {
          for (const s of arrSeries) {
            const kg = Number(s.kg || 0);
            const reps = Number(s.reps || 0);
            valorCalculado += kg * reps;
          }
          valorCalculado = Math.round(valorCalculado);
        }

        puntosGrafica.push({
          x: fecha,
          y: valorCalculado,
          pr: esPR,
          subtexto: fechaBonita(fecha)
        });
      }

      let unidadMetrica = 'kg';
      if (usaPlacas) {
        unidadMetrica = metricaSeleccionada === 'volumen' ? 'placas tot' : 'placas';
      } else if (metricaSeleccionada === 'volumen') {
        unidadMetrica = 'kg tot';
      }

      // Gráfica de líneas en Papel 2, línea Lima (#C8F03C), sin cuadrícula pesada
      const cardGrafica = h('div', { class: 'progreso-card-papel' },
        h('div', { class: 'fila', style: 'justify-content: space-between; align-items: baseline;' },
          h('h4', { style: 'font-size: 16px; font-weight: 700; color: #17171A; margin: 0;' },
            metricaSeleccionada === '1rm' ? 'Evolución de 1RM' : (metricaSeleccionada === 'peso' ? 'Carga máxima levantada' : 'Volumen total de sesión')
          ),
          h('span', { style: 'font-size: 12px; color: var(--sutil, #6B675F); font-weight: 600;' },
            `${puntosGrafica.length} sesiones`
          )
        ),
        lineas(puntosGrafica, {
          unidad: unidadMetrica,
          color: '#C8F03C',
          mostrarArea: true,
          mostrarPuntos: true
        })
      );
      cuerpoSeccion.appendChild(cardGrafica);

      // Últimas sesiones
      const fechasInversas = Array.from(sesionesPorFecha.entries()).reverse().slice(0, 5);
      if (fechasInversas.length > 0) {
        const listaHistorial = h('div', { class: 'col', style: 'gap: 8px;' },
          h('h4', { style: 'font-size: 14px; font-weight: 700; color: #17171A; margin: 4px 0;' }, 'Últimas sesiones')
        );

        fechasInversas.forEach(([fecha, arr]) => {
          const itemSesion = h('div', { class: 'progreso-sesion-item' },
            h('div', { class: 'col', style: 'gap: 2px;' },
              h('span', { class: 'progreso-sesion-fecha' }, fechaBonita(fecha)),
              h('span', { class: 'progreso-sesion-reps' },
                arr.map(s => `${formatearCargaSerie(s)} × ${s.reps}`).join(' · ')
              )
            ),
            h('span', {
              style: 'background: var(--fondo, #F3F0E8); border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 700; color: #17171A;'
            }, `${arr.length} series`)
          );
          listaHistorial.appendChild(itemSesion);
        });

        cuerpoSeccion.appendChild(listaHistorial);
      }
    }

    // ==========================================
    // TAB 3: RACHA Y CALENDARIO
    // ==========================================
    else if (tabActiva === 'calendario') {
      const hoyStr = hoyISO();
      const fechaActual = new Date(hoyStr + 'T12:00:00');
      const anioActual = fechaActual.getFullYear();
      const mesActual = fechaActual.getMonth();

      const nombresMeses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ];

      const fechasEntrenadas = new Set(todasSeries.map(s => s.fecha).filter(Boolean));

      // Entrenamientos del mes
      let entrenosDelMes = 0;
      fechasEntrenadas.forEach(f => {
        const d = new Date(f + 'T12:00:00');
        if (d.getFullYear() === anioActual && d.getMonth() === mesActual) {
          entrenosDelMes++;
        }
      });

      // Racha en semanas consecutivas
      let rachaSemanas = 0;
      let semanaRef = new Date(fechaActual);
      const offsetLunes = semanaRef.getDay() === 0 ? 6 : semanaRef.getDay() - 1;
      semanaRef.setDate(semanaRef.getDate() - offsetLunes);

      for (let w = 0; w < 52; w++) {
        let entrenoEnSemana = false;
        for (let d = 0; d < 7; d++) {
          const diaCheck = new Date(semanaRef.getTime() + d * 24 * 60 * 60 * 1000);
          const anioC = diaCheck.getFullYear();
          const mesC = String(diaCheck.getMonth() + 1).padStart(2, '0');
          const diaC = String(diaCheck.getDate()).padStart(2, '0');
          const iso = `${anioC}-${mesC}-${diaC}`;
          if (fechasEntrenadas.has(iso)) {
            entrenoEnSemana = true;
            break;
          }
        }
        if (entrenoEnSemana) {
          rachaSemanas++;
          semanaRef.setDate(semanaRef.getDate() - 7);
        } else {
          if (w === 0) {
            semanaRef.setDate(semanaRef.getDate() - 7);
            continue;
          }
          break;
        }
      }

      // Caja de racha con números grandes en .grande
      const cardRacha = h('div', { class: 'progreso-racha-card' },
        h('div', { class: 'progreso-racha-item' },
          h('span', { class: 'grande' }, String(rachaSemanas)),
          h('span', { class: 'progreso-racha-caption' },
            icono('fuego'),
            'Semanas de racha'
          )
        ),
        h('div', { style: 'width: 1px; height: 50px; background: rgba(23, 23, 26, 0.12);' }),
        h('div', { class: 'progreso-racha-item' },
          h('span', { class: 'grande' }, String(entrenosDelMes)),
          h('span', { class: 'progreso-racha-caption' },
            icono('pesas'),
            `Sesiones en ${nombresMeses[mesActual]}`
          )
        )
      );
      cuerpoSeccion.appendChild(cardRacha);

      // Calendario mensual en tarjeta Papel 2
      const primerDiaMes = new Date(anioActual, mesActual, 1);
      const ultimoDiaMes = new Date(anioActual, mesActual + 1, 0);
      const diasEnMes = ultimoDiaMes.getDate();
      const diaInicio = primerDiaMes.getDay();
      const offsetInicio = diaInicio === 0 ? 6 : diaInicio - 1;

      const cardCalendario = h('div', { class: 'progreso-card-papel' },
        h('div', { class: 'fila', style: 'justify-content: space-between; align-items: center;' },
          h('h3', { style: 'font-size: 18px; font-weight: 700; color: #17171A; margin: 0;' },
            `${nombresMeses[mesActual]} ${anioActual}`
          ),
          h('span', { style: 'font-size: 13px; color: var(--sutil, #6B675F); font-weight: 600;' },
            'Días entrenados'
          )
        )
      );

      const gridCal = h('div', { class: 'progreso-cal-grid' });
      const iniciales = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
      iniciales.forEach(txt => {
        gridCal.appendChild(h('span', {
          style: 'font-size: 12px; font-weight: 700; color: var(--sutil, #6B675F); padding-bottom: 2px;'
        }, txt));
      });

      for (let i = 0; i < offsetInicio; i++) {
        gridCal.appendChild(h('div', { class: 'progreso-cal-celda fuera-mes' }));
      }

      for (let dia = 1; dia <= diasEnMes; dia++) {
        const diaStr = String(dia).padStart(2, '0');
        const mesStr = String(mesActual + 1).padStart(2, '0');
        const fechaISO = `${anioActual}-${mesStr}-${diaStr}`;

        const entreno = fechasEntrenadas.has(fechaISO);
        const esHoy = fechaISO === hoyStr;

        let claseCelda = 'progreso-cal-celda';
        if (entreno) claseCelda += ' entrenado';
        if (esHoy) claseCelda += ' hoy';

        const celda = h('div', { class: claseCelda },
          h('span', {}, String(dia))
        );

        gridCal.appendChild(celda);
      }

      cardCalendario.appendChild(gridCal);
      cuerpoSeccion.appendChild(cardCalendario);
    }
  }

  // Render inicial
  renderizar();

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

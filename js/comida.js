/**
 * comida.js - Sección 6: Comida y Nutrición de Forja (Dirección de Arte v2 «Revista de Sala»)
 *
 * Características v2:
 * - Totales del día con número grande héroe (Bricolage Grotesque 64px, tabular-nums) y barra lima (#C8F03C).
 * - Lista limpia sin bordes toscos, paleta papel (#F3F0E8) y papel 2 (#E9E4D8), texto tinta (#17171A).
 * - Titulares en Instrument Serif cursivo, radios estrictos de 28px (tarjetas) y 999px (píldoras).
 * - Sin emojis: iconos vectoriales limpios vía icono() de ./iconos.js.
 * - Registro rápido con parser de lenguaje natural y catálogo colombiano (USDA / ICBF).
 * - Promedio móvil de 7 días, contador de vasos de agua y método de la mano sin pesar.
 * - Cumple con CONTRATOS.md y correcciones de REVISION.md (3.2 fechas locales, 3.5 llamadas async).
 */

import { guardar, borrar, todos, filtrar, ajuste, ponerAjuste, nuevoId } from './db.js';
import { h, aviso, dialogo, confirmar, hoyISO, fechaBonita } from './ui.js';
import { alimentos as cargarAlimentos, perfil as cargarPerfil } from './datos.js';
import { ir } from './app.js';
import { icono } from './iconos.js';

let contenedorActual = null;
let fechaSeleccionada = hoyISO();
let catalogoAlimentos = [];
let perfilUsuario = null;
let itemsBorrador = []; // Ítems interpretados listos para guardar

/**
 * Monta la pantalla de comida
 * @param {HTMLElement} contenedor - Contenedor principal de la app
 * @param {Array} params - Parámetros de ruta
 */
export async function montar(contenedor, params = []) {
  contenedorActual = contenedor;
  fechaSeleccionada = (params && params[0]) ? params[0] : hoyISO();

  try {
    catalogoAlimentos = await cargarAlimentos();
    perfilUsuario = await cargarPerfil();
  } catch (e) {
    console.error('Error cargando datos de comida:', e);
    catalogoAlimentos = catalogoAlimentos || [];
    perfilUsuario = perfilUsuario || { kcal: 2200, proteina: 128, aguaVasos: 10 };
  }

  await renderizar();
}

/**
 * Desmonta la pantalla y limpia estados
 */
export function desmontar() {
  contenedorActual = null;
  itemsBorrador = [];
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
  izq: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  der: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
  gota: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>',
  buscar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>',
  mano: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v4"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M6 14v-1.5a2 2 0 0 0-4 0v4a8 8 0 0 0 16 0v-4a2 2 0 0 0-4 0"/></svg>',
  plato: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/></svg>',
  mas: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  menos: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  cerrar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  basura: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  ojo: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  alerta: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
};

/**
 * Normaliza cadenas quitando tildes y caracteres especiales para búsqueda
 */
function normalizar(texto) {
  return (texto || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Convierte un objeto Date a formato local ISO 'AAAA-MM-DD' (Error 3.2: sin UTC toISOString)
 */
function fechaALocalISO(d) {
  const anio = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

/**
 * Parsea una cadena 'AAAA-MM-DD' a Date en hora local a mediodía (Error 3.2: evita desfase)
 */
function parsearFechaLocal(fechaIso) {
  if (!fechaIso) return new Date();
  const partes = fechaIso.split('-').map(Number);
  return new Date(partes[0], (partes[1] || 1) - 1, partes[2] || 1, 12, 0, 0);
}

/**
 * Busca el alimento más cercano en el catálogo por nombre o alias
 */
function buscarAlimento(termino) {
  const norm = normalizar(termino);
  if (!norm) return null;

  // 1. Coincidencia exacta de ID o nombre
  for (const al of catalogoAlimentos) {
    if (normalizar(al.id) === norm || normalizar(al.nombre) === norm) return al;
  }

  // 2. Coincidencia exacta en aliases
  for (const al of catalogoAlimentos) {
    if (al.alias && al.alias.some(a => normalizar(a) === norm)) return al;
  }

  // 3. Inclusión en alias o nombre
  for (const al of catalogoAlimentos) {
    if (al.alias && al.alias.some(a => norm.includes(normalizar(a)) || normalizar(a).includes(norm))) {
      return al;
    }
    if (normalizar(al.nombre).includes(norm) || norm.includes(normalizar(al.nombre))) {
      return al;
    }
  }

  return null;
}

/**
 * Interpreta texto libre de comida («2 huevos, arroz 1 taza, 150g pechuga»)
 * @param {string} texto
 * @returns {Array} lista de ítems interpretados
 */
export function parsearTextoComida(texto) {
  if (!texto || !texto.trim()) return [];

  const partes = texto
    .split(/,|\n|\by\b/gi)
    .map(p => p.trim())
    .filter(Boolean);

  const resultados = [];

  for (const parte of partes) {
    let cantidad = 1;
    let unidad = 'porcion';
    let nombreAlimento = parte;

    const matchInicio = parte.match(/^([\d.,]+)\s*(g|gr|gramos|ml|tazas?|cdas?|cucharadas?|cdtas?|cucharaditas?|vasos?|porciones?|tajadas?|platos?|latas?|scoops?|unidades?|u)?\s*(?:de\s+)?(.*)$/i);
    const matchFin = parte.match(/^(.*?)\s+([\d.,]+)\s*(g|gr|gramos|ml|tazas?|cdas?|cucharadas?|cdtas?|cucharaditas?|vasos?|porciones?|tajadas?|platos?|latas?|scoops?|unidades?|u)?$/i);

    if (matchInicio && matchInicio[3] && matchInicio[3].trim()) {
      cantidad = parseFloat(matchInicio[1].replace(',', '.')) || 1;
      unidad = (matchInicio[2] || 'porcion').toLowerCase();
      nombreAlimento = matchInicio[3].trim();
    } else if (matchFin && matchFin[1] && matchFin[1].trim()) {
      nombreAlimento = matchFin[1].trim();
      cantidad = parseFloat(matchFin[2].replace(',', '.')) || 1;
      unidad = (matchFin[3] || 'porcion').toLowerCase();
    }

    const alimento = buscarAlimento(nombreAlimento);

    if (alimento) {
      let factor = 1;
      const esGramos = /^(g|gr|gramos|ml)$/i.test(unidad);

      if (esGramos) {
        factor = cantidad / (alimento.gramos || 100);
      } else {
        factor = cantidad;
      }

      resultados.push({
        alimentoId: alimento.id,
        nombre: alimento.nombre,
        cantidadOriginal: cantidad,
        unidadOriginal: unidad,
        gramos: esGramos ? Math.round(cantidad) : Math.round(alimento.gramos * factor),
        kcal: Math.round(alimento.kcal * factor),
        proteina: Math.round(alimento.proteina * factor * 10) / 10,
        carbos: Math.round((alimento.carbos || 0) * factor * 10) / 10,
        grasa: Math.round((alimento.grasa || 0) * factor * 10) / 10,
        reconocido: true
      });
    } else {
      resultados.push({
        alimentoId: null,
        nombre: nombreAlimento,
        cantidadOriginal: cantidad,
        unidadOriginal: unidad,
        gramos: 100,
        kcal: 150 * cantidad,
        proteina: 5 * cantidad,
        carbos: 15 * cantidad,
        grasa: 5 * cantidad,
        reconocido: false
      });
    }
  }

  return resultados;
}

/**
 * Obtiene el resumen de comidas y agua de una fecha y el promedio de 7 días
 */
async function obtenerEstadisticas(fechaIso) {
  const todasComidas = await todos('comidas');

  const comidasDia = todasComidas.filter(c => c.fecha === fechaIso);
  const totalKcal = comidasDia.reduce((acc, c) => acc + (Number(c.kcal) || 0), 0);
  const totalProteina = Math.round(comidasDia.reduce((acc, c) => acc + (Number(c.proteina) || 0), 0) * 10) / 10;
  const totalCarbos = Math.round(comidasDia.reduce((acc, c) => acc + (Number(c.carbos) || 0), 0) * 10) / 10;
  const totalGrasa = Math.round(comidasDia.reduce((acc, c) => acc + (Number(c.grasa) || 0), 0) * 10) / 10;

  const claveAgua = `agua-${fechaIso}`;
  const aguaVasos = Number(await ajuste(claveAgua, 0)) || 0;

  const fechaObj = parsearFechaLocal(fechaIso);
  let sumaKcal7d = 0;
  let sumaProt7d = 0;
  let diasConRegistro = 0;

  for (let i = 0; i < 7; i++) {
    const d = new Date(fechaObj.getFullYear(), fechaObj.getMonth(), fechaObj.getDate() - i, 12, 0, 0);
    const iso = fechaALocalISO(d);
    const comidasFecha = todasComidas.filter(c => c.fecha === iso);
    if (comidasFecha.length > 0) {
      diasConRegistro++;
      sumaKcal7d += comidasFecha.reduce((acc, c) => acc + (Number(c.kcal) || 0), 0);
      sumaProt7d += comidasFecha.reduce((acc, c) => acc + (Number(c.proteina) || 0), 0);
    }
  }

  const promKcal7d = diasConRegistro > 0 ? Math.round(sumaKcal7d / diasConRegistro) : totalKcal;
  const promProt7d = diasConRegistro > 0 ? Math.round((sumaProt7d / diasConRegistro) * 10) / 10 : totalProteina;

  return {
    comidasDia,
    totalKcal,
    totalProteina,
    totalCarbos,
    totalGrasa,
    aguaVasos,
    promKcal7d,
    promProt7d,
    diasConRegistro
  };
}

/**
 * Renderizado principal con Dirección de Arte Forja v2
 */
async function renderizar() {
  if (!contenedorActual) return;
  contenedorActual.innerHTML = '';

  const metaKcal = perfilUsuario?.kcal || 2200;
  const metaProt = perfilUsuario?.proteina || 128;
  const metaAgua = perfilUsuario?.aguaVasos || 10;

  const stats = await obtenerEstadisticas(fechaSeleccionada);

  const pctKcal = Math.min(100, Math.round((stats.totalKcal / metaKcal) * 100));
  const pctProt = Math.min(100, Math.round((stats.totalProteina / metaProt) * 100));
  const pctAgua = Math.min(100, Math.round((stats.aguaVasos / metaAgua) * 100));

  // Estilos dedicados Forja v2 (Revista de sala)
  const estiloV2 = h('style', {}, `
    .forja-comida-v2 {
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
      padding: 22px;
      border: none;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .v2-serif-title {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 28px;
      font-weight: 400;
      color: #17171A;
      letter-spacing: -0.01em;
      line-height: 1.1;
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
    .v2-numero-heroe {
      font-size: 64px;
      font-weight: 800;
      color: #17171A;
      line-height: 1;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.02em;
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
      transition: width 240ms cubic-bezier(.2,.8,.2,1);
    }
    .v2-barra-alerta {
      background-color: #E2553A;
    }
    .v2-chips-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .v2-chip-macro {
      background-color: #F3F0E8;
      border-radius: 999px;
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .v2-chip-macro .rotulo {
      font-size: 11px;
      font-weight: 600;
      color: #6B675F;
    }
    .v2-chip-macro .valor {
      font-size: 15px;
      font-weight: 700;
      color: #17171A;
      font-variant-numeric: tabular-nums;
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
      height: 56px;
      width: 100%;
    }
    .v2-btn-lima:active {
      transform: scale(0.97);
    }
    .v2-input-redondo {
      background-color: #F3F0E8;
      color: #17171A;
      border: none;
      border-radius: 28px;
      padding: 16px 20px;
      font-family: inherit;
      font-size: 16px;
      outline: none;
      width: 100%;
      box-sizing: border-box;
      transition: box-shadow 160ms ease;
    }
    .v2-input-redondo:focus {
      box-shadow: 0 0 0 2px #17171A;
    }
    .v2-item-comida {
      background-color: #F3F0E8;
      border-radius: 28px;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }
  `);

  // 1. Selector de fecha editorial en píldora
  const selectorFecha = h('div', {
    class: 'v2-tarjeta',
    style: 'flex-direction: row; justify-content: space-between; align-items: center; padding: 12px 18px;'
  },
    h('button', {
      class: 'v2-btn-pildora',
      style: 'width: 44px; height: 44px; padding: 0;',
      title: 'Día anterior',
      on: { click: async () => { await cambiarFecha(-1); } }
    }, iconoNodo('izq', ICONOS_SVGS.izq)),

    h('div', { style: 'text-align: center;' },
      h('div', { class: 'v2-serif-title', style: 'font-size: 22px;' },
        fechaSeleccionada === hoyISO() ? 'Hoy' : fechaBonita(fechaSeleccionada)
      ),
      fechaSeleccionada !== hoyISO()
        ? h('button', {
            class: 'v2-btn-pildora',
            style: 'height: 26px; padding: 0 10px; font-size: 11px; margin-top: 4px; background-color: #F3F0E8;',
            on: {
              click: async () => {
                fechaSeleccionada = hoyISO();
                itemsBorrador = [];
                await renderizar();
              }
            }
          }, 'Volver a hoy')
        : h('span', { class: 'v2-micro-label' }, 'AL DÍA')
    ),

    h('button', {
      class: 'v2-btn-pildora',
      style: 'width: 44px; height: 44px; padding: 0;',
      title: 'Día siguiente',
      on: { click: async () => { await cambiarFecha(1); } }
    }, iconoNodo('der', ICONOS_SVGS.der))
  );

  // 2. Tarjeta Héroe: Totales del día con número grande y barra lima
  const tarjetaHeroe = h('div', { class: 'v2-tarjeta' },
    h('div', { style: 'display: flex; justify-content: space-between; align-items: baseline;' },
      h('h2', { class: 'v2-serif-title' }, 'Total de ', h('em', {}, 'energía')),
      h('span', { class: 'v2-micro-label' }, `PROM. 7D: ${stats.promKcal7d} KCAL`)
    ),
    h('div', { style: 'display: flex; align-items: baseline; gap: 8px;' },
      h('span', { class: 'v2-numero-heroe' }, `${stats.totalKcal}`),
      h('span', { style: 'font-size: 18px; color: #6B675F; font-weight: 500;' }, `/ ${metaKcal} kcal`)
    ),
    h('div', { class: 'v2-barra-track' },
      h('div', {
        class: `v2-barra-lima ${pctKcal > 105 ? 'v2-barra-alerta' : ''}`,
        style: `width: ${pctKcal}%;`
      })
    ),
    // Fila de macronutrientes limpios en píldoras
    h('div', { class: 'v2-chips-row' },
      h('div', { class: 'v2-chip-macro' },
        h('span', { class: 'rotulo' }, 'Proteína'),
        h('span', { class: 'valor' }, `${stats.totalProteina}g`),
        h('div', { class: 'v2-barra-track', style: 'height: 4px; margin-top: 4px;' },
          h('div', { class: 'v2-barra-lima', style: `width: ${pctProt}%;` })
        )
      ),
      h('div', { class: 'v2-chip-macro' },
        h('span', { class: 'rotulo' }, 'Carbohidratos'),
        h('span', { class: 'valor' }, `${stats.totalCarbos}g`)
      ),
      h('div', { class: 'v2-chip-macro' },
        h('span', { class: 'rotulo' }, 'Grasas'),
        h('span', { class: 'valor' }, `${stats.totalGrasa}g`)
      )
    )
  );

  // 3. Tarjeta de Agua (Hidratación sin emojis)
  const tarjetaAgua = h('div', { class: 'v2-tarjeta' },
    h('div', { style: 'display: flex; justify-content: space-between; align-items: center;' },
      h('div', { style: 'display: flex; align-items: center; gap: 10px;' },
        iconoNodo('gota', ICONOS_SVGS.gota),
        h('div', {},
          h('h3', { class: 'v2-serif-title', style: 'font-size: 22px;' }, 'Vasos de ', h('em', {}, 'agua')),
          h('div', { style: 'font-size: 13px; color: #6B675F;' }, `${stats.aguaVasos} de ${metaAgua} vasos (${stats.aguaVasos * 250} ml)`)
        )
      ),
      h('div', { style: 'display: flex; gap: 8px;' },
        h('button', {
          class: 'v2-btn-pildora',
          style: 'padding: 0 14px;',
          title: 'Restar vaso',
          on: { click: async () => { await modificarAgua(-1); } }
        }, iconoNodo('menos', ICONOS_SVGS.menos)),
        h('button', {
          class: 'v2-btn-pildora',
          style: 'background-color: #C8F03C; font-weight: 700;',
          on: { click: async () => { await modificarAgua(1); } }
        }, iconoNodo('mas', ICONOS_SVGS.mas), '+1 vaso')
      )
    ),
    h('div', { class: 'v2-barra-track', style: 'height: 6px;' },
      h('div', { class: 'v2-barra-lima', style: `width: ${pctAgua}%;` })
    )
  );

  // 4. Tarjeta de Entrada Rápida
  const campoTexto = h('input', {
    type: 'text',
    class: 'v2-input-redondo',
    placeholder: 'Ej: 2 huevos, arroz 1 taza, 150g pechuga',
    on: { input: (e) => previsualizarTexto(e.target.value) }
  });

  const contenedorBorrador = h('div', { id: 'contenedor-borrador' });

  const tarjetaEntrada = h('div', { class: 'v2-tarjeta' },
    h('h3', { class: 'v2-serif-title', style: 'font-size: 24px;' }, 'Registrar ', h('em', {}, 'alimento')),
    h('p', { style: 'font-size: 14px; color: #6B675F;' },
      'Escribe en lenguaje natural o añade directo con las porciones de la mano:'
    ),
    campoTexto,
    contenedorBorrador,
    h('div', { style: 'display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px;' },
      h('button', {
        class: 'v2-btn-pildora',
        style: 'flex: 1;',
        on: { click: async () => { await abrirCatalogoVisual(); } }
      }, iconoNodo('buscar', ICONOS_SVGS.buscar), 'Buscar alimento'),
      h('button', {
        class: 'v2-btn-pildora',
        style: 'flex: 1;',
        on: { click: async () => { await abrirMetodoMano(); } }
      }, iconoNodo('mano', ICONOS_SVGS.mano), 'Método mano')
    ),
    h('button', {
      class: 'v2-btn-pildora v2-btn-lima',
      style: 'margin-top: 4px;',
      on: { click: async () => { await guardarComida(campoTexto); } }
    }, iconoNodo('check', ICONOS_SVGS.check), 'Guardar comida')
  );

  // 5. Lista limpia de comidas del día
  const itemsComidasNodos = stats.comidasDia.map(c => renderizarFilaComida(c));
  const tarjetaLista = h('div', { class: 'v2-tarjeta' },
    h('div', { style: 'display: flex; justify-content: space-between; align-items: baseline;' },
      h('h3', { class: 'v2-serif-title', style: 'font-size: 24px;' }, 'Comidas del ', h('em', {}, 'día')),
      h('span', { class: 'v2-micro-label' }, `${stats.comidasDia.length} REGISTROS`)
    ),
    stats.comidasDia.length === 0
      ? h('div', { style: 'padding: 32px 16px; text-align: center; color: #6B675F;' },
          h('div', { style: 'margin-bottom: 8px; opacity: 0.6;' }, iconoNodo('plato', ICONOS_SVGS.plato)),
          h('div', { class: 'v2-serif-title', style: 'font-size: 20px;' }, 'Sin comidas registradas'),
          h('p', { style: 'font-size: 13px; margin-top: 4px;' }, 'Ingresa tus alimentos arriba para calcular tus calorías.')
        )
      : h('div', { style: 'display: flex; flex-direction: column;' }, ...itemsComidasNodos)
  );

  const vista = h('div', { class: 'forja-comida-v2' },
    estiloV2,
    selectorFecha,
    tarjetaHeroe,
    tarjetaAgua,
    tarjetaEntrada,
    tarjetaLista
  );

  contenedorActual.appendChild(vista);
}

/**
 * Renderiza una comida individual registrada con diseño limpio
 */
function renderizarFilaComida(comida) {
  const horaTexto = comida.hora ? new Date(comida.hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const descItems = (comida.items && comida.items.length > 0)
    ? comida.items.map(it => `${it.nombre} (${it.cantidadOriginal || it.cantidad || ''} ${it.unidadOriginal || ''})`).join(', ')
    : comida.texto;

  return h('div', { class: 'v2-item-comida' },
    h('div', { style: 'flex: 1;' },
      h('div', { style: 'font-weight: 600; font-size: 15px; color: #17171A; line-height: 1.3;' }, descItems),
      h('div', { style: 'font-size: 12px; color: #6B675F; margin-top: 4px; font-variant-numeric: tabular-nums;' },
        `${horaTexto ? horaTexto + ' · ' : ''}${comida.kcal || 0} kcal · ${comida.proteina || 0}g proteína`
      )
    ),
    h('div', { style: 'display: flex; gap: 6px;' },
      h('button', {
        class: 'v2-btn-pildora',
        style: 'height: 38px; padding: 0 12px; font-size: 12px; background-color: #E9E4D8;',
        title: 'Ver detalle',
        on: { click: async () => { await verDetalleComida(comida); } }
      }, iconoNodo('ojo', ICONOS_SVGS.ojo), 'Ver'),
      h('button', {
        class: 'v2-btn-pildora',
        style: 'height: 38px; width: 38px; padding: 0; background-color: #E9E4D8; color: #E2553A;',
        title: 'Eliminar comida',
        on: { click: async () => { await eliminarComida(comida.id); } }
      }, iconoNodo('basura', ICONOS_SVGS.basura))
    )
  );
}

/**
 * Cambia la fecha activa por desplazamiento de días
 */
async function cambiarFecha(deltaDias) {
  const d = parsearFechaLocal(fechaSeleccionada);
  d.setDate(d.getDate() + deltaDias);
  fechaSeleccionada = fechaALocalISO(d);
  itemsBorrador = [];
  await renderizar();
}

/**
 * Actualiza el contador de vasos de agua
 */
async function modificarAgua(delta) {
  const clave = `agua-${fechaSeleccionada}`;
  const actual = Number(await ajuste(clave, 0)) || 0;
  const nuevo = Math.max(0, actual + delta);
  await ponerAjuste(clave, nuevo);
  await renderizar();
}

/**
 * Previsualiza los alimentos interpretados mientras el usuario teclea
 */
function previsualizarTexto(texto) {
  const contenedor = document.getElementById('contenedor-borrador');
  if (!contenedor) return;
  contenedor.innerHTML = '';

  itemsBorrador = parsearTextoComida(texto);
  if (itemsBorrador.length === 0) return;

  const chips = itemsBorrador.map(it => {
    return h('div', {
      style: `display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; margin: 4px 6px 2px 0; font-size: 12px; font-weight: 500; background-color: ${it.reconocido ? '#C8F03C' : '#E9E4D8'}; color: #17171A;`
    },
      h('span', {}, `${it.nombre}: ${it.kcal} kcal | ${it.proteina}g prot`),
      !it.reconocido ? iconoNodo('alerta', ICONOS_SVGS.alerta) : ''
    );
  });

  contenedor.appendChild(h('div', { style: 'margin-top: 8px;' }, ...chips));
}

/**
 * Guarda la comida registrada en IndexedDB store 'comidas'
 */
async function guardarComida(inputElement) {
  const texto = inputElement.value.trim();
  if (!texto && itemsBorrador.length === 0) {
    aviso('Escribe o selecciona algún alimento primero', 'error');
    return;
  }

  const items = itemsBorrador.length > 0 ? itemsBorrador : parsearTextoComida(texto);
  if (items.length === 0) {
    aviso('No se pudo identificar ningún alimento', 'error');
    return;
  }

  const totalKcal = items.reduce((acc, it) => acc + (it.kcal || 0), 0);
  const totalProteina = Math.round(items.reduce((acc, it) => acc + (it.proteina || 0), 0) * 10) / 10;
  const totalCarbos = Math.round(items.reduce((acc, it) => acc + (it.carbos || 0), 0) * 10) / 10;
  const totalGrasa = Math.round(items.reduce((acc, it) => acc + (it.grasa || 0), 0) * 10) / 10;

  const comidaObj = {
    id: nuevoId(),
    fecha: fechaSeleccionada,
    hora: Date.now(),
    texto: texto || items.map(i => i.nombre).join(', '),
    items: items.map(it => ({
      alimentoId: it.alimentoId,
      nombre: it.nombre,
      cantidad: it.cantidadOriginal || 1,
      unidad: it.unidadOriginal || 'porcion',
      gramos: it.gramos,
      kcal: it.kcal,
      proteina: it.proteina,
      carbos: it.carbos,
      grasa: it.grasa
    })),
    kcal: totalKcal,
    proteina: totalProteina,
    carbos: totalCarbos,
    grasa: totalGrasa
  };

  await guardar('comidas', comidaObj);
  itemsBorrador = [];
  inputElement.value = '';
  aviso('Comida guardada con éxito', 'ok');
  await renderizar();
}

/**
 * Elimina una comida previa con confirmación
 */
async function eliminarComida(id) {
  const conf = await confirmar('¿Deseas eliminar este registro de comida?');
  if (!conf) return;

  await borrar('comidas', id);
  aviso('Comida eliminada', 'info');
  await renderizar();
}

/**
 * Muestra el detalle de una comida en un diálogo
 */
async function verDetalleComida(comida) {
  const horaTexto = comida.hora ? new Date(comida.hora).toLocaleTimeString() : '';
  const lineas = (comida.items && comida.items.length > 0)
    ? comida.items.map(i => `• ${i.nombre} (${i.cantidad || 1} ${i.unidad || ''}): ${i.kcal} kcal, ${i.proteina}g prot, ${i.carbos || 0}g carb, ${i.grasa || 0}g grasa`).join('\n')
    : comida.texto;

  await dialogo({
    titulo: `Detalle (${horaTexto})`,
    cuerpo: `${lineas}\n\nTotales: ${comida.kcal} kcal | ${comida.proteina}g proteína | ${comida.carbos || 0}g carbohidratos | ${comida.grasa || 0}g grasa`,
    botones: [{ texto: 'Cerrar', valor: 'cerrar', tipo: 'primario' }]
  });
}

/**
 * Diálogo interactivo: Método de la mano (sin pesar nada)
 */
async function abrirMetodoMano() {
  const porcionesMano = [
    {
      titulo: 'Palma de la mano (Proteínas)',
      desc: '~100 a 150 g de carne, pollo, pescado o 2 huevos',
      alimentosRecomendados: ['pechuga-pollo', 'lomo-res', 'lomo-cerdo', 'tilapia-filete', 'huevo-entero', 'atun-agua']
    },
    {
      titulo: 'Puño cerrado (Carbohidratos y Frutas)',
      desc: '~1 taza de arroz, pasta, papa, legumbres o fruta picada',
      alimentosRecomendados: ['arroz-blanco', 'pasta-cocida', 'papa-pastusa', 'frijoles-rojos', 'lentejas-cocidas', 'banano', 'avena-hojuelas']
    },
    {
      titulo: 'Pulgar (Grasas saludables)',
      desc: '~1 cucharada (10-15 g) de aceite, mantequilla, aguacate o queso',
      alimentosRecomendados: ['aceite-oliva', 'aguacate-hass', 'mantequilla', 'queso-campesino', 'queso-costeno']
    },
    {
      titulo: 'Dos manos juntas / Cuenco (Vegetales)',
      desc: '~150 a 200 g de verduras o ensalada fresca',
      alimentosRecomendados: ['lechuga', 'tomate-chonto', 'brocoli', 'espinaca', 'zanahoria']
    },
    {
      titulo: 'Puñado cerrado (Frutos secos)',
      desc: '~30 g de maní o almendras',
      alimentosRecomendados: ['mani-tostado', 'almendras']
    }
  ];

  const contenido = h('div', { style: 'max-height: 420px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px;' },
    porcionesMano.map(p => {
      return h('div', {
        style: 'background-color: #E9E4D8; border-radius: 28px; padding: 16px;'
      },
        h('div', { class: 'v2-serif-title', style: 'font-size: 19px;' }, p.titulo),
        h('div', { style: 'font-size: 12px; color: #6B675F; margin: 4px 0 10px;' }, p.desc),
        h('div', { style: 'display: flex; flex-wrap: wrap; gap: 6px;' },
          ...p.alimentosRecomendados.map(id => {
            const al = catalogoAlimentos.find(a => a.id === id);
            if (!al) return null;
            return h('button', {
              class: 'v2-btn-pildora',
              style: 'height: 36px; padding: 0 12px; font-size: 12px; background-color: #F3F0E8;',
              on: {
                click: async () => {
                  await agregarAlimentoDirecto(al, 1);
                  document.querySelector('.v2-modal-overlay')?.remove();
                }
              }
            }, `+ ${al.nombre}`);
          }).filter(Boolean)
        )
      );
    })
  );

  mostrarModalV2('Porciones con la mano', contenido);
}

/**
 * Catálogo visual y buscador con filtro
 */
async function abrirCatalogoVisual() {
  const inputBusqueda = h('input', {
    type: 'search',
    class: 'v2-input-redondo',
    placeholder: 'Escribe para filtrar (huevo, pechuga, arroz)...',
    style: 'margin-bottom: 12px;'
  });

  const contenedorLista = h('div', { style: 'max-height: 340px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;' });

  function actualizarFiltro(termino) {
    contenedorLista.innerHTML = '';
    const norm = normalizar(termino);
    const filtrados = catalogoAlimentos.filter(al => {
      if (!norm) return true;
      return normalizar(al.nombre).includes(norm) || (al.alias && al.alias.some(a => normalizar(a).includes(norm)));
    });

    if (filtrados.length === 0) {
      contenedorLista.appendChild(h('div', { style: 'text-align: center; padding: 24px; color: #6B675F; font-size: 14px;' }, 'No se encontraron alimentos colombianos.'));
      return;
    }

    filtrados.forEach(al => {
      const fila = h('div', {
        class: 'v2-item-comida',
        style: 'margin-bottom: 0; padding: 12px 16px;'
      },
        h('div', { style: 'flex: 1;' },
          h('div', { style: 'font-weight: 600; font-size: 14px; color: #17171A;' }, al.nombre),
          h('div', { style: 'font-size: 11px; color: #6B675F; font-variant-numeric: tabular-nums;' },
            `${al.porcion} · ${al.kcal} kcal · ${al.proteina}g prot`
          )
        ),
        h('button', {
          class: 'v2-btn-pildora',
          style: 'height: 36px; padding: 0 14px; font-size: 12px; background-color: #C8F03C; font-weight: 700;',
          on: {
            click: async () => {
              await agregarAlimentoDirecto(al, 1);
              document.querySelector('.v2-modal-overlay')?.remove();
            }
          }
        }, '+ Agregar')
      );
      contenedorLista.appendChild(fila);
    });
  }

  inputBusqueda.addEventListener('input', (e) => actualizarFiltro(e.target.value));
  actualizarFiltro('');

  const modalBody = h('div', {}, inputBusqueda, contenedorLista);
  mostrarModalV2('Catálogo de alimentos colombianos', modalBody);
}

/**
 * Agrega un alimento directo desde los modales al borrador o lo guarda
 */
async function agregarAlimentoDirecto(alimento, cantidad = 1) {
  const item = {
    alimentoId: alimento.id,
    nombre: alimento.nombre,
    cantidadOriginal: cantidad,
    unidadOriginal: 'porcion',
    gramos: alimento.gramos * cantidad,
    kcal: Math.round(alimento.kcal * cantidad),
    proteina: Math.round(alimento.proteina * cantidad * 10) / 10,
    carbos: Math.round((alimento.carbos || 0) * cantidad * 10) / 10,
    grasa: Math.round((alimento.grasa || 0) * cantidad * 10) / 10,
    reconocido: true
  };

  const comidaObj = {
    id: nuevoId(),
    fecha: fechaSeleccionada,
    hora: Date.now(),
    texto: `${alimento.nombre} (${alimento.porcion})`,
    items: [item],
    kcal: item.kcal,
    proteina: item.proteina,
    carbos: item.carbos,
    grasa: item.grasa
  };

  await guardar('comidas', comidaObj);
  aviso(`Agregado: ${alimento.nombre}`, 'ok');
  await renderizar();
}

/**
 * Modal flotante auxiliar con estética Forja v2 (Revista de sala)
 */
function mostrarModalV2(titulo, contenidoNodo) {
  document.querySelector('.v2-modal-overlay')?.remove();

  const overlay = h('div', {
    class: 'v2-modal-overlay',
    style: 'position: fixed; inset: 0; background: rgba(23,23,26,0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px;'
  },
    h('div', {
      style: 'width: 100%; max-width: 480px; max-height: 90vh; background-color: #F3F0E8; border-radius: 28px; padding: 24px; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 10px 30px rgba(23,23,26,.18); font-family: "Bricolage Grotesque", sans-serif;'
    },
      h('div', { style: 'display: flex; justify-content: space-between; align-items: center;' },
        h('h3', { class: 'v2-serif-title', style: 'font-size: 26px;' }, titulo),
        h('button', {
          class: 'v2-btn-pildora',
          style: 'width: 40px; height: 40px; padding: 0;',
          on: { click: () => overlay.remove() }
        }, iconoNodo('cerrar', ICONOS_SVGS.cerrar))
      ),
      h('div', { style: 'flex: 1; overflow-y: auto;' }, contenidoNodo)
    )
  );

  document.body.appendChild(overlay);
}

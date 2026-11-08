// =============================================================================
// js/cuerpo.js - Sección 4: Medidas corporales, % grasa Marina y Fotos de progreso
// Pantalla completa de Cuerpo para Forja v2 (PWA) — Dirección «Revista de sala»
// Números héroe tabulares, titulares Instrument Serif, tarjetas papel 2 sin bordes,
// fotos tratadas editorialmente y comparador con deslizador elegante.
// =============================================================================

import { abrir, nuevoId, guardar, obtener, borrar, todos, filtrar } from './db.js';
import { h, aviso, dialogo, confirmar, hoyISO, fechaBonita, formatoKg } from './ui.js';
import { grasaNavy, promedioMovil, tendenciaSemanal } from './calculos.js';
import { perfil } from './datos.js';
import { ir } from './app.js';
import { icono } from './iconos.js';

let contenedorRaiz = null;
let urlsFotosCreadas = [];
let fnResizeComparador = null;
let perfilUsuario = null;
let datosMedidas = [];
let datosFotos = [];
let datosCamara = [];
let vistaFotoFiltro = 'todas'; // 'todas' | 'frente' | 'lado' | 'espalda'
let fotoIdAntes = null;
let fotoIdDespues = null;

/**
 * Convierte un valor a número finito o devuelve null si no es válido.
 */
function numValido(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Libera las URLs de Blob creadas para evitar fugas de memoria en el navegador.
 */
function limpiarUrlsFotos() {
  for (const url of urlsFotosCreadas) {
    try {
      URL.revokeObjectURL(url);
    } catch (e) {
      // Ignorar errores al revocar
    }
  }
  urlsFotosCreadas = [];
}

/**
 * Monta la pantalla de Cuerpo en el contenedor proporcionado.
 *
 * @param {HTMLElement} contenedor - Contenedor DOM donde se monta la pantalla
 * @param {Array} [params=[]] - Parámetros de ruta
 */
export async function montar(contenedor, params = []) {
  contenedorRaiz = contenedor;
  limpiarUrlsFotos();

  await cargarDatos();
  renderizarPantalla();
}

/**
 * Desmonta la pantalla y libera recursos en memoria y listeners de ventana.
 */
export function desmontar() {
  limpiarUrlsFotos();
  if (fnResizeComparador) {
    window.removeEventListener('resize', fnResizeComparador);
    fnResizeComparador = null;
  }
  contenedorRaiz = null;
}

/**
 * Carga todos los datos necesarios desde IndexedDB respetando la integridad de Forja.
 */
async function cargarDatos() {
  try {
    perfilUsuario = await perfil();
  } catch (e) {
    perfilUsuario = { estaturaCm: 175 };
  }

  try {
    datosMedidas = await todos('medidas');
    datosMedidas.sort((a, b) => {
      if (b.fecha !== a.fecha) return b.fecha > a.fecha ? 1 : -1;
      // Priorizar siempre registro manual sobre registro óptico de cámara en la misma fecha
      if (a.origen === 'manual' && b.origen !== 'manual') return -1;
      if (b.origen === 'manual' && a.origen !== 'manual') return 1;
      return (b.actualizado || 0) - (a.actualizado || 0);
    });
  } catch (e) {
    datosMedidas = [];
  }

  try {
    const todasFotos = await todos('fotos');
    datosFotos = (todasFotos || []).filter((f) => f && f.blob instanceof Blob);
    datosFotos.sort((a, b) => (b.fecha > a.fecha ? 1 : b.fecha < a.fecha ? -1 : 0));
  } catch (e) {
    datosFotos = [];
  }

  try {
    datosCamara = await todos('camara');
    datosCamara.sort((a, b) => (b.fecha > a.fecha ? 1 : b.fecha < a.fecha ? -1 : 0));
  } catch (e) {
    datosCamara = [];
  }

  // Preseleccionar fotos para el comparador si existen registros
  if (datosFotos.length >= 2) {
    if (!fotoIdDespues || !datosFotos.some((f) => f.id === fotoIdDespues)) {
      fotoIdDespues = datosFotos[0].id;
    }
    if (!fotoIdAntes || !datosFotos.some((f) => f.id === fotoIdAntes)) {
      fotoIdAntes = datosFotos[datosFotos.length - 1].id;
    }
  } else if (datosFotos.length === 1) {
    fotoIdDespues = datosFotos[0].id;
    fotoIdAntes = null;
  }
}

const ESTILOS_CUERPO = `
  /* --- Estilos canónicos Forja v2 (Revista de sala) para Cuerpo --- */
  .cuerpo-v2-contenedor {
    max-width: 520px;
    margin: 0 auto;
    padding: 8px 16px 48px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    font-family: 'Bricolage Grotesque', system-ui, -apple-system, sans-serif;
    color: #17171A;
  }
  .cuerpo-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    padding: 4px 4px 0;
    gap: 12px;
    flex-wrap: wrap;
  }
  .cuerpo-header-titular {
    font-family: 'Instrument Serif', Georgia, serif;
    font-size: 40px;
    font-weight: 400;
    color: #17171A;
    line-height: 1.02;
    letter-spacing: -0.02em;
    margin: 0;
  }
  .cuerpo-header-titular em {
    font-style: italic;
  }
  .cuerpo-header-sub {
    font-size: 14px;
    color: #5D5951;
    font-weight: 500;
    margin-top: 3px;
  }
  .cuerpo-acciones-top {
    display: flex;
    gap: 8px;
  }
  .cuerpo-btn-pildora {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 48px;
    height: 48px;
    padding: 0 18px;
    border-radius: 999px;
    border: none;
    font-family: 'Bricolage Grotesque', sans-serif;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    transition: transform 140ms cubic-bezier(.2,.8,.2,1);
  }
  .cuerpo-btn-pildora:active {
    transform: scale(0.96);
  }
  .cuerpo-btn-lima {
    background-color: #C8F03C;
    color: #17171A;
  }
  .cuerpo-btn-papel {
    background-color: #E9E4D8;
    color: #17171A;
  }
  .cuerpo-tarjeta-v2 {
    background-color: #E9E4D8;
    border-radius: 28px;
    border: none;
    padding: 22px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .cuerpo-kicker-unico {
    font-size: 10px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    font-weight: 700;
    color: #5D5951;
    line-height: 1;
  }
  .cuerpo-subtitulo-card {
    font-size: 14px;
    font-weight: 600;
    color: #5D5951;
    text-transform: none;
    letter-spacing: normal;
    line-height: 1.2;
  }
  .cuerpo-numero-heroe {
    font-family: 'Bricolage Grotesque', sans-serif;
    font-size: clamp(64px, 16vw, 84px);
    font-weight: 800;
    line-height: 0.95;
    color: #17171A;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.03em;
  }
  .cuerpo-numero-unidad {
    font-size: 24px;
    font-weight: 500;
    color: #5D5951;
    margin-left: 4px;
  }
  .cuerpo-chip-diferencia {
    display: inline-flex;
    align-items: center;
    padding: 6px 14px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
  }
  .cuerpo-chip-ok {
    background-color: #C8F03C;
    color: #17171A;
  }
  .cuerpo-chip-alerta {
    background-color: #B83218;
    color: #FFFFFF;
  }
  .cuerpo-fila-resumen {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: #F3F0E8;
    border-radius: 28px;
    padding: 14px 18px;
    font-size: 13px;
    flex-wrap: wrap;
    gap: 8px;
  }
  .cuerpo-grid-medidas {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .cuerpo-celda-medida {
    background-color: #F3F0E8;
    border-radius: 28px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 6px;
  }
  .cuerpo-celda-valor {
    font-family: 'Bricolage Grotesque', sans-serif;
    font-size: 28px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    color: #17171A;
    line-height: 1;
    letter-spacing: -0.02em;
  }
  .cuerpo-comparador-marco {
    position: relative;
    width: 100%;
    height: 340px;
    border-radius: 28px;
    overflow: hidden;
    background-color: #17171A;
    user-select: none;
  }
  .cuerpo-comparador-img {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: contrast(1.05) saturate(0.9);
  }
  .cuerpo-comparador-capa-split {
    position: absolute;
    top: 0;
    left: 0;
    width: 50%;
    height: 100%;
    overflow: hidden;
    border-right: 2.5px solid #C8F03C;
    box-shadow: 0 0 16px rgba(0, 0, 0, 0.4);
  }
  .cuerpo-comparador-manija {
    position: absolute;
    top: 50%;
    right: -17px;
    transform: translateY(-50%);
    width: 34px;
    height: 34px;
    background-color: #C8F03C;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #17171A;
    box-shadow: 0 2px 10px rgba(23, 23, 26, 0.3);
    z-index: 6;
  }
  .cuerpo-comparador-badge {
    position: absolute;
    bottom: 14px;
    border-radius: 999px;
    background-color: rgba(23, 23, 26, 0.88);
    color: #F3F0E8;
    font-size: 12px;
    font-weight: 600;
    padding: 6px 14px;
    z-index: 5;
  }
  .cuerpo-slider-rango {
    width: 100%;
    accent-color: #C8F03C;
    height: 6px;
    border-radius: 999px;
    cursor: ew-resize;
    margin: 12px 0 4px;
  }
  .cuerpo-foto-card {
    position: relative;
    border-radius: 28px;
    overflow: hidden;
    background-color: #F3F0E8;
    cursor: pointer;
    transition: transform 140ms ease;
  }
  .cuerpo-foto-card:active {
    transform: scale(0.97);
  }
  .cuerpo-foto-card img {
    width: 100%;
    height: 140px;
    object-fit: cover;
    display: block;
    filter: contrast(1.05) saturate(0.9);
  }
  .cuerpo-item-historial {
    background-color: #F3F0E8;
    border-radius: 999px;
    padding: 10px 14px 10px 18px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }
  .cuerpo-btn-eliminar-pildora {
    min-width: 48px;
    min-height: 48px;
    width: 48px;
    height: 48px;
    border-radius: 999px;
    border: none;
    background-color: transparent;
    color: #E2553A;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background-color 140ms ease;
    flex-shrink: 0;
  }
  .cuerpo-btn-eliminar-pildora:active {
    background-color: rgba(226, 85, 58, 0.12);
  }
`;

/**
 * Renderiza la interfaz de usuario completa de Cuerpo aplicando la dirección Forja v2
 * mediante creación segura de nodos DOM con h() (cero innerHTML con datos).
 */
function renderizarPantalla() {
  if (!contenedorRaiz) return;
  limpiarUrlsFotos();

  // Medidas manuales separadas de las estimaciones ópticas de cámara
  const medidasManuales = datosMedidas.filter((m) => m.origen !== 'camara');

  const medidasConPeso = datosMedidas.filter((m) => numValido(m.peso) !== null);
  const ultimaConPeso = medidasConPeso[0] || null;
  const anteriorConPeso = medidasConPeso[1] || null;

  // 1. Cálculos de peso, promedio móvil de 7 días por FECHA (ALTO-04) y tendencia semanal
  const pesosHistorial = medidasConPeso
    .map((m) => ({ fecha: String(m.fecha || ''), valor: Number(m.peso) }))
    .sort((a, b) => (a.fecha > b.fecha ? 1 : a.fecha < b.fecha ? -1 : 0));

  const hoyMs = new Date(hoyISO() + 'T12:00:00').getTime();
  const ms7Dias = 7 * 24 * 60 * 60 * 1000;
  const medidas7d = pesosHistorial.filter((p) => {
    const t = new Date(p.fecha + 'T12:00:00').getTime();
    return (hoyMs - t) >= 0 && (hoyMs - t) < ms7Dias;
  });

  const serieMovil7d = promedioMovil(pesosHistorial, 7);
  const promedio7dias = medidas7d.length > 0
    ? (medidas7d.reduce((acc, v) => acc + v.valor, 0) / medidas7d.length).toFixed(1)
    : (serieMovil7d.length > 0 ? serieMovil7d[serieMovil7d.length - 1].valor.toFixed(1) : null);

  const tendencia = tendenciaSemanal(pesosHistorial);
  const textoTendencia = tendencia !== null
    ? `${tendencia > 0 ? '+' : ''}${tendencia.toFixed(2)} kg/sem`
    : 'Datos insuficientes';

  // 2. Cálculo de % Grasa Fórmula Marina EE. UU. (priorizando medidas manuales)
  let grasaEstimada = null;
  const estatura = numValido(perfilUsuario?.estaturaCm);
  const medidaConGrasa =
    medidasManuales.find((m) => (numValido(m.cintura) && numValido(m.cuello)) || numValido(m.grasaNavy)) ||
    datosMedidas.find((m) => (numValido(m.cintura) && numValido(m.cuello)) || numValido(m.grasaNavy)) ||
    datosMedidas[0] ||
    null;

  const cintGrasa = numValido(medidaConGrasa?.cintura);
  const cuelloGrasa = numValido(medidaConGrasa?.cuello);
  if (cintGrasa && cuelloGrasa && estatura) {
    grasaEstimada = grasaNavy(cintGrasa, cuelloGrasa, estatura);
  } else if (numValido(medidaConGrasa?.grasaNavy) !== null) {
    grasaEstimada = numValido(medidaConGrasa.grasaNavy);
  }

  // 3. Mediciones de cámara (Ratio V y proporciones ópticas guardadas aparte)
  const ultimaCamara = datosCamara[0] || null;

  // Buscar último valor y penúltimo valor por campo priorizando medidas manuales
  function obtenerValoresCampo(campo) {
    const manualesValidas = medidasManuales.filter((m) => numValido(m[campo]) !== null);
    if (manualesValidas.length > 0) {
      return {
        actual: Number(manualesValidas[0][campo]),
        anterior: manualesValidas.length >= 2 ? Number(manualesValidas[1][campo]) : null
      };
    }
    const todasValidas = datosMedidas.filter((m) => numValido(m[campo]) !== null);
    return {
      actual: todasValidas.length > 0 ? Number(todasValidas[0][campo]) : null,
      anterior: todasValidas.length >= 2 ? Number(todasValidas[1][campo]) : null
    };
  }

  const cCintura = obtenerValoresCampo('cintura');
  const cCuello = obtenerValoresCampo('cuello');
  const cPecho = obtenerValoresCampo('pecho');
  const cBrazo = obtenerValoresCampo('brazo');
  const cHombros = obtenerValoresCampo('hombros');
  const cCadera = obtenerValoresCampo('cadera');

  // Diferencia de peso respecto al pesaje anterior
  let nodoDiffPeso = null;
  if (ultimaConPeso && anteriorConPeso) {
    const diffP = Number(ultimaConPeso.peso) - Number(anteriorConPeso.peso);
    const claseChip = diffP <= 0 ? 'cuerpo-chip-ok' : 'cuerpo-chip-alerta';
    nodoDiffPeso = h('div', { class: `cuerpo-chip-diferencia ${claseChip}` },
      `${diffP > 0 ? '+' : ''}${diffP.toFixed(1)} kg`
    );
  }

  // Explicación contextual de la Fórmula Marina
  let nodoDetalleGrasa;
  if (!estatura) {
    nodoDetalleGrasa = h('p', { style: 'font-size:13px;color:#5D5951;line-height:1.45;margin:0;' },
      h('span', { style: 'display:inline-flex;align-items:center;gap:6px;vertical-align:middle;margin-right:4px;' }, icono('alerta', 16)),
      'No has configurado tu estatura en Ajustes. ',
      h('a', {
        href: '#ajustes',
        style: 'color:#17171A;font-weight:600;text-decoration:underline;',
        on: { click: (e) => { e.preventDefault(); ir('#ajustes'); } }
      }, 'Ir a Ajustes')
    );
  } else if (!cintGrasa || !cuelloGrasa) {
    nodoDetalleGrasa = h('p', { style: 'font-size:13px;color:#5D5951;line-height:1.45;margin:0;' },
      `Requiere cintura (${cintGrasa ?? '?'} cm) y cuello (${cuelloGrasa ?? '?'} cm) con estatura (${estatura} cm). Es un cálculo aproximado.`
    );
  } else {
    nodoDetalleGrasa = h('p', { style: 'font-size:13px;color:#5D5951;line-height:1.45;margin:0;' },
      `Estimado aproximado a partir de cintura (${cintGrasa} cm), cuello (${cuelloGrasa} cm) y estatura (${estatura} cm).`
    );
  }

  // Bloque de proporciones medidas con cámara (guardadas aparte de las medidas manuales)
  const ratioCamara = numValido(ultimaCamara?.ratioV);
  const hombrosCam = numValido(ultimaCamara?.hombrosCm);
  const cinturaCam = numValido(ultimaCamara?.cinturaCm);
  const margenCam = numValido(ultimaCamara?.margenCm) ?? 3;

  const nodoResumenCamara = ultimaCamara
    ? h('div', { class: 'cuerpo-fila-resumen', style: 'margin-top:2px;' },
        h('div', {},
          h('span', { style: 'color:#5D5951;' }, `Cámara (${fechaBonita(ultimaCamara.fecha)}): `),
          h('strong', { style: 'color:#17171A;' },
            `Hombros ${hombrosCam ?? '--'} cm · Cintura óptica ${cinturaCam ?? '--'} cm`
          )
        ),
        h('span', { style: 'font-size:12px;color:#5D5951;font-weight:600;' }, `±${margenCam} cm aprox.`)
      )
    : null;

  const botonesFiltro = [
    { id: 'todas', texto: 'Todas' },
    { id: 'frente', texto: 'Frente' },
    { id: 'lado', texto: 'Lado' },
    { id: 'espalda', texto: 'Espalda' }
  ].map((f) => {
    const activo = vistaFotoFiltro === f.id;
    return h('button', {
      type: 'button',
      class: 'cuerpo-btn-pildora btn-filtro-foto',
      dataset: { vista: f.id },
      style: `min-height:48px;height:48px;padding:0 16px;background-color:${activo ? '#17171A' : '#F3F0E8'};color:${activo ? '#F3F0E8' : '#17171A'};`,
      on: {
        click: () => {
          vistaFotoFiltro = f.id;
          renderizarPantalla();
        }
      }
    }, f.texto);
  });

  const vistaDOM = h('div', { class: 'cuerpo-v2-contenedor' },
    // Encabezado editorial con Instrument Serif
    h('div', { class: 'cuerpo-header' },
      h('div', {},
        h('span', { class: 'cuerpo-kicker-unico' }, 'ANTROPOMETRÍA'),
        h('h2', { class: 'cuerpo-header-titular' }, 'Mi ', h('em', {}, 'cuerpo')),
        h('div', { class: 'cuerpo-header-sub' }, 'Seguimiento físico y composición')
      ),
      h('div', { class: 'cuerpo-acciones-top' },
        h('button', {
          id: 'btn-abrir-camara',
          type: 'button',
          class: 'cuerpo-btn-pildora cuerpo-btn-papel',
          title: 'Abrir cámara y visión artificial',
          on: { click: () => ir('#camara') }
        }, icono('camara', 20), h('span', {}, 'Cámara')),
        h('button', {
          id: 'btn-nueva-medida',
          type: 'button',
          class: 'cuerpo-btn-pildora cuerpo-btn-lima',
          title: 'Registrar nuevas medidas',
          on: { click: abrirModalNuevaMedida }
        }, icono('mas', 20), h('span', {}, 'Medida'))
      )
    ),

    // Tarjeta 1: Peso en ayunas (Número héroe gigante en Bricolage Grotesque)
    h('div', { class: 'cuerpo-tarjeta-v2' },
      h('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;' },
        h('span', { class: 'cuerpo-subtitulo-card' }, 'Peso en ayunas'),
        h('span', { style: 'font-size:13px;color:#5D5951;font-weight:500;' },
          ultimaConPeso ? fechaBonita(ultimaConPeso.fecha) : 'Sin registros'
        )
      ),
      h('div', { style: 'display:flex;align-items:baseline;gap:12px;margin:2px 0;flex-wrap:wrap;' },
        h('div', { class: 'cuerpo-numero-heroe' },
          ultimaConPeso ? String(Number(ultimaConPeso.peso)) : '--',
          h('span', { class: 'cuerpo-numero-unidad' }, 'kg')
        ),
        nodoDiffPeso
      ),
      h('div', { class: 'cuerpo-fila-resumen' },
        h('div', {},
          h('span', { style: 'color:#5D5951;' }, 'Promedio 7 días:'),
          h('strong', { style: 'color:#17171A;margin-left:4px;' }, promedio7dias ? `${promedio7dias} kg` : 'Sin datos')
        ),
        h('div', {},
          h('span', { style: 'color:#5D5951;' }, 'Tendencia:'),
          h('strong', { style: 'color:#17171A;margin-left:4px;' }, textoTendencia)
        )
      )
    ),

    // Tarjeta 2: % Grasa Fórmula Marina EE. UU.
    h('div', { class: 'cuerpo-tarjeta-v2' },
      h('div', { style: 'display:flex;justify-content:space-between;align-items:center;' },
        h('span', { class: 'cuerpo-subtitulo-card' }, 'Fórmula Marina EE. UU.'),
        h('span', { class: 'cuerpo-chip-diferencia cuerpo-chip-ok', style: 'font-size:11px;padding:4px 10px;' },
          'Margen ±3-4%'
        )
      ),
      h('div', { style: 'display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;' },
        h('div', { class: 'cuerpo-numero-heroe', style: 'font-size:clamp(52px, 13vw, 68px);' },
          grasaEstimada !== null ? `${grasaEstimada}%` : '--'
        ),
        h('span', { style: 'font-size:14px;color:#5D5951;font-weight:500;' },
          grasaEstimada !== null ? 'grasa corporal estimada' : 'Registra cintura, cuello y estatura'
        )
      ),
      nodoDetalleGrasa
    ),

    // Tarjeta 3: Medidas Corporales Actuales y Ratio V
    h('div', { class: 'cuerpo-tarjeta-v2' },
      h('div', { style: 'display:flex;justify-content:space-between;align-items:center;' },
        h('span', { class: 'cuerpo-subtitulo-card' }, 'Medidas corporales (cm)'),
        ratioCamara !== null
          ? h('span', { class: 'cuerpo-chip-diferencia cuerpo-chip-ok', style: 'font-size:12px;' }, `Ratio V: ${ratioCamara}`)
          : null
      ),
      h('div', { class: 'cuerpo-grid-medidas' },
        crearNodoItemMedida('Cintura', cCintura.actual, cCintura.anterior),
        crearNodoItemMedida('Cuello', cCuello.actual, cCuello.anterior),
        crearNodoItemMedida('Pecho', cPecho.actual, cPecho.anterior),
        crearNodoItemMedida('Brazo', cBrazo.actual, cBrazo.anterior),
        crearNodoItemMedida('Hombros', cHombros.actual, cHombros.anterior),
        crearNodoItemMedida('Cadera', cCadera.actual, cCadera.anterior)
      ),
      nodoResumenCamara
    ),

    // Sección: Fotos de Progreso y Comparador con deslizador elegante
    h('div', { class: 'cuerpo-tarjeta-v2' },
      h('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:8px;' },
        h('div', {},
          h('h3', {
            style: "font-family:'Instrument Serif',Georgia,serif;font-size:26px;font-weight:400;margin:0;line-height:1.1;"
          }, 'Fotos de ', h('em', {}, 'progreso')),
          h('span', { style: 'font-size:12px;color:#5D5951;' }, 'Privadas y seguras en tu teléfono')
        ),
        h('button', {
          id: 'btn-subir-foto',
          type: 'button',
          class: 'cuerpo-btn-pildora',
          style: 'background-color:#F3F0E8;color:#17171A;min-height:48px;height:48px;padding:0 16px;',
          on: { click: abrirModalSubirFoto }
        }, icono('subir', 18), h('span', {}, 'Subir foto'))
      ),
      h('div', { style: 'display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;' }, ...botonesFiltro),
      h('div', { id: 'contenedor-comparador-fotos' }),
      h('div', {
        id: 'galeria-fotos-progreso',
        style: 'display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px;'
      })
    ),

    // Sección: Historial de registros anteriores
    h('div', { class: 'cuerpo-tarjeta-v2' },
      h('span', { class: 'cuerpo-subtitulo-card' }, 'Historial de mediciones'),
      h('div', { id: 'lista-historial-medidas', style: 'display:flex;flex-direction:column;gap:6px;' })
    )
  );

  contenedorRaiz.replaceChildren(h('style', {}, ESTILOS_CUERPO), vistaDOM);

  renderizarComparador();
  renderizarGaleriaFotos();
  renderizarHistorialMedidas();
}

/**
 * Crea un nodo DOM seguro para una celda de medida individual con su variación.
 * Corrección CRÍTICO-01 (diseno.md): Fondo Lima (#C8F03C) con texto Tinta (#17171A) para contraste >13.5:1.
 * Corrección Hallazgo 8 (seguridad_privacidad.md): Uso de h() en vez de innerHTML.
 */
function crearNodoItemMedida(nombre, valorActual, valorAnterior) {
  const valAct = numValido(valorActual);
  const valAnt = numValido(valorAnterior);

  let nodoBadgeDiff = null;
  if (valAct !== null && valAnt !== null) {
    const d = valAct - valAnt;
    const textoDiff = d !== 0 ? `${d > 0 ? '+' : ''}${d.toFixed(1)} cm` : '= 0 cm';
    nodoBadgeDiff = h('span', {
      style: 'background:#C8F03C;color:#17171A;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:-0.01em;'
    }, textoDiff);
  }

  return h('div', { class: 'cuerpo-celda-medida' },
    h('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:4px;' },
      h('span', { style: 'font-size:13px;color:#5D5951;font-weight:500;' }, nombre),
      nodoBadgeDiff
    ),
    h('div', { class: 'cuerpo-celda-valor' },
      valAct !== null ? String(valAct) : '--',
      valAct !== null ? h('span', { style: 'font-size:15px;font-weight:500;color:#5D5951;margin-left:3px;' }, 'cm') : null
    )
  );
}

/**
 * Crea el icono SVG de doble flecha para la manija del comparador.
 */
function crearIconoManijaComparador() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');

  const p1 = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  p1.setAttribute('points', '8 7 3 12 8 17');
  const p2 = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  p2.setAttribute('points', '16 7 21 12 16 17');
  svg.appendChild(p1);
  svg.appendChild(p2);
  return svg;
}

/**
 * Renderiza el comparador interactivo de dos fotos superpuestas con un deslizador elegante Forja v2.
 */
function renderizarComparador() {
  const cont = document.getElementById('contenedor-comparador-fotos');
  if (!cont) return;

  if (fnResizeComparador) {
    window.removeEventListener('resize', fnResizeComparador);
    fnResizeComparador = null;
  }

  // Estado vacío editorial con llamado a la acción (MEDIO-06 diseno.md)
  if (datosFotos.length < 2) {
    const estadoVacio = h('div', {
      style: 'background:#F3F0E8;border-radius:28px;padding:36px 24px;text-align:center;margin-top:4px;'
    },
      h('div', {
        style: 'width:56px;height:56px;border-radius:999px;background:#E9E4D8;display:inline-flex;align-items:center;justify-content:center;margin-bottom:14px;color:#17171A;'
      }, icono('camara', 26)),
      h('h4', {
        style: "font-family:'Instrument Serif',Georgia,serif;font-size:22px;font-weight:400;margin:0 0 8px 0;color:#17171A;"
      }, 'Compara tu transformación'),
      h('p', {
        style: 'font-size:14px;color:#5D5951;margin:0 auto 20px auto;line-height:1.5;max-width:280px;'
      }, 'Registra al menos 2 fotos de frente, lado o espalda en fechas distintas para comparar tu evolución lado a lado.'),
      h('button', {
        type: 'button',
        id: 'btn-abrir-camara-vacio',
        class: 'cuerpo-btn-pildora cuerpo-btn-lima',
        style: 'min-height:48px;border-radius:999px;padding:0 24px;',
        on: { click: () => ir('#camara') }
      }, icono('camara', 18), h('span', {}, 'Tomar foto ahora'))
    );
    cont.replaceChildren(estadoVacio);
    return;
  }

  const fotoAntes = datosFotos.find((f) => f.id === fotoIdAntes) || datosFotos[datosFotos.length - 1];
  const fotoDespues = datosFotos.find((f) => f.id === fotoIdDespues) || datosFotos[0];

  if (!fotoAntes || !(fotoAntes.blob instanceof Blob) || !fotoDespues || !(fotoDespues.blob instanceof Blob)) {
    cont.replaceChildren(estadoVacio);
    return;
  }

  const urlAntes = URL.createObjectURL(fotoAntes.blob);
  const urlDespues = URL.createObjectURL(fotoDespues.blob);
  urlsFotosCreadas.push(urlAntes, urlDespues);

  const imgDespuesEl = h('img', {
    src: urlDespues,
    alt: 'Foto después',
    class: 'cuerpo-comparador-img'
  });

  const capaSplit = h('div', {
    id: 'capa-despues-split',
    class: 'cuerpo-comparador-capa-split'
  },
    imgDespuesEl,
    h('div', { class: 'cuerpo-comparador-manija' }, crearIconoManijaComparador())
  );

  const marcoBox = h('div', {
    id: 'cuerpo-slider-box',
    class: 'cuerpo-comparador-marco'
  },
    h('img', { src: urlAntes, alt: 'Foto antes', class: 'cuerpo-comparador-img' }),
    capaSplit,
    h('span', { class: 'cuerpo-comparador-badge', style: 'left:12px;' }, 'Después'),
    h('span', { class: 'cuerpo-comparador-badge', style: 'right:12px;' }, 'Antes')
  );

  const slider = h('input', {
    id: 'input-slider-comparar',
    class: 'cuerpo-slider-rango',
    type: 'range',
    min: '0',
    max: '100',
    value: '50',
    'aria-label': 'Deslizar para comparar antes y después',
    on: {
      input: (e) => {
        capaSplit.style.width = `${e.target.value}%`;
      }
    }
  });

  const vistaAntes = ['frente', 'lado', 'espalda'].includes(fotoAntes.vista) ? fotoAntes.vista : 'frente';
  const vistaDespues = ['frente', 'lado', 'espalda'].includes(fotoDespues.vista) ? fotoDespues.vista : 'frente';

  // Etiquetas direccionales corregidas (MEDIO-09 camara_cuerpo.md):
  // Izquierda (0%) = Ver antes · Derecha (100%) = Ver después
  const bloqueComparador = h('div', {
    style: 'background-color:#F3F0E8;border-radius:28px;padding:16px;display:flex;flex-direction:column;gap:12px;'
  },
    h('div', { style: 'display:flex;justify-content:space-between;align-items:center;font-size:13px;flex-wrap:wrap;gap:6px;' },
      h('div', {},
        h('span', { style: 'color:#5D5951;' }, 'Antes: '),
        h('strong', { style: 'color:#17171A;' }, fechaBonita(fotoAntes.fecha)),
        h('span', { style: 'color:#5D5951;' }, ` (${vistaAntes})`)
      ),
      h('div', {},
        h('span', { style: 'color:#5D5951;' }, 'Después: '),
        h('strong', { style: 'color:#17171A;' }, fechaBonita(fotoDespues.fecha)),
        h('span', { style: 'color:#5D5951;' }, ` (${vistaDespues})`)
      )
    ),
    marcoBox,
    h('div', {},
      slider,
      h('div', { style: 'display:flex;justify-content:space-between;font-size:12px;color:#5D5951;font-weight:500;' },
        h('span', { style: 'display:inline-flex;align-items:center;gap:4px;' },
          icono('flecha-izq', 14),
          'Ver antes (0%)'
        ),
        h('span', {}, 'Desliza para comparar'),
        h('span', { style: 'display:inline-flex;align-items:center;gap:4px;' },
          'Ver después (100%)',
          icono('flecha-der', 14)
        )
      )
    )
  );

  cont.replaceChildren(bloqueComparador);

  // Sincronizar el ancho de la imagen interior en cada cambio de tamaño de ventana (BAJO-13 camara_cuerpo.md)
  const ajustarAnchoImagen = () => {
    const boxWidth = marcoBox.offsetWidth || 340;
    imgDespuesEl.style.width = `${boxWidth}px`;
    imgDespuesEl.style.maxWidth = 'none';
  };

  ajustarAnchoImagen();
  fnResizeComparador = ajustarAnchoImagen;
  window.addEventListener('resize', fnResizeComparador);
}

/**
 * Renderiza la galería de miniaturas de fotos tratadas con filtro por vista.
 */
function renderizarGaleriaFotos() {
  const galeria = document.getElementById('galeria-fotos-progreso');
  if (!galeria) return;

  const fotosFiltradas = datosFotos.filter(
    (f) => vistaFotoFiltro === 'todas' || f.vista === vistaFotoFiltro
  );

  if (fotosFiltradas.length === 0) {
    galeria.replaceChildren(
      h('div', {
        style: 'grid-column:span 2;padding:24px 16px;text-align:center;background:#F3F0E8;border-radius:28px;'
      },
        h('span', { style: 'font-size:14px;color:#5D5951;' }, 'No hay fotos registradas para esta vista.')
      )
    );
    return;
  }

  const nodosTarjetas = [];
  for (const foto of fotosFiltradas) {
    if (!foto || !(foto.blob instanceof Blob)) continue;
    const url = URL.createObjectURL(foto.blob);
    urlsFotosCreadas.push(url);
    const vistaSegura = ['frente', 'lado', 'espalda'].includes(foto.vista) ? foto.vista : 'frente';

    const tarjetaFoto = h('div', {
      class: 'cuerpo-foto-card',
      on: { click: () => abrirDetalleFoto(foto, url) }
    },
      h('img', { src: url, alt: `Foto de ${vistaSegura}` }),
      h('div', { style: 'padding:8px 12px;font-size:12px;display:flex;justify-content:space-between;align-items:center;' },
        h('span', { style: 'font-weight:600;color:#17171A;' }, fechaBonita(foto.fecha)),
        h('span', {
          style: 'background:#17171A;color:#F3F0E8;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:600;'
        }, vistaSegura)
      )
    );

    nodosTarjetas.push(tarjetaFoto);
  }

  galeria.replaceChildren(...nodosTarjetas);
}

/**
 * Diálogo modal para ver, comparar o eliminar una foto de progreso.
 */
async function abrirDetalleFoto(foto, url) {
  const vistaSegura = ['frente', 'lado', 'espalda'].includes(foto.vista) ? foto.vista : 'frente';
  const altoNum = numValido(foto.altoPx);

  await dialogo({
    titulo: `Foto de ${vistaSegura} (${fechaBonita(foto.fecha)})`,
    cuerpo: h('div', { class: 'col', style: 'gap:12px;' },
      h('img', {
        src: url,
        style: 'width:100%;max-height:360px;object-fit:cover;border-radius:28px;filter:contrast(1.05) saturate(0.9);'
      }),
      h('div', { style: 'font-size:13px;color:#5D5951;' },
        `Vista: ${vistaSegura} · Altura registrada: ${altoNum ? `${Math.round(altoNum)} px` : 'Manual'}`
      )
    ),
    botones: [
      { texto: 'Usar como Antes', valor: 'antes', tipo: 'primario' },
      { texto: 'Usar como Después', valor: 'despues' },
      { texto: 'Eliminar foto', valor: 'borrar', tipo: 'peligro' },
      { texto: 'Cerrar', valor: 'cerrar' }
    ]
  }).then(async (accion) => {
    if (accion === 'antes') {
      fotoIdAntes = foto.id;
      renderizarPantalla();
    } else if (accion === 'despues') {
      fotoIdDespues = foto.id;
      renderizarPantalla();
    } else if (accion === 'borrar') {
      const confirma = await confirmar('¿Seguro que deseas eliminar esta foto de progreso?');
      if (confirma) {
        await borrar('fotos', foto.id);
        aviso('Foto eliminada con éxito', 'info');
        await cargarDatos();
        renderizarPantalla();
      }
    }
  });
}

/**
 * Renderiza el listado histórico de mediciones corporales usando nodos DOM (sin innerHTML).
 * Corrección Seguridad 8: Validación numérica estricta y creación con h().
 */
function renderizarHistorialMedidas() {
  const cont = document.getElementById('lista-historial-medidas');
  if (!cont) return;

  if (datosMedidas.length === 0) {
    cont.replaceChildren(
      h('div', {
        style: 'padding:20px;text-align:center;background:#F3F0E8;border-radius:28px;'
      },
        h('span', { style: 'font-size:14px;color:#5D5951;' }, 'No hay medidas registradas aún. Toca «+ Medida» para iniciar.')
      )
    );
    return;
  }

  const filas = [];

  for (const m of datosMedidas) {
    const detalles = [];
    const vCintura = numValido(m.cintura);
    const vCuello = numValido(m.cuello);
    const vPecho = numValido(m.pecho);
    const vBrazo = numValido(m.brazo);
    const vHombros = numValido(m.hombros);
    const vCadera = numValido(m.cadera);
    const vPeso = numValido(m.peso);

    if (vCintura !== null) detalles.push(`Cintura: ${vCintura} cm`);
    if (vCuello !== null) detalles.push(`Cuello: ${vCuello} cm`);
    if (vPecho !== null) detalles.push(`Pecho: ${vPecho} cm`);
    if (vBrazo !== null) detalles.push(`Brazo: ${vBrazo} cm`);
    if (vHombros !== null) detalles.push(`Hombros: ${vHombros} cm`);
    if (vCadera !== null) detalles.push(`Cadera: ${vCadera} cm`);

    const item = h('div', { class: 'cuerpo-item-historial' },
      h('div', {},
        h('div', { style: 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;' },
          h('strong', { style: 'color:#17171A;font-size:14px;' }, fechaBonita(m.fecha)),
          vPeso !== null
            ? h('span', {
                style: 'background:#C8F03C;color:#17171A;border-radius:999px;padding:2px 8px;font-size:12px;font-weight:600;'
              }, `${vPeso} kg`)
            : null,
          m.origen === 'camara'
            ? h('span', {
                style: 'background:#E9E4D8;color:#17171A;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:600;'
              }, 'Cámara')
            : null
        ),
        h('div', { style: 'font-size:12px;color:#5D5951;margin-top:2px;' },
          detalles.length > 0 ? detalles.join(' · ') : 'Solo peso registrado'
        )
      ),
      h('button', {
        type: 'button',
        class: 'cuerpo-btn-eliminar-pildora btn-borrar-medida',
        title: 'Eliminar registro',
        on: {
          click: async (e) => {
            e.stopPropagation();
            const conf = await confirmar(`¿Eliminar la medición del ${fechaBonita(m.fecha)}?`);
            if (conf) {
              await borrar('medidas', m.id);
              aviso('Medición eliminada', 'info');
              await cargarDatos();
              renderizarPantalla();
            }
          }
        }
      }, icono('borrar', 18))
    );

    filas.push(item);
  }

  cont.replaceChildren(...filas);
}

/**
 * Diálogo modal para ingresar una nueva medición corporal completa.
 * Captura y almacena los valores de los inputs en variables de estado reactivas
 * ANTES de que se cierre el diálogo.
 */
async function abrirModalNuevaMedida() {
  const hoy = hoyISO();
  const estatura = numValido(perfilUsuario?.estaturaCm) || 175;

  const valores = {
    fecha: hoy,
    peso: '',
    cintura: '',
    cuello: '',
    pecho: '',
    brazo: '',
    hombros: '',
    cadera: ''
  };

  const lblPreview = h('div', {
    id: 'm-grasa-preview',
    style: 'font-size:13px;color:#17171A;background:#C8F03C;padding:8px 14px;border-radius:999px;margin-top:4px;font-weight:600;'
  }, 'Ingresa cintura y cuello para calcular % grasa en vivo.');

  function recalcularPreview() {
    const c = parseFloat(valores.cintura);
    const q = parseFloat(valores.cuello);
    if (!isNaN(c) && !isNaN(q) && c > q && estatura) {
      const pct = grasaNavy(c, q, estatura);
      if (pct !== null) {
        lblPreview.textContent = `Grasa estimada (Marina): ${pct}% (±3%)`;
      }
    }
  }

  const inFecha = h('input', {
    id: 'm-fecha',
    type: 'date',
    value: hoy,
    style: 'border-radius:999px;padding:10px 14px;',
    on: {
      input: (e) => { valores.fecha = e.target.value; },
      change: (e) => { valores.fecha = e.target.value; }
    }
  });

  const inPeso = h('input', {
    id: 'm-peso',
    type: 'number',
    step: '0.1',
    placeholder: '75.0',
    style: 'border-radius:999px;padding:10px 14px;',
    on: { input: (e) => { valores.peso = e.target.value; } }
  });

  const inCintura = h('input', {
    id: 'm-cintura',
    type: 'number',
    step: '0.5',
    placeholder: '82.0',
    style: 'border-radius:999px;padding:10px 14px;',
    on: {
      input: (e) => {
        valores.cintura = e.target.value;
        recalcularPreview();
      }
    }
  });

  const inCuello = h('input', {
    id: 'm-cuello',
    type: 'number',
    step: '0.5',
    placeholder: '38.0',
    style: 'border-radius:999px;padding:10px 14px;',
    on: {
      input: (e) => {
        valores.cuello = e.target.value;
        recalcularPreview();
      }
    }
  });

  const inPecho = h('input', {
    id: 'm-pecho',
    type: 'number',
    step: '0.5',
    placeholder: '100.0',
    style: 'border-radius:999px;padding:10px 14px;',
    on: { input: (e) => { valores.pecho = e.target.value; } }
  });

  const inBrazo = h('input', {
    id: 'm-brazo',
    type: 'number',
    step: '0.5',
    placeholder: '35.0',
    style: 'border-radius:999px;padding:10px 14px;',
    on: { input: (e) => { valores.brazo = e.target.value; } }
  });

  const inHombros = h('input', {
    id: 'm-hombros',
    type: 'number',
    step: '0.5',
    placeholder: '115.0',
    style: 'border-radius:999px;padding:10px 14px;',
    on: { input: (e) => { valores.hombros = e.target.value; } }
  });

  const inCadera = h('input', {
    id: 'm-cadera',
    type: 'number',
    step: '0.5',
    placeholder: '98.0',
    style: 'border-radius:999px;padding:10px 14px;',
    on: { input: (e) => { valores.cadera = e.target.value; } }
  });

  const cuerpoModal = h('div', { class: 'col', style: 'gap:10px;' },
    h('div', { class: 'campo' },
      h('label', { style: 'font-size:13px;font-weight:600;' }, 'Fecha:'),
      inFecha
    ),
    h('div', { class: 'grid2', style: 'gap:8px;' },
      h('div', { class: 'campo' },
        h('label', { style: 'font-size:13px;font-weight:600;' }, 'Peso ayunas (kg):'),
        inPeso
      ),
      h('div', { class: 'campo' },
        h('label', { style: 'font-size:13px;font-weight:600;' }, 'Cintura (ombligo, cm):'),
        inCintura
      ),
      h('div', { class: 'campo' },
        h('label', { style: 'font-size:13px;font-weight:600;' }, 'Cuello (cm):'),
        inCuello
      ),
      h('div', { class: 'campo' },
        h('label', { style: 'font-size:13px;font-weight:600;' }, 'Pecho (cm):'),
        inPecho
      ),
      h('div', { class: 'campo' },
        h('label', { style: 'font-size:13px;font-weight:600;' }, 'Brazo relajado (cm):'),
        inBrazo
      ),
      h('div', { class: 'campo' },
        h('label', { style: 'font-size:13px;font-weight:600;' }, 'Hombros (cm):'),
        inHombros
      ),
      h('div', { class: 'campo' },
        h('label', { style: 'font-size:13px;font-weight:600;' }, 'Cadera (glúteos, cm):'),
        inCadera
      )
    ),
    lblPreview
  );

  const res = await dialogo({
    titulo: 'Registrar nuevas medidas',
    cuerpo: cuerpoModal,
    botones: [
      { texto: 'Guardar medida', valor: 'guardar', tipo: 'primario' },
      { texto: 'Cancelar', valor: 'cancelar' }
    ]
  });

  if (res === 'guardar') {
    const fecha = valores.fecha || inFecha.value || hoy;
    const peso = parseFloat(valores.peso || inPeso.value);
    const cintura = parseFloat(valores.cintura || inCintura.value);
    const cuello = parseFloat(valores.cuello || inCuello.value);
    const pecho = parseFloat(valores.pecho || inPecho.value);
    const brazo = parseFloat(valores.brazo || inBrazo.value);
    const hombros = parseFloat(valores.hombros || inHombros.value);
    const cadera = parseFloat(valores.cadera || inCadera.value);

    let gNavy = null;
    if (!isNaN(cintura) && !isNaN(cuello) && cintura > cuello && estatura) {
      gNavy = grasaNavy(cintura, cuello, estatura);
    }

    const nuevaMedida = {
      id: nuevoId(),
      fecha,
      peso: isNaN(peso) ? null : peso,
      cintura: isNaN(cintura) ? null : cintura,
      cuello: isNaN(cuello) ? null : cuello,
      pecho: isNaN(pecho) ? null : pecho,
      brazo: isNaN(brazo) ? null : brazo,
      hombros: isNaN(hombros) ? null : hombros,
      cadera: isNaN(cadera) ? null : cadera,
      grasaNavy: gNavy,
      origen: 'manual'
    };

    await guardar('medidas', nuevaMedida);
    aviso('Medidas guardadas con éxito', 'ok');
    await cargarDatos();
    renderizarPantalla();
  }
}

/**
 * Diálogo modal para subir una foto manualmente (frente, lado, espalda).
 * Captura el archivo en evento change antes del cierre del modal.
 */
async function abrirModalSubirFoto() {
  const hoy = hoyISO();
  let archivoFoto = null;
  let fechaFoto = hoy;
  let vistaFoto = 'frente';

  const inFecha = h('input', {
    id: 'f-fecha',
    type: 'date',
    value: hoy,
    style: 'border-radius:999px;padding:10px 14px;',
    on: {
      input: (e) => { fechaFoto = e.target.value; },
      change: (e) => { fechaFoto = e.target.value; }
    }
  });

  const inVista = h('select', {
    id: 'f-vista',
    style: 'width:100%;padding:10px 14px;border-radius:999px;background:var(--superficie2);color:var(--texto);border:none;',
    on: {
      change: (e) => { vistaFoto = e.target.value; }
    }
  },
    h('option', { value: 'frente' }, 'Frente'),
    h('option', { value: 'lado' }, 'Lado (perfil)'),
    h('option', { value: 'espalda' }, 'Espalda')
  );

  const inArchivo = h('input', {
    id: 'f-archivo',
    type: 'file',
    accept: 'image/*',
    style: 'padding:8px;',
    on: {
      change: (e) => {
        archivoFoto = e.target.files?.[0] || null;
      }
    }
  });

  const cuerpoModal = h('div', { class: 'col', style: 'gap:12px;' },
    h('div', { class: 'campo' },
      h('label', { style: 'font-size:13px;font-weight:600;' }, 'Fecha de la foto:'),
      inFecha
    ),
    h('div', { class: 'campo' },
      h('label', { style: 'font-size:13px;font-weight:600;' }, 'Vista del cuerpo:'),
      inVista
    ),
    h('div', { class: 'campo' },
      h('label', { style: 'font-size:13px;font-weight:600;' }, 'Seleccionar imagen:'),
      inArchivo
    )
  );

  const res = await dialogo({
    titulo: 'Añadir foto de progreso',
    cuerpo: cuerpoModal,
    botones: [
      { texto: 'Guardar foto', valor: 'guardar', tipo: 'primario' },
      { texto: 'Cancelar', valor: 'cancelar' }
    ]
  });

  if (res === 'guardar') {
    const archivo = archivoFoto || inArchivo.files?.[0];

    if (!archivo) {
      aviso('Debes seleccionar un archivo de imagen', 'error');
      return;
    }

    const fecha = fechaFoto || inFecha.value || hoy;
    const vista = vistaFoto || inVista.value || 'frente';

    const nuevaFoto = {
      id: nuevoId(),
      fecha,
      vista,
      blob: archivo,
      puntos: null,
      altoPx: null
    };

    await guardar('fotos', nuevaFoto);
    aviso('Foto de progreso almacenada en tu dispositivo', 'ok');
    await cargarDatos();
    renderizarPantalla();
  }
}

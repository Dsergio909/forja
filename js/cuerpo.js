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
let perfilUsuario = null;
let datosMedidas = [];
let datosFotos = [];
let datosCamara = [];
let vistaFotoFiltro = 'todas'; // 'todas' | 'frente' | 'lado' | 'espalda'
let fotoIdAntes = null;
let fotoIdDespues = null;

/**
 * Función auxiliar para renderizar de manera segura un icono SVG proveniente de ./iconos.js.
 * Admite retornos en forma de string SVG o de nodo DOM (Node).
 *
 * @param {string} nombre - Nombre del icono ('camara', 'mas', 'alerta', etc.)
 * @param {string} [clase=''] - Clases CSS adicionales
 * @returns {string} Código HTML del icono SVG
 */
function renderIcono(nombre, clase = '') {
  try {
    const res = icono(nombre, { class: clase });
    if (typeof res === 'string') return res;
    if (res instanceof Node) return res.outerHTML || '';
    return String(res || '');
  } catch (e) {
    return '';
  }
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
 * Desmonta la pantalla y libera recursos en memoria.
 */
export function desmontar() {
  limpiarUrlsFotos();
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
      // Priorizar registro manual sobre registro automático de cámara en la misma fecha
      if (a.origen === 'manual' && b.origen !== 'manual') return -1;
      if (b.origen === 'manual' && a.origen !== 'manual') return 1;
      return 0;
    });
  } catch (e) {
    datosMedidas = [];
  }

  try {
    datosFotos = await todos('fotos');
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
    fotoIdDespues = datosFotos[0].id;
    fotoIdAntes = datosFotos[datosFotos.length - 1].id;
  } else if (datosFotos.length === 1) {
    fotoIdDespues = datosFotos[0].id;
    fotoIdAntes = null;
  }
}

/**
 * Renderiza la interfaz de usuario completa de Cuerpo aplicando la dirección Forja v2:
 * tipografías Instrument Serif y Bricolage Grotesque, paleta papel2 (#E9E4D8) sin bordes,
 * números héroe enormes y botones píldora.
 */
function renderizarPantalla() {
  if (!contenedorRaiz) return;
  limpiarUrlsFotos();

  const ultimaMedida = datosMedidas[0] || null;
  const medidaAnterior = datosMedidas[1] || null;

  // Búsqueda de mediciones con peso en ayunas válido
  const ultimaConPeso = datosMedidas.find((m) => m.peso !== null && m.peso !== undefined && !isNaN(m.peso)) || null;
  const medidasConPeso = datosMedidas.filter((m) => m.peso !== null && m.peso !== undefined && !isNaN(m.peso));
  const anteriorConPeso = medidasConPeso[1] || null;

  // 1. Cálculos de peso, promedio móvil y tendencia semanal (regresión lineal)
  const pesosHistorial = datosMedidas
    .filter((m) => m.peso !== null && m.peso !== undefined && !isNaN(m.peso))
    .map((m) => ({ fecha: m.fecha, valor: Number(m.peso) }))
    .sort((a, b) => (a.fecha > b.fecha ? 1 : -1));

  const ultimos7 = pesosHistorial.slice(-7);
  const promedio7dias = ultimos7.length > 0
    ? (ultimos7.reduce((acc, v) => acc + v.valor, 0) / ultimos7.length).toFixed(1)
    : null;

  const tendencia = tendenciaSemanal(pesosHistorial);
  const textoTendencia = tendencia !== null
    ? `${tendencia > 0 ? '+' : ''}${tendencia.toFixed(2)} kg/sem`
    : 'Datos insuficientes';

  // 2. Cálculo de % Grasa Fórmula Marina EE. UU.
  let grasaEstimada = null;
  const estatura = perfilUsuario?.estaturaCm;
  const medidaConGrasa = datosMedidas.find((m) => (m.cintura && m.cuello) || m.grasaNavy) || ultimaMedida;

  if (medidaConGrasa?.cintura && medidaConGrasa?.cuello && estatura) {
    grasaEstimada = grasaNavy(medidaConGrasa.cintura, medidaConGrasa.cuello, estatura);
  } else if (medidaConGrasa?.grasaNavy) {
    grasaEstimada = medidaConGrasa.grasaNavy;
  }

  // 3. Mediciones de cámara (Ratio V)
  const ultimaCamara = datosCamara[0] || null;

  // Valores de circunferencia corporal
  const valCintura = ultimaMedida?.cintura ?? datosMedidas.find((m) => m.cintura != null)?.cintura ?? null;
  const valCuello = ultimaMedida?.cuello ?? datosMedidas.find((m) => m.cuello != null)?.cuello ?? null;
  const valPecho = ultimaMedida?.pecho ?? datosMedidas.find((m) => m.pecho != null)?.pecho ?? null;
  const valBrazo = ultimaMedida?.brazo ?? datosMedidas.find((m) => m.brazo != null)?.brazo ?? null;
  const valHombros = ultimaMedida?.hombros ?? datosMedidas.find((m) => m.hombros != null)?.hombros ?? null;
  const valCadera = ultimaMedida?.cadera ?? datosMedidas.find((m) => m.cadera != null)?.cadera ?? null;

  contenedorRaiz.innerHTML = `
    <style>
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
        color: #6B675F;
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
        height: 46px;
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
      .cuerpo-micro-label {
        font-size: 10px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        font-weight: 700;
        color: #6B675F;
        line-height: 1;
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
        color: #6B675F;
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
        background-color: #E2553A;
        color: #F3F0E8;
      }
      .cuerpo-fila-resumen {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background-color: #F3F0E8;
        border-radius: 999px;
        padding: 12px 20px;
        font-size: 13px;
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
        background-color: rgba(23, 23, 26, 0.75);
        backdrop-filter: blur(8px);
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
        padding: 12px 18px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      .cuerpo-btn-eliminar-pildora {
        width: 34px;
        height: 34px;
        border-radius: 999px;
        border: none;
        background-color: transparent;
        color: #E2553A;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background-color 140ms ease;
      }
      .cuerpo-btn-eliminar-pildora:active {
        background-color: rgba(226, 85, 58, 0.12);
      }
    </style>

    <div class="cuerpo-v2-contenedor">
      <!-- Encabezado editorial con Instrument Serif -->
      <div class="cuerpo-header">
        <div>
          <h2 class="cuerpo-header-titular">Mi <em>cuerpo</em></h2>
          <div class="cuerpo-header-sub">Seguimiento físico y composición</div>
        </div>
        <div class="cuerpo-acciones-top">
          <button id="btn-abrir-camara" class="cuerpo-btn-pildora cuerpo-btn-papel" title="Abrir cámara y visión artificial">
            ${renderIcono('camara')}
            <span>Cámara</span>
          </button>
          <button id="btn-nueva-medida" class="cuerpo-btn-pildora cuerpo-btn-lima" title="Registrar nuevas medidas">
            ${renderIcono('mas')}
            <span>Medida</span>
          </button>
        </div>
      </div>

      <!-- Tarjeta 1: Peso en ayunas (Número héroe gigante en Bricolage Grotesque) -->
      <div class="cuerpo-tarjeta-v2">
        <div style="display:flex;justify-content:space-between;align-items:baseline;">
          <span class="cuerpo-micro-label">PESO EN AYUNAS</span>
          <span style="font-size:13px;color:#6B675F;font-weight:500;">
            ${ultimaConPeso ? fechaBonita(ultimaConPeso.fecha) : 'Sin registros'}
          </span>
        </div>

        <div style="display:flex;align-items:baseline;gap:12px;margin:2px 0;">
          <div class="cuerpo-numero-heroe">
            ${ultimaConPeso && ultimaConPeso.peso ? ultimaConPeso.peso : '--'}
            <span class="cuerpo-numero-unidad">kg</span>
          </div>

          ${anteriorConPeso && ultimaConPeso?.peso && anteriorConPeso.peso
            ? `<div class="cuerpo-chip-diferencia ${ultimaConPeso.peso - anteriorConPeso.peso <= 0 ? 'cuerpo-chip-ok' : 'cuerpo-chip-alerta'}">
                ${ultimaConPeso.peso - anteriorConPeso.peso > 0 ? '+' : ''}${(ultimaConPeso.peso - anteriorConPeso.peso).toFixed(1)} kg
              </div>`
            : ''
          }
        </div>

        <div class="cuerpo-fila-resumen">
          <div>
            <span style="color:#6B675F;">Promedio 7 días:</span>
            <strong style="color:#17171A;margin-left:4px;">${promedio7dias ? `${promedio7dias} kg` : 'Calculando...'}</strong>
          </div>
          <div>
            <span style="color:#6B675F;">Tendencia:</span>
            <strong style="color:#17171A;margin-left:4px;">${textoTendencia}</strong>
          </div>
        </div>
      </div>

      <!-- Tarjeta 2: % Grasa Fórmula Marina EE. UU. -->
      <div class="cuerpo-tarjeta-v2">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span class="cuerpo-micro-label">FÓRMULA MARINA EE. UU.</span>
          <span class="cuerpo-chip-diferencia cuerpo-chip-ok" style="font-size:11px;padding:4px 10px;">
            Margen ±3-4%
          </span>
        </div>

        <div style="display:flex;align-items:baseline;gap:12px;">
          <div class="cuerpo-numero-heroe" style="font-size:clamp(52px, 13vw, 68px);">
            ${grasaEstimada !== null ? `${grasaEstimada}%` : '--'}
          </div>
          <span style="font-size:14px;color:#6B675F;font-weight:500;">
            ${grasaEstimada !== null ? 'grasa corporal estimada' : 'Registra cintura, cuello y estatura'}
          </span>
        </div>

        <p style="font-size:13px;color:#6B675F;line-height:1.45;margin:0;">
          ${!estatura
            ? `<span style="display:inline-flex;align-items:center;gap:6px;">${renderIcono('alerta')}</span> No has configurado tu estatura en Ajustes. <a href="#ajustes" style="color:#17171A;font-weight:600;text-decoration:underline;">Ir a Ajustes</a>`
            : (!medidaConGrasa?.cintura || !medidaConGrasa?.cuello)
            ? `Requiere cintura (${medidaConGrasa?.cintura || '?'} cm) y cuello (${medidaConGrasa?.cuello || '?'} cm) con estatura (${estatura} cm).`
            : `Estimado a partir de cintura (${medidaConGrasa.cintura} cm), cuello (${medidaConGrasa.cuello} cm) y estatura (${estatura} cm).`
          }
        </p>
      </div>

      <!-- Tarjeta 3: Medidas Corporales Actuales y Ratio V -->
      <div class="cuerpo-tarjeta-v2">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span class="cuerpo-micro-label">MEDIDAS CORPORALES (CM)</span>
          ${ultimaCamara ? `<span class="cuerpo-chip-diferencia cuerpo-chip-ok" style="font-size:12px;">Ratio V: ${ultimaCamara.ratioV}</span>` : ''}
        </div>

        <div class="cuerpo-grid-medidas">
          ${renderItemMedida('Cintura', valCintura, medidaAnterior?.cintura)}
          ${renderItemMedida('Cuello', valCuello, medidaAnterior?.cuello)}
          ${renderItemMedida('Pecho', valPecho, medidaAnterior?.pecho)}
          ${renderItemMedida('Brazo', valBrazo, medidaAnterior?.brazo)}
          ${renderItemMedida('Hombros', valHombros, medidaAnterior?.hombros)}
          ${renderItemMedida('Cadera', valCadera, medidaAnterior?.cadera)}
        </div>
      </div>

      <!-- Sección: Fotos de Progreso y Comparador con deslizador elegante -->
      <div class="cuerpo-tarjeta-v2">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <h3 style="font-family:'Instrument Serif',Georgia,serif;font-size:26px;font-weight:400;margin:0;line-height:1.1;">
              Fotos de <em>progreso</em>
            </h3>
            <span style="font-size:12px;color:#6B675F;">Privadas y seguras en tu teléfono</span>
          </div>
          <button id="btn-subir-foto" class="cuerpo-btn-pildora" style="background-color:#F3F0E8;color:#17171A;height:40px;padding:0 14px;">
            ${renderIcono('subir')}
            <span>Subir foto</span>
          </button>
        </div>

        <!-- Filtros de vista píldora -->
        <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;">
          <button class="cuerpo-btn-pildora btn-filtro-foto" data-vista="todas" style="height:36px;padding:0 14px;background-color:${vistaFotoFiltro === 'todas' ? '#17171A' : '#F3F0E8'};color:${vistaFotoFiltro === 'todas' ? '#F3F0E8' : '#17171A'};">Todas</button>
          <button class="cuerpo-btn-pildora btn-filtro-foto" data-vista="frente" style="height:36px;padding:0 14px;background-color:${vistaFotoFiltro === 'frente' ? '#17171A' : '#F3F0E8'};color:${vistaFotoFiltro === 'frente' ? '#F3F0E8' : '#17171A'};">Frente</button>
          <button class="cuerpo-btn-pildora btn-filtro-foto" data-vista="lado" style="height:36px;padding:0 14px;background-color:${vistaFotoFiltro === 'lado' ? '#17171A' : '#F3F0E8'};color:${vistaFotoFiltro === 'lado' ? '#F3F0E8' : '#17171A'};">Lado</button>
          <button class="cuerpo-btn-pildora btn-filtro-foto" data-vista="espalda" style="height:36px;padding:0 14px;background-color:${vistaFotoFiltro === 'espalda' ? '#17171A' : '#F3F0E8'};color:${vistaFotoFiltro === 'espalda' ? '#F3F0E8' : '#17171A'};">Espalda</button>
        </div>

        <!-- Visor Comparador con Deslizador -->
        <div id="contenedor-comparador-fotos"></div>

        <!-- Cuadrícula de fotos guardadas -->
        <div id="galeria-fotos-progreso" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px;"></div>
      </div>

      <!-- Sección: Historial de registros anteriores -->
      <div class="cuerpo-tarjeta-v2">
        <span class="cuerpo-micro-label">HISTORIAL DE MEDICIONES</span>
        <div id="lista-historial-medidas" style="display:flex;flex-direction:column;gap:6px;"></div>
      </div>
    </div>
  `;

  // Enganchar listeners de eventos principales
  document.getElementById('btn-abrir-camara')?.addEventListener('click', () => ir('#camara'));
  document.getElementById('btn-nueva-medida')?.addEventListener('click', abrirModalNuevaMedida);
  document.getElementById('btn-subir-foto')?.addEventListener('click', abrirModalSubirFoto);

  // Filtros de vista de fotos
  contenedorRaiz.querySelectorAll('.btn-filtro-foto').forEach((btn) => {
    btn.addEventListener('click', () => {
      vistaFotoFiltro = btn.getAttribute('data-vista');
      renderizarPantalla();
    });
  });

  renderizarComparador();
  renderizarGaleriaFotos();
  renderizarHistorialMedidas();
}

/**
 * Renderiza una celda de medida individual con su comparación con la previa.
 */
function renderItemMedida(nombre, valorActual, valorAnterior) {
  let diff = null;
  if (valorActual && valorAnterior) {
    const d = valorActual - valorAnterior;
    diff = d !== 0 ? `${d > 0 ? '+' : ''}${d.toFixed(1)}` : '=';
  }

  return `
    <div class="cuerpo-celda-medida">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:13px;color:#6B675F;font-weight:500;">${nombre}</span>
        ${diff ? `<span style="font-size:12px;font-weight:600;color:${diff.startsWith('+') ? '#C8F03C' : '#17171A'};background:#E9E4D8;padding:2px 8px;border-radius:999px;">${diff} cm</span>` : ''}
      </div>
      <div class="cuerpo-celda-valor">
        ${valorActual ? `${valorActual} <span style="font-size:15px;font-weight:500;color:#6B675F;">cm</span>` : '--'}
      </div>
    </div>
  `;
}

/**
 * Renderiza el comparador interactivo de dos fotos superpuestas con un deslizador elegante Forja v2.
 */
function renderizarComparador() {
  const cont = document.getElementById('contenedor-comparador-fotos');
  if (!cont) return;

  if (datosFotos.length < 2) {
    cont.innerHTML = `
      <div style="padding:24px 16px;text-align:center;background:#F3F0E8;border-radius:28px;">
        <span style="font-size:14px;color:#6B675F;">
          Guarda al menos 2 fotos de progreso para compararlas lado a lado con el deslizador elegante.
        </span>
      </div>
    `;
    return;
  }

  const fotoAntes = datosFotos.find((f) => f.id === fotoIdAntes) || datosFotos[datosFotos.length - 1];
  const fotoDespues = datosFotos.find((f) => f.id === fotoIdDespues) || datosFotos[0];

  const urlAntes = URL.createObjectURL(fotoAntes.blob);
  const urlDespues = URL.createObjectURL(fotoDespues.blob);
  urlsFotosCreadas.push(urlAntes, urlDespues);

  cont.innerHTML = `
    <div style="background-color:#F3F0E8;border-radius:28px;padding:16px;display:flex;flex-direction:column;gap:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;">
        <div>
          <span style="color:#6B675F;">Antes:</span>
          <strong style="color:#17171A;margin-left:3px;">${fechaBonita(fotoAntes.fecha)}</strong> (${fotoAntes.vista})
        </div>
        <div>
          <span style="color:#6B675F;">Después:</span>
          <strong style="color:#17171A;margin-left:3px;">${fechaBonita(fotoDespues.fecha)}</strong> (${fotoDespues.vista})
        </div>
      </div>

      <!-- Contenedor del Split Slider con fotos tratadas -->
      <div id="cuerpo-slider-box" class="cuerpo-comparador-marco">
        <img src="${urlAntes}" alt="Foto antes" class="cuerpo-comparador-img" />
        <div id="capa-despues-split" class="cuerpo-comparador-capa-split">
          <img src="${urlDespues}" alt="Foto después" class="cuerpo-comparador-img" />
          <div class="cuerpo-comparador-manija">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="8 7 3 12 8 17"></polyline>
              <polyline points="16 7 21 12 16 17"></polyline>
            </svg>
          </div>
        </div>
        <span class="cuerpo-comparador-badge" style="left:12px;">Después</span>
        <span class="cuerpo-comparador-badge" style="right:12px;">Antes</span>
      </div>

      <!-- Control de rango deslizante minimalista -->
      <div>
        <input id="input-slider-comparar" class="cuerpo-slider-rango" type="range" min="0" max="100" value="50" aria-label="Deslizar para comparar antes y después" />
        <div style="display:flex;justify-content:space-between;font-size:12px;color:#6B675F;font-weight:500;">
          <span style="display:inline-flex;align-items:center;gap:4px;">${renderIcono('flecha-izq')} Revelar después</span>
          <span>Desliza para comparar</span>
          <span style="display:inline-flex;align-items:center;gap:4px;">Revelar antes ${renderIcono('flecha-der')}</span>
        </div>
      </div>
    </div>
  `;

  // Sincronizar el ancho del split view con el input range
  const slider = document.getElementById('input-slider-comparar');
  const capaSplit = document.getElementById('capa-despues-split');
  const marcoBox = document.getElementById('cuerpo-slider-box');

  if (slider && capaSplit && marcoBox) {
    const ajustarAnchoImagen = () => {
      const boxWidth = marcoBox.offsetWidth || 340;
      const imgDespues = capaSplit.querySelector('img');
      if (imgDespues) {
        imgDespues.style.width = `${boxWidth}px`;
        imgDespues.style.maxWidth = 'none';
      }
    };

    ajustarAnchoImagen();
    window.addEventListener('resize', ajustarAnchoImagen, { once: true });

    slider.addEventListener('input', (e) => {
      const val = e.target.value;
      capaSplit.style.width = `${val}%`;
    });
  }
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
    galeria.innerHTML = `
      <div style="grid-column:span 2;padding:24px 16px;text-align:center;background:#F3F0E8;border-radius:28px;">
        <span style="font-size:14px;color:#6B675F;">No hay fotos registradas para esta vista.</span>
      </div>
    `;
    return;
  }

  galeria.innerHTML = '';

  for (const foto of fotosFiltradas) {
    const url = URL.createObjectURL(foto.blob);
    urlsFotosCreadas.push(url);

    const tarjetaFoto = document.createElement('div');
    tarjetaFoto.className = 'cuerpo-foto-card';
    tarjetaFoto.innerHTML = `
      <img src="${url}" alt="Foto de ${foto.vista}" />
      <div style="padding:8px 12px;font-size:12px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-weight:600;color:#17171A;">${fechaBonita(foto.fecha)}</span>
        <span style="background:#17171A;color:#F3F0E8;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:600;">
          ${foto.vista}
        </span>
      </div>
    `;

    tarjetaFoto.addEventListener('click', () => {
      abrirDetalleFoto(foto, url);
    });

    galeria.appendChild(tarjetaFoto);
  }
}

/**
 * Diálogo modal para ver, comparar o eliminar una foto de progreso.
 */
async function abrirDetalleFoto(foto, url) {
  await dialogo({
    titulo: `Foto de ${foto.vista} (${fechaBonita(foto.fecha)})`,
    cuerpo: h('div', { class: 'col', style: 'gap:12px;' },
      h('img', {
        src: url,
        style: 'width:100%;max-height:360px;object-fit:cover;border-radius:28px;filter:contrast(1.05) saturate(0.9);'
      }),
      h('div', { style: 'font-size:13px;color:#6B675F;' },
        `Vista: ${foto.vista} · Altura registrada: ${foto.altoPx ? `${foto.altoPx} px` : 'Manual'}`
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
 * Renderiza el listado histórico de mediciones corporales.
 */
function renderizarHistorialMedidas() {
  const cont = document.getElementById('lista-historial-medidas');
  if (!cont) return;

  if (datosMedidas.length === 0) {
    cont.innerHTML = `
      <div style="padding:20px;text-align:center;background:#F3F0E8;border-radius:28px;">
        <span style="font-size:14px;color:#6B675F;">No hay medidas registradas aún. Toca «+ Medida» para iniciar.</span>
      </div>
    `;
    return;
  }

  cont.innerHTML = '';

  for (const m of datosMedidas) {
    const item = document.createElement('div');
    item.className = 'cuerpo-item-historial';

    const detalles = [];
    if (m.cintura) detalles.push(`Cintura: ${m.cintura} cm`);
    if (m.pecho) detalles.push(`Pecho: ${m.pecho} cm`);
    if (m.brazo) detalles.push(`Brazo: ${m.brazo} cm`);

    item.innerHTML = `
      <div>
        <div style="display:flex;align-items:center;gap:8px;">
          <strong style="color:#17171A;font-size:14px;">${fechaBonita(m.fecha)}</strong>
          ${m.peso ? `<span style="background:#C8F03C;color:#17171A;border-radius:999px;padding:2px 8px;font-size:12px;font-weight:600;">${m.peso} kg</span>` : ''}
          ${m.origen === 'camara' ? `<span style="background:#E9E4D8;color:#17171A;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:600;">Cámara</span>` : ''}
        </div>
        <div style="font-size:12px;color:#6B675F;margin-top:2px;">
          ${detalles.length > 0 ? detalles.join(' · ') : 'Solo peso registrado'}
        </div>
      </div>
      <button class="cuerpo-btn-eliminar-pildora btn-borrar-medida" title="Eliminar registro">
        ${renderIcono('borrar')}
      </button>
    `;

    item.querySelector('.btn-borrar-medida')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const conf = await confirmar(`¿Eliminar la medición del ${fechaBonita(m.fecha)}?`);
      if (conf) {
        await borrar('medidas', m.id);
        aviso('Medición eliminada', 'info');
        await cargarDatos();
        renderizarPantalla();
      }
    });

    cont.appendChild(item);
  }
}

/**
 * Diálogo modal para ingresar una nueva medición corporal completa.
 * Captura y almacena los valores de los inputs en variables de estado reactivas
 * ANTES de que se cierre el diálogo (Corrección 1.1).
 */
async function abrirModalNuevaMedida() {
  const hoy = hoyISO();
  const estatura = perfilUsuario?.estaturaCm || 175;

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
      lblPreview.textContent = `Grasa estimada (Marina): ${pct}% (±3%)`;
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
 * Captura el archivo en evento change antes del cierre del modal (Corrección 1.1).
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

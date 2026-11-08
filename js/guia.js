/**
 * js/guia.js
 * Pantalla Guía de ejercicios y sección Aprender.
 * Dirección de arte Forja v2 («Revista de sala»):
 * - Cuadrícula de fotos/videos con radio 28 y nombre debajo.
 * - Ficha con video grande arriba (o animación de 2 fotos), titular en Instrument Serif,
 *   pasos numerados con números grandes en lima, chips de músculos en papel2.
 * - Metadatos adaptables a 360 px sin deformación elíptica (radio 28 en textos largos a ancho completo,
 *   radio 999 en píldoras cortas de una línea).
 * - Botón a YouTube para ver técnica.
 * - Sección Aprender estilo revista con titulares serif y tipografía editorial.
 * - Cero emojis: íconos SVG vectoriales vía icono() de ./iconos.js.
 * - Mitigación completa de XSS reflejado y almacenado escapando HTML en parámetros y datos.
 */

import { h, aviso } from './ui.js';
import { ir } from './app.js';
import { ejercicios, ejercicio } from './datos.js';
import { mapaSVG, normalizarMusculo, MUSCULOS_CANONICOS } from './mapa_musculos.js';
import { mdAHtml } from './markdown.js';
import { icono } from './iconos.js';

// Estado local de la pantalla
let estado = {
  listaCompleta: [],
  filtroTexto: '',
  filtroMusculo: '',
  filtroEquipo: '',
  mapaColapsado: true, // Colapsado por defecto para dar protagonismo a la cuadrícula editorial
};

let contenedorRaiz = null;

/**
 * Escapa caracteres especiales de HTML para prevenir XSS reflejado o basado en DOM.
 * @param {string} str
 * @returns {string}
 */
function escaparHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Renderiza un ícono SVG invocando icono() de ./iconos.js.
 * Si el módulo de íconos aún no implementa un ícono o no está disponible,
 * provee un SVG vectorial minimalista de trazo 1.75px según DIRECCION_FORJA_v2.md.
 * 
 * @param {string} nombre - Nombre del ícono
 * @param {object} [opciones={}]
 * @returns {string} Cadena SVG lista para HTML
 */
function renderIcono(nombre, { tam = 20, clase = '', color = 'currentColor', trazo = 1.75 } = {}) {
  try {
    if (typeof icono === 'function') {
      const res = icono(nombre, { tam, clase, color, trazo });
      if (typeof res === 'string' && res.trim().startsWith('<svg')) return res;
      if (res && res.outerHTML) return res.outerHTML;
    }
  } catch (_) {}

  // Fallbacks nativos SVG trazo 1.75 px redondeados (cero emojis)
  const svgs = {
    'buscar': `<svg width="${tam}" height="${tam}" class="${clase}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${trazo}" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
    'play': `<svg width="${tam}" height="${tam}" class="${clase}" viewBox="0 0 24 24" fill="${color}" stroke="${color}" stroke-width="${trazo}" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>`,
    'pausa': `<svg width="${tam}" height="${tam}" class="${clase}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${trazo}" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>`,
    'mancuerna': `<svg width="${tam}" height="${tam}" class="${clase}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${trazo}" stroke-linecap="round" stroke-linejoin="round"><path d="M6 5v14M18 5v14M2 12h20M6 12a3 3 0 0 0-3-3M6 12a3 3 0 0 1-3 3M18 12a3 3 0 0 0 3-3M18 12a3 3 0 0 1 3 3"></path></svg>`,
    'libro': `<svg width="${tam}" height="${tam}" class="${clase}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${trazo}" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`,
    'flecha-izquierda': `<svg width="${tam}" height="${tam}" class="${clase}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${trazo}" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"></path></svg>`,
    'flecha-derecha': `<svg width="${tam}" height="${tam}" class="${clase}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${trazo}" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"></path></svg>`,
    'cerrar': `<svg width="${tam}" height="${tam}" class="${clase}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${trazo}" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    'lista': `<svg width="${tam}" height="${tam}" class="${clase}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${trazo}" stroke-linecap="round" stroke-linejoin="round"><line x1="9" y1="6" x2="20" y2="6"></line><line x1="9" y1="12" x2="20" y2="12"></line><line x1="9" y1="18" x2="20" y2="18"></line><circle cx="4" cy="6" r="1.5" fill="${color}"></circle><circle cx="4" cy="12" r="1.5" fill="${color}"></circle><circle cx="4" cy="18" r="1.5" fill="${color}"></circle></svg>`,
    'foco': `<svg width="${tam}" height="${tam}" class="${clase}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${trazo}" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-7 7c0 2.5 1.3 4.5 3 5.5v1.5h8V14.5c1.7-1 3-3 3-5.5a7 7 0 0 0-7-7z"></path></svg>`,
    'alerta': `<svg width="${tam}" height="${tam}" class="${clase}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${trazo}" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    'tendencia': `<svg width="${tam}" height="${tam}" class="${clase}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${trazo}" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`,
    'cambiar': `<svg width="${tam}" height="${tam}" class="${clase}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${trazo}" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><polyline points="23 20 23 14 17 14"></polyline><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path></svg>`,
    'escudo': `<svg width="${tam}" height="${tam}" class="${clase}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${trazo}" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
    'youtube': `<svg width="${tam}" height="${tam}" class="${clase}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${trazo}" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="5"></rect><polygon points="10 8 16 12 10 16 10 8" fill="${color}"></polygon></svg>`,
    'chevron-abajo': `<svg width="${tam}" height="${tam}" class="${clase}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${trazo}" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
    'chevron-arriba': `<svg width="${tam}" height="${tam}" class="${clase}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${trazo}" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>`
  };

  return svgs[nombre] || `<span style="display:inline-block; width:${tam}px; height:${tam}px;"></span>`;
}

/**
 * Inyecta los estilos específicos para la pantalla Guía según Forja v2 («Revista de sala»).
 * Radios estrictos: SOLO 28px y 999px. Cero backdrop-filter. Touch targets >= 48px.
 */
function asegurarEstilos() {
  if (document.getElementById('estilos-guia-v2')) return;
  const estilo = document.createElement('style');
  estilo.id = 'estilos-guia-v2';
  estilo.textContent = `
    /* Sistema de diseño Forja v2 - Revista de sala */
    .guia-contenedor {
      max-width: 520px;
      margin: 0 auto;
      padding: 12px 18px 96px;
      background-color: var(--papel, #F3F0E8);
      color: var(--tinta, #17171A);
      box-sizing: border-box;
      font-family: 'Bricolage Grotesque', system-ui, -apple-system, sans-serif;
    }

    /* Pestañas de cabecera en píldora tinta/papel (touch target 48px) */
    .guia-tabs {
      display: flex;
      gap: 6px;
      background: var(--papel2, #E9E4D8);
      padding: 5px;
      border-radius: 999px;
      margin-bottom: 16px;
    }
    .guia-tab {
      flex: 1;
      min-height: 48px;
      padding: 9px 14px;
      text-align: center;
      font-weight: 600;
      font-size: 14px;
      border-radius: 999px;
      cursor: pointer;
      color: var(--tinta-suave, #5D5951);
      background: transparent;
      border: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: background-color 0.16s ease, color 0.16s ease, transform 0.12s ease;
    }
    .guia-tab:active {
      transform: scale(0.97);
    }
    .guia-tab.activa {
      background: var(--tinta, #17171A);
      color: var(--papel, #F3F0E8);
    }

    /* Barra de búsqueda en píldora papel2 */
    .guia-buscador-box {
      margin-bottom: 12px;
      position: relative;
    }
    .guia-buscador-icon {
      position: absolute;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--tinta-suave, #5D5951);
      pointer-events: none;
      display: flex;
      align-items: center;
    }
    .guia-buscador-input {
      width: 100%;
      height: 48px;
      padding: 0 16px 0 44px;
      border-radius: 999px;
      background: var(--papel2, #E9E4D8);
      border: none;
      color: var(--tinta, #17171A);
      font-size: 15px;
      font-family: inherit;
      box-sizing: border-box;
      outline: none;
      transition: box-shadow 0.15s ease;
    }
    .guia-buscador-input:focus {
      box-shadow: 0 0 0 2px var(--tinta, #17171A);
    }

    /* Fila de selectores en píldora */
    .guia-filtros-fila {
      display: flex;
      gap: 8px;
      margin-bottom: 14px;
      overflow-x: auto;
      padding-bottom: 4px;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
    }
    .guia-filtros-fila::-webkit-scrollbar {
      display: none;
    }
    .guia-select {
      background: var(--papel2, #E9E4D8);
      color: var(--tinta, #17171A);
      border: none;
      min-height: 48px;
      padding: 0 14px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      font-family: inherit;
      outline: none;
      cursor: pointer;
    }

    /* Tarjeta del Mapa Anatómico en papel2 con radio 28 */
    .guia-mapa-card {
      background: var(--papel2, #E9E4D8);
      border-radius: 28px;
      padding: 14px 16px;
      margin-bottom: 16px;
    }
    .guia-mapa-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      min-height: 36px;
      cursor: pointer;
      user-select: none;
    }
    .guia-mapa-titulo {
      font-size: 13px;
      font-weight: 600;
      color: var(--tinta-suave, #5D5951);
    }
    .guia-mapa-toggle {
      font-size: 12px;
      font-weight: 600;
      color: var(--tinta-suave, #5D5951);
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    /* CUADRÍCULA DE EJERCICIOS CON RADIO 28 Y NOMBRE DEBAJO */
    .guia-grid-ejercicios {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;
    }
    .guia-item-grid {
      display: flex;
      flex-direction: column;
      cursor: pointer;
      user-select: none;
      min-width: 0;
      transition: transform 0.16s cubic-bezier(.2,.8,.2,1);
    }
    .guia-item-grid:active {
      transform: scale(0.97);
    }
    .guia-item-media {
      width: 100%;
      aspect-ratio: 1 / 1;
      border-radius: 28px;
      overflow: hidden;
      position: relative;
      background: var(--papel2, #E9E4D8);
    }
    .guia-item-media img,
    .guia-item-media video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      filter: contrast(1.05) saturate(0.9);
      display: block;
    }
    .guia-item-gradient {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(23,23,26,0) 50%, rgba(23,23,26,0.65) 100%);
      pointer-events: none;
    }
    .guia-item-badge-pill {
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(23, 23, 26, 0.88);
      color: var(--lima, #C8F03C);
      border-radius: 999px;
      padding: 4px 8px;
      font-size: 11px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .guia-item-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--tinta-suave, #5D5951);
      background: var(--papel2, #E9E4D8);
    }
    .guia-item-nombre {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 20px;
      font-weight: 400;
      line-height: 1.15;
      color: var(--tinta, #17171A);
      margin-top: 8px;
      margin-bottom: 2px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .guia-item-chips {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }
    .guia-chip-micro {
      font-size: 11px;
      font-weight: 500;
      color: var(--tinta-suave, #5D5951);
      background: var(--papel2, #E9E4D8);
      padding: 2px 7px;
      border-radius: 999px;
    }

    /* FICHA DEL EJERCICIO: VIDEO GRANDE ARRIBA Y TITULAR SERIF */
    .guia-ficha-nav {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    .guia-btn-pill {
      background: var(--papel2, #E9E4D8);
      color: var(--tinta, #17171A);
      border: none;
      border-radius: 999px;
      min-height: 48px;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: transform 0.14s ease;
    }
    .guia-btn-pill:active {
      transform: scale(0.96);
    }
    .guia-btn-pill.lima {
      background: var(--lima, #C8F03C);
      color: #17171A;
    }

    .guia-ficha-media-box {
      width: 100%;
      height: 320px;
      border-radius: 28px;
      overflow: hidden;
      position: relative;
      background: #17171A;
      margin-bottom: 8px;
    }
    .guia-ficha-media-box video,
    .guia-ficha-media-box img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      filter: contrast(1.05) saturate(0.9);
      display: block;
    }

    /* Animación de 2 fotos alternantes */
    .guia-anim-box {
      position: relative;
      width: 100%;
      height: 320px;
      border-radius: 28px;
      overflow: hidden;
      background: #17171A;
      margin-bottom: 8px;
    }
    .guia-anim-img {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      filter: contrast(1.05) saturate(0.9);
      display: block;
    }
    .guia-anim-img.segunda {
      animation: guia-fade-fotos 2.4s infinite ease-in-out;
    }
    .guia-anim-box.pausado .guia-anim-img.segunda {
      animation-play-state: paused;
    }
    @keyframes guia-fade-fotos {
      0%, 42% { opacity: 0; }
      50%, 92% { opacity: 1; }
      100% { opacity: 0; }
    }
    .guia-btn-pausa-pill {
      position: absolute;
      bottom: 12px;
      right: 12px;
      background: rgba(23, 23, 26, 0.88);
      color: #F3F0E8;
      border: none;
      border-radius: 999px;
      min-height: 48px;
      padding: 8px 16px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      z-index: 2;
    }

    .guia-credito-foto {
      font-size: 12px;
      color: var(--tinta-suave, #5D5951);
      margin-top: 2px;
      margin-bottom: 10px;
      padding-left: 4px;
    }

    .guia-ficha-titular {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 38px;
      font-weight: 400;
      color: var(--tinta, #17171A);
      line-height: 1.05;
      margin: 10px 0 2px;
    }
    .guia-ficha-subtitular {
      font-size: 14px;
      color: var(--tinta-suave, #5D5951);
      font-style: italic;
      margin-bottom: 12px;
    }

    /* CHIPS DE MÚSCULOS EN PAPEL2 */
    .guia-chips-musculos {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 14px;
    }
    .guia-chip-musculo-papel2 {
      background: var(--papel2, #E9E4D8);
      color: var(--tinta, #17171A);
      border-radius: 999px;
      padding: 7px 14px;
      font-size: 13px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .guia-chip-bullet-lima {
      width: 7px;
      height: 7px;
      background: var(--lima, #C8F03C);
      border-radius: 999px;
      display: inline-block;
    }
    .guia-chip-bullet-suave {
      width: 7px;
      height: 7px;
      background: var(--tinta-suave, #5D5951);
      border-radius: 999px;
      display: inline-block;
    }

    /* BOTÓN YOUTUBE ESTILO REVISTA */
    .guia-btn-yt-v2 {
      width: 100%;
      height: 60px;
      background: #17171A;
      color: #F3F0E8;
      border-radius: 999px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 12px 0 22px;
      font-weight: 600;
      font-size: 15px;
      text-decoration: none;
      box-sizing: border-box;
      margin-top: 6px;
      margin-bottom: 14px;
      cursor: pointer;
      transition: transform 0.14s ease;
    }
    .guia-btn-yt-v2:active {
      transform: scale(0.97);
    }
    .guia-btn-yt-bubble {
      width: 40px;
      height: 40px;
      background: var(--lima, #C8F03C);
      color: #17171A;
      border-radius: 999px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    /* PASOS NUMERADOS CON NÚMEROS GRANDES EN LIMA */
    .guia-card-v2 {
      background: var(--papel2, #E9E4D8);
      border-radius: 28px;
      padding: 18px 20px;
      margin-bottom: 14px;
    }
    .guia-card-titulo {
      font-size: 15px;
      font-weight: 700;
      color: var(--tinta, #17171A);
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .guia-pasos-col {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .guia-paso-item {
      background: var(--papel2, #E9E4D8);
      border-radius: 28px;
      padding: 16px 20px;
      display: flex;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 10px;
    }
    .guia-paso-numero-lima {
      font-family: 'Bricolage Grotesque', sans-serif;
      font-size: 44px;
      font-weight: 800;
      line-height: 0.95;
      color: var(--lima, #C8F03C);
      font-variant-numeric: tabular-nums;
      flex-shrink: 0;
      min-width: 44px;
      text-shadow: 0 1px 2px rgba(23, 23, 26, 0.15);
    }
    .guia-paso-texto {
      font-size: 15px;
      line-height: 1.45;
      color: var(--tinta, #17171A);
      align-self: center;
    }

    /* SECCIÓN APRENDER COMO REVISTA */
    .guia-aprender-titular {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 38px;
      font-weight: 400;
      color: var(--tinta, #17171A);
      line-height: 1.05;
      margin-bottom: 6px;
    }
    .guia-aprender-sub {
      font-size: 14px;
      color: var(--tinta-suave, #5D5951);
      line-height: 1.4;
      margin-bottom: 18px;
    }
    .guia-art-card {
      background: var(--papel2, #E9E4D8);
      border-radius: 28px;
      padding: 20px 22px;
      margin-bottom: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      transition: transform 0.16s ease;
    }
    .guia-art-card:active {
      transform: scale(0.98);
    }
    .guia-art-titulo {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 24px;
      font-weight: 400;
      color: var(--tinta, #17171A);
      line-height: 1.15;
    }
    .guia-art-desc {
      font-size: 13px;
      color: var(--tinta-suave, #5D5951);
      margin-top: 4px;
      line-height: 1.4;
    }
    .guia-art-bubble {
      width: 48px;
      height: 48px;
      border-radius: 999px;
      background: var(--papel, #F3F0E8);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--tinta, #17171A);
      flex-shrink: 0;
    }

    /* RENDERIZADO MARKDOWN ESTILO REVISTA (Radios SOLO 28px y 999px) */
    .guia-articulo-md {
      background: var(--papel2, #E9E4D8);
      border-radius: 28px;
      padding: 26px 22px;
      color: var(--tinta, #17171A);
      line-height: 1.6;
    }
    .guia-articulo-md h1 {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 34px;
      font-weight: 400;
      color: var(--tinta, #17171A);
      margin-top: 6px;
      margin-bottom: 14px;
      line-height: 1.1;
    }
    .guia-articulo-md h2 {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 26px;
      font-weight: 400;
      color: var(--tinta, #17171A);
      margin-top: 24px;
      margin-bottom: 10px;
      line-height: 1.15;
    }
    .guia-articulo-md h3 {
      font-family: 'Bricolage Grotesque', sans-serif;
      font-size: 18px;
      font-weight: 700;
      color: var(--tinta, #17171A);
      margin-top: 18px;
      margin-bottom: 8px;
    }
    .guia-articulo-md p {
      margin-bottom: 14px;
      font-size: 15px;
    }
    .guia-articulo-md ul, .guia-articulo-md ol {
      margin-bottom: 16px;
      padding-left: 24px;
    }
    .guia-articulo-md li {
      margin-bottom: 6px;
    }
    .guia-articulo-md blockquote {
      background: var(--papel, #F3F0E8);
      padding: 16px 20px;
      margin: 16px 0;
      border-radius: 28px;
      font-style: italic;
      color: var(--tinta, #17171A);
    }
    .guia-articulo-md a {
      color: var(--tinta, #17171A);
      text-decoration: underline;
      text-decoration-color: var(--lima, #C8F03C);
      text-underline-offset: 3px;
      font-weight: 600;
    }
    .guia-articulo-md pre {
      background: #17171A;
      color: #F3F0E8;
      border-radius: 28px;
      padding: 16px 20px;
      overflow-x: auto;
      margin: 16px 0;
    }
    .guia-articulo-md code {
      font-family: inherit;
      font-variant-numeric: tabular-nums;
      background: rgba(23, 23, 26, 0.08);
      padding: 2px 8px;
      border-radius: 999px;
    }
    .guia-articulo-md pre code {
      background: transparent;
      padding: 0;
      border-radius: 0;
    }
    .guia-articulo-md .tabla-scroll {
      overflow-x: auto;
      margin: 16px 0;
      border-radius: 28px;
      background: var(--papel, #F3F0E8);
      padding: 6px;
    }
    .guia-articulo-md table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    .guia-articulo-md th, .guia-articulo-md td {
      padding: 10px 14px;
      text-align: left;
    }
    .guia-articulo-md tbody tr:nth-child(even) {
      background: rgba(23, 23, 26, 0.03);
    }
    .guia-articulo-md th {
      font-weight: 700;
      color: var(--tinta, #17171A);
      background: rgba(23, 23, 26, 0.05);
    }
  `;
  document.head.appendChild(estilo);
}

/**
 * Normaliza texto para búsqueda rápida sin tildes ni mayúsculas.
 */
function limpiarTexto(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Renderiza la lista principal de ejercicios como cuadrícula de fotos/videos con radio 28 y nombre debajo.
 */
async function renderizarListaEjercicios() {
  if (!contenedorRaiz) return;
  contenedorRaiz.innerHTML = '';

  const div = document.createElement('div');
  div.className = 'guia-contenedor';

  // Barra de pestañas superiores: Ejercicios / Aprender (en píldoras, cero emojis)
  const tabs = document.createElement('div');
  tabs.className = 'guia-tabs';

  const tabEj = document.createElement('button');
  tabEj.className = 'guia-tab activa';
  tabEj.innerHTML = `${renderIcono('mancuerna', { tam: 17 })} <span>Ejercicios</span>`;

  const tabAp = document.createElement('button');
  tabAp.className = 'guia-tab';
  tabAp.innerHTML = `${renderIcono('libro', { tam: 17 })} <span>Aprender</span>`;
  tabAp.onclick = () => ir('guia/aprender');

  tabs.appendChild(tabEj);
  tabs.appendChild(tabAp);
  div.appendChild(tabs);

  // Barra de búsqueda con icono SVG
  const buscadorBox = document.createElement('div');
  buscadorBox.className = 'guia-buscador-box';

  const iconoBuscar = document.createElement('span');
  iconoBuscar.className = 'guia-buscador-icon';
  iconoBuscar.innerHTML = renderIcono('buscar', { tam: 18 });
  buscadorBox.appendChild(iconoBuscar);

  const inputBuscar = document.createElement('input');
  inputBuscar.type = 'text';
  inputBuscar.className = 'guia-buscador-input';
  inputBuscar.placeholder = 'Buscar por nombre, músculo o máquina...';
  inputBuscar.value = estado.filtroTexto;
  inputBuscar.addEventListener('input', (e) => {
    estado.filtroTexto = e.target.value;
    actualizarListaTarjetas();
  });
  buscadorBox.appendChild(inputBuscar);
  div.appendChild(buscadorBox);

  // Fila de selectores (Músculo y Equipo) en píldoras papel2
  const filtrosFila = document.createElement('div');
  filtrosFila.className = 'guia-filtros-fila';

  // Selector de Músculo
  const selMusculo = document.createElement('select');
  selMusculo.className = 'guia-select';
  const optTodosM = document.createElement('option');
  optTodosM.value = '';
  optTodosM.textContent = 'Todos los músculos';
  selMusculo.appendChild(optTodosM);

  for (const musc of MUSCULOS_CANONICOS) {
    const opt = document.createElement('option');
    opt.value = musc;
    opt.textContent = musc.charAt(0).toUpperCase() + musc.slice(1);
    if (estado.filtroMusculo === musc) opt.selected = true;
    selMusculo.appendChild(opt);
  }

  selMusculo.addEventListener('change', (e) => {
    estado.filtroMusculo = e.target.value;
    actualizarMapaYLista();
  });
  filtrosFila.appendChild(selMusculo);

  // Selector de Equipo
  const equiposUnicos = new Set();
  estado.listaCompleta.forEach((ej) => {
    if (ej.equipo) equiposUnicos.add(ej.equipo.trim());
  });

  const selEquipo = document.createElement('select');
  selEquipo.className = 'guia-select';
  const optTodosE = document.createElement('option');
  optTodosE.value = '';
  optTodosE.textContent = 'Todo el equipo';
  selEquipo.appendChild(optTodosE);

  Array.from(equiposUnicos).sort().forEach((eq) => {
    const opt = document.createElement('option');
    opt.value = eq;
    opt.textContent = eq.charAt(0).toUpperCase() + eq.slice(1);
    if (estado.filtroEquipo === eq) opt.selected = true;
    selEquipo.appendChild(opt);
  });

  selEquipo.addEventListener('change', (e) => {
    estado.filtroEquipo = e.target.value;
    actualizarListaTarjetas();
  });
  filtrosFila.appendChild(selEquipo);

  // Botón para limpiar filtros
  if (estado.filtroTexto || estado.filtroMusculo || estado.filtroEquipo) {
    const btnLimpiar = document.createElement('button');
    btnLimpiar.className = 'guia-btn-pill';
    btnLimpiar.innerHTML = `${renderIcono('cerrar', { tam: 14 })} <span>Limpiar</span>`;
    btnLimpiar.onclick = () => {
      estado.filtroTexto = '';
      estado.filtroMusculo = '';
      estado.filtroEquipo = '';
      inputBuscar.value = '';
      selMusculo.value = '';
      selEquipo.value = '';
      actualizarMapaYLista();
    };
    filtrosFila.appendChild(btnLimpiar);
  }

  div.appendChild(filtrosFila);

  // Tarjeta de Mapa Muscular Interactivo (colapsable)
  const contenedorMapa = document.createElement('div');
  contenedorMapa.className = 'guia-mapa-card';

  const cabeceraMapa = document.createElement('div');
  cabeceraMapa.className = 'guia-mapa-header';

  const tituloMapa = document.createElement('span');
  tituloMapa.className = 'guia-mapa-titulo';
  tituloMapa.textContent = estado.filtroMusculo
    ? `Músculo: ${estado.filtroMusculo.charAt(0).toUpperCase() + estado.filtroMusculo.slice(1)}`
    : 'Mapa muscular (toca para filtrar)';

  const btnToggleMapa = document.createElement('span');
  btnToggleMapa.className = 'guia-mapa-toggle';
  btnToggleMapa.innerHTML = estado.mapaColapsado
    ? `<span>Mostrar</span> ${renderIcono('chevron-abajo', { tam: 14 })}`
    : `<span>Ocultar</span> ${renderIcono('chevron-arriba', { tam: 14 })}`;

  cabeceraMapa.appendChild(tituloMapa);
  cabeceraMapa.appendChild(btnToggleMapa);
  cabeceraMapa.onclick = () => {
    estado.mapaColapsado = !estado.mapaColapsado;
    actualizarMapaYLista();
  };
  contenedorMapa.appendChild(cabeceraMapa);

  const cuerpoMapa = document.createElement('div');
  cuerpoMapa.id = 'guia-svg-cuerpo';
  if (!estado.mapaColapsado) {
    const princ = estado.filtroMusculo ? [estado.filtroMusculo] : [];
    const nodoSvg = mapaSVG(princ, [], (musculoTocado) => {
      if (estado.filtroMusculo === musculoTocado) {
        estado.filtroMusculo = '';
        selMusculo.value = '';
      } else {
        estado.filtroMusculo = musculoTocado;
        selMusculo.value = musculoTocado;
      }
      actualizarMapaYLista();
    });
    cuerpoMapa.appendChild(nodoSvg);
  }
  contenedorMapa.appendChild(cuerpoMapa);
  div.appendChild(contenedorMapa);

  // Contenedor de la cuadrícula de ejercicios
  const contenedorGrid = document.createElement('div');
  contenedorGrid.id = 'guia-grid-contenedor';
  div.appendChild(contenedorGrid);

  contenedorRaiz.appendChild(div);

  function actualizarMapaYLista() {
    tituloMapa.textContent = estado.filtroMusculo
      ? `Músculo: ${estado.filtroMusculo.charAt(0).toUpperCase() + estado.filtroMusculo.slice(1)}`
      : 'Mapa muscular (toca para filtrar)';
    btnToggleMapa.innerHTML = estado.mapaColapsado
      ? `<span>Mostrar</span> ${renderIcono('chevron-abajo', { tam: 14 })}`
      : `<span>Ocultar</span> ${renderIcono('chevron-arriba', { tam: 14 })}`;

    cuerpoMapa.innerHTML = '';
    if (!estado.mapaColapsado) {
      const princ = estado.filtroMusculo ? [estado.filtroMusculo] : [];
      const nodoSvg = mapaSVG(princ, [], (musculoTocado) => {
        if (estado.filtroMusculo === musculoTocado) {
          estado.filtroMusculo = '';
          selMusculo.value = '';
        } else {
          estado.filtroMusculo = musculoTocado;
          selMusculo.value = musculoTocado;
        }
        actualizarMapaYLista();
      });
      cuerpoMapa.appendChild(nodoSvg);
    }
    actualizarListaTarjetas();
  }

  function actualizarListaTarjetas() {
    const listado = document.getElementById('guia-grid-contenedor');
    if (!listado) return;
    listado.innerHTML = '';

    const q = limpiarTexto(estado.filtroTexto);
    const mFiltro = estado.filtroMusculo ? normalizarMusculo(estado.filtroMusculo) : '';
    const eFiltro = estado.filtroEquipo ? limpiarTexto(estado.filtroEquipo) : '';

    const filtrados = estado.listaCompleta.filter((ej) => {
      // Filtro texto
      if (q) {
        const nom = limpiarTexto(ej.nombre);
        const nomEn = limpiarTexto(ej.nombre_en);
        const alias = Array.isArray(ej.alias) ? ej.alias.map(limpiarTexto).join(' ') : '';
        const eq = limpiarTexto(ej.equipo);
        if (!nom.includes(q) && !nomEn.includes(q) && !alias.includes(q) && !eq.includes(q)) {
          return false;
        }
      }

      // Filtro músculo
      if (mFiltro) {
        const princ = Array.isArray(ej.musculos_principales)
          ? ej.musculos_principales.map(normalizarMusculo)
          : [normalizarMusculo(ej.musculos_principales)];
        const sec = Array.isArray(ej.musculos_secundarios)
          ? ej.musculos_secundarios.map(normalizarMusculo)
          : [normalizarMusculo(ej.musculos_secundarios)];
        if (!princ.includes(mFiltro) && !sec.includes(mFiltro)) {
          return false;
        }
      }

      // Filtro equipo
      if (eFiltro) {
        const eq = limpiarTexto(ej.equipo);
        if (!eq.includes(eFiltro)) return false;
      }

      return true;
    });

    // Contador de resultados
    const contador = document.createElement('div');
    contador.style.fontSize = '12px';
    contador.style.color = 'var(--tinta-suave, #5D5951)';
    contador.style.fontWeight = '500';
    contador.style.marginBottom = '12px';
    contador.style.paddingLeft = '4px';
    contador.textContent = `${filtrados.length} ejercicio${filtrados.length === 1 ? '' : 's'}`;
    listado.appendChild(contador);

    if (filtrados.length === 0) {
      const vacio = document.createElement('div');
      vacio.className = 'guia-card-v2';
      vacio.style.textAlign = 'center';
      vacio.style.padding = '36px 16px';
      vacio.innerHTML = `
        <div style="margin-bottom: 8px; color: var(--tinta-suave, #5D5951);">${renderIcono('buscar', { tam: 32 })}</div>
        <p style="font-weight: 700; margin-bottom: 4px; font-size: 16px;">Sin ejercicios con esos filtros</p>
        <p style="font-size: 13px; color: var(--tinta-suave, #5D5951);">Prueba buscando con otra palabra o limpia los filtros.</p>
      `;
      listado.appendChild(vacio);
      return;
    }

    // Cuadrícula de tarjetas con fotos/videos y radio 28
    const grid = document.createElement('div');
    grid.className = 'guia-grid-ejercicios';

    filtrados.forEach((ej) => {
      const item = document.createElement('div');
      item.className = 'guia-item-grid';
      item.onclick = () => ir('guia/' + ej.id);

      // Contenedor visual de foto/video con radio 28
      const mediaBox = document.createElement('div');
      mediaBox.className = 'guia-item-media';

      const fotoMiniatura = ej.imagen || (Array.isArray(ej.imagenes) && ej.imagenes.length > 0 ? ej.imagenes[0] : null);

      if (fotoMiniatura) {
        const img = document.createElement('img');
        img.src = fotoMiniatura;
        img.alt = ej.nombre;
        img.loading = 'lazy';
        img.onerror = () => {
          img.style.display = 'none';
          mediaBox.innerHTML = `<div class="guia-item-placeholder">${renderIcono('mancuerna', { tam: 32 })}</div>`;
        };
        mediaBox.appendChild(img);

        const gradiente = document.createElement('div');
        gradiente.className = 'guia-item-gradient';
        mediaBox.appendChild(gradiente);
      } else if (ej.video) {
        // Thumbnail de video
        const videoThumb = document.createElement('video');
        videoThumb.src = ej.video;
        videoThumb.muted = true;
        videoThumb.playsInline = true;
        videoThumb.preload = 'metadata';
        mediaBox.appendChild(videoThumb);

        const gradiente = document.createElement('div');
        gradiente.className = 'guia-item-gradient';
        mediaBox.appendChild(gradiente);
      } else {
        mediaBox.innerHTML = `<div class="guia-item-placeholder">${renderIcono('mancuerna', { tam: 32 })}</div>`;
      }

      // Badge discreto si hay video o animación
      if (ej.video) {
        const badge = document.createElement('div');
        badge.className = 'guia-item-badge-pill';
        badge.innerHTML = `${renderIcono('play', { tam: 10 })} Video`;
        mediaBox.appendChild(badge);
      } else if (Array.isArray(ej.imagenes) && ej.imagenes.length >= 2) {
        const badge = document.createElement('div');
        badge.className = 'guia-item-badge-pill';
        badge.innerHTML = `${renderIcono('cambiar', { tam: 10 })} 2 fotos`;
        mediaBox.appendChild(badge);
      }

      item.appendChild(mediaBox);

      // Nombre en Instrument Serif debajo de la foto/video
      const nombre = document.createElement('div');
      nombre.className = 'guia-item-nombre';
      nombre.textContent = ej.nombre;
      item.appendChild(nombre);

      // Micro-chips en papel2
      const chips = document.createElement('div');
      chips.className = 'guia-item-chips';

      if (ej.musculos_principales) {
        const m = Array.isArray(ej.musculos_principales) ? ej.musculos_principales[0] : ej.musculos_principales;
        if (m) {
          const chM = document.createElement('span');
          chM.className = 'guia-chip-micro';
          chM.textContent = m;
          chips.appendChild(chM);
        }
      }

      if (ej.equipo) {
        const chEq = document.createElement('span');
        chEq.className = 'guia-chip-micro';
        chEq.textContent = ej.equipo;
        chips.appendChild(chEq);
      }

      item.appendChild(chips);
      grid.appendChild(item);
    });

    listado.appendChild(grid);
  }

  actualizarListaTarjetas();
}

/**
 * Renderiza la ficha técnica completa de un ejercicio.
 * Con video grande arriba (o animación de 2 fotos), titular en Instrument Serif,
 * pasos numerados con números grandes en lima, chips de músculos en papel2 y metadatos
 * que no se deforman a 360 px.
 * @param {string} id - ID del ejercicio
 */
async function renderizarFichaEjercicio(id) {
  if (!contenedorRaiz) return;
  contenedorRaiz.innerHTML = '';

  const div = document.createElement('div');
  div.className = 'guia-contenedor';

  let ej = null;
  try {
    ej = await ejercicio(id);
  } catch (err) {
    console.error('Error al cargar ejercicio:', err);
  }

  if (!ej && estado.listaCompleta.length > 0) {
    ej = estado.listaCompleta.find((e) => e.id === id);
  }

  if (!ej) {
    div.innerHTML = `
      <div style="margin-bottom: 16px;">
        <button class="guia-btn-pill" id="btn-volver-guia">
          ${renderIcono('flecha-izquierda', { tam: 16 })} Volver a ejercicios
        </button>
      </div>
      <div class="guia-card-v2" style="text-align: center; padding: 36px 16px;">
        <p style="font-size: 18px; font-weight: bold;">Ejercicio no encontrado</p>
        <p style="color: var(--tinta-suave, #5D5951); font-size: 14px; margin-top: 4px;">No se encontró la ficha técnica para «${escaparHtml(id)}».</p>
      </div>
    `;
    div.querySelector('#btn-volver-guia').onclick = () => ir('guia');
    contenedorRaiz.appendChild(div);
    return;
  }

  // Barra superior de navegación: Volver y Registrar serie
  const navFila = document.createElement('div');
  navFila.className = 'guia-ficha-nav';

  const btnVolver = document.createElement('button');
  btnVolver.className = 'guia-btn-pill';
  btnVolver.innerHTML = `${renderIcono('flecha-izquierda', { tam: 16 })} <span>Ejercicios</span>`;
  btnVolver.onclick = () => ir('guia');
  navFila.appendChild(btnVolver);

  const btnEntrenar = document.createElement('button');
  btnEntrenar.className = 'guia-btn-pill lima';
  btnEntrenar.innerHTML = `<span>+ Registrar serie</span>`;
  btnEntrenar.onclick = () => ir('registrar/' + ej.id);
  navFila.appendChild(btnEntrenar);

  div.appendChild(navFila);

  // Crédito de la foto si existe 'foto_fuente'
  let credito = null;
  if (ej.foto_fuente) {
    credito = document.createElement('div');
    credito.className = 'guia-credito-foto';
    credito.textContent = `Foto: ${ej.foto_fuente}`;
  }

  function ocultarRecuadro(el) {
    if (el) el.style.display = 'none';
    if (credito) credito.style.display = 'none';
  }

  function crearAnimacionFotos() {
    const boxAnim = document.createElement('div');
    boxAnim.className = 'guia-anim-box';

    let falloOcurrio = false;
    const alFallar = () => {
      if (falloOcurrio) return;
      falloOcurrio = true;
      ocultarRecuadro(boxAnim);
    };

    const foto1 = document.createElement('img');
    foto1.className = 'guia-anim-img primera';
    foto1.src = ej.imagenes[0];
    foto1.alt = `${ej.nombre} - Posición inicial`;
    foto1.onerror = alFallar;
    boxAnim.appendChild(foto1);

    const foto2 = document.createElement('img');
    foto2.className = 'guia-anim-img segunda';
    foto2.src = ej.imagenes[1];
    foto2.alt = `${ej.nombre} - Posición final`;
    foto2.onerror = alFallar;
    boxAnim.appendChild(foto2);

    // Botón de pausa en píldora con ícono SVG
    const btnPausa = document.createElement('button');
    btnPausa.type = 'button';
    btnPausa.className = 'guia-btn-pausa-pill';
    btnPausa.innerHTML = `${renderIcono('pausa', { tam: 13, color: '#F3F0E8' })} <span>Pausa</span>`;
    btnPausa.setAttribute('aria-label', 'Pausar animación');

    let pausado = false;
    btnPausa.onclick = () => {
      pausado = !pausado;
      if (pausado) {
        boxAnim.classList.add('pausado');
        btnPausa.innerHTML = `${renderIcono('play', { tam: 13, color: '#F3F0E8' })} <span>Reanudar</span>`;
        btnPausa.setAttribute('aria-label', 'Reanudar animación');
      } else {
        boxAnim.classList.remove('pausado');
        btnPausa.innerHTML = `${renderIcono('pausa', { tam: 13, color: '#F3F0E8' })} <span>Pausa</span>`;
        btnPausa.setAttribute('aria-label', 'Pausar animación');
      }
    };
    boxAnim.appendChild(btnPausa);

    return boxAnim;
  }

  function crearImagenSimple() {
    const mediaBox = document.createElement('div');
    mediaBox.className = 'guia-ficha-media-box';
    const img = document.createElement('img');
    img.src = ej.imagen || (Array.isArray(ej.imagenes) && ej.imagenes.length > 0 ? ej.imagenes[0] : '');
    img.alt = ej.nombre;
    img.onerror = () => {
      ocultarRecuadro(mediaBox);
    };
    mediaBox.appendChild(img);
    return mediaBox;
  }

  // EL VIDEO GRANDE ARRIBA (O LA ANIMACIÓN DE LAS 2 FOTOS)
  const tieneVideo = Boolean(ej.video);
  const tieneDosImagenes = Array.isArray(ej.imagenes) && ej.imagenes.length >= 2;
  const tieneImagen = Boolean(ej.imagen || (Array.isArray(ej.imagenes) && ej.imagenes.length > 0));

  if (tieneVideo) {
    const mediaBox = document.createElement('div');
    mediaBox.className = 'guia-ficha-media-box';

    const video = document.createElement('video');
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.src = ej.video;
    if (ej.imagen) {
      video.poster = ej.imagen;
    } else if (Array.isArray(ej.imagenes) && ej.imagenes.length > 0) {
      video.poster = ej.imagenes[0];
    }

    let falloVideoManejado = false;
    const manejarFalloVideo = () => {
      if (falloVideoManejado) return;
      falloVideoManejado = true;
      try {
        video.pause();
      } catch (_) {}

      if (tieneDosImagenes) {
        const anim = crearAnimacionFotos();
        if (mediaBox.parentNode) {
          mediaBox.parentNode.replaceChild(anim, mediaBox);
        }
      } else if (tieneImagen) {
        const imgBox = crearImagenSimple();
        if (mediaBox.parentNode) {
          mediaBox.parentNode.replaceChild(imgBox, mediaBox);
        }
      } else {
        ocultarRecuadro(mediaBox);
      }
    };

    video.onerror = manejarFalloVideo;
    video.addEventListener('error', manejarFalloVideo);
    mediaBox.appendChild(video);
    div.appendChild(mediaBox);
  } else if (tieneDosImagenes) {
    const boxAnim = crearAnimacionFotos();
    div.appendChild(boxAnim);
  } else if (tieneImagen) {
    const imgBox = crearImagenSimple();
    div.appendChild(imgBox);
  }

  // Crédito de foto si existe
  if (credito) {
    div.appendChild(credito);
  }

  // TITULAR EN INSTRUMENT SERIF
  const titular = document.createElement('h1');
  titular.className = 'guia-ficha-titular';
  titular.textContent = ej.nombre;
  div.appendChild(titular);

  if (ej.nombre_en) {
    const subtitular = document.createElement('div');
    subtitular.className = 'guia-ficha-subtitular';
    subtitular.textContent = `(${ej.nombre_en})`;
    div.appendChild(subtitular);
  }

  // CHIPS DE MÚSCULOS EN PAPEL2
  const princ = Array.isArray(ej.musculos_principales)
    ? ej.musculos_principales
    : (ej.musculos_principales ? [ej.musculos_principales] : []);
  const sec = Array.isArray(ej.musculos_secundarios)
    ? ej.musculos_secundarios
    : (ej.musculos_secundarios ? [ej.musculos_secundarios] : []);

  const chipsDiv = document.createElement('div');
  chipsDiv.className = 'guia-chips-musculos';

  princ.forEach((m) => {
    const chip = document.createElement('span');
    chip.className = 'guia-chip-musculo-papel2';
    chip.innerHTML = `<span class="guia-chip-bullet-lima"></span> <span>${escaparHtml(m)}</span>`;
    chipsDiv.appendChild(chip);
  });

  sec.forEach((m) => {
    const chip = document.createElement('span');
    chip.className = 'guia-chip-musculo-papel2';
    chip.innerHTML = `<span class="guia-chip-bullet-suave"></span> <span>${escaparHtml(m)}</span>`;
    chipsDiv.appendChild(chip);
  });

  div.appendChild(chipsDiv);

  // BOTÓN YOUTUBE ESTILO REVISTA
  const queryYt = ej.busqueda_video || `${ej.nombre} tecnica ejecucion`;
  const urlYt = `https://www.youtube.com/results?search_query=${encodeURIComponent(queryYt)}`;
  const btnYt = document.createElement('a');
  btnYt.href = urlYt;
  btnYt.target = '_blank';
  btnYt.rel = 'noopener noreferrer';
  btnYt.className = 'guia-btn-yt-v2';
  btnYt.innerHTML = `
    <span>Ver técnica en YouTube</span>
    <div class="guia-btn-yt-bubble">
      ${renderIcono('play', { tam: 15, color: '#17171A' })}
    </div>
  `;
  div.appendChild(btnYt);

  // MAPA DEL CUERPO CON MÚSCULOS INVOLUCRADOS
  const bloqueMapa = document.createElement('div');
  bloqueMapa.className = 'guia-card-v2';

  const titMapa = document.createElement('div');
  titMapa.className = 'guia-card-titulo';
  titMapa.innerHTML = `${renderIcono('mancuerna', { tam: 17 })} <span>Músculos involucrados</span>`;
  bloqueMapa.appendChild(titMapa);

  const svgEl = mapaSVG(princ, sec, null);
  bloqueMapa.appendChild(svgEl);
  div.appendChild(bloqueMapa);

  // METADATOS TÉCNICOS: Equipo, Tipo, Series/Reps, Descanso, Tempo, Respiración
  // (Adaptados a 360 px sin deformación elíptica: radio 999px para píldoras cortas <= 25 chars y
  // radio 28px ocupando ancho completo para textos largos como Respiración — diseno ALTO-07)
  const bloqueMeta = document.createElement('div');
  bloqueMeta.className = 'guia-card-v2';

  const gridMeta = document.createElement('div');
  gridMeta.style.display = 'grid';
  gridMeta.style.gridTemplateColumns = 'repeat(2, 1fr)';
  gridMeta.style.gap = '10px';

  function agregarDato(etiqueta, valor) {
    if (!valor) return;
    const textoValor = String(valor);
    const esTextoLargo = textoValor.length > 25 || etiqueta === 'Respiración';
    const item = document.createElement('div');
    item.style.gridColumn = esTextoLargo ? '1 / -1' : 'auto';
    item.style.background = 'var(--papel, #F3F0E8)';
    item.style.padding = esTextoLargo ? '16px 20px' : '10px 16px';
    item.style.borderRadius = esTextoLargo ? '28px' : '999px';
    item.style.minWidth = '0';
    item.style.overflowWrap = 'break-word';
    item.innerHTML = `
      <span style="display: block; font-size: 11px; color: var(--tinta-suave, #5D5951); font-weight: 600;">${escaparHtml(etiqueta)}</span>
      <span style="display: block; font-size: 13px; color: var(--tinta, #17171A); font-weight: 600; line-height: 1.4; margin-top: 2px;">${escaparHtml(textoValor)}</span>
    `;
    gridMeta.appendChild(item);
  }

  agregarDato('Equipo', ej.equipo);
  agregarDato('Tipo', ej.tipo);
  agregarDato('Reps hipertrofia', ej.series_reps_hipertrofia);
  agregarDato('Reps fuerza', ej.series_reps_fuerza);
  if (ej.descanso_seg) {
    const minDesc = (ej.descanso_seg / 60).toFixed(1).replace('.0', '');
    agregarDato('Descanso', `${ej.descanso_seg} s (~${minDesc} min)`);
  }
  agregarDato('RIR sugerido', ej.rir_recomendado);
  agregarDato('Tempo', ej.tempo);
  agregarDato('Respiración', ej.respiracion);

  bloqueMeta.appendChild(gridMeta);
  div.appendChild(bloqueMeta);

  // PASOS NUMERADOS CON NÚMEROS GRANDES EN LIMA
  if (Array.isArray(ej.pasos) && ej.pasos.length > 0) {
    const bloquePasos = document.createElement('div');
    bloquePasos.className = 'guia-pasos-col';

    const titPasos = document.createElement('div');
    titPasos.className = 'guia-card-titulo';
    titPasos.style.paddingLeft = '4px';
    titPasos.innerHTML = `${renderIcono('lista', { tam: 17 })} <span>Paso a paso</span>`;
    bloquePasos.appendChild(titPasos);

    ej.pasos.forEach((p, idx) => {
      const pasoItem = document.createElement('div');
      pasoItem.className = 'guia-paso-item';

      const numEl = document.createElement('div');
      numEl.className = 'guia-paso-numero-lima';
      numEl.textContent = String(idx + 1).padStart(2, '0');

      const txtEl = document.createElement('div');
      txtEl.className = 'guia-paso-texto';
      txtEl.textContent = p;

      pasoItem.appendChild(numEl);
      pasoItem.appendChild(txtEl);
      bloquePasos.appendChild(pasoItem);
    });

    div.appendChild(bloquePasos);
  }

  // CLAVES DE TÉCNICA
  if (Array.isArray(ej.claves_tecnica) && ej.claves_tecnica.length > 0) {
    const bloqueClaves = document.createElement('div');
    bloqueClaves.className = 'guia-card-v2';
    bloqueClaves.innerHTML = `
      <div class="guia-card-titulo">${renderIcono('foco', { tam: 17 })} <span>Claves de técnica</span></div>
      <ul style="margin: 0; padding-left: 20px; line-height: 1.6; color: #17171A;">
        ${ej.claves_tecnica.map((c) => `<li style="margin-bottom: 6px;">${escaparHtml(c)}</li>`).join('')}
      </ul>
    `;
    div.appendChild(bloqueClaves);
  }

  // ERRORES COMUNES (Terracota, sin bordes toscos)
  if (Array.isArray(ej.errores_comunes) && ej.errores_comunes.length > 0) {
    const bloqueErrores = document.createElement('div');
    bloqueErrores.className = 'guia-card-v2';
    bloqueErrores.innerHTML = `
      <div class="guia-card-titulo" style="color: #A02B14;">
        ${renderIcono('alerta', { tam: 17, color: '#E2553A' })} <span>Errores comunes</span>
      </div>
      <ul style="margin: 0; padding-left: 20px; line-height: 1.6; color: #17171A;">
        ${ej.errores_comunes.map((err) => `<li style="margin-bottom: 6px;">${escaparHtml(err)}</li>`).join('')}
      </ul>
    `;
    div.appendChild(bloqueErrores);
  }

  // PROGRESIÓN SUGERIDA
  if (ej.progresion) {
    const bloqueProg = document.createElement('div');
    bloqueProg.className = 'guia-card-v2';
    bloqueProg.innerHTML = `
      <div class="guia-card-titulo">${renderIcono('tendencia', { tam: 17 })} <span>Progresión sugerida</span></div>
      <p style="margin: 0; line-height: 1.5; color: #17171A;">${escaparHtml(ej.progresion)}</p>
    `;
    div.appendChild(bloqueProg);
  }

  // ALTERNATIVAS
  if (Array.isArray(ej.alternativas) && ej.alternativas.length > 0) {
    const bloqueAlt = document.createElement('div');
    bloqueAlt.className = 'guia-card-v2';
    const titAlt = document.createElement('div');
    titAlt.className = 'guia-card-titulo';
    titAlt.innerHTML = `${renderIcono('cambiar', { tam: 17 })} <span>Alternativas</span>`;
    bloqueAlt.appendChild(titAlt);

    const contAlt = document.createElement('div');
    contAlt.style.display = 'flex';
    contAlt.style.flexWrap = 'wrap';
    contAlt.style.gap = '8px';

    ej.alternativas.forEach((alt) => {
      const altLimpio = alt.trim();
      const coincide = estado.listaCompleta.find(
        (e) => e.id === altLimpio || limpiarTexto(e.nombre) === limpiarTexto(altLimpio)
      );

      const tag = document.createElement('button');
      tag.className = 'guia-btn-pill';
      tag.style.background = 'var(--papel, #F3F0E8)';
      tag.textContent = coincide ? coincide.nombre : altLimpio;
      if (coincide) {
        tag.onclick = () => ir('guia/' + coincide.id);
      }
      contAlt.appendChild(tag);
    });
    bloqueAlt.appendChild(contAlt);
    div.appendChild(bloqueAlt);
  }

  // SEGURIDAD
  if (ej.seguridad) {
    const bloqueSeg = document.createElement('div');
    bloqueSeg.className = 'guia-card-v2';
    bloqueSeg.innerHTML = `
      <div class="guia-card-titulo">${renderIcono('escudo', { tam: 17 })} <span>Seguridad</span></div>
      <p style="margin: 0; line-height: 1.5; color: #17171A;">${escaparHtml(ej.seguridad)}</p>
    `;
    div.appendChild(bloqueSeg);
  }

  // EVIDENCIA Y FUENTE
  if (ej.evidencia || ej.fuente) {
    const bloqueEvid = document.createElement('div');
    bloqueEvid.style.fontSize = '12px';
    bloqueEvid.style.color = 'var(--tinta-suave, #5D5951)';
    bloqueEvid.style.padding = '0 8px 12px';
    let html = '';
    if (ej.evidencia) html += `<div><strong>Evidencia:</strong> ${escaparHtml(ej.evidencia)}</div>`;
    if (ej.fuente) html += `<div style="margin-top: 4px;"><strong>Fuente:</strong> ${escaparHtml(ej.fuente)}</div>`;
    bloqueEvid.innerHTML = html;
    div.appendChild(bloqueEvid);
  }

  contenedorRaiz.appendChild(div);
}

/**
 * Renderiza el índice de la sección Aprender con los artículos de data/guia/indice.json.
 * Presentación editorial estilo revista deportiva con titulares serif.
 */
async function renderizarIndiceAprender() {
  if (!contenedorRaiz) return;
  contenedorRaiz.innerHTML = '';

  const div = document.createElement('div');
  div.className = 'guia-contenedor';

  // Barra de pestañas superiores: Ejercicios / Aprender
  const tabs = document.createElement('div');
  tabs.className = 'guia-tabs';

  const tabEj = document.createElement('button');
  tabEj.className = 'guia-tab';
  tabEj.innerHTML = `${renderIcono('mancuerna', { tam: 17 })} <span>Ejercicios</span>`;
  tabEj.onclick = () => ir('guia');

  const tabAp = document.createElement('button');
  tabAp.className = 'guia-tab activa';
  tabAp.innerHTML = `${renderIcono('libro', { tam: 17 })} <span>Aprender</span>`;

  tabs.appendChild(tabEj);
  tabs.appendChild(tabAp);
  div.appendChild(tabs);

  // Encabezado editorial estilo revista
  const intro = document.createElement('div');
  intro.style.marginBottom = '16px';
  intro.innerHTML = `
    <h2 class="guia-aprender-titular"><em>Principios</em> y Ciencia</h2>
    <p class="guia-aprender-sub">Fundamentos de hipertrofia, técnica y nutrición basados en evidencia.</p>
  `;
  div.appendChild(intro);

  const listaCont = document.createElement('div');
  listaCont.id = 'aprender-lista';
  div.appendChild(listaCont);

  contenedorRaiz.appendChild(div);

  // Cargar índice desde data/guia/indice.json
  try {
    const res = await fetch('data/guia/indice.json');
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const articulos = await res.json();

    if (!Array.isArray(articulos) || articulos.length === 0) {
      listaCont.innerHTML = `
        <div class="guia-card-v2" style="text-align: center; padding: 36px 16px;">
          <p style="font-weight: 600;">No hay guías disponibles en este momento.</p>
        </div>
      `;
      return;
    }

    listaCont.innerHTML = '';
    articulos.forEach((art) => {
      const card = document.createElement('div');
      card.className = 'guia-art-card';
      card.onclick = () => ir('guia/aprender/' + art.archivo);

      const info = document.createElement('div');
      info.style.flex = '1';
      info.style.minWidth = '0';

      const tit = document.createElement('div');
      tit.className = 'guia-art-titulo';
      tit.textContent = art.titulo || art.archivo;
      info.appendChild(tit);

      if (art.descripcion) {
        const desc = document.createElement('div');
        desc.className = 'guia-art-desc';
        desc.textContent = art.descripcion;
        info.appendChild(desc);
      }
      card.appendChild(info);

      const bubble = document.createElement('div');
      bubble.className = 'guia-art-bubble';
      bubble.innerHTML = renderIcono('flecha-derecha', { tam: 18, color: '#17171A' });
      card.appendChild(bubble);

      listaCont.appendChild(card);
    });
  } catch (err) {
    console.warn('No se pudo cargar data/guia/indice.json:', err);
    listaCont.innerHTML = `
      <div class="guia-card-v2" style="text-align: center; padding: 32px 16px;">
        <div style="margin-bottom: 8px; color: var(--tinta-suave, #5D5951);">${renderIcono('libro', { tam: 32 })}</div>
        <p style="font-weight: 700; margin-bottom: 6px; font-size: 16px;">Guías en preparación</p>
        <p style="font-size: 13px; color: var(--tinta-suave, #5D5951); margin-bottom: 16px;">
          Los artículos de <code>data/guia/</code> se cargarán automáticamente al estar disponibles.
        </p>
        <button class="guia-btn-pill lima" id="btn-reintentar-aprender">Reintentar</button>
      </div>
    `;
    const btnReintentar = listaCont.querySelector('#btn-reintentar-aprender');
    if (btnReintentar) {
      btnReintentar.onclick = async () => {
        await renderizarIndiceAprender();
      };
    }
  }
}

/**
 * Renderiza un artículo Markdown específico de la sección Aprender con tipografía de revista.
 * @param {string} archivo - Nombre de archivo .md
 */
async function renderizarArticuloAprender(archivo) {
  if (!contenedorRaiz) return;
  contenedorRaiz.innerHTML = '';

  const div = document.createElement('div');
  div.className = 'guia-contenedor';

  // Botón Volver a Aprender
  const btnVolver = document.createElement('button');
  btnVolver.className = 'guia-btn-pill';
  btnVolver.style.marginBottom = '14px';
  btnVolver.innerHTML = `${renderIcono('flecha-izquierda', { tam: 16 })} <span>Volver a Aprender</span>`;
  btnVolver.onclick = () => ir('guia/aprender');
  div.appendChild(btnVolver);

  const cuerpoArticulo = document.createElement('div');
  cuerpoArticulo.className = 'guia-articulo-md';
  cuerpoArticulo.innerHTML = '<p style="color: var(--tinta-suave, #5D5951);">Cargando guía...</p>';
  div.appendChild(cuerpoArticulo);

  contenedorRaiz.appendChild(div);

  try {
    // Validar que el nombre de archivo sea seguro y relativo a data/guia/
    const nombreSeguro = String(archivo || '').trim();
    if (!/^[a-zA-Z0-9._-]+\.md$/i.test(nombreSeguro) || nombreSeguro.includes('..')) {
      throw new Error('Nombre de archivo inválido');
    }
    const ruta = `data/guia/${nombreSeguro}`;
    const res = await fetch(ruta);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const textoMd = await res.text();
    const html = mdAHtml(textoMd);
    cuerpoArticulo.innerHTML = html;
  } catch (err) {
    console.error('Error al cargar archivo markdown:', err);
    cuerpoArticulo.innerHTML = `
      <div style="text-align: center; padding: 24px;">
        <p style="font-weight: 700; color: #A02B14;">No se pudo cargar la guía</p>
        <p style="font-size: 13px; color: var(--tinta-suave, #5D5951); margin-top: 4px;">No fue posible leer el archivo «${escaparHtml(archivo)}».</p>
        <button class="guia-btn-pill lima" style="margin-top: 14px;" id="btn-reintentar-md">Reintentar</button>
      </div>
    `;
    const btnRe = cuerpoArticulo.querySelector('#btn-reintentar-md');
    if (btnRe) {
      btnRe.onclick = async () => {
        await renderizarArticuloAprender(archivo);
      };
    }
  }
}

/**
 * Punto de entrada principal según el router de app.js.
 * @param {HTMLElement} contenedor - Contenedor DOM donde se monta la pantalla
 * @param {Array<string>} params - Parámetros de la ruta tras #guia
 */
export async function montar(contenedor, params = []) {
  asegurarEstilos();
  contenedorRaiz = contenedor;

  // Cargar ejercicios en memoria una sola vez
  if (estado.listaCompleta.length === 0) {
    try {
      const datos = await ejercicios();
      estado.listaCompleta = Array.isArray(datos) ? datos : [];
    } catch (e) {
      console.warn('No se pudieron obtener ejercicios de datos.js:', e);
      estado.listaCompleta = [];
    }
  }

  // Enrutamiento según params
  const p0 = params && params[0] ? String(params[0]).trim() : '';
  const p1 = params && params[1] ? String(params[1]).trim() : '';

  if (p0 === 'aprender') {
    if (p1) {
      await renderizarArticuloAprender(p1);
    } else {
      await renderizarIndiceAprender();
    }
  } else if (p0 && p0 !== '') {
    await renderizarFichaEjercicio(p0);
  } else {
    await renderizarListaEjercicios();
  }
}

/**
 * Limpieza al desmontar la pantalla.
 */
export function desmontar() {
  if (contenedorRaiz) {
    const videos = contenedorRaiz.querySelectorAll('video');
    videos.forEach((v) => {
      try {
        v.onerror = null;
        v.pause();
        v.removeAttribute('src');
        v.load();
      } catch (_) {}
    });
  }
  contenedorRaiz = null;
}

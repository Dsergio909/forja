// js/coach.js — Pantalla de Coach («¿cómo voy?») sin internet
// Implementa chat guardado en el store 'chat', respuestas por reglas y WebLLM con streaming.
// Cumple con CONTRATOS.md, ENCARGO_APP.md y DIRECCION_FORJA_v2.md

import * as db from './db.js';
import * as ui from './ui.js';
import * as datos from './datos.js';
import * as calculos from './calculos.js';
import * as config from './config.js';
import { buscarEjercicio } from './parser.js';
import { icono } from './iconos.js';
import { mdAHtml } from './markdown.js';

let mlcEngine = null;
let descargando = false;
let enGeneracion = false;
let estadoPantalla = null;

// ============================================================================
// 1. UTILIDADES, FECHAS LOCALES, SANITIZACIÓN XSS Y BÚSQUEDA DE EJERCICIOS
// ============================================================================

export function normalizar(str) {
  if (!str) return '';
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[¿?¡!.,;:_\-"'()[\]{}#+*/\\]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Convierte Date a 'AAAA-MM-DD' en hora local evitando desfase UTC */
export function fechaLocalISO(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
}

export function lunesSemanaISO() {
  const d = new Date(), day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return fechaLocalISO(d);
}

/** Escapa todos los caracteres HTML especiales (incluyendo comillas) para evitar XSS */
export function escaparHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Renderiza Markdown del chat de forma segura contra XSS (Seguridad Hallazgo 2).
 * Escapa HTML/comillas, valida enlaces internos (#ruta) y se apoya en mdAHtml de markdown.js.
 */
function renderMarkdown(md) {
  if (!md) return '';
  const enlacesSeguros = [];
  const codigosInline = [];

  // 1. Extraer únicamente código inline y enlaces internos seguros (#[a-zA-Z0-9_/-]+)
  // usando marcadores sin guiones bajos para no colisionar con cursivas en markdown.js
  let textoPrep = String(md).replace(/`([^`\n]+)`/g, (_m, code) => {
    const idx = codigosInline.length;
    codigosInline.push(`<code>${escaparHtml(code)}</code>`);
    return `%%COACHCODE${idx}%%`;
  });

  textoPrep = textoPrep.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, destino) => {
    const limpio = String(destino || '').trim();
    if (/^#[a-zA-Z0-9_\/-]+$/.test(limpio)) {
      const idx = enlacesSeguros.length;
      enlacesSeguros.push(`<a href="${escaparHtml(limpio)}" class="coach-link">${escaparHtml(label)}</a>`);
      return `%%COACHLINK${idx}%%`;
    }
    // Si el destino contiene comillas, atributos o esquemas externos, se neutraliza como texto plano
    return `${label} (${limpio})`;
  });

  let html = '';
  try {
    if (typeof mdAHtml === 'function') {
      html = mdAHtml(textoPrep);
    }
  } catch (_) {
    html = '';
  }

  if (!html) {
    const esc = escaparHtml(textoPrep);
    html = esc
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^\*])\*([^\*\n]+?)\*/g, '$1<em>$2</em>')
      .replace(/\n/g, '<br>');
  }

  // 2. Restaurar enlaces internos validados y código inline ya escapados
  html = html.replace(/%%COACHLINK(\d+)%%/g, (_m, idx) => enlacesSeguros[Number(idx)] || '');
  html = html.replace(/%%COACHCODE(\d+)%%/g, (_m, idx) => codigosInline[Number(idx)] || '');
  return html;
}

function similitud(a, b) {
  const m = a.length, n = b.length;
  if (!m || !n) return 0;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return 1 - dp[m][n] / Math.max(m, n);
}

function encontrarEjercicio(termino, lista) {
  if (!termino || !lista?.length) return null;
  try {
    if (typeof buscarEjercicio === 'function') {
      const res = buscarEjercicio(termino, lista);
      if (res?.[0] && (res[0].puntaje > 0.6 || res[0].score > 0.6)) {
        const h = lista.find(e => e.id === res[0].id);
        if (h) return h;
      }
    }
  } catch (_) {}

  const norm = normalizar(termino).replace(/^(el|la|los|las|un|una|del|al|en|de|para|con)\s+/, '').trim();
  for (const ej of lista) {
    const nombres = [ej.id, ej.nombre, ej.nombre_en, ...(ej.alias || [])].filter(Boolean).map(normalizar);
    if (nombres.includes(norm)) return ej;
  }
  const inc = [];
  for (const ej of lista) {
    const nombres = [ej.nombre, ...(ej.alias || []), ej.id.replace(/_/g, ' ')].filter(Boolean).map(normalizar);
    for (const n of nombres) {
      if (n.length >= 3 && (norm.includes(n) || n.includes(norm))) inc.push({ ej, len: n.length });
    }
  }
  if (inc.length) return inc.sort((a, b) => b.len - a.len)[0].ej;

  let mejor = null, maxSim = 0;
  for (const ej of lista) {
    for (const n of [ej.nombre, ...(ej.alias || [])].map(normalizar)) {
      const s = similitud(norm, n);
      if (s > 0.68 && s > maxSim) { maxSim = s; mejor = ej; }
    }
  }
  return mejor;
}

function esErrorMemoria(err) {
  if (!err) return false;
  const msg = (err.message || String(err)).toLowerCase();
  return ['memory', 'oom', 'allocation', 'buffer', 'device lost', 'out of', 'exceeded', 'quota', 'insufficient'].some(k => msg.includes(k));
}

/**
 * CFG-01: Normaliza y sincroniza el modelo del ajuste 'ia' con config.WEBLLM_MODELO
 * y config.WEBLLM_MODELO_RESPALDO evitando que valores obsoletos desincronicen el Coach.
 */
function normalizarModeloConfig(modeloCandidato) {
  const modeloPrincipal = config.WEBLLM_MODELO || 'Qwen3.5-2B-q4f16_1-MLC';
  const modeloRespaldo = config.WEBLLM_MODELO_RESPALDO || 'Qwen3.5-0.8B-q4f16_1-MLC';
  if (!modeloCandidato || typeof modeloCandidato !== 'string') return modeloPrincipal;
  if (modeloCandidato === modeloPrincipal || modeloCandidato === modeloRespaldo) return modeloCandidato;
  if (modeloCandidato.includes('0.5B') || modeloCandidato.includes('0.8B')) return modeloRespaldo;
  if (modeloCandidato.includes('1.5B') || modeloCandidato.includes('2B')) return modeloPrincipal;
  return modeloCandidato;
}

async function obtenerAjusteIASincronizado() {
  const modeloPrincipal = config.WEBLLM_MODELO || 'Qwen3.5-2B-q4f16_1-MLC';
  const aj = await db.ajuste('ia', { activa: false, modelo: modeloPrincipal });
  const modeloSinc = normalizarModeloConfig(aj?.modelo);
  // 7-nov: el modelo 2B trababa el celular de Sergio → quien lo tenía queda con la IA APAGADA y el modelo liviano.
  const veniaDel2B = typeof aj?.modelo === 'string' && /\b2B\b|1\.5B/.test(aj.modelo);
  const estado = { activa: veniaDel2B ? false : Boolean(aj?.activa), modelo: modeloSinc };
  if (aj && aj.modelo !== modeloSinc) {
    try { await db.ponerAjuste('ia', estado); } catch (_) {}
  }
  return estado;
}

function renderIcono(nombre, attrs = {}) {
  try {
    if (typeof icono === 'function') {
      const res = icono(nombre, attrs);
      if (res instanceof Node) return res;
      if (typeof res === 'string' && res.trim().startsWith('<svg')) {
        const wrap = document.createElement('span');
        wrap.className = 'coach-icono ' + (attrs.class || '');
        wrap.innerHTML = res;
        return wrap;
      }
      if (typeof res === 'string' && res.trim()) {
        const wrap = document.createElement('span');
        wrap.className = 'coach-icono ' + (attrs.class || '');
        wrap.textContent = res;
        return wrap;
      }
    }
  } catch (_) {}

  // Fallback SVG trazo 1.75px según dirección de arte Forja v2
  const span = document.createElement('span');
  span.className = 'coach-icono ' + (attrs.class || '');
  span.style.display = 'inline-flex';
  span.style.alignItems = 'center';
  span.style.justifyContent = 'center';
  if (nombre === 'basura' || nombre === 'limpiar' || nombre === 'borrar') {
    span.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>';
  } else if (nombre === 'enviar') {
    span.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>';
  }
  return span;
}

// ============================================================================
// 2. CLASIFICADOR DE INTENCIONES POR REGLAS
// ============================================================================

export function clasificarPregunta(texto) {
  const n = normalizar(texto);
  if (!n) return null;

  // 0. «¿sabes quién soy?» / «¿cómo me llamo?» / «¿qué sabes de mí?» (7-nov: antes caía en la IA)
  if (/\b(quien soy|sabes quien soy|como me llamo|mi nombre|que sabes de mi|me conoces|sabes algo de mi|mis datos)\b/.test(n)) {
    return { tipo: 'QUIEN_SOY' };
  }

  // 1. «¿cómo voy?» y variantes
  if (
    /^(como voy|resumen|progreso|reporte|estado)\b/.test(n) ||
    /\b(como voy|como vamos|que tal voy|como va todo|como va mi semana|como va el entreno|como va mi progreso|resumen semanal|reporte semanal)\b/.test(n)
  ) {
    return { tipo: 'COMO_VOY' };
  }

  // 2. «¿cuánta proteína llevo?» y variantes
  if (
    (/\b(proteina|prote)\b/.test(n) && (/\b(llevo|hoy|cuant|gramos|meta|falta|comido|consumo|total|voy)\b/.test(n) || n === 'proteina' || n === 'prote' || n === 'proteina hoy')) ||
    /^cuant[ao]s?\s+gramos\s+(?:de\s+)?prote/.test(n)
  ) {
    return { tipo: 'PROTEINA_LLEVO' };
  }

  // 3. «¿qué me toca hoy?» y variantes
  if (
    /\b(que (me )?toca|que entreno|que hago|rutina|plan|entrenamiento|toca (entrenar|gym))\b/.test(n) &&
    !/\b(paso|tecnica|hace|como)\b/.test(n)
  ) {
    return { tipo: 'QUE_TOCA_HOY' };
  }

  // 4. Preguntas de peso corporal y medidas (COA-NEW-02: interceptar antes de PESO_USO)
  if (
    /^(mi peso|peso|peso actual|peso corporal|cintura|mi cintura|mis medidas|medidas|grasa|mi grasa)\b/.test(n) ||
    /\b(mi peso|peso actual|peso corporal|cuanto peso|cuanto estoy pesando|pesando actualmente|que peso tengo|cuanto peso tengo)\b/.test(n) ||
    /\b(cuanto he (bajado|subido|perdido)|cuanto (baje|subi|perdi)|he (bajado|subido|perdido)|kilos (menos|mas|bajados|perdidos)|peso (perdido|ganado|bajado|subido))\b/.test(n) ||
    /\b(mi cintura|cintura actual|medida de cintura|cuanto mide mi cintura|cuanto tengo de cintura)\b/.test(n) ||
    /\b(mis medidas|medidas corporales|mis medidas actuales|como van mis medidas|registro de medidas)\b/.test(n) ||
    /\b(mi grasa|grasa corporal|porcentaje de grasa|grasa navy)\b/.test(n)
  ) {
    if (/\b(cintura)\b/.test(n)) return { tipo: 'MEDIDAS_CORPORALES', subtipo: 'cintura' };
    if (/\b(grasa)\b/.test(n)) return { tipo: 'MEDIDAS_CORPORALES', subtipo: 'grasa' };
    if (/\b(medidas)\b/.test(n)) return { tipo: 'MEDIDAS_CORPORALES', subtipo: 'general' };
    return { tipo: 'MEDIDAS_CORPORALES', subtipo: 'peso' };
  }

  // 5. «¿qué peso uso en X?» y variantes
  let m = n.match(/(?:que|cuanto|cual)\s+peso\s+(?:uso|pongo|meto|toca|hago|debo\s+usar)?\s*(?:en|para|a|de)?\s*(.+)/) ||
          n.match(/(?:cuanto\s+le\s+(?:meto|pongo|tiro|subo)\s+(?:a|en)?\s*|peso\s+sugerido\s+(?:en|para|de)?\s*|con\s+cuanto\s+(?:peso\s+)?hago\s*|peso\s+(?:en|para|de)\s*)(.+)/) ||
          n.match(/(?:que\s+peso\s+(?:le\s+)?(?:pongo|meto|uso|tiro)\s*(?:a|en|para)?\s*)(.+)/);
  if (m) {
    const term = m[1].trim();
    if (!/\b(actual|corporal|corporales|hoy|ayer|semana|meta|perdi|subi|baje|bajado|subido|perdido|cuerpo|cintura|grasa|tengo)\b/.test(term)) {
      return { tipo: 'PESO_USO', termino: term };
    }
  }

  // 6. «¿cuándo fue la última vez que hice X?» y variantes
  m = n.match(/(?:cuando\s+fue\s+(?:la\s+)?ultima\s+vez\s+(?:que\s+hice|que\s+entrene|que\s+hago|de)?\s*|ultima\s+vez\s+(?:que\s+hice|que\s+entrene|de)?\s*|cuando\s+(?:hice|entrene)\s*|ultimo\s+entreno\s+de\s*)(.+)/);
  if (m) return { tipo: 'ULTIMA_VEZ', termino: m[1].trim() };

  // 7. «¿cómo se hace X?» y variantes
  m = n.match(/(?:como\s+(?:se\s+hace|hago|hacer|ejecuto|ejecutar|realizar|se\s+realiza|es\s+la\s+tecnica|es)|tecnica\s+de|pasos\s+de|claves\s+de|instrucciones\s+(?:para|de)|guia\s+de)\s*(.+)/);
  if (m) return { tipo: 'COMO_SE_HACE', termino: m[1].trim() };

  // Reconocimiento flexible por palabras clave (COA-NEW-02: solo para ejercicios si no se refieren a medidas corporales)
  if (/\b(peso|kilos|kg)\b/.test(n)) {
    const term = n.replace(/\b(que|cual|cuanto|le|debo|usar|uso|pongo|meto|hago|peso|kilos|kg|en|para|a|de|con)\b/g, ' ').replace(/\s+/g, ' ').trim();
    if (term && term.length >= 3 && !/\b(actual|corporal|corporales|hoy|ayer|semana|meta|perdi|subi|baje|bajado|subido|perdido|cuerpo|cintura|grasa|tengo)\b/.test(term)) {
      return { tipo: 'PESO_USO', termino: term };
    }
  }
  if (/\b(tecnica|forma|ejecucion|pasos|claves)\b/.test(n)) {
    const term = n.replace(/\b(tecnica|forma|ejecucion|pasos|claves|como|se|hace|hacer|de|del|en|para|la|el|los|las)\b/g, ' ').replace(/\s+/g, ' ').trim();
    if (term) return { tipo: 'COMO_SE_HACE', termino: term };
  }
  if (/\b(ultima|ultimo)\b/.test(n)) {
    const term = n.replace(/\b(cuando|fue|la|ultima|ultimo|vez|que|hice|entrene|de|del|en|dia|entreno)\b/g, ' ').replace(/\s+/g, ' ').trim();
    if (term) return { tipo: 'ULTIMA_VEZ', termino: term };
  }

  return null;
}

// ============================================================================
// 3. RESPUESTAS POR REGLAS (CÁLCULOS DETERMINÍSTICOS SIN EMOJIS)
// ============================================================================

/** «¿Sabes quién soy?»: responde con el perfil y el resumen de lo registrado (sin IA). */
async function responderQuienSoy() {
  const p = await datos.perfil();
  const series = await db.todos('series');
  const medidas = (await db.todos('medidas')).filter(m => m.peso).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const dias = [...new Set(series.map(s => s.fecha))].sort();
  const r = await datos.rutina();
  const diasRutina = Object.keys(r?.dias || {});
  const partes = [];
  partes.push(p?.nombre ? `¡Claro, ${p.nombre}! Esto es lo que sé de ti (todo guardado solo en este teléfono):` :
    'Todavía no me dijiste tu nombre (ponlo en Ajustes). Esto es lo que sé:');
  if (p?.estaturaCm) partes.push(`- Estatura: ${p.estaturaCm} cm.`);
  if (medidas.length) partes.push(`- Último peso: ${medidas[medidas.length - 1].peso} kg (${ui.fechaBonita(medidas[medidas.length - 1].fecha)}).`);
  if (p?.metaNombre) partes.push(`- Meta: ${p.metaNombre}${p.metaFecha ? ` (${ui.fechaBonita(p.metaFecha)})` : ' (sin fecha todavía; ponla en Ajustes)'}.`);
  if (p?.metaMes) partes.push(`- Meta del mes: ${p.metaMes}.`);
  partes.push(`- Metas diarias: ${p?.kcal || 2200} kcal y ${p?.proteina || 128} g de proteína.`);
  if (diasRutina.length) partes.push(`- Tu rutina: ${diasRutina.join(', ')}.`);
  partes.push(dias.length ? `- Llevas ${series.length} series en ${dias.length} días de entrenamiento (desde ${ui.fechaBonita(dias[0])}).`
    : '- Aún no hay series registradas.');
  partes.push('\nPregúntame «¿cómo voy?», «¿qué me toca hoy?» o «¿qué peso uso en el jalón?».');
  return partes.join('\n');
}

async function responderComoVoy() {
  const [perfil, series, sesiones, medidas, comidas, ejs, rut] = await Promise.all([
    datos.perfil(), db.todos('series'), db.todos('sesiones'), db.todos('medidas'), db.todos('comidas'), datos.ejercicios(), datos.rutina()
  ]);
  const hoyISO = ui.hoyISO(), lunesISO = lunesSemanaISO();
  const d7 = new Date(); d7.setDate(d7.getDate() - 7);
  const hace7DiasISO = fechaLocalISO(d7);

  // 1. Días para la meta
  let txtMeta = '**Días para la meta**: No has configurado fecha en Ajustes.';
  if (perfil?.metaFecha) {
    const diff = Math.ceil((new Date(perfil.metaFecha + 'T00:00:00') - new Date(hoyISO + 'T00:00:00')) / 86400000);
    txtMeta = diff >= 0
      ? `**Días para la meta**: Faltan **${diff} días** para ${perfil.metaNombre || 'tu meta'} (${ui.fechaBonita(perfil.metaFecha)}).`
      : `**Días para la meta**: ¡Meta alcanzada! (${perfil.metaNombre || 'tu meta'}, ${ui.fechaBonita(perfil.metaFecha)}).`;
  }
  if (perfil?.metaMes) txtMeta += `\n**Meta del mes**: "${perfil.metaMes}"`;

  // 2. Sesiones de la semana
  const sesSem = sesiones.filter(s => s.fecha >= lunesISO && s.fecha <= hoyISO);
  const diasSeries = new Set(series.filter(s => s.fecha >= lunesISO && s.fecha <= hoyISO).map(s => s.fecha));
  const numSes = Math.max(sesSem.length, diasSeries.size);
  const diasProg = Object.keys(rut?.dias || {}).length || 4;
  const txtSes = `**Sesiones de la semana**: **${numSes}** hechas (de ${diasProg} programadas).`;

  // 3. Series por músculo vs meta
  const sMusc = calculos.seriesPorMusculo(series, ejs, lunesISO);
  const metaMin = config.SERIES_META?.min ?? 10, metaMax = config.SERIES_META?.max ?? 20;
  const entriesM = Object.entries(sMusc);
  let txtMusc = '**Series duras esta semana** (meta: 10-20):\n';
  txtMusc += entriesM.length === 0
    ? '• Aún no tienes series duras registradas esta semana.'
    : entriesM.map(([m, c]) => `• ${m}: **${c}** series (${c < metaMin ? `faltan ${metaMin - c}` : c <= metaMax ? 'óptimo' : 'alto'})`).join('\n');

  // 4. PR nuevos
  const prs = calculos.prs(series);
  const prsRec = Object.entries(prs).filter(([_, p]) => p?.fecha && p.fecha >= hace7DiasISO).map(([id, p]) => {
    const ej = ejs.find(e => e.id === id);
    const info1RM = p.unoRM > 0 ? ` (1RM est. ${Math.round(p.unoRM)} kg)` : '';
    return `• **${ej?.nombre || id}**: ${ui.formatoKg(p.kg, p.porLado, p.unidad)} x ${p.reps} reps${info1RM} el ${ui.fechaBonita(p.fecha)}`;
  });
  const txtPR = prsRec.length ? `**Récords nuevos (últimos 7 días)**:\n${prsRec.join('\n')}` : '**Récords personales**: Sin récords nuevos en los últimos 7 días. Consistencia.';

  // 5. Tendencias peso y cintura (COA-01: ordenar medidas por fecha ascendente antes de calcular)
  const medidasOrdenadas = [...medidas].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
  const vPeso = medidasOrdenadas.filter(m => m.peso != null).map(m => ({ fecha: m.fecha, valor: Number(m.peso) }));
  const vCint = medidasOrdenadas.filter(m => m.cintura != null).map(m => ({ fecha: m.fecha, valor: Number(m.cintura) }));
  const tPeso = calculos.tendenciaSemanal(vPeso), tCint = calculos.tendenciaSemanal(vCint);
  const ultP = vPeso[vPeso.length - 1], ultC = vCint[vCint.length - 1];
  let txtTend = '**Tendencias corporales**:\n';
  txtTend += ultP ? `• Peso: **${ultP.valor} kg** ${tPeso !== null ? `(${tPeso > 0 ? '+' : ''}${tPeso.toFixed(2)} kg/sem)` : ''}\n` : '• Peso: sin registros\n';
  txtTend += ultC ? `• Cintura: **${ultC.valor} cm** ${tCint !== null ? `(${tCint > 0 ? '+' : ''}${tCint.toFixed(2)} cm/sem)` : ''}` : '• Cintura: sin registros';

  // 6. Proteína promedio
  const comSem = comidas.filter(c => c.fecha >= hace7DiasISO && c.fecha <= hoyISO);
  const pDia = {};
  for (const c of comSem) pDia[c.fecha] = (pDia[c.fecha] || 0) + (Number(c.proteina) || 0);
  const nDias = Object.keys(pDia).length;
  const promProt = nDias ? Math.round(Object.values(pDia).reduce((a, b) => a + b, 0) / nDias) : 0;
  const metaProt = perfil?.proteina || 128;
  const txtProt = `**Proteína promedio (últimos 7 días)**: **${promProt} g/día** (meta: ${metaProt} g/día)`;

  return `**Resumen de tu progreso**:\n\n${txtMeta}\n\n${txtSes}\n\n${txtMusc}\n\n${txtPR}\n\n${txtTend}\n\n${txtProt}`;
}

async function responderPesoUso(termino) {
  const ejs = await datos.ejercicios();
  const ej = encontrarEjercicio(termino, ejs);
  if (!ej) return '¿En qué ejercicio quieres saber el peso sugerido? Ej: *«¿Qué peso uso en Jalón al pecho?»* o *«¿Qué peso uso en Sentadilla?»*.';

  const series = await db.filtrar('series', s => s.ejercicioId === ej.id);
  if (!series.length) {
    return `Aún no registras series de **${ej.nombre}**.\n\n**Sugerencia de partida**:\n• Comienza liviano para probar técnica y deja 2-3 RIR.\n• Rango recomendado: **${ej.series_reps_hipertrofia || '8-12 reps'}**.\n• Descanso: **${ej.descanso_seg ? ej.descanso_seg + ' s' : '90-120 s'}**.\n• RIR: **${ej.rir_recomendado ?? '1-2'}**.`;
  }
  series.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || ((b.hora || 0) - (a.hora || 0)));
  const ultFecha = series[0].fecha;
  // COA-02: ordenar las series de la última sesión cronológicamente (ascendente por hora)
  const ultSeries = series
    .filter(s => s.fecha === ultFecha)
    .sort((a, b) => (a.hora || 0) - (b.hora || 0));
  const sug = calculos.pesoSugerido(ultSeries, ej);
  const det = ultSeries.map((s, i) => `• Serie ${i + 1}: ${ui.formatoKg(s.kg, s.porLado, s.unidad)} x ${s.reps} reps${s.fallo ? ' [fallo]' : s.rir != null ? ` [RIR ${s.rir}]` : ''}`).join('\n');
  const pTxt = sug?.kg !== undefined ? ui.formatoKg(sug.kg, sug.porLado, sug.unidad) : 'Mismo peso previo';

  return `**Peso sugerido para ${ej.nombre}**:\n\n**Última sesión (${ui.fechaBonita(ultFecha)})**:\n${det}\n\n**Recomendación para hoy (Doble Progresión)**:\n• **Peso sugerido**: **${pTxt}**\n• **Reps objetivo**: **${sug.reps || ej.series_reps_hipertrofia || 'Mantener rango'}**\n• **Motivo**: ${sug.motivo || 'Doble progresión estándar.'}`;
}

async function responderProteinaLlevo() {
  const hoy = ui.hoyISO();
  const [comidas, perfil] = await Promise.all([db.filtrar('comidas', c => c.fecha === hoy), datos.perfil()]);
  const meta = Number(perfil?.proteina) || 128;
  const totProt = comidas.reduce((a, c) => a + (Number(c.proteina) || 0), 0);
  const totKcal = comidas.reduce((a, c) => a + (Number(c.kcal) || 0), 0);
  const falta = meta - totProt;

  let txt = `**Proteína de hoy (${ui.fechaBonita(hoy)})**:\n\nLlevas **${Math.round(totProt)} g** de tu meta de **${meta} g**.\n`;
  txt += falta > 0 ? `Te faltan **${Math.round(falta)} g** para cumplir tu meta.` : `¡Meta cumplida! Has alcanzado ${Math.round(totProt)} g (+${Math.round(-falta)} g sobre la meta).`;
  if (totKcal > 0) txt += `\nCalorías registradas: **${Math.round(totKcal)} kcal**.`;
  if (comidas.length) {
    txt += `\n\n**Comidas registradas hoy (${comidas.length})**:\n` + comidas.map((c, i) => `• ${c.texto || 'Comida ' + (i + 1)}: ${Math.round(c.proteina || 0)} g prot (${Math.round(c.kcal || 0)} kcal)`).join('\n');
  } else {
    txt += `\n\nAún no has registrado comidas hoy. Puedes anotarlas en la pestaña **Comida**.`;
  }
  return txt;
}

async function responderQueTocaHoy() {
  const dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const diaSem = dias[new Date().getDay()];
  const [rut, ejs, perfil] = await Promise.all([datos.rutina(), datos.ejercicios(), datos.perfil()]);
  const cfg = rut?.dias?.[diaSem];
  const diaNom = diaSem.charAt(0).toUpperCase() + diaSem.slice(1);
  const metaProt = perfil?.proteina || 128;

  if (!cfg?.ejercicios?.length) {
    return `Hoy **${diaNom}** es día de **descanso** según tu rutina.\n\nAprovecha para recuperar, cumplir tus ${metaProt} g de proteína y descansar bien. Puedes ver o cambiar tu rutina en Ajustes.`;
  }

  let txt = `**Hoy (${diaNom}) te toca: ${cfg.nombre}**\n\nEjercicios programados:\n`;
  for (const item of cfg.ejercicios) {
    const ej = ejs.find(e => e.id === item.id) || await datos.ejercicio(item.id);
    const seriesEj = await db.filtrar('series', s => s.ejercicioId === item.id);
    let sugTxt = '';
    if (seriesEj.length && ej) {
      seriesEj.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || ((b.hora || 0) - (a.hora || 0)));
      const ultFecha = seriesEj[0].fecha;
      // COA-02: ordenar las series de la última sesión en orden ascendente por hora
      const ultS = seriesEj
        .filter(s => s.fecha === ultFecha)
        .sort((a, b) => (a.hora || 0) - (b.hora || 0));
      const sug = calculos.pesoSugerido(ultS, ej);
      if (sug?.kg !== undefined) sugTxt = ` → Sugerido: **${ui.formatoKg(sug.kg, sug.porLado, sug.unidad)}**`;
    }
    txt += `• **${ej?.nombre || item.id}**: ${item.series} series de ${item.reps} reps${sugTxt}\n`;
  }
  txt += `\n**Reglas del coach**:\n• Fallo solo en la última serie y solo en máquina o polea.\n• En peso libre deja 1-2 RIR.\n• Descanso: ~2 min en compuestos y 1-1.5 min en aislamiento.`;
  return txt;
}

/**
 * COA-NEW-01: Búsqueda de última vez por grupo muscular (pecho, espalda, pierna, etc.)
 * Mapea nombres coloquiales a la terminología anatómica utilizada en data/ejercicios.json
 * y compara mediante inclusión sobre musculos_principales, musculos_secundarios y temas.
 */
async function responderUltimaVez(termino) {
  const ejs = await datos.ejercicios();
  const musculos = [
    'piernas', 'pierna', 'cuadriceps', 'isquios', 'femoral', 'gluteo', 'gemelos',
    'hombros', 'hombro', 'espalda', 'pecho', 'biceps', 'triceps', 'abdomen',
    'brazos', 'brazo', 'torso'
  ];
  const norm = normalizar(termino);
  const esMusc = musculos.find(m => norm.includes(m));

  if (esMusc) {
    const MAPA_GRUPOS = {
      pecho: ['pectoral', 'pecho'],
      espalda: ['dorsal', 'dorsal ancho', 'romboides', 'trapecio', 'espalda'],
      pierna: ['cuadriceps', 'femoral', 'isquio', 'gluteo', 'gemelo', 'pantorrilla', 'pierna'],
      piernas: ['cuadriceps', 'femoral', 'isquio', 'gluteo', 'gemelo', 'pantorrilla', 'pierna'],
      hombro: ['deltoides', 'hombro'],
      hombros: ['deltoides', 'hombro'],
      biceps: ['biceps', 'braquial'],
      triceps: ['triceps'],
      cuadriceps: ['cuadriceps'],
      isquios: ['isquio', 'femoral'],
      femoral: ['femoral', 'isquio'],
      gluteo: ['gluteo'],
      gemelos: ['gemelo', 'pantorrilla', 'gastrocnemio', 'soleo'],
      abdomen: ['abdomen', 'core', 'abdominal'],
      brazo: ['biceps', 'triceps', 'braquial', 'antebrazo'],
      brazos: ['biceps', 'triceps', 'braquial', 'antebrazo'],
      torso: ['pectoral', 'pecho', 'dorsal', 'romboides', 'trapecio', 'deltoides']
    };

    const terminosBusqueda = MAPA_GRUPOS[esMusc] || [esMusc];
    const ejsM = ejs.filter(e => {
      const muscList = [
        ...(e.musculos_principales || []),
        ...(e.musculos_secundarios || []),
        ...(e.temas || [])
      ].map(normalizar);
      return muscList.some(m => terminosBusqueda.some(t => m.includes(t)));
    });

    const ids = new Set(ejsM.map(e => e.id));
    const series = await db.filtrar('series', s => ids.has(s.ejercicioId));
    if (!series.length) return `Aún no tienes entrenamientos registrados para **${esMusc}**.`;
    series.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || ((b.hora || 0) - (a.hora || 0)));
    const ultFecha = series[0].fecha;
    const dias = Math.floor((new Date(ui.hoyISO() + 'T00:00:00') - new Date(ultFecha + 'T00:00:00')) / 86400000);
    const seriesUltFecha = series
      .filter(s => s.fecha === ultFecha)
      .sort((a, b) => (a.hora || 0) - (b.hora || 0));
    const nomEj = [...new Set(seriesUltFecha.map(s => ejs.find(e => e.id === s.ejercicioId)?.nombre || s.ejercicioId))];
    return `La última vez que entrenaste **${esMusc}** fue el **${ui.fechaBonita(ultFecha)}** (${dias === 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días`}).\n\nEjercicios realizados:\n• ` + nomEj.join('\n• ');
  }

  const ej = encontrarEjercicio(termino, ejs);
  if (!ej) return '¿De qué ejercicio quieres consultar la última vez? Ej: *«¿Cuándo fue la última vez que hice dominadas?»*.';
  const series = await db.filtrar('series', s => s.ejercicioId === ej.id);
  if (!series.length) return `No tengo registros de **${ej.nombre}** en tu historial todavía.`;

  series.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || ((b.hora || 0) - (a.hora || 0)));
  const ultFecha = series[0].fecha;
  // COA-02: ordenar las series de la última sesión en orden ascendente por hora
  const ultSeries = series
    .filter(s => s.fecha === ultFecha)
    .sort((a, b) => (a.hora || 0) - (b.hora || 0));
  const dias = Math.floor((new Date(ui.hoyISO() + 'T00:00:00') - new Date(ultFecha + 'T00:00:00')) / 86400000);
  const det = ultSeries.map((s, i) => `• Serie ${i + 1}: ${ui.formatoKg(s.kg, s.porLado, s.unidad)} x ${s.reps} reps${s.fallo ? ' [fallo]' : s.rir != null ? ` [RIR ${s.rir}]` : ''}`).join('\n');
  const notaSesion = ultSeries.find(s => s.nota)?.nota;
  return `La última vez que hiciste **${ej.nombre}** fue el **${ui.fechaBonita(ultFecha)}** (${dias === 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días`}).\n\nDetalle de esa sesión:\n${det}${notaSesion ? `\n\nNota: "${notaSesion}"` : ''}`;
}

async function responderComoSeHace(termino) {
  const ejs = await datos.ejercicios();
  const ej = encontrarEjercicio(termino, ejs);
  if (!ej) return '¿Sobre qué ejercicio quieres ver la técnica? Ej: *«¿Cómo se hace jalón al pecho?»* o *«Técnica de sentadilla»*.';

  let txt = `**Técnica: ${ej.nombre}**${ej.nombre_en ? ` *(${ej.nombre_en})*` : ''}\n\n`;
  if (ej.musculos_principales?.length) txt += `**Principales**: ${ej.musculos_principales.join(', ')}\n`;
  if (ej.musculos_secundarios?.length) txt += `**Secundarios**: ${ej.musculos_secundarios.join(', ')}\n`;
  if (ej.pasos?.length) txt += `\n**Paso a paso**:\n` + ej.pasos.map((p, i) => `${i + 1}. ${p}`).join('\n');
  if (ej.claves_tecnica?.length) txt += `\n\n**Claves de técnica**:\n` + ej.claves_tecnica.map(c => `• ${c}`).join('\n');
  if (ej.errores_comunes?.length) txt += `\n\n**Errores comunes a evitar**:\n` + ej.errores_comunes.map(e => `• ${e}`).join('\n');
  if (ej.respiracion) txt += `\n\n**Respiración**: ${ej.respiracion}`;
  if (ej.tempo) txt += `\n**Tempo**: ${ej.tempo}`;
  if (ej.descanso_seg) txt += `\n**Descanso sugerido**: ${ej.descanso_seg} s`;
  if (ej.rir_recomendado !== undefined && ej.rir_recomendado !== null) txt += `\n**RIR recomendado**: ${ej.rir_recomendado}`;
  if (ej.alternativas?.length) txt += `\n**Alternativas**: ${ej.alternativas.join(', ')}`;
  txt += `\n\n*[Ver ficha completa en Guía](#guia/${ej.id})*`;
  return txt;
}

/**
 * COA-NEW-02: Responde consultas de peso corporal, baja/subida de peso y medidas
 * evitando que sean tratadas erróneamente como pedidos de peso para ejercicios.
 */
async function responderMedidas(subtipo = 'peso') {
  const [medidas, perfil] = await Promise.all([
    db.todos('medidas'),
    datos.perfil()
  ]);

  if (!medidas?.length) {
    return 'Aún no has registrado medidas corporales en la pestaña **Cuerpo**.\n\nPuedes anotar allí tu peso en ayunas, cintura, cuello y otras medidas para ver tu evolución y tendencias.';
  }

  const medidasOrdenadas = [...medidas].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
  const vPeso = medidasOrdenadas.filter(m => m.peso != null).map(m => ({ fecha: m.fecha, valor: Number(m.peso) }));
  const vCint = medidasOrdenadas.filter(m => m.cintura != null).map(m => ({ fecha: m.fecha, valor: Number(m.cintura) }));
  const ultMedida = medidasOrdenadas[medidasOrdenadas.length - 1];
  const ultP = vPeso[vPeso.length - 1];
  const primP = vPeso[0];
  const ultC = vCint[vCint.length - 1];
  const primC = vCint[0];
  const tPeso = calculos.tendenciaSemanal(vPeso);
  const tCint = calculos.tendenciaSemanal(vCint);

  if (subtipo === 'cintura') {
    if (!ultC) {
      return 'Aún no tienes registros de **cintura** en la pestaña **Cuerpo**.\n\nMide tu cintura a la altura del ombligo en ayunas para estimar tu progreso y % de grasa.';
    }
    let txt = `**Medida de cintura**:\n\n• **Cintura actual**: **${ultC.valor} cm** (${ui.fechaBonita(ultC.fecha)})\n`;
    if (vCint.length > 1 && primC) {
      const diffCint = ultC.valor - primC.valor;
      if (Math.abs(diffCint) < 0.1) {
        txt += `• **Cambio total**: Mantienes tu cintura inicial de **${primC.valor} cm** (${ui.fechaBonita(primC.fecha)}).\n`;
      } else if (diffCint < 0) {
        txt += `• **Cambio total**: Has reducido **${Math.abs(diffCint).toFixed(1)} cm** de cintura desde tu primer registro (${primC.valor} cm el ${ui.fechaBonita(primC.fecha)}).\n`;
      } else {
        txt += `• **Cambio total**: Tu cintura aumentó **${diffCint.toFixed(1)} cm** desde tu primer registro (${primC.valor} cm el ${ui.fechaBonita(primC.fecha)}).\n`;
      }
    }
    if (tCint !== null) {
      txt += `• **Tendencia reciente**: **${tCint > 0 ? '+' : ''}${tCint.toFixed(2)} cm/semana**.\n`;
    }
    if (ultP) {
      txt += `\n*Peso corporal actual: **${ultP.valor} kg** (${ui.fechaBonita(ultP.fecha)})*`;
    }
    return txt;
  }

  if (subtipo === 'general') {
    let txt = `**Tus medidas corporales (${ui.fechaBonita(ultMedida.fecha)})**:\n\n`;
    txt += ultP ? `• **Peso**: **${ultP.valor} kg**\n` : '';
    txt += ultC ? `• **Cintura**: **${ultC.valor} cm**\n` : '';
    if (ultMedida.cuello) txt += `• **Cuello**: **${ultMedida.cuello} cm**\n`;
    if (ultMedida.pecho) txt += `• **Pecho**: **${ultMedida.pecho} cm**\n`;
    if (ultMedida.brazo) txt += `• **Brazo**: **${ultMedida.brazo} cm**\n`;
    if (ultMedida.hombros) txt += `• **Hombros**: **${ultMedida.hombros} cm**\n`;
    if (ultMedida.cadera) txt += `• **Cadera**: **${ultMedida.cadera} cm**\n`;
    if (ultMedida.grasaNavy) txt += `• **% Grasa (Navy)**: **${ultMedida.grasaNavy}%**\n`;

    if (vPeso.length > 1 && primP && ultP) {
      const diffP = ultP.valor - primP.valor;
      txt += `\n**Evolución de peso**: ${diffP < 0 ? `Has bajado **${Math.abs(diffP).toFixed(1)} kg**` : diffP > 0 ? `Has subido **${diffP.toFixed(1)} kg**` : 'Peso estable'} (${primP.valor} kg → ${ultP.valor} kg).`;
      if (tPeso !== null) txt += `\nTendencia: **${tPeso > 0 ? '+' : ''}${tPeso.toFixed(2)} kg/semana**.`;
    }
    return txt;
  }

  if (subtipo === 'grasa') {
    let grasa = ultMedida.grasaNavy;
    if (!grasa && ultC && ultMedida.cuello && perfil?.estaturaCm) {
      grasa = calculos.grasaNavy(ultC.valor, Number(ultMedida.cuello), Number(perfil.estaturaCm));
    }
    if (grasa) {
      return `**Grasa corporal estimada (Fórmula de la Marina)**:\n\n• **% de grasa**: **${typeof grasa === 'number' ? grasa.toFixed(1) : grasa}%**\n• **Cintura**: ${ultC ? `${ultC.valor} cm` : 'N/D'}\n• **Cuello**: ${ultMedida.cuello ? `${ultMedida.cuello} cm` : 'N/D'}\n• **Estatura**: ${perfil?.estaturaCm ? `${perfil.estaturaCm} cm` : 'N/D'}\n\n*Nota: La fórmula de la Marina de EE. UU. es una estimación aproximada con un margen de error típico de ±3-4%.*`;
    }
    return `Para calcular tu % de grasa con la fórmula de la Marina se necesita registrar **cintura** y **cuello** en la pestaña **Cuerpo**, y tu **estatura** en Ajustes.`;
  }

  // subtipo === 'peso' (por defecto)
  if (!ultP) {
    return 'Aún no has registrado tu **peso corporal** en la pestaña **Cuerpo**.\n\nPuedes pesarte en ayunas y anotarlo allí para seguir tu evolución.';
  }

  let txt = `**Tu peso corporal**:\n\n• **Peso actual**: **${ultP.valor} kg** (${ui.fechaBonita(ultP.fecha)})\n`;
  if (vPeso.length > 1 && primP) {
    const diffP = ultP.valor - primP.valor;
    const dias = Math.round((new Date(ultP.fecha + 'T00:00:00') - new Date(primP.fecha + 'T00:00:00')) / 86400000);
    const tiempoTxt = dias > 0 ? ` (en ${dias} días, desde el ${ui.fechaBonita(primP.fecha)})` : '';
    if (Math.abs(diffP) < 0.1) {
      txt += `• **Cambio total**: Mantienes tu peso inicial de **${primP.valor} kg**${tiempoTxt}.\n`;
    } else if (diffP < 0) {
      txt += `• **Cambio total**: Has bajado **${Math.abs(diffP).toFixed(1)} kg**${tiempoTxt} (inicio: ${primP.valor} kg).\n`;
    } else {
      txt += `• **Cambio total**: Has subido **${diffP.toFixed(1)} kg**${tiempoTxt} (inicio: ${primP.valor} kg).\n`;
    }
  }
  if (tPeso !== null) {
    txt += `• **Tendencia semanal**: **${tPeso > 0 ? '+' : ''}${tPeso.toFixed(2)} kg/semana** (últimos 14 días).\n`;
  }
  if (ultC) {
    txt += `• **Cintura**: **${ultC.valor} cm** (${ui.fechaBonita(ultC.fecha)})\n`;
  }
  return txt;
}

// ============================================================================
// 4. IA LOCAL CON WEBLLM
// ============================================================================

function tieneWebGPU() {
  return typeof navigator !== 'undefined' && 'gpu' in navigator && Boolean(navigator.gpu);
}

async function armarResumenParaIA() {
  const [perfil, series, medidas, comidas, ejs] = await Promise.all([
    datos.perfil(), db.todos('series'), db.todos('medidas'), db.todos('comidas'), datos.ejercicios()
  ]);
  const hoyISO = ui.hoyISO(), d14 = new Date();
  d14.setDate(d14.getDate() - 14);
  const iso14 = fechaLocalISO(d14);
  const diffMeta = perfil?.metaFecha ? Math.ceil((new Date(perfil.metaFecha + 'T00:00:00') - new Date(hoyISO + 'T00:00:00')) / 86400000) : 'N/D';

  const prs = Object.entries(calculos.prs(series)).slice(0, 12).map(([id, p]) => `${ejs.find(e => e.id === id)?.nombre || id}: ${ui.formatoKg(p.kg, p.porLado, p.unidad)} x ${p.reps}`).join('; ');
  // COA-NEW-03: ordenar cronológicamente de forma ascendente tanto por fecha como por hora ((a.hora || 0) - (b.hora || 0))
  const s14 = series
    .filter(s => s.fecha >= iso14 && s.fecha <= hoyISO)
    .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || ((a.hora || 0) - (b.hora || 0)));
  const pf = {};
  for (const s of s14) {
    if (!pf[s.fecha]) pf[s.fecha] = [];
    pf[s.fecha].push(`${ejs.find(e => e.id === s.ejercicioId)?.nombre || s.ejercicioId} ${ui.formatoKg(s.kg, s.porLado, s.unidad)} x ${s.reps}`);
  }
  const entreno = Object.entries(pf).map(([f, it]) => `${f}: ${it.join(', ')}`).join('\n');

  // COA-01: ordenar medidas cronológicamente por fecha antes de extraer el último valor y calcular tendencia
  const medidasOrdenadas = [...medidas].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
  const vPeso = medidasOrdenadas.filter(m => m.peso != null).map(m => ({ fecha: m.fecha, valor: Number(m.peso) }));
  const vCint = medidasOrdenadas.filter(m => m.cintura != null).map(m => ({ fecha: m.fecha, valor: Number(m.cintura) }));
  const tPeso = calculos.tendenciaSemanal(vPeso);
  const tCint = calculos.tendenciaSemanal(vCint);
  const ultP = vPeso[vPeso.length - 1];
  const ultC = vCint[vCint.length - 1];

  const pDia = {};
  for (const c of comidas.filter(c => c.fecha >= iso14)) pDia[c.fecha] = (pDia[c.fecha] || 0) + (Number(c.proteina) || 0);
  const promProt = Object.keys(pDia).length ? Math.round(Object.values(pDia).reduce((a, b) => a + b, 0) / Object.keys(pDia).length) : 0;
  const reglas = (config.REGLAS_COACH || ['Fallo solo en última serie en máquina.', 'Peso libre 1-2 RIR.', 'Descanso 2 min compuestos.']).join('\n- ');

  return `DATOS DEL USUARIO (FORJA):\n- Perfil: ${perfil?.nombre || 'el usuario'}, meta: ${perfil?.metaNombre || 'Grado'} (${perfil?.metaFecha || 'N/D'}, faltan ${diffMeta} días). Meta mes: "${perfil?.metaMes || 'N/D'}".\n- Objetivos diarios: ${perfil?.kcal || 2200} kcal, ${perfil?.proteina || 128}g prot, ${perfil?.aguaVasos || 10} vasos agua.\n- Tendencias: Peso ${ultP?.valor ?? 'N/D'}kg (${tPeso !== null ? tPeso.toFixed(2) + 'kg/sem' : 'N/D'}), cintura ${ultC?.valor ?? 'N/D'}cm (${tCint !== null ? tCint.toFixed(2) + 'cm/sem' : 'N/D'}).\n- Proteína promedio: ${promProt}g/día.\n- PRs: ${prs || 'Sin registros'}.\n- Entrenamientos recientes:\n${entreno || 'Sin entrenamientos recientes'}\n- Reglas del coach:\n- ${reglas}`;
}

/**
 * Descarga o inicializa el motor de WebLLM para su uso sin conexión.
 * Si el modelo grande falla por memoria, ofrece cambiar al de respaldo de config.js.
 * Exportada para ser utilizada tanto por el Coach como por Ajustes.
 */
let promesaCarga = null;   // 7-nov: una sola carga compartida; quien llega después ESPERA (antes recibía null → «reading 'chat'»)
const oyentesAvance = new Set();

export async function descargarModelo(alAvance, modelo = null) {
  if (!tieneWebGPU()) throw new Error('WebGPU no está disponible en este dispositivo o navegador.');
  if (typeof alAvance === 'function') oyentesAvance.add(alAvance);
  if (promesaCarga) {
    try { return await promesaCarga; } finally { oyentesAvance.delete(alAvance); }
  }
  const avisarTodos = (rep) => oyentesAvance.forEach(fn => { try { fn(rep); } catch (_) {} });
  promesaCarga = cargarMotorInterno(avisarTodos, modelo);
  try {
    return await promesaCarga;
  } finally {
    promesaCarga = null;
    oyentesAvance.clear();
  }
}

async function cargarMotorInterno(alAvance, modelo) {
  descargando = true;
  try {
    const webllm = await import(config.WEBLLM_URL);
    const aj = await obtenerAjusteIASincronizado();
    let modeloACargar = modelo ? normalizarModeloConfig(modelo) : aj.modelo;
    const modeloRespaldo = config.WEBLLM_MODELO_RESPALDO || 'Qwen3.5-0.8B-q4f16_1-MLC';

    if (mlcEngine && mlcEngine._modeloCargado === modeloACargar) {
      return mlcEngine;
    }
    if (mlcEngine) {
      try { await mlcEngine.unload(); } catch (_) {}
      mlcEngine = null;
    }

    try {
      mlcEngine = await webllm.CreateMLCEngine(modeloACargar, {
        initProgressCallback: rep => { if (typeof alAvance === 'function') alAvance(rep); }
      }, { context_window_size: 2048 });   // memoria de conversación corta: menos RAM y menos traba en el celular
      mlcEngine._modeloCargado = modeloACargar;
      await db.ponerAjuste('ia', { ...aj, activa: true, modelo: modeloACargar });
      if (estadoPantalla?.actualizarModo) estadoPantalla.actualizarModo(true, modeloACargar);
      return mlcEngine;
    } catch (err) {
      if (esErrorMemoria(err) && modeloACargar !== modeloRespaldo) {
        let cambiar = false;
        try {
          cambiar = await ui.confirmar(
            `El modelo (${modeloACargar}) falló por falta de memoria en tu dispositivo.\n\n¿Deseas descargar el modelo ligero de respaldo (${modeloRespaldo})?`
          );
        } catch (_) {}

        if (cambiar) {
          modeloACargar = modeloRespaldo;
          await db.ponerAjuste('ia', { ...aj, activa: true, modelo: modeloRespaldo });
          if (estadoPantalla?.actualizarModo) estadoPantalla.actualizarModo(true, modeloRespaldo);
          ui.aviso(`Cambiando al modelo de respaldo: ${modeloRespaldo}...`, 'info');
          if (typeof alAvance === 'function') {
            alAvance({ progress: 0.05, text: `Cargando modelo de respaldo (${modeloRespaldo})...` });
          }
          mlcEngine = await webllm.CreateMLCEngine(modeloACargar, {
            initProgressCallback: rep => { if (typeof alAvance === 'function') alAvance(rep); }
          }, { context_window_size: 2048 });
          mlcEngine._modeloCargado = modeloACargar;
          ui.aviso('Modelo de respaldo listo para usar', 'ok');
          return mlcEngine;
        }
      }
      throw err;
    }
  } finally {
    descargando = false;
  }
}

/**
 * Borra los pesos y cachés del modelo local para liberar almacenamiento
 */
export async function borrarModelo() {
  if (enGeneracion && mlcEngine && typeof mlcEngine.interruptGenerate === 'function') {
    try { mlcEngine.interruptGenerate(); } catch (_) {}
  }
  enGeneracion = false;
  if (mlcEngine) {
    try { await mlcEngine.unload(); } catch (_) {}
    mlcEngine = null;
  }
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const keys = await window.caches.keys();
      for (const k of keys) {
        if (k.includes('webllm') || k.includes('mlc')) {
          await window.caches.delete(k);
        }
      }
    } catch (_) {}
  }
  if (typeof window !== 'undefined' && window.indexedDB?.databases) {
    try {
      const dbs = await window.indexedDB.databases();
      for (const d of dbs) {
        if (d.name && (d.name.includes('webllm') || d.name.includes('mlc'))) {
          window.indexedDB.deleteDatabase(d.name);
        }
      }
    } catch (_) {}
  }
  if (estadoPantalla?.actualizarModo) {
    const aj = await obtenerAjusteIASincronizado();
    estadoPantalla.actualizarModo(false, aj.modelo);
  }
  return true;
}

async function responderConIA(pregunta, onChunk, onProgreso) {
  if (!tieneWebGPU()) return 'Tu dispositivo no soporta WebGPU para IA local. Sigo respondiendo con reglas locales.';
  try {
    const ajIA = await obtenerAjusteIASincronizado();
    const modeloActual = ajIA.modelo;
    const modeloRespaldo = config.WEBLLM_MODELO_RESPALDO || 'Qwen3.5-0.8B-q4f16_1-MLC';

    if (!mlcEngine || mlcEngine._modeloCargado !== modeloActual) {
      if (onProgreso) onProgreso(`Iniciando IA local (${modeloActual})...`);
      try {
        await descargarModelo(
          r => onProgreso && onProgreso(r?.text || `Cargando IA: ${Math.round((r.progress || 0) * 100)}%`),
          modeloActual
        );
      } catch (errCarga) {
        if (esErrorMemoria(errCarga)) {
          return `El modelo de IA superó la memoria de tu dispositivo. Puedes cambiar al modelo de respaldo (${modeloRespaldo}) en Ajustes o seguir usando el coach por reglas.`;
        }
        throw errCarga;
      }
    }

    if (!mlcEngine || !mlcEngine.chat) {
      return 'La IA local todavía no está lista en este teléfono. Ve a Ajustes → IA local → Descargar (con wifi, ~1,5 GB, una sola vez) y espera a que llegue al 100 %. Mientras tanto te respondo con mis reglas: prueba «¿cómo voy?» o «¿qué me toca hoy?».';
    }

    const contexto = await armarResumenParaIA();
    // COA-03: excluir la pregunta recién guardada del historial previo para no duplicarla
    const todosMsgs = (await db.todos('chat')).sort((a, b) => (a.hora || 0) - (b.hora || 0));
    const ultimo = todosMsgs[todosMsgs.length - 1];
    const sinActual = (ultimo && ultimo.rol === 'yo' && ultimo.texto === pregunta)
      ? todosMsgs.slice(0, -1)
      : todosMsgs;
    const chatPrevio = sinActual.slice(-4);

    const msgs = [
      { role: 'system', content: `Eres el entrenador personal del usuario en "Forja". Responde en español latino simple, cercano y motivador. Usa SOLO los siguientes datos. Si no sabes algo, dilo. NUNCA des consejos médicos.\n\n${contexto}` },
      ...chatPrevio.map(m => ({ role: m.rol === 'yo' ? 'user' : 'assistant', content: m.texto })),
      { role: 'user', content: pregunta }
    ];

    enGeneracion = true;
    let acc = '';
    try {
      const stream = await mlcEngine.chat.completions.create({ messages: msgs, stream: true, max_tokens: 350, temperature: 0.6 });
      for await (const chunk of stream) {
        if (!enGeneracion) break;
        acc += chunk.choices[0]?.delta?.content || '';
        if (onChunk && enGeneracion) onChunk(acc);
      }
    } finally {
      enGeneracion = false;
    }
    return acc;
  } catch (err) {
    enGeneracion = false;
    const modeloRespaldo = config.WEBLLM_MODELO_RESPALDO || 'Qwen3.5-0.8B-q4f16_1-MLC';
    if (esErrorMemoria(err)) {
      return `La IA local se quedó sin memoria en tu dispositivo. Puedes cambiar al modelo ligero de respaldo (${modeloRespaldo}) en Ajustes o seguir usando el coach por reglas directas.`;
    }
    return `Ocurrió un error con la IA local (${err.message || err}). Puedes usar las reglas directas del coach.`;
  }
}

function mensajeSugerencias() {
  return `No encontré una regla directa para esa pregunta.\n\nPuedes preguntarme:\n• **«¿Cómo voy?»** (resumen semanal, PRs, tendencias y proteína)\n• **«¿Qué me toca hoy?»** (rutina programada y pesos sugeridos)\n• **«¿Cuánta proteína llevo?»** (total de hoy vs tu meta)\n• **«Mi peso»** o **«¿Cuánto he bajado?»** (peso, cintura y medidas)\n• **«¿Qué peso uso en [ejercicio]?»** (doble progresión)\n• **«¿Cuándo fue la última vez que hice [ejercicio o músculo]?»**\n• **«¿Cómo se hace [ejercicio]?»** (técnica y claves)\n\n*Para preguntas libres sobre tus datos, activa y descarga la **IA Local** en Ajustes.*`;
}

export async function responder(texto, { onChunk, onProgreso } = {}) {
  const c = clasificarPregunta(texto);
  if (c) {
    if (c.tipo === 'QUIEN_SOY') return await responderQuienSoy();
    if (c.tipo === 'COMO_VOY') return await responderComoVoy();
    if (c.tipo === 'PROTEINA_LLEVO') return await responderProteinaLlevo();
    if (c.tipo === 'QUE_TOCA_HOY') return await responderQueTocaHoy();
    if (c.tipo === 'MEDIDAS_CORPORALES') return await responderMedidas(c.subtipo);
    if (c.tipo === 'PESO_USO') return await responderPesoUso(c.termino);
    if (c.tipo === 'ULTIMA_VEZ') return await responderUltimaVez(c.termino);
    if (c.tipo === 'COMO_SE_HACE') return await responderComoSeHace(c.termino);
  }
  const ajIA = await obtenerAjusteIASincronizado();
  if (ajIA.activa) return await responderConIA(texto, onChunk, onProgreso);
  return mensajeSugerencias();
}

// ============================================================================
// 5. INTERFAZ DE USUARIO (ROUTER APP.JS - DIRECCIÓN DE ARTE FORJA V2)
// ============================================================================

const CSS_COACH = `
.coach-pantalla { display: flex; flex-direction: column; height: 100%; max-height: calc(100vh - 120px); max-width: 520px; margin: 0 auto; box-sizing: border-box; padding: 8px 16px 12px; background: var(--papel, #F3F0E8); color: var(--tinta, #17171A); font-family: 'Bricolage Grotesque', system-ui, sans-serif; }
.coach-cabecera { display: flex; justify-content: space-between; align-items: center; padding: 4px 0 10px; flex-shrink: 0; }
.coach-cabecera-texto { display: flex; flex-direction: column; gap: 2px; }
.coach-titulo { font-family: 'Instrument Serif', Georgia, serif; font-size: 32px; font-weight: 400; line-height: 1.05; color: var(--tinta, #17171A); letter-spacing: -0.01em; margin: 0; }
.coach-titulo em { font-style: italic; }
.coach-estado { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; color: var(--tinta-suave, #5D5951); }
.coach-punto { width: 6px; height: 6px; border-radius: 999px; background-color: var(--lima, #C8F03C); }
.coach-btn-limpiar { width: 48px; height: 48px; min-width: 48px; min-height: 48px; border-radius: 999px; background: var(--papel2, #E9E4D8); border: none; color: var(--tinta, #17171A); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform 140ms, background 140ms; }
.coach-btn-limpiar:active { transform: scale(0.94); background: var(--tinta, #17171A); color: var(--papel, #F3F0E8); }
.coach-chips { display: flex; gap: 8px; overflow-x: auto; overflow-y: hidden; padding: 8px 0 12px; flex-shrink: 0; min-height: 68px; scrollbar-width: none; -ms-overflow-style: none; }
.coach-chips::-webkit-scrollbar { display: none; }
.coach-chip-btn { flex-shrink: 0; min-height: 48px; font-family: 'Bricolage Grotesque', sans-serif; font-size: 13px; font-weight: 600; padding: 0 16px; border-radius: 999px; border: none; background: var(--papel2, #E9E4D8); color: var(--tinta, #17171A); cursor: pointer; transition: transform 140ms, background 140ms, color 140ms; white-space: nowrap; display: inline-flex; align-items: center; }
.coach-chip-btn:active { transform: scale(0.96); background: var(--tinta, #17171A); color: var(--papel, #F3F0E8); }
.coach-mensajes { flex: 1; min-height: 0; overflow-y: auto; padding: 8px 0; display: flex; flex-direction: column; gap: 14px; scrollbar-width: none; -ms-overflow-style: none; }
.coach-mensajes::-webkit-scrollbar { display: none; }
.coach-msg { max-width: 86%; padding: 14px 18px; border-radius: 28px; font-family: 'Bricolage Grotesque', sans-serif; font-size: 15px; line-height: 1.45; word-break: break-word; }
.coach-msg-coach { align-self: flex-start; background: var(--papel2, #E9E4D8); color: var(--tinta, #17171A); }
.coach-msg-yo { align-self: flex-end; background: var(--tinta, #17171A); color: var(--papel, #F3F0E8); }
.coach-msg-cuerpo p { margin: 0 0 8px 0; }
.coach-msg-cuerpo p:last-child { margin-bottom: 0; }
.coach-msg-cuerpo ul, .coach-msg-cuerpo ol { margin: 4px 0 8px 18px; padding: 0; }
.coach-msg-cuerpo li { margin-bottom: 4px; }
.coach-msg-cuerpo code { background: rgba(23, 23, 26, 0.08); padding: 2px 6px; border-radius: 999px; font-size: 13px; }
.coach-msg-cuerpo strong { font-weight: 700; }
.coach-msg-yo .coach-msg-cuerpo strong { color: #FFFFFF; }
.coach-msg-meta { font-size: 11px; margin-top: 6px; display: flex; justify-content: flex-end; font-variant-numeric: tabular-nums; }
.coach-msg-coach .coach-msg-meta { color: var(--tinta-suave, #5D5951); }
.coach-msg-yo .coach-msg-meta { color: rgba(243, 240, 232, 0.65); }
.coach-barra { display: flex; gap: 10px; padding: 12px 0 4px; align-items: center; }
.coach-in { flex: 1; height: 52px; min-height: 52px; padding: 0 20px; border-radius: 999px; background: var(--papel2, #E9E4D8); border: none; color: var(--tinta, #17171A); font-family: 'Bricolage Grotesque', sans-serif; font-size: 15px; outline: none; box-sizing: border-box; transition: box-shadow 150ms; }
.coach-in:focus { box-shadow: 0 0 0 2px var(--tinta, #17171A); }
.coach-in::placeholder { color: var(--tinta-suave, #5D5951); }
.coach-btn-env { width: 52px; height: 52px; min-width: 52px; min-height: 52px; border-radius: 999px; border: none; background: var(--lima, #C8F03C); color: var(--tinta, #17171A); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform 140ms; flex-shrink: 0; }
.coach-btn-env:active { transform: scale(0.94); }
.coach-btn-env:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
.coach-link { color: inherit; text-decoration: underline; font-weight: 600; }
.coach-icono { display: inline-flex; align-items: center; justify-content: center; line-height: 1; }
`;

export async function montar(contenedor, params = []) {
  desmontar();
  let procesando = false;
  const ajIA = await obtenerAjusteIASincronizado();
  const modNombre = ajIA.modelo || config.WEBLLM_MODELO || 'Qwen';
  const modo = ajIA.activa ? `IA: ${modNombre}` : 'Reglas';

  const raiz = ui.h('div', { class: 'coach-pantalla' },
    ui.h('style', {}, CSS_COACH),
    ui.h('div', { class: 'coach-cabecera' },
      ui.h('div', { class: 'coach-cabecera-texto' },
        ui.h('h2', { class: 'coach-titulo' }, 'Entrenador ', ui.h('em', {}, 'Forja')),
        ui.h('div', { class: 'coach-estado' },
          ui.h('span', { class: 'coach-punto' }),
          ui.h('span', { class: 'coach-modo-txt' }, `Coach (${modo})`)
        )
      ),
      ui.h('button', {
        class: 'coach-btn-limpiar',
        type: 'button',
        title: 'Limpiar historial de chat',
        'aria-label': 'Limpiar historial de chat',
        on: {
          click: async () => {
            if (await ui.confirmar('¿Borrar el historial de chat con el Coach?')) {
              const msgs = await db.todos('chat');
              for (const m of msgs) {
                if (m.id) await db.borrar('chat', m.id);
              }
              mensajesEl.innerHTML = '';
              bienvenida();
              ui.aviso('Historial borrado', 'ok');
            }
          }
        }
      }, renderIcono('basura'))
    ),
    ui.h('div', { class: 'coach-chips' },
      chip('¿Cómo voy?', '¿Cómo voy?'),
      chip('¿Qué me toca hoy?', '¿Qué me toca hoy?'),
      chip('¿Cuánta proteína llevo?', '¿Cuánta proteína llevo?'),
      chip('Mi peso y medidas', 'Mi peso'),
      chip('¿Qué peso uso en...?', '¿Qué peso uso en '),
      chip('¿Cuándo fue la última vez...?', '¿Cuándo fue la última vez que hice '),
      chip('¿Cómo se hace...?', '¿Cómo se hace ')
    ),
    ui.h('div', { class: 'coach-mensajes' }),
    ui.h('form', {
      class: 'coach-barra',
      on: {
        submit: async e => {
          e.preventDefault();
          const val = inputEl.value.trim();
          if (!val || procesando) return;
          inputEl.value = '';
          await enviar(val);
        }
      }
    },
      ui.h('input', {
        type: 'text',
        class: 'coach-in',
        placeholder: 'Pregunta algo al coach...',
        autocomplete: 'off'
      }),
      ui.h('button', {
        type: 'submit',
        class: 'coach-btn-env',
        'aria-label': 'Enviar pregunta'
      }, renderIcono('enviar'))
    )
  );

  const mensajesEl = raiz.querySelector('.coach-mensajes');
  const inputEl = raiz.querySelector('.coach-in');
  const btnEnvEl = raiz.querySelector('.coach-btn-env');
  const modoTxtEl = raiz.querySelector('.coach-modo-txt');

  function actualizarModo(activa, modelo) {
    if (modoTxtEl) {
      modoTxtEl.textContent = `Coach (${activa ? `IA: ${modelo || config.WEBLLM_MODELO}` : 'Reglas'})`;
    }
  }

  function chip(lbl, acc) {
    return ui.h('button', {
      type: 'button',
      class: 'coach-chip-btn',
      on: {
        click: async () => {
          if (acc.endsWith(' ')) {
            inputEl.value = acc;
            inputEl.focus();
          } else {
            await enviar(acc);
          }
        }
      }
    }, lbl);
  }

  function scroll() {
    mensajesEl.scrollTop = mensajesEl.scrollHeight;
  }

  function burbuja(msg) {
    const esYo = msg.rol === 'yo';
    const b = ui.h('div', { class: `coach-msg ${esYo ? 'coach-msg-yo' : 'coach-msg-coach'}` },
      ui.h('div', { class: 'coach-msg-cuerpo' }),
      ui.h('div', { class: 'coach-msg-meta' }, new Date(msg.hora || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    );
    b.querySelector('.coach-msg-cuerpo').innerHTML = renderMarkdown(msg.texto);
    mensajesEl.appendChild(b);
    scroll();
    return b;
  }

  function bienvenida() {
    burbuja({
      rol: 'coach',
      hora: Date.now(),
      texto: '¡Hola! Soy tu coach personal en **Forja**.\n\nPuedes preguntarme cómo vas, tu peso y evolución de medidas, qué peso usar hoy con doble progresión, cuánta proteína llevas o la técnica de cualquier ejercicio. Toca una sugerencia arriba o escribe lo que necesites.'
    });
  }

  async function enviar(texto) {
    procesando = true;
    inputEl.disabled = true;
    if (btnEnvEl) btnEnvEl.disabled = true;
    const yo = { hora: Date.now(), rol: 'yo', texto };
    await db.guardar('chat', yo);
    burbuja(yo);

    const bCoach = burbuja({ rol: 'coach', hora: Date.now(), texto: '...' });
    const cEl = bCoach.querySelector('.coach-msg-cuerpo');

    try {
      const resp = await responder(texto, {
        onProgreso: p => {
          if (!estadoPantalla || estadoPantalla.raiz !== raiz) return;
          cEl.innerHTML = renderMarkdown(`*${p}*`);
          scroll();
        },
        onChunk: ch => {
          if (!estadoPantalla || estadoPantalla.raiz !== raiz) return;
          cEl.innerHTML = renderMarkdown(ch);
          scroll();
        }
      });
      if (resp) {
        if (estadoPantalla && estadoPantalla.raiz === raiz) {
          cEl.innerHTML = renderMarkdown(resp);
        }
        await db.guardar('chat', { hora: Date.now(), rol: 'coach', texto: resp });
      }
    } catch (err) {
      const errTxt = `No pude responder: ${err.message || err}`;
      if (estadoPantalla && estadoPantalla.raiz === raiz) {
        cEl.innerHTML = renderMarkdown(errTxt);
      }
      await db.guardar('chat', { hora: Date.now(), rol: 'coach', texto: errTxt });
    } finally {
      procesando = false;
      inputEl.disabled = false;
      if (btnEnvEl) btnEnvEl.disabled = false;
      // COA-04: enfocar inputEl únicamente si sigue montado en el documento activo
      if (inputEl && typeof document !== 'undefined' && document.body.contains(inputEl)) {
        inputEl.focus();
        scroll();
      }
    }
  }

  const hist = (await db.todos('chat')).sort((a, b) => (a.hora || 0) - (b.hora || 0));
  if (!hist.length) bienvenida(); else hist.forEach(burbuja);

  contenedor.innerHTML = '';
  contenedor.appendChild(raiz);
  estadoPantalla = { raiz, actualizarModo };
  scroll();
}

export function desmontar() {
  // COA-04: interrumpir la generación en streaming si el usuario sale de la pantalla
  if (enGeneracion && mlcEngine && typeof mlcEngine.interruptGenerate === 'function') {
    try { mlcEngine.interruptGenerate(); } catch (_) {}
  }
  enGeneracion = false;
  if (estadoPantalla) estadoPantalla = null;
}

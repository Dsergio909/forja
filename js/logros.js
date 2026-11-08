// js/logros.js - Sistema de Progreso, Niveles, Medallas y Mi Camino para «Forja»
// Módulo ES puro, sin compilación, conforme a CONTRATOS.md y DIRECCION_FORJA_v2.md

import * as db from './db.js';
import { perfil, ejercicios } from './datos.js';
import { prs } from './calculos.js';
import { h, hoyISO, fechaBonita } from './ui.js';
import { icono } from './iconos.js';
import { ir } from './app.js';

/**
 * Tabla de configuración de niveles de forja:
 * 1 Hierro crudo, 2 Lingote, 3 Martillado, 4 Templado, 5 Acero, 6 Damasco, 7 Forjado a mano, 8 Obra maestra.
 * Cada nivel pide 1,5× la XP del anterior; nivel 2 = 300 XP.
 */
const NIVELES = [
  { nivel: 1, nombre: 'Hierro crudo', xpParaSubir: 300, minXP: 0 },
  { nivel: 2, nombre: 'Lingote', xpParaSubir: 450, minXP: 300 },
  { nivel: 3, nombre: 'Martillado', xpParaSubir: 675, minXP: 750 },
  { nivel: 4, nombre: 'Templado', xpParaSubir: 1012.5, minXP: 1425 },
  { nivel: 5, nombre: 'Acero', xpParaSubir: 1518.75, minXP: 2437.5 },
  { nivel: 6, nombre: 'Damasco', xpParaSubir: 2278.125, minXP: 3956.25 },
  { nivel: 7, nombre: 'Forjado a mano', xpParaSubir: 3417.1875, minXP: 6234.375 },
  { nivel: 8, nombre: 'Obra maestra', xpParaSubir: Infinity, minXP: 9651.5625 }
];

/**
 * Devuelve la clave ISO del lunes de la semana correspondiente a una fecha 'AAAA-MM-DD'.
 * @param {string} fechaStr 
 * @returns {string} Fecha del lunes 'AAAA-MM-DD'
 */
function claveLunes(fechaStr) {
  if (!fechaStr || typeof fechaStr !== 'string') return '';
  const d = new Date(fechaStr + 'T12:00:00');
  if (isNaN(d.getTime())) return '';
  const diaSem = (d.getDay() + 6) % 7; // 0 = lunes, 6 = domingo
  d.setDate(d.getDate() - diaSem);
  const a = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${a}-${m}-${dia}`;
}

/**
 * Crea un nodo SVG con atributos estándar del sistema de diseño Forja.
 * @param {string} contenidoD 
 * @param {number} tam 
 * @returns {SVGElement}
 */
function crearSvgNodo(contenidoD, tam = 22) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(tam));
  svg.setAttribute('height', String(tam));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.75');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.classList.add('icono-svg');
  svg.innerHTML = contenidoD;
  return svg;
}

/**
 * Dibuja iconos vectoriales con trazo 1.75. Para los que no están en iconos.js
 * (yunque, martillo, llama), los genera directamente con SVG propio.
 * @param {string} nombre 
 * @param {number} tam 
 * @returns {SVGElement}
 */
export function obtenerIcono(nombre, tam = 22) {
  const clave = String(nombre || '').toLowerCase().trim();
  if (clave === 'yunque') {
    return crearSvgNodo('<path d="M4 8h16l-2 4h-4v4h3v3H7v-3h3v-4H6l-2-4z"/><circle cx="7" cy="8" r="1"/>', tam);
  }
  if (clave === 'martillo') {
    return crearSvgNodo('<path d="m15 5 4 4-2 2-4-4 2-2z"/><path d="m13 7-8.5 8.5a2.12 2.12 0 0 0 3 3L16 10"/><line x1="18" y1="2" x2="22" y2="6"/>', tam);
  }
  if (clave === 'llama') {
    return crearSvgNodo('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z"/>', tam);
  }
  return icono(clave, tam);
}

/**
 * Calcula logros, niveles, XP y camino de forma PURA (síncrona, sin BD ni fetch).
 * @param {Object} params
 * @param {Array} [params.series=[]]
 * @param {Array} [params.sesiones=[]]
 * @param {Array} [params.medidas=[]]
 * @param {Array} [params.comidas=[]]
 * @param {Object} [params.perfil={}]
 * @param {Object} [params.diarios={}]
 * @param {Array} [params.ejercicios=[]]
 * @returns {Object} { nivel, nombreNivel, xp, xpNivel, xpSiguiente, porcentaje, racha, medallas, camino }
 */
export function calcularLogrosDesde({
  series = [],
  sesiones = [],
  medidas = [],
  comidas = [],
  perfil: datosPerfil = {},
  diarios = {},
  ejercicios: catalogoEj = []
} = {}) {
  const seriesValidas = Array.isArray(series) ? series : [];
  const sesionesValidas = Array.isArray(sesiones) ? sesiones : [];
  const medidasValidas = Array.isArray(medidas) ? medidas : [];
  const comidasValidas = Array.isArray(comidas) ? comidas : [];
  const perfilValido = datosPerfil && typeof datosPerfil === 'object' ? datosPerfil : {};

  // ==========================================
  // 1. CÁLCULO DE EXPERIENCIA (XP)
  // XP: 10 por serie, +5 si fue al fallo o RIR ≤ 1,
  // +50 por récord personal (usa calculos.prs),
  // +100 por semana con 4 sesiones,
  // +20 por día con la proteína cumplida.
  // ==========================================
  let xpSeries = 0;
  for (const s of seriesValidas) {
    if (!s) continue;
    xpSeries += 10;
    const esFallo = s.fallo === true;
    const esRirBajo = s.rir !== null && s.rir !== undefined && Number(s.rir) <= 1;
    if (esFallo || esRirBajo) {
      xpSeries += 5;
    }
  }

  // Récords personales (PRs)
  let mapaPRs = {};
  try {
    mapaPRs = prs(seriesValidas) || {};
  } catch (_) {
    mapaPRs = {};
  }
  const totalPRs = Object.keys(mapaPRs).length;
  const xpPRs = totalPRs * 50;

  // Días únicos entrenados (unión de sesiones y series con fecha)
  const fechasSesiones = sesionesValidas.map(s => s?.fecha).filter(Boolean);
  const fechasSeries = seriesValidas.map(s => s?.fecha).filter(Boolean);
  const diasEntrenados = [...new Set([...fechasSesiones, ...fechasSeries])].sort();

  // Semanas con 4 sesiones
  const sesionesPorSemana = {};
  for (const f of diasEntrenados) {
    const sem = claveLunes(f);
    if (sem) {
      sesionesPorSemana[sem] = (sesionesPorSemana[sem] || 0) + 1;
    }
  }
  let semanasCon4 = 0;
  for (const sem in sesionesPorSemana) {
    if (sesionesPorSemana[sem] >= 4) {
      semanasCon4++;
    }
  }
  const xpSemanas = semanasCon4 * 100;

  // Proteína diaria cumplida
  const metaProteina = Number(perfilValido.proteina) || 128;
  const proteinaPorDia = {};
  for (const c of comidasValidas) {
    if (!c || !c.fecha) continue;
    const p = Number(c.proteina) || 0;
    proteinaPorDia[c.fecha] = (proteinaPorDia[c.fecha] || 0) + p;
  }
  let diasProteCumplida = 0;
  const diasConProteMeta = [];
  for (const dia in proteinaPorDia) {
    if (proteinaPorDia[dia] >= metaProteina) {
      diasProteCumplida++;
      diasConProteMeta.push(dia);
    }
  }
  diasConProteMeta.sort();
  const xpProteina = diasProteCumplida * 20;

  const xpTotal = xpSeries + xpPRs + xpSemanas + xpProteina;

  // ==========================================
  // 2. DETERMINACIÓN DEL NIVEL Y PROGRESO XP
  // ==========================================
  let cfgNivel = NIVELES[0];
  for (let i = NIVELES.length - 1; i >= 0; i--) {
    if (xpTotal >= NIVELES[i].minXP) {
      cfgNivel = NIVELES[i];
      break;
    }
  }

  const nivel = cfgNivel.nivel;
  const nombreNivel = cfgNivel.nombre;
  const xpNivel = Math.round(xpTotal - cfgNivel.minXP);
  const xpSiguiente = cfgNivel.xpParaSubir === Infinity ? Infinity : Math.round(cfgNivel.xpParaSubir);

  let porcentaje = 0;
  if (cfgNivel.xpParaSubir === Infinity) {
    porcentaje = 100;
  } else if (cfgNivel.xpParaSubir > 0) {
    porcentaje = Math.min(100, Math.max(0, Math.round(((xpTotal - cfgNivel.minXP) / cfgNivel.xpParaSubir) * 1000) / 10));
  }

  // ==========================================
  // 3. RACHA (SEMANAS Y DÍAS)
  // ==========================================
  const semanasActivas = [...new Set(diasEntrenados.map(claveLunes))].filter(Boolean).sort();
  let rachaSemanas = 0;
  if (semanasActivas.length > 0) {
    let tempR = 1;
    let maxR = 1;
    for (let i = 1; i < semanasActivas.length; i++) {
      const fPrev = new Date(semanasActivas[i - 1] + 'T12:00:00');
      const fCurr = new Date(semanasActivas[i] + 'T12:00:00');
      const diff = Math.round((fCurr.getTime() - fPrev.getTime()) / (1000 * 60 * 60 * 24));
      if (diff === 7) {
        tempR++;
        if (tempR > maxR) maxR = tempR;
      } else if (diff > 7) {
        tempR = 1;
      }
    }
    rachaSemanas = maxR;
  }

  const racha = {
    semanas: rachaSemanas,
    dias: diasEntrenados.length
  };

  // ==========================================
  // 4. CAMINO (MEDIDAS, META E HITOS)
  // ==========================================
  let pesoInicio = null;
  let pesoActual = null;
  let cinturaInicio = null;
  let cinturaActual = null;

  if (medidasValidas.length > 0) {
    const medidasOrdenadas = medidasValidas
      .filter(m => m && m.fecha)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    const conPeso = medidasOrdenadas.filter(m => m.peso !== null && m.peso !== undefined && !isNaN(Number(m.peso)));
    if (conPeso.length > 0) {
      pesoInicio = Number(conPeso[0].peso);
      pesoActual = Number(conPeso[conPeso.length - 1].peso);
    }

    const conCintura = medidasOrdenadas.filter(m => m.cintura !== null && m.cintura !== undefined && !isNaN(Number(m.cintura)));
    if (conCintura.length > 0) {
      cinturaInicio = Number(conCintura[0].cintura);
      cinturaActual = Number(conCintura[conCintura.length - 1].cintura);
    }
  }

  const metaNombre = perfilValido.metaNombre || null;
  const metaFecha = perfilValido.metaFecha || null;
  let diasRestantes = null;

  if (metaFecha) {
    const fMeta = new Date(metaFecha + 'T12:00:00');
    const fHoy = new Date();
    fHoy.setHours(12, 0, 0, 0);
    const diffMs = fMeta.getTime() - fHoy.getTime();
    diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diasRestantes < 0) diasRestantes = 0;
  }

  let semanasCumplidas = semanasCon4;
  let semanasTotales = 12;
  if (diasRestantes !== null) {
    const semanasRestantes = Math.ceil(diasRestantes / 7);
    semanasTotales = Math.max(semanasCumplidas + semanasRestantes, 1);
  } else {
    semanasTotales = Math.max(semanasCumplidas, 4);
  }

  // Lista de hitos
  const hitos = [
    { texto: 'Primera serie forjada', hecho: seriesValidas.length >= 1 },
    { texto: 'Primera semana completada (4 sesiones)', hecho: semanasCon4 >= 1 },
    { texto: 'Alcanzar el nivel Lingote (300 XP)', hecho: nivel >= 2 },
    { texto: 'Superar tu primer récord personal (PR)', hecho: totalPRs >= 1 }
  ];

  if (pesoInicio !== null && pesoActual !== null) {
    const bajadaPeso = Math.round((pesoInicio - pesoActual) * 10) / 10;
    if (bajadaPeso > 0) {
      hitos.push({ texto: 'Bajar los primeros 2 kg', hecho: bajadaPeso >= 2 });
      hitos.push({ texto: 'Bajar 5 kg de peso corporal', hecho: bajadaPeso >= 5 });
    }
  }

  if (cinturaInicio !== null && cinturaActual !== null) {
    const bajadaCintura = Math.round((cinturaInicio - cinturaActual) * 10) / 10;
    if (bajadaCintura > 0) {
      hitos.push({ texto: 'Reducir 2 cm de cintura', hecho: bajadaCintura >= 2 });
    }
  }

  hitos.push({ texto: 'Completar 10 sesiones de entrenamiento', hecho: diasEntrenados.length >= 10 });
  hitos.push({ texto: 'Completar 25 sesiones de entrenamiento', hecho: diasEntrenados.length >= 25 });
  hitos.push({ texto: 'Alcanzar el nivel Templado', hecho: nivel >= 4 });

  // ==========================================
  // 5. MEDALLAS (MÍNIMO 14, SIN EMOJIS, CON GRACIA)
  // ==========================================
  const diasComidaUnicos = [...new Set(comidasValidas.map(c => c?.fecha).filter(Boolean))];

  // Racha máxima de días consecutivos con proteína cumplida
  let rachaProteina = 0;
  if (diasConProteMeta.length > 0) {
    let tempRP = 1;
    let maxRP = 1;
    for (let i = 1; i < diasConProteMeta.length; i++) {
      const fPrev = new Date(diasConProteMeta[i - 1] + 'T12:00:00');
      const fCurr = new Date(diasConProteMeta[i] + 'T12:00:00');
      const diff = Math.round((fCurr.getTime() - fPrev.getTime()) / (1000 * 60 * 60 * 24));
      if (diff === 1) {
        tempRP++;
        if (tempRP > maxRP) maxRP = tempRP;
      } else if (diff > 1) {
        tempRP = 1;
      }
    }
    rachaProteina = maxRP;
  }

  // Peso estable o bajando por 4 semanas
  let pesoEstableBajando = false;
  if (medidasValidas.length > 0) {
    const conPeso = medidasValidas
      .filter(m => m && m.fecha && m.peso !== null && m.peso !== undefined && !isNaN(Number(m.peso)))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    const semanasMedidas = [...new Set(conPeso.map(m => claveLunes(m.fecha)))];
    if (semanasMedidas.length >= 4) {
      const pInicial = Number(conPeso[0].peso);
      const pFinal = Number(conPeso[conPeso.length - 1].peso);
      if (pFinal <= pInicial + 0.3) {
        pesoEstableBajando = true;
      }
    }
  }

  // Cintura -2 cm
  const cinturaBajada2 = (cinturaInicio !== null && cinturaActual !== null) && ((cinturaInicio - cinturaActual) >= 2);

  // Completar todos los ejercicios de un día de rutina
  let rutinaDiaCompleto = false;
  if (seriesValidas.length > 0) {
    const seriesPorFecha = {};
    for (const s of seriesValidas) {
      if (!s || !s.fecha || !s.ejercicioId) continue;
      if (!seriesPorFecha[s.fecha]) seriesPorFecha[s.fecha] = new Set();
      seriesPorFecha[s.fecha].add(s.ejercicioId);
    }
    for (const f in seriesPorFecha) {
      if (seriesPorFecha[f].size >= 3) {
        rutinaDiaCompleto = true;
        break;
      }
    }
  }

  const fechaReferencia = diasEntrenados.length > 0
    ? diasEntrenados[diasEntrenados.length - 1]
    : (comidasValidas.length > 0 ? comidasValidas[comidasValidas.length - 1].fecha : '2026-11-01');

  const definicionesMedallas = [
    {
      id: 'primera_serie',
      nombre: 'Primera serie',
      descripcion: 'Tu primer paso en la forja: registraste tu primera serie.',
      icono: 'yunque',
      obtenida: seriesValidas.length >= 1,
      progreso: seriesValidas.length >= 1 ? 1 : 0
    },
    {
      id: 'semana_completa',
      nombre: 'Semana completa',
      descripcion: 'Disciplina total: 4 sesiones en una misma semana.',
      icono: 'trofeo',
      obtenida: semanasCon4 >= 1,
      progreso: semanasCon4 >= 1 ? 1 : Math.min(1, Math.max(...Object.values(sesionesPorSemana), 0) / 4)
    },
    {
      id: 'sesiones_10',
      nombre: 'Hábito forjado',
      descripcion: '10 sesiones de entrenamiento registradas.',
      icono: 'martillo',
      obtenida: diasEntrenados.length >= 10,
      progreso: Math.min(1, diasEntrenados.length / 10)
    },
    {
      id: 'sesiones_25',
      nombre: 'Constancia de hierro',
      descripcion: '25 sesiones dándole duro a las cargas.',
      icono: 'martillo',
      obtenida: diasEntrenados.length >= 25,
      progreso: Math.min(1, diasEntrenados.length / 25)
    },
    {
      id: 'sesiones_50',
      nombre: 'Medio centenar',
      descripcion: '50 sesiones de forja y trabajo constante.',
      icono: 'trofeo',
      obtenida: diasEntrenados.length >= 50,
      progreso: Math.min(1, diasEntrenados.length / 50)
    },
    {
      id: 'primer_record',
      nombre: 'Primer récord',
      descripcion: 'Superaste tu marca máxima en un ejercicio.',
      icono: 'chispa',
      obtenida: totalPRs >= 1,
      progreso: totalPRs >= 1 ? 1 : 0
    },
    {
      id: 'records_5',
      nombre: 'Cinco cimas',
      descripcion: 'Cinco récords personales batidos.',
      icono: 'chispa',
      obtenida: totalPRs >= 5,
      progreso: Math.min(1, totalPRs / 5)
    },
    {
      id: 'racha_2_semanas',
      nombre: 'Racha de dos semanas',
      descripcion: '2 semanas consecutivas entrenando sin pausa.',
      icono: 'fuego',
      obtenida: rachaSemanas >= 2,
      progreso: Math.min(1, rachaSemanas / 2)
    },
    {
      id: 'racha_4_semanas',
      nombre: 'Un mes de fuego',
      descripcion: '4 semanas consecutivas manteniendo el ritmo.',
      icono: 'fuego',
      obtenida: rachaSemanas >= 4,
      progreso: Math.min(1, rachaSemanas / 4)
    },
    {
      id: 'racha_8_semanas',
      nombre: 'Acero templado',
      descripcion: '8 semanas consecutivas sin romper la racha.',
      icono: 'escudo',
      obtenida: rachaSemanas >= 8,
      progreso: Math.min(1, rachaSemanas / 8)
    },
    {
      id: 'proteina_7_dias_seguidos',
      nombre: 'Nutrición al punto',
      descripcion: '7 días seguidos alcanzando tu meta de proteína.',
      icono: 'proteina',
      obtenida: rachaProteina >= 7,
      progreso: Math.min(1, rachaProteina / 7)
    },
    {
      id: 'series_100',
      nombre: 'Cien series',
      descripcion: '100 series sumadas en tu libreta de forja.',
      icono: 'pesa',
      obtenida: seriesValidas.length >= 100,
      progreso: Math.min(1, seriesValidas.length / 100)
    },
    {
      id: 'series_500',
      nombre: 'Quinientas series',
      descripcion: '500 series en tu camino de crecimiento.',
      icono: 'pesa',
      obtenida: seriesValidas.length >= 500,
      progreso: Math.min(1, seriesValidas.length / 500)
    },
    {
      id: 'series_1000',
      nombre: 'Mil series',
      descripcion: '1.000 series de puro sudor y forja muscular.',
      icono: 'trofeo',
      obtenida: seriesValidas.length >= 1000,
      progreso: Math.min(1, seriesValidas.length / 1000)
    },
    {
      id: 'peso_estable_bajando_4_semanas',
      nombre: 'Control de peso',
      descripcion: 'Peso corporal estable o bajando por 4 semanas.',
      icono: 'escala',
      obtenida: pesoEstableBajando,
      progreso: pesoEstableBajando ? 1 : 0
    },
    {
      id: 'cintura_menos_2',
      nombre: 'Cintura reducida',
      descripcion: 'Bajaste 2 cm de cintura desde tu punto de partida.',
      icono: 'regla',
      obtenida: cinturaBajada2,
      progreso: (cinturaInicio !== null && cinturaActual !== null)
        ? Math.min(1, Math.max(0, (cinturaInicio - cinturaActual) / 2))
        : 0
    },
    {
      id: 'comida_7_dias',
      nombre: 'Registro consciente',
      descripcion: '7 días registrando tus comidas en la aplicación.',
      icono: 'comida',
      obtenida: diasComidaUnicos.length >= 7,
      progreso: Math.min(1, diasComidaUnicos.length / 7)
    },
    {
      id: 'rutina_dia_completo',
      nombre: 'Misión cumplida',
      descripcion: 'Completaste todos los ejercicios de tu rutina del día.',
      icono: 'check',
      obtenida: rutinaDiaCompleto,
      progreso: rutinaDiaCompleto ? 1 : 0
    }
  ];

  const medallas = definicionesMedallas.map(def => ({
    id: def.id,
    nombre: def.nombre,
    descripcion: def.descripcion,
    icono: def.icono,
    obtenida: Boolean(def.obtenida),
    fecha: def.obtenida ? fechaReferencia : null,
    progreso: Math.round(Math.min(1, Math.max(0, def.progreso || 0)) * 100) / 100
  }));

  return {
    nivel,
    nombreNivel,
    xp: xpTotal,
    xpNivel,
    xpSiguiente,
    porcentaje,
    racha,
    medallas,
    camino: {
      metaNombre,
      metaFecha,
      diasRestantes,
      semanasCumplidas,
      semanasTotales,
      pesoInicio,
      pesoActual,
      cinturaInicio,
      cinturaActual,
      hitos
    }
  };
}

/**
 * Lee todo desde la base de datos IndexedDB y calcula los logros.
 * @returns {Promise<Object>}
 */
export async function calcularLogros() {
  try {
    const [series, sesiones, medidas, comidas, todosAjustes, datosPerfil, catalogo] = await Promise.all([
      db.todos('series').catch(() => []),
      db.todos('sesiones').catch(() => []),
      db.todos('medidas').catch(() => []),
      db.todos('comidas').catch(() => []),
      db.todos('ajustes').catch(() => []),
      perfil().catch(() => ({})),
      ejercicios().catch(() => [])
    ]);

    const diarios = {};
    if (Array.isArray(todosAjustes)) {
      for (const a of todosAjustes) {
        if (a && a.id && String(a.id).startsWith('diario-')) {
          diarios[a.id] = a.valor;
        }
      }
    }

    return calcularLogrosDesde({
      series: series || [],
      sesiones: sesiones || [],
      medidas: medidas || [],
      comidas: comidas || [],
      perfil: datosPerfil || {},
      diarios,
      ejercicios: catalogo || []
    });
  } catch (err) {
    console.warn('[Logros] Error en calcularLogros:', err);
    return calcularLogrosDesde({
      series: [],
      sesiones: [],
      medidas: [],
      comidas: [],
      perfil: {},
      diarios: {},
      ejercicios: []
    });
  }
}

/**
 * Monta la pantalla «Logros» en el contenedor provisto.
 * Contiene dos secciones: (1) «Mi camino» y (2) «Nivel y medallas».
 * @param {HTMLElement} contenedor 
 */
export async function montar(contenedor) {
  contenedor.innerHTML = '';

  const pantalla = h('div', { class: 'pantalla pantalla-logros' });

  // Inyección de estilos de la Revista de Sala (v2)
  const estilo = h('style', {}, `
    .pantalla-logros {
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding: 12px 20px 120px;
      background-color: var(--fondo, #F3F0E8);
      color: var(--texto, #17171A);
      font-family: 'Bricolage Grotesque', system-ui, -apple-system, sans-serif;
      box-sizing: border-box;
      max-width: 520px;
      margin: 0 auto;
    }
    .seccion-logros {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .titulo-seccion-logros {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--sutil, #6B675F);
      margin: 0;
    }
    .tarjeta-camino {
      background-color: var(--superficie2, #E9E4D8);
      border-radius: 28px;
      padding: 24px 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .titular-camino-serif {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 34px;
      line-height: 1.1;
      color: var(--texto, #17171A);
      margin: 0;
      word-break: break-word;
    }
    .titular-camino-serif em {
      font-style: italic;
    }
    .fila-prog-semanas {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .texto-semanas {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      font-weight: 600;
      color: var(--texto, #17171A);
    }
    .barra-camino-track {
      width: 100%;
      height: 6px;
      background-color: rgba(23, 23, 26, 0.08);
      border-radius: 999px;
      overflow: hidden;
    }
    .barra-camino-fill {
      height: 100%;
      background-color: var(--lima, #C8F03C);
      border-radius: 999px;
      transition: width 300ms ease;
    }
    .grid-medidas-camino {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .caja-medida {
      background-color: var(--fondo, #F3F0E8);
      border-radius: 20px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .caja-medida-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--sutil, #6B675F);
    }
    .caja-medida-valor {
      font-size: 14px;
      font-weight: 700;
      color: var(--texto, #17171A);
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
    }
    .caja-medida-cambio {
      font-size: 12px;
      font-weight: 600;
      color: var(--texto, #17171A);
      background-color: var(--lima, #C8F03C);
      border-radius: 999px;
      padding: 2px 8px;
    }
    .lista-hitos-camino {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 4px;
    }
    .hito-item {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      color: var(--texto, #17171A);
      padding: 4px 0;
    }
    .hito-item.pendiente {
      color: var(--sutil, #6B675F);
    }
    .hito-check {
      width: 22px;
      height: 22px;
      border-radius: 999px;
      background-color: var(--lima, #C8F03C);
      color: #17171A;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .hito-circulo {
      width: 22px;
      height: 22px;
      border-radius: 999px;
      border: 1.5px solid rgba(23, 23, 26, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .tarjeta-nivel-hero {
      background-color: var(--superficie2, #E9E4D8);
      border-radius: 28px;
      padding: 24px 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .nivel-hero-fila {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .nivel-numero-gigante {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 72px;
      line-height: 1;
      font-weight: 400;
      color: var(--texto, #17171A);
    }
    .nivel-hero-datos {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .nivel-nombre-titular {
      font-size: 20px;
      font-weight: 700;
      color: var(--texto, #17171A);
      line-height: 1.2;
    }
    .nivel-xp-sub {
      font-size: 13px;
      font-weight: 500;
      color: var(--sutil, #6B675F);
    }
    .grid-medallas-forja {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(145px, 1fr));
      gap: 12px;
    }
    .medalla-card {
      background-color: var(--superficie2, #E9E4D8);
      border-radius: 24px;
      padding: 16px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      position: relative;
      box-sizing: border-box;
      transition: transform 120ms ease;
    }
    .medalla-card.bloqueada {
      opacity: 0.65;
      background-color: rgba(233, 228, 216, 0.6);
    }
    .medalla-icono-wrap {
      width: 44px;
      height: 44px;
      border-radius: 999px;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: var(--fondo, #F3F0E8);
      color: var(--texto, #17171A);
    }
    .medalla-card.obtenida .medalla-icono-wrap {
      background-color: var(--lima, #C8F03C);
      color: #17171A;
    }
    .medalla-nombre {
      font-size: 14px;
      font-weight: 700;
      color: var(--texto, #17171A);
      line-height: 1.2;
    }
    .medalla-desc {
      font-size: 11px;
      color: var(--sutil, #6B675F);
      line-height: 1.35;
      word-break: break-word;
    }
    .medalla-fecha {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--texto, #17171A);
      margin-top: auto;
    }
    .medalla-barra-prog {
      width: 100%;
      height: 4px;
      background: rgba(23,23,26,0.1);
      border-radius: 999px;
      overflow: hidden;
      margin-top: auto;
    }
    .medalla-barra-fill {
      height: 100%;
      background: var(--texto, #17171A);
      border-radius: 999px;
    }
  `);
  pantalla.appendChild(estilo);

  const logros = await calcularLogros();

  // ------------------------------------------
  // (1) «Mi camino»
  // ------------------------------------------
  const { camino } = logros;
  let titularCaminoNodo;
  if (camino.metaNombre && camino.diasRestantes !== null) {
    titularCaminoNodo = h('h3', { class: 'titular-camino-serif' },
      'Faltan ',
      h('em', {}, `${camino.diasRestantes} días`),
      ` para ${camino.metaNombre}`
    );
  } else if (camino.metaNombre) {
    titularCaminoNodo = h('h3', { class: 'titular-camino-serif' },
      'Meta: ',
      h('em', {}, camino.metaNombre)
    );
  } else {
    titularCaminoNodo = h('h3', { class: 'titular-camino-serif' },
      'Ponle fecha a tu meta en Ajustes'
    );
  }

  const pctSemanas = camino.semanasTotales > 0
    ? Math.min(100, Math.round((camino.semanasCumplidas / camino.semanasTotales) * 100))
    : 0;

  const txtPeso = `${camino.pesoInicio !== null ? camino.pesoInicio : '—'} kg → ${camino.pesoActual !== null ? camino.pesoActual : '—'} kg`;
  let badgePeso = null;
  if (camino.pesoInicio !== null && camino.pesoActual !== null) {
    const diffP = Math.round((camino.pesoActual - camino.pesoInicio) * 10) / 10;
    const signo = diffP > 0 ? `+${diffP}` : `${diffP}`;
    badgePeso = h('span', { class: 'caja-medida-cambio' }, `${signo} kg`);
  }

  const txtCintura = `${camino.cinturaInicio !== null ? camino.cinturaInicio : '—'} cm → ${camino.cinturaActual !== null ? camino.cinturaActual : '—'} cm`;
  let badgeCintura = null;
  if (camino.cinturaInicio !== null && camino.cinturaActual !== null) {
    const diffC = Math.round((camino.cinturaActual - camino.cinturaInicio) * 10) / 10;
    const signoC = diffC > 0 ? `+${diffC}` : `${diffC}`;
    badgeCintura = h('span', { class: 'caja-medida-cambio' }, `${signoC} cm`);
  }

  const hitosNodos = camino.hitos.map(ht => {
    return h('div', { class: `hito-item ${ht.hecho ? 'hecho' : 'pendiente'}` },
      ht.hecho
        ? h('div', { class: 'hito-check' }, icono('check', 14))
        : h('div', { class: 'hito-circulo' }),
      h('span', {}, ht.texto)
    );
  });

  const seccionCamino = h('section', { class: 'seccion-logros' },
    h('h2', { class: 'titulo-seccion-logros' }, 'Mi camino'),
    h('div', { class: 'tarjeta-camino' },
      titularCaminoNodo,
      h('div', { class: 'fila-prog-semanas' },
        h('div', { class: 'texto-semanas' },
          h('span', {}, `Semana ${camino.semanasCumplidas} cumplida`),
          h('span', { style: 'color: var(--sutil, #6B675F);' }, `de ${camino.semanasTotales}`)
        ),
        h('div', { class: 'barra-camino-track' },
          h('div', { class: 'barra-camino-fill', style: `width: ${pctSemanas}%;` })
        )
      ),
      h('div', { class: 'grid-medidas-camino' },
        h('div', { class: 'caja-medida' },
          h('span', { class: 'caja-medida-label' }, 'Peso corporal'),
          h('div', { class: 'caja-medida-valor' },
            h('span', {}, txtPeso),
            badgePeso
          )
        ),
        h('div', { class: 'caja-medida' },
          h('span', { class: 'caja-medida-label' }, 'Cintura'),
          h('div', { class: 'caja-medida-valor' },
            h('span', {}, txtCintura),
            badgeCintura
          )
        )
      ),
      h('div', { style: 'margin-top: 4px;' },
        h('span', { class: 'caja-medida-label' }, 'Hitos alcanzados'),
        h('div', { class: 'lista-hitos-camino' }, ...hitosNodos)
      )
    )
  );
  pantalla.appendChild(seccionCamino);

  // ------------------------------------------
  // (2) «Nivel y medallas»
  // ------------------------------------------
  const xpSigTexto = logros.xpSiguiente === Infinity ? 'Nivel máximo' : `${logros.xpNivel} / ${logros.xpSiguiente} XP`;
  const tarjetaNivelHero = h('div', { class: 'tarjeta-nivel-hero' },
    h('div', { class: 'nivel-hero-fila' },
      h('div', { class: 'nivel-numero-gigante' }, String(logros.nivel)),
      h('div', { class: 'nivel-hero-datos' },
        h('div', { style: 'color: var(--sutil, #6B675F); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;' }, `Nivel ${logros.nivel}`),
        h('h3', { class: 'nivel-nombre-titular' }, logros.nombreNivel),
        h('span', { class: 'nivel-xp-sub' }, `${logros.xp} XP acumulada · ${xpSigTexto}`)
      )
    ),
    h('div', { class: 'fila-prog-semanas' },
      h('div', { class: 'texto-semanas' },
        h('span', {}, 'Progreso del nivel'),
        h('span', {}, `${Math.round(logros.porcentaje)}%`)
      ),
      h('div', { class: 'barra-camino-track', style: 'height: 8px;' },
        h('div', { class: 'barra-camino-fill', style: `width: ${logros.porcentaje}%;` })
      )
    )
  );

  const medallasObtenidasCount = logros.medallas.filter(m => m.obtenida).length;
  const medallasNodos = logros.medallas.map(med => {
    const nodoIcono = obtenerIcono(med.icono, 22);
    if (med.obtenida) {
      return h('div', { class: 'medalla-card obtenida' },
        h('div', { class: 'medalla-icono-wrap' }, nodoIcono),
        h('div', { class: 'medalla-nombre' }, med.nombre),
        h('div', { class: 'medalla-desc' }, med.descripcion),
        med.fecha ? h('div', { class: 'medalla-fecha' }, fechaBonita(med.fecha) || med.fecha) : null
      );
    } else {
      const pctMed = Math.round((med.progreso || 0) * 100);
      return h('div', { class: 'medalla-card bloqueada' },
        h('div', { class: 'medalla-icono-wrap' }, nodoIcono),
        h('div', { class: 'medalla-nombre' }, med.nombre),
        h('div', { class: 'medalla-desc' }, med.descripcion),
        h('div', { class: 'medalla-barra-prog' },
          h('div', { class: 'medalla-barra-fill', style: `width: ${pctMed}%;` })
        )
      );
    }
  });

  const seccionNivelMedallas = h('section', { class: 'seccion-logros' },
    h('h2', { class: 'titulo-seccion-logros' }, 'Nivel y medallas'),
    tarjetaNivelHero,
    h('div', { style: 'display: flex; justify-content: space-between; align-items: baseline; margin-top: 6px;' },
      h('h3', { style: 'font-size: 15px; font-weight: 700; margin: 0;' }, 'Tus medallas'),
      h('span', { style: 'font-size: 13px; color: var(--sutil, #6B675F); font-weight: 600;' }, `${medallasObtenidasCount} de ${logros.medallas.length}`)
    ),
    h('div', { class: 'grid-medallas-forja' }, ...medallasNodos)
  );
  pantalla.appendChild(seccionNivelMedallas);

  contenedor.appendChild(pantalla);
}

/**
 * Función opcional de desmontaje.
 */
export function desmontar() {
  // Limpieza si fuera necesario
}

/**
 * Tarjeta pequeña para incrustar en la pantalla Hoy.
 * Muestra «Nivel X · Nombre», barra de XP y enlace «Ver logros».
 * @returns {Promise<HTMLElement>}
 */
export async function tarjetaNivel() {
  const logros = await calcularLogros();

  const estiloTarjeta = 'background-color: var(--superficie2, #E9E4D8); border-radius: 28px; padding: 18px 20px; display: flex; flex-direction: column; gap: 10px; cursor: pointer; text-decoration: none; color: inherit;';

  return h('div', {
    class: 'tarjeta tarjeta-nivel-widget',
    style: estiloTarjeta,
    on: { click: () => ir('#logros') }
  },
    h('div', { style: 'display: flex; justify-content: space-between; align-items: baseline;' },
      h('div', { style: 'display: flex; align-items: center; gap: 8px;' },
        obtenerIcono('yunque', 18),
        h('span', { style: 'font-weight: 700; font-size: 15px; color: var(--texto, #17171A);' }, `Nivel ${logros.nivel} · ${logros.nombreNivel}`)
      ),
      h('span', { style: 'font-size: 13px; font-weight: 700; color: var(--texto, #17171A);' }, `${Math.round(logros.porcentaje)}%`)
    ),
    h('div', { style: 'width: 100%; height: 6px; background-color: rgba(23, 23, 26, 0.08); border-radius: 999px; overflow: hidden;' },
      h('div', { style: `width: ${logros.porcentaje}%; height: 100%; background-color: var(--lima, #C8F03C); border-radius: 999px;` })
    ),
    h('div', { style: 'display: flex; justify-content: space-between; align-items: center;' },
      h('span', { style: 'font-size: 12px; color: var(--sutil, #6B675F);' }, `${logros.xp} XP acumulada`),
      h('span', { style: 'font-size: 13px; font-weight: 700; color: var(--texto, #17171A); text-decoration: underline;' }, 'Ver logros')
    )
  );
}

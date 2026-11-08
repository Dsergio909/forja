// js/calculos.js - Funciones puras de cálculo para «Forja»
// Sin dependencias de DOM, portables y probables de forma aislada.

import { FORMULA_1RM } from './config.js';

/**
 * Normaliza nombres de músculos a formato canónico:
 * - Siempre en minúsculas
 * - Sin tildes / acentos diacríticos
 * - Sinónimos unificados ('dorsales' → 'dorsal ancho', 'deltoides lateral' consistente,
 *   'pecho' → 'pectoral', 'biceps' sin tilde, 'triceps' sin tilde, etc.)
 * para que no se fracturen ni dupliquen las barras de progreso.
 *
 * @param {string} nombre - Nombre del músculo a normalizar
 * @returns {string} Nombre canónico normalizado
 */
export function normalizarMusculo(nombre) {
  if (!nombre || typeof nombre !== 'string') return '';

  // Limpiar, pasar a minúsculas y remover acentos
  const limpio = nombre
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

  if (!limpio) return '';

  // 1. Mapeo directo de casos específicos y sinónimos frecuentes
  // Dorsal ancho
  if (
    limpio === 'dorsales' ||
    limpio === 'dorsal' ||
    limpio === 'dorsal ancho' ||
    limpio === 'lat' ||
    limpio === 'lats' ||
    limpio === 'latissimus' ||
    limpio === 'espalda'
  ) {
    return 'dorsal ancho';
  }

  // Pectoral / Pecho
  if (
    limpio === 'pecho' ||
    limpio === 'pectorales' ||
    limpio === 'pectoral' ||
    limpio === 'pectoral mayor' ||
    limpio === 'pectoral menor' ||
    limpio === 'chest'
  ) {
    return 'pectoral';
  }

  // Deltoides lateral / hombro medio
  if (
    limpio === 'deltoides lateral' ||
    limpio === 'deltoide lateral' ||
    limpio === 'deltoides lat' ||
    limpio === 'deltoides medio' ||
    limpio === 'deltoide medio' ||
    limpio === 'hombro lateral' ||
    limpio === 'hombro medio' ||
    limpio === 'side delt' ||
    limpio === 'hombro' ||
    limpio === 'hombros' ||
    limpio === 'deltoides'
  ) {
    return 'deltoides lateral';
  }

  // Deltoides anterior
  if (
    limpio === 'deltoides anterior' ||
    limpio === 'deltoide anterior' ||
    limpio === 'deltoides ant' ||
    limpio === 'hombro anterior' ||
    limpio === 'front delt'
  ) {
    return 'deltoides anterior';
  }

  // Deltoides posterior
  if (
    limpio === 'deltoides posterior' ||
    limpio === 'deltoide posterior' ||
    limpio === 'deltoides post' ||
    limpio === 'hombro posterior' ||
    limpio === 'rear delt'
  ) {
    return 'deltoides posterior';
  }

  // Bíceps
  if (
    limpio === 'biceps' ||
    limpio === 'biceps braquial' ||
    limpio === 'brazo' ||
    limpio === 'brazos' ||
    limpio.startsWith('biceps braquial') ||
    limpio === 'braquial' ||
    limpio === 'braquial anterior'
  ) {
    return 'biceps';
  }

  // Tríceps
  if (limpio === 'triceps' || limpio === 'tricep' || limpio === 'triceps braquial') {
    return 'triceps';
  }

  // Antebrazo
  if (
    limpio === 'antebrazo' ||
    limpio === 'antebrazos' ||
    limpio === 'braquiorradial' ||
    limpio === 'forearm' ||
    limpio === 'forearms' ||
    limpio.includes('flexores de los dedos') ||
    limpio.includes('agarre')
  ) {
    return 'antebrazo';
  }

  // Trapecio
  if (
    limpio === 'trapecio' ||
    limpio === 'trapecios' ||
    limpio === 'trapecio superior' ||
    limpio === 'trapecio medio' ||
    limpio === 'trapecio inferior' ||
    limpio === 'traps'
  ) {
    return 'trapecio';
  }

  // Romboides / espalda alta
  if (
    limpio === 'romboides' ||
    limpio === 'romboide' ||
    limpio === 'espalda media' ||
    limpio === 'espalda alta' ||
    limpio === 'espalda superior' ||
    limpio === 'rhomboids'
  ) {
    return 'romboides';
  }

  // Erectores / lumbar
  if (
    limpio === 'erectores' ||
    limpio === 'erector' ||
    limpio === 'erectores de la columna' ||
    limpio === 'erectores espinales' ||
    limpio === 'lumbar' ||
    limpio === 'lumbares' ||
    limpio === 'espalda baja' ||
    limpio === 'lower back'
  ) {
    return 'erectores';
  }

  // Abdomen
  if (
    limpio === 'abdomen' ||
    limpio === 'abdominales' ||
    limpio === 'recto abdominal' ||
    limpio === 'abs' ||
    limpio === 'core' ||
    limpio === 'panza'
  ) {
    return 'abdomen';
  }

  // Oblicuos
  if (
    limpio === 'oblicuos' ||
    limpio === 'oblicuo' ||
    limpio === 'oblicuo externo' ||
    limpio === 'oblicuos externos' ||
    limpio === 'cintura'
  ) {
    return 'oblicuos';
  }

  // Glúteos
  if (limpio === 'gluteo' || limpio === 'gluteos' || limpio === 'gluteo mayor' || limpio === 'glutes') {
    return 'gluteo';
  }

  // Cuádriceps
  if (
    limpio === 'cuadriceps' ||
    limpio === 'muslo' ||
    limpio === 'muslos' ||
    limpio === 'piernas' ||
    limpio === 'pierna' ||
    limpio === 'quads'
  ) {
    return 'cuadriceps';
  }

  // Isquiotibiales / femoral
  if (
    limpio === 'isquiotibiales' ||
    limpio === 'isquiotibial' ||
    limpio === 'isquios' ||
    limpio === 'isquiosurales' ||
    limpio === 'femoral' ||
    limpio === 'femorales' ||
    limpio === 'biceps femoral' ||
    limpio === 'hamstrings'
  ) {
    return 'isquiotibiales';
  }

  // Aductores
  if (limpio === 'aductores' || limpio === 'aductor' || limpio === 'adductor' || limpio === 'adductors') {
    return 'aductores';
  }

  // Abductores (glúteo medio / menor)
  if (
    limpio === 'abductores' ||
    limpio === 'abductor' ||
    limpio === 'abductors' ||
    limpio === 'gluteo medio' ||
    limpio === 'gluteo menor'
  ) {
    return 'abductores';
  }

  // Gemelos / pantorrilla
  if (
    limpio === 'gemelos' ||
    limpio === 'gemelo' ||
    limpio === 'pantorrilla' ||
    limpio === 'pantorrillas' ||
    limpio === 'gastrocnemio' ||
    limpio === 'soleo' ||
    limpio === 'calves'
  ) {
    return 'gemelos';
  }

  // Cuello
  if (limpio === 'cuello' || limpio === 'cervical' || limpio === 'cervicales' || limpio === 'neck') {
    return 'cuello';
  }

  // 2. Búsqueda por subcadenas inteligentes
  if (limpio.includes('dorsal')) return 'dorsal ancho';
  if (limpio.includes('pectoral')) return 'pectoral';
  if (limpio.includes('trapecio')) return 'trapecio';
  if (limpio.includes('cuadriceps')) return 'cuadriceps';
  if (limpio.includes('isquio') || limpio.includes('femoral')) return 'isquiotibiales';
  if (limpio.includes('gluteo')) {
    return (limpio.includes('medio') || limpio.includes('menor')) ? 'abductores' : 'gluteo';
  }
  if (limpio.includes('gemelo') || limpio.includes('pantorrilla')) return 'gemelos';
  if (limpio.includes('antebrazo')) return 'antebrazo';
  if (limpio.includes('deltoides') || limpio.includes('hombro')) {
    if (limpio.includes('ant')) return 'deltoides anterior';
    if (limpio.includes('post')) return 'deltoides posterior';
    return 'deltoides lateral';
  }
  if (limpio.includes('biceps')) return 'biceps';
  if (limpio.includes('triceps')) return 'triceps';

  return limpio;
}

/**
 * Estima el 1RM usando la fórmula de Epley:
 * 1RM = kg * (1 + reps / 30)
 * Si reps === 1, retorna el mismo peso.
 * Redondea a 1 decimal.
 *
 * @param {number|null} kg - Peso levantado en kg (null o <= 0 retorna 0)
 * @param {number} reps - Número de repeticiones realizadas
 * @returns {number} 1RM estimado en kg
 */
export function epley(kg, reps) {
  if (kg == null || isNaN(kg) || kg <= 0) return 0;
  const r = Number(reps);
  if (isNaN(r) || r <= 0) return 0;
  if (r === 1) return Math.round(Number(kg) * 10) / 10;
  const resultado = Number(kg) * (1 + r / 30);
  return Math.round(resultado * 10) / 10;
}

/**
 * Estima el 1RM usando la fórmula de Brzycki:
 * 1RM = kg * (36 / (37 - reps))
 * Si reps === 1, retorna el mismo peso.
 * Si reps >= 36, utiliza la proyección lineal de Epley para evitar asíntotas irreales.
 * Redondea a 1 decimal.
 *
 * @param {number|null} kg - Peso levantado en kg
 * @param {number} reps - Número de repeticiones realizadas
 * @returns {number} 1RM estimado en kg
 */
export function brzycki(kg, reps) {
  if (kg == null || isNaN(kg) || kg <= 0) return 0;
  const r = Number(reps);
  if (isNaN(r) || r <= 0) return 0;
  if (r === 1) return Math.round(Number(kg) * 10) / 10;
  if (r >= 36) return epley(kg, r);
  const resultado = Number(kg) * (36 / (37 - r));
  return Math.round(resultado * 10) / 10;
}

/**
 * Estima el 1RM según la fórmula configurada en config.FORMULA_1RM ('epley' | 'brzycki').
 *
 * @param {number|null} kg - Peso levantado
 * @param {number} reps - Repeticiones
 * @returns {number} 1RM estimado
 */
export function unoRM(kg, reps) {
  const formula = typeof FORMULA_1RM === 'string' ? FORMULA_1RM.toLowerCase() : 'epley';
  if (formula === 'brzycki') {
    return brzycki(kg, reps);
  }
  return epley(kg, reps);
}

/**
 * Parsea un rango de repeticiones en formato texto o numérico.
 * Ejemplos: '6-8' → {min:6, max:8}, '3 x 6-8' → {min:6, max:8}, '3-4 x 8-10' → {min:8, max:10}, '10' → {min:10, max:10}
 *
 * @param {string|number} texto
 * @returns {{min: number, max: number}}
 */
export function rangoReps(texto) {
  if (texto == null) return { min: 8, max: 12 };
  if (typeof texto === 'number') {
    return { min: texto, max: texto };
  }
  let str = String(texto).trim();

  // Si contiene separador de series 'x' o '×', tomamos lo que sigue después
  if (str.includes('x') || str.includes('×')) {
    const partes = str.split(/[x×]/);
    str = partes[partes.length - 1].trim();
  }

  // Busca patrones como '6-8', '6 - 8', '6 a 8'
  const matchRango = str.match(/(\d+)\s*[-–—a]\s*(\d+)/i);
  if (matchRango) {
    const r1 = parseInt(matchRango[1], 10);
    const r2 = parseInt(matchRango[2], 10);
    return {
      min: Math.min(r1, r2),
      max: Math.max(r1, r2)
    };
  }

  // Si viene solo un número (ej. '10' o '10 reps')
  const matchSolo = str.match(/(\d+)/);
  if (matchSolo) {
    const n = parseInt(matchSolo[1], 10);
    return { min: n, max: n };
  }

  return { min: 8, max: 12 };
}

/**
 * Calcula el peso y repeticiones sugeridas para la próxima sesión mediante doble progresión:
 * - Sin historial: kg: null y motivo 'Elige un peso con el que llegues a X reps dejando 1-2 en reserva'.
 * - Si en la última sesión NO llegó al tope del rango de reps en TODAS las series prescritas:
 *     El kg sugerido es el MISMO de la última sesión.
 *     CORRECCIÓN (logica ALTO-02): Debe sugerir +1 repetición sobre la base alcanzada,
 *     NO saltar de golpe al tope del rango (rango.max), con límite superior en rango.max.
 *     Motivo: 'Mismo peso: busca +1 rep'.
 * - Solo sube peso si se completaron todas las series prescritas y todas llegaron al tope:
 *     En placas sube de a 1 placa.
 *     En kg sube 2.5 kg (o 1-2 kg en mancuernas) y reinicia al piso de reps (rango.min).
 * - Respeta el campo unidad ('kg'|'placa') y nunca mezcla series de distinta unidad o distinta máquina.
 *
 * @param {Array<object>} seriesUltimaSesion - Series de la última sesión [{kg, reps, porLado, unidad, maquina, ...}]
 * @param {object} ejercicio - Datos del ejercicio o rutina (equipo, reps, series, series_reps_hipertrofia, etc.)
 * @returns {{kg: number|null, reps: number, motivo: string, porLado?: boolean, unidad?: string}}
 */
export function pesoSugerido(seriesUltimaSesion, ejercicio = {}) {
  // Rango objetivo del ejercicio
  const textoRango = ejercicio?.reps || ejercicio?.series_reps_hipertrofia || '8-12';
  const rango = rangoReps(textoRango);
  const equipo = (ejercicio?.equipo || '').toLowerCase();
  const nombre = (ejercicio?.nombre || '').toLowerCase();

  // Caso: Sin historial
  if (!seriesUltimaSesion || !Array.isArray(seriesUltimaSesion) || seriesUltimaSesion.length === 0) {
    return {
      kg: null,
      reps: rango.min,
      unidad: 'kg',
      motivo: `Elige un peso con el que llegues a ${rango.min} reps dejando 1-2 en reserva`
    };
  }

  // Asegurar orden cronológico ascendente si las series incluyen marca de hora
  const seriesOrdenadas = seriesUltimaSesion.slice().sort((a, b) => (a?.hora || 0) - (b?.hora || 0));

  // Tomamos como referencia la última serie realizada para determinar configuración (unidad y máquina)
  const ultima = seriesOrdenadas[seriesOrdenadas.length - 1];
  const unidadReferencia = (ultima.unidad === 'placa') ? 'placa' : 'kg';
  const maquinaReferencia = (ultima.maquina || '').trim();

  // Filtrar series de la última sesión para nunca mezclar series de distinta unidad o distinta máquina
  const seriesValidas = seriesOrdenadas.filter(s => {
    const u = (s.unidad === 'placa') ? 'placa' : 'kg';
    const m = (s.maquina || '').trim();
    return u === unidadReferencia && m === maquinaReferencia;
  });

  const seriesAEvaluar = seriesValidas.length > 0 ? seriesValidas : [ultima];
  const serieRef = seriesAEvaluar[seriesAEvaluar.length - 1];

  const kgActual = serieRef.kg != null ? Number(serieRef.kg) : null;
  const porLado = !!serieRef.porLado;
  const unidad = unidadReferencia;

  // Exigir que se hayan completado todas las series prescritas y que TODAS llegaran al tope
  const seriesPrescritas = Number(ejercicio?.series) || 3;
  const tieneVolumenCompleto = seriesAEvaluar.length >= seriesPrescritas;
  const todasAlTope = tieneVolumenCompleto && seriesAEvaluar.every(s => Number(s.reps || 0) >= rango.max);

  // Si NO llegó al tope en TODAS las series prescritas: mantener el mismo peso y buscar +1 rep
  // CORRECCIÓN (logica ALTO-02): Sugerir +1 rep sobre lo logrado en la sesión, NO saltar al tope del rango.
  if (!todasAlTope) {
    const repsUltima = Number(serieRef.reps || 0);
    const baseReps = repsUltima > 0 ? repsUltima : rango.min;
    // Sugiere +1 rep, asegurando que esté en el intervalo [rango.min, rango.max]
    const repsSugeridas = Math.min(rango.max, Math.max(rango.min, baseReps + 1));

    return {
      kg: kgActual,
      reps: repsSugeridas,
      porLado,
      unidad,
      motivo: 'Mismo peso: busca +1 rep'
    };
  }

  // Si todas llegaron al tope de repeticiones en todas las series prescritas:
  // Caso 1: En placas sube de a 1 placa
  if (unidad === 'placa') {
    const placaActual = kgActual != null ? kgActual : 1;
    const nuevaPlaca = placaActual + 1;
    return {
      kg: nuevaPlaca,
      reps: rango.min,
      porLado: false,
      unidad: 'placa',
      motivo: `Subiste 1 placa (placa ${nuevaPlaca}): completaste el tope de ${rango.max} reps en todas las series.`
    };
  }

  // Caso 2: Ejercicio con peso corporal (sin kg adicionales)
  if (kgActual === null) {
    return {
      kg: null,
      reps: rango.max + 1,
      porLado: false,
      unidad: 'kg',
      motivo: `Llegaste al tope de ${rango.max} reps en todas las series: busca +1 rep o agrega lastre si es posible.`
    };
  }

  // Caso 3: En kilos sube según equipo
  let incremento = 2.5;
  if (equipo.includes('mancuerna') || nombre.includes('mancuerna')) {
    incremento = porLado ? 1 : 2;
  } else if (equipo.includes('polea') || equipo.includes('maquina') || equipo.includes('máquina')) {
    incremento = 2.5;
  } else {
    incremento = 2.5; // Barra o discos por defecto
  }

  const nuevoKg = Math.round((kgActual + incremento) * 10) / 10;
  const etiquetaKg = porLado ? `${nuevoKg} kg/lado` : `${nuevoKg} kg`;

  return {
    kg: nuevoKg,
    reps: rango.min,
    porLado,
    unidad: 'kg',
    motivo: `Subiste ${incremento} kg (${etiquetaKg}): completaste el tope de ${rango.max} reps en todas las series.`
  };
}

/**
 * Cuenta las series duras por grupo muscular (principal: 1, secundario: 0.5).
 * Normaliza nombres de músculo a minúsculas, sin tildes y con sinónimos unificados
 * (ej. 'dorsales' → 'dorsal ancho', 'deltoides lateral' consistente, 'pecho' → 'pectoral', 'biceps' sin tilde).
 * Criterio de serie dura: rir <= 3 || fallo === true || rir == null (si no se marcó rir, se asume serie efectiva).
 *
 * @param {Array<object>} series - Lista de series de la base de datos
 * @param {Array<object>|Map|object} ejercicios - Catálogo de ejercicios
 * @param {string} [desdeISO] - Fecha mínima en formato 'AAAA-MM-DD'
 * @returns {Record<string, number>} Objeto { [musculo]: totalSeries }
 */
export function seriesPorMusculo(series, ejercicios, desdeISO) {
  const resultado = {};
  if (!series || !Array.isArray(series)) return resultado;

  // Mapa rápido de ejercicios por id
  let mapEjercicios;
  if (ejercicios instanceof Map) {
    mapEjercicios = ejercicios;
  } else if (Array.isArray(ejercicios)) {
    mapEjercicios = new Map(ejercicios.map(e => [e.id, e]));
  } else if (ejercicios && typeof ejercicios === 'object') {
    mapEjercicios = new Map(Object.entries(ejercicios));
  } else {
    mapEjercicios = new Map();
  }

  for (const s of series) {
    if (!s || !s.ejercicioId) continue;
    // Filtro por fecha si se especificó (descarta también series sin fecha)
    if (desdeISO && (!s.fecha || s.fecha < desdeISO)) continue;

    // Filtro de serie dura: rir <= 3 o fallo === true o rir null/indefinido
    const esDura =
      s.fallo === true ||
      s.rir === null ||
      s.rir === undefined ||
      (typeof s.rir === 'number' && s.rir <= 3);

    if (!esDura) continue;

    const ej = mapEjercicios.get(s.ejercicioId);
    if (!ej) continue;

    // Músculos principales: 1 punto por serie (deduplicados por grupo para evitar inflar por subdivisiones)
    const princSet = new Set();
    if (Array.isArray(ej.musculos_principales)) {
      for (const m of ej.musculos_principales) {
        if (!m) continue;
        const norm = normalizarMusculo(m);
        if (norm) princSet.add(norm);
      }
    }
    for (const m of princSet) {
      resultado[m] = (resultado[m] || 0) + 1;
    }

    // Músculos secundarios: 0.5 puntos por serie (deduplicados y sin solapar principales)
    const secSet = new Set();
    if (Array.isArray(ej.musculos_secundarios)) {
      for (const m of ej.musculos_secundarios) {
        if (!m) continue;
        const norm = normalizarMusculo(m);
        if (norm && !princSet.has(norm)) secSet.add(norm);
      }
    }
    for (const m of secSet) {
      resultado[m] = (resultado[m] || 0) + 0.5;
    }
  }

  return resultado;
}

/**
 * Calcula el promedio móvil de una serie temporal de valores.
 *
 * @param {Array<{fecha: string, valor: number}>} valores - Lista con fecha ISO y valor numérico
 * @param {number} [dias=7] - Tamaño de la ventana en días
 * @returns {Array<{fecha: string, valor: number}>} Lista con el promedio móvil calculado
 */
export function promedioMovil(valores, dias = 7) {
  if (!valores || !Array.isArray(valores) || valores.length === 0) return [];

  // Filtrar valores válidos y ordenar cronológicamente
  const ordenados = valores
    .filter(v => v && v.fecha && v.valor != null && !isNaN(Number(v.valor)))
    .map(v => ({ fecha: String(v.fecha), valor: Number(v.valor) }))
    .sort((a, b) => (a.fecha > b.fecha ? 1 : a.fecha < b.fecha ? -1 : 0));

  if (ordenados.length === 0) return [];

  const msPorDia = 24 * 60 * 60 * 1000;
  const ventanaMs = dias * msPorDia;

  return ordenados.map((item, idx) => {
    const tActual = new Date(item.fecha + 'T12:00:00').getTime();
    let suma = 0;
    let cuenta = 0;

    // Tomar elementos que caigan en el rango [tActual - ventanaMs + 1, tActual]
    for (let i = 0; i <= idx; i++) {
      const tItem = new Date(ordenados[i].fecha + 'T12:00:00').getTime();
      const diff = tActual - tItem;
      if (diff >= 0 && diff < ventanaMs) {
        suma += ordenados[i].valor;
        cuenta++;
      }
    }

    const promedio = cuenta > 0 ? suma / cuenta : item.valor;
    return {
      fecha: item.fecha,
      valor: Math.round(promedio * 10) / 10
    };
  });
}

/**
 * Calcula la tendencia semanal (kg por semana) usando regresión lineal de los últimos 14 días.
 *
 * @param {Array<{fecha: string, valor: number}>} valores - Medidas de peso
 * @returns {number|null} Cambio en kg/semana o null si no hay suficientes datos
 */
export function tendenciaSemanal(valores) {
  if (!valores || !Array.isArray(valores) || valores.length < 2) return null;

  const validos = valores
    .filter(v => v && v.fecha && v.valor != null && !isNaN(Number(v.valor)))
    .map(v => ({ fecha: String(v.fecha), valor: Number(v.valor) }))
    .sort((a, b) => (a.fecha > b.fecha ? 1 : a.fecha < b.fecha ? -1 : 0));

  if (validos.length < 2) return null;

  // Filtrar últimos 14 días con respecto a la fecha más reciente registrada
  const ultimaFecha = new Date(validos[validos.length - 1].fecha + 'T12:00:00').getTime();
  const limiteMs = 14 * 24 * 60 * 60 * 1000;

  const enVentana = validos.filter(v => {
    const t = new Date(v.fecha + 'T12:00:00').getTime();
    return (ultimaFecha - t) <= limiteMs;
  });

  if (enVentana.length < 2) return null;

  const t0 = new Date(enVentana[0].fecha + 'T12:00:00').getTime();
  const puntos = enVentana.map(p => ({
    x: (new Date(p.fecha + 'T12:00:00').getTime() - t0) / (24 * 60 * 60 * 1000), // días desde t0
    y: p.valor
  }));

  const n = puntos.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (const pt of puntos) {
    sumX += pt.x;
    sumY += pt.y;
    sumXY += pt.x * pt.y;
    sumX2 += pt.x * pt.x;
  }

  const denominador = n * sumX2 - sumX * sumX;
  if (denominador === 0) return null; // Todos los puntos en el mismo día

  // Pendiente en kg/día
  const pendienteDia = (n * sumXY - sumX * sumY) / denominador;
  // Tendencia por semana (7 días)
  const pendienteSemanal = pendienteDia * 7;

  return Math.round(pendienteSemanal * 100) / 100;
}

/**
 * Estima el porcentaje de grasa corporal según la fórmula de la Marina de EE. UU. (hombres):
 * % grasa = 86.010 * log10(cintura - cuello) - 70.041 * log10(estatura) + 36.76 (en pulgadas)
 *
 * @param {number|null} cinturaCm - Medida de cintura en cm
 * @param {number|null} cuelloCm - Medida de cuello en cm
 * @param {number|null} estaturaCm - Estatura en cm
 * @returns {number|null} % de grasa corporal estimado o null si los datos son inválidos
 */
export function grasaNavy(cinturaCm, cuelloCm, estaturaCm) {
  if (cinturaCm == null || cuelloCm == null || estaturaCm == null) return null;

  const cintura = Number(cinturaCm);
  const cuello = Number(cuelloCm);
  const estatura = Number(estaturaCm);

  if (isNaN(cintura) || isNaN(cuello) || isNaN(estatura)) return null;
  if (cintura <= 0 || cuello <= 0 || estatura <= 0) return null;
  if (cintura <= cuello) return null; // Cintura debe superar al cuello

  // Convertir cm a pulgadas (1 pulgada = 2.54 cm)
  const diffPulgadas = (cintura - cuello) / 2.54;
  const estaturaPulgadas = estatura / 2.54;

  if (diffPulgadas <= 0 || estaturaPulgadas <= 0) return null;

  const grasa = 86.010 * Math.log10(diffPulgadas) - 70.041 * Math.log10(estaturaPulgadas) + 36.76;

  if (isNaN(grasa) || grasa < 2 || grasa > 60) return null;

  return Math.round(grasa * 10) / 10;
}

/**
 * Obtiene los récords personales (PR) históricos de cada ejercicio a partir de las series.
 * Determina el PR en base al mayor 1RM estimado, mayor peso si el 1RM es igual,
 * o mayor número de repeticiones cuando el peso es igual o nulo (peso corporal).
 *
 * @param {Array<object>} series - Lista de series de la base de datos
 * @returns {Record<string, {kg: number|null, porLado?: boolean, unidad?: string, reps: number, unoRM: number, fecha: string}>}
 */
export function prs(series) {
  const mapaPRs = {};
  if (!series || !Array.isArray(series)) return mapaPRs;

  for (const s of series) {
    if (!s || !s.ejercicioId) continue;
    const reps = Number(s.reps || 0);
    if (reps <= 0) continue;

    const kg = s.kg != null ? Number(s.kg) : null;
    const porLado = !!s.porLado;
    const unidad = s.unidad === 'placa' ? 'placa' : 'kg';

    // Si es por lado, para estimar 1RM representativo consideramos el peso de ambos lados
    const kgPara1RM = kg != null ? (porLado ? kg * 2 : kg) : 0;
    const estimado = unoRM(kgPara1RM, reps);

    const actual = mapaPRs[s.ejercicioId];
    const esMejor1RM = estimado > (actual?.unoRM || 0);
    const mismo1RM = actual && estimado === actual.unoRM;
    const masKilos = (kg || 0) > (actual?.kg || 0);
    const mismosKilos = (kg || 0) === (actual?.kg || 0);
    const masReps = reps > (actual?.reps || 0);

    if (!actual || esMejor1RM || (mismo1RM && masKilos) || (mismo1RM && mismosKilos && masReps)) {
      mapaPRs[s.ejercicioId] = {
        kg,
        porLado,
        unidad,
        reps,
        unoRM: estimado,
        fecha: s.fecha || ''
      };
    }
  }

  return mapaPRs;
}

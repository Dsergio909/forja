/**
 * js/parser.js — Parser de texto libre en lenguaje natural para registrar series.
 * Función pura, sin DOM, sin efectos secundarios.
 *
 * Cumple con todos los contratos de CONTRATOS.md y los ejemplos de ENCARGO_APP.md (Sección 2):
 * - jalon 45 6 6 5 -> jalón al pecho, 45 kg, 3 series de 6, 6 y 5
 * - dominadas x6 x6 x4 / dominadas 6,6,4 / dominadas 8 8 -> peso corporal
 * - bayesiano 10kg 6 6, 7.5kg 7 / bayesiano 7,5 8 8 -> dos pesos distintos y coma decimal
 * - dorian 40/lado 6 6 5, hoy solo hice 4 en martillo con 10 -> múltiples ejercicios en un mensaje
 * - 4 de 8 en martillo con 10 -> curl_martillo_mancuernas, 4 series de 8 reps con 10 kg
 * - hoy hice 12 series de 3 en jalon con 40 -> 12 series de 3 reps con 40 kg
 * - bayesiano 3x10 con 20 -> 3 series de 10 reps con 20 kg
 * - 12 series de 3 -> 12 series de 3 reps (ejercicioId null y duda)
 * - 4 de 8 -> 4 series de 8 reps (ejercicioId null y duda)
 * - 3x10 con 20 -> 3 series de 10 reps con 20 kg (ejercicioId null y duda)
 * - hice dominadas 7 6 5 y luego jalon con 50 kilos 8 8 -> separación por conectores
 * - tricep polea torre 2 40 9 -> nota de máquina «torre 2»
 * - femoral placa 5 8 8 7 -> máquinas de placas (unidad 'placa')
 */

/**
 * Normaliza un texto para búsqueda: minúsculas, sin tildes, caracteres alfanuméricos y espacios.
 * @param {string} str
 * @returns {string}
 */
function normalizar(str) {
  if (!str) return '';
  return str.toString().toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

/**
 * Calcula la distancia de Levenshtein entre dos cadenas.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function distanciaLevenshtein(a, b) {
  if (a === b) return 0;
  const la = a.length, lb = b.length;
  if (!la) return lb;
  if (!lb) return la;

  const v0 = Array.from({ length: lb + 1 }, (_, i) => i);
  const v1 = new Array(lb + 1);

  for (let i = 0; i < la; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < lb; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= lb; j++) v0[j] = v1[j];
  }
  return v1[lb];
}

/**
 * Calcula la similitud entre 0 y 1 entre dos cadenas normalizadas.
 * @param {string} q Consulta
 * @param {string} t Objetivo
 * @returns {number}
 */
function similitudTexto(q, t) {
  if (!q || !t) return 0;
  if (q === t) return 1.0;
  if (t.startsWith(q)) return 0.95;
  if (q.startsWith(t)) return 0.90;

  const tPalabras = t.split(' ').filter(Boolean);
  const qPalabras = q.split(' ').filter(Boolean);
  if (tPalabras.includes(q)) return 0.93;
  if (t.includes(q)) return 0.85 + 0.1 * (q.length / t.length);

  // Coincidencia token a token (ej: "tricep polea" vs "extension de triceps en polea")
  if (qPalabras.length > 0 && tPalabras.length > 0) {
    let puntuacionTokens = 0;
    for (const qp of qPalabras) {
      let mejor = 0;
      for (const tp of tPalabras) {
        if (qp === tp) mejor = Math.max(mejor, 1.0);
        else if (tp.startsWith(qp) || qp.startsWith(tp)) mejor = Math.max(mejor, 0.9);
        else {
          const d = distanciaLevenshtein(qp, tp);
          if (d === 1) mejor = Math.max(mejor, 0.85);
          else if (d === 2 && Math.min(qp.length, tp.length) >= 5) mejor = Math.max(mejor, 0.7);
        }
      }
      puntuacionTokens += mejor;
    }
    const ratio = puntuacionTokens / qPalabras.length;
    if (ratio >= 0.75) return 0.75 + 0.2 * ratio;
  }

  const maxLen = Math.max(q.length, t.length);
  return Math.max(0, 1 - distanciaLevenshtein(q, t) / maxLen);
}

/**
 * Busca ejercicios coincidentes ordenados por puntaje.
 * Considera nombre, id, nombre_en, alias, sin tildes y distancia de Levenshtein.
 * @param {string} nombre Texto buscado
 * @param {Array<Object>} listaEjercicios Lista de ejercicios de data/ejercicios.json
 * @returns {Array<{id: string, puntaje: number}>} Ordenado descendente
 */
export function buscarEjercicio(nombre, listaEjercicios = []) {
  if (!nombre || typeof nombre !== 'string' || !Array.isArray(listaEjercicios) || !listaEjercicios.length) {
    return [];
  }
  const qNorm = normalizar(nombre);
  if (!qNorm) return [];

  const resultados = [];
  for (const ej of listaEjercicios) {
    if (!ej || !ej.id) continue;
    let mejor = 0;

    if (ej.nombre) mejor = Math.max(mejor, similitudTexto(qNorm, normalizar(ej.nombre)));
    if (ej.id) mejor = Math.max(mejor, similitudTexto(qNorm, normalizar(ej.id.replace(/[-_]/g, ' '))));
    if (ej.nombre_en) mejor = Math.max(mejor, similitudTexto(qNorm, normalizar(ej.nombre_en)));
    if (Array.isArray(ej.alias)) {
      for (const al of ej.alias) {
        if (al) mejor = Math.max(mejor, similitudTexto(qNorm, normalizar(al)));
      }
    }

    if (mejor >= 0.35) {
      resultados.push({ id: ej.id, puntaje: Number(mejor.toFixed(3)) });
    }
  }
  return resultados.sort((a, b) => b.puntaje - a.puntaje);
}

/**
 * Determina si un ejercicio es predominantemente de peso corporal
 * @param {Object|null} ej
 * @returns {boolean}
 */
function esEjercicioCorporal(ej) {
  if (!ej) return false;
  const texto = normalizar(`${ej.equipo || ''} ${ej.tipo || ''} ${ej.nombre || ''} ${ej.id || ''}`);
  return texto.includes('corporal') || texto.includes('dominada') ||
         texto.includes('fondo') || texto.includes('flexion') ||
         texto.includes('plancha') || texto.includes('colgado') ||
         texto.includes('calistenia');
}

/**
 * Limpia en bucle todas las partículas conversacionales al inicio/final de un candidato a ejercicio.
 * @param {string} str
 * @returns {string}
 */
function limpiarPrefijosConversacionales(str) {
  if (!str) return '';
  let limpio = str.trim();
  const regexPrefijo = /^(?:hoy|ayer|hice|hizo|hicimos|meti|metí|metimos|saque|saqué|pude|pudimos|entrene|entrené|solo|en|el|la|los|las)\s+/i;
  while (regexPrefijo.test(limpio)) {
    limpio = limpio.replace(regexPrefijo, '').trim();
  }
  // Limpiar conectores preposicionales sobrantes al inicio o al final
  limpio = limpio.replace(/^(?:en|con|de)\s+/i, '').trim();
  limpio = limpio.replace(/\s+(?:en|con|de)$/i, '').trim();
  return limpio;
}

/**
 * Parsea un segmento numérico que puede contener reps en formatos como:
 * - "x6 x6 x4" (cada xN es UNA serie de N reps)
 * - "6 6 5"
 * - "6,6,4" o "6, 6, 4"
 * - "3x8" (3 series de 8 reps)
 * @param {string} str
 * @returns {Array<number>}
 */
function extraerReps(str) {
  if (!str) return [];
  const reps = [];

  // Formato tipo "x6 x6 x4" o "x6, x6, x4" o "x8"
  // Cada xN es UNA serie de N reps
  const matchesX = [...str.matchAll(/(?:^|[\s,])x\s*(\d+)/gi)];
  if (matchesX.length > 0) {
    // Si es solo "3 x 8" (exactamente N x M aislado sin más x), es N series de M reps
    const matchSoloNxM = str.trim().match(/^(\d+)\s+x\s+(\d+)$/i);
    if (matchSoloNxM) {
      const seriesCount = parseInt(matchSoloNxM[1], 10);
      const repCount = parseInt(matchSoloNxM[2], 10);
      if (seriesCount > 0 && seriesCount <= 50 && repCount > 0 && repCount <= 100) {
        for (let i = 0; i < seriesCount; i++) reps.push(repCount);
        return reps;
      }
    }
    for (const m of matchesX) {
      const num = parseInt(m[1], 10);
      if (!isNaN(num) && num > 0 && num <= 100) reps.push(num);
    }
    if (reps.length > 0) return reps;
  }

  // Formato tipo "3x8" (3 series de 8 reps)
  const matchNxM = str.match(/(?:^|[^\dx])(\d+)\s*x\s*(\d+)/i) || str.match(/^(\d+)\s*x\s*(\d+)/i);
  if (matchNxM) {
    const seriesCount = parseInt(matchNxM[1], 10);
    const repCount = parseInt(matchNxM[2], 10);
    if (seriesCount > 0 && seriesCount <= 50 && repCount > 0 && repCount <= 100) {
      for (let i = 0; i < seriesCount; i++) reps.push(repCount);
      return reps;
    }
  }

  // Formato con comas: "6,6,4" o "6, 6, 4"
  if (str.includes(',')) {
    const partesComa = str.split(',');
    let todasReps = true;
    const candidatas = [];
    for (const p of partesComa) {
      const limpioP = p.trim();
      if (!/^\d+$/.test(limpioP)) {
        todasReps = false;
        break;
      }
      const n = parseInt(limpioP, 10);
      if (!isNaN(n) && n > 0 && n <= 100) candidatas.push(n);
      else { todasReps = false; break; }
    }
    if (todasReps && candidatas.length > 1) return candidatas;
  }

  // Formato de enteros separados por espacio: "6 6 5"
  const tokens = str.split(/\s+/).filter(Boolean);
  for (const tok of tokens) {
    const n = parseInt(tok, 10);
    if (!isNaN(n) && n > 0 && n <= 100) reps.push(n);
  }
  return reps;
}

/**
 * Revisa si una porción de texto comienza con un nombre de ejercicio reconocible
 * @param {string} str
 * @param {Array<Object>} listaEjercicios
 * @returns {boolean}
 */
function empiezaConEjercicio(str, listaEjercicios = []) {
  if (!str || typeof str !== 'string') return false;
  let limpio = str.trim();
  if (!limpio) return false;

  // Patrón conversacional como "hoy solo hice 4 en martillo con 10"
  const regexConv = /(?:hoy\s+|ayer\s+)?(?:solo\s+)?(?:hice|hizo|meti|metí|saque|saqué|pude|entrene|entrené)\s+(\d+)\s*(?:reps?|repeticiones)?\s+(?:en|de)\s+([a-zA-ZáéíóúñÁÉÍÓÚÑ\s]+?)\s+con\s+(\d+(?:[.,]\d+)?)/i;
  if (regexConv.test(limpio)) return true;

  // Patrón estructurado como "4 de 8 en martillo con 10" o "12 series de 3 en jalon con 40"
  const regexEstructurado = /(?:hoy\s+|ayer\s+)?(?:solo\s+)?(?:hice|hizo|meti|metí|saque|saqué|pude|entrene|entrené)?\s*(?:\d+\s+(?:series\s+de|de)\s+\d+|\d+\s*x\s*\d+)\s*(?:reps?|repeticiones)?\s+(?:en|de)\s+([a-zA-ZáéíóúñÁÉÍÓÚÑ\s]+)/i;
  if (regexEstructurado.test(limpio)) return true;

  // Limpiar palabras introductorias compuestas en bucle
  limpio = limpiarPrefijosConversacionales(limpio);
  if (!limpio) return false;

  const palabras = limpio.split(/\s+/);
  for (let n = Math.min(4, palabras.length); n >= 1; n--) {
    const frase = palabras.slice(0, n).join(' ');
    if (/^\d/.test(frase)) continue;
    const ranking = buscarEjercicio(frase, listaEjercicios);
    if (ranking.length > 0 && ranking[0].puntaje >= 0.55) {
      return true;
    }
  }
  return false;
}

/**
 * Separa el texto en segmentos según los conectores especificados:
 * - saltos de línea (\n)
 * - punto y coma (;)
 * - ' y luego ', ' luego ', ' después ', ' y después '
 * - ' y ' (solo si lo que sigue empieza con un nombre de ejercicio reconocible)
 * - comas (,), excepto cuando son parte de un decimal (7,5) o lista simple de reps (6,6,4)
 *
 * @param {string} texto
 * @param {Array<Object>} listaEjercicios
 * @returns {Array<string>}
 */
function separarEnSegmentos(texto, listaEjercicios = []) {
  if (!texto) return [];

  // 0. Normalizar comas decimales claras (ej: "7,5 8 8" -> "7.5 8 8", "7,5kg" -> "7.5kg", "con 7,5" -> "con 7.5")
  // sin afectar listas de repeticiones enteras separadas por comas ("6,6,4").
  let t = texto
    .replace(/(\d+),(\d+)(?=\s*(?:kg|kilos?|k\b|\/lado|por\s+lado|cada\s+lado)|\s+\d)/gi, '$1.$2')
    .replace(/(\bcon\s+\d+),(\d+)\b/gi, '$1.$2');

  // 1. Unificar saltos de línea y punto y coma
  t = t.replace(/[\r\n;]+/g, '\n');

  // 2. Conectores temporales compuestos: 'y luego', 'luego', 'después'
  t = t.replace(/\s+(?:y\s+luego|luego|y\s+despu[eé]s|despu[eé]s)\s+/gi, '\n');

  // 3. Conector ' y ': solo si lo que sigue empieza con un nombre de ejercicio reconocible
  const partesY = t.split(/(\s+y\s+)/i);
  let acumuladoY = '';
  for (let i = 0; i < partesY.length; i++) {
    const fragmento = partesY[i];
    if (/^\s+y\s+$/i.test(fragmento)) {
      const siguiente = partesY.slice(i + 1).join('');
      if (empiezaConEjercicio(siguiente, listaEjercicios)) {
        acumuladoY += '\n';
      } else {
        acumuladoY += fragmento;
      }
    } else {
      acumuladoY += fragmento;
    }
  }
  t = acumuladoY;

  // 4. Comas: separan ejercicios o cambios de peso
  // NO separar si la coma es un decimal (ej: 7,5) o lista de reps (ej: 6,6,4 o 6, 6, 4)
  const lineas = t.split('\n');
  const segmentosFinales = [];

  for (const lin of lineas) {
    const trimmedLin = lin.trim();
    if (!trimmedLin) continue;

    // Si no contiene comas, se agrega directamente
    if (!trimmedLin.includes(',')) {
      segmentosFinales.push(trimmedLin);
      continue;
    }

    // Analizar comas dentro de la línea
    const subPartes = trimmedLin.split(',');
    let buffer = '';

    for (let i = 0; i < subPartes.length; i++) {
      const parteActual = subPartes[i];
      const resto = subPartes.slice(i + 1).join(',');

      buffer = buffer ? `${buffer},${parteActual}` : parteActual;

      // Verificar si lo que sigue después de la coma representa un nuevo ejercicio o cambio de peso
      const trimmedResto = resto.trim();
      const parteSiguiente = subPartes[i + 1] || '';
      const esDecimal = /^\d/.test(parteSiguiente) && /\d$/.test(parteActual);
      const esNuevoEjercicio = empiezaConEjercicio(trimmedResto, listaEjercicios);
      const esCambioPeso = /\b\d+(?:[.,]\d+)?\s*(?:kg|kilos?|k\b)/i.test(trimmedResto) ||
                           /\b(?:placas?|pines|pin)\b/i.test(trimmedResto) ||
                           /\bcon\s+\d+/i.test(trimmedResto) ||
                           /\d+\/lado/i.test(trimmedResto) ||
                           /\b\d+\s+(?:series\s+de|de)\s+\d+\b/i.test(trimmedResto) ||
                           /\b\d+\s*x\s*\d+\b/i.test(trimmedResto) ||
                           (!esDecimal && /^\s*\d+(?:[.,]\d+)?\s+\d+/i.test(trimmedResto));

      if ((esNuevoEjercicio || esCambioPeso) && !esDecimal) {
        if (buffer.trim()) segmentosFinales.push(buffer.trim());
        buffer = '';
      }
    }

    if (buffer.trim()) {
      segmentosFinales.push(buffer.trim());
    }
  }

  return segmentosFinales.map(s => s.trim()).filter(Boolean);
}

/**
 * Parsea un segmento de texto libre.
 * @param {string} linea
 * @param {Array<Object>} listaEjercicios
 * @returns {{
 *   item: {
 *     ejercicioId: string|null,
 *     opciones: Array<string>,
 *     kg: number|null,
 *     unidad: string,
 *     porLado: boolean,
 *     series: Array<{kg: number|null, reps: number, unidad: string}>,
 *     maquina: string,
 *     nota: string
 *   }|null,
 *   duda: string|null,
 *   esContinuacion: boolean
 * }}
 */
function parsearBloque(linea, listaEjercicios = []) {
  const original = linea.trim();
  if (!original) return { item: null, duda: null, esContinuacion: false };

  let texto = original;
  let maquina = '';
  let porLado = false;
  let unidad = 'kg';
  let nota = '';
  let kg = null;
  const series = [];

  // 1. Números que son nombre de máquina: 'torre N', 'polea N', 'máquina N' son nota de máquina, NO kilos.
  // Ej: 'tricep polea torre 2 40 9' -> pushdown_triceps_polea, maquina 'torre 2', 40 kg, 1 serie de 9.
  const regexMaquina = /(?:(?:en|la|de)\s+)?\b((?:torre|máquina|maquina|polea|banco)\s*#?\s*\d+[a-zA-Z]?|banco\s+(?:inclinado|plano|declinado))\b/i;
  const matchMaquina = texto.match(regexMaquina);
  if (matchMaquina) {
    maquina = (matchMaquina[1] || matchMaquina[0]).toLowerCase().trim();
    texto = texto.replace(matchMaquina[0], ' ');
  }

  // 2. Extraer "por lado" / "/lado" / "cada lado"
  const regexPorLado = /(?:\/|\s+por\s+|\s+cada\s+)lado/i;
  if (regexPorLado.test(texto)) {
    porLado = true;
    texto = texto.replace(regexPorLado, ' ');
  }

  // 3. Placas: 'placa N' o 'pin N' es la carga en máquinas de placas: guarda kg = N y unidad = 'placa'
  // Ej: 'femoral placa 5 8 8 7' -> curl_femoral_sentado, kg 5, unidad 'placa', 3 series 8,8,7
  const regexPlaca = /\b(?:placas?|pines|pin)\s*#?\s*(\d+(?:[.,]\d+)?)\b|\b(\d+(?:[.,]\d+)?)\s*(?:placas?|pines|pin)\b/i;
  const matchPlaca = texto.match(regexPlaca);
  if (matchPlaca) {
    unidad = 'placa';
    const numStr = matchPlaca[1] || matchPlaca[2];
    kg = parseFloat(numStr.replace(',', '.'));
    texto = texto.replace(matchPlaca[0], ' ');
  }

  // 4. Patrones conversacionales de UNA sola serie explícita (ej: "hoy solo hice 4 en martillo con 10")
  // Lookahead negativo asegura que NO sea un patrón estructurado "4 de 8" ni "4 series de 8"
  const regexConvUnaSerie = /(?:hoy\s+|ayer\s+)?(?:solo\s+)?(?:hice|hizo|meti|metí|saque|saqué|pude|entrene|entrené)\s+(\d+)(?!\s+(?:series\s+de|de)\s+\d+)\s*(?:reps?|repeticiones)?\s+(?:en|de)\s+([a-zA-ZáéíóúñÁÉÍÓÚÑ\s]+?)\s+con\s+(\d+(?:[.,]\d+)?)\s*(?:kg|kilos?|k\b)?/i;
  const matchConvUna = texto.match(regexConvUnaSerie);
  if (matchConvUna) {
    const repsNum = parseInt(matchConvUna[1], 10);
    const nombreEj = matchConvUna[2].trim();
    const kgNum = parseFloat(matchConvUna[3].replace(',', '.'));
    const ranking = buscarEjercicio(nombreEj, listaEjercicios);
    const top = ranking[0] || null;
    const ejercicioId = top && top.puntaje >= 0.4 ? top.id : null;

    return {
      item: {
        ejercicioId,
        opciones: ranking.slice(0, 3).map(r => r.id),
        kg: !isNaN(kgNum) ? kgNum : null,
        unidad: 'kg',
        porLado,
        series: [{ kg: !isNaN(kgNum) ? kgNum : null, reps: repsNum, unidad: 'kg' }],
        maquina,
        nota
      },
      duda: ejercicioId ? null : original,
      esContinuacion: false
    };
  }

  // 5. 'con 50' = 50 kg (o 'con 50 kilos', 'con 50k')
  const matchCon = texto.match(/\bcon\s+(\d+(?:[.,]\d+)?)\s*(?:kg|kilos?|k\b)?/i);
  if (matchCon && kg === null) {
    kg = parseFloat(matchCon[1].replace(',', '.'));
    unidad = 'kg';
    texto = texto.replace(matchCon[0], ' ');
  }

  // 6. 'kilos', 'kg', 'k' después del número = kilos. Ej: '50k', '10kg', '50 kilos'
  const matchKg = texto.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|kilos?|k\b)/i);
  if (matchKg && kg === null) {
    kg = parseFloat(matchKg[1].replace(',', '.'));
    unidad = 'kg';
    texto = texto.replace(matchKg[0], ' ');
  }

  // 7. Patrones estructurados de series y reps:
  // - "N series de M" (ej: "12 series de 3", "12 series de 3 en jalon con 40")
  // - "N de M" (ej: "4 de 8", "4 de 8 en martillo con 10")
  // - "NxM" o "N x M" (ej: "3x10", "bayesiano 3x10 con 20", "3x10 con 20")
  let setsEstructurado = null;
  let repsEstructurado = null;
  let matchEstructuradoStr = null;

  const mSeriesDe = texto.match(/\b(\d+)\s+series\s+de\s+(\d+)\b/i);
  if (mSeriesDe) {
    setsEstructurado = parseInt(mSeriesDe[1], 10);
    repsEstructurado = parseInt(mSeriesDe[2], 10);
    matchEstructuradoStr = mSeriesDe[0];
  } else {
    const mDe = texto.match(/\b(\d+)\s+de\s+(\d+)\b/i);
    if (mDe) {
      setsEstructurado = parseInt(mDe[1], 10);
      repsEstructurado = parseInt(mDe[2], 10);
      matchEstructuradoStr = mDe[0];
    } else {
      const mNxM = texto.match(/\b(\d+)\s*x\s*(\d+)\b/i);
      if (mNxM) {
        setsEstructurado = parseInt(mNxM[1], 10);
        repsEstructurado = parseInt(mNxM[2], 10);
        matchEstructuradoStr = mNxM[0];
      }
    }
  }

  if (matchEstructuradoStr && setsEstructurado > 0 && setsEstructurado <= 50 && repsEstructurado > 0 && repsEstructurado <= 100) {
    const restoTexto = texto.replace(matchEstructuradoStr, ' ').trim();
    const nombreLimpio = limpiarPrefijosConversacionales(restoTexto);

    let ejercicioId = null;
    let opciones = [];

    if (nombreLimpio) {
      const ranking = buscarEjercicio(nombreLimpio, listaEjercicios);
      const top = ranking[0] || null;
      if (top && top.puntaje >= 0.4) {
        ejercicioId = top.id;
      }
      opciones = ranking.slice(0, 3).map(r => r.id);
    }

    for (let i = 0; i < setsEstructurado; i++) {
      series.push({ kg, reps: repsEstructurado, unidad });
    }

    return {
      item: {
        ejercicioId,
        opciones,
        kg,
        unidad,
        porLado,
        series,
        maquina,
        nota
      },
      duda: ejercicioId ? null : original,
      esContinuacion: false
    };
  }

  // 8. Extraer nombre de ejercicio candidato y resto de datos numéricos convencionales
  const regexPrimerNumero = /(?:\b\d+(?:[.,]\d+)?|\bx\s*\d+)/i;
  const matchInicioNum = texto.match(regexPrimerNumero);

  let nombreCandidato = '';
  let restoDatos = '';
  if (matchInicioNum && matchInicioNum.index !== undefined) {
    nombreCandidato = texto.substring(0, matchInicioNum.index).trim();
    restoDatos = texto.substring(matchInicioNum.index).trim();
  } else {
    nombreCandidato = texto.trim();
  }

  // Limpiar partículas conversacionales al inicio/final del nombre
  nombreCandidato = limpiarPrefijosConversacionales(nombreCandidato);

  // Inversión: "3x8 50kg jalon"
  if (!nombreCandidato && restoDatos) {
    const matchInv = restoDatos.match(/^(.*?)(?:con|de|\s+)?([a-zA-ZáéíóúñÁÉÍÓÚÑ\s]{3,})$/);
    if (matchInv) {
      restoDatos = matchInv[1].trim();
      nombreCandidato = limpiarPrefijosConversacionales(matchInv[2].trim());
    }
  }

  // Si no hay nombre de ejercicio candidato, es un cambio de peso que continúa el ejercicio anterior
  if (!nombreCandidato) {
    // Si ya teníamos peso o viene peso en restoDatos: ej. "7.5kg 7" o "7,5 8 8"
    if (kg !== null) {
      const repsArr = extraerReps(restoDatos);
      for (const r of repsArr) {
        series.push({ kg, reps: r, unidad });
      }
    } else if (/^(?:(\d+(?:[.,]\d+)?)\s+)?(\d+)\s*x\s*(\d+)$/i.test(restoDatos.trim())) {
      const matchNxM = restoDatos.trim().match(/^(?:(\d+(?:[.,]\d+)?)\s+)?(\d+)\s*x\s*(\d+)$/i);
      if (matchNxM[1]) kg = parseFloat(matchNxM[1].replace(',', '.'));
      const sets = parseInt(matchNxM[2], 10);
      const repsVal = parseInt(matchNxM[3], 10);
      for (let i = 0; i < sets; i++) {
        series.push({ kg, reps: repsVal, unidad });
      }
    } else if (/^(\d+(?:[.,]\d+)?)\s+(?:x\s*\d+[\s,]*)+$/i.test(restoDatos.trim())) {
      const matchPeso = restoDatos.trim().match(/^(\d+(?:[.,]\d+)?)\s+(.*)$/i);
      kg = parseFloat(matchPeso[1].replace(',', '.'));
      const repsArr = extraerReps(matchPeso[2]);
      for (const r of repsArr) {
        series.push({ kg, reps: r, unidad });
      }
    } else {
      const tokens = restoDatos.split(/\s+/).filter(Boolean);
      const numeros = [];
      for (const t of tokens) {
        const n = parseFloat(t.replace(',', '.'));
        if (!isNaN(n)) numeros.push(n);
      }
      if (numeros.length === 1) {
        series.push({ kg: null, reps: numeros[0], unidad });
      } else if (numeros.length >= 2) {
        kg = numeros[0];
        for (const r of numeros.slice(1)) {
          series.push({ kg, reps: r, unidad });
        }
      }
    }

    if (series.length > 0) {
      return {
        item: {
          ejercicioId: null,
          opciones: [],
          kg,
          unidad,
          porLado,
          series,
          maquina,
          nota
        },
        duda: null,
        esContinuacion: true
      };
    }

    return { item: null, duda: original, esContinuacion: false };
  }

  const ranking = buscarEjercicio(nombreCandidato, listaEjercicios);
  const top = ranking[0] || null;
  const ejercicioId = top && top.puntaje >= 0.4 ? top.id : null;
  const opciones = ranking.slice(0, 3).map(r => r.id);
  const ejercicioObj = top ? listaEjercicios.find(e => e.id === top.id) : null;
  const esCorporal = esEjercicioCorporal(ejercicioObj);

  // Parsear resto de datos para reps y kg si no se habían extraído
  if (kg !== null) {
    const repsArr = extraerReps(restoDatos);
    for (const r of repsArr) {
      series.push({ kg, reps: r, unidad });
    }
  } else if (/^(?:(\d+(?:[.,]\d+)?)\s+)?(\d+)\s*x\s*(\d+)$/i.test(restoDatos.trim())) {
    const matchNxM = restoDatos.trim().match(/^(?:(\d+(?:[.,]\d+)?)\s+)?(\d+)\s*x\s*(\d+)$/i);
    if (matchNxM[1]) kg = parseFloat(matchNxM[1].replace(',', '.'));
    const sets = parseInt(matchNxM[2], 10);
    const repsVal = parseInt(matchNxM[3], 10);
    for (let i = 0; i < sets; i++) {
      series.push({ kg, reps: repsVal, unidad });
    }
  } else if (/^(\d+(?:[.,]\d+)?)\s+(?:x\s*\d+[\s,]*)+$/i.test(restoDatos.trim())) {
    const matchPeso = restoDatos.trim().match(/^(\d+(?:[.,]\d+)?)\s+(.*)$/i);
    kg = parseFloat(matchPeso[1].replace(',', '.'));
    const repsArr = extraerReps(matchPeso[2]);
    for (const r of repsArr) {
      series.push({ kg, reps: r, unidad });
    }
  } else if (/^\s*(?:x\s*\d+[\s,]*)+$/i.test(restoDatos.trim()) || (esCorporal && /x\s*\d+/i.test(restoDatos))) {
    const repsArr = extraerReps(restoDatos);
    for (const r of repsArr) {
      series.push({ kg: null, reps: r, unidad });
    }
  } else if (/^\d+(?:\s*,\s*\d+)+$/.test(restoDatos.trim())) {
    const repsArr = extraerReps(restoDatos);
    for (const r of repsArr) {
      series.push({ kg: null, reps: r, unidad });
    }
  } else {
    // Números separados por espacios: "45 6 6 5", "7,5 8 8", "40 9", "dominadas 8 8" o "dominadas 7 6 5"
    const tokens = restoDatos.split(/\s+/).filter(Boolean);
    const numeros = [];
    const palabras = [];

    for (const t of tokens) {
      const n = parseFloat(t.replace(',', '.'));
      if (!isNaN(n)) numeros.push(n);
      else palabras.push(t);
    }
    if (palabras.length > 0) nota = palabras.join(' ');

    if (numeros.length === 1) {
      if (esCorporal) {
        series.push({ kg: null, reps: numeros[0], unidad });
      } else if (numeros[0] > 30) {
        kg = numeros[0];
        series.push({ kg, reps: 1, unidad });
      } else {
        series.push({ kg: null, reps: numeros[0], unidad });
      }
    } else if (numeros.length === 2) {
      if (esCorporal && numeros[0] <= 40 && numeros[1] <= 40 && Number.isInteger(numeros[0])) {
        series.push({ kg: null, reps: numeros[0], unidad });
        series.push({ kg: null, reps: numeros[1], unidad });
      } else {
        kg = numeros[0];
        series.push({ kg, reps: numeros[1], unidad });
      }
    } else if (numeros.length >= 3) {
      const repsSubsiguientes = numeros.slice(1);
      const difSubsiguientes = Math.max(...repsSubsiguientes) - Math.min(...repsSubsiguientes);
      const sonSubsiguientesConsistentes = repsSubsiguientes.every(n => n <= 30) && difSubsiguientes <= 2;
      const saltoInicial = numeros[0] - repsSubsiguientes[0];

      const esSecuenciaFatigaCorporal = numeros.length >= 3 &&
        numeros.every((val, idx) => idx === 0 || (numeros[idx - 1] >= val && numeros[idx - 1] - val <= 2)) &&
        numeros[0] <= 25;

      const esLastreClaro = esCorporal && !esSecuenciaFatigaCorporal && (
        (sonSubsiguientesConsistentes && (saltoInicial >= 3 || saltoInicial <= -2)) ||
        (numeros[0] % 2.5 === 0 && numeros[0] >= 5 && sonSubsiguientesConsistentes)
      );

      if (esCorporal && !esLastreClaro && numeros[0] <= 30 && Number.isInteger(numeros[0])) {
        for (const n of numeros) series.push({ kg: null, reps: n, unidad });
      } else {
        kg = numeros[0];
        for (const r of numeros.slice(1)) {
          series.push({ kg, reps: r, unidad });
        }
      }
    }
  }

  if (series.length === 0 && kg !== null) {
    series.push({ kg, reps: 8, unidad });
  }

  if (!ejercicioId && series.length === 0) {
    return { item: null, duda: original, esContinuacion: false };
  }

  return {
    item: {
      ejercicioId,
      opciones,
      kg,
      unidad,
      porLado,
      series,
      maquina,
      nota
    },
    duda: ejercicioId ? null : original,
    esContinuacion: false
  };
}

/**
 * Entiende texto libre en lenguaje natural y extrae los ejercicios, pesos y series.
 * Soporta entradas multilínea o múltiples ejercicios en un solo mensaje.
 * Separa por comas, punto y coma, saltos de línea, ' y luego ', ' luego ', ' después ',
 * y ' y ' (si lo que sigue es un ejercicio reconocible).
 * Un segmento sin nombre de ejercicio continúa el ejercicio anterior (cambio de peso).
 *
 * @param {string} texto
 * @param {Array<Object>} listaEjercicios
 * @returns {{
 *   items: Array<{
 *     ejercicioId: string|null,
 *     opciones: Array<string>,
 *     kg: number|null,
 *     unidad: string,
 *     porLado: boolean,
 *     series: Array<{kg: number|null, reps: number, unidad: string}>,
 *     maquina: string,
 *     nota: string
 *   }>,
 *   dudas: Array<string>
 * }}
 */
export function entenderTexto(texto, listaEjercicios = []) {
  if (!texto || typeof texto !== 'string') {
    return { items: [], dudas: [] };
  }

  const items = [];
  const dudas = [];
  const segmentos = separarEnSegmentos(texto, listaEjercicios);

  for (const segmento of segmentos) {
    const { item, duda, esContinuacion } = parsearBloque(segmento, listaEjercicios);

    if (esContinuacion && item && items.length > 0) {
      // Continúa el ejercicio anterior como un cambio de peso
      const ultimo = items[items.length - 1];
      for (const s of item.series) {
        ultimo.series.push(s);
      }
      if (ultimo.kg === null && item.kg !== null) {
        ultimo.kg = item.kg;
        ultimo.unidad = item.unidad;
      }
    } else {
      if (item) items.push(item);
      if (duda) dudas.push(duda);
    }
  }

  return { items, dudas };
}

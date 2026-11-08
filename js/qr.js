// =============================================================================
// js/qr.js - Generador de código QR en SVG y lector de QR con BarcodeDetector
// Implementación propia en JavaScript puro sin dependencias externas.
// Soporta modo Byte, corrección de errores M, y versiones 1 a 10 (extendido a 12
// para admitir payloads JSON completos de CONTRATOS.md).
// Estilo Forja v2: Radios canónicos 28px y tinta #17171A.
// =============================================================================

// --- Tablas de Galois Field GF(256) con polinomio primitivo 0x11D ---
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(function initGaloisField() {
  let val = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = val;
    EXP[i + 255] = val;
    LOG[val] = i;
    val = (val << 1) ^ (val & 128 ? 0x11d : 0);
  }
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

// Generador de polinomios Reed-Solomon en potencias decrecientes de x
function getRsGeneratorPoly(ecCount) {
  let poly = [1];
  for (let i = 0; i < ecCount; i++) {
    const root = EXP[i];
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  return poly;
}

// Cálculo de palabras de corrección Reed-Solomon
function rsEncode(dataBytes, ecCount) {
  const gen = getRsGeneratorPoly(ecCount);
  const remainder = new Uint8Array(ecCount);
  for (let i = 0; i < dataBytes.length; i++) {
    const factor = dataBytes[i] ^ remainder[0];
    for (let j = 0; j < ecCount - 1; j++) {
      remainder[j] = remainder[j + 1] ^ (factor ? gfMul(gen[j + 1], factor) : 0);
    }
    remainder[ecCount - 1] = factor ? gfMul(gen[ecCount], factor) : 0;
  }
  return remainder;
}

// --- Parámetros de versiones 1 a 12 (Nivel de error M) ---
// Formato: { total, ecPorBloque, bloques: [[numBloques, datosPorBloque], ...] }
const TABLA_VERSIONES_M = [
  null,
  { total: 26,  ec: 10, bloques: [[1, 16]] },                           // V1: 16 datos
  { total: 44,  ec: 16, bloques: [[1, 28]] },                           // V2: 28 datos
  { total: 70,  ec: 26, bloques: [[1, 44]] },                           // V3: 44 datos
  { total: 100, ec: 18, bloques: [[2, 32]] },                           // V4: 64 datos
  { total: 134, ec: 24, bloques: [[2, 43]] },                           // V5: 86 datos
  { total: 172, ec: 16, bloques: [[4, 27]] },                           // V6: 108 datos
  { total: 196, ec: 18, bloques: [[4, 31]] },                           // V7: 124 datos
  { total: 242, ec: 22, bloques: [[2, 38], [2, 39]] },                  // V8: 154 datos
  { total: 292, ec: 22, bloques: [[3, 36], [2, 37]] },                  // V9: 182 datos
  { total: 346, ec: 26, bloques: [[4, 43], [1, 44]] },                  // V10: 216 datos
  { total: 404, ec: 30, bloques: [[1, 50], [4, 51]] },                  // V11: 254 datos
  { total: 466, ec: 22, bloques: [[6, 36], [2, 37]] }                   // V12: 290 datos
];

// Coordenadas de patrones de alineación para versiones 1-12
const ALINEACIONES = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58]
];

// Bits de versión para V7-V12 (código Golay BCH de 18 bits)
const BITS_VERSION = {
  7:  0x07c94,
  8:  0x085bc,
  9:  0x09a99,
  10: 0x0a4d3,
  11: 0x0bbf6,
  12: 0x0c762
};

// Bits de formato para Nivel M (00) y cada máscara (0-7)
function obtenerBitsFormato(mascara) {
  const dato = mascara & 0x07; // 2 bits EC M (00) + 3 bits máscara
  let d = dato << 10;
  for (let i = 4; i >= 0; i--) {
    if ((d >> (i + 10)) & 1) {
      d ^= (0x537 << i);
    }
  }
  return ((dato << 10) | d) ^ 0x5412;
}

// Capacidad máxima de datos en bytes por versión (modo Byte, M)
function capacidadBytes(v) {
  const info = TABLA_VERSIONES_M[v];
  let suma = 0;
  for (const [nb, db] of info.bloques) suma += nb * db;
  const longitudBitsEncabezado = 4 + (v <= 9 ? 8 : 16);
  return Math.floor((suma * 8 - longitudBitsEncabezado) / 8);
}

// Determina la versión mínima capaz de alojar los bytes
function seleccionarVersion(numBytes) {
  for (let v = 1; v < TABLA_VERSIONES_M.length; v++) {
    if (numBytes <= capacidadBytes(v)) return v;
  }
  return null;
}

// Empaquetador de bits
class BitBuffer {
  constructor() {
    this.buffer = [];
    this.length = 0;
  }
  put(val, bits) {
    for (let i = bits - 1; i >= 0; i--) {
      this.buffer.push((val >> i) & 1);
      this.length++;
    }
  }
  getBytes() {
    const bytes = [];
    for (let i = 0; i < this.buffer.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) {
        b = (b << 1) | (this.buffer[i + j] || 0);
      }
      bytes.push(b);
    }
    return bytes;
  }
}

// Máscaras de evaluación
function aplicarMascara(r, c, m) {
  switch (m) {
    case 0: return (r + c) % 2 === 0;
    case 1: return r % 2 === 0;
    case 2: return c % 3 === 0;
    case 3: return (r + c) % 3 === 0;
    case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    case 7: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
    default: return false;
  }
}

// Construye la matriz de QR completa
function construirMatrizQR(version, datosCodificados) {
  const n = 17 + 4 * version;
  const matriz = Array.from({ length: n }, () => new Int8Array(n).fill(-1));
  const esFuncion = Array.from({ length: n }, () => new Uint8Array(n).fill(0));

  function setModulo(r, c, val, funcion = true) {
    if (r >= 0 && r < n && c >= 0 && c < n) {
      matriz[r][c] = val ? 1 : 0;
      if (funcion) esFuncion[r][c] = 1;
    }
  }

  // 1. Patrones de búsqueda (Finders) en las 3 esquinas
  function colocarFinder(top, left) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = top + r;
        const nc = left + c;
        if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
        if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
          const esBorde = r === 0 || r === 6 || c === 0 || c === 6;
          const esCentro = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          setModulo(nr, nc, esBorde || esCentro, true);
        } else {
          // Separador blanco
          setModulo(nr, nc, 0, true);
        }
      }
    }
  }

  colocarFinder(0, 0);
  colocarFinder(0, n - 7);
  colocarFinder(n - 7, 0);

  // 2. Patrones de sincronización (Timing)
  for (let i = 8; i < n - 8; i++) {
    const val = (i % 2 === 0) ? 1 : 0;
    if (!esFuncion[6][i]) setModulo(6, i, val, true);
    if (!esFuncion[i][6]) setModulo(i, 6, val, true);
  }

  // 3. Patrones de alineación
  const coordsAlineacion = ALINEACIONES[version] || [];
  if (coordsAlineacion.length > 0) {
    for (const r of coordsAlineacion) {
      for (const c of coordsAlineacion) {
        // Evitar coincidencia con finders
        if (esFuncion[r][c]) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const esBorde = Math.abs(dr) === 2 || Math.abs(dc) === 2;
            const esCentro = dr === 0 && dc === 0;
            setModulo(r + dr, c + dc, esBorde || esCentro, true);
          }
        }
      }
    }
  }

  // 4. Módulo oscuro obligatorio
  setModulo(4 * version + 9, 8, 1, true);

  // 5. Reservar zonas de información de formato
  for (let i = 0; i <= 8; i++) {
    if (!esFuncion[8][i]) setModulo(8, i, 0, true);
    if (!esFuncion[i][8]) setModulo(i, 8, 0, true);
  }
  for (let i = 0; i < 8; i++) {
    setModulo(8, n - 1 - i, 0, true);
    setModulo(n - 1 - i, 8, 0, true);
  }

  // 6. Reservar zonas de versión (V >= 7)
  if (version >= 7) {
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 3; c++) {
        setModulo(r, n - 11 + c, 0, true);
        setModulo(n - 11 + c, r, 0, true);
      }
    }
  }

  // 7. Colocar bits de datos en zigzag
  let bitIndex = 0;
  const totalBits = datosCodificados.length * 8;
  let subiendo = true;

  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col--; // Saltar columna de timing

    const filas = [];
    if (subiendo) {
      for (let r = n - 1; r >= 0; r--) filas.push(r);
    } else {
      for (let r = 0; r < n; r++) filas.push(r);
    }

    for (const r of filas) {
      for (const c of [col, col - 1]) {
        if (!esFuncion[r][c]) {
          let bit = 0;
          if (bitIndex < totalBits) {
            const bytePos = Math.floor(bitIndex / 8);
            const bitPos = 7 - (bitIndex % 8);
            bit = (datosCodificados[bytePos] >> bitPos) & 1;
            bitIndex++;
          }
          matriz[r][c] = bit;
        }
      }
    }
    subiendo = !subiendo;
  }

  // 8. Evaluar penalización de las 8 máscaras y seleccionar la óptima
  let menorPenalizacion = Infinity;
  let mejorMatriz = null;

  for (let m = 0; m < 8; m++) {
    const copia = Array.from({ length: n }, (_, r) => new Int8Array(matriz[r]));

    // Aplicar máscara m
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!esFuncion[r][c]) {
          if (aplicarMascara(r, c, m)) {
            copia[r][c] ^= 1;
          }
        }
      }
    }

    // Escribir formato
    const bitsFormato = obtenerBitsFormato(m);
    for (let i = 0; i < 15; i++) {
      const bit = (bitsFormato >> (14 - i)) & 1;
      // Alrededor del finder superior izquierdo
      if (i <= 5) copia[i][8] = bit;
      else if (i === 6) copia[7][8] = bit;
      else if (i === 7) copia[8][8] = bit;
      else if (i === 8) copia[8][7] = bit;
      else copia[8][14 - i] = bit;

      // Alrededor de los otros dos finders
      if (i < 8) copia[8][n - 1 - i] = bit;
      else copia[n - 1 - (14 - i)][8] = bit;
    }

    // Escribir versión si v >= 7
    if (version >= 7) {
      const bitsVer = BITS_VERSION[version];
      for (let i = 0; i < 18; i++) {
        const bit = (bitsVer >> i) & 1;
        const r = Math.floor(i / 3);
        const c = i % 3;
        copia[r][n - 11 + c] = bit;
        copia[n - 11 + c][r] = bit;
      }
    }

    // Calcular penalización (N1 a N4)
    let pen = 0;
    // N1: 5 o más módulos iguales continuos en filas y columnas
    for (let r = 0; r < n; r++) {
      let run = 1;
      for (let c = 1; c < n; c++) {
        if (copia[r][c] === copia[r][c - 1]) {
          run++;
        } else {
          if (run >= 5) pen += 3 + (run - 5);
          run = 1;
        }
      }
      if (run >= 5) pen += 3 + (run - 5);
    }
    for (let c = 0; c < n; c++) {
      let run = 1;
      for (let r = 1; r < n; r++) {
        if (copia[r][c] === copia[r - 1][c]) {
          run++;
        } else {
          if (run >= 5) pen += 3 + (run - 5);
          run = 1;
        }
      }
      if (run >= 5) pen += 3 + (run - 5);
    }

    // N2: Bloques 2x2 del mismo color
    for (let r = 0; r < n - 1; r++) {
      for (let c = 0; c < n - 1; c++) {
        const v = copia[r][c];
        if (v === copia[r + 1][c] && v === copia[r][c + 1] && v === copia[r + 1][c + 1]) {
          pen += 3;
        }
      }
    }

    // N4: Balance claro/oscuro
    let oscuros = 0;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (copia[r][c] === 1) oscuros++;
      }
    }
    const pct = (oscuros / (n * n)) * 100;
    const dev5 = Math.abs(Math.floor((pct - 50) / 5));
    pen += dev5 * 10;

    if (pen < menorPenalizacion) {
      menorPenalizacion = pen;
      mejorMatriz = copia;
    }
  }

  return mejorMatriz;
}

/**
 * Genera un código QR en SVG a partir de un texto en modo Byte con corrección M.
 * Cumple con la dirección editorial Forja v2: radio 28px y tinta #17171A.
 * @param {string} texto - Contenido a codificar.
 * @returns {string} Código SVG del QR listo para incrustar en HTML.
 */
export function qrSvg(texto) {
  if (texto === undefined || texto === null) texto = '';
  const encoder = new TextEncoder();
  const rawBytes = encoder.encode(String(texto));
  const version = seleccionarVersion(rawBytes.length);

  if (!version) {
    const errText = 'Texto demasiado largo para QR';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 64" width="100%" height="auto">
      <rect width="240" height="64" fill="#232328" rx="28"/>
      <text x="120" y="37" fill="#E2553A" font-size="12" text-anchor="middle" font-family="'Bricolage Grotesque', sans-serif" font-weight="600">${errText}</text>
    </svg>`;
  }

  const vInfo = TABLA_VERSIONES_M[version];
  let totalDataCodewords = 0;
  for (const [nb, db] of vInfo.bloques) totalDataCodewords += nb * db;

  // 1. Armar flujo de bits en modo Byte (0100)
  const bb = new BitBuffer();
  bb.put(0b0100, 4); // Modo Byte
  bb.put(rawBytes.length, version <= 9 ? 8 : 16); // Longitud del texto
  for (const b of rawBytes) {
    bb.put(b, 8);
  }

  // Terminador de 4 bits (o los que quepan)
  const bitsNecesarios = totalDataCodewords * 8;
  const bitsTerminador = Math.min(4, bitsNecesarios - bb.length);
  if (bitsTerminador > 0) bb.put(0, bitsTerminador);

  // Rellenar hasta múltiplo de 8
  const paddingCero = (8 - (bb.length % 8)) % 8;
  if (paddingCero > 0) bb.put(0, paddingCero);

  // Bytes de relleno alternados 0xEC y 0x11
  const bytesRelleno = [0xec, 0x11];
  let padIdx = 0;
  while (bb.length < bitsNecesarios) {
    bb.put(bytesRelleno[padIdx % 2], 8);
    padIdx++;
  }

  const dataCodewords = bb.getBytes();

  // 2. Dividir en bloques y calcular palabras Reed-Solomon
  const bloquesDatos = [];
  const bloquesEC = [];
  let byteOffset = 0;

  for (const [numBloques, datosPorBloque] of vInfo.bloques) {
    for (let i = 0; i < numBloques; i++) {
      const bDatos = dataCodewords.slice(byteOffset, byteOffset + datosPorBloque);
      byteOffset += datosPorBloque;
      const bEC = rsEncode(bDatos, vInfo.ec);
      bloquesDatos.push(bDatos);
      bloquesEC.push(bEC);
    }
  }

  // 3. Intercalar palabras de datos
  const resultadoFinal = [];
  let maxDatos = 0;
  for (const b of bloquesDatos) {
    if (b.length > maxDatos) maxDatos = b.length;
  }
  for (let i = 0; i < maxDatos; i++) {
    for (const b of bloquesDatos) {
      if (i < b.length) resultadoFinal.push(b[i]);
    }
  }

  // 4. Intercalar palabras de corrección de error
  for (let i = 0; i < vInfo.ec; i++) {
    for (const b of bloquesEC) {
      resultadoFinal.push(b[i]);
    }
  }

  // 5. Construir matriz y aplicar máscara óptima
  const matriz = construirMatrizQR(version, resultadoFinal);
  const n = matriz.length;
  const margen = 3;
  const viewBoxSize = n + margen * 2;

  // 6. Generar SVG optimizado con un único elemento <path>
  let pathD = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matriz[r][c] === 1) {
        pathD += `M${c + margen},${r + margen}h1v1h-1z `;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" width="100%" height="auto" shape-rendering="crispEdges" style="display:block;max-width:280px;margin:0 auto;border-radius:28px;background:#ffffff;padding:16px;box-shadow:0 10px 30px rgba(23,23,26,0.18)">
  <rect width="${viewBoxSize}" height="${viewBoxSize}" fill="#ffffff"/>
  <path d="${pathD.trim()}" fill="#17171A"/>
</svg>`;
}

let instanciaBarcodeDetector = null;
let soporteQrVerificado = null; // null: no verificado, true: soportado, false: no soportado

/**
 * Lee un código QR de un elemento <video> en reproducción utilizando BarcodeDetector nativo.
 * Devuelve el texto leído o null si no se detectó código o si el navegador no soporta la API.
 * Reutiliza una única instancia singleton de BarcodeDetector para evitar fugas y GC thrashing.
 * @param {HTMLVideoElement} video - Elemento de video HTML con el flujo de la cámara.
 * @returns {Promise<string|null>}
 */
export async function leerQR(video) {
  if (typeof window === 'undefined') return null;
  if (!('BarcodeDetector' in window)) return null;
  if (!video || video.readyState < 2) return null;

  try {
    if (soporteQrVerificado === null) {
      const formatos = await BarcodeDetector.getSupportedFormats();
      soporteQrVerificado = Array.isArray(formatos) && formatos.includes('qr_code');
    }
    if (!soporteQrVerificado) return null;

    if (!instanciaBarcodeDetector) {
      instanciaBarcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
    }

    const codigos = await instanciaBarcodeDetector.detect(video);
    if (codigos && codigos.length > 0 && codigos[0].rawValue) {
      return codigos[0].rawValue;
    }
    return null;
  } catch (err) {
    // Si el cuadro aún no se puede leer o el usuario gira la cámara, silenciar y reintentar
    return null;
  }
}

/**
 * js/mapa_musculos.js
 * Mapa del cuerpo humano (frente y espalda) en SVG propio.
 * Dirección de arte Forja v2 («Revista de sala»):
 * - Colores: Tinta suave (#5D5951 / #6B675F) para la silueta inactiva y Lima (#C8F03C) para músculos activos.
 * - Soporta interactividad táctil para filtrar ejercicios.
 */

// Lista canónica de los 20 grupos musculares en español y minúsculas
export const MUSCULOS_CANONICOS = [
  'pectoral',
  'deltoides anterior',
  'deltoides lateral',
  'deltoides posterior',
  'bíceps',
  'tríceps',
  'antebrazo',
  'trapecio',
  'dorsal ancho',
  'romboides',
  'erectores',
  'abdomen',
  'oblicuos',
  'glúteo',
  'cuádriceps',
  'isquiotibiales',
  'aductores',
  'abductores',
  'gemelos',
  'cuello'
];

/**
 * Diccionario de sinónimos y variantes para normalizar nombres al canónico.
 */
const SINONIMOS = {
  // Pectoral
  'pecho': 'pectoral',
  'pectorales': 'pectoral',
  'pectoral mayor': 'pectoral',
  'pectoral menor': 'pectoral',
  'haz clavicular': 'pectoral',
  'haz esternocostal': 'pectoral',
  'chest': 'pectoral',

  // Deltoides
  'deltoides anterior': 'deltoides anterior',
  'deltoide anterior': 'deltoides anterior',
  'deltoides ant': 'deltoides anterior',
  'deltoides_anterior': 'deltoides anterior',
  'hombro anterior': 'deltoides anterior',
  'front delt': 'deltoides anterior',

  'deltoides lateral': 'deltoides lateral',
  'deltoide lateral': 'deltoides lateral',
  'deltoides lat': 'deltoides lateral',
  'deltoides medio': 'deltoides lateral',
  'deltoide medio': 'deltoides lateral',
  'deltoides_lateral': 'deltoides lateral',
  'hombro lateral': 'deltoides lateral',
  'hombro medio': 'deltoides lateral',
  'supraespinoso': 'deltoides lateral',
  'side delt': 'deltoides lateral',

  'deltoides posterior': 'deltoides posterior',
  'deltoide posterior': 'deltoides posterior',
  'deltoides post': 'deltoides posterior',
  'deltoides_posterior': 'deltoides posterior',
  'hombro posterior': 'deltoides posterior',
  'manguito rotador': 'deltoides posterior',
  'infraespinoso': 'deltoides posterior',
  'redondo menor': 'deltoides posterior',
  'rear delt': 'deltoides posterior',

  'hombro': 'deltoides lateral',
  'hombros': 'deltoides lateral',
  'deltoides': 'deltoides lateral',

  // Bíceps
  'biceps': 'bíceps',
  'bíceps': 'bíceps',
  'biceps braquial': 'bíceps',
  'braquial': 'bíceps',
  'braquial anterior': 'bíceps',
  'brazo': 'bíceps',
  'brazos': 'bíceps',

  // Tríceps
  'triceps': 'tríceps',
  'tríceps': 'tríceps',
  'triceps braquial': 'tríceps',

  // Antebrazo
  'antebrazo': 'antebrazo',
  'antebrazos': 'antebrazo',
  'braquiorradial': 'antebrazo',
  'flexores de los dedos': 'antebrazo',
  'flexores de la muneca': 'antebrazo',
  'extensores de la muneca': 'antebrazo',
  'agarre': 'antebrazo',
  'forearm': 'antebrazo',
  'forearms': 'antebrazo',

  // Trapecio
  'trapecio': 'trapecio',
  'trapecios': 'trapecio',
  'trapecio superior': 'trapecio',
  'trapecio medio': 'trapecio',
  'trapecio inferior': 'trapecio',
  'traps': 'trapecio',

  // Dorsal ancho
  'dorsal ancho': 'dorsal ancho',
  'dorsal': 'dorsal ancho',
  'dorsales': 'dorsal ancho',
  'redondo mayor': 'dorsal ancho',
  'lat': 'dorsal ancho',
  'lats': 'dorsal ancho',
  'latissimus': 'dorsal ancho',

  // Romboides
  'romboides': 'romboides',
  'romboide': 'romboides',
  'espalda media': 'romboides',
  'espalda alta': 'romboides',
  'espalda superior': 'romboides',
  'rhomboids': 'romboides',

  // Erectores
  'erectores': 'erectores',
  'erector': 'erectores',
  'erectores de la columna': 'erectores',
  'erectores espinales': 'erectores',
  'lumbar': 'erectores',
  'lumbares': 'erectores',
  'espalda baja': 'erectores',
  'lower back': 'erectores',

  // Abdomen
  'abdomen': 'abdomen',
  'abdominales': 'abdomen',
  'recto abdominal': 'abdomen',
  'transverso abdominal': 'abdomen',
  'abs': 'abdomen',
  'core': 'abdomen',
  'panza': 'abdomen',

  // Oblicuos
  'oblicuos': 'oblicuos',
  'oblicuo': 'oblicuos',
  'oblicuo externo': 'oblicuos',
  'oblicuos externos': 'oblicuos',
  'oblicuo interno': 'oblicuos',
  'cuadrado lumbar': 'oblicuos',
  'cintura': 'oblicuos',

  // Glúteo
  'gluteo': 'glúteo',
  'glúteo': 'glúteo',
  'gluteos': 'glúteo',
  'glúteos': 'glúteo',
  'gluteo mayor': 'glúteo',
  'glutes': 'glúteo',

  // Cuádriceps
  'cuadriceps': 'cuádriceps',
  'cuádriceps': 'cuádriceps',
  'muslo': 'cuádriceps',
  'muslos': 'cuádriceps',
  'piernas': 'cuádriceps',
  'pierna': 'cuádriceps',
  'quads': 'cuádriceps',

  // Isquiotibiales
  'isquiotibiales': 'isquiotibiales',
  'isquiotibial': 'isquiotibiales',
  'isquios': 'isquiotibiales',
  'isquiosurales': 'isquiotibiales',
  'femoral': 'isquiotibiales',
  'femorales': 'isquiotibiales',
  'biceps femoral': 'isquiotibiales',
  'semitendinoso': 'isquiotibiales',
  'semimembranoso': 'isquiotibiales',
  'hamstrings': 'isquiotibiales',

  // Aductores
  'aductores': 'aductores',
  'aductor': 'aductores',
  'aductor mayor': 'aductores',
  'adductor': 'aductores',
  'adductors': 'aductores',

  // Abductores
  'abductores': 'abductores',
  'abductor': 'abductores',
  'abductors': 'abductores',
  'gluteo medio': 'abductores',
  'glúteo medio': 'abductores',
  'gluteo menor': 'abductores',
  'tensor de la fascia lata': 'abductores',

  // Gemelos
  'gemelos': 'gemelos',
  'gemelo': 'gemelos',
  'pantorrilla': 'gemelos',
  'pantorrillas': 'gemelos',
  'gastrocnemio': 'gemelos',
  'soleo': 'gemelos',
  'sóleo': 'gemelos',
  'calves': 'gemelos',

  // Cuello
  'cuello': 'cuello',
  'cervical': 'cuello',
  'cervicales': 'cuello',
  'esternocleidomastoideo': 'cuello',
  'flexores profundos del cuello': 'cuello',
  'extensores del cuello': 'cuello',
  'neck': 'cuello'
};

/**
 * Normaliza un nombre de músculo al canónico exacto.
 * @param {string} nombre
 * @returns {string|null}
 */
export function normalizarMusculo(nombre) {
  if (!nombre || typeof nombre !== 'string') return null;
  const limpio = nombre
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos para comparar
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

  // Revisar si coincide con una clave directa sin acento
  for (const [clave, canonico] of Object.entries(SINONIMOS)) {
    const claveLimpia = clave
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    if (claveLimpia === limpio) {
      return canonico;
    }
  }

  // Buscar coincidencia parcial inteligente
  for (const canonico of MUSCULOS_CANONICOS) {
    const canonicoLimpio = canonico
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    if (limpio.includes(canonicoLimpio) || canonicoLimpio.includes(limpio)) {
      return canonico;
    }
  }

  return null;
}

/**
 * Normaliza un conjunto o array de músculos.
 * @param {Array<string>|string} lista
 * @returns {Set<string>}
 */
function normalizarConjunto(lista) {
  const set = new Set();
  if (!lista) return set;
  const arr = Array.isArray(lista) ? lista : [lista];
  for (const item of arr) {
    const canonico = normalizarMusculo(item);
    if (canonico) set.add(canonico);
  }
  return set;
}

/**
 * Genera el elemento contenedor interactivo con el mapa anatómico en SVG (frente y espalda).
 * Paleta Forja v2 («Revista de sala»): Tinta suave (#5D5951) y Lima (#C8F03C).
 * 
 * @param {Array<string>|string} musculosPrincipales - Lista de músculos principales
 * @param {Array<string>|string} musculosSecundarios - Lista de músculos secundarios
 * @param {Function|null} alTocar - Callback opcional `(musculoCanonico) => void` al tocar un músculo
 * @returns {HTMLElement} Elemento DOM que contiene el SVG y la leyenda
 */
export function mapaSVG(musculosPrincipales = [], musculosSecundarios = [], alTocar = null) {
  const princSet = normalizarConjunto(musculosPrincipales);
  const secSet = normalizarConjunto(musculosSecundarios);

  // Paleta Forja v2 «Revista de sala» (contraste WCAG AA mejorado)
  const COLOR_INACTIVO = 'rgba(93, 89, 81, 0.22)';    // Tinta suave translúcido
  const COLOR_BORDE = '#5D5951';                      // Tinta suave accesible
  const COLOR_BASE = '#E9E4D8';                       // Papel 2 (cabeza, manos, pies)
  const COLOR_PRINCIPAL = '#C8F03C';                  // Lima de tiza
  const COLOR_SECUNDARIO = 'rgba(200, 240, 60, 0.52)'; // Lima suave

  function obtenerColor(canonico) {
    if (princSet.has(canonico)) return COLOR_PRINCIPAL;
    if (secSet.has(canonico)) return COLOR_SECUNDARIO;
    return COLOR_INACTIVO;
  }

  function obtenerClase(canonico) {
    const clases = ['musculo-nodo'];
    if (princSet.has(canonico)) clases.push('es-principal');
    if (secSet.has(canonico)) clases.push('es-secundario');
    return clases.join(' ');
  }

  // Contenedor principal
  const cont = document.createElement('div');
  cont.className = 'forja-mapa-cuerpo';
  cont.style.display = 'flex';
  cont.style.flexDirection = 'column';
  cont.style.alignItems = 'center';
  cont.style.margin = '8px 0';
  cont.style.userSelect = 'none';

  // SVG de frente y espalda juntos (viewBox: 0 0 340 270)
  // Frente: X de 10 a 160 (centro x=85)
  // Espalda: X de 180 a 330 (centro x=255)
  const svgHtml = `
    <svg viewBox="0 0 340 270" width="100%" style="max-width: 360px; height: auto; display: block;" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          .musculo-nodo {
            transition: fill 0.18s ease, filter 0.18s ease, opacity 0.18s ease;
            ${alTocar ? 'cursor: pointer;' : ''}
          }
          .musculo-nodo:hover {
            filter: brightness(1.22);
            opacity: 0.95;
          }
          .musculo-nodo:focus {
            outline: none;
            filter: drop-shadow(0 0 3px #C8F03C);
          }
          .etiqueta-vista {
            fill: #5D5951;
            font-size: 11px;
            font-weight: 600;
            text-anchor: middle;
            font-family: 'Bricolage Grotesque', system-ui, -apple-system, sans-serif;
          }
        </style>
      </defs>

      <!-- Títulos de vistas -->
      <text x="85" y="16" class="etiqueta-vista">Frente</text>
      <text x="255" y="16" class="etiqueta-vista">Espalda</text>

      <!-- ============================================== -->
      <!-- ============ SILUETA BASE: FRENTE ============ -->
      <!-- ============================================== -->
      <g id="base-frente">
        <!-- Cabeza neutra -->
        <ellipse cx="85" cy="34" rx="12" ry="14" fill="${COLOR_BASE}" stroke="${COLOR_BORDE}" stroke-width="1.2" />
        <!-- Manos y pies neutros -->
        <circle cx="34" cy="154" r="5" fill="${COLOR_BASE}" stroke="${COLOR_BORDE}" stroke-width="1" />
        <circle cx="136" cy="154" r="5" fill="${COLOR_BASE}" stroke="${COLOR_BORDE}" stroke-width="1" />
        <ellipse cx="71" cy="254" rx="6" ry="4" fill="${COLOR_BASE}" stroke="${COLOR_BORDE}" stroke-width="1" />
        <ellipse cx="99" cy="254" rx="6" ry="4" fill="${COLOR_BASE}" stroke="${COLOR_BORDE}" stroke-width="1" />
      </g>

      <!-- MÚSCULOS DE FRENTE -->
      <!-- Cuello -->
      <g data-musculo="cuello" class="${obtenerClase('cuello')}">
        <path d="M78 46 L92 46 L95 56 L75 56 Z" fill="${obtenerColor('cuello')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Cuello</title>
        </path>
      </g>

      <!-- Deltoides anterior (hombro frontal) -->
      <g data-musculo="deltoides anterior" class="${obtenerClase('deltoides anterior')}">
        <!-- Izq -->
        <path d="M57 56 C53 62, 53 70, 58 75 C63 76, 68 70, 68 63 C68 57, 63 56, 57 56 Z" fill="${obtenerColor('deltoides anterior')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Deltoides anterior</title>
        </path>
        <!-- Der -->
        <path d="M113 56 C117 62, 117 70, 112 75 C107 76, 102 70, 102 63 C102 57, 107 56, 113 56 Z" fill="${obtenerColor('deltoides anterior')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Deltoides anterior</title>
        </path>
      </g>

      <!-- Deltoides lateral (hombro lateral) -->
      <g data-musculo="deltoides lateral" class="${obtenerClase('deltoides lateral')}">
        <!-- Izq -->
        <path d="M56 58 C51 64, 49 74, 52 82 C55 81, 57 76, 58 70 C57 65, 56 61, 56 58 Z" fill="${obtenerColor('deltoides lateral')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Deltoides lateral</title>
        </path>
        <!-- Der -->
        <path d="M114 58 C119 64, 121 74, 118 82 C115 81, 113 76, 112 70 C113 65, 114 61, 114 58 Z" fill="${obtenerColor('deltoides lateral')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Deltoides lateral</title>
        </path>
      </g>

      <!-- Pectoral -->
      <g data-musculo="pectoral" class="${obtenerClase('pectoral')}">
        <!-- Pectoral Izq -->
        <path d="M70 60 C75 58, 83 58, 84 62 L84 81 C77 82, 69 79, 67 72 C66 65, 68 61, 70 60 Z" fill="${obtenerColor('pectoral')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Pectoral</title>
        </path>
        <!-- Pectoral Der -->
        <path d="M100 60 C95 58, 87 58, 86 62 L86 81 C93 82, 101 79, 103 72 C104 65, 102 61, 100 60 Z" fill="${obtenerColor('pectoral')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Pectoral</title>
        </path>
      </g>

      <!-- Bíceps -->
      <g data-musculo="bíceps" class="${obtenerClase('bíceps')}">
        <!-- Izq -->
        <path d="M49 78 C45 86, 45 98, 49 105 C54 105, 57 97, 57 88 C57 83, 53 79, 49 78 Z" fill="${obtenerColor('bíceps')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Bíceps</title>
        </path>
        <!-- Der -->
        <path d="M121 78 C125 86, 125 98, 121 105 C116 105, 113 97, 113 88 C113 83, 117 79, 121 78 Z" fill="${obtenerColor('bíceps')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Bíceps</title>
        </path>
      </g>

      <!-- Antebrazo -->
      <g data-musculo="antebrazo" class="${obtenerClase('antebrazo')}">
        <!-- Izq -->
        <path d="M48 106 C42 115, 36 128, 36 148 L44 147 C48 132, 53 118, 54 107 Z" fill="${obtenerColor('antebrazo')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Antebrazo</title>
        </path>
        <!-- Der -->
        <path d="M122 106 C128 115, 134 128, 134 148 L126 147 C122 132, 117 118, 116 107 Z" fill="${obtenerColor('antebrazo')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Antebrazo</title>
        </path>
      </g>

      <!-- Abdomen -->
      <g data-musculo="abdomen" class="${obtenerClase('abdomen')}">
        <path d="M78 83 L92 83 L91 122 L79 122 Z" fill="${obtenerColor('abdomen')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Abdomen</title>
        </path>
      </g>

      <!-- Oblicuos -->
      <g data-musculo="oblicuos" class="${obtenerClase('oblicuos')}">
        <!-- Izq -->
        <path d="M68 83 C74 83, 76 86, 76 120 C71 119, 67 113, 67 96 C67 89, 68 85, 68 83 Z" fill="${obtenerColor('oblicuos')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Oblicuos</title>
        </path>
        <!-- Der -->
        <path d="M102 83 C96 83, 94 86, 94 120 C99 119, 103 113, 103 96 C103 89, 102 85, 102 83 Z" fill="${obtenerColor('oblicuos')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Oblicuos</title>
        </path>
      </g>

      <!-- Cuádriceps -->
      <g data-musculo="cuádriceps" class="${obtenerClase('cuádriceps')}">
        <!-- Muslo Izq -->
        <path d="M67 126 C64 140, 64 165, 68 186 C72 188, 77 188, 79 184 C81 166, 81 146, 78 126 Z" fill="${obtenerColor('cuádriceps')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Cuádriceps</title>
        </path>
        <!-- Muslo Der -->
        <path d="M103 126 C106 140, 106 165, 102 186 C98 188, 93 188, 91 184 C89 166, 89 146, 92 126 Z" fill="${obtenerColor('cuádriceps')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Cuádriceps</title>
        </path>
      </g>

      <!-- Aductores -->
      <g data-musculo="aductores" class="${obtenerClase('aductores')}">
        <!-- Aductor Izq -->
        <path d="M79 128 L84 128 L82 165 L79 155 Z" fill="${obtenerColor('aductores')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Aductores</title>
        </path>
        <!-- Aductor Der -->
        <path d="M91 128 L86 128 L88 165 L91 155 Z" fill="${obtenerColor('aductores')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Aductores</title>
        </path>
      </g>

      <!-- Gemelos (frente) -->
      <g data-musculo="gemelos" class="${obtenerClase('gemelos')}">
        <!-- Gemelo Izq -->
        <path d="M68 194 C65 206, 65 224, 69 246 L76 246 C79 230, 79 210, 77 194 Z" fill="${obtenerColor('gemelos')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Gemelos</title>
        </path>
        <!-- Gemelo Der -->
        <path d="M102 194 C105 206, 105 224, 101 246 L94 246 C91 230, 91 210, 93 194 Z" fill="${obtenerColor('gemelos')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Gemelos</title>
        </path>
      </g>


      <!-- ============================================== -->
      <!-- =========== SILUETA BASE: ESPALDA ============ -->
      <!-- ============================================== -->
      <g id="base-espalda">
        <!-- Cabeza neutra posterior -->
        <ellipse cx="255" cy="34" rx="12" ry="14" fill="${COLOR_BASE}" stroke="${COLOR_BORDE}" stroke-width="1.2" />
        <!-- Manos y pies neutros -->
        <circle cx="204" cy="154" r="5" fill="${COLOR_BASE}" stroke="${COLOR_BORDE}" stroke-width="1" />
        <circle cx="306" cy="154" r="5" fill="${COLOR_BASE}" stroke="${COLOR_BORDE}" stroke-width="1" />
        <ellipse cx="241" cy="254" rx="6" ry="4" fill="${COLOR_BASE}" stroke="${COLOR_BORDE}" stroke-width="1" />
        <ellipse cx="269" cy="254" rx="6" ry="4" fill="${COLOR_BASE}" stroke="${COLOR_BORDE}" stroke-width="1" />
      </g>

      <!-- MÚSCULOS DE ESPALDA -->
      <!-- Trapecio -->
      <g data-musculo="trapecio" class="${obtenerClase('trapecio')}">
        <path d="M248 46 L262 46 L269 56 L255 86 L241 56 Z" fill="${obtenerColor('trapecio')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Trapecio</title>
        </path>
      </g>

      <!-- Deltoides posterior -->
      <g data-musculo="deltoides posterior" class="${obtenerClase('deltoides posterior')}">
        <!-- Izq -->
        <path d="M228 56 C223 62, 224 72, 229 76 C234 76, 238 70, 238 62 C238 56, 233 55, 228 56 Z" fill="${obtenerColor('deltoides posterior')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Deltoides posterior</title>
        </path>
        <!-- Der -->
        <path d="M282 56 C287 62, 286 72, 281 76 C276 76, 272 70, 272 62 C272 56, 277 55, 282 56 Z" fill="${obtenerColor('deltoides posterior')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Deltoides posterior</title>
        </path>
      </g>

      <!-- Romboides -->
      <g data-musculo="romboides" class="${obtenerClase('romboides')}">
        <path d="M247 62 L254 74 L256 74 L263 62 L255 83 Z" fill="${obtenerColor('romboides')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Romboides</title>
        </path>
      </g>

      <!-- Tríceps -->
      <g data-musculo="tríceps" class="${obtenerClase('tríceps')}">
        <!-- Izq -->
        <path d="M221 75 C216 83, 215 97, 219 105 C224 104, 227 96, 227 86 C227 80, 224 76, 221 75 Z" fill="${obtenerColor('tríceps')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Tríceps</title>
        </path>
        <!-- Der -->
        <path d="M289 75 C294 83, 295 97, 291 105 C286 104, 283 96, 283 86 C283 80, 286 76, 289 75 Z" fill="${obtenerColor('tríceps')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Tríceps</title>
        </path>
      </g>

      <!-- Antebrazo posterior -->
      <g data-musculo="antebrazo" class="${obtenerClase('antebrazo')}">
        <!-- Izq -->
        <path d="M218 106 C212 115, 206 128, 206 148 L214 147 C218 132, 223 118, 224 107 Z" fill="${obtenerColor('antebrazo')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Antebrazo</title>
        </path>
        <!-- Der -->
        <path d="M292 106 C298 115, 304 128, 304 148 L296 147 C292 132, 287 118, 286 107 Z" fill="${obtenerColor('antebrazo')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Antebrazo</title>
        </path>
      </g>

      <!-- Dorsal ancho -->
      <g data-musculo="dorsal ancho" class="${obtenerClase('dorsal ancho')}">
        <!-- Izq -->
        <path d="M239 74 C246 84, 248 98, 250 114 C243 112, 236 98, 236 84 C236 78, 238 75, 239 74 Z" fill="${obtenerColor('dorsal ancho')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Dorsal ancho</title>
        </path>
        <!-- Der -->
        <path d="M271 74 C264 84, 262 98, 260 114 C267 112, 274 98, 274 84 C274 78, 272 75, 271 74 Z" fill="${obtenerColor('dorsal ancho')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Dorsal ancho</title>
        </path>
      </g>

      <!-- Erectores (lumbares) -->
      <g data-musculo="erectores" class="${obtenerClase('erectores')}">
        <path d="M250 88 L260 88 L259 122 L251 122 Z" fill="${obtenerColor('erectores')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Erectores</title>
        </path>
      </g>

      <!-- Abductores (glúteo medio / cadera posterior) -->
      <g data-musculo="abductores" class="${obtenerClase('abductores')}">
        <!-- Izq -->
        <path d="M235 124 C239 124, 241 129, 242 144 C237 142, 234 135, 235 124 Z" fill="${obtenerColor('abductores')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Abductores</title>
        </path>
        <!-- Der -->
        <path d="M275 124 C271 124, 269 129, 268 144 C273 142, 276 135, 275 124 Z" fill="${obtenerColor('abductores')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Abductores</title>
        </path>
      </g>

      <!-- Glúteo -->
      <g data-musculo="glúteo" class="${obtenerClase('glúteo')}">
        <!-- Glúteo Izq -->
        <path d="M242 124 C252 123, 254 130, 254 154 C245 156, 238 147, 240 134 C240 128, 241 125, 242 124 Z" fill="${obtenerColor('glúteo')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Glúteo</title>
        </path>
        <!-- Glúteo Der -->
        <path d="M268 124 C258 123, 256 130, 256 154 C265 156, 272 147, 270 134 C270 128, 269 125, 268 124 Z" fill="${obtenerColor('glúteo')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Glúteo</title>
        </path>
      </g>

      <!-- Isquiotibiales (femoral) -->
      <g data-musculo="isquiotibiales" class="${obtenerClase('isquiotibiales')}">
        <!-- Izq -->
        <path d="M239 157 C237 168, 238 182, 241 190 C247 190, 251 184, 252 170 C253 162, 252 157, 250 156 Z" fill="${obtenerColor('isquiotibiales')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Isquiotibiales</title>
        </path>
        <!-- Der -->
        <path d="M271 157 C273 168, 272 182, 269 190 C263 190, 259 184, 258 170 C257 162, 258 157, 260 156 Z" fill="${obtenerColor('isquiotibiales')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Isquiotibiales</title>
        </path>
      </g>

      <!-- Gemelos (espalda) -->
      <g data-musculo="gemelos" class="${obtenerClase('gemelos')}">
        <!-- Gemelo Izq -->
        <path d="M238 194 C234 206, 235 224, 239 246 L246 246 C249 230, 249 210, 247 194 Z" fill="${obtenerColor('gemelos')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Gemelos</title>
        </path>
        <!-- Gemelo Der -->
        <path d="M272 194 C276 206, 275 224, 271 246 L264 246 C261 230, 261 210, 263 194 Z" fill="${obtenerColor('gemelos')}" stroke="${COLOR_BORDE}" stroke-width="1">
          <title>Gemelos</title>
        </path>
      </g>
    </svg>
  `;

  // Leyenda de colores explicativa (sin emojis, colores lima y tinta suave accesible)
  const leyendaHtml = `
    <div style="display: flex; gap: 14px; justify-content: center; font-size: 11px; margin-top: 6px; color: var(--tinta-suave, #5D5951); font-family: 'Bricolage Grotesque', system-ui, sans-serif;">
      <span style="display: inline-flex; align-items: center; gap: 5px;">
        <span style="width: 8px; height: 8px; border-radius: 999px; background: ${COLOR_PRINCIPAL}; display: inline-block;"></span>
        Principal
      </span>
      <span style="display: inline-flex; align-items: center; gap: 5px;">
        <span style="width: 8px; height: 8px; border-radius: 999px; background: ${COLOR_SECUNDARIO}; display: inline-block;"></span>
        Secundario
      </span>
      ${alTocar ? '<span style="font-style: italic;">• Toca para filtrar</span>' : ''}
    </div>
  `;

  cont.innerHTML = svgHtml + leyendaHtml;

  // Si hay callback interactivo alTocar, enganchar a cada grupo muscular
  if (typeof alTocar === 'function') {
    const grupos = cont.querySelectorAll('[data-musculo]');
    grupos.forEach((el) => {
      const musculo = el.getAttribute('data-musculo');
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        alTocar(musculo);
      });
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          alTocar(musculo);
        }
      });
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', `Filtrar por músculo ${musculo}`);
    });
  }

  cont.toString = function () {
    return cont.outerHTML;
  };

  return cont;
}

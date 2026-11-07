// =============================================================================
// js/camara.js - Sección 5: Visión Artificial con MediaPipe PoseLandmarker
// Pantalla completa de Cámara para Forja v2 (PWA) — Dirección «Revista de sala»
// Vista inmersiva en modo .oscuro (#17171A), guías y puntos en lima (#C8F03C),
// botones píldora (999px), tarjetas sin bordes (28px) y números héroe tabulares.
// =============================================================================

import { abrir, nuevoId, guardar, obtener, todos } from './db.js';
import { h, aviso, dialogo, confirmar, hoyISO, fechaBonita, formatoKg, vibrar, sonido } from './ui.js';
import { perfil, ejercicio } from './datos.js';
import { ir } from './app.js';
import { MEDIAPIPE_JS, MEDIAPIPE_WASM, MEDIAPIPE_MODELO } from './config.js';
import { qrSvg, leerQR } from './qr.js';
import { icono } from './iconos.js';

// --- Estado global del módulo de cámara ---
let contenedorRaiz = null;
let streamVideo = null;
let elementoVideo = null;
let canvasSuperpuesto = null;
let contexto2D = null;
let idAnimacion = null;
let poseLandmarker = null;
let cargandoModelo = false;
let errorModelo = null;
let desmontado = false; // Bandera para evitar fugas de hardware al navegar

// Parámetros de la cámara
let modoActual = 'foto'; // 'foto' | 'medir' | 'reps' | 'qr'
let camaraTrasera = false; // false = user (frontal), true = environment
let camaraPausada = false;
let ultimoTimestampVideo = -1;
let ultimoEscaneoQR = 0; // Control de cadencia a ~5 fps para BarcodeDetector

// Estado de Modo 1: Foto guiada
let estadoFoto = {
  cuentaRegresiva: null,
  segundosRestantes: 5,
  intervaloCuenta: null,
  estableMs: 0,
  ultimoCheck: 0,
  altoAnteriorPx: null,
  capturaBlob: null,
  fotoGuardada: false
};

// Estado de Modo 2: Medir proporciones
let estadoMedicion = {
  cuadrosRecolectados: [],
  maxCuadros: 30,
  completado: false,
  resultado: null,
  estaturaCm: 175,
  ultimoLandmarkCentral: null
};

// Estado de Modo 3: Contar repeticiones (IDs canónicos de ejercicios.json)
let estadoReps = {
  ejercicio: 'curl_martillo_mancuernas',
  reps: 0,
  fase: 'extendido', // 'extendido' | 'subiendo' | 'contraido' | 'bajando'
  anguloActual: 0,
  rangoIncompleto: false,
  tiempoInicioFase: 0,
  duracionUltimaRep: 0,
  cadenciaAviso: ''
};

// Estado de Modo 4: QR & Sincronización
let estadoQR = {
  submodo: 'recibir', // 'recibir' (escanear) | 'enviar' (mostrar QR)
  ultimoDetectado: null,
  detectorDisponible: (typeof window !== 'undefined' && 'BarcodeDetector' in window),
  qrGeneradoSvg: ''
};

// Conexiones esqueléticas estándar de MediaPipe Pose (33 landmarks)
const CONEXIONES_POSE = [
  [11, 12], // Hombros
  [11, 13], [13, 15], // Brazo izq
  [12, 14], [14, 16], // Brazo der
  [11, 23], [12, 24], // Torso
  [23, 24], // Caderas
  [23, 25], [25, 27], // Pierna izq
  [24, 26], [26, 28], // Pierna der
  [27, 29], [29, 31], // Pie izq
  [28, 30], [30, 32]  // Pie der
];

// Articulaciones y umbrales para conteo biomecánico con IDs reales de ejercicios.json
const EJERCICIOS_CONFIG = {
  curl_martillo_mancuernas: {
    id: 'curl_martillo_mancuernas',
    nombre: 'Curl martillo con mancuernas',
    articulacion: 'Codo',
    puntos: [11, 13, 15], // hombro, codo, muñeca
    anguloExtendido: 145,
    anguloContraido: 55,
    invertido: false
  },
  press_militar_mancuernas_sentado: {
    id: 'press_militar_mancuernas_sentado',
    nombre: 'Press militar con mancuernas sentado',
    articulacion: 'Codo y hombro',
    puntos: [11, 13, 15],
    anguloExtendido: 155, // brazos arriba
    anguloContraido: 75,  // codos flexionados
    invertido: true
  },
  sentadilla_hack: {
    id: 'sentadilla_hack',
    nombre: 'Sentadilla hack en máquina',
    articulacion: 'Rodilla',
    puntos: [23, 25, 27], // cadera, rodilla, tobillo
    anguloExtendido: 160, // piernas extendidas
    anguloContraido: 90,  // profundidad paralela
    invertido: false
  },
  elevaciones_laterales_mancuerna_pie: {
    id: 'elevaciones_laterales_mancuerna_pie',
    nombre: 'Elevaciones laterales con mancuernas de pie',
    articulacion: 'Hombro',
    puntos: [23, 11, 13], // cadera, hombro, codo
    anguloExtendido: 30,  // brazos abajo
    anguloContraido: 85,  // brazos horizontales
    invertido: true
  },
  flexiones_declinadas: {
    id: 'flexiones_declinadas',
    nombre: 'Flexiones declinadas con pies elevados',
    articulacion: 'Codo',
    puntos: [11, 13, 15],
    anguloExtendido: 155, // brazos rectos
    anguloContraido: 85,  // pecho abajo
    invertido: false
  },
  dominadas_pronadas: {
    id: 'dominadas_pronadas',
    nombre: 'Dominadas pronadas con peso corporal',
    articulacion: 'Codo',
    puntos: [11, 13, 15],
    anguloExtendido: 150, // colgado abajo
    anguloContraido: 65,  // arriba en la barra
    invertido: false
  }
};

/**
 * Renderiza de manera segura un icono SVG proveniente de ./iconos.js.
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
 * Calcula el ángulo en grados en el vértice B formado por los puntos A, B y C.
 */
function calcularAngulo(a, b, c) {
  if (!a || !b || !c) return 0;
  const rad = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let deg = Math.abs((rad * 180.0) / Math.PI);
  if (deg > 180.0) deg = 360.0 - deg;
  return Math.round(deg);
}

/**
 * Distancia euclidiana 2D entre dos puntos en píxeles.
 */
function distancia2D(p1, p2, ancho, alto) {
  const dx = (p1.x - p2.x) * ancho;
  const dy = (p1.y - p2.y) * alto;
  return Math.sqrt(dx * dx + dy * dy);
}

// -----------------------------------------------------------------------------
// Inicialización y Carga de MediaPipe PoseLandmarker
// -----------------------------------------------------------------------------
async function cargarPoseLandmarker() {
  if (poseLandmarker) return poseLandmarker;
  if (cargandoModelo) return null;

  cargandoModelo = true;
  errorModelo = null;
  actualizarUIEstado('Cargando visión artificial (MediaPipe)...');

  try {
    const vision = await import(MEDIAPIPE_JS);
    const { FilesetResolver, PoseLandmarker } = vision;

    const wasmFileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);

    // Intentar primero con aceleración GPU y respaldar en CPU
    try {
      poseLandmarker = await PoseLandmarker.createFromOptions(wasmFileset, {
        baseOptions: {
          modelAssetPath: MEDIAPIPE_MODELO,
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        outputSegmentationMasks: true
      });
    } catch (eGpu) {
      console.warn('GPU no disponible para MediaPipe, usando CPU...', eGpu);
      poseLandmarker = await PoseLandmarker.createFromOptions(wasmFileset, {
        baseOptions: {
          modelAssetPath: MEDIAPIPE_MODELO,
          delegate: 'CPU'
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        outputSegmentationMasks: true
      });
    }

    cargandoModelo = false;
    actualizarUIEstado('Visión artificial lista');
    return poseLandmarker;
  } catch (err) {
    console.error('Error al inicializar PoseLandmarker:', err);
    cargandoModelo = false;
    errorModelo = 'No se pudo cargar el modelo de visión. Revisa tu conexión.';
    actualizarUIEstado(errorModelo, true);
    aviso(errorModelo, 'error');
    return null;
  }
}

// -----------------------------------------------------------------------------
// Gestión del flujo de video y cámara web
// -----------------------------------------------------------------------------
async function iniciarCamara() {
  detenerCamara();

  if (desmontado) return;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    aviso('Tu dispositivo o navegador no admite acceso a la cámara', 'error');
    actualizarUIEstado('Cámara no compatible', true);
    return;
  }

  const facingMode = camaraTrasera ? { ideal: 'environment' } : { ideal: 'user' };
  actualizarUIEstado('Iniciando cámara...');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    if (desmontado || !elementoVideo || (modoActual === 'qr' && estadoQR.submodo === 'enviar')) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    streamVideo = stream;
    elementoVideo.srcObject = streamVideo;
    await elementoVideo.play();
    camaraPausada = false;
    actualizarUIEstado('');
    iniciarBucleDeteccion();
  } catch (err) {
    console.error('Error al acceder a la cámara:', err);
    let msg = 'Permiso de cámara denegado o no disponible';
    if (err.name === 'NotAllowedError') msg = 'Debes permitir el acceso a la cámara';
    actualizarUIEstado(msg, true);
    aviso(msg, 'error');
  }
}

/**
 * Detiene completamente todas las pistas activas del hardware de la cámara.
 */
function detenerCamara() {
  if (idAnimacion) {
    cancelAnimationFrame(idAnimacion);
    idAnimacion = null;
  }
  if (streamVideo) {
    try {
      streamVideo.getTracks().forEach((track) => track.stop());
    } catch (e) {
      // Ignorar errores al cerrar pistas
    }
    streamVideo = null;
  }
  if (elementoVideo) {
    elementoVideo.srcObject = null;
  }
}

// -----------------------------------------------------------------------------
// Bucle principal de detección y renderizado en Canvas
// -----------------------------------------------------------------------------
function iniciarBucleDeteccion() {
  if (idAnimacion) cancelAnimationFrame(idAnimacion);

  async function frame() {
    if (desmontado || !elementoVideo || elementoVideo.ended) {
      return;
    }

    if (elementoVideo.paused) {
      idAnimacion = requestAnimationFrame(frame);
      return;
    }

    const videoW = elementoVideo.videoWidth;
    const videoH = elementoVideo.videoHeight;

    if (videoW > 0 && videoH > 0 && canvasSuperpuesto && contexto2D) {
      if (canvasSuperpuesto.width !== videoW || canvasSuperpuesto.height !== videoH) {
        canvasSuperpuesto.width = videoW;
        canvasSuperpuesto.height = videoH;
      }

      contexto2D.clearRect(0, 0, videoW, videoH);

      // Si estamos en modo escaneo de QR (cadencia a ~5 fps)
      if (modoActual === 'qr' && estadoQR.submodo === 'recibir') {
        await procesarCuadroQR();
      }

      // Si poseLandmarker está cargado y no estamos en QR
      if (poseLandmarker && modoActual !== 'qr') {
        const ahora = performance.now();
        if (ahora !== ultimoTimestampVideo) {
          ultimoTimestampVideo = ahora;
          try {
            const resultados = poseLandmarker.detectForVideo(elementoVideo, ahora);
            if (resultados && resultados.landmarks && resultados.landmarks.length > 0) {
              const landmarks = resultados.landmarks[0];
              dibujarEsqueleto(landmarks, videoW, videoH);
              procesarModoActivo(landmarks, videoW, videoH, resultados.segmentationMasks);
            } else {
              dibujarGuiaVacia(videoW, videoH);
            }
          } catch (e) {
            // Ignorar errores de fotogramas pendientes
          }
        }
      }
    }

    if (!desmontado && elementoVideo) {
      idAnimacion = requestAnimationFrame(frame);
    }
  }

  idAnimacion = requestAnimationFrame(frame);
}

// -----------------------------------------------------------------------------
// Dibujo de esqueleto y puntos en Canvas (Guías y puntos en lima #C8F03C)
// -----------------------------------------------------------------------------
function dibujarEsqueleto(landmarks, w, h) {
  contexto2D.save();

  // Si la cámara es frontal, reflejamos horizontalmente para vista en espejo
  if (!camaraTrasera) {
    contexto2D.translate(w, 0);
    contexto2D.scale(-1, 1);
  }

  // 1. Dibujar conexiones de huesos en lima de tiza con transparencia editorial
  contexto2D.strokeStyle = 'rgba(200, 240, 60, 0.75)';
  contexto2D.lineWidth = Math.max(3, Math.round(w / 250));
  contexto2D.lineCap = 'round';
  contexto2D.lineJoin = 'round';

  for (const [i1, i2] of CONEXIONES_POSE) {
    const p1 = landmarks[i1];
    const p2 = landmarks[i2];
    if (p1 && p2 && (p1.visibility || 1) > 0.4 && (p2.visibility || 1) > 0.4) {
      contexto2D.beginPath();
      contexto2D.moveTo(p1.x * w, p1.y * h);
      contexto2D.lineTo(p2.x * w, p2.y * h);
      contexto2D.stroke();
    }
  }

  // 2. Dibujar puntos de articulación en lima (#C8F03C) con borde en tinta (#17171A)
  for (let i = 0; i < landmarks.length; i++) {
    const pt = landmarks[i];
    if (!pt || (pt.visibility || 1) < 0.4) continue;

    const esClave = [0, 11, 12, 13, 14, 23, 24, 25, 26].includes(i);
    const radio = esClave ? Math.max(5, Math.round(w / 160)) : Math.max(3, Math.round(w / 260));

    contexto2D.beginPath();
    contexto2D.arc(pt.x * w, pt.y * h, radio, 0, 2 * Math.PI);
    contexto2D.fillStyle = '#C8F03C';
    contexto2D.fill();
    contexto2D.lineWidth = 2;
    contexto2D.strokeStyle = '#17171A';
    contexto2D.stroke();
  }

  contexto2D.restore();
}

function dibujarGuiaVacia(w, h) {
  if (modoActual === 'foto') {
    dibujarSiluetaGuia(w, h, 'Ubícate frente a la cámara');
  }
}

// -----------------------------------------------------------------------------
// Lógica de Modos de Visión
// -----------------------------------------------------------------------------

/**
 * Modo 1: Silueta guía de foto de progreso (trazado lima #C8F03C)
 */
function dibujarSiluetaGuia(w, h, mensajeEstado, enPosicion = false) {
  contexto2D.save();

  const cx = w / 2;
  const colorBorde = enPosicion ? '#C8F03C' : 'rgba(243, 240, 232, 0.35)';
  contexto2D.strokeStyle = colorBorde;
  contexto2D.lineWidth = 3.5;
  contexto2D.setLineDash([12, 8]);

  const altoRef = h * 0.75;
  const topeY = h * 0.12;
  const radioCabeza = altoRef * 0.08;

  // Cabeza
  contexto2D.beginPath();
  contexto2D.arc(cx, topeY + radioCabeza, radioCabeza, 0, Math.PI * 2);
  contexto2D.stroke();

  // Hombros y torso
  const hombrosY = topeY + radioCabeza * 2 + 10;
  const anchoHombros = altoRef * 0.28;
  contexto2D.beginPath();
  contexto2D.moveTo(cx - anchoHombros / 2, hombrosY);
  contexto2D.lineTo(cx + anchoHombros / 2, hombrosY);

  const caderaY = hombrosY + altoRef * 0.35;
  const anchoCadera = anchoHombros * 0.75;
  contexto2D.lineTo(cx + anchoCadera / 2, caderaY);
  contexto2D.lineTo(cx - anchoCadera / 2, caderaY);
  contexto2D.closePath();
  contexto2D.stroke();

  // Brazos levemente abiertos
  contexto2D.beginPath();
  contexto2D.moveTo(cx - anchoHombros / 2, hombrosY);
  contexto2D.lineTo(cx - anchoHombros / 2 - 35, caderaY - 10);
  contexto2D.moveTo(cx + anchoHombros / 2, hombrosY);
  contexto2D.lineTo(cx + anchoHombros / 2 + 35, caderaY - 10);
  contexto2D.stroke();

  contexto2D.setLineDash([]);

  // Píldora de mensaje flotante superior
  contexto2D.fillStyle = 'rgba(23, 23, 26, 0.85)';
  const boxW = 320;
  contexto2D.roundRect(cx - boxW / 2, 22, boxW, 44, 999);
  contexto2D.fill();

  contexto2D.font = "600 15px 'Bricolage Grotesque', sans-serif";
  contexto2D.fillStyle = enPosicion ? '#C8F03C' : '#F3F0E8';
  contexto2D.textAlign = 'center';
  contexto2D.fillText(mensajeEstado, cx, 50);

  contexto2D.restore();
}

function procesarModoActivo(landmarks, w, h, masks) {
  if (modoActual === 'foto') {
    procesarFotoGuiada(landmarks, w, h);
  } else if (modoActual === 'medir') {
    procesarMedicion(landmarks, w, h, masks);
  } else if (modoActual === 'reps') {
    procesarContadorReps(landmarks, w, h);
  }
}

function procesarFotoGuiada(landmarks, w, h) {
  const nariz = landmarks[0];
  const hombroIzq = landmarks[11];
  const hombroDer = landmarks[12];
  const caderaIzq = landmarks[23];
  const caderaDer = landmarks[24];
  const tobilloIzq = landmarks[27];
  const tobilloDer = landmarks[28];
  const munecaIzq = landmarks[15];
  const munecaDer = landmarks[16];

  const puntosEsenciales = [nariz, hombroIzq, hombroDer, caderaIzq, caderaDer, tobilloIzq, tobilloDer];
  const todosVisibles = puntosEsenciales.every((p) => p && (p.visibility || 1) > 0.55);

  if (!todosVisibles) {
    estadoFoto.estableMs = 0;
    dibujarSiluetaGuia(w, h, 'Ponte completo en cuadro (cabeza a pies)');
    cancelarCuentaRegresiva();
    return;
  }

  // Verificar que esté de frente
  const diffProfundidadHombros = Math.abs(hombroIzq.z - hombroDer.z);
  if (diffProfundidadHombros > 0.16) {
    dibujarSiluetaGuia(w, h, 'Gira hacia el frente');
    cancelarCuentaRegresiva();
    return;
  }

  // Verificar brazos un poco abiertos
  const distManoCaderaIzq = Math.abs(munecaIzq.x - caderaIzq.x);
  const distManoCaderaDer = Math.abs(munecaDer.x - caderaDer.x);
  if (distManoCaderaIzq < 0.05 && distManoCaderaDer < 0.05) {
    dibujarSiluetaGuia(w, h, 'Abre un poco los brazos');
    cancelarCuentaRegresiva();
    return;
  }

  // Altura del cuerpo actual en píxeles
  const yTope = nariz.y * h;
  const yBase = Math.max(tobilloIzq.y, tobilloDer.y) * h;
  const altoPxActual = yBase - yTope;

  // Comparar con foto anterior si existe
  let avisoDistancia = 'Posición excelente';
  if (estadoFoto.altoAnteriorPx) {
    const diffPorcentaje = (altoPxActual - estadoFoto.altoAnteriorPx) / estadoFoto.altoAnteriorPx;
    if (diffPorcentaje > 0.12) {
      avisoDistancia = 'Aléjate un paso (muy cerca vs última vez)';
    } else if (diffPorcentaje < -0.12) {
      avisoDistancia = 'Acércate un paso (muy lejos vs última vez)';
    }
  }

  dibujarSiluetaGuia(w, h, avisoDistancia, true);

  if (!estadoFoto.cuentaRegresiva) {
    iniciarCuentaRegresiva(altoPxActual, landmarks);
  }
}

function iniciarCuentaRegresiva(altoPx, landmarks) {
  estadoFoto.cuentaRegresiva = true;
  estadoFoto.segundosRestantes = 5;

  const elementoCuenta = document.getElementById('camara-cuenta-atras');
  if (elementoCuenta) {
    elementoCuenta.style.display = 'flex';
    elementoCuenta.textContent = '5';
  }

  vibrar(60);
  sonido();

  estadoFoto.intervaloCuenta = setInterval(() => {
    estadoFoto.segundosRestantes--;

    if (elementoCuenta) {
      elementoCuenta.textContent = String(estadoFoto.segundosRestantes);
    }

    if (estadoFoto.segundosRestantes > 0) {
      vibrar(40);
      sonido();
    } else {
      clearInterval(estadoFoto.intervaloCuenta);
      estadoFoto.intervaloCuenta = null;
      if (elementoCuenta) elementoCuenta.style.display = 'none';
      tomarFotoProgreso(altoPx, landmarks);
    }
  }, 1000);
}

function cancelarCuentaRegresiva() {
  if (estadoFoto.intervaloCuenta) {
    clearInterval(estadoFoto.intervaloCuenta);
    estadoFoto.intervaloCuenta = null;
  }
  estadoFoto.cuentaRegresiva = null;
  const elementoCuenta = document.getElementById('camara-cuenta-atras');
  if (elementoCuenta) elementoCuenta.style.display = 'none';
}

async function tomarFotoProgreso(altoPx, landmarks) {
  vibrar([100, 50, 100]);
  sonido();

  const canvasFoto = document.createElement('canvas');
  canvasFoto.width = elementoVideo.videoWidth;
  canvasFoto.height = elementoVideo.videoHeight;
  const ctxFoto = canvasFoto.getContext('2d');

  if (!camaraTrasera) {
    ctxFoto.translate(canvasFoto.width, 0);
    ctxFoto.scale(-1, 1);
  }
  ctxFoto.drawImage(elementoVideo, 0, 0);

  canvasFoto.toBlob(async (blob) => {
    if (!blob) {
      aviso('Error al capturar la imagen', 'error');
      return;
    }

    const nuevaFoto = {
      id: nuevoId(),
      fecha: hoyISO(),
      vista: 'frente',
      blob: blob,
      puntos: landmarks,
      altoPx: Math.round(altoPx)
    };

    try {
      await guardar('fotos', nuevaFoto);
      estadoFoto.altoAnteriorPx = altoPx;
      aviso('Foto de progreso guardada en tu cuerpo', 'ok');

      const urlImg = URL.createObjectURL(blob);
      const imgPreview = h('img', {
        src: urlImg,
        style: 'width:100%;max-height:260px;object-fit:cover;border-radius:28px;filter:contrast(1.05) saturate(0.9);'
      });

      await dialogo({
        titulo: 'Foto de progreso guardada',
        cuerpo: h('div', { class: 'col', style: 'gap:12px;' },
          imgPreview,
          h('p', { class: 'sutil' }, `Registrada hoy (${fechaBonita(hoyISO())}) con altura calibrada de ${Math.round(altoPx)} px.`)
        ),
        botones: [
          { texto: 'Ir a ver en Cuerpo', valor: 'cuerpo', tipo: 'primario' },
          { texto: 'Tomar otra', valor: 'seguir' }
        ]
      }).then((resp) => {
        URL.revokeObjectURL(urlImg);
        if (resp === 'cuerpo') ir('#cuerpo');
      });
    } catch (err) {
      console.error(err);
      aviso('No se pudo guardar la foto en el teléfono', 'error');
    }
  }, 'image/jpeg', 0.92);
}

/**
 * Modo 2: Medir proporciones (hombros, cintura, V-taper)
 */
function procesarMedicion(landmarks, w, h, masks) {
  if (estadoMedicion.completado) return;

  const hombroIzq = landmarks[11];
  const hombroDer = landmarks[12];
  const caderaIzq = landmarks[23];
  const caderaDer = landmarks[24];
  const tobilloIzq = landmarks[27];
  const tobilloDer = landmarks[28];
  const nariz = landmarks[0];

  const visibles = [hombroIzq, hombroDer, caderaIzq, caderaDer, tobilloIzq, tobilloDer].every(
    (p) => p && (p.visibility || 1) > 0.6
  );

  if (!visibles) {
    actualizarProgresoMedicion('Ponte recto en cuadro completo para medir', 0);
    return;
  }

  // Detectar movimiento excesivo (estabilidad)
  const centroActual = { x: (hombroIzq.x + hombroDer.x) / 2, y: (hombroIzq.y + hombroDer.y) / 2 };
  if (estadoMedicion.ultimoLandmarkCentral) {
    const mov = Math.hypot(
      (centroActual.x - estadoMedicion.ultimoLandmarkCentral.x) * w,
      (centroActual.y - estadoMedicion.ultimoLandmarkCentral.y) * h
    );
    if (mov > 5) {
      actualizarProgresoMedicion('Quédate quieto... descartando movimiento', estadoMedicion.cuadrosRecolectados.length);
      estadoMedicion.ultimoLandmarkCentral = centroActual;
      return;
    }
  }
  estadoMedicion.ultimoLandmarkCentral = centroActual;

  const altoCuerpoPx = (Math.max(tobilloIzq.y, tobilloDer.y) - nariz.y) * h * 1.15;
  const cmPorPx = estadoMedicion.estaturaCm / altoCuerpoPx;

  const anchoHombrosPx = distancia2D(hombroIzq, hombroDer, w, h) * 1.14;
  const hombrosCm = anchoHombrosPx * cmPorPx;

  const anchoCinturaPx = distancia2D(caderaIzq, caderaDer, w, h) * 1.08;
  const cinturaCm = anchoCinturaPx * cmPorPx;

  const ratioV = hombrosCm / cinturaCm;

  estadoMedicion.cuadrosRecolectados.push({ hombrosCm, cinturaCm, ratioV });

  const cant = estadoMedicion.cuadrosRecolectados.length;
  actualizarProgresoMedicion(`Midiendo proporciones (${cant}/${estadoMedicion.maxCuadros})`, cant);

  if (cant >= estadoMedicion.maxCuadros) {
    finalizarMedicion();
  }
}

function actualizarProgresoMedicion(texto, cuadroActual) {
  const lbl = document.getElementById('medicion-estado-texto');
  const barra = document.getElementById('medicion-barra-relleno');
  if (lbl) lbl.textContent = texto;
  if (barra) {
    const pct = Math.round((cuadroActual / estadoMedicion.maxCuadros) * 100);
    barra.style.width = `${pct}%`;
  }
}

async function finalizarMedicion() {
  estadoMedicion.completado = true;
  vibrar([80, 40, 80]);
  sonido();

  const total = estadoMedicion.cuadrosRecolectados.length;
  const avgHombros = Math.round(
    estadoMedicion.cuadrosRecolectados.reduce((a, b) => a + b.hombrosCm, 0) / total
  );
  const avgCintura = Math.round(
    estadoMedicion.cuadrosRecolectados.reduce((a, b) => a + b.cinturaCm, 0) / total
  );
  const avgRatio = Number(
    (estadoMedicion.cuadrosRecolectados.reduce((a, b) => a + b.ratioV, 0) / total).toFixed(2)
  );

  estadoMedicion.resultado = {
    hombrosCm: avgHombros,
    cinturaCm: avgCintura,
    ratioV: avgRatio,
    margenCm: 3
  };

  const panel = document.getElementById('panel-resultado-medicion');
  if (panel) {
    panel.style.display = 'block';
    panel.innerHTML = `
      <div style="background-color:#26262B;border-radius:28px;padding:20px;display:flex;flex-direction:column;gap:12px;margin-top:14px;">
        <span class="micro-label" style="color:#C8F03C;">PROPORCIONES ESTIMADAS</span>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:#8E8A82;font-size:14px;">Ancho de hombros:</span>
          <strong style="color:#F3F0E8;font-size:16px;">${avgHombros} cm <span style="font-size:12px;color:#8E8A82;">± 3 cm</span></strong>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:#8E8A82;font-size:14px;">Ancho de cintura:</span>
          <strong style="color:#F3F0E8;font-size:16px;">${avgCintura} cm <span style="font-size:12px;color:#8E8A82;">± 3 cm</span></strong>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(243,240,232,0.08);padding-top:10px;">
          <span style="color:#8E8A82;font-size:14px;">Proporción en V (Hombro/Cintura):</span>
          <strong style="color:#C8F03C;font-size:24px;font-family:'Bricolage Grotesque',sans-serif;font-weight:800;">${avgRatio}</strong>
        </div>
        <p style="font-size:12px;color:#8E8A82;margin:0;line-height:1.4;">
          Estimado a partir de tu estatura (${estadoMedicion.estaturaCm} cm) promediando 30 cuadros estables.
        </p>
        <div style="display:flex;gap:10px;margin-top:6px;">
          <button id="btn-guardar-medicion" class="camara-btn-primario-lima" style="flex:1;">Guardar en Cuerpo</button>
          <button id="btn-repetir-medicion" class="camara-btn-secundario">Repetir</button>
        </div>
      </div>
    `;

    document.getElementById('btn-guardar-medicion')?.addEventListener('click', async () => {
      try {
        const idMed = nuevoId();
        const hoy = hoyISO();

        await guardar('camara', {
          id: idMed,
          fecha: hoy,
          hombrosCm: avgHombros,
          cinturaCm: avgCintura,
          ratioV: avgRatio,
          margenCm: 3
        });

        const todasMedidas = await todos('medidas');
        const medidaExistenteHoy = todasMedidas.find((m) => m.fecha === hoy);

        if (medidaExistenteHoy) {
          medidaExistenteHoy.cintura = avgCintura;
          medidaExistenteHoy.hombros = avgHombros;
          medidaExistenteHoy.actualizado = Date.now();
          await guardar('medidas', medidaExistenteHoy);
        } else {
          await guardar('medidas', {
            id: nuevoId(),
            fecha: hoy,
            peso: null,
            cintura: avgCintura,
            cuello: null,
            pecho: null,
            brazo: null,
            hombros: avgHombros,
            cadera: null,
            grasaNavy: null,
            origen: 'camara'
          });
        }

        aviso('Medidas guardadas correctamente en tu Cuerpo', 'ok');
        ir('#cuerpo');
      } catch (err) {
        aviso('Error al guardar las medidas', 'error');
      }
    });

    document.getElementById('btn-repetir-medicion')?.addEventListener('click', () => {
      estadoMedicion.cuadrosRecolectados = [];
      estadoMedicion.completado = false;
      panel.style.display = 'none';
    });
  }
}

/**
 * Modo 3: Contar repeticiones y evaluar técnica biomecánica
 */
function procesarContadorReps(landmarks, w, h) {
  const conf = EJERCICIOS_CONFIG[estadoReps.ejercicio] || EJERCICIOS_CONFIG.curl_martillo_mancuernas;

  let pA = landmarks[conf.puntos[0]];
  let pB = landmarks[conf.puntos[1]];
  let pC = landmarks[conf.puntos[2]];

  if (conf.puntos[0] === 11 && (pA.visibility || 0) < (landmarks[12]?.visibility || 0)) {
    pA = landmarks[12];
    pB = landmarks[14];
    pC = landmarks[16];
  } else if (conf.puntos[0] === 23 && (pA.visibility || 0) < (landmarks[24]?.visibility || 0)) {
    pA = landmarks[24];
    pB = landmarks[26];
    pC = landmarks[28];
  }

  if (!pA || !pB || !pC || (pB.visibility || 1) < 0.5) return;

  const angulo = calcularAngulo(pA, pB, pC);
  estadoReps.anguloActual = angulo;

  dibujarAnguloEnCanvas(pB, angulo, w, h);

  const umbralExtendido = conf.anguloExtendido;
  const umbralContraido = conf.anguloContraido;

  if (estadoReps.fase === 'extendido') {
    if (angulo < umbralExtendido - 15) {
      estadoReps.fase = 'subiendo';
      estadoReps.tiempoInicioFase = performance.now();
      estadoReps.rangoIncompleto = false;
    }
  } else if (estadoReps.fase === 'subiendo') {
    if (angulo <= umbralContraido) {
      estadoReps.fase = 'contraido';
    } else if (angulo > umbralExtendido - 5) {
      estadoReps.fase = 'extendido';
      estadoReps.rangoIncompleto = true;
    }
  } else if (estadoReps.fase === 'contraido') {
    if (angulo > umbralContraido + 15) {
      estadoReps.fase = 'bajando';
    }
  } else if (estadoReps.fase === 'bajando') {
    if (angulo >= umbralExtendido) {
      estadoReps.reps++;
      estadoReps.fase = 'extendido';
      const durSeg = ((performance.now() - estadoReps.tiempoInicioFase) / 1000).toFixed(1);
      estadoReps.duracionUltimaRep = durSeg;

      vibrar(70);
      sonido();

      if (durSeg < 1.0) {
        estadoReps.cadenciaAviso = 'Muy rápido (controla la bajada)';
      } else {
        estadoReps.cadenciaAviso = 'Buen ritmo (' + durSeg + 's)';
      }

      actualizarUIReps();
    } else if (angulo < umbralContraido + 5) {
      estadoReps.fase = 'contraido';
      estadoReps.rangoIncompleto = true;
    }
  }

  actualizarUIRepsDinamica();
}

function dibujarAnguloEnCanvas(pB, angulo, w, h) {
  contexto2D.save();
  const x = camaraTrasera ? pB.x * w : (1 - pB.x) * w;
  const y = pB.y * h;

  contexto2D.fillStyle = 'rgba(23, 23, 26, 0.85)';
  contexto2D.beginPath();
  contexto2D.arc(x, y - 25, 24, 0, Math.PI * 2);
  contexto2D.fill();

  contexto2D.fillStyle = '#C8F03C';
  contexto2D.font = "bold 13px 'Bricolage Grotesque', sans-serif";
  contexto2D.textAlign = 'center';
  contexto2D.fillText(`${angulo}°`, x, y - 20);
  contexto2D.restore();
}

function actualizarUIReps() {
  const elemReps = document.getElementById('reps-contador-grande');
  if (elemReps) elemReps.textContent = String(estadoReps.reps);

  const elemCadencia = document.getElementById('reps-cadencia-texto');
  if (elemCadencia) {
    elemCadencia.textContent = estadoReps.cadenciaAviso || `${estadoReps.duracionUltimaRep} s`;
  }
}

function actualizarUIRepsDinamica() {
  const elemFase = document.getElementById('reps-fase-badge');
  if (elemFase) {
    if (estadoReps.rangoIncompleto) {
      elemFase.textContent = 'Rango incompleto';
      elemFase.style.color = '#E2553A';
    } else {
      const textoFase =
        estadoReps.fase === 'extendido' ? 'Listo para iniciar' :
        estadoReps.fase === 'subiendo' ? 'Subiendo' :
        estadoReps.fase === 'contraido' ? 'Pico de contracción' : 'Bajando (controla)';
      elemFase.textContent = textoFase;
      elemFase.style.color = '#C8F03C';
    }
  }
}

// -----------------------------------------------------------------------------
// Modo 4: Sincronización QR PC <-> Celular
// -----------------------------------------------------------------------------

async function procesarCuadroQR() {
  if (!elementoVideo || elementoVideo.readyState < 2) return;

  const ahora = performance.now();
  if (ahora - ultimoEscaneoQR < 200) return; // ~5 fps
  ultimoEscaneoQR = ahora;

  try {
    const textoDetectado = await leerQR(elementoVideo);
    if (textoDetectado && textoDetectado !== estadoQR.ultimoDetectado) {
      estadoQR.ultimoDetectado = textoDetectado;
      vibrar([100, 50, 100]);
      sonido();

      try {
        const datos = JSON.parse(textoDetectado);
        const confirmacion = await confirmar(`Se detectaron datos QR de Forja (${datos.tipo || 'datos'}). ¿Deseas importarlos?`);
        if (confirmacion) {
          if (datos.tipo === 'medidas' && datos.item) {
            await guardar('medidas', datos.item);
            aviso('Medidas importadas desde QR con éxito', 'ok');
            ir('#cuerpo');
          } else if (datos.tipo === 'serie' && datos.item) {
            await guardar('series', datos.item);
            aviso('Serie importada desde QR con éxito', 'ok');
            ir('#hoy');
          } else {
            aviso('Formato de datos recibido correctamente', 'info');
          }
        }
      } catch (e) {
        aviso(`QR leído: ${textoDetectado.slice(0, 40)}...`, 'info');
      }
    }
  } catch (err) {
    // Silencioso
  }
}

// -----------------------------------------------------------------------------
// Montaje y Desmontaje de la pantalla (Contrato Forja)
// -----------------------------------------------------------------------------
export async function montar(contenedor, params = []) {
  desmontado = false;
  contenedorRaiz = contenedor;
  modoActual = (params && params[0]) ? params[0] : 'foto';

  try {
    const p = await perfil();
    if (p && p.estaturaCm) {
      estadoMedicion.estaturaCm = p.estaturaCm;
    }
    const fotos = await todos('fotos');
    const fotosFrente = fotos.filter((f) => f.vista === 'frente' && f.altoPx);
    if (fotosFrente.length > 0) {
      fotosFrente.sort((a, b) => (b.fecha > a.fecha ? 1 : -1));
      estadoFoto.altoAnteriorPx = fotosFrente[0].altoPx;
    }
  } catch (e) {
    console.warn('No se pudo precargar perfil para cámara:', e);
  }

  for (const id of Object.keys(EJERCICIOS_CONFIG)) {
    try {
      const info = await ejercicio(id);
      if (info && info.nombre) {
        EJERCICIOS_CONFIG[id].nombre = info.nombre;
      }
    } catch (e) {
      // Nombre por defecto
    }
  }

  // Estructura HTML de la pantalla de Cámara en Modo Oscuro Forja v2
  contenedor.innerHTML = `
    <style>
      .camara-pantalla-oscura {
        max-width: 720px;
        margin: 0 auto;
        padding: 10px 16px 40px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        background-color: #17171A;
        color: #F3F0E8;
        font-family: 'Bricolage Grotesque', system-ui, -apple-system, sans-serif;
        min-height: 100%;
      }
      .camara-selector-modos {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        scrollbar-width: none;
        padding-bottom: 2px;
      }
      .camara-selector-modos::-webkit-scrollbar {
        display: none;
      }
      .camara-btn-modo {
        height: 44px;
        padding: 0 18px;
        border-radius: 999px;
        border: none;
        font-family: 'Bricolage Grotesque', sans-serif;
        font-size: 13px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        white-space: nowrap;
        transition: background-color 160ms, color 160ms, transform 120ms;
      }
      .camara-btn-modo:active {
        transform: scale(0.96);
      }
      .camara-btn-modo.activo {
        background-color: #C8F03C;
        color: #17171A;
      }
      .camara-btn-modo.inactivo {
        background-color: #26262B;
        color: #F3F0E8;
      }
      .camara-visor-marco {
        position: relative;
        width: 100%;
        background-color: #111113;
        border-radius: 28px;
        overflow: hidden;
        min-height: 380px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .camara-cuenta-regresiva {
        display: none;
        position: absolute;
        font-family: 'Bricolage Grotesque', sans-serif;
        font-size: 96px;
        font-weight: 800;
        color: #C8F03C;
        font-variant-numeric: tabular-nums;
        text-shadow: 0 4px 24px rgba(0,0,0,0.85);
        z-index: 20;
      }
      .camara-estado-pildora {
        position: absolute;
        bottom: 14px;
        left: 14px;
        background-color: rgba(23, 23, 26, 0.85);
        backdrop-filter: blur(8px);
        padding: 6px 14px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 500;
        color: #8E8A82;
        z-index: 15;
      }
      .camara-btn-rotar {
        position: absolute;
        top: 14px;
        right: 14px;
        width: 44px;
        height: 44px;
        background-color: rgba(23, 23, 26, 0.85);
        backdrop-filter: blur(8px);
        color: #F3F0E8;
        border-radius: 999px;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 25;
        transition: transform 140ms ease;
      }
      .camara-btn-rotar:active {
        transform: scale(0.93) rotate(45deg);
      }
      .camara-tarjeta-control {
        background-color: #222226;
        border-radius: 28px;
        border: none;
        padding: 22px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        color: #F3F0E8;
      }
      .camara-btn-primario-lima {
        width: 100%;
        height: 56px;
        background-color: #C8F03C;
        border: none;
        border-radius: 999px;
        color: #17171A;
        font-family: 'Bricolage Grotesque', sans-serif;
        font-size: 16px;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        cursor: pointer;
        transition: transform 140ms cubic-bezier(.2,.8,.2,1);
      }
      .camara-btn-primario-lima:active {
        transform: scale(0.97);
      }
      .camara-btn-secundario {
        height: 52px;
        background-color: #26262B;
        border: none;
        border-radius: 999px;
        color: #F3F0E8;
        font-family: 'Bricolage Grotesque', sans-serif;
        font-size: 15px;
        font-weight: 600;
        padding: 0 20px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        cursor: pointer;
        transition: transform 140ms ease;
      }
      .camara-btn-secundario:active {
        transform: scale(0.97);
      }
      .micro-label {
        font-size: 10px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        font-weight: 700;
        line-height: 1;
      }
    </style>

    <div class="camara-pantalla-oscura">
      <!-- Selector de modos píldora superior -->
      <div class="camara-selector-modos">
        <button class="camara-btn-modo ${modoActual === 'foto' ? 'activo' : 'inactivo'}" data-modo="foto">
          ${renderIcono('camara')}
          <span>Foto guiada</span>
        </button>
        <button class="camara-btn-modo ${modoActual === 'medir' ? 'activo' : 'inactivo'}" data-modo="medir">
          ${renderIcono('regla')}
          <span>Proporciones</span>
        </button>
        <button class="camara-btn-modo ${modoActual === 'reps' ? 'activo' : 'inactivo'}" data-modo="reps">
          ${renderIcono('reps')}
          <span>Contar reps</span>
        </button>
        <button class="camara-btn-modo ${modoActual === 'qr' ? 'activo' : 'inactivo'}" data-modo="qr">
          ${renderIcono('qr')}
          <span>QR PC ⇄ Cel</span>
        </button>
      </div>

      <!-- Visor de cámara con Canvas superpuesto -->
      <div class="camara-visor-marco">
        <video id="camara-video" playsinline muted autoplay style="width:100%;height:auto;display:block;transform:${camaraTrasera ? 'none' : 'scaleX(-1)'};"></video>
        <canvas id="camara-canvas" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;"></canvas>

        <!-- Indicador de cuenta regresiva en lima (#C8F03C) -->
        <div id="camara-cuenta-atras" class="camara-cuenta-regresiva">5</div>

        <!-- Estado de cámara píldora -->
        <div id="camara-estado" class="camara-estado-pildora">
          Iniciando visor...
        </div>

        <!-- Botón para girar cámara (frontal / trasera) -->
        <button id="btn-cambiar-camara" class="camara-btn-rotar" title="Cambiar cámara">
          ${renderIcono('rotar')}
        </button>
      </div>

      <!-- Panel dinámico de controles según el modo -->
      <div id="panel-controles-modo"></div>
    </div>
  `;

  elementoVideo = document.getElementById('camara-video');
  canvasSuperpuesto = document.getElementById('camara-canvas');
  contexto2D = canvasSuperpuesto.getContext('2d');

  // Eventos de selección de modo
  const botonesModo = contenedor.querySelectorAll('[data-modo]');
  botonesModo.forEach((btn) => {
    btn.addEventListener('click', () => {
      const nuevoModo = btn.getAttribute('data-modo');
      cambiarModo(nuevoModo);
    });
  });

  // Botón para alternar cámara
  document.getElementById('btn-cambiar-camara')?.addEventListener('click', async () => {
    camaraTrasera = !camaraTrasera;
    if (elementoVideo) {
      elementoVideo.style.transform = camaraTrasera ? 'none' : 'scaleX(-1)';
    }
    await iniciarCamara();
  });

  renderizarPanelModo();
  await iniciarCamara();
  await cargarPoseLandmarker();
}

/**
 * Cambia el modo de visión artificial, deteniendo inmediatamente los recursos que no se utilicen.
 */
async function cambiarModo(nuevoModo) {
  modoActual = nuevoModo;
  cancelarCuentaRegresiva();
  detenerCamara();

  contenedorRaiz?.querySelectorAll('[data-modo]').forEach((btn) => {
    const esActivo = btn.getAttribute('data-modo') === nuevoModo;
    btn.className = `camara-btn-modo ${esActivo ? 'activo' : 'inactivo'}`;
  });

  renderizarPanelModo();

  if (nuevoModo !== 'qr' || estadoQR.submodo === 'recibir') {
    await iniciarCamara();
  }
}

function renderizarPanelModo() {
  const panel = document.getElementById('panel-controles-modo');
  if (!panel) return;

  if (modoActual === 'foto') {
    panel.innerHTML = `
      <div class="camara-tarjeta-control">
        <span class="micro-label" style="color:#C8F03C;">FOTO GUIADA DE PROGRESO</span>
        <p style="margin:0;font-size:14px;color:#8E8A82;line-height:1.45;">
          Párate completo de frente. Al reconocer tu silueta y distancia, la cámara iniciará una cuenta de 5 segundos y guardará tu foto en el teléfono.
        </p>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
          <span style="font-size:13px;color:#8E8A82;">
            ${estadoFoto.altoAnteriorPx ? `Distancia calibrada: ${Math.round(estadoFoto.altoAnteriorPx)} px` : 'Sin foto previa para comparar distancia'}
          </span>
          <button id="btn-foto-manual" class="camara-btn-primario-lima" style="width:auto;padding:0 24px;height:48px;">
            Tomar ahora
          </button>
        </div>
      </div>
    `;

    document.getElementById('btn-foto-manual')?.addEventListener('click', () => {
      iniciarCuentaRegresiva(canvasSuperpuesto.height * 0.75, []);
    });

  } else if (modoActual === 'medir') {
    estadoMedicion.cuadrosRecolectados = [];
    estadoMedicion.completado = false;

    panel.innerHTML = `
      <div class="camara-tarjeta-control">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span class="micro-label" style="color:#C8F03C;">MEDICIÓN DE PROPORCIONES</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <label style="font-size:13px;color:#8E8A82;">Estatura:</label>
            <input id="input-estatura-camara" type="number" value="${estadoMedicion.estaturaCm}" style="width:68px;padding:6px 8px;text-align:center;border-radius:999px;border:none;background:#26262B;color:#F3F0E8;font-weight:600;" />
            <span style="font-size:13px;color:#8E8A82;">cm</span>
          </div>
        </div>

        <div style="height:8px;background:#26262B;border-radius:999px;overflow:hidden;margin:4px 0;">
          <div id="medicion-barra-relleno" style="width:0%;height:100%;background:#C8F03C;transition:width 0.2s;"></div>
        </div>

        <div id="medicion-estado-texto" style="font-size:13px;color:#8E8A82;">
          Párate erguido de frente a la cámara...
        </div>

        <div id="panel-resultado-medicion" style="display:none;"></div>
      </div>
    `;

    document.getElementById('input-estatura-camara')?.addEventListener('change', (e) => {
      const val = parseInt(e.target.value, 10);
      if (val > 100 && val < 250) estadoMedicion.estaturaCm = val;
    });

  } else if (modoActual === 'reps') {
    estadoReps.reps = 0;
    estadoReps.fase = 'extendido';

    panel.innerHTML = `
      <div class="camara-tarjeta-control">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <select id="select-ejercicio-camara" style="padding:10px 18px;border-radius:999px;font-weight:600;background:#26262B;color:#F3F0E8;border:none;outline:none;">
            <option value="curl_martillo_mancuernas">Curl martillo con mancuernas</option>
            <option value="press_militar_mancuernas_sentado">Press militar sentado</option>
            <option value="sentadilla_hack">Sentadilla hack en máquina</option>
            <option value="elevaciones_laterales_mancuerna_pie">Elevaciones laterales de pie</option>
            <option value="flexiones_declinadas">Flexiones declinadas</option>
            <option value="dominadas_pronadas">Dominadas pronadas</option>
          </select>
          <div id="reps-fase-badge" style="background:#26262B;color:#C8F03C;padding:6px 14px;border-radius:999px;font-size:12px;font-weight:600;">Listo</div>
        </div>

        <!-- Área de número héroe de repeticiones -->
        <div style="display:flex;align-items:center;justify-content:space-around;margin:8px 0;">
          <div style="text-align:center;">
            <div id="reps-contador-grande" style="font-family:'Bricolage Grotesque',sans-serif;font-size:80px;font-weight:800;color:#C8F03C;line-height:0.95;font-variant-numeric:tabular-nums;">0</div>
            <div style="font-size:13px;color:#8E8A82;margin-top:4px;">Repeticiones</div>
          </div>
          <div style="text-align:center;">
            <div id="reps-cadencia-texto" style="font-family:'Bricolage Grotesque',sans-serif;font-size:24px;font-weight:700;color:#F3F0E8;">0.0 s</div>
            <div style="font-size:13px;color:#8E8A82;margin-top:4px;">Cadencia / Técnica</div>
          </div>
        </div>

        <div style="display:flex;gap:10px;">
          <button id="btn-finalizar-serie-camara" class="camara-btn-primario-lima" style="flex:1;">Guardar serie</button>
          <button id="btn-reiniciar-reps" class="camara-btn-secundario">Reiniciar</button>
        </div>
      </div>
    `;

    document.getElementById('select-ejercicio-camara')?.addEventListener('change', (e) => {
      estadoReps.ejercicio = e.target.value;
      estadoReps.reps = 0;
      estadoReps.fase = 'extendido';
      actualizarUIReps();
    });

    document.getElementById('btn-reiniciar-reps')?.addEventListener('click', () => {
      estadoReps.reps = 0;
      estadoReps.fase = 'extendido';
      actualizarUIReps();
    });

    document.getElementById('btn-finalizar-serie-camara')?.addEventListener('click', async () => {
      if (estadoReps.reps === 0) {
        aviso('Aún no has registrado repeticiones en esta serie', 'info');
        return;
      }

      let inputKgValor = '';
      const inputKgElemento = h('input', {
        id: 'dialogo-kg-serie',
        type: 'number',
        step: '0.5',
        placeholder: 'kg',
        style: 'border-radius:999px;padding:10px 14px;',
        on: {
          input: (e) => { inputKgValor = e.target.value; },
          change: (e) => { inputKgValor = e.target.value; }
        }
      });

      await dialogo({
        titulo: 'Guardar serie realizada',
        cuerpo: h('div', { class: 'col', style: 'gap:10px;' },
          h('p', {}, `Completaste ${estadoReps.reps} repeticiones de ${EJERCICIOS_CONFIG[estadoReps.ejercicio].nombre}.`),
          h('div', { class: 'campo' },
            h('label', {}, 'Peso utilizado (kg, o vacío si es peso corporal):'),
            inputKgElemento
          )
        ),
        botones: [
          { texto: 'Guardar', valor: 'guardar', tipo: 'primario' },
          { texto: 'Cancelar', valor: 'cancelar' }
        ]
      }).then(async (resp) => {
        if (resp === 'guardar') {
          const textoKg = inputKgValor.trim() || inputKgElemento.value;
          const valKg = parseFloat(textoKg);
          const serie = {
            id: nuevoId(),
            fecha: hoyISO(),
            hora: Date.now(),
            ejercicioId: estadoReps.ejercicio,
            kg: isNaN(valKg) ? null : valKg,
            porLado: false,
            reps: estadoReps.reps,
            rir: null,
            fallo: false,
            maquina: '',
            nota: 'Detectado con cámara PoseLandmarker',
            sesionId: null
          };
          await guardar('series', serie);
          aviso(`Serie de ${estadoReps.reps} reps guardada`, 'ok');
          estadoReps.reps = 0;
          actualizarUIReps();
        }
      });
    });

  } else if (modoActual === 'qr') {
    panel.innerHTML = `
      <div class="camara-tarjeta-control">
        <div style="display:flex;gap:8px;">
          <button id="btn-qr-recibir" class="camara-btn-modo ${estadoQR.submodo === 'recibir' ? 'activo' : 'inactivo'}" style="flex:1;justify-content:center;">
            Escanear con cámara
          </button>
          <button id="btn-qr-enviar" class="camara-btn-modo ${estadoQR.submodo === 'enviar' ? 'activo' : 'inactivo'}" style="flex:1;justify-content:center;">
            Generar QR (desde PC)
          </button>
        </div>

        <div id="contenedor-qr-contenido" style="margin-top:6px;"></div>
      </div>
    `;

    document.getElementById('btn-qr-recibir')?.addEventListener('click', async () => {
      estadoQR.submodo = 'recibir';
      renderizarPanelModo();
      await iniciarCamara();
    });

    document.getElementById('btn-qr-enviar')?.addEventListener('click', () => {
      estadoQR.submodo = 'enviar';
      detenerCamara();
      renderizarPanelModo();
    });

    renderizarContenidoQR();
  }
}

function renderizarContenidoQR() {
  const cont = document.getElementById('contenedor-qr-contenido');
  if (!cont) return;

  if (estadoQR.submodo === 'recibir') {
    const advertenciaDetector = !estadoQR.detectorDisponible
      ? `<div style="background:rgba(226,85,58,0.15);color:#E2553A;padding:10px 14px;border-radius:999px;font-size:12px;margin-bottom:10px;">Tu navegador no soporta BarcodeDetector nativo. Usa la caja de texto o archivo abajo.</div>`
      : `<p style="font-size:13px;color:#8E8A82;margin:0 0 10px 0;">Apunta la cámara hacia el código QR mostrado en la pantalla de tu PC.</p>`;

    cont.innerHTML = `
      ${advertenciaDetector}
      <div style="display:flex;flex-direction:column;gap:8px;">
        <label style="font-size:13px;color:#8E8A82;">Pegar los datos JSON manualmente:</label>
        <textarea id="textarea-qr-manual" rows="3" style="width:100%;border-radius:20px;padding:12px;background:#26262B;color:#F3F0E8;border:none;font-family:monospace;font-size:12px;resize:none;" placeholder='{"tipo":"medidas", ...}'></textarea>
        <button id="btn-cargar-json-manual" class="camara-btn-primario-lima" style="height:48px;">Importar texto JSON</button>
      </div>

      <div style="margin-top:14px;border-top:1px solid rgba(243,240,232,0.08);padding-top:12px;">
        <label style="font-size:13px;color:#8E8A82;display:block;margin-bottom:8px;">O carga directamente un archivo .json:</label>
        <label class="camara-btn-secundario" style="display:flex;width:100%;">
          ${renderIcono('carpeta')}
          <span>Subir archivo .json</span>
          <input id="input-archivo-json" type="file" accept=".json,application/json" style="display:none;" />
        </label>
      </div>
    `;

    document.getElementById('btn-cargar-json-manual')?.addEventListener('click', async () => {
      const txt = document.getElementById('textarea-qr-manual')?.value.trim();
      if (!txt) return;
      try {
        const obj = JSON.parse(txt);
        if (obj.tipo === 'medidas' && obj.item) {
          await guardar('medidas', obj.item);
          aviso('Medidas importadas con éxito', 'ok');
          ir('#cuerpo');
        } else if (obj.tipo === 'serie' && obj.item) {
          await guardar('series', obj.item);
          aviso('Serie importada con éxito', 'ok');
          ir('#hoy');
        } else if (obj.item) {
          await guardar(obj.tipo || 'medidas', obj.item);
          aviso('Datos importados con éxito', 'ok');
        } else {
          aviso('Formato JSON no reconocido', 'error');
        }
      } catch (err) {
        aviso('JSON inválido o mal formado', 'error');
      }
    });

    document.getElementById('input-archivo-json')?.addEventListener('change', (e) => {
      const archivo = e.target.files?.[0];
      if (!archivo) return;
      const lector = new FileReader();
      lector.onload = async (ev) => {
        try {
          const obj = JSON.parse(ev.target.result);
          if (obj.tipo === 'medidas' && obj.item) {
            await guardar('medidas', obj.item);
            aviso('Medidas importadas desde archivo JSON con éxito', 'ok');
            ir('#cuerpo');
          } else if (obj.tipo === 'serie' && obj.item) {
            await guardar('series', obj.item);
            aviso('Serie importada desde archivo JSON con éxito', 'ok');
            ir('#hoy');
          } else if (obj.item) {
            await guardar(obj.tipo || 'medidas', obj.item);
            aviso('Datos importados con éxito', 'ok');
          } else {
            aviso('Formato de archivo JSON no reconocido', 'error');
          }
        } catch (err) {
          aviso('Archivo JSON inválido o dañado', 'error');
        }
      };
      lector.readAsText(archivo);
    });

  } else {
    generarPayloadQRParaMostrar(cont);
  }
}

async function generarPayloadQRParaMostrar(cont) {
  cont.innerHTML = `<div style="font-size:13px;color:#8E8A82;text-align:center;padding:16px;">Generando código QR con tus datos...</div>`;
  try {
    const medidas = await todos('medidas');
    medidas.sort((a, b) => (b.fecha > a.fecha ? 1 : -1));
    const ultimaMedida = medidas[0] || null;

    const payload = JSON.stringify({
      app: 'forja',
      tipo: 'medidas',
      item: ultimaMedida ? {
        fecha: ultimaMedida.fecha,
        peso: ultimaMedida.peso,
        cintura: ultimaMedida.cintura,
        cuello: ultimaMedida.cuello
      } : { fecha: hoyISO(), peso: 75, cintura: 82 }
    });

    const svgQr = qrSvg(payload);

    cont.innerHTML = `
      <div style="text-align:center;">
        <div style="margin:12px auto;">${svgQr}</div>
        <p style="font-size:13px;color:#8E8A82;margin:8px 0 14px 0;">
          Escanea este código con la cámara de tu celular en Forja para transferir tus últimas medidas.
        </p>
        <button id="btn-descargar-json" class="camara-btn-secundario" style="width:100%;">
          ${renderIcono('descargar')}
          <span>Descargar archivo .json</span>
        </button>
      </div>
    `;

    document.getElementById('btn-descargar-json')?.addEventListener('click', () => {
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `forja_medicion_${hoyISO()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      aviso('Archivo JSON descargado', 'ok');
    });
  } catch (err) {
    cont.innerHTML = `<div style="font-size:13px;color:#E2553A;text-align:center;">Error al generar QR de transferencia.</div>`;
  }
}

function actualizarUIEstado(mensaje, esError = false) {
  const lbl = document.getElementById('camara-estado');
  if (lbl) {
    lbl.textContent = mensaje;
    lbl.style.display = mensaje ? 'block' : 'none';
    lbl.style.color = esError ? '#E2553A' : '#8E8A82';
  }
}

// -----------------------------------------------------------------------------
// Desmontaje y limpieza de recursos (Contrato Forja)
// -----------------------------------------------------------------------------
export function desmontar() {
  desmontado = true;
  cancelarCuentaRegresiva();
  detenerCamara();

  if (poseLandmarker) {
    try {
      poseLandmarker.close();
    } catch (e) {
      // Ignorar si ya estaba cerrado
    }
    poseLandmarker = null;
  }

  contenedorRaiz = null;
  elementoVideo = null;
  canvasSuperpuesto = null;
  contexto2D = null;
}

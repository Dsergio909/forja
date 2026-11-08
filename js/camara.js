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

// Lista blanca de almacenes permitidos para importación por QR / JSON (Seguridad Hallazgo 10)
const ALMACENES_QR_PERMITIDOS = ['medidas', 'series'];

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
    anguloExtendido: 155, // brazos extendidos arriba
    anguloContraido: 75,  // codos flexionados abajo
    invertido: false
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
    anguloExtendido: 30,  // brazos abajo junto al torso
    anguloContraido: 85,  // brazos elevados horizontalmente
    invertido: true       // ángulo creciente al subir
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

/**
 * Apaga el hardware de la cámara cuando la pestaña o app pasa a segundo plano
 * y lo reanuda al volver (ALTO-5 camara_cuerpo.md).
 */
function manejarVisibilidad() {
  if (document.hidden) {
    cancelarCuentaRegresiva();
    detenerCamara();
  } else if (!desmontado && (modoActual !== 'qr' || estadoQR.submodo === 'recibir')) {
    iniciarCamara();
  }
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

  const visor = document.querySelector('.camara-visor-marco');
  visor?.querySelector('.btn-reintentar-camara')?.remove();

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
    if (err.name === 'NotAllowedError') {
      msg = 'Habilita el permiso de cámara en tu navegador y toca Reintentar';
    }
    // Botón de reintento visible cuando se deniega el permiso (MEDIO-11 camara_cuerpo.md)
    if (visor) {
      visor.querySelector('.btn-reintentar-camara')?.remove();
      const btnReintentar = h('button', {
        type: 'button',
        class: 'camara-btn-primario-lima btn-reintentar-camara',
        style: 'position:absolute;z-index:30;width:auto;padding:0 24px;min-height:48px;',
        on: {
          click: () => {
            btnReintentar.remove();
            iniciarCamara();
          }
        }
      }, 'Reintentar acceso a cámara');
      visor.appendChild(btnReintentar);
    }
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
        // Garantizar timestamp estrictamente monótono (MEDIO-10 camara_cuerpo.md)
        const ahora = performance.now();
        const timestamp = Math.max(ahora, ultimoTimestampVideo + 1);
        ultimoTimestampVideo = timestamp;

        let resultados = null;
        try {
          resultados = poseLandmarker.detectForVideo(elementoVideo, timestamp);
          if (resultados && resultados.landmarks && resultados.landmarks.length > 0) {
            const landmarks = resultados.landmarks[0];
            dibujarEsqueleto(landmarks, videoW, videoH);
            procesarModoActivo(landmarks, videoW, videoH, resultados.segmentationMasks);
          } else {
            dibujarGuiaVacia(videoW, videoH);
          }
        } catch (e) {
          // Evitar rotura del bucle de requestAnimationFrame
        } finally {
          // Liberación estricta de texturas WebGL y memoria WASM (CRÍTICO-3 camara_cuerpo.md)
          if (resultados && resultados.segmentationMasks) {
            for (const mask of resultados.segmentationMasks) {
              if (mask && typeof mask.close === 'function') {
                try {
                  mask.close();
                } catch (_) {
                  // Ignorar si ya fue liberada
                }
              }
            }
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
  contexto2D.fillStyle = 'rgba(23, 23, 26, 0.88)';
  const boxW = 320;
  contexto2D.beginPath();
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

  // Reflejar coordenadas X de landmarks si la cámara es frontal (ALTO-6 camara_cuerpo.md)
  const puntosNormalizados = (!camaraTrasera && Array.isArray(landmarks))
    ? landmarks.map((pt) => ({
        ...pt,
        x: typeof pt.x === 'number' ? 1 - pt.x : pt.x
      }))
    : landmarks;

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
      puntos: puntosNormalizados,
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
 * Modo 2: Medir proporciones (hombros, cintura con máscara de segmentación, V-taper)
 * Correcciones CRÍTICO-4 y ALTO-8 de camara_cuerpo.md.
 */
function procesarMedicion(landmarks, w, h, masks) {
  if (estadoMedicion.completado) return;

  const nariz = landmarks[0];
  const orejaIzq = landmarks[7];
  const orejaDer = landmarks[8];
  const hombroIzq = landmarks[11];
  const hombroDer = landmarks[12];
  const caderaIzq = landmarks[23];
  const caderaDer = landmarks[24];
  const tobilloIzq = landmarks[27];
  const tobilloDer = landmarks[28];
  const pieIzq = landmarks[31];
  const pieDer = landmarks[32];

  const puntosClave = [nariz, hombroIzq, hombroDer, caderaIzq, caderaDer, tobilloIzq, tobilloDer];
  const visibles = puntosClave.every((p) => p && (p.visibility || 1) > 0.7);

  if (!visibles) {
    actualizarProgresoMedicion('Ponte recto en cuadro completo para medir', estadoMedicion.cuadrosRecolectados.length);
    return;
  }

  // Validar que cabeza y tobillos no estén cortados por los bordes del visor (ALTO-8)
  const maxTobilloY = Math.max(tobilloIzq.y, tobilloDer.y);
  if (nariz.y < 0.05 || maxTobilloY > 0.95) {
    actualizarProgresoMedicion('Aléjate un poco: deja margen arriba de la cabeza y bajo los pies', estadoMedicion.cuadrosRecolectados.length);
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

  // Estimar coronilla y base de los pies de forma geométrica robusta (ALTO-8)
  const orejaPromedioY = (orejaIzq && orejaDer)
    ? (orejaIzq.y + orejaDer.y) / 2
    : nariz.y + 0.025;
  const distOrejaNariz = Math.max(0.022, Math.abs(orejaPromedioY - nariz.y));
  const coronillaY = Math.max(0, nariz.y - distOrejaNariz * 2.2);

  const piePromedioY = (pieIzq && pieDer && (pieIzq.visibility || 0) > 0.5 && (pieDer.visibility || 0) > 0.5)
    ? Math.min(1.0, (pieIzq.y + pieDer.y) / 2)
    : Math.min(1.0, maxTobilloY + distOrejaNariz * 1.2);

  const altoCuerpoPx = (piePromedioY - coronillaY) * h;
  if (altoCuerpoPx < h * 0.5) {
    actualizarProgresoMedicion('Acércate un paso para medir con precisión', estadoMedicion.cuadrosRecolectados.length);
    return;
  }

  const cmPorPx = estadoMedicion.estaturaCm / altoCuerpoPx;

  // Ancho de hombros entre acromiones + margen deltoideo
  const anchoHombrosPx = distancia2D(hombroIzq, hombroDer, w, h) * 1.14;
  const hombrosCm = anchoHombrosPx * cmPorPx;

  // Ancho de cintura usando el contorno de la máscara de segmentación (CRÍTICO-4)
  let anchoCinturaPx = 0;
  if (masks && masks[0]) {
    const mask = masks[0];
    const maskW = mask.width;
    const maskH = mask.height;
    // Altura Y aproximada del ombligo / cintura (60% del torso hacia abajo)
    const yTorsoNorm = ((hombroIzq.y + hombroDer.y) / 2) * 0.4 + ((caderaIzq.y + caderaDer.y) / 2) * 0.6;
    const yPixel = Math.min(maskH - 1, Math.max(0, Math.round(yTorsoNorm * maskH)));
    const filaOffset = yPixel * maskW;

    let xMin = -1;
    let xMax = -1;

    if (typeof mask.getAsFloat32Array === 'function') {
      const maskData = mask.getAsFloat32Array();
      for (let x = 0; x < maskW; x++) {
        if (maskData[filaOffset + x] > 0.5) {
          if (xMin === -1) xMin = x;
          xMax = x;
        }
      }
    } else if (typeof mask.getAsUint8Array === 'function') {
      const maskData = mask.getAsUint8Array();
      for (let x = 0; x < maskW; x++) {
        if (maskData[filaOffset + x] > 127) {
          if (xMin === -1) xMin = x;
          xMax = x;
        }
      }
    }

    if (xMin !== -1 && xMax > xMin) {
      const candidatoPx = ((xMax - xMin) / maskW) * w;
      // Validar que el contorno segmentado esté en un rango anatómico coherente (no brazos extendidos)
      if (candidatoPx > anchoHombrosPx * 0.45 && candidatoPx < anchoHombrosPx * 1.15) {
        anchoCinturaPx = candidatoPx;
      }
    }
  }

  // Fallback si la máscara no estuvo disponible en este cuadro
  if (!anchoCinturaPx) {
    anchoCinturaPx = distancia2D(caderaIzq, caderaDer, w, h) * 1.15;
  }

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
  if (!panel) return;

  panel.style.display = 'block';

  const btnGuardar = h('button', {
    id: 'btn-guardar-medicion',
    type: 'button',
    class: 'camara-btn-primario-lima',
    style: 'flex:1;',
    on: {
      click: async () => {
        try {
          const idMed = nuevoId();
          const hoy = hoyISO();

          // 1. Guardar resultado óptico en el store dedicado 'camara'
          await guardar('camara', {
            id: idMed,
            fecha: hoy,
            hombrosCm: avgHombros,
            cinturaCm: avgCintura,
            ratioV: avgRatio,
            margenCm: 3
          });

          // 2. Guardar la medición de cámara aparte en 'medidas' con origen: 'camara',
          // NUNCA sobreescribiendo un registro manual (ALTO-7 camara_cuerpo.md)
          const todasMedidas = await todos('medidas');
          const medidaCamaraHoy = todasMedidas.find((m) => m.fecha === hoy && m.origen === 'camara');

          if (medidaCamaraHoy) {
            medidaCamaraHoy.cintura = avgCintura;
            medidaCamaraHoy.hombros = avgHombros;
            medidaCamaraHoy.origen = 'camara';
            medidaCamaraHoy.actualizado = Date.now();
            await guardar('medidas', medidaCamaraHoy);
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

          aviso('Medición de cámara guardada aparte en tu Cuerpo', 'ok');
          ir('#cuerpo');
        } catch (err) {
          aviso('Error al guardar las medidas', 'error');
        }
      }
    }
  }, 'Guardar en Cuerpo');

  const btnRepetir = h('button', {
    id: 'btn-repetir-medicion',
    type: 'button',
    class: 'camara-btn-secundario',
    on: {
      click: () => {
        estadoMedicion.cuadrosRecolectados = [];
        estadoMedicion.completado = false;
        panel.style.display = 'none';
      }
    }
  }, 'Repetir');

  const tarjetaResultado = h('div', {
    style: 'background-color:#232328;border-radius:28px;padding:20px;display:flex;flex-direction:column;gap:12px;margin-top:14px;'
  },
    h('span', { style: 'font-size:14px;font-weight:600;color:#C8F03C;' }, 'Proporciones estimadas'),
    h('div', { style: 'display:flex;justify-content:space-between;align-items:center;' },
      h('span', { style: 'color:#8E8A82;font-size:14px;' }, 'Ancho de hombros:'),
      h('strong', { style: 'color:#F3F0E8;font-size:16px;' },
        `${avgHombros} cm `,
        h('span', { style: 'font-size:12px;color:#8E8A82;font-weight:500;' }, '± 3 cm aprox.')
      )
    ),
    h('div', { style: 'display:flex;justify-content:space-between;align-items:center;' },
      h('span', { style: 'color:#8E8A82;font-size:14px;' }, 'Ancho de cintura:'),
      h('strong', { style: 'color:#F3F0E8;font-size:16px;' },
        `${avgCintura} cm `,
        h('span', { style: 'font-size:12px;color:#8E8A82;font-weight:500;' }, '± 3 cm aprox.')
      )
    ),
    h('div', {
      style: 'display:flex;justify-content:space-between;align-items:center;background:#17171A;border-radius:999px;padding:10px 18px;margin-top:2px;'
    },
      h('span', { style: 'color:#F3F0E8;font-size:14px;' }, 'Proporción en V (Hombro/Cintura):'),
      h('strong', {
        style: "color:#C8F03C;font-size:24px;font-family:'Bricolage Grotesque',sans-serif;font-weight:800;"
      }, String(avgRatio))
    ),
    h('p', { style: 'font-size:12px;color:#8E8A82;margin:0;line-height:1.4;' },
      `Estimado a partir de tu estatura (${estadoMedicion.estaturaCm} cm) promediando 30 cuadros estables con máscara de segmentación.`
    ),
    h('div', { style: 'display:flex;gap:10px;margin-top:6px;' }, btnGuardar, btnRepetir)
  );

  panel.replaceChildren(tarjetaResultado);
}

/**
 * Modo 3: Contar repeticiones y evaluar técnica biomecánica
 * Correcciones CRÍTICO-1 (invertido) y CRÍTICO-2 (articulación de hombro en elevaciones laterales).
 */
function procesarContadorReps(landmarks, w, h) {
  const conf = EJERCICIOS_CONFIG[estadoReps.ejercicio] || EJERCICIOS_CONFIG.curl_martillo_mancuernas;

  let pA = landmarks[conf.puntos[0]];
  let pB = landmarks[conf.puntos[1]];
  let pC = landmarks[conf.puntos[2]];

  // Conmutar al perfil más visible respetando la anatomía de cada ejercicio (CRÍTICO-2)
  if (estadoReps.ejercicio === 'elevaciones_laterales_mancuerna_pie') {
    // [23, 11, 13] (cadera, hombro, codo izq) -> [24, 12, 14] (cadera, hombro, codo der)
    if ((landmarks[11]?.visibility || 0) < (landmarks[12]?.visibility || 0)) {
      pA = landmarks[24];
      pB = landmarks[12];
      pC = landmarks[14];
    }
  } else if (conf.puntos[0] === 11 && (pA?.visibility || 0) < (landmarks[12]?.visibility || 0)) {
    pA = landmarks[12];
    pB = landmarks[14];
    pC = landmarks[16];
  } else if (conf.puntos[0] === 23 && (pA?.visibility || 0) < (landmarks[24]?.visibility || 0)) {
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
  const inv = conf.invertido === true;

  // Máquina de estados con soporte para ángulos decrecientes y crecientes (CRÍTICO-1)
  if (estadoReps.fase === 'extendido') {
    const iniciaMovimiento = inv
      ? angulo > umbralExtendido + 15
      : angulo < umbralExtendido - 15;
    if (iniciaMovimiento) {
      estadoReps.fase = 'subiendo';
      estadoReps.tiempoInicioFase = performance.now();
      estadoReps.rangoIncompleto = false;
    }
  } else if (estadoReps.fase === 'subiendo') {
    const alcanzaContraccion = inv
      ? angulo >= umbralContraido
      : angulo <= umbralContraido;
    const abortaMovimiento = inv
      ? angulo < umbralExtendido + 5
      : angulo > umbralExtendido - 5;
    if (alcanzaContraccion) {
      estadoReps.fase = 'contraido';
    } else if (abortaMovimiento) {
      estadoReps.fase = 'extendido';
      estadoReps.rangoIncompleto = true;
    }
  } else if (estadoReps.fase === 'contraido') {
    const iniciaRetorno = inv
      ? angulo < umbralContraido - 15
      : angulo > umbralContraido + 15;
    if (iniciaRetorno) {
      estadoReps.fase = 'bajando';
    }
  } else if (estadoReps.fase === 'bajando') {
    const completaRep = inv
      ? angulo <= umbralExtendido
      : angulo >= umbralExtendido;
    const regresaAContraido = inv
      ? angulo > umbralContraido - 5
      : angulo < umbralContraido + 5;

    if (completaRep) {
      estadoReps.reps++;
      estadoReps.fase = 'extendido';
      const durSeg = ((performance.now() - estadoReps.tiempoInicioFase) / 1000).toFixed(1);
      estadoReps.duracionUltimaRep = durSeg;

      vibrar(70);
      sonido();

      if (Number(durSeg) < 1.0) {
        estadoReps.cadenciaAviso = 'Muy rápido (controla la bajada)';
      } else {
        estadoReps.cadenciaAviso = `Buen ritmo (${durSeg}s)`;
      }

      actualizarUIReps();
    } else if (regresaAContraido) {
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

  contexto2D.fillStyle = 'rgba(23, 23, 26, 0.88)';
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

/**
 * Normaliza y guarda de forma segura un objeto importado por QR o JSON,
 * aplicando lista blanca de almacenes (Seguridad Hallazgo 10).
 */
async function guardarObjetoImportadoQR(obj) {
  if (!obj || typeof obj !== 'object' || !obj.item || typeof obj.item !== 'object') {
    aviso('Formato JSON no reconocido', 'error');
    return false;
  }

  const tipoNormalizado = obj.tipo === 'serie' ? 'series' : obj.tipo;
  const storeDestino = ALMACENES_QR_PERMITIDOS.includes(tipoNormalizado) ? tipoNormalizado : 'medidas';

  if (storeDestino === 'medidas') {
    const it = obj.item;
    const numONull = (v) => (v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
    const medidaCanonica = {
      id: typeof it.id === 'string' && it.id ? it.id : nuevoId(),
      fecha: typeof it.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(it.fecha) ? it.fecha : hoyISO(),
      peso: numONull(it.peso),
      cintura: numONull(it.cintura),
      cuello: numONull(it.cuello),
      pecho: numONull(it.pecho),
      brazo: numONull(it.brazo),
      hombros: numONull(it.hombros),
      cadera: numONull(it.cadera),
      grasaNavy: numONull(it.grasaNavy),
      origen: it.origen === 'camara' ? 'camara' : 'manual'
    };
    await guardar('medidas', medidaCanonica);
    aviso('Medidas importadas con éxito', 'ok');
    ir('#cuerpo');
    return true;
  }

  if (storeDestino === 'series') {
    await guardar('series', obj.item);
    aviso('Serie importada con éxito', 'ok');
    ir('#hoy');
    return true;
  }

  return false;
}

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
        const tipoEtiqueta = datos.tipo === 'serie' || datos.tipo === 'series' ? 'series' : 'medidas';
        const confirmacion = await confirmar(`Se detectaron datos QR de Forja (${tipoEtiqueta}). ¿Deseas importarlos?`);
        if (confirmacion) {
          await guardarObjetoImportadoQR(datos);
        }
      } catch (e) {
        aviso(`QR leído: ${textoDetectado.slice(0, 40)}...`, 'info');
      }
    }
  } catch (err) {
    // Silencioso
  }
}

const ESTILOS_CAMARA = `
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
    min-height: 48px;
    height: 48px;
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
    background-color: #232328;
    color: #F3F0E8;
  }
  .camara-visor-marco {
    position: relative;
    width: 100%;
    background-color: #17171A;
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
    background-color: rgba(23, 23, 26, 0.88);
    padding: 6px 14px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 500;
    color: #F3F0E8;
    z-index: 15;
  }
  .camara-btn-rotar {
    position: absolute;
    top: 14px;
    right: 14px;
    min-width: 48px;
    min-height: 48px;
    width: 48px;
    height: 48px;
    background-color: rgba(23, 23, 26, 0.88);
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
  .camara-btn-rotar:disabled {
    opacity: 0.5;
    cursor: wait;
  }
  .camara-tarjeta-control {
    background-color: #232328;
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
    min-height: 56px;
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
    min-height: 52px;
    height: 52px;
    background-color: #17171A;
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
  .camara-subtitulo {
    font-size: 14px;
    font-weight: 600;
    color: #C8F03C;
    line-height: 1.2;
  }
`;

// -----------------------------------------------------------------------------
// Montaje y Desmontaje de la pantalla (Contrato Forja)
// -----------------------------------------------------------------------------
export async function montar(contenedor, params = []) {
  desmontado = false;
  contenedorRaiz = contenedor;
  modoActual = (params && params[0]) ? params[0] : 'foto';

  document.removeEventListener('visibilitychange', manejarVisibilidad);
  document.addEventListener('visibilitychange', manejarVisibilidad);

  try {
    const p = await perfil();
    if (p && p.estaturaCm) {
      estadoMedicion.estaturaCm = Number(p.estaturaCm) || 175;
    }
    const fotos = await todos('fotos');
    const fotosFrente = fotos.filter((f) => f.vista === 'frente' && f.altoPx);
    if (fotosFrente.length > 0) {
      fotosFrente.sort((a, b) => (b.fecha > a.fecha ? 1 : -1));
      estadoFoto.altoAnteriorPx = Number(fotosFrente[0].altoPx) || null;
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

  const modos = [
    { id: 'foto', icono: 'camara', texto: 'Foto guiada' },
    { id: 'medir', icono: 'regla', texto: 'Proporciones' },
    { id: 'reps', icono: 'reps', texto: 'Contar reps' },
    { id: 'qr', icono: 'qr', texto: 'QR PC ⇄ Cel' }
  ];

  const botonesModo = modos.map((m) =>
    h('button', {
      type: 'button',
      class: `camara-btn-modo ${modoActual === m.id ? 'activo' : 'inactivo'}`,
      dataset: { modo: m.id },
      on: { click: () => cambiarModo(m.id) }
    }, icono(m.icono, 18), h('span', {}, m.texto))
  );

  elementoVideo = h('video', {
    id: 'camara-video',
    playsinline: true,
    muted: true,
    autoplay: true,
    style: `width:100%;height:auto;display:block;transform:${camaraTrasera ? 'none' : 'scaleX(-1)'};`
  });

  canvasSuperpuesto = h('canvas', {
    id: 'camara-canvas',
    style: 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;'
  });
  contexto2D = canvasSuperpuesto.getContext('2d');

  // Botón para alternar cámara con protección contra condición de carrera (BAJO-14 camara_cuerpo.md)
  const btnRotar = h('button', {
    id: 'btn-cambiar-camara',
    type: 'button',
    class: 'camara-btn-rotar',
    title: 'Cambiar cámara',
    on: {
      click: async () => {
        if (btnRotar.disabled) return;
        btnRotar.disabled = true;
        try {
          camaraTrasera = !camaraTrasera;
          if (elementoVideo) {
            elementoVideo.style.transform = camaraTrasera ? 'none' : 'scaleX(-1)';
          }
          await iniciarCamara();
        } finally {
          btnRotar.disabled = false;
        }
      }
    }
  }, icono('rotar', 20));

  const pantallaDOM = h('div', { class: 'camara-pantalla-oscura' },
    h('div', { class: 'camara-selector-modos' }, ...botonesModo),
    h('div', { class: 'camara-visor-marco' },
      elementoVideo,
      canvasSuperpuesto,
      h('div', { id: 'camara-cuenta-atras', class: 'camara-cuenta-regresiva' }, '5'),
      h('div', { id: 'camara-estado', class: 'camara-estado-pildora' }, 'Iniciando visor...'),
      btnRotar
    ),
    h('div', { id: 'panel-controles-modo' })
  );

  contenedor.replaceChildren(h('style', {}, ESTILOS_CAMARA), pantallaDOM);

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
    const textoDistancia = estadoFoto.altoAnteriorPx
      ? `Distancia calibrada: ${Math.round(estadoFoto.altoAnteriorPx)} px`
      : 'Sin foto previa para comparar distancia';

    const tarjetaFoto = h('div', { class: 'camara-tarjeta-control' },
      h('span', { class: 'camara-subtitulo' }, 'Foto guiada de progreso'),
      h('p', { style: 'margin:0;font-size:14px;color:#F3F0E8;opacity:0.8;line-height:1.45;' },
        'Párate completo de frente. Al reconocer tu silueta y distancia, la cámara iniciará una cuenta de 5 segundos y guardará tu foto en el teléfono.'
      ),
      h('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-top:4px;gap:10px;flex-wrap:wrap;' },
        h('span', { style: 'font-size:13px;color:#F3F0E8;opacity:0.75;' }, textoDistancia),
        h('button', {
          id: 'btn-foto-manual',
          type: 'button',
          class: 'camara-btn-primario-lima',
          style: 'width:auto;padding:0 24px;min-height:48px;height:48px;',
          on: {
            click: () => {
              iniciarCuentaRegresiva((canvasSuperpuesto?.height || 720) * 0.75, []);
            }
          }
        }, 'Tomar ahora')
      )
    );
    panel.replaceChildren(tarjetaFoto);

  } else if (modoActual === 'medir') {
    estadoMedicion.cuadrosRecolectados = [];
    estadoMedicion.completado = false;

    const inputEstatura = h('input', {
      id: 'input-estatura-camara',
      type: 'number',
      value: String(estadoMedicion.estaturaCm),
      style: 'width:72px;min-height:48px;padding:6px 10px;text-align:center;border-radius:999px;border:none;background:#17171A;color:#F3F0E8;font-weight:600;font-variant-numeric:tabular-nums;',
      on: {
        change: (e) => {
          const val = parseInt(e.target.value, 10);
          if (val > 100 && val < 250) estadoMedicion.estaturaCm = val;
        }
      }
    });

    const tarjetaMedir = h('div', { class: 'camara-tarjeta-control' },
      h('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;' },
        h('span', { class: 'camara-subtitulo' }, 'Medición de proporciones'),
        h('div', { style: 'display:flex;align-items:center;gap:6px;' },
          h('label', { for: 'input-estatura-camara', style: 'font-size:13px;color:#F3F0E8;opacity:0.8;' }, 'Estatura:'),
          inputEstatura,
          h('span', { style: 'font-size:13px;color:#F3F0E8;opacity:0.8;' }, 'cm')
        )
      ),
      h('div', { style: 'height:8px;background:#17171A;border-radius:999px;overflow:hidden;margin:4px 0;' },
        h('div', { id: 'medicion-barra-relleno', style: 'width:0%;height:100%;background:#C8F03C;transition:width 0.2s;' })
      ),
      h('div', { id: 'medicion-estado-texto', style: 'font-size:13px;color:#F3F0E8;opacity:0.8;' },
        'Párate erguido de frente a la cámara...'
      ),
      h('div', { id: 'panel-resultado-medicion', style: 'display:none;' })
    );

    panel.replaceChildren(tarjetaMedir);

  } else if (modoActual === 'reps') {
    estadoReps.reps = 0;
    estadoReps.fase = 'extendido';
    estadoReps.rangoIncompleto = false;

    const opcionesEjercicios = Object.values(EJERCICIOS_CONFIG).map((cfg) =>
      h('option', {
        value: cfg.id,
        selected: estadoReps.ejercicio === cfg.id
      }, cfg.nombre)
    );

    const selectEjercicio = h('select', {
      id: 'select-ejercicio-camara',
      style: 'min-height:48px;padding:10px 18px;border-radius:999px;font-weight:600;background:#17171A;color:#F3F0E8;border:none;outline:none;max-width:100%;',
      on: {
        change: (e) => {
          estadoReps.ejercicio = e.target.value;
          estadoReps.reps = 0;
          estadoReps.fase = 'extendido';
          estadoReps.rangoIncompleto = false;
          actualizarUIReps();
          actualizarUIRepsDinamica();
        }
      }
    }, ...opcionesEjercicios);

    const tarjetaReps = h('div', { class: 'camara-tarjeta-control' },
      h('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;' },
        selectEjercicio,
        h('div', {
          id: 'reps-fase-badge',
          style: 'background:#17171A;color:#C8F03C;padding:8px 14px;border-radius:999px;font-size:12px;font-weight:600;'
        }, 'Listo para iniciar')
      ),
      h('div', { style: 'display:flex;align-items:center;justify-content:space-around;margin:8px 0;' },
        h('div', { style: 'text-align:center;' },
          h('div', {
            id: 'reps-contador-grande',
            style: "font-family:'Bricolage Grotesque',sans-serif;font-size:80px;font-weight:800;color:#C8F03C;line-height:0.95;font-variant-numeric:tabular-nums;"
          }, '0'),
          h('div', { style: 'font-size:13px;color:#F3F0E8;opacity:0.75;margin-top:4px;' }, 'Repeticiones')
        ),
        h('div', { style: 'text-align:center;' },
          h('div', {
            id: 'reps-cadencia-texto',
            style: "font-family:'Bricolage Grotesque',sans-serif;font-size:24px;font-weight:700;color:#F3F0E8;font-variant-numeric:tabular-nums;"
          }, '0.0 s'),
          h('div', { style: 'font-size:13px;color:#F3F0E8;opacity:0.75;margin-top:4px;' }, 'Cadencia / Técnica')
        )
      ),
      h('div', { style: 'display:flex;gap:10px;' },
        h('button', {
          id: 'btn-finalizar-serie-camara',
          type: 'button',
          class: 'camara-btn-primario-lima',
          style: 'flex:1;',
          on: { click: guardarSerieContada }
        }, 'Guardar serie'),
        h('button', {
          id: 'btn-reiniciar-reps',
          type: 'button',
          class: 'camara-btn-secundario',
          on: {
            click: () => {
              estadoReps.reps = 0;
              estadoReps.fase = 'extendido';
              estadoReps.rangoIncompleto = false;
              actualizarUIReps();
              actualizarUIRepsDinamica();
            }
          }
        }, 'Reiniciar')
      )
    );

    panel.replaceChildren(tarjetaReps);

  } else if (modoActual === 'qr') {
    const tarjetaQR = h('div', { class: 'camara-tarjeta-control' },
      h('div', { style: 'display:flex;gap:8px;' },
        h('button', {
          id: 'btn-qr-recibir',
          type: 'button',
          class: `camara-btn-modo ${estadoQR.submodo === 'recibir' ? 'activo' : 'inactivo'}`,
          style: 'flex:1;justify-content:center;',
          on: {
            click: async () => {
              estadoQR.submodo = 'recibir';
              renderizarPanelModo();
              await iniciarCamara();
            }
          }
        }, 'Escanear con cámara'),
        h('button', {
          id: 'btn-qr-enviar',
          type: 'button',
          class: `camara-btn-modo ${estadoQR.submodo === 'enviar' ? 'activo' : 'inactivo'}`,
          style: 'flex:1;justify-content:center;',
          on: {
            click: () => {
              estadoQR.submodo = 'enviar';
              detenerCamara();
              renderizarPanelModo();
            }
          }
        }, 'Generar QR (desde PC)')
      ),
      h('div', { id: 'contenedor-qr-contenido', style: 'margin-top:6px;' })
    );

    panel.replaceChildren(tarjetaQR);
    renderizarContenidoQR();
  }
}

async function guardarSerieContada() {
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

  const cfgEj = EJERCICIOS_CONFIG[estadoReps.ejercicio] || EJERCICIOS_CONFIG.curl_martillo_mancuernas;

  const resp = await dialogo({
    titulo: 'Guardar serie realizada',
    cuerpo: h('div', { class: 'col', style: 'gap:10px;' },
      h('p', {}, `Completaste ${estadoReps.reps} repeticiones de ${cfgEj.nombre}.`),
      h('div', { class: 'campo' },
        h('label', {}, 'Peso utilizado (kg, o vacío si es peso corporal):'),
        inputKgElemento
      )
    ),
    botones: [
      { texto: 'Guardar', valor: 'guardar', tipo: 'primario' },
      { texto: 'Cancelar', valor: 'cancelar' }
    ]
  });

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
}

function renderizarContenidoQR() {
  const cont = document.getElementById('contenedor-qr-contenido');
  if (!cont) return;

  if (estadoQR.submodo === 'recibir') {
    const nodoAvisoDetector = !estadoQR.detectorDisponible
      ? h('div', {
          style: 'background:rgba(226,85,58,0.16);color:#F3F0E8;padding:10px 16px;border-radius:999px;font-size:12px;margin-bottom:10px;'
        }, 'Tu navegador no soporta BarcodeDetector nativo. Usa la caja de texto o archivo abajo.')
      : h('p', {
          style: 'font-size:13px;color:#F3F0E8;opacity:0.8;margin:0 0 10px 0;'
        }, 'Apunta la cámara hacia el código QR mostrado en la pantalla de tu PC.');

    // Sin fuente monoespaciada y con radio canónico de 28px (ALTO-05 y MEDIO-02 diseno.md)
    const textareaManual = h('textarea', {
      id: 'textarea-qr-manual',
      rows: '3',
      placeholder: '{"tipo":"medidas", "item": {...}}',
      style: "width:100%;height:120px;border-radius:28px;padding:16px 20px;background:#17171A;color:#F3F0E8;border:none;font-family:'Bricolage Grotesque',system-ui,sans-serif;font-variant-numeric:tabular-nums;font-size:13px;resize:none;"
    });

    const inputArchivo = h('input', {
      id: 'input-archivo-json',
      type: 'file',
      accept: '.json,application/json',
      style: 'display:none;',
      on: {
        change: (e) => {
          const archivo = e.target.files?.[0];
          if (!archivo) return;
          const lector = new FileReader();
          lector.onload = async (ev) => {
            try {
              const obj = JSON.parse(String(ev.target?.result || ''));
              await guardarObjetoImportadoQR(obj);
            } catch (err) {
              aviso('Archivo JSON inválido o dañado', 'error');
            }
          };
          lector.readAsText(archivo);
        }
      }
    });

    const bloqueRecibir = h('div', { style: 'display:flex;flex-direction:column;gap:12px;' },
      nodoAvisoDetector,
      h('div', { style: 'display:flex;flex-direction:column;gap:8px;' },
        h('label', { for: 'textarea-qr-manual', style: 'font-size:13px;color:#F3F0E8;opacity:0.8;' }, 'Pegar los datos JSON manualmente:'),
        textareaManual,
        h('button', {
          id: 'btn-cargar-json-manual',
          type: 'button',
          class: 'camara-btn-primario-lima',
          style: 'min-height:48px;height:48px;',
          on: {
            click: async () => {
              const txt = textareaManual.value.trim();
              if (!txt) return;
              try {
                const obj = JSON.parse(txt);
                await guardarObjetoImportadoQR(obj);
              } catch (err) {
                aviso('JSON inválido o mal formado', 'error');
              }
            }
          }
        }, 'Importar texto JSON')
      ),
      h('div', { style: 'margin-top:6px;' },
        h('label', { style: 'font-size:13px;color:#F3F0E8;opacity:0.8;display:block;margin-bottom:8px;' }, 'O carga directamente un archivo .json:'),
        h('label', { class: 'camara-btn-secundario', style: 'display:flex;width:100%;' },
          icono('carpeta', 18),
          h('span', {}, 'Subir archivo .json'),
          inputArchivo
        )
      )
    );

    cont.replaceChildren(bloqueRecibir);
  } else {
    generarPayloadQRParaMostrar(cont);
  }
}

/**
 * Genera el payload QR respetando íntegramente el contrato de 'medidas'
 * (MEDIO-12 camara_cuerpo.md).
 */
async function generarPayloadQRParaMostrar(cont) {
  cont.replaceChildren(
    h('div', { style: 'font-size:13px;color:#F3F0E8;opacity:0.8;text-align:center;padding:16px;' },
      'Generando código QR con tus datos...'
    )
  );

  try {
    const medidas = await todos('medidas');
    medidas.sort((a, b) => {
      if (b.fecha !== a.fecha) return b.fecha > a.fecha ? 1 : -1;
      if (a.origen === 'manual' && b.origen !== 'manual') return -1;
      if (b.origen === 'manual' && a.origen !== 'manual') return 1;
      return 0;
    });
    const ultimaMedida = medidas[0] || null;

    const itemExportar = ultimaMedida ? {
      id: ultimaMedida.id || nuevoId(),
      fecha: ultimaMedida.fecha || hoyISO(),
      peso: ultimaMedida.peso ?? null,
      cintura: ultimaMedida.cintura ?? null,
      cuello: ultimaMedida.cuello ?? null,
      pecho: ultimaMedida.pecho ?? null,
      brazo: ultimaMedida.brazo ?? null,
      hombros: ultimaMedida.hombros ?? null,
      cadera: ultimaMedida.cadera ?? null,
      grasaNavy: ultimaMedida.grasaNavy ?? null,
      origen: ultimaMedida.origen || 'manual'
    } : {
      id: nuevoId(),
      fecha: hoyISO(),
      peso: 75,
      cintura: 82,
      cuello: 38,
      pecho: null,
      brazo: null,
      hombros: null,
      cadera: null,
      grasaNavy: null,
      origen: 'manual'
    };

    const payload = JSON.stringify({
      app: 'forja',
      tipo: 'medidas',
      item: itemExportar
    });

    const svgQrTexto = qrSvg(payload);
    const contenedorSvg = h('div', { style: 'margin:12px auto;' });
    // Parsear el SVG generado por qrSvg (código propio, sin datos sin escapar) mediante DOMParser
    const docSvg = new DOMParser().parseFromString(svgQrTexto, 'image/svg+xml');
    if (docSvg && docSvg.documentElement) {
      contenedorSvg.appendChild(document.importNode(docSvg.documentElement, true));
    }

    const bloqueEnviar = h('div', { style: 'text-align:center;' },
      contenedorSvg,
      h('p', { style: 'font-size:13px;color:#F3F0E8;opacity:0.8;margin:8px 0 14px 0;' },
        'Escanea este código con la cámara de tu celular en Forja para transferir tus últimas medidas.'
      ),
      h('button', {
        id: 'btn-descargar-json',
        type: 'button',
        class: 'camara-btn-secundario',
        style: 'width:100%;',
        on: {
          click: () => {
            const blob = new Blob([payload], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `forja_medicion_${hoyISO()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            aviso('Archivo JSON descargado', 'ok');
          }
        }
      }, icono('descargar', 18), h('span', {}, 'Descargar archivo .json'))
    );

    cont.replaceChildren(bloqueEnviar);
  } catch (err) {
    cont.replaceChildren(
      h('div', { style: 'font-size:13px;color:#E2553A;text-align:center;' },
        'Error al generar QR de transferencia.'
      )
    );
  }
}

function actualizarUIEstado(mensaje, esError = false) {
  const lbl = document.getElementById('camara-estado');
  if (lbl) {
    lbl.textContent = mensaje;
    lbl.style.display = mensaje ? 'block' : 'none';
    lbl.style.color = esError ? '#E2553A' : '#F3F0E8';
  }
}

// -----------------------------------------------------------------------------
// Desmontaje y limpieza de recursos (Contrato Forja)
// -----------------------------------------------------------------------------
export function desmontar() {
  desmontado = true;
  document.removeEventListener('visibilitychange', manejarVisibilidad);
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

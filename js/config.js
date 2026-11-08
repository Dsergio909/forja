/* ==========================================================================
   FORJA - Configuración Global (js/config.js)
   Firmas y constantes exactas según CONTRATOS.md y ENCARGO_APP.md
   ========================================================================== */

export const VERSION = '1.0.0';

// Librería de visión y puntos corporales (MediaPipe PoseLandmarker)
export const MEDIAPIPE_VERSION = '1.2.2';   // comprobado en npm el 7-nov-2026
export const MEDIAPIPE_JS = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/vision_bundle.mjs`;
export const MEDIAPIPE_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
export const MEDIAPIPE_MODELO = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';

// IA local en el navegador (WebLLM)
// Versión y modelos comprobados en npm el 7-nov-2026. El modelo final se elige con la prueba de sus preguntas.
export const WEBLLM_URL = 'https://esm.run/@mlc-ai/web-llm@0.2.87';
export const WEBLLM_MODELO = 'Qwen3.5-2B-q4f16_1-MLC';
export const WEBLLM_MODELO_RESPALDO = 'Qwen3.5-0.8B-q4f16_1-MLC';   // por si el celular se queda sin memoria

// Fórmula por defecto para cálculo de 1RM ('epley' o 'brzycki')
export const FORMULA_1RM = 'epley';

// Rango meta de series duras semanales por grupo muscular
export const SERIES_META = { min: 10, max: 20 };

// Reglas fundamentales del coach de Sergio para responder dudas y guiar entrenamiento
export const REGLAS_COACH = [
  'Fallo solo en la última serie y solo en máquina o polea.',
  'En ejercicios con peso libre entrena siempre con 1 a 2 RIR de reserva técnica.',
  'No compares kilos entre máquinas distintas: cada máquina tiene su fricción y palanca; usa siempre su nota.',
  'Entrenamiento directo de bíceps máximo 2 veces por semana.',
  'Descansa aproximadamente 2 minutos en ejercicios compuestos y de 1 a 1.5 minutos en aislamiento.',
  'Apunta a entre 10 y 20 series duras semanales por grupo muscular para hipertrofia.'
];

// Tiempos recomendados de descanso entre series (en segundos)
export const DESCANSO = { compuesto: 120, aislamiento: 75 };

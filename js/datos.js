/* ==========================================================================
   FORJA - Carga de Datos Base (js/datos.js)
   Firmas exactas según CONTRATOS.md
   Cache en memoria de archivos JSON estáticos y lectura de ajustes.
   ========================================================================== */

import { ajuste } from './db.js';

let cacheEjercicios = null;
let cacheAlimentos = null;
let cacheRutinaBase = null;

/**
 * Carga 'data/ejercicios.json' una sola vez y lo almacena en memoria.
 * Si el archivo no existe o falla la carga, devuelve un array vacío sin romper la app.
 * @returns {Promise<Array>}
 */
export async function ejercicios() {
  if (cacheEjercicios !== null) {
    return cacheEjercicios;
  }

  try {
    const respuesta = await fetch('data/ejercicios.json');
    if (respuesta.ok) {
      cacheEjercicios = await respuesta.json();
    } else {
      console.warn(`[Datos] data/ejercicios.json respondió con estado ${respuesta.status}`);
      cacheEjercicios = [];
    }
  } catch (error) {
    console.warn('[Datos] Error al cargar data/ejercicios.json:', error);
    cacheEjercicios = [];
  }

  return cacheEjercicios;
}

/**
 * Busca un ejercicio por su identificador único 'id'.
 * @param {string} id Identificador del ejercicio
 * @returns {Promise<Object|null>}
 */
export async function ejercicio(id) {
  const lista = await ejercicios();
  return lista.find((item) => item.id === id) || null;
}

/**
 * Carga 'data/alimentos.json' con cache en memoria.
 * @returns {Promise<Array>}
 */
export async function alimentos() {
  if (cacheAlimentos !== null) {
    return cacheAlimentos;
  }

  try {
    const respuesta = await fetch('data/alimentos.json');
    if (respuesta.ok) {
      cacheAlimentos = await respuesta.json();
    } else {
      console.warn(`[Datos] data/alimentos.json respondió con estado ${respuesta.status}`);
      cacheAlimentos = [];
    }
  } catch (error) {
    console.warn('[Datos] Error al cargar data/alimentos.json:', error);
    cacheAlimentos = [];
  }

  return cacheAlimentos;
}

/**
 * Carga 'data/rutina.json' como plantilla inicial de entrenamiento.
 * @returns {Promise<Object>}
 */
export async function rutinaBase() {
  if (cacheRutinaBase !== null) {
    return cacheRutinaBase;
  }

  try {
    const respuesta = await fetch('data/rutina.json');
    if (respuesta.ok) {
      cacheRutinaBase = await respuesta.json();
    } else {
      console.warn(`[Datos] data/rutina.json respondió con estado ${respuesta.status}`);
      cacheRutinaBase = { dias: {} };
    }
  } catch (error) {
    console.warn('[Datos] Error al cargar data/rutina.json:', error);
    cacheRutinaBase = { dias: {} };
  }

  return cacheRutinaBase;
}

/**
 * Obtiene la rutina activa del usuario (desde el ajuste 'rutina' en IndexedDB)
 * o recurre a la rutinaBase() inicial si aún no se ha personalizado.
 * @returns {Promise<Object>}
 */
export async function rutina() {
  const rutinaGuardada = await ajuste('rutina', null);
  if (rutinaGuardada && rutinaGuardada.dias && Object.keys(rutinaGuardada.dias).length > 0) {
    return rutinaGuardada;
  }
  return await rutinaBase();
}

/**
 * Obtiene el perfil de Sergio con los valores por defecto establecidos en CONTRATOS.md.
 * @returns {Promise<{estaturaCm: number|null, kcal: number, proteina: number, aguaVasos: number, pasos: number, nombre?: string, metaNombre?: string, metaFecha?: string, metaMes?: string}>}
 */
export async function perfil() {
  const perfilDefecto = {
    nombre: '',
    estaturaCm: null,
    metaNombre: 'Grado',
    metaFecha: '',
    metaMes: '',
    kcal: 2200,
    proteina: 128,
    aguaVasos: 10,
    pasos: 9000
  };

  const perfilGuardado = await ajuste('perfil', null);
  return {
    ...perfilDefecto,
    ...(perfilGuardado || {})
  };
}

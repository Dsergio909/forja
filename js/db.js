/* ==========================================================================
   FORJA - Base de Datos Local IndexedDB (js/db.js)
   Firmas y comportamiento exactos según CONTRATOS.md
   Almacenamiento exclusivo en el dispositivo sin servidores.
   ========================================================================== */

export const STORES = [
  'sesiones',
  'series',
  'medidas',
  'fotos',
  'comidas',
  'ajustes',
  'chat',
  'camara'
];

const DB_NOMBRE = 'forja';
const DB_VERSION = 1;

let dbInstancia = null;

/**
 * Abre o reutiliza la conexión a la base de datos IndexedDB 'forja' v1.
 * Crea los almacenes (stores) requeridos con keyPath 'id'.
 * Solicita persistencia de almacenamiento al navegador.
 * @returns {Promise<IDBDatabase>}
 */
export async function abrir() {
  if (dbInstancia) {
    return dbInstancia;
  }

  return new Promise((resolve, reject) => {
    const peticion = indexedDB.open(DB_NOMBRE, DB_VERSION);

    peticion.onupgradeneeded = (evento) => {
      const db = evento.target.result;
      STORES.forEach((nombreStore) => {
        if (!db.objectStoreNames.contains(nombreStore)) {
          db.createObjectStore(nombreStore, { keyPath: 'id' });
        }
      });
    };

    peticion.onsuccess = (evento) => {
      dbInstancia = evento.target.result;

      // Limpiar referencia en caso de cierre inesperado
      dbInstancia.onclose = () => {
        dbInstancia = null;
      };

      // Solicitar persistencia para evitar que el navegador limpie datos en baja memoria
      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().catch(() => {});
      }

      resolve(dbInstancia);
    };

    peticion.onerror = () => {
      reject(new Error(`Error al abrir IndexedDB '${DB_NOMBRE}': ${peticion.error?.message}`));
    };
  });
}

/**
 * Genera un identificador único universal (UUID v4 o fallback).
 * @returns {string}
 */
export function nuevoId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback seguro en caso de entornos sin crypto.randomUUID
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

/**
 * Guarda o actualiza un objeto en el store indicado.
 * Si no trae 'id', le genera uno con nuevoId().
 * Asigna obj.actualizado = Date.now().
 * @param {string} store Nombre del store
 * @param {Object} obj Objeto a almacenar
 * @returns {Promise<Object>} El objeto guardado
 */
export async function guardar(store, obj) {
  const db = await abrir();
  if (!obj.id) {
    obj.id = nuevoId();
  }
  obj.actualizado = Date.now();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    os.put(obj);

    tx.oncomplete = () => resolve(obj);
    tx.onerror = () => reject(new Error(`Error al guardar en '${store}': ${tx.error?.message}`));
  });
}

/**
 * Obtiene un registro por su clave primaria id.
 * @param {string} store Nombre del store
 * @param {string} id Identificador
 * @returns {Promise<Object|undefined>}
 */
export async function obtener(store, id) {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const os = tx.objectStore(store);
    const peticion = os.get(id);

    peticion.onsuccess = () => resolve(peticion.result);
    peticion.onerror = () => reject(new Error(`Error al obtener de '${store}': ${peticion.error?.message}`));
  });
}

/**
 * Elimina un registro por su id.
 * @param {string} store Nombre del store
 * @param {string} id Identificador
 * @returns {Promise<boolean>}
 */
export async function borrar(store, id) {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    os.delete(id);

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(new Error(`Error al borrar de '${store}': ${tx.error?.message}`));
  });
}

/**
 * Obtiene todos los registros de un store en un array.
 * @param {string} store Nombre del store
 * @returns {Promise<Array>}
 */
export async function todos(store) {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const os = tx.objectStore(store);
    const peticion = os.getAll();

    peticion.onsuccess = () => resolve(peticion.result || []);
    peticion.onerror = () => reject(new Error(`Error al listar '${store}': ${peticion.error?.message}`));
  });
}

/**
 * Filtra registros en memoria según una función predicado.
 * @param {string} store Nombre del store
 * @param {Function} fn Función filtro (item => boolean)
 * @returns {Promise<Array>}
 */
export async function filtrar(store, fn) {
  const elementos = await todos(store);
  return elementos.filter(fn);
}

/**
 * Lee un valor del store 'ajustes' ({id: clave, valor}).
 * @param {string} clave Clave del ajuste
 * @param {*} valorPorDefecto Valor retornado si la clave no existe
 * @returns {Promise<*>}
 */
export async function ajuste(clave, valorPorDefecto = null) {
  const reg = await obtener('ajustes', clave);
  if (reg && reg.valor !== undefined) {
    return reg.valor;
  }
  return valorPorDefecto;
}

/**
 * Guarda o actualiza un valor en el store 'ajustes'.
 * @param {string} clave Clave del ajuste
 * @param {*} valor Valor a guardar
 * @returns {Promise<*>} El valor almacenado
 */
export async function ponerAjuste(clave, valor) {
  const registro = { id: clave, valor };
  await guardar('ajustes', registro);
  return valor;
}

/**
 * Exporta toda la base de datos a un objeto JSON serializable.
 * Si conFotos es true, convierte los Blobs de 'fotos' a cadenas dataURL (base64).
 * @param {Object} opciones
 * @param {boolean} opciones.conFotos
 * @returns {Promise<{version: number, fecha: string, datos: Object}>}
 */
export async function exportarTodo({ conFotos = false } = {}) {
  const resultado = {
    version: 1,
    fecha: new Date().toISOString(),
    datos: {}
  };

  for (const store of STORES) {
    const items = await todos(store);

    if (store === 'fotos') {
      const fotosProcesadas = [];
      for (const foto of items) {
        if (conFotos && foto.blob instanceof Blob) {
          const dataUrl = await blobADataURL(foto.blob);
          fotosProcesadas.push({ ...foto, blob: null, dataUrl });
        } else {
          // Si no incluye fotos o no hay blob, excluimos los bytes pesados
          const { blob, ...sinBlob } = foto;
          fotosProcesadas.push(sinBlob);
        }
      }
      resultado.datos[store] = fotosProcesadas;
    } else {
      resultado.datos[store] = items;
    }
  }

  return resultado;
}

/**
 * Importa datos a la base de datos uniendo por 'id'.
 * En caso de conflicto de id, gana el registro con 'actualizado' más reciente.
 * @param {Object} obj Objeto exportado previamente con estructura {datos: {...}}
 * @returns {Promise<{agregados: number, actualizados: number}>}
 */
export async function importarTodo(obj) {
  if (!obj || typeof obj !== 'object' || !obj.datos) {
    throw new Error('Formato de importación inválido: falta propiedad "datos".');
  }

  let agregados = 0;
  let actualizados = 0;

  for (const store of STORES) {
    const listaImportar = obj.datos[store];
    if (!Array.isArray(listaImportar)) continue;

    const existentes = await todos(store);
    const mapaExistentes = new Map(existentes.map((item) => [item.id, item]));

    for (const item of listaImportar) {
      if (!item || !item.id) continue;

      // Reconstruir Blob de foto si viene como dataUrl
      if (store === 'fotos' && item.dataUrl) {
        try {
          item.blob = await dataURLABlob(item.dataUrl);
          delete item.dataUrl;
        } catch (e) {
          console.warn('[DB] No se pudo reconstruir blob de foto en importación', e);
        }
      }

      const existente = mapaExistentes.get(item.id);
      if (!existente) {
        await guardar(store, item);
        agregados++;
      } else {
        const fechaNueva = item.actualizado || 0;
        const fechaVieja = existente.actualizado || 0;
        if (fechaNueva >= fechaVieja) {
          await guardar(store, item);
          actualizados++;
        }
      }
    }
  }

  return { agregados, actualizados };
}

// --- Funciones auxiliares de conversión Blob / dataURL ---

function blobADataURL(blob) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onloadend = () => resolve(lector.result);
    lector.onerror = () => reject(new Error('Error al leer Blob'));
    lector.readAsDataURL(blob);
  });
}

async function dataURLABlob(dataUrl) {
  const respuesta = await fetch(dataUrl);
  return await respuesta.blob();
}

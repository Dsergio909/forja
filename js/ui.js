/* ==========================================================================
   FORJA - Utilidades de Interfaz de Usuario (js/ui.js)
   Firmas y comportamiento exactos según CONTRATOS.md
   Sin alert(), sin emojis en el núcleo, optimizado para móvil y revista de sala.
   ========================================================================== */

import { icono } from './iconos.js';

/**
 * Crea un elemento del DOM de forma declarativa y rápida.
 * @param {string} tag Nombre de la etiqueta HTML
 * @param {Object} attrs Atributos, clases, estilos y eventos
 * @param {...(Node|string|number|Array)} hijos Elementos hijos o texto
 * @returns {HTMLElement}
 */
export function h(tag, attrs = {}, ...hijos) {
  const el = document.createElement(tag);

  if (attrs && typeof attrs === 'object') {
    for (const [clave, valor] of Object.entries(attrs)) {
      if (valor === undefined || valor === null) continue;

      if (clave === 'class' || clave === 'className') {
        el.className = valor;
      } else if (clave === 'style') {
        if (typeof valor === 'string') {
          el.style.cssText = valor;
        } else if (typeof valor === 'object') {
          Object.assign(el.style, valor);
        }
      } else if (clave === 'on' && typeof valor === 'object') {
        for (const [evento, fn] of Object.entries(valor)) {
          if (typeof fn === 'function') {
            el.addEventListener(evento, fn);
          }
        }
      } else if (clave.startsWith('on') && typeof valor === 'function') {
        const nombreEvento = clave.slice(2).toLowerCase();
        el.addEventListener(nombreEvento, valor);
      } else if (clave === 'dataset' && typeof valor === 'object') {
        Object.assign(el.dataset, valor);
      } else if (typeof valor === 'boolean') {
        if (valor) {
          el.setAttribute(clave, '');
          el[clave] = true;
        } else {
          el[clave] = false;
        }
      } else {
        el.setAttribute(clave, valor);
      }
    }
  }

  // Insertar hijos admitiendo anidación
  const listaHijos = hijos.flat(Infinity);
  for (const hijo of listaHijos) {
    if (hijo === null || hijo === undefined || hijo === false || hijo === true) {
      continue;
    }
    if (hijo instanceof Node) {
      el.appendChild(hijo);
    } else {
      el.appendChild(document.createTextNode(String(hijo)));
    }
  }

  return el;
}

/**
 * Muestra una notificación flotante (toast) abajo durante 3 segundos.
 * Cero emojis: utiliza iconos SVG vectoriales del sistema.
 * @param {string} texto Mensaje a mostrar
 * @param {'info'|'ok'|'error'} tipo Tipo de aviso
 */
export function aviso(texto, tipo = 'info') {
  let contenedor = document.getElementById('contenedor-avisos');
  if (!contenedor) {
    contenedor = h('div', { id: 'contenedor-avisos', 'aria-live': 'polite' });
    const app = document.getElementById('app') || document.body;
    app.appendChild(contenedor);
  }

  let nodoIcono;
  if (tipo === 'ok') {
    nodoIcono = icono('check', 18);
  } else if (tipo === 'error') {
    nodoIcono = icono('cerrar', 18);
  } else {
    nodoIcono = icono('info', 18);
  }

  const elementoAviso = h('div', { class: `aviso-toast ${tipo}` },
    h('span', { class: 'aviso-icono' }, nodoIcono),
    h('span', { class: 'aviso-texto' }, texto)
  );

  contenedor.appendChild(elementoAviso);

  // Animación de salida y remoción tras 3 segundos
  setTimeout(() => {
    elementoAviso.classList.add('saliendo');
    setTimeout(() => {
      elementoAviso.remove();
    }, 250);
  }, 2750);
}

/**
 * Muestra un diálogo modal interactivo sin romper la interfaz.
 * Cumple con resolución antes de destruir DOM para permitir lectura de inputs
 * y limpieza garantizada del listener de teclado Escape.
 * @param {Object} params
 * @param {string} params.titulo
 * @param {string|Node|Array<Node>} params.cuerpo
 * @param {Array<{texto: string, valor: any, tipo?: 'primario'|'peligro'|'fantasma'|''}>} params.botones
 * @returns {Promise<any>} Resuelve con el 'valor' del botón tocado
 */
export function dialogo({ titulo, cuerpo, botones = [] }) {
  return new Promise((resolve) => {
    let contenedor = document.getElementById('contenedor-dialogos');
    if (!contenedor) {
      contenedor = h('div', { id: 'contenedor-dialogos' });
      document.body.appendChild(contenedor);
    }

    const botonesDefecto = botones.length > 0 ? botones : [
      { texto: 'Aceptar', valor: true, tipo: 'primario' }
    ];

    let cerrado = false;
    const cerrarModal = (valor) => {
      if (cerrado) return;
      cerrado = true;

      // Desuscribir el listener de teclado inmediatamente
      document.removeEventListener('keydown', manejarTeclado);

      // Desactivar interacción inmediatamente para evitar pulsaciones dobles
      if (overlay) {
        overlay.style.pointerEvents = 'none';
      }

      // Resolver la promesa ANTES de quitar el DOM para lectura sincrónica de inputs
      resolve(valor);

      // Quitar el overlay en el siguiente ciclo de eventos
      setTimeout(() => {
        if (overlay && overlay.parentNode) {
          overlay.remove();
        }
      }, 0);
    };

    const manejarTeclado = (e) => {
      if (e.key === 'Escape') {
        cerrarModal(null);
      }
    };
    document.addEventListener('keydown', manejarTeclado);

    const nodosBotones = botonesDefecto.map((b) => {
      const claseTipo = b.tipo ? ` ${b.tipo}` : '';
      return h('button', {
        class: `btn${claseTipo}`,
        type: 'button',
        on: { click: () => cerrarModal(b.valor) }
      }, b.texto);
    });

    let nodoCuerpo;
    if (typeof cuerpo === 'string') {
      nodoCuerpo = h('div', { class: 'dialogo-cuerpo' }, cuerpo);
    } else if (cuerpo instanceof Node) {
      nodoCuerpo = cuerpo;
    } else if (Array.isArray(cuerpo)) {
      nodoCuerpo = h('div', { class: 'dialogo-cuerpo' }, ...cuerpo);
    } else {
      nodoCuerpo = h('div', { class: 'dialogo-cuerpo' }, String(cuerpo || ''));
    }

    const caja = h('div', { class: 'dialogo-caja', role: 'dialog', 'aria-modal': 'true' },
      h('h2', { class: 'dialogo-titulo' }, titulo || 'Aviso'),
      nodoCuerpo,
      h('div', { class: 'dialogo-botones' }, ...nodosBotones)
    );

    const overlay = h('div', { class: 'dialogo-overlay' }, caja);

    // Cerrar al tocar fuera
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cerrarModal(null);
      }
    });

    contenedor.appendChild(overlay);
  });
}

/**
 * Cuadro de confirmación que reemplaza a confirm().
 * @param {string} texto Pregunta de confirmación
 * @returns {Promise<boolean>}
 */
export function confirmar(texto) {
  return dialogo({
    titulo: 'Confirmación',
    cuerpo: texto,
    botones: [
      { texto: 'Cancelar', valor: false, tipo: 'fantasma' },
      { texto: 'Aceptar', valor: true, tipo: 'primario' }
    ]
  });
}

/**
 * Retorna la fecha actual o la fecha provista en formato ISO local 'AAAA-MM-DD'.
 * Si recibe una cadena con formato 'AAAA-MM-DD', la devuelve directamente sin pasarla
 * por new Date() en UTC para evitar restar un día en Colombia (UTC-5).
 * @param {Date|string|number} [fecha] Fecha opcional (por defecto hoy)
 * @returns {string} Fecha en formato 'AAAA-MM-DD'
 */
export function hoyISO(fecha) {
  if (typeof fecha === 'string') {
    const match = fecha.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
  }
  const d = fecha instanceof Date ? fecha : (typeof fecha === 'number' ? new Date(fecha) : new Date());
  if (isNaN(d.getTime())) {
    const ahora = new Date();
    const a = ahora.getFullYear();
    const m = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');
    return `${a}-${m}-${dia}`;
  }
  const anio = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

/**
 * Formatea una fecha ISO a formato corto en español ('vie 6 nov').
 * @param {string} iso Fecha 'AAAA-MM-DD'
 * @returns {string}
 */
export function fechaBonita(iso) {
  if (!iso || typeof iso !== 'string') return '';
  const partes = iso.split('-');
  if (partes.length < 3) return iso;

  const anio = parseInt(partes[0], 10);
  const mes = parseInt(partes[1], 10);
  const dia = parseInt(partes[2], 10);

  const fechaObj = new Date(anio, mes - 1, dia);
  if (isNaN(fechaObj.getTime())) return iso;

  const diasSemana = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  const diaSemana = diasSemana[fechaObj.getDay()];
  const mesNom = meses[mes - 1];

  return `${diaSemana} ${dia} ${mesNom}`;
}

/**
 * Formatea un valor de peso y modo por lado o por placas.
 * Resuelve el caso [BAJO-01] de logica_datos: si unidad === 'placa' y kg es nulo/vacío, devuelve 'placa'.
 * @param {number|null|undefined} kg Peso levantado o número de placa (null o 0 = peso corporal si no es placa)
 * @param {boolean} [porLado=false] Si es peso por cada lado
 * @param {string} [unidad] Opcional: si unidad === 'placa' devuelve 'placa N' o 'placa'
 * @returns {string} '40 kg/lado' · 'peso corporal' · '80 kg' · 'placa N' · 'placa'
 */
export function formatoKg(kg, porLado = false, unidad) {
  if (unidad === 'placa') {
    return (kg != null && kg !== '') ? `placa ${kg}` : 'placa';
  }
  if (kg === null || kg === undefined || kg === '' || Number(kg) === 0) {
    return 'peso corporal';
  }
  const pesoNum = Number(kg);
  const textoNumero = Number.isInteger(pesoNum) ? pesoNum.toString() : pesoNum.toFixed(1);
  return porLado ? `${textoNumero} kg/lado` : `${textoNumero} kg`;
}

/**
 * Dispara una vibración háptica en dispositivos móviles compatibles.
 * @param {number|number[]} [patron=100] Duración en ms o patrón de pulsos
 */
export function vibrar(patron = 100) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(patron);
    } catch (e) {
      // Ignorar restricciones de permisos o soporte
    }
  }
}

let audioCtxInstancia = null;

/**
 * Reproduce un pitido corto y suave con Web Audio API (útil para temporizador de descanso).
 */
export function sonido() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtxInstancia || audioCtxInstancia.state === 'closed') {
      audioCtxInstancia = new AudioContextClass();
    }

    if (audioCtxInstancia.state === 'suspended') {
      audioCtxInstancia.resume();
    }

    const ahora = audioCtxInstancia.currentTime;
    const osc = audioCtxInstancia.createOscillator();
    const ganancia = audioCtxInstancia.createGain();

    osc.type = 'sine';
    // Pitido en tono A5 (880 Hz)
    osc.frequency.setValueAtTime(880, ahora);

    // Envolvente para evitar clicks de audio
    ganancia.gain.setValueAtTime(0.001, ahora);
    ganancia.gain.exponentialRampToValueAtTime(0.2, ahora + 0.02);
    ganancia.gain.exponentialRampToValueAtTime(0.001, ahora + 0.18);

    osc.connect(ganancia);
    ganancia.connect(audioCtxInstancia.destination);

    osc.start(ahora);
    osc.stop(ahora + 0.2);
  } catch (e) {
    console.warn('[UI] Audio no disponible:', e);
  }
}

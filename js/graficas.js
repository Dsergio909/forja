// js/graficas.js - Generador de gráficas SVG propio, ligero, responsive y editorial
// Dirección de arte Forja v2: paleta en Tinta (#17171A), Tinta suave (#5D5951),
// Papel 2 (#E9E4D8) y Lima de tiza (#C8F03C), sin cuadrículas pesadas, radios 999px.

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Crea un elemento SVG con atributos y contenido opcional.
 * @private
 */
function crearNodoSVG(tag, attrs = {}, hijos = []) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [clave, valor] of Object.entries(attrs)) {
    if (valor != null) {
      el.setAttribute(clave, valor);
    }
  }
  for (const hijo of hijos) {
    if (typeof hijo === 'string') {
      el.appendChild(document.createTextNode(hijo));
    } else if (hijo instanceof Node) {
      el.appendChild(hijo);
    }
  }
  return el;
}

/**
 * Genera una gráfica de líneas responsive en SVG nativo.
 * Estilo editorial v2: línea en Lima (#C8F03C) o Tinta (#17171A), sin cuadrículas pesadas.
 *
 * @param {Array<object>} datos - Puntos {x: string|number, y: number, pr?: boolean, subtexto?: string} o series [{puntos:[...]}]
 * @param {object} [opciones={}]
 * @param {number} [opciones.ancho=360] - Ancho del viewBox
 * @param {number} [opciones.alto=180] - Alto del viewBox
 * @param {string} [opciones.unidad='kg'] - Unidad mostrada en etiquetas y tooltips
 * @param {string} [opciones.color] - Color de la línea (por defecto Lima #C8F03C)
 * @param {boolean} [opciones.mostrarPuntos=true] - Dibujar círculos en los puntos
 * @param {boolean} [opciones.mostrarArea=true] - Relleno translúcido bajo la curva
 * @param {number} [opciones.lineaMeta] - Dibuja una línea horizontal de referencia
 * @param {function} [opciones.etiquetaY] - Formateador de valores Y
 * @param {function} [opciones.etiquetaX] - Formateador de valores X
 * @returns {SVGSVGElement} Elemento SVG interactivo y responsive
 */
export function lineas(datos, opciones = {}) {
  const ancho = opciones.ancho || 360;
  const alto = opciones.alto || 180;
  const unidad = opciones.unidad != null ? opciones.unidad : 'kg';
  const colorLinea = opciones.color || 'var(--lima, var(--ok, #C8F03C))';
  const mostrarPuntos = opciones.mostrarPuntos !== false;
  const mostrarArea = opciones.mostrarArea !== false;
  const padding = { top: 22, right: 20, bottom: 26, left: 38 };

  const svg = crearNodoSVG('svg', {
    viewBox: `0 0 ${ancho} ${alto}`,
    width: '100%',
    height: 'auto',
    role: 'img',
    style: 'display: block; overflow: visible; font-family: "Bricolage Grotesque", system-ui, sans-serif;'
  });

  // Normalizar datos a una serie si es arreglo plano
  let puntosNormalizados = [];
  if (Array.isArray(datos) && datos.length > 0) {
    if (datos[0].puntos && Array.isArray(datos[0].puntos)) {
      puntosNormalizados = datos[0].puntos;
    } else {
      puntosNormalizados = datos;
    }
  }

  // Filtrar puntos con valores numéricos válidos
  const puntosValidos = puntosNormalizados.filter(
    p => p && p.y != null && !isNaN(Number(p.y))
  ).map(p => ({
    x: p.x != null ? String(p.x) : '',
    y: Number(p.y),
    pr: !!p.pr,
    subtexto: p.subtexto || ''
  }));

  // Estado vacío
  if (puntosValidos.length === 0) {
    const textoVacio = crearNodoSVG('text', {
      x: ancho / 2,
      y: alto / 2,
      'text-anchor': 'middle',
      fill: 'var(--sutil, var(--tinta-suave, #5D5951))',
      'font-size': '13',
      'font-weight': '500'
    }, ['Sin registros aún']);
    svg.appendChild(textoVacio);
    return svg;
  }

  // Definir escala Y con aire editorial
  let minY = Math.min(...puntosValidos.map(p => p.y));
  let maxY = Math.max(...puntosValidos.map(p => p.y));
  if (opciones.lineaMeta != null) {
    minY = Math.min(minY, opciones.lineaMeta);
    maxY = Math.max(maxY, opciones.lineaMeta);
  }

  if (minY === maxY) {
    minY = Math.max(0, minY - 10);
    maxY = maxY + 10;
  } else {
    const margenY = (maxY - minY) * 0.15;
    minY = Math.max(0, minY - margenY);
    maxY = maxY + margenY;
  }

  const anchoGrafica = ancho - padding.left - padding.right;
  const altoGrafica = alto - padding.top - padding.bottom;

  const coordX = (idx) => {
    if (puntosValidos.length === 1) return padding.left + anchoGrafica / 2;
    return padding.left + (idx / (puntosValidos.length - 1)) * anchoGrafica;
  };

  const coordY = (val) => {
    const proporcion = (val - minY) / (maxY - minY);
    return padding.top + (1 - proporcion) * altoGrafica;
  };

  // Sin cuadrículas pesadas: solo 2 líneas guía muy sutiles
  const nivelesGuia = [minY + (maxY - minY) * 0.33, minY + (maxY - minY) * 0.67];
  for (const valY of nivelesGuia) {
    const yPos = coordY(valY);

    svg.appendChild(crearNodoSVG('line', {
      x1: padding.left,
      y1: yPos,
      x2: ancho - padding.right,
      y2: yPos,
      stroke: 'rgba(23, 23, 26, 0.06)',
      'stroke-width': '1'
    }));

    const etiqueta = opciones.etiquetaY
      ? opciones.etiquetaY(Math.round(valY))
      : `${Math.round(valY)}`;

    svg.appendChild(crearNodoSVG('text', {
      x: padding.left - 6,
      y: yPos + 3.5,
      'text-anchor': 'end',
      fill: 'var(--sutil, var(--tinta-suave, #5D5951))',
      'font-size': '10',
      'font-variant-numeric': 'tabular-nums'
    }, [etiqueta]));
  }

  // Línea de meta si existe
  if (opciones.lineaMeta != null) {
    const yMeta = coordY(opciones.lineaMeta);
    svg.appendChild(crearNodoSVG('line', {
      x1: padding.left,
      y1: yMeta,
      x2: ancho - padding.right,
      y2: yMeta,
      stroke: 'var(--lima, var(--ok, #C8F03C))',
      'stroke-width': '1.5',
      'stroke-dasharray': '3,3'
    }));
    svg.appendChild(crearNodoSVG('text', {
      x: ancho - padding.right,
      y: yMeta - 4,
      'text-anchor': 'end',
      fill: 'var(--texto, var(--tinta, #17171A))',
      'font-size': '9',
      'font-weight': '700'
    }, ['Meta']));
  }

  // Gradiente suave de Lima para el área
  const gradId = 'grad-' + Math.random().toString(36).substring(2, 9);
  const defs = crearNodoSVG('defs', {}, [
    crearNodoSVG('linearGradient', { id: gradId, x1: '0', y1: '0', x2: '0', y2: '1' }, [
      crearNodoSVG('stop', { offset: '0%', 'stop-color': '#C8F03C', 'stop-opacity': '0.28' }),
      crearNodoSVG('stop', { offset: '100%', 'stop-color': '#C8F03C', 'stop-opacity': '0.0' })
    ])
  ]);
  svg.appendChild(defs);

  // Calcular trayectoria
  const coordenadas = puntosValidos.map((p, idx) => ({
    x: coordX(idx),
    y: coordY(p.y),
    datos: p
  }));

  if (coordenadas.length > 1) {
    const dLinea = coordenadas.reduce((acc, curr, idx) => {
      return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
    }, '');

    // Relleno de área translúcida
    if (mostrarArea) {
      const yBase = padding.top + altoGrafica;
      const dArea = `${dLinea} L ${coordenadas[coordenadas.length - 1].x} ${yBase} L ${coordenadas[0].x} ${yBase} Z`;
      svg.appendChild(crearNodoSVG('path', {
        d: dArea,
        fill: `url(#${gradId})`,
        stroke: 'none'
      }));
    }

    // Trazo de línea principal
    svg.appendChild(crearNodoSVG('path', {
      d: dLinea,
      fill: 'none',
      stroke: colorLinea,
      'stroke-width': '2.75',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
    }));
  }

  // Puntos individuales y marcadores de récord personal
  if (mostrarPuntos) {
    coordenadas.forEach((pt) => {
      const gPunto = crearNodoSVG('g', { class: 'punto-grafica' });

      const valorTxt = `${pt.datos.y} ${unidad}${pt.datos.subtexto ? ` (${pt.datos.subtexto})` : ''}`;
      const fechaTxt = pt.datos.x ? `\n${pt.datos.x}` : '';
      const title = crearNodoSVG('title', {}, [`${valorTxt}${fechaTxt}${pt.datos.pr ? ' — RÉCORD PERSONAL' : ''}`]);
      gPunto.appendChild(title);

      if (pt.datos.pr) {
        // Halo de récord en Lima
        gPunto.appendChild(crearNodoSVG('circle', {
          cx: pt.x,
          cy: pt.y,
          r: '7',
          fill: 'none',
          stroke: 'var(--lima, #C8F03C)',
          'stroke-width': '2',
          'stroke-opacity': '0.45'
        }));

        // Punto central de récord
        gPunto.appendChild(crearNodoSVG('circle', {
          cx: pt.x,
          cy: pt.y,
          r: '4.5',
          fill: 'var(--lima, #C8F03C)',
          stroke: 'var(--texto, var(--tinta, #17171A))',
          'stroke-width': '2'
        }));

        // Etiqueta flotante 'Récord' en serif cursivo
        gPunto.appendChild(crearNodoSVG('text', {
          x: pt.x,
          y: pt.y - 9,
          'text-anchor': 'middle',
          fill: 'var(--texto, var(--tinta, #17171A))',
          'font-family': '"Instrument Serif", Georgia, serif',
          'font-style': 'italic',
          'font-size': '11',
          'font-weight': 'bold'
        }, ['Récord']));
      } else {
        // Punto regular
        gPunto.appendChild(crearNodoSVG('circle', {
          cx: pt.x,
          cy: pt.y,
          r: '3.5',
          fill: 'var(--fondo, var(--papel, #F3F0E8))',
          stroke: colorLinea,
          'stroke-width': '2'
        }));
      }

      svg.appendChild(gPunto);
    });
  }

  // Etiquetas del eje X
  if (coordenadas.length > 0) {
    const indicesAMostrar = [];
    indicesAMostrar.push(0);
    if (coordenadas.length > 3) {
      indicesAMostrar.push(Math.floor(coordenadas.length / 2));
    }
    if (coordenadas.length > 1) {
      indicesAMostrar.push(coordenadas.length - 1);
    }

    const yEjeX = padding.top + altoGrafica + 16;
    indicesAMostrar.forEach((idx) => {
      const pt = coordenadas[idx];
      let txtFecha = pt.datos.x;
      if (opciones.etiquetaX) {
        txtFecha = opciones.etiquetaX(txtFecha);
      } else {
        const partes = String(txtFecha).split('-');
        if (partes.length === 3) {
          txtFecha = `${parseInt(partes[2], 10)}/${parseInt(partes[1], 10)}`;
        }
      }

      let alineacion = 'middle';
      if (idx === 0) alineacion = 'start';
      else if (idx === coordenadas.length - 1) alineacion = 'end';

      svg.appendChild(crearNodoSVG('text', {
        x: pt.x,
        y: yEjeX,
        'text-anchor': alineacion,
        fill: 'var(--sutil, var(--tinta-suave, #5D5951))',
        'font-size': '10',
        'font-variant-numeric': 'tabular-nums'
      }, [txtFecha]));
    });
  }

  return svg;
}

/**
 * Genera una gráfica de barras horizontales responsive en SVG.
 * Optimizada para mostrar series duras por músculo vs meta semanal (10-20 series).
 * Paleta editorial v2: fondo en Papel 2 (#E9E4D8), barras en Tinta (#17171A) y Lima (#C8F03C),
 * números tabulares destacados, radios píldora 999px.
 *
 * @param {Array<object>} datos - Lista de items [{label: string, valor: number, metaMin?: number, metaMax?: number, color?: string}]
 * @param {object} [opciones={}]
 * @param {number} [opciones.ancho=360] - Ancho del viewBox
 * @param {number} [opciones.alto] - Alto calculado automáticamente según items
 * @param {number} [opciones.metaMin=10] - Mínimo de series recomendadas
 * @param {number} [opciones.metaMax=20] - Máximo de series recomendadas
 * @param {string} [opciones.unidad='series'] - Unidad para las etiquetas
 * @returns {SVGSVGElement}
 */
export function barras(datos, opciones = {}) {
  const ancho = opciones.ancho || 360;
  const metaMin = opciones.metaMin != null ? opciones.metaMin : 10;
  const metaMax = opciones.metaMax != null ? opciones.metaMax : 20;
  const unidad = opciones.unidad || 'series';

  const items = Array.isArray(datos) ? datos.filter(d => d && d.label) : [];

  const altoFila = 34;
  const padding = { top: 18, right: 16, bottom: 22, left: 14 };
  const alto = opciones.alto || Math.max(120, items.length * altoFila + padding.top + padding.bottom);

  const svg = crearNodoSVG('svg', {
    viewBox: `0 0 ${ancho} ${alto}`,
    width: '100%',
    height: 'auto',
    role: 'img',
    style: 'display: block; overflow: visible; font-family: "Bricolage Grotesque", system-ui, sans-serif;'
  });

  if (items.length === 0) {
    svg.appendChild(crearNodoSVG('text', {
      x: ancho / 2,
      y: alto / 2,
      'text-anchor': 'middle',
      fill: 'var(--sutil, var(--tinta-suave, #5D5951))',
      'font-size': '13',
      'font-weight': '500'
    }, ['Sin series registradas esta semana']));
    return svg;
  }

  // Rango de escala horizontal
  const valorMaximo = Math.max(...items.map(d => Number(d.valor) || 0), metaMax);
  const maxEscala = Math.ceil(valorMaximo * 1.15);

  const xInicioBarra = 108; // Espacio editorial para el nombre del músculo
  const xFinBarra = ancho - padding.right - 44; // Espacio para el número tabular a la derecha
  const anchoZonaBarras = Math.max(80, xFinBarra - xInicioBarra);

  const calcX = (val) => {
    return xInicioBarra + (Math.min(val, maxEscala) / maxEscala) * anchoZonaBarras;
  };

  // Franja indicadora sutil de la zona meta semanal (10 a 20 series)
  const xMetaMin = calcX(metaMin);
  const xMetaMax = calcX(metaMax);
  const yInicioZona = padding.top - 4;
  const altoZona = items.length * altoFila + 8;

  // Fondo sutil de zona meta con radio canónico 999px
  svg.appendChild(crearNodoSVG('rect', {
    x: xMetaMin,
    y: yInicioZona,
    width: Math.max(2, xMetaMax - xMetaMin),
    height: altoZona,
    fill: 'rgba(23, 23, 26, 0.035)',
    rx: '999'
  }));

  // Guía sutil en la meta mínima (10)
  svg.appendChild(crearNodoSVG('line', {
    x1: xMetaMin,
    y1: yInicioZona,
    x2: xMetaMin,
    y2: yInicioZona + altoZona,
    stroke: 'var(--lima, #C8F03C)',
    'stroke-width': '1',
    'stroke-dasharray': '2,3',
    opacity: '0.85'
  }));

  // Dibujar cada fila
  items.forEach((item, idx) => {
    const valor = Number(item.valor) || 0;
    const yFila = padding.top + idx * altoFila;
    const alturaBarra = 12;

    // Regla de color editorial Forja v2 (tinta y lima):
    // Lima de tiza (#C8F03C) si está en meta (>= 10), Tinta (#17171A) si está en progreso (> 0), Papel 2 si está en 0.
    let colorBarra = item.color;
    if (!colorBarra) {
      if (valor >= metaMin) {
        colorBarra = 'var(--lima, var(--ok, #C8F03C))';
      } else if (valor > 0) {
        colorBarra = 'var(--texto, var(--tinta, #17171A))';
      } else {
        colorBarra = 'transparent';
      }
    }

    const gFila = crearNodoSVG('g', { class: 'fila-barra' });

    // Etiqueta del músculo
    const labelCapitalizado = String(item.label).charAt(0).toUpperCase() + String(item.label).slice(1);
    gFila.appendChild(crearNodoSVG('text', {
      x: xInicioBarra - 8,
      y: yFila + 10,
      'text-anchor': 'end',
      fill: valor > 0 ? 'var(--texto, var(--tinta, #17171A))' : 'var(--sutil, var(--tinta-suave, #5D5951))',
      'font-size': '11',
      'font-weight': valor >= metaMin ? '600' : '400'
    }, [labelCapitalizado]));

    // Barra de fondo track (Papel 2 / radio 999px píldora canónica)
    gFila.appendChild(crearNodoSVG('rect', {
      x: xInicioBarra,
      y: yFila,
      width: anchoZonaBarras,
      height: alturaBarra,
      fill: 'var(--superficie2, var(--papel-2, #E9E4D8))',
      rx: '999'
    }));

    // Barra de progreso rellena
    const anchoRelleno = valor > 0 ? Math.max(6, calcX(valor) - xInicioBarra) : 0;
    if (anchoRelleno > 0) {
      gFila.appendChild(crearNodoSVG('rect', {
        x: xInicioBarra,
        y: yFila,
        width: anchoRelleno,
        height: alturaBarra,
        fill: colorBarra,
        rx: '999'
      }));
    }

    // Valor numérico a la derecha en tabular-nums
    const valorFormateado = valor % 1 === 0 ? valor : valor.toFixed(1);
    const colorTextoValor = valor > 0
      ? 'var(--texto, var(--tinta, #17171A))'
      : 'var(--sutil, var(--tinta-suave, #5D5951))';

    gFila.appendChild(crearNodoSVG('text', {
      x: ancho - padding.right,
      y: yFila + 10,
      'text-anchor': 'end',
      fill: colorTextoValor,
      'font-size': '12',
      'font-weight': valor >= metaMin ? '700' : '500',
      'font-variant-numeric': 'tabular-nums'
    }, [`${valorFormateado}`]));

    svg.appendChild(gFila);
  });

  // Leyenda discreta inferior
  const yLeyenda = alto - 4;
  svg.appendChild(crearNodoSVG('text', {
    x: xMetaMin,
    y: yLeyenda,
    'text-anchor': 'middle',
    fill: 'var(--texto, var(--tinta, #17171A))',
    'font-size': '9',
    'font-weight': '600'
  }, [`${metaMin} mín`]));

  svg.appendChild(crearNodoSVG('text', {
    x: xMetaMax,
    y: yLeyenda,
    'text-anchor': 'middle',
    fill: 'var(--sutil, var(--tinta-suave, #5D5951))',
    'font-size': '9'
  }, [`${metaMax} máx`]));

  return svg;
}

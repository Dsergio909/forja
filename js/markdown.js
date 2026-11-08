/**
 * js/markdown.js
 * Renderizador de Markdown a HTML mínimo, rápido, semántico y seguro.
 * Dirección de arte Forja v2 («Revista de sala»).
 *
 * Características:
 * - Escapa HTML de entrada (incluyendo comillas dobles y simples en atributos) para prevenir XSS.
 * - Títulos (# a ######).
 * - Negrita (**texto** o __texto__) y Cursiva (*texto* o _texto_).
 * - Código inline (`código`) y bloques de código (```lenguaje ... ```) protegidos con tokens sin guiones bajos.
 * - Listas desordenadas (*, -, +) y ordenadas (1., 2.).
 * - Tablas estilo GitHub (| col | col | con divisor |---|---|).
 * - Citas (> blockquote).
 * - Enlaces seguros (únicamente http:// y https://) con target="_blank" y rel="noopener noreferrer", soportando múltiples enlaces por línea.
 * - Soporte de notaciones científicas simples (superíndices como H^+ y subíndices como pO_2).
 * - Líneas divisorias (---, ***).
 */

/**
 * Escapa caracteres especiales de HTML (incluyendo comillas para atributos) para prevenir inyecciones XSS.
 * @param {string} str
 * @returns {string}
 */
function escaparHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Limpia y valida que una URL sea estrictamente http:// o https:// para un enlace <a>.
 * Bloquea cualquier otro protocolo (javascript:, data:, vbscript:, mailto:, etc.) y escapa comillas.
 * @param {string} url
 * @returns {string}
 */
function urlSegura(url) {
  if (!url || typeof url !== 'string') return '#';
  const limpia = url.trim();
  if (!/^https?:\/\//i.test(limpia)) {
    return '#';
  }
  return escaparHtml(limpia);
}

/**
 * Procesa el formato inline (negrita, cursiva, enlaces, código inline) de una línea de texto.
 * Utiliza marcadores %%TOKEN%% libres de guiones bajos y asteriscos para que el formateo
 * de cursivas/negritas nunca corrompa tokens de código ni múltiples enlaces en la misma línea.
 * @param {string} texto
 * @returns {string}
 */
function formatearInline(texto) {
  if (!texto) return '';

  // 1. Extraer código inline `...` para protegerlo de formateos posteriores
  const inlineCodes = [];
  let conTokens = texto.replace(/`([^`\n]+)`/g, (_m, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(`<code>${escaparHtml(code)}</code>`);
    return `%%INLINECODE${idx}%%`;
  });

  // 2. Extraer enlaces [texto](url) antes de escapar el resto del HTML (soporta varios por línea)
  const enlaces = [];
  conTokens = conTokens.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_m, txt, href, titulo) => {
    const idx = enlaces.length;
    const destino = urlSegura(href);
    const label = escaparHtml(txt);
    const attrTitulo = titulo ? ` title="${escaparHtml(titulo)}"` : '';
    enlaces.push(`<a href="${destino}"${attrTitulo} target="_blank" rel="noopener noreferrer">${label}</a>`);
    return `%%ENLACE${idx}%%`;
  });

  // 3. Escapar el resto del texto (incluyendo comillas dobles y simples)
  let res = escaparHtml(conTokens);

  // 4. Notaciones científicas simples (ej. H^+ -> H<sup>+</sup>, pO_2 -> pO<sub>2</sub>)
  res = res.replace(/([A-Za-z0-9])\^(\d*[+-]?|\+)/g, '$1<sup>$2</sup>');
  res = res.replace(/\b([A-Za-z]+)_(\d+)\b/g, '$1<sub>$2</sub>');

  // 5. Negritas y cursivas
  // Negrita + cursiva: ***texto*** o ___texto___
  res = res.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  res = res.replace(/(^|[^\w])___([^_\n]+)___(?=[^\w]|$)/g, '$1<strong><em>$2</em></strong>');

  // Negrita: **texto** o __texto__
  res = res.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  res = res.replace(/(^|[^\w])__([^_\n]+)__(?=[^\w]|$)/g, '$1<strong>$2</strong>');

  // Cursiva: *texto* o _texto_
  res = res.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  res = res.replace(/(^|[^\w])_([^_\n]+)_(?=[^\w]|$)/g, '$1<em>$2</em>');

  // Tachado: ~~texto~~
  res = res.replace(/~~([^~]+)~~/g, '<del>$1</del>');

  // 6. Restaurar enlaces (pueden contener código inline en su etiqueta si existiera)
  res = res.replace(/%%ENLACE(\d+)%%/g, (_m, idx) => enlaces[Number(idx)] || '');

  // 7. Restaurar código inline
  res = res.replace(/%%INLINECODE(\d+)%%/g, (_m, idx) => inlineCodes[Number(idx)] || '');

  return res;
}

/**
 * Convierte texto en formato Markdown a HTML seguro, estructurado y semántico.
 * @param {string} texto - Contenido en Markdown
 * @returns {string} HTML renderizado
 */
export function mdAHtml(texto) {
  if (!texto || typeof texto !== 'string') return '';

  // Normalizar saltos de línea
  const crudo = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 1. Extraer bloques de código con ``` ... ``` usando token sin guiones bajos
  const bloquesCodigo = [];
  const sinBloquesCodigo = crudo.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const idx = bloquesCodigo.length;
    const langLimpio = lang ? lang.trim() : '';
    const claseLang = langLimpio ? ` class="language-${escaparHtml(langLimpio)}"` : '';
    const bloqueHtml = `<pre><code${claseLang}>${escaparHtml(code.trimEnd())}</code></pre>`;
    bloquesCodigo.push(bloqueHtml);
    return `\n\n%%BLOQUECODIGO${idx}%%\n\n`;
  });

  const lineas = sinBloquesCodigo.split('\n');
  const total = lineas.length;
  const salida = [];
  let i = 0;

  while (i < total) {
    const linea = lineas[i];
    const lineaTrim = linea.trim();

    // Línea vacía
    if (!lineaTrim) {
      i++;
      continue;
    }

    // Placeholder de bloque de código
    const matchBloque = lineaTrim.match(/^%%BLOQUECODIGO(\d+)%%$/);
    if (matchBloque) {
      const idx = Number(matchBloque[1]);
      salida.push(bloquesCodigo[idx] || '');
      i++;
      continue;
    }

    // Encabezados (#, ##, ###, etc.)
    const matchHeader = linea.match(/^(#{1,6})\s+(.*)$/);
    if (matchHeader) {
      const nivel = matchHeader[1].length;
      const contenido = formatearInline(matchHeader[2].trim());
      salida.push(`<h${nivel}>${contenido}</h${nivel}>`);
      i++;
      continue;
    }

    // Separador horizontal (---, ***, ___)
    if (/^(?:---|\*\*\*|___)\s*$/.test(lineaTrim)) {
      salida.push('<hr />');
      i++;
      continue;
    }

    // Cita (> blockquote)
    if (linea.startsWith('>')) {
      const lineasCita = [];
      while (i < total && (lineas[i].startsWith('>') || (lineas[i].trim() && !lineas[i].startsWith('#')))) {
        if (lineas[i].startsWith('>')) {
          lineasCita.push(lineas[i].replace(/^>\s?/, ''));
        } else {
          // Continuación de párrafo dentro de la cita
          lineasCita.push(lineas[i]);
        }
        i++;
      }
      const contenidoCita = mdAHtml(lineasCita.join('\n'));
      salida.push(`<blockquote>${contenidoCita}</blockquote>`);
      continue;
    }

    // Tablas estilo GitHub (| col 1 | col 2 | ...)
    const esFilaTabla = (l) => /^\s*\|.*\|\s*$/.test(l);
    const esSeparadorTabla = (l) => /^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/.test(l);

    if (esFilaTabla(linea) && i + 1 < total && esSeparadorTabla(lineas[i + 1])) {
      const parsearCeldas = (fila) => {
        const sinExtremos = fila.trim().replace(/^\|/, '').replace(/\|$/, '');
        return sinExtremos.split('|').map((c) => c.trim());
      };

      const celdasEncabezado = parsearCeldas(lineas[i]);
      const separadores = parsearCeldas(lineas[i + 1]);

      const alineaciones = separadores.map((sep) => {
        const izq = sep.startsWith(':');
        const der = sep.endsWith(':');
        if (izq && der) return 'center';
        if (der) return 'right';
        if (izq) return 'left';
        return '';
      });

      i += 2; // Saltar encabezado y divisor

      const filasDatos = [];
      while (i < total && esFilaTabla(lineas[i])) {
        const celdas = parsearCeldas(lineas[i]);
        filasDatos.push(celdas);
        i++;
      }

      let tablaHtml = '<div class="tabla-scroll"><table class="tabla-md">\n<thead>\n<tr>\n';
      celdasEncabezado.forEach((th, cIdx) => {
        const align = alineaciones[cIdx] ? ` style="text-align:${alineaciones[cIdx]}"` : '';
        tablaHtml += `  <th${align}>${formatearInline(th)}</th>\n`;
      });
      tablaHtml += '</tr>\n</thead>\n<tbody>\n';

      filasDatos.forEach((fila) => {
        tablaHtml += '<tr>\n';
        fila.forEach((td, cIdx) => {
          const align = alineaciones[cIdx] ? ` style="text-align:${alineaciones[cIdx]}"` : '';
          tablaHtml += `  <td${align}>${formatearInline(td)}</td>\n`;
        });
        tablaHtml += '</tr>\n';
      });

      tablaHtml += '</tbody>\n</table></div>';
      salida.push(tablaHtml);
      continue;
    }

    // Listas desordenadas (*, -, +)
    const matchUl = linea.match(/^(\s*)([-*+])\s+(.*)$/);
    if (matchUl) {
      let listaHtml = '<ul>\n';
      while (i < total) {
        const m = lineas[i].match(/^(\s*)([-*+])\s+(.*)$/);
        if (m) {
          listaHtml += `  <li>${formatearInline(m[3])}</li>\n`;
          i++;
        } else if (lineas[i].trim() && (lineas[i].startsWith('  ') || lineas[i].startsWith('\t'))) {
          listaHtml = listaHtml.replace(/<\/li>\n$/, ` ${formatearInline(lineas[i].trim())}</li>\n`);
          i++;
        } else {
          break;
        }
      }
      listaHtml += '</ul>';
      salida.push(listaHtml);
      continue;
    }

    // Listas ordenadas (1., 2., ...)
    const matchOl = linea.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (matchOl) {
      let listaHtml = '<ol>\n';
      while (i < total) {
        const m = lineas[i].match(/^(\s*)(\d+)\.\s+(.*)$/);
        if (m) {
          listaHtml += `  <li>${formatearInline(m[3])}</li>\n`;
          i++;
        } else if (lineas[i].trim() && (lineas[i].startsWith('  ') || lineas[i].startsWith('\t'))) {
          listaHtml = listaHtml.replace(/<\/li>\n$/, ` ${formatearInline(lineas[i].trim())}</li>\n`);
          i++;
        } else {
          break;
        }
      }
      listaHtml += '</ol>';
      salida.push(listaHtml);
      continue;
    }

    // Párrafos regulares
    const lineasParrafo = [];
    while (i < total) {
      const cur = lineas[i];
      const curTrim = cur.trim();
      if (!curTrim) break;
      if (curTrim.match(/^%%BLOQUECODIGO\d+%%$/)) break;
      if (cur.match(/^(#{1,6})\s+/)) break;
      if (/^(?:---|\*\*\*|___)\s*$/.test(curTrim)) break;
      if (cur.startsWith('>')) break;
      if (esFilaTabla(cur)) break;
      if (cur.match(/^(\s*)([-*+])\s+/)) break;
      if (cur.match(/^(\s*)(\d+)\.\s+/)) break;

      lineasParrafo.push(formatearInline(curTrim));
      i++;
    }

    if (lineasParrafo.length > 0) {
      salida.push(`<p>${lineasParrafo.join('<br />\n')}</p>`);
    }
  }

  return salida.join('\n');
}

/* ==========================================================================
   FORJA - Librería de Iconos SVG Vectoriales (js/iconos.js)
   Trazo uniforme 1.75 redondeado, sin dependencias externas ni emojis.
   Diseñado específicamente para la dirección de arte Forja v2 (Revista de sala).
   ========================================================================== */

const DICCIONARIO_ICONOS = {
  // 1. hoy (calendario activo de la portada)
  hoy: '<rect x="3" y="4" width="18" height="18" rx="4"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="12" cy="15" r="1.5" fill="currentColor"/>',

  // 2. registrar (lápiz / registro de entrenamiento)
  registrar: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',

  // 3. progreso (columnas / barras de evolución)
  progreso: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',

  // 4. cuerpo (silueta corporal humana)
  cuerpo: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',

  // 5. guia (libro abierto / atlas técnico)
  guia: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="9" y1="7" x2="16" y2="7"/><line x1="9" y1="11" x2="14" y2="11"/>',

  // 6. coach (bocadillo de diálogo y asesoría)
  coach: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8.5z"/>',

  // 7. ajustes (engranaje de configuración)
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',

  // 8. mas (suma / agregar serie o kg)
  mas: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',

  // 9. menos (resta / decrementar)
  menos: '<line x1="5" y1="12" x2="19" y2="12"/>',

  // 10. check (confirmación / éxito)
  check: '<polyline points="20 6 9 17 4 12"/>',

  // 11. flecha (navegación siguiente / botón lima)
  flecha: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',

  // 12. atras (volver / retroceder)
  atras: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',

  // 13. camara (análisis de técnica / pose)
  camara: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',

  // 14. comida (registro nutricional / cubiertos)
  comida: '<path d="M18 2v20M18 2a4 4 0 0 1 4 4v4h-4M6 2v6a3 3 0 0 0 6 0V2M9 11v11"/>',

  // 15. agua (hidratación diaria / gota)
  agua: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',

  // 16. proteina (nutrición muscular / aminoácidos)
  proteina: '<path d="M12 3c-4.5 0-8 3.5-8 8 0 5 4 8 8 10 4-2 8-5 8-10 0-4.5-3.5-8-8-8z"/><path d="M9 10a3 3 0 1 0 6 0"/>',

  // 17. fuego (calorías / intensidad / racha)
  fuego: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z"/>',

  // 18. reloj (tiempo / cronómetro / descanso)
  reloj: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/>',

  // 19. trofeo (récord personal / PR)
  trofeo: '<path d="M6 9H4a2 2 0 0 1-2-2V5h4M18 9h2a2 2 0 0 0 2-2V5h-4"/><path d="M6 4h12v6a6 6 0 0 1-12 0V4z"/><path d="M12 16v4M8 20h8"/>',

  // 20. pesa (entrenamiento / mancuerna)
  pesa: '<line x1="6" y1="5" x2="6" y2="19"/><line x1="18" y1="5" x2="18" y2="19"/><line x1="2" y1="12" x2="22" y2="12"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="12" r="3"/>',

  // 21. microfono (dictado por voz de series)
  microfono: '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>',

  // 22. foto (galería corporal de progreso)
  foto: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',

  // 23. buscar (búsqueda de ejercicios y alimentos)
  buscar: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',

  // 24. cerrar (aspa / descartar modal)
  cerrar: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',

  // 25. editar (modificar series o notas)
  editar: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',

  // 26. borrar (eliminar serie / papelera)
  borrar: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',

  // 27. play (reproducir video de técnica)
  play: '<polygon points="6 4 20 12 6 20 6 4"/>',

  // 28. pausa (detener temporizador / video)
  pausa: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',

  // 29. info (información / ayuda)
  info: '<circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12.01" y2="8"/><line x1="12" y1="12" x2="12" y2="16"/>',

  // 30. calendario (vista mensual de entrenamientos)
  calendario: '<rect x="3" y="4" width="18" height="18" rx="4"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="8.01" y2="14"/><line x1="12" y1="14" x2="12.01" y2="14"/><line x1="16" y1="14" x2="16.01" y2="14"/><line x1="8" y1="17" x2="8.01" y2="17"/><line x1="12" y1="17" x2="12.01" y2="17"/>',

  // 31. escala (peso corporal en ayunas / báscula)
  escala: '<path d="M12 3v18M5 7l7-3 7 3"/><path d="M5 7 2 14a3 3 0 0 0 6 0L5 7zm14 0-3 7a3 3 0 0 0 6 0l-3-7z"/>',

  // 32. regla (medidas corporales de contorno)
  regla: '<path d="M21.3 8.7 8.7 21.3a2 2 0 0 1-2.8 0L2.7 18a2 2 0 0 1 0-2.8L15.3 2.7a2 2 0 0 1 2.8 0L21.3 6a2 2 0 0 1 0 2.7z"/><path d="m7.5 10.5 2 2m-4-1 2 2m4-5 2 2m2-1 2 2"/>',

  // 33. chispa (destello de tiza / acento forja)
  chispa: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3z"/>'
};

const SVG_CIRCULO_DEFECTO = '<circle cx="12" cy="12" r="9"/>';

/**
 * Devuelve un elemento DOM <svg> con trazo 1.75 y extremos redondeados.
 * Si el nombre no existe en el catálogo, devuelve un círculo.
 * @param {string} nombre Nombre del icono solicitado
 * @param {number} [tam=22] Tamaño en píxeles (ancho y alto)
 * @returns {SVGElement} Elemento SVG listo para insertar en el DOM
 */
// Sinónimos que usan las pantallas (7-nov) → ícono existente.
const ALIAS_ICONOS = {
  basura: 'borrar', 'flecha-der': 'flecha', 'flecha-derecha': 'flecha', 'flecha-izq': 'atras',
  'flecha-izquierda': 'atras', mancuerna: 'pesa', pesas: 'pesa', libro: 'guia', lista: 'registrar',
  tendencia: 'progreso', reps: 'registrar', foco: 'chispa', cambiar: 'rotar',
  'chevron-der': 'flecha', 'chevron-izq': 'atras', der: 'flecha', izq: 'atras', retroceso: 'atras',
  cruz: 'cerrar', gota: 'agua', plato: 'comida', perfil: 'cuerpo', mano: 'pesa', ia: 'chispa',
  disco: 'descargar', ojo: 'info', candado: 'escudo',
};
// Íconos agregados (mismo estilo: trazo 1,75, redondeado, rejilla 24).
const EXTRA_ICONOS = {
  alerta: '<path d="M12 4 3 20h18L12 4Z"/><path d="M12 10v4"/><path d="M12 17h.01"/>',
  'chevron-abajo': '<path d="m6 9 6 6 6-6"/>',
  'chevron-arriba': '<path d="m6 15 6-6 6 6"/>',
  descargar: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
  subir: '<path d="M12 20V9"/><path d="m7 14 5-5 5 5"/><path d="M5 4h14"/>',
  enviar: '<path d="M4 12 20 4l-6 16-3-7-7-1Z"/>',
  qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2"/>',
  rotar: '<path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 20v-5h5"/>',
  carpeta: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>',
  escudo: '<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
};

export function icono(nombre, tam = 22) {
  // Acepta un número (tamaño) o un objeto {tam, class|clase, color, trazo} (algunas pantallas lo llaman así).
  const op = (tam && typeof tam === 'object') ? tam : { tam };
  const lado = Number(op.tam) > 0 ? Number(op.tam) : 22;
  let clave = String(nombre || '').trim().toLowerCase().replace(/_/g, '-');
  clave = ALIAS_ICONOS[clave] || clave;
  const contenido = DICCIONARIO_ICONOS[clave] || EXTRA_ICONOS[clave] || SVG_CIRCULO_DEFECTO;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(lado));
  svg.setAttribute('height', String(lado));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', op.color || 'currentColor');
  svg.setAttribute('stroke-width', String(op.trazo || 1.75));
  if (op.class || op.clase) String(op.class || op.clase).split(/\s+/).filter(Boolean).forEach((c) => svg.classList.add(c));
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.classList.add('icono-svg');
  svg.dataset.icono = clave;

  svg.innerHTML = contenido;
  return svg;
}

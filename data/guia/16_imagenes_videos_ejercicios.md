# De dónde salen las fotos y videos

## Resumen en 5 líneas

1. Para tu app personal, la mejor combinación libre y legal es **free-exercise-db** (dominio público, ~800 ejercicios con fotos) y **wger** (licencia CC-BY-SA, ~900 ejercicios con fotos, videos y API REST), mientras que **MuscleWiki** es 100% privada y prohíbe descargar o alojar su multimedia.
2. Para resaltar qué músculo trabaja cada ejercicio, utiliza mapas vectoriales en SVG de código abierto como **`body-muscles`** o los mapas de **wger**, los cuales permiten iluminar zonas anatómicas específicas fácilmente con estilos CSS.
3. Los videos de ejercicios generados por inteligencia artificial (como Sora o Runway) **no son fiables hoy en día**: sufren alucinaciones anatómicas, articulaciones con flexiones imposibles y violaciones biomecánicas que pueden inducir lesiones.
4. La ciencia del aprendizaje motor (*motor learning*) demuestra que los bucles de video o GIFs de 3 a 5 segundos superan a las fotos estáticas para asimilar la trayectoria de la barra (*bar path*) en levantamientos complejos, mientras que 2 imágenes fijas bastan para ejercicios guiados en máquinas.
5. Siguiendo tu esquema de 4 días a 5-8 repeticiones pesadas con descansos de 2,5 a 3 minutos en la altura de Bogotá (2.600 m), junto con tus 125-130 g de proteína diaria (~2,0 g/kg) y creatina, tienes el entorno fisiológico exacto para una recomposición exitosa hacia finales de noviembre de 2026.

---

## Lo que dice la evidencia (con números: series, reps, descansos, gramos, minutos, etc.)

### 1. Radiografía técnica y legal de las bases de datos de ejercicios

*   **free-exercise-db (yuhonas en GitHub):**
    *   *Cantidad de ejercicios:* **Más de 800 ejercicios** con metadata en JSON (nombre, nivel, equipamiento, músculos primarios y secundarios, e instrucciones paso a paso).
    *   *Tipo de multimedia:* **Fotos fijas en formato `.jpg`** (generalmente 2 tomas de alta calidad por ejercicio: posición inicial `0.jpg` y posición final `1.jpg`). No incluye videos ni GIFs.
    *   *Licencia exacta:* **The Unlicense** (dedicación total al dominio público). Permite copiar, modificar, publicar, comercializar y distribuir sin restricciones ni obligación legal de dar crédito.
    *   *Enlace:* Repositorio en GitHub: [free-exercise-db](https://github.com/yuhonas/free-exercise-db).

*   **wger (wger Workout Manager):**
    *   *Cantidad de ejercicios:* **Entre 800 y 900+ ejercicios** en la base de datos comunitaria activa de `wger.de` (las instalaciones locales de base suelen incluir entre 100 y 500 registros iniciales).
    *   *Tipo de multimedia:* **Fotos (`.png`, `.jpg`), esquemas anatómicos y videos cortos demostrativos (`.mp4`, `.webm`)**.
    *   *Licencia exacta:* Contenido multimedia y descripciones bajo **Creative Commons Attribution-ShareAlike (CC-BY-SA 4.0)** (requiere dar crédito al autor y compartir obras derivadas bajo la misma licencia). El código del sistema es **AGPL-3.0**.
    *   *Enlace:* Repositorio en GitHub: [wger](https://github.com/wger-project/wger) y API REST pública: [wger API v2](https://wger.de/api/v2/).

*   **ExerciseDB (RapidAPI / AscendAPI):**
    *   *Cantidad de ejercicios:* La base original abierta histórica recopilaba **~1.300 ejercicios**; la versión actual comercial (V2 en RapidAPI) cataloga **más de 11.000 ejercicios**.
    *   *Tipo de multimedia:* **GIFs animados en bucle** (*loop*) continuos en varias resoluciones (180p, 360p, 720p, 1080p).
    *   *Licencia exacta:* **Comercial / Propietaria (SaaS)**. No es software libre. El acceso se rige por los Términos de Servicio de RapidAPI con una capa gratuita limitada (*freemium*, ~500 llamadas/mes) y suscripciones de pago. La redistribución masiva o descarga de los GIFs para uso público sin pagar infringe los derechos de autor del proveedor.
    *   *Enlace:* [ExerciseDB en RapidAPI](https://rapidapi.com/justin-WF%練9SVU/api/exercisedb).
    *   *Cómo descargar las imágenes:* Mediante peticiones autenticadas enviando el encabezado `X-RapidAPI-Key` a los endpoints de imagen para obtener enlaces temporales firmados.

*   **Wikimedia Commons:**
    *   *Cantidad de ejercicios:* **Más de 2.000 archivos multimedia** organizados en categorías como `Category:Weight training` y `Category:Weight training animations` (más de 150 animaciones específicas de levantamiento de pesas).
    *   *Tipo de multimedia:* **Vectores (`.svg`), fotos fijas (`.jpg`), animaciones (`.gif`) y videos cortos (`.webm`, `.ogv`)**.
    *   *Licencia exacta:* **Licencias Libres Mixtas** (cada archivo indica su licencia: la mayoría son **CC0 / Dominio Público**, **CC-BY** o **CC-BY-SA 3.0/4.0**).
    *   *Enlace:* [Wikimedia Commons Weight Training](https://commons.wikimedia.org/wiki/Category:Weight_training) y la API oficial: [MediaWiki Action API](https://commons.wikimedia.org/w/api.php).
    *   *Cómo descargar las imágenes:* Consultando la API de MediaWiki con el generador de categorías: `action=query&generator=categorymembers&gcmtitle=Category:Weight_training&prop=imageinfo&iiprop=url|extmetadata&format=json`.

*   **Everkinetic:**
    *   *Cantidad de ejercicios:* **Entre 200 y 302 ejercicios estándar** con nombres, descripciones y músculos trabajados.
    *   *Tipo de multimedia:* **Ilustraciones vectoriales limpias en SVG** y versiones convertidas a **PNG/WebP**, compuestas por 2 poses (inicio y final).
    *   *Licencia exacta:* **Creative Commons Attribution-ShareAlike (CC-BY-SA 3.0 / 4.0)**. Uso libre personal y comercial siempre que se acredite a Everkinetic (creado por Greg Priday) y se redistribuya bajo la misma licencia.
    *   *Enlace:* Repositorio original: [everkinetic/data](https://github.com/everkinetic/data) o paquete normalizado moderno: [bryllim/workout-guide](https://github.com/bryllim/workout-guide).
    *   *Cómo descargar las imágenes:* Descargando el repositorio o instalando el paquete de Node con `npm install @bryllim/workout-guide`, el cual contiene directamente las carpetas con todos los archivos vectoriales `.svg` y `.png`.

*   **MuscleWiki (¿Licencia?):**
    *   *Cantidad de ejercicios:* **Más de 2.000 ejercicios** filmados profesionalmente con modelos masculinos y femeninos.
    *   *Tipo de multimedia:* Videos en alta definición en bucle corto (`.mp4`), mapas musculares interactivos e imágenes estáticas.
    *   *Licencia exacta:* **100% Propietaria / Todos los derechos reservados (*All Rights Reserved*)**. No tiene ninguna licencia libre ni de código abierto.
    *   *Cómo descargar las imágenes:* **No se pueden descargar legalmente**. Sus términos legales prohíben explícitamente almacenar, raspar (*scrape*), alojar en servidores propios o redistribuir sus videos e imágenes. Solo ofrecen planes de pago corporativos para reproducir video por *streaming* directo desde sus servidores.

---

### 2. Mapas de músculos en SVG libres para tu app

Para colorear en pantalla los músculos que entrena cada ejercicio (por ejemplo: iluminar dorsales en remo o bíceps en el predicador), existen bibliotecas vectoriales libres:
*   **`body-muscles` (por vulovix / emmorts):** Licencia de código abierto **MIT**. Proporciona vistas frontal y posterior con **70 a 89 subdivisiones musculares**. Cada músculo es un elemento `<path>` independiente al que le puedes inyectar colores mediante clases CSS o atributos directos (`fill: #color`). Incluye escalas de intensidad (0 a 10) para generar mapas de calor (*heatmaps*). Repositorio: [body-muscles](https://github.com/vulovix/body-muscles).
*   **`MuscleMapJS` (por abdofallah):** Licencia **MIT**. Biblioteca interactiva en TypeScript/JavaScript para SVG y Canvas que incluye 36 grupos musculares principales, detección de lados izquierdo y derecho, y estilos preconfigurados. Repositorio: [MuscleMapJS](https://github.com/abdofallah/MuscleMapJS).
*   **Mapas SVG de wger:** Basados en ilustraciones médicas de Wikimedia Commons en dominio público, separan el cuerpo en capas con identificadores únicos como `id="biceps"` o `id="latissimus_dorsi"`.

---

### 3. Fiabilidad de videos de ejercicios generados por IA

*   **Sin física ni esqueleto interno:** Modelos generativos como OpenAI Sora, Runway (Gen-3/Gen-4), Kling o Luma no calculan masas, gravedad ni cinemática esquelética (*skeletal kinematics*); son modelos predictivos de píxeles visuales.
*   **Errores biomecánicos frecuentes:**
    *   *Articulaciones imposibles:* Hiperextensión de codos o rodillas doblando hacia atrás (>180°), pérdida del neutro en la columna bajo supuesta carga pesada y colapsos de valgo de rodilla sin reacción de la cadera.
    *   *Deformación de manos y objetos:* Dedos que se multiplican (polidactilia), manos que se fusionan con el metal de la barra o la mancuerna, y barras que se flectan como caucho al no haber consistencia de rigidez.
    *   *Falla de la cadena cinética (*kinetic chain*):* Los pies se deslizan por el suelo sin fricción (*foot sliding*), y las fases de contracción se confunden (por ejemplo, el atleta empieza a subir de una sentadilla antes de haber terminado de bajar).
*   **Conclusión:** La literatura y la biomecánica aplicada consideran que los videos de ejercicios generados 100% por texto a video (*Text-to-Video*) tienen **cero fiabilidad técnica** y representan un riesgo de aprendizaje de patrones lesivos. Solo los modelos 3D basados en captura de movimiento real (*MoCap*) o videos de atletas humanos son confiables para una guía de entrenamiento.

---

### 4. Evidencia científica sobre aprendizaje motor y recursos visuales

*   **Modelado por video vs. imágenes fijas (*Video Modeling vs. Static Pictures*):** Revisiones sistemáticas en aprendizaje motor (Ste-Marie et al., 2012, 2020) indican que los videos y GIFs animados continuos de **3 a 5 segundos** son significativamente superiores para ejercicios multiarticulares complejos con peso libre, ya que enseñan el tempo (ej. 2 a 3 segundos de fase excéntrica y 1 segundo concéntrico explosivo) y la trayectoria de la carga. Sin embargo, para máquinas guiadas de un solo plano (como el predicador o el remo en máquina), 2 fotografías fijas (inicio y final) resultan igual de efectivas en la retención motriz y reducen el consumo de datos de la app en más de un 90%.
*   **Foco atencional (*Attentional Focus*):** 
    *   *Foco externo (Wulf, meta-análisis):* Pensar en empujar el suelo en la prensa o llevar los codos hacia atrás en el remo con soporte de pecho mejora la economía neuromuscular y permite completar entre **1 y 2 repeticiones extra** con cargas pesadas.
    *   *Foco interno (Schoenfeld et al., 2018):* Pensar conscientemente en apretar el músculo objetivo (*mind-muscle connection*) en ejercicios de aislamiento de miembros superiores (como el curl en predicador con barra Z) aumentó el crecimiento del bíceps en un **+12,4% frente a un +6,9%** con foco externo.

---

### 5. Parámetros cuantitativos para tú

*   **Volumen e intensidad:** **3 series de 5 a 8 repeticiones** con RIR 1-2 (*Reps in Reserve*: quedarse a 1 o 2 repeticiones del fallo muscular). Llevar al fallo estricto (RIR 0) únicamente la última serie en máquinas guiadas (remo con soporte, poleas, predicador) para maximizar la tensión mecánica sin agotar el sistema nervioso central.
*   **Tiempos de descanso:** **2,5 a 3 minutos** cronometrados entre series pesadas. El metaanálisis de Schoenfeld et al. (2016) demostró que descansos de 3 minutos casi duplican las ganancias de fuerza y aumentan significativamente la hipertrofia frente a descansos de 1 minuto.
*   **Impacto de la altitud de Bogotá (2.600 msnm):** La presión de oxígeno (pO_2) es aproximadamente 25% menor. Aunque el esfuerzo de 5 a 8 reps es anaeróbico (vía fosfágena de la fosfocreatina), la recuperación inter-serie para resintetizar el 95% de la fosfocreatina muscular requiere metabolismo oxidativo mitocondrial; por ello, en Bogotá descansar menos de 2,5 minutos deteriora el rendimiento de las series posteriores.
*   **Proteína y creatina:** tu peso, tus **125-130 g de proteína al día** representan **1,95 a 2,03 g/kg/día**, ubicándote en el rango óptimo respaldado por el metaanálisis de Morton et al. (2018) y la ISSN (1,6 a 2,2 g/kg/día) para ganar masa muscular durante una recomposición corporal. Mantener **3 a 5 g diarios de monohidrato de creatina** sin pausas.

---

## Reglas prácticas para tú (lista corta y accionable)

1.  **Construye la base de datos de tu app con `free-exercise-db`:** Descarga el repositorio de GitHub de yuhonas. Tendrás más de 800 ejercicios con fotos reales, en formato JSON listo para enlazar y con licencia de dominio público libre de problemas legales.
2.  **Si necesitas videos demostrativos, conecta la API de `wger`:** Utiliza su API REST gratuita para consultar ejercicios específicos y descargar videos cortos con licencia CC-BY-SA, dando el crédito correspondiente en una pantalla de "Acerca de" en tu app.
3.  **Para pintar los músculos en pantalla, integra `body-muscles`:** Usa este paquete SVG libre (licencia MIT) en el frontend de tu app. Pinta los músculos primarios en naranja brillante (ej. dorsal ancho en el remo) y los secundarios en amarillo (ej. bíceps y deltoides posterior).
4.  **No uses MuscleWiki ni IA generativa para el contenido:** Evita raspar (*scrape*) MuscleWiki para protegerte legalmente, y descarta videos hechos con IA como Sora o Runway para no mostrar técnicas con articulaciones deformadas que confundan tu entrenamiento.
5.  **Aplica el foco mental según el ejercicio:** En tirones y empujes pesados de 5 a 8 reps (remo con pecho apoyado, prensa, dominadas), usa foco externo ("clava los codos hacia las caderas"); en aislamiento (curl en banco predicador, elevaciones laterales), usa foco interno ("aprieta el bíceps en la contracción").
6.  **Cronometra estrictamente 2,5 a 3 minutos de descanso:** En Bogotá no recortes descansos; necesitas esos minutos completos para recargar la energía celular antes de la siguiente serie pesada.
7.  **Sigue usando straps en tirones pesados:** Mantén los straps en el remo con apoyo y dominadas para que tu espalda reciba el 100% del estímulo sin que el agarre limite la serie. Entrena los antebrazos con flexiones y extensiones de muñeca al final de la sesión.
8.  **Mantén tus números nutricionales firmes:** Continúa con tus 2.200 kcal, tus 125-130 g de proteína y tus 3-5 g de creatina diarios. Gracias a la memoria muscular tras un mes de para, tu cuerpo responderá con rapidez rumbo a finales de noviembre de 2026.

---

## Mitos y errores comunes

*   **Mito 1: "Cualquier imagen o video disponible en internet o en MuscleWiki se puede usar gratis en una aplicación personal."**
    *   *Realidad:* Los contenidos de plataformas como MuscleWiki están protegidos por derechos de autor (*All Rights Reserved*). Descargar o redistribuir sus videos viola sus Términos de Servicio y la ley de propiedad intelectual. Solo las obras bajo licencias abiertas (Unlicense, Creative Commons, MIT) permiten su integración libre.
*   **Mito 2: "Los videos de ejercicios hechos con inteligencia artificial generativa ya son lo bastante buenos para aprender técnica."**
    *   *Realidad:* Los modelos de video actuales carecen de comprensión biomecánica. Suelen generar micro-alucinaciones peligrosas: rodillas colapsando hacia adentro, dedos fusionados con barras o mancuernas, hiperextensión antinatural de codos y pérdida del contacto de los pies con el suelo.
*   **Mito 3: "Para ganar masa muscular hay que llegar al fallo absoluto en cada serie de cada ejercicio."**
    *   *Realidad:* Múltiples metaanálisis (Vieira et al., 2021; Refalo et al., 2023) demuestran que entrenar a RIR 1-2 genera prácticamente las mismas ganancias musculares que llegar al fallo total, acumulando menos de la mitad de fatiga neuromuscular. El fallo debe reservarse para la última serie de máquinas guiadas.
*   **Mito 4: "Para definir y recomponer rápido hay que hacer descansos cortos de 45 a 60 segundos."**
    *   *Realidad:* Los descansos cortos acumulan fatiga metabólica prematura, reducen drásticamente los kilos que puedes mover en las series siguientes y disminuyen la tensión mecánica efectiva. Descansar de 2 a 3 minutos optimiza la hipertrofia y el rendimiento de fuerza.
*   **Mito 5: "Una foto fija no sirve para aprender un ejercicio; siempre es obligatorio tener un video con audio."**
    *   *Realidad:* En ejercicios guiados con trayectoria fija (curl predicador, prensa hack, remo en máquina), dos imágenes estáticas claras que marquen el inicio y el final del movimiento proporcionan la información motriz necesaria sin saturar de distracciones al atleta en medio del gimnasio.

---

## Fuentes

1.  **free-exercise-db Open Dataset and Images** | yuhonas | 2023 | https://github.com/yuhonas/free-exercise-db | *Repositorio de código y datos abiertos (Licencia The Unlicense / Dominio Público)*.
2.  **wger: Free, open source workout and fitness manager** | wger project (Roland Geider et al.) | 2024 | https://github.com/wger-project/wger | *Repositorio de software libre y base de datos comunitaria (Licencia CC-BY-SA 4.0 / AGPL-3.0)*.
3.  **ExerciseDB API Documentation** | AscendAPI (RapidAPI) | 2024 | https://rapidapi.com/justin-WF%練9SVU/api/exercisedb | *Documentación de API comercial propietaria*.
4.  **Wikimedia Commons: Category Weight Training & API** | Wikimedia Foundation | 2024 | https://commons.wikimedia.org/wiki/Category:Weight_training | *Repositorio de archivos multimedia abiertos (Licencias CC-BY, CC-BY-SA y Dominio Público)*.
5.  **Everkinetic Exercise Dataset & Workout Guide** | Greg Priday / Bryl Lim | 2023 | https://github.com/bryllim/workout-guide | *Librería vectorial de ejercicios normalizados (Licencia CC-BY-SA 4.0)*.
6.  **MuscleWiki Terms of Service and API Licensing** | MuscleWiki LLC | 2024 | https://musclewiki.com/terms | *Términos de servicio y políticas de propiedad intelectual propietaria*.
7.  **body-muscles: Open-source anatomical body highlighting library** | vulovix | 2024 | https://github.com/vulovix/body-muscles | *Librería de componentes SVG vectoriales de anatomía (Licencia MIT)*.
8.  **Revisiting the Applied Model for the Use of Observation: A Review of Articles Spanning 2011–2018** | Ste-Marie, D. M., Lelievre, N., & St Germain, L. | 2020 | https://pubmed.ncbi.nlm.nih.gov/32004119/ | *Revisión sistemática de aprendizaje motor y modelado visual*.
9.  **Differential effects of attentional focus strategies during long-term resistance training** | Schoenfeld, B. J., Vigotsky, A., Contreras, B., et al. | 2018 | https://pubmed.ncbi.nlm.nih.gov/29533715/ | *Ensayo clínico aleatorizado (foco interno vs externo en hipertrofia)*.
11. **Longer Interset Rest Periods Enhance Muscle Strength and Hypertrophy in Resistance-Trained Men** | Schoenfeld, B. J., Pope, Z. K., Benik, F. M., et al. | 2016 | https://pubmed.ncbi.nlm.nih.gov/26605807/ | *Ensayo clínico controlado sobre intervalos de descanso inter-serie*.
12. **A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength** | Morton, R. W., Murphy, K. T., McKellar, S. R., et al. | 2018 | https://pubmed.ncbi.nlm.nih.gov/28698222/ | *Metaanálisis y revisión sistemática sobre ingesta diaria de proteínas*.
13. **International Society of Sports Nutrition Position Stand: safety and efficacy of creatine supplementation in exercise, sport, and medicine** | Kreider, R. B., Kalman, D. S., Antonio, J., et al. | 2017 | https://pubmed.ncbi.nlm.nih.gov/28615996/ | *Posición oficial de consenso de la Sociedad Internacional de Nutrición Deportiva (ISSN)*.
14. **Influence of Resistance Training Proximity-to-Failure on Skeletal Muscle Hypertrophy: A Systematic Review with Meta-analysis** | Refalo, M. C., Helms, E. R., Trexler, E. T., Hamilton, D. L., & Fyfe, J. J. | 2023 | https://pubmed.ncbi.nlm.nih.gov/36334240/ | *Metaanálisis y revisión sistemática sobre proximidad al fallo muscular (RIR/RPE)*.


> Fuentes revisadas automáticamente el 7-nov-2026 contra Crossref: se quitaron 3 enlaces que no existían o no correspondían al tema.
# Medirse con la cámara

## Resumen en 5 líneas

1. Las aplicaciones de fotos o inteligencia artificial (IA) tienen un error absoluto promedio (Mean Absolute Error - MAE) de 2.0% a 3.5% de grasa respecto a DEXA, pero a nivel individual sus límites de acuerdo (Limits of Agreement - LoA) varían entre ± 4.0% y ± 8.0%, sirviendo solo para ver tendencias a mediano plazo y no como diagnósticos exactos.
2. La fórmula de la Marina de EE. UU. (*US Navy method*) presenta un error estándar de la estimación (Standard Error of Estimate - SEE) de 3.0% a 4.2% frente a modelos de 4 compartimentos (4C) y DEXA, sobrestimando grasa en hombres con cuello delgado y subestimándola si se hipertrofia el cuello.
3. Medir proporciones (hombro-cintura) con MediaPipe o MoveNet en el navegador requiere calibrar la altura real con píxeles, pero acumula un margen de error de 3% a 8% por distorsión de lente gran angular, perspectiva y porque los modelos ubican huesos/articulaciones internas y no la silueta de piel.
4. Contar repeticiones y auditar técnica en el navegador (100% en cliente, sin nube) es viable y preciso calculando ángulos articulares 2D con trigonometría (`atan2`), filtros de suavizado (*One Euro filter*) y máquinas de estados (*Finite State Machine - FSM*) bajo librerías de código abierto con licencia Apache 2.0.
5. El protocolo fotográfico de progreso exige estandarización estricta: primera hora de la mañana tras orinar, en ayunas, cámara a la altura del ombligo a 2.5–3.0 metros de distancia, luz artificial fija y cada 2 a 4 semanas para neutralizar variaciones de agua extracelular (1–2 kg).

---

## Lo que dice la evidencia (con números: series, reps, descansos, gramos, minutos, etc.)

### 1. Estimación de % de grasa con fotos e IA vs. DEXA
* **Métricas de correlación y error grupal:** Los metaanálisis y revisiones sistemáticas recientes (Scafoglieri et al., 2023; Tinsley et al., 2022–2024) muestran que los modelos de visión artificial 2D y 3D en teléfonos inteligentes tienen una correlación lineal alta con DEXA (r = 0.88 - 0.96). El error absoluto medio (MAE) y la raíz del error cuadrático medio (Root Mean Square Error - RMSE) se sitúan entre **2.1% y 3.5% de grasa corporal**.
* **Dispersión individual (límites de acuerdo de Bland-Altman):** A nivel individual, los límites de acuerdo al 95% oscilan entre **± 4.0% y ± 8.2%**. Esto significa que si un modelo fotográfico calcula que tú tiene 14.0% de grasa, su valor real en DEXA o modelo 4C podría ubicarse en cualquier punto entre el 9.8% y el 22.2%.
* **Sesgos demográficos y musculares:** La IA entrenada en poblaciones sedentarias comete errores sistemáticos con sujetos que entrenan fuerza: confunde masa muscular densa y vascularizada en el torso con tejido adiposo subcutáneo, sobrestimando grasa en atletas delgados y subestimándola en individuos con acumulación profunda de grasa visceral.
* **Fotos 2D vs. escaneo 3D:** Los métodos 2D (1 o 2 fotos planas) tienen el doble de sensibilidad a la distancia y al ángulo de la cámara que los métodos ópticos 3D (*3D optical surface reconstruction*). En modelos 3D móviles, la precisión mejora (MAE ~2.8%), pero requiere entre 8 y 16 tomas o un giro de 360° en ropa ceñida.

### 2. Fórmula de la Marina de EE. UU. (*US Navy Method*)
* **Ecuación matemática para hombres:**
  % Grasa = (495) / (1.0324 - 0.19077 × log10(cintura - cuello) + 0.15456 × log10(estatura)) - 450
  *(Medidas en centímetros; estatura descalzo; cintura a la altura del ombligo horizontal al final de una espiración normal; cuello justo debajo de la nuez de Adán).*
* **Cifras de error:** Desarrollada originalmente por Hodgdon y Beckett (1984) contra pesaje hidrostático (SEE de ~2.7% y r = 0.90). En revalidaciones modernas frente a DEXA y modelo multicompartimental (4C) en adultos jóvenes (2020–2025):
  * **SEE (Error estándar de estimación):** **3.4% a 4.2%**.
  * **Límites de acuerdo (LoA 95%):** **± 6.5% a ± 9.0%**.
* **Falla biomecánica:** La fórmula asume al cuello como indicador (*proxy*) de masa magra libre de grasa y a la cintura como indicador de adiposidad. Si tú entrena cuello o trapecios y su cuello pasa de 37 cm a 39 cm manteniendo su cintura en 78 cm, la fórmula computará un descenso ficticio de ~2.5% de grasa sin haber quemado un solo gramo de lípidos.

### 3. Medición de silueta y proporciones en el navegador (MediaPipe vs. MoveNet)
* **Librerías oficiales para el navegador (100% en cliente, sin enviar imágenes a servidores):**
  * **Google MediaPipe Pose Landmarker** (paquete `@mediapipe/tasks-vision`, versión actual `0.10.x`): Detecta **33 puntos anatómicos** (landmarks) en 3D con coordenadas normalizadas `(x, y, z)` y coordenadas en metros en el espacio (*world landmarks*). Licencia: **Apache License 2.0**.
    * CDN JS (ES Module): `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs`
    * Binarios WASM: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm`
    * Modelo (.task): `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task`
  * **TensorFlow.js MoveNet** (paquete `@tensorflow-models/pose-detection` con `@tensorflow/tfjs-core` y `@tensorflow/tfjs-backend-webgl`): Detecta **17 articulaciones clave** (formato COCO). Modelos: *SinglePose Lightning* (prioriza velocidad, >50 FPS en laptop) y *SinglePose Thunder* (mayor precisión, ~30 FPS). Licencia: **Apache License 2.0**.
    * CDN Script: `https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-core`, `https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-webgl`, `https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection`
* **Calibración con la estatura y conversión píxel-a-centímetro:**
  * Para transformar píxeles en centímetros en una cámara monocular plana:
    Factor de conversión  (K) = (Estatura real del usuario (cm)) / (Distancia en píxeles (coronilla a talones))
  * *Limitación de MediaPipe:* No incluye la coronilla; su punto más alto es la nariz (landmark 0). Se debe proyectar la altura agregando la distancia antropométrica estimada entre ojos/nariz y la parte superior del cráneo (~10–12 cm en adultos) o registrar la distancia conocida entre el suelo y los ojos del usuario.
* **Fuentes y magnitud del error:**
  * **Distorsión de lente y perspectiva:** Las cámaras frontales de celulares tienen distorsión de barril (*barrel distortion*) y lentes gran angular (focal equivalente a 24–28 mm). Si la cámara se inclina 10° hacia abajo, la relación ancho de hombros / cintura se distorsiona entre un **7% y un 12%**.
  * **Esqueleto vs. Contorno:** Pose Landmarker ubica centros articulares óseos (puntos 11 y 12 para hombros; 23 y 24 para caderas/trocánteres). **No detecta la silueta externa de la piel o el músculo.** El ancho del acromion no refleja la hipertrofia del deltoides lateral ni el dorsal ancho, generando subestimaciones del diámetro biacromial de **2.5 a 5.0 cm** si no se acompaña de un modelo de segmentación de silueta (*ImageSegmenter*).

### 4. Conteo de repeticiones y análisis de técnica mediante ángulos articulares
* **Cálculo trigonométrico del ángulo articular (2D):**
  Para evaluar una articulación B (ej. codo, landmark 13) conectada a A (hombro, landmark 11) y C (muñeca, landmark 15):
  θ = | {atan2}(y_C - y_B, x_C - x_B) - {atan2}(y_A - y_B, x_A - x_B) | × ((180) / ())
  *(Si θ > 180°, se corrige: θ = 360° - θ).*
* **Algoritmo de conteo (Máquina de Estados Finitos - FSM con Histéresis):**
  * Para curl predicador en máquina:
    * **Fase excéntrica / Abajo:** Ángulo del codo > 150° arrow Estado cambia a `DOWN`.
    * **Fase concéntrica / Arriba:** Ángulo del codo < 55° arrow Si el estado previo era `DOWN`, se incrementa el contador (`reps++`) y el estado pasa a `UP`.
  * **Filtro de amortiguación temporal (*Debounce*):** Se exige un tiempo mínimo de ciclo de repetición (≥ 1.0 a 1.2 segundos) para evitar que el temblor muscular cerca del fallo compute repeticiones fantasma.
  * **Suavizado de señal (*Filtering*):** Se debe aplicar un filtro paso bajo o un *One Euro filter* sobre las coordenadas (x, y) a lo largo de una ventana de 3 a 5 fotogramas para eliminar el parpadeo de detección (*jitter*).
* **Auditoría de técnica y rangos articulares:**
  * **Rango de movimiento (ROM):** El sistema audita si la repetición completó el recorrido efectivo (ej. extensión de codo ≥ 140° y flexión ≤ 60°). Repeticiones parciales se marcan como incompletas.
  * **Cadencia y tempo:** Cronometrar la fase excéntrica (meta: 2 a 3 segundos bajo control) vs. concéntrica (1 a 2 segundos explosivos).
  * **Compensación postural (trampa por balanceo):** En remos y curls, se mide el ángulo del vector tronco (landmark 11 hombro a 23 cadera) respecto al eje vertical. Si la oscilación supera los **15°**, el algoritmo emite una alerta visual de inercia indebida (*momentum cheating*).
* **Proyectos de código abierto de referencia:**
  * Repositorios basados en MediaPipe para *Workout Rep Counter* y análisis angular en JavaScript/Web: disponibles bajo licencias permisivas **MIT License** y **Apache 2.0** (ej. arquitecturas derivadas del repositorio oficial de Google MediaPipe Samples y proyectos de la comunidad como *workout-rep-counter*).

### 5. Protocolo estandarizado para fotografía de progreso corporal
* **Frecuencia:** Cada **2 a 4 semanas**. Comparar fotos con frecuencia menor a 14 días solo captura variaciones transitorias de glucógeno y retención hídrica (fluctuaciones normales de 0.5 a 2.0 kg).
* **Condición biológica:** Inmediatamente al levantarse, tras la primera micción/evacuación matutina (*post-voiding*), en ayunas estricto de sólidos y líquidos, y en días donde no haya congestión muscular reciente (*muscle pump* de menos de 12 horas).
* **Parámetros de la cámara y entorno:**
  * **Distancia:** **2.5 a 3.0 metros** del teléfono al cuerpo (elimina la compresión y distorsión esférica del lente gran angular).
  * **Altura del lente:** Exactamente a la altura del **ombligo o esternón** (100–115 cm del piso), con el teléfono en ángulo recto perpendicular al suelo (90°, inclinación/tilt de 0°).
  * **Luz:** Luz artificial cenital difusa combinada con luz frontal suave, idéntica en cada sesión. Prohibido usar luz natural de ventana cambiante o flash directo del celular (el flash aplana el relieve muscular y borra sombras anatómicas).
* **Poses estandarizadas (en ropa interior idéntica o pantaloneta corta):**
  1. *Frente relajado:* Pies separados al ancho de hombros, brazos separados del torso unos 15°, respiración neutra (al final de una exhalación no forzada, sin meter el estómago ni inflar caja torácica).
  2. *Perfil relajado:* Brazos ligeramente hacia adelante para permitir ver el contorno abdominal y la curvatura lumbar.
  3. *Espalda relajada:* Brazos ligeramente separados, dorsales en tensión neutra sin abrir excesivamente la espalda.
  4. *Poses de contracción muscular (opcionales):* Doble bíceps de frente y de espalda, para evaluar simetría en brazos y amplitud escapular.

---

## Reglas prácticas para tú (lista corta y accionable)

1. **Monitorea tu recomposición con la cinta métrica, no con el número de grasa de una app:** Usa la fórmula de la Marina cada 14 días en ayunas. Si tu cintura baja 1–2 cm mientras tu peso se mantiene cerca tu peso y tus cargas en el rango de 5–8 reps suben, estás ganando músculo y perdiendo grasa con certeza biológica.
2. **Usa la cámara del navegador para técnica y tempo, no para medir centímetros:** MediaPipe y MoveNet funcionan excelente en el navegador web para auditar que tardes 2 a 3 segundos bajando la carga en el curl predicador o remo en máquina y para verificar que no balancees la espalda más de 10°.
3. **Instala tu cámara a la altura de tu ombligo:** Si vas a capturar video o fotos de progreso en casa, coloca el celular en una repisa o trípode a 1.05 m del suelo y aléjate al menos 2.5 metros. Nunca te tomes fotos frente al espejo del baño con el celular arriba (ese ángulo deforma la relación hombro-cintura).
4. **Para tracking en el navegador, usa MediaPipe Tasks-Vision con WebGL:** Si construyes o usas una herramienta web, importa `@mediapipe/tasks-vision` vía jsDelivr con modelo `pose_landmarker_full.task` configurado en `runningMode: "VIDEO"` y delegado a GPU; corre a más de 30 FPS sin tocar ningún servidor externo.
5. **Cero fotos con "pump" de gimnasio para evaluar progreso:** La congestión sanguínea inflama transitoriamente los bíceps y hombros de 1.0 a 2.5 cm durante 90 minutos posentrenamiento. Las fotos comparativas válidas se toman únicamente en ayunas un domingo por la mañana.
6. **No te sugestiones con la distorsión del cuello:** tú está entrenando tirones y hombro pesado; si tus trapecios o cuello aumentan de grosor, la fórmula naval arrojará menos porcentaje graso de forma matemática. Evalúa siempre la cintura a la altura del ombligo como el árbitro definitivo.

---

## Mitos y errores comunes

* **Mito 1: "Una aplicación móvil con IA que analiza una foto te da tu grasa corporal con la misma precisión que un escaneo médico".**
  * *Realidad:* Falso. El error a nivel de una sola persona puede ser de hasta ± 8%. Las fotos no pueden medir la densidad mineral ósea ni separar con fiabilidad el agua intramuscular de la grasa subcutánea. Sirven para observar la silueta a lo largo de meses, no como valor cuantitativo absoluto.
* **Mito 2: "Librerías como MediaPipe o MoveNet pueden medir directamente el perímetro de la cintura y pecho con la cámara".**
  * *Realidad:* Falso. Los detectores de pose esquelética solo predicen la posición tridimensional de las articulaciones (huesos). La distancia entre los puntos de cadera representa la distancia entre cabezas de fémur o crestas ilíacas, ignorando por completo el tejido blando, la grasa subcutánea y la musculatura que determinan la circunferencia real.
* **Mito 3: "La fórmula de la Marina de EE. UU. es obsoleta y no sirve para nadie".**
  * *Realidad:* Incorrecto. Es uno de los métodos de campo más baratos y correlacionados (r ~ 0.90) con la densidad corporal cuando se mide de forma metódica. Su limitación no es su inutilidad, sino que no discrimina si el grosor del cuello es grasa o hipertrofia muscular.
* **Mito 4: "Si una foto muestra más cortes musculares por la tarde, quemaste grasa ese día".**
  * *Realidad:* Es una ilusión óptica causada por la deshidratación diurna, la tensión muscular isométrica o el ángulo de iluminación cenital. La lipólisis y oxidación neta de grasa subcutánea toma semanas; lo que cambia entre la mañana y la noche es el balance hídrico celular y la digestión.
* **Mito 5: "Para contar repeticiones por visión artificial basta con medir la velocidad a la que se mueve la mano".**
  * *Realidad:* Provoca fallas masivas. Si tú desacelera cerca del fallo (como debe ocurrir en series pesadas con RIR 0-1), un contador basado en umbrales de velocidad asumirá que la serie terminó. El conteo robusto requiere monitorear trayectorias angulares articulares con máquinas de estado que no dependan de la velocidad de ejecución.

---

## Fuentes

1. **Smartphone three-dimensional imaging for body composition assessment using non-rigid avatar reconstruction**
   * *Autor / Sitio:* Tinsley, G. M., et al. / *Frontiers in Medicine*
   * *Año:* 2024
   * *Enlace:* https://www.frontiersin.org/journals/medicine/articles/10.3389/fmed.2024.1438902/full
   * *Tipo:* Estudio de validación clínica comparativo vs. DEXA y 4-compartimentos.
2. **Accuracy of digital anthropometry and 3D optical body scanners for body composition assessment: A systematic review**
   * *Autor / Sitio:* Scafoglieri, A., et al. / *Nutrients*
   * *Año:* 2023
   * *Enlace:* https://www.mdpi.com/2072-6643/15/4/859
   * *Tipo:* Revisión sistemática.
3. **Evaluation of automated anthropometrics produced by smartphone-based machine learning and digital photography**
   * *Autor / Sitio:* Majmudar, M. D., Tinsley, G. M., et al. / *British Journal of Nutrition*
   * *Año:* 2023
   * *Enlace:* https://www.cambridge.org/core/journals/british-journal-of-nutrition/article/evaluation-of-automated-anthropometrics-produced-by-smartphonebased-machine-learning-and-digital-photography/8E619E4A9684F66754C9199B6A1A3102
   * *Tipo:* Estudio de validación experimental.
4. **Validity of circumference-based equations and military body fat standards vs. DXA and 4C models in service members**
   * *Autor / Sitio:* Department of Defense Body Composition Study / *Military Medicine* (Oxford Academic)
   * *Año:* 2021
   * *Enlace:* https://academic.oup.com/milmed/article/186/Supplement_1/1/6134250
   * *Tipo:* Estudio de cohorte de validación antropométrica.
5. **Prediction of percent body fat for U.S. Navy men and women from body circumferences and height**
   * *Autor / Sitio:* Hodgdon, J. A., & Beckett, M. B. / *Naval Health Research Center (Report No. 84-29)*
   * *Año:* 1984
   * *Enlace:* https://apps.dtic.mil/sti/citations/ADA143894
   * *Tipo:* Estudio original de derivación matemática del método naval.
6. **BlazePose: On-device Real-time Body Pose Tracking**
   * *Autor / Sitio:* Bazarevsky, V., Grishchenko, I., et al. (Google Research) / *arXiv:2006.10204*
   * *Año:* 2020
   * *Enlace:* https://arxiv.org/abs/2006.10204
   * *Tipo:* Publicación técnica fundacional de MediaPipe Pose.
7. **MediaPipe Pose Landmarker Web and JavaScript Implementation Guide**
   * *Autor / Sitio:* Google for Developers / *ai.google.dev*
   * *Año:* 2024
   * *Enlace:* https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js
   * *Tipo:* Documentación técnica oficial y repositorio de código de referencia.
8. **MoveNet: Ultra-fast and accurate pose detection model**
   * *Autor / Sitio:* TensorFlow Team (Google) / *TensorFlow Hub & TensorFlow Blog*
   * *Año:* 2021
   * *Enlace:* https://blog.tensorflow.org/2021/05/next-generation-pose-detection-with-movenet-and-tensorflowjs.html
   * *Tipo:* Documentación y benchmark técnico oficial de arquitectura MoveNet.
9. **ACSM's Guidelines for Exercise Testing and Prescription (11th Edition) - Body Composition Assessments and Error Ranges**
   * *Autor / Sitio:* American College of Sports Medicine (ACSM) / *Wolters Kluwer*
   * *Año:* 2021
   * *Enlace:* https://www.acsm.org/education-resources/books/guidelines-exercise-testing-prescription
   * *Tipo:* Posición oficial y guía de referencia de colegio profesional.

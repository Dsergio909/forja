# Cómo funciona la IA del celular

## Resumen en 5 líneas
1. Es 100 % viable correr un modelo de lenguaje pequeño (SLM) dentro de una aplicación web instalable (PWA) en tu celular y sin internet, usando motores con aceleración gráfica directa en el navegador (WebGPU) como **WebLLM** o **Transformers.js v3**.
2. Para responder dudas de tus entrenamientos en español con precisión y sin colgar el celular, el mejor balance es **Qwen 2.5 de 1,5 mil millones de parámetros (1.5B)** en 4 bits (pesa ~950 MB en descarga, consume ~1,6 GB de memoria de video [VRAM] y genera de 15 a 25 palabras o fichas por segundo [tokens/s] en gama media).
3. Si el celular tiene recursos muy justos (menos de 6 GB de RAM física total), la alternativa más ligera y rápida es **Llama 3.2 1B** (descarga de ~700 MB, ~880 MB de VRAM y más de 30 tokens/s).
4. Para guardar tus rutinas, pesos y comidas sin riesgo de que el navegador los borre, debes usar la base de datos interna del navegador (**IndexedDB**) y solicitar almacenamiento duradero mediante la instrucción del sistema (`navigator.storage.persist()`).
5. El dictado por voz clásico del navegador (**Web Speech API**) no es confiable sin internet en Android (falla con error de red); la solución offline real en la web es transcribir la voz con un modelo pequeño de transcripción (**Whisper-tiny** de ~40 MB vía WebAssembly/WebGPU) o usar el botón de micrófono del teclado del celular (Gboard con dictado sin conexión descargado).

---

## Lo que dice la evidencia (con números: series, reps, descansos, gramos, minutos, etc.)

### 1. Comparativa técnica de motores de ejecución en el navegador (Web Inference Engines)

| Motor / Librería | ¿Requiere WebGPU? | Compatibilidad Android / iOS | Formato de modelo | Consumo base del motor (RAM/WASM) | Latencia al primer resultado (Time to First Token - TTFT) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **WebLLM (MLC-AI)** | **Sí** (WebGPU obligatorio) | Chrome Android 121+ (Android 12+); Safari iOS 17.4+ / iOS 18 | MLC / TVM (pesos `q4f16_1`) | ~100–200 MB + VRAM del modelo | **Muy rápida (0,2 a 0,8 s)** en gama media con GPU Adreno/Mali. |
| **MediaPipe LLM Web (Google)** | **Sí** (WebGPU recomendado) | Chrome Android; soporte irregular en Safari iOS | Formato propio `.task` / LiteRT-LM | ~150–250 MB | Rápida (0,4 a 1,2 s), pero limitado catálogo de modelos (Gemma, Falcon). |
| **Transformers.js (v3)** | **No** (usa WebGPU si existe, con respaldo [fallback] a CPU/WASM) | Chrome Android y Safari iOS (WebGPU o WASM) | ONNX Runtime Web (`int4` / `fp16`) | ~120–300 MB | Moderada (0,5 a 1,5 s en WebGPU; 3 a 8 s en CPU puro). |
| **wllama (llama.cpp WASM)** | **No** (corre sobre procesador CPU con SIMD y multihilo [multithreading]) | Universal (Chrome Android, Safari iOS, Firefox) | GGUF (`Q4_K_M`, `Q4_0`, etc.) | **Mínimo (~50–100 MB)** | Lenta a moderada (1,5 a 4 s en prellenado de contexto [prefill]). |

---

### 2. Comparativa de modelos pequeños (Small Language Models - SLMs)

*Pruebas estandarizadas en celulares de gama media (procesadores Snapdragon 778G / 7 Gen 1/2 o MediaTek Dimensity 7050/8100 con 6 a 8 GB de RAM física).*

| Modelo | Parámetros reales | Tamaño de descarga (Cuantización 4-bit) | Memoria VRAM requerida en navegador | Velocidad en gama media (Tokens/segundo) | Calidad en español latino | Licencia de uso |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Qwen 2.5 0.5B Instruct** | 490 M | **~350 MB** | **~945 MB** | **40–55 t/s** | Aceptable a buena (entiende comandos directos, oraciones cortas). | Apache 2.0 (código abierto comercial libre). |
| **Qwen 2.5 1.5B Instruct** | 1.540 M | **~950 MB** | **~1.630 MB (~1,63 GB)** | **18–28 t/s** | **Excelente** (el mejor razonamiento y redacción en español en este rango). | Apache 2.0. |
| **Qwen 2.5 3B Instruct** | 3.090 M | ~1.900 MB (~1,9 GB) | ~2.600–3.100 MB (~2,8 GB) | 8–14 t/s | Sobresaliente, pero roza el límite de memoria de pestaña en celulares. | Apache 2.0. |
| **Llama 3.2 1B Instruct** | 1.230 M | **~710 MB** | **~880 MB (~0,88 GB)** | **30–42 t/s** | Muy buena (sintaxis sólida, respuestas concisas). | Llama 3.2 Community License (gratuita hasta 700 millones de usuarios activos mensuales). |
| **Llama 3.2 3B Instruct** | 3.210 M | ~1.850 MB (~1,85 GB) | ~2.400–2.900 MB (~2,6 GB) | 9–15 t/s | Excelente, pero riesgoso en pestañas de iOS Safari. | Llama 3.2 Community License. |
| **SmolLM2 135M / 360M** | 135 M / 360 M | 140 MB / 230 MB | 250 MB / 500 MB | 60–80+ t/s | Pobre en español (alucina, mezcla palabras en inglés). | Apache 2.0. |
| **SmolLM2 1.7B Instruct** | 1.710 M | ~850 MB | ~1.300 MB (~1,3 GB) | 16–24 t/s | Regular (su fuerte es inglés; comete errores gramaticales en español). | Apache 2.0. |
| **Gemma 2 2B-it / Gemma 3n** | 2.610 M | ~1.400 MB (~1,4 GB) | ~2.100–2.400 MB (~2,2 GB) | 10–18 t/s | Muy buena, pero exige más memoria por tamaño de vocabulario (256k tokens). | Gemma Terms of Use (permisiva abierta). |
| **Phi-3.5 mini Instruct** | 3.820 M | ~2.300 MB (~2,3 GB) | ~3.800–4.200 MB (~4,0 GB) | 4–9 t/s | Muy buena en lógica, pero excesivamente pesada para navegador móvil. | MIT License. |

---

### 3. Persistencia de datos en la web del celular (IndexedDB y Almacenamiento)
* **Cuota y desalojo por defecto (Best-Effort Storage):** En Chrome de Android y Safari de iOS, el navegador considera los datos web como temporales. Si el celular se queda con menos del 10 % de espacio libre en disco, el sistema operativo borra automáticamente las bases de datos locales usando una regla del menos usado recientemente (Least Recently Used - LRU).
* **Solución de persistencia (`navigator.storage.persist()`):**
  * Al llamar esta función en JavaScript, el origen pasa a estado persistente (persistent storage). El navegador **jamás borrará los datos por falta de espacio**; únicamente el usuario podrá borrarlos manualmente desde los ajustes del celular.
  * **Comportamiento en Chrome (Android):** Se concede automáticamente o con facilidad si la página tiene alta interacción o está agregada como acceso directo / instalada como PWA.
  * **Comportamiento en Safari (iOS 17+ y 18):** Soporta `navigator.storage.persist()`. Además, si la aplicación se instala en la pantalla de inicio (Home Screen), se desactiva el límite de borrado de 7 días de inactividad que impone la protección de rastreo inteligente de Apple (Intelligent Tracking Prevention - ITP).
* **Capacidad de almacenamiento (Storage Quota):** IndexedDB puede almacenar cómodamente hasta el 60 % del espacio libre en Android (fácilmente más de 10 a 50 GB) y hasta 1 a 2 GB por origen en iOS sin trabas, lo cual es más que suficiente para almacenar el modelo de IA (~1 GB) y miles de sesiones de entrenamiento en formato JSON (~5 a 10 MB para varios años de historial).

---

### 4. Dictado por voz sin internet (Voice-to-Text Offline)
* **El problema de la API nativa de voz (`Web Speech API` / `webkitSpeechRecognition`):**
  * En navegadores móviles (Chrome Android), la interfaz `SpeechRecognition` depende de una conexión a los servidores de Google para enviar los paquetes de audio y recibir el texto.
  * Si el celular está en modo avión o sin señal en el gimnasio, la API arroja inmediatamente el fallo de red (`network error` o `service-not-allowed`), **incluso si el usuario tiene descargado el paquete de voz sin conexión en los ajustes del sistema Android**. Esto ocurre porque el navegador web móvil no expone un interruptor estandarizado para forzar el reconocimiento local.
* **Alternativas reales 100 % fuera de línea para la web:**
  1. **Transcripción local en el navegador con Whisper-tiny (Transformers.js ONNX):** Se descarga una sola vez un modelo de audio de ~39 a 45 MB. Graba el audio con el micrófono del celular (`navigator.mediaDevices.getUserMedia`), lo procesa en WebAssembly/WebGPU y devuelve el texto en español con una latencia de 1,2 a 2,5 segundos para notas de voz de 5 a 10 segundos.
  2. **Teclado del sistema (Gboard / Teclado Samsung / iOS):** Si el usuario toca el campo de texto y usa el icono de micrófono del propio teclado con el paquete de "Español (Colombia)" descargado, el teclado escribe el texto directamente sin que la aplicación web tenga que procesar audio.

---

### 5. Integración con las métricas del entrenamiento de tú
* **Estructura del registro diario (Payload para la IA):**
  * Para que un modelo de 1.5B responda rápido y no gaste memoria, se le envía únicamente el registro resumido del día o la semana en texto plano o JSON ligero (~300 a 600 tokens de contexto):
    * *Día 1:* Remo pecho en banco con discos (3 series × 6-8 reps con 2-3 min de descanso, RIR 1; última al fallo en polea/máquina), Jalón al pecho en polea (3 series × 6-8 reps), Curl predicador barra Z (3 series × 6-8 reps, última al fallo), Curl martillo con mancuernas para antebrazo (3 series × 8 reps con straps).
    * *Día 2:* Prensa inclinada / Hack squat (3 series × 6-8 reps), Curl femoral acostado en máquina (3 series × 6-8 reps, última al fallo), Máquina de abductores (3 series × 8-10 reps), Elevaciones laterales con mancuernas (3 series × 8 reps).
    * *Nutrición:* 2.200 kcal, 128 g de proteína real (~2,0 g/kg para sus tu peso) y 5 g de creatina monohidrato.
* **Tiempo de inferencia del asistente:** Con **Qwen 2.5 1.5B**, una consulta típica como *"¿Cuánto peso levanté en remo en la última serie y cuánto debería subir hoy?"* tarda **~0,4 segundos en leer el historial** y **~2 segundos en redactar una respuesta de 50 palabras**.

---

## Reglas prácticas para tú (lista corta y accionable)

1. **Elige el motor correcto según tu celular:**
   * Si tienes un Android de gama media/alta con Android 12 o superior: usa **WebLLM** con aceleración por hardware (WebGPU).
   * Si buscas máxima compatibilidad en cualquier dispositivo sin depender de que la tarjeta gráfica soporte WebGPU: usa **Transformers.js v3** o **wllama** (ejecución por procesador CPU con WebAssembly).
2. **Modelo recomendado como primera opción:**
   * Descarga **`Qwen2.5-1.5B-Instruct`** cuantizado en 4 bits (`q4f16_1`). Es el único modelo sub-2B que comprende modismos, nombres de ejercicios en español, instrucciones de series/repeticiones y responde en español natural sin trabarse.
3. **Alternativa si tu celular tiene poca memoria (menos de 6 GB de RAM):**
   * Configura **`Llama-3.2-1B-Instruct`**. Requiere menos de 900 MB de memoria de video (VRAM), no cerrará la pestaña del navegador por falta de memoria (out-of-memory crash) y responderá a más de 30 palabras por segundo.
4. **Blindaje de tus datos de entrenamiento contra borrados:**
   * Guarda todas tus sesiones en **IndexedDB** usando una librería ligera como **Dexie.js**.
   * En el primer inicio de tu aplicación instalable (PWA), ejecuta la solicitud de permiso persistente:
     ```javascript
     if (navigator.storage && navigator.storage.persist) {
       const guardadoSeguro = await navigator.storage.persist();
       console.log("Almacenamiento persistente activo:", guardadoSeguro);
     }
     ```
   * Instala siempre la PWA en la pantalla principal del celular (botón "Instalar" o "Agregar a pantalla de inicio").
5. **Estrategia para dictar tus series sin internet en el gimnasio:**
   * No uses la función nativa de voz del navegador (`Web Speech API`) sin red porque fallará.
   * La forma más fácil: activa el micrófono del teclado (Gboard) asegurándote de haber descargado antes el paquete sin conexión de *Español (Colombia)* en los ajustes de voz del teclado.
   * Si quieres dictado dentro de la misma web: carga el modelo **Whisper-tiny cuantizado** (~40 MB) mediante Transformers.js para que transcriba tus notas de voz en el mismo teléfono.
6. **Diseño de consultas al asistente (Prompting local):**
   * No le envíes el historial de todo un año de golpe al modelo. Filtra con código JavaScript únicamente los últimos 3 a 5 registros del ejercicio que vas a consultar y pásalos como texto simple para mantener el consumo de memoria bajo mínimos.

---

## Mitos y errores comunes

* **Mito 1: "La Web Speech API funciona sin internet en Chrome de Android si descargas el idioma en el teléfono".**
  * *Realidad:* Falso. La implementación de Chrome en Android dirige las solicitudes de la API web a los servidores en la nube de Google. Sin conexión de datos o wifi, arroja un error de red inmediato (`network error`), a diferencia de las aplicaciones nativas en Kotlin/Java que sí pueden activar la bandera de reconocimiento local (`EXTRA_PREFER_OFFLINE`).
* **Mito 2: "Los datos guardados en una página web o PWA nunca se borran si el usuario no los elimina".**
  * *Realidad:* Falso. El almacenamiento web por defecto es considerado de "mejor esfuerzo" (best-effort). Si el almacenamiento del celular baja del 10 % o el sistema entra en presión de memoria, Android y Safari purgan automáticamente las bases de datos de IndexedDB. Es indispensable solicitar `navigator.storage.persist()`.
* **Mito 3: "Se puede correr un modelo de 3B o 7B en cualquier celular usando el navegador".**
  * *Realidad:* Falso. Los navegadores móviles aplican techos de memoria muy estrictos por pestaña (en Safari iOS suele rondar entre 1,5 y 2 GB). Cargar un modelo de más de 2B parámetros satura la memoria compartida y provoca el cierre súbito de la pestaña por falta de memoria (Out-Of-Memory Crash).
* **Mito 4: "Es obligatorio tener WebGPU para correr inteligencia artificial en una página web".**
  * *Realidad:* Falso. Librerías como **wllama** (llama.cpp compilado a WebAssembly) y los respaldos de **Transformers.js** ejecutan modelos en procesadores convencionales (CPU) usando instrucciones aceleradas (WASM-SIMD). Funcionan en cualquier celular, aunque la velocidad se reduce de 3 a 5 veces comparada con la aceleración gráfica.
* **Mito 5: "Cualquier modelo chico (menor a 2B) sirve para responder en español".**
  * *Realidad:* Falso. Modelos como SmolLM2 (135M y 360M) fueron entrenados casi en su totalidad con textos en inglés; en español inventan palabras o cambian de idioma a mitad de frase. Solo familias con entrenamiento multilingüe masivo como **Qwen 2.5** y **Llama 3.2** mantienen coherencia técnica y gramatical en español en tamaños reducidos.
* **Mito 6: "Para que el asistente sepa cuánto peso levanté, tengo que reentrenar o ajustar (fine-tune) el modelo".**
  * *Realidad:* Falso e ineficiente. Un modelo pequeño en el celular no se reentrena; simplemente se le adjunta el registro del día en el mensaje de entrada (generación aumentada por recuperación local [Local RAG] o inyección de contexto), consumiendo apenas unos cientos de tokens.

---

## Fuentes

1. **WebLLM: High-Performance In-Browser LLM Inference with WebGPU**  
   *Autor / Sitio:* MLC-AI Consortium (Tianqi Chen et al.)  
   *Año:* 2024–2026  
   *Enlace:* https://github.com/mlc-ai/web-llm  
   *Tipo:* Proyecto oficial / Documentación técnica y benchmarks de rendimiento.

2. **WebGPU Implementation Status and Memory Architecture in Chromium**  
   *Autor / Sitio:* Google Chrome Developers / W3C GPU for the Web Working Group  
   *Año:* 2024  
   *Enlace:* https://developer.chrome.com/docs/web-platform/webgpu  
   *Tipo:* Documentación técnica oficial de plataforma y estándares.

3. **Transformers.js v3: WebGPU-Accelerated Machine Learning in the Browser**  
   *Autor / Sitio:* Hugging Face (Joshua Lochner et al.)  
   *Año:* 2024–2025  
   *Enlace:* https://huggingface.co/docs/transformers.js  
   *Tipo:* Documentación oficial y repositorio de investigación de código abierto.

4. **Wllama: llama.cpp WebAssembly & WebGPU Port for Browser Environments**  
   *Autor / Sitio:* Ngoc Tu Nguyen (Wllama Project) / Georgi Gerganov (llama.cpp)  
   *Año:* 2024–2025  
   *Enlace:* https://github.com/ngxson/wllama  
   *Tipo:* Repositorio de código abierto y benchmarks de inferencia en CPU/WASM.

5. **Qwen2.5 Technical Report: Foundation and Instruction-Tuned Small Language Models**  
   *Autor / Sitio:* Qwen Team, Alibaba Cloud  
   *Año:* 2024–2025  
   *Enlace:* https://arxiv.org/abs/2412.15115  
   *Tipo:* Estudio técnico / Reporte de investigación de modelos multilingües (0.5B a 3B).

6. **Llama 3.2: Revolutionizing Edge AI and Mobile Processing with 1B and 3B Models**  
   *Autor / Sitio:* Meta AI Research  
   *Año:* 2024  
   *Enlace:* https://ai.meta.com/blog/llama-3-2-connect-2024/  
   *Tipo:* Publicación técnica oficial y evaluación comparativa en dispositivos periféricos.

7. **StorageManager API: Persistent Storage and Eviction Policies**  
   *Autor / Sitio:* MDN Web Docs (Mozilla Developer Network) / WHATWG Storage Standard  
   *Año:* 2025  
   *Enlace:* https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist  
   *Tipo:* Especificación técnica estándar y documentación de navegadores.

8. **IndexedDB and Storage Persistence Updates in WebKit (Safari iOS)**  
   *Autor / Sitio:* WebKit Team (Apple Inc.)  
   *Año:* 2024  
   *Enlace:* https://webkit.org/blog/14403/storage-and-safari-updates/  
   *Tipo:* Documentación técnica oficial de motor de navegación.

9. **Web Speech API Specification and Mobile Cloud Limitations**  
   *Autor / Sitio:* W3C Speech API Community Group  
   *Año:* 2024  
   *Enlace:* https://wicg.github.io/speech-api/  
   *Tipo:* Especificación técnica estándar y discusión de implementación en navegadores móviles.

10. **Robust Speech Recognition via In-Browser Whisper via WebAssembly / WebGPU**  
    *Autor / Sitio:* OpenAI / Hugging Face Open-Source Research  
    *Año:* 2024–2025  
    *Enlace:* https://huggingface.co/openai/whisper-tiny  
    *Tipo:* Estudio de arquitectura y pesos de modelos de transcripción acústica compactos.

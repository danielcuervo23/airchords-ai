# Instrumento con gestos — versión web (diseño)

Fecha: 2026-11-14 · Estado: borrador para aprobación del usuario

## 1. Intención y por qué

El usuario tiene un programa en Python (`PianoVirtual.py`) que toca piano, guitarra y violín con las manos (MediaPipe Hands), cambia de instrumento al abrir la boca (FaceLandmarker) y pone un filtro 3D de Spider-Man anclado a la cabeza (pyrender). Funciona solo instalado en su computadora y **no es fiable**: una nota suena cuando la punta de un dedo baja apenas 0,008 (en coordenadas normalizadas) por debajo de su nudillo (`is_finger_down`), así que la inclinación de la mano o el temblor de la cámara producen notas fantasma o perdidas. Además, cada instrumento tiene solo 6 notas grabadas.

Quiere una **página web propia para su portafolio**, que cualquiera abra con un enlace y que **funcione de verdad**. La inspiración es Gesture Synth (gesture-synth-weld.vercel.app, de otro autor y sin licencia publicada). De esa web le gustan las ideas de: **tipos de sonido (presets), aspecto visual cuidado, canciones guiadas y modo que toca solo**. Se toman **ideas y mecánicas**, nunca código, textos, nombres ni diseño visual de esa web.

Éxito para el usuario: una persona abre el enlace, da permiso a la cámara y en segundos está tocando algo que suena bonito, sin notas fantasma. Debe verse profesional en un portafolio.

## 2. Objetivos

- Tocar con las dos manos al estilo "sintetizador por gestos" (modo B, elegido por el usuario).
- Varios tipos de sonido, cambiables con botones y con el gesto de abrir la boca.
- Canciones guiadas: la pantalla indica el siguiente gesto y espera a que el usuario lo haga.
- Modo que toca solo (progresión de acordes a un tempo ajustable).
- Filtro 3D de Spider-Man sobre la cara, activable y desactivable.
- Funcionar en una computadora y en un celular de gama media con navegador moderno (Chrome, Edge, Safari reciente).

## 3. No objetivos (por ahora)

- Cuentas de usuario, guardar o grabar canciones, compartir grabaciones.
- Donaciones o pagos.
- Un sitio de portafolio de varias páginas (esto es un proyecto; puede integrarse después).
- Modo "piano por dedos" (modo A). Queda como posible extra futuro, no entra en esta versión.

## 4. Anti-objetivos (sería un fracaso aunque "funcione")

- Que se parezca visualmente a Gesture Synth o reutilice sus textos o nombres de presets.
- Notas que suenan sin que el usuario haga el gesto, o retraso perceptible entre gesto y sonido (> ~100 ms).
- Que la imagen de la cámara salga del dispositivo.
- Tardar más de unos segundos en estar listo para tocar en un celular, sobre todo por el modelo 3D.

## 5. Restricciones

- Sin servidor propio: todo corre en el navegador del visitante. Se aloja como sitio estático (Vercel, plan gratuito).
- La cámara exige HTTPS (Vercel lo da) y permiso explícito; hay que manejar bien el rechazo y la falta de cámara.
- Reglas de trabajo del usuario: TDD, una rama por funcionalidad, revisión con `code-reviewer` antes de unir, código limpio (SOLID, sin complicar de más), seguridad desde el diseño, rendimiento pensado para muchos usuarios, máximo 4 agentes a la vez.
- Ninguna llave ni secreto en el código (no debería hacer falta ninguno).
- El modelo `Filtros/source/spiderman.glb` pesa 27 MB y sus texturas 5,9 + 15,5 + 1,2 MB. Hay que reducirlo para la web (objetivo ≤ 3 MB en total).
- Modelo de Spider-Man: el usuario lo obtuvo como "uso libre", autor desconocido (el archivo no trae metadatos de autor; generador: Blender glTF I/O 3.6). Spider-Man es un personaje de Marvel: la demo se presenta como fan-art sin fines comerciales, con crédito "modelo de uso libre, autor desconocido", y el filtro debe ser **intercambiable** (cambiar de modelo 3D = cambiar un archivo y su calibración, sin tocar lógica).

## 6. Enfoques considerados

1. **Todo en el navegador (elegido).** MediaPipe Tasks Vision para web (HandLandmarker + FaceLandmarker) con aceleración GPU, audio con Web Audio (vía una librería de síntesis tipo Tone.js), filtro 3D con three.js. Sin retraso de red, coste cero al escalar (cada visitante usa su propio dispositivo) y privacidad total. Coste: hay que portar la lógica de Python a TypeScript.
2. **Framework de sitio completo (tipo Next.js).** Útil si el portafolio crece a muchas páginas; para un solo instrumento interactivo añade complejidad sin beneficio. Se puede migrar después.
3. **Seguir con Python en un servidor y mostrar video en la web.** Descartado: latencia, coste de servidor que crece con los usuarios y las caras viajarían por internet.

Lo eligió Claude, por delegación del usuario ("1").

## 7. Lo que decidió el usuario

- Plataforma: web (opción A del primer intercambio).
- Forma de tocar: **modo B**, al estilo sintetizador por gestos, en vez de "doblar un dedo = nota".
- Funciones que quiere: tipos de sonido, aspecto visual cuidado, canciones guiadas, modo que toca solo.
- Se conserva el **filtro de Spider-Man**.
- **Se reemplazan todos los sonidos grabados** por muestras de licencia libre; Claude se encarga de elegirlas.
- El usuario **probará en su computadora y en su celular** durante el desarrollo.
- Tiene **GitHub y Vercel**.
- Canciones guiadas: City of Stars, Can't Take My Eyes Off You y Glimpse of Us, **solo con acordes** (sin melodía).
- Enfoque técnico 1 (todo en el navegador).

## 8. Propuestas de Claude (el usuario puede corregirlas)

### 8.1 Forma de tocar (modo B)
- **Mano derecha elige el acorde con 7 señas (decisión del usuario, tras investigar).** Se usa el reconocedor de señas ya entrenado de MediaPipe (`GestureRecognizer`, entrenado con ~30.000 imágenes reales), no reglas hechas a mano. Motivo: el pulgar es el dedo que más se confunde (con contar dedos, "4" y "5" solo se distinguen por el pulgar), el anular casi no se mueve solo y las señas con dedos que se tocan fallan mucho. Asignación: I = ☝️ `Pointing_Up` · II = ✌️ `Victory` · III = 🤟 `ILoveYou` · IV = 👍 `Thumb_Up` · V = 🖐️ `Open_Palm` · VI = 👎 `Thumb_Down` · VII = ✊ `Closed_Fist` · silencio = sin mano o `None`. Si alguna seña falla con las grabaciones del usuario, se puede reentrenar el clasificador con MediaPipe Model Maker.
- **Mano izquierda da la expresión:** la altura controla el volumen y la inclinación abre o cierra un filtro de brillo (de sonido apagado a sonido brillante). Mano izquierda ausente = volumen y brillo por defecto, para poder tocar con una sola mano (por ejemplo, sosteniendo el celular con la otra).
- **Calidad de los acordes (decisión de Claude):** diatónica. Cada grado tiene la calidad que le corresponde en la tonalidad (en mayor: I, ii, iii, IV, V, vi, vii°). La inclinación **no** cambia entre mayor y menor, para que nunca suene un acorde "equivocado", sobre todo en las canciones guiadas. El selector ofrece tonalidades mayores y menores (12 × 2).
- **Cuándo suena (decisión de Claude):** mientras la mano derecha muestre un acorde estable, el acorde se mantiene sonando. Al cambiar de acorde hay una transición suave, y al bajar la mano se apaga con un fundido. En los sonidos sintetizados el acorde se sostiene (tipo colchón). En los sonidos de muestras que se apagan solos (piano, guitarra), el acorde se toca como un rasgueo al cambiar y se vuelve a tocar a un pulso suave mientras se mantenga el gesto. La meta de menos de 100 ms de retraso aplica al inicio de cada acorde.
- **Fiabilidad, el requisito central:** clasificador entrenado, umbral mínimo de confianza (0,6), un tiempo mínimo de estabilidad antes de cambiar de acorde y validación con las grabaciones del usuario (≥ 95 % de aciertos por seña). Sin manos detectadas = silencio suave (fundido), nunca un corte brusco.
- Selector de **tonalidad** (las 12 notas) para que los acordes siempre combinen entre sí.

### 8.2 Tipos de sonido
- **Decisión del usuario:** no se usa ninguna de las grabaciones actuales (`Piano/`, `Guitarra/`, `Violin/` ni los `.wav` de la raíz); no le gustan y su origen no está claro. Se reemplazan por muestras de piano, guitarra y violín con **licencia libre que permita redistribuir** (por ejemplo CC0 o CC-BY), con suficientes notas para cubrir el registro sin transponer demasiado. El constructor elige las fuentes, registra licencia y autor de cada una en un archivo de créditos visible en la web, y las comprime (formato web, calidad suficiente) para cumplir las metas de arranque. Las muestras se cargan por instrumento, cuando el usuario lo elige, no todas al inicio.
- Más 3–4 sonidos sintetizados con nombres propios (por ejemplo "Cálido", "Cristal", "8-bit", "Nube"), que no deben copiar los nombres de Gesture Synth.
- Abrir la boca pasa al siguiente sonido, conservando los umbrales con histéresis que ya usa el programa en Python (abrir > 0,28 y cerrar < 0,20) como punto de partida. También hay botones en pantalla.

### 8.3 Canciones guiadas
- **Decisión del usuario:** las canciones son **"City of Stars"** (La La Land), **"Can't Take My Eyes Off You"** y **"Glimpse of Us"** (Joji).
- **Decisión del usuario (por derechos de autor):** **solo progresiones de acordes, sin melodía, sin letra, sin audio ni partitura de las grabaciones originales.** Se presentan como "acordes de …", con el título y el autor como referencia, sin portadas ni imágenes oficiales. El acompañamiento (ritmo o arpegio) es un patrón original creado para este proyecto, no una transcripción del arreglo original.
- La pantalla muestra el acorde y el gesto actual y el siguiente, espera a que el usuario lo haga y da una señal visual de acierto. No penaliza los errores. Cuando el usuario hace el acorde correcto, el acorde suena durante su duración con el patrón de acompañamiento y luego se espera el siguiente.
- Las progresiones se transcriben a la tonalidad que mejor encaje en el esquema de 7 grados. Si un acorde de la canción no es diatónico (prestado, con séptima, etc.), se simplifica al grado diatónico más cercano o se añade solo si el esquema de gestos lo permite sin complicarlo. El constructor lo decide por canción y lo anota en los datos.
- Las canciones se guardan como datos (acordes con su duración, tonalidad y tempo), así que agregar una canción nueva no requiere tocar el código. El motor de canciones guiadas y el modo que toca solo comparten el mismo secuenciador.

### 8.4 Modo que toca solo
- Repite una progresión de acordes en la tonalidad y con el sonido elegidos, con tempo ajustable (por ejemplo 60–160 BPM). Mientras suena, las manos del usuario siguen controlando el volumen y la expresión.

### 8.5 Filtro de Spider-Man
- **Actualización (decisión del usuario, 2026-11-14):** el casco 3D se reemplaza por una máscara 2D (`Filtros/spiderman.png`) deformada sobre la malla facial de 468 puntos de FaceLandmarker (estilo filtros de Instagram/Snapchat): se ajusta a la forma y gestos de la cara, conserva los colores y pesa ~200 KB. Lo de abajo sobre three.js/GLB queda obsoleto.
- three.js sobre el video, usando la matriz de transformación facial de FaceLandmarker y suavizado de la pose (el Python ya usa un alpha de 0,55). La calibración de reposo (escala 22,37, traslación [0, 2,5, −1,5], rotación 0) sale del programa Python y se reajusta para la web.
- El modelo se comprime (geometría y texturas más pequeñas) hasta ≤ 3 MB y **se carga solo cuando el usuario activa el filtro**, para no retrasar el inicio.
- La detección de cara corre siempre, porque también la usa el gesto de la boca, pero con un costo moderado (puede ir a menos cuadros por segundo que la de manos).

### 8.6 Aspecto visual
- Diseño original, oscuro o claro según lo que salga del proceso de diseño. Se usará el skill Impeccable con **maquetas para que el usuario apruebe la dirección visual antes de construir la interfaz**. Debe verse bien en el celular (vertical) y en la computadora.
- Pantallas: inicio (qué es, botón "Empezar", aviso de privacidad de la cámara) → instrumento (video con las manos dibujadas, acorde actual, controles de sonido, tonalidad y modos) → guía de gestos.

### 8.7 Privacidad, seguridad y rendimiento
- Sin servidor y sin enviar imágenes. Texto visible: "la cámara se procesa solo en tu dispositivo".
- Cabeceras de seguridad en el sitio (Content-Security-Policy restrictiva, permisos de cámara solo para el propio sitio).
- Los modelos de MediaPipe y la librería de visión se sirven desde el propio sitio o desde una CDN fija con versión exacta, y se guardan en caché por mucho tiempo.
- Metas: arranque listo para tocar en menos de unos 3 s en una computadora y menos de 6 s en un celular de gama media con buena conexión; detección de manos de unos 30 cuadros por segundo o más en una computadora; retraso entre gesto y sonido de menos de ~100 ms.
- Si el dispositivo no puede, degradar con elegancia: avisar, bajar la frecuencia de detección y apagar el filtro.

### 8.8 Pruebas
- Pruebas unitarias de la lógica pura: clasificación de gestos (con datos de puntos de la mano grabados como casos de prueba), teoría musical (acordes por tonalidad y grado), motor de canciones guiadas y secuenciador del modo que toca solo.
- Pruebas de extremo a extremo con navegador y cámara simulada para el flujo principal (permiso → tocar → cambiar de sonido).
- **El usuario puede probar durante el desarrollo.** Se construye pronto una pantalla de "grabación de gestos" (solo para desarrollo, no visible en la versión pública) que guarda los puntos de la mano, no la imagen, mientras el usuario hace cada gesto. Esas grabaciones se convierten en casos de prueba del clasificador. El plan incluye puntos de control donde el usuario prueba en su computadora y en su celular, con un enlace de vista previa, antes de seguir.

### 8.9 Dónde vive
- Una carpeta nueva `web/` dentro de `Portafolio`. Se inicializa un repositorio git en `Portafolio` (hoy no lo es), con un `.gitignore` que excluya `venv/`, `venv312/` y archivos pesados que no se usen. El programa Python queda intacto como referencia.
- Publicación en Vercel, conectada a un repositorio de GitHub. El usuario ya tiene ambas cuentas. Cada rama genera un enlace de vista previa para probar, y la versión pública sale de la rama principal. Crear el repositorio y conectar Vercel requiere que el usuario inicie sesión o lo apruebe en su momento.

## 9. Lo que queda a criterio del constructor

- Herramienta de construcción y estructura de carpetas (lo esperable es Vite + TypeScript, sin framework de interfaz pesado, o uno ligero si la interfaz lo pide).
- Los umbrales concretos, siempre que cumplan la sección 8.1 y se validen con pruebas.
- Cómo comprimir el modelo 3D y en qué formato.
- Diseño concreto del sonido de cada preset.
- La progresión por defecto del modo que toca solo.

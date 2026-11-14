# Instrumento con gestos (web) — Plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIO: usar superpowers:subagent-driven-development para ejecutar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`).

**Goal:** Una web estática que permite tocar acordes con las manos frente a la cámara, con varios sonidos, canciones guiadas (solo acordes), modo que toca solo y filtro 3D de Spider-Man, publicada en Vercel.

**Architecture:** Todo corre en el navegador. La lógica pura (teoría musical, clasificación de gestos, estabilizador, secuenciador) vive en módulos sin dependencias de navegador y se prueba con Vitest. Adaptadores delgados envuelven MediaPipe (visión), Tone.js (audio) y three.js (filtro). Un controlador (`InstrumentController`) une gestos y audio a través de interfaces, para poder probarlo con dobles.

**Tech Stack:** Vite + TypeScript (strict), Vitest, Playwright, `@mediapipe/tasks-vision`, `tone`, `three`, `@gltf-transform/cli` (solo para desarrollo). Versiones **exactas** en `package.json` (sin `^` ni `~`), la última estable con al menos 2 semanas de antigüedad.

**Spec:** `docs/superpowers/specs/2026-11-14-instrumento-gestos-web-design.md` (léelo antes de cada tarea).

## Global Constraints

- Sin servidor: sitio estático. Ninguna imagen ni dato de cámara sale del dispositivo. Ningún secreto en el código.
- No copiar código, textos, nombres de presets ni diseño de Gesture Synth.
- Canciones: "City of Stars", "Can't Take My Eyes Off You", "Glimpse of Us". **Solo progresiones de acordes**: sin melodía, sin letra, sin audio, partitura ni imágenes oficiales. Se presentan como "Acordes de …". El acompañamiento es un patrón original.
- No usar ninguna grabación existente (`Piano/`, `Guitarra/`, `Violin/`, `*.wav` de la raíz). Las muestras nuevas deben tener una licencia que permita redistribuirlas (CC0, CC-BY o equivalente), registrada en `web/public/CREDITS.md` y visible en la web.
- Spider-Man: crédito "Modelo 3D de uso libre, autor desconocido. Demo de fan sin fines comerciales." El modelo comprimido debe pesar ≤ 3 MB y cargarse solo al activar el filtro.
- Metas: ≤ ~3 s hasta poder tocar en una computadora y ≤ ~6 s en un celular de gama media; ≥ ~30 fps de detección de manos en una computadora; < ~100 ms desde el gesto hasta el inicio del acorde.
- Boca: apertura = |y(14) − y(13)| / |x(291) − x(61)| (igual que `PianoVirtual.py:123`). Cambia de sonido al superar 0,28 y se rearma al bajar de 0,20.
- Pose del filtro: suavizado con alpha 0,55. Calibración inicial: escala 22,373248, traslación [0, 2.5, −1.5], rotación [0, 0, 0] (se reajusta para la web).
- Reglas del usuario: TDD (ver la prueba fallar por la razón correcta), **una rama por tarea** (`feat/<n>-<slug>`), nunca dos agentes en la misma rama ni en el mismo archivo, `code-reviewer` antes de unir cada rama, máximo 4 agentes a la vez, ningún agente lanza subagentes.
- Todo el texto visible está en español.

## Review Focus

1. **Espejo y lateralidad:** el video se muestra en espejo y MediaPipe etiqueta las manos según la imagen. La mano derecha **física** del usuario siempre elige el acorde. → Prueba en Tarea 5 (`assignHands`).
2. **Cámara rechazada, ausente u ocupada por otra app:** mensaje claro en español con botón de reintentar, nunca una pantalla en blanco. → Prueba E2E en Tarea 12.
3. **Mano saliendo del encuadre o detección dudosa:** puntos fuera de [0,1] o confianza < 0,6 cuentan como "sin mano", lo que produce un fundido y nunca notas fantasma. → Prueba en Tarea 5.
4. **Audio bloqueado hasta que el usuario toca algo (Safari/iOS) y pestaña oculta:** el audio arranca con el botón "Empezar". Al ocultar la pestaña se suelta el acorde y se pausa el modo automático. → Prueba en Tarea 9.
5. **Más de dos manos o dos manos del mismo lado:** se queda con una mano por lado (la de mayor confianza). → Prueba en Tarea 5.

---

## Estructura de archivos (`web/`)

```
web/
  index.html                  pantalla principal
  recorder.html               grabación de gestos (solo dev, excluida del build público)
  vercel.json                 cabeceras de seguridad
  public/models/spiderman.glb (comprimido)   public/samples/<instr>/*.mp3   public/CREDITS.md
  scripts/compress-model.mjs
  src/
    music/theory.ts           tonalidades, grados, acordes diatónicos
    gestures/types.ts         Landmark, GestureName, GestureGuess
    gestures/degree.ts        seña → grado
    gestures/stabilizer.ts    confirmación temporal
    gestures/expression.ts    mano izquierda → volumen/brillo
    gestures/mouth.ts         apertura + disparador
    gestures/assignHands.ts   espejo, filtrado y una mano por lado
    vision/tracker.ts         adaptador MediaPipe
    audio/presets.ts          catálogo de sonidos
    audio/engine.ts           adaptador Tone.js (implementa SoundEngine)
    songs/types.ts  songs/sequencer.ts  songs/data/*.json
    face/pose.ts              suavizado + matriz de reposo (puro)
    face/filter.ts            adaptador three.js (carga diferida)
    app/controller.ts         InstrumentController
    ui/…                      pantallas (Tarea 11)
    main.ts
  tests/unit/…  tests/fixtures/hands/*.json  tests/e2e/…
```

Grafo de dependencias (para paralelizar, máximo 4 a la vez): T1 → {T2, T3, T4, T7, T10-modelo} → T5 (necesita T3) → T5 → T6 → T8 (necesita T2) → T9 (necesita T4, T5, T7, T8) → T11 (diseño, puede arrancar tras T1 en paralelo) → T12 → T13.

---

### Task 1: Repositorio, proyecto base y prueba humo

**Files:** Create: `.gitignore`, `web/` (Vite vanilla-ts), `web/vitest.config.ts`, `web/playwright.config.ts`, `web/tests/unit/smoke.test.ts`

**Interfaces:** Produces: scripts `npm test` (Vitest), `npm run e2e` (Playwright), `npm run build`, `npm run dev`.

- [ ] **Step 1:** `git init` en `Portafolio`, rama `main`. `.gitignore` con: `venv/`, `venv312/`, `__pycache__/`, `*.wav`, `Filtros/source/`, `Filtros/textures/`, `face_landmarker.task`, `web/node_modules/`, `web/dist/`, `web/test-results/`. Commit inicial solo con `docs/` y `.gitignore` (más los `.py` como referencia).
- [ ] **Step 2:** Rama `feat/1-scaffold`. Crear el proyecto Vite TS en `web/` con `strict: true` y versiones exactas.
- [ ] **Step 3:** Escribir `smoke.test.ts`: `expect(1 + 1).toBe(2)` importando un `src/version.ts` que aún no existe. Correr `npm test` → FALLA por módulo inexistente.
- [ ] **Step 4:** Crear `src/version.ts` (`export const APP_NAME = 'instrumento-gestos'`). `npm test` → PASA. `npm run build` → sin errores.
- [ ] **Step 5:** Commit `chore: scaffold web project`.

### Task 2: Teoría musical

**Files:** Create: `web/src/music/theory.ts` · Test: `web/tests/unit/music/theory.test.ts`

**Interfaces:** Produces:
```ts
export type PitchClass = 'C'|'C#'|'D'|'D#'|'E'|'F'|'F#'|'G'|'G#'|'A'|'A#'|'B';
export type Mode = 'major'|'minor';
export interface Key { tonic: PitchClass; mode: Mode }
export type Degree = 1|2|3|4|5|6|7;
export type Quality = 'maj'|'min'|'dim';
export interface Chord { degree: Degree; root: PitchClass; quality: Quality; notes: string[]; label: string } // notes como 'C4'
export const ALL_KEYS: Key[];                       // 24
export function chordForDegree(key: Key, degree: Degree, octave?: number): Chord; // octave por defecto 3
export function romanNumeral(key: Key, degree: Degree): string; // 'I','ii','vii°'…
```

- [ ] **Step 1: Pruebas que fallan:**
  - `chordForDegree({tonic:'C',mode:'major'},1)` → root `C`, `maj`, notes `['C3','E3','G3']`, label `'C'`.
  - Do mayor, grados 2/3/6 → `min`; grado 7 → `dim`, root `B`, label `'B°'`.
  - La menor natural, grado 1 → `min` `['A3','C4','E4']`; grado 3 → `maj` root `C`; grado 5 → `min` root `E`.
  - Si mayor (B), grado 5 → root `F#`, notes `['F#3','A#3','C#4']`.
  - `ALL_KEYS.length === 24`; `romanNumeral(C major, 7) === 'vii°'`.
- [ ] **Step 2:** `npm test -- theory` → FALLA (módulo inexistente).
- [ ] **Step 3:** Implementar con intervalos de escala (mayor `[0,2,4,5,7,9,11]`, menor natural `[0,2,3,5,7,8,10]`) y triadas por apilamiento de terceras. Notación con sostenidos.
- [ ] **Step 4:** `npm test -- theory` → PASA.
- [ ] **Step 5:** Commit `feat(music): diatonic chords for 24 keys`.

### Task 3: Señas → grado

**Files:** Create: `web/src/gestures/types.ts`, `web/src/gestures/degree.ts` · Test: `web/tests/unit/gestures/degree.test.ts`

**Interfaces:**
```ts
// types.ts
export interface Landmark { x: number; y: number; z: number }
export type GestureName = 'None'|'Closed_Fist'|'Open_Palm'|'Pointing_Up'|'Thumb_Down'|'Thumb_Up'|'Victory'|'ILoveYou';
export interface GestureGuess { name: GestureName; score: number }
// degree.ts
export const GESTURE_TO_DEGREE: Record<Exclude<GestureName,'None'>, Degree>;
export function degreeFromGesture(g: GestureGuess | null, minScore?: number): Degree | null; // minScore 0.6
```
**Esquema (decisión del usuario, ver spec 8.1):** `Pointing_Up`=1 · `Victory`=2 · `ILoveYou`=3 · `Thumb_Up`=4 · `Open_Palm`=5 · `Thumb_Down`=6 · `Closed_Fist`=7 · `None`, sin mano o score < 0,6 = `null`.

- [ ] **Step 1: Pruebas que fallan:** las 7 señas dan su grado con score 0,9. `None` da `null`. `Victory` con score 0,59 da `null` y con 0,6 da 2. `null` da `null`. Los 7 grados aparecen exactamente una vez en `GESTURE_TO_DEGREE`.
- [ ] **Step 2:** `npm test -- degree` → FALLA (módulo inexistente).
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** → PASA.
- [ ] **Step 5:** Commit `feat(gestures): gesture to degree map`.

### Task 4: Estabilizador, expresión y boca

**Files:** Create: `web/src/gestures/stabilizer.ts`, `expression.ts`, `mouth.ts` · Test: los `.test.ts` correspondientes en `tests/unit/gestures/`

**Interfaces:**
```ts
export class Stabilizer<T> { constructor(opts: { minStableMs: number }); update(v: T | null, nowMs: number): T | null; current(): T | null }
export interface Expression { volume: number; brightness: number } // 0..1
export class ExpressionTracker { constructor(opts?: { smoothing?: number }); update(lm: Landmark[] | null): Expression }
export function mouthOpenness(face: Landmark[]): number;
export class MouthTrigger { constructor(opts?: { open?: number; close?: number }); update(openness: number): boolean } // true solo en el flanco de apertura
```
Valores: `minStableMs = 80`. Expresión por defecto `{volume: 0.7, brightness: 0.5}`. Volumen: la muñeca en `y = 0.85` da 0 y en `y = 0.15` da 1 (con recorte). Brillo: inclinación de la línea base del índice → base del meñique, de −45° (0) a +45° (1). Suavizado exponencial con 0,3.

- [ ] **Step 1: Pruebas que fallan:**
  - `Stabilizer`: el valor 3 a t = 0, 50 y 79 ms da `null` (si no había nada antes); a 80 ms da 3. Un cambio a 5 mantiene el 3 hasta que el 5 dura 80 ms. Recibir `null` durante 80 ms da `null`.
  - `ExpressionTracker.update(null)` vuelve gradualmente al valor por defecto. Una muñeca en y = 0,15 converge a un volumen de ~1.
  - `mouthOpenness` con 13/14 separados 0,05 y 61/291 separados 0,2 da 0,25. Con ancho 0 da 0.
  - `MouthTrigger` con la secuencia 0,1, 0,3, 0,3, 0,25, 0,1, 0,3 da false, true, false, false, false, true.
- [ ] **Step 2:** `npm test -- stabilizer expression mouth` → FALLA.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** → PASA.
- [ ] **Step 5:** Commit `feat(gestures): stabilizer, expression, mouth trigger`.

### Task 5: Adaptador de visión y asignación de manos

**Files:** Create: `web/src/gestures/assignHands.ts`, `web/src/vision/tracker.ts` · Test: `tests/unit/gestures/assignHands.test.ts`

**Interfaces:**
```ts
export interface RawHand { label: 'Left'|'Right'; score: number; landmarks: Landmark[]; gesture: GestureGuess | null }
export interface AssignedHands { chordHand: RawHand | null; expressionHand: RawHand | null }
export function assignHands(hands: RawHand[], opts: { mirrored: boolean; minScore?: number }): AssignedHands; // minScore 0.6
export interface FaceFrame { landmarks: Landmark[]; matrix: Float32Array /* 4x4 column-major */ }
export interface VisionFrame { t: number; hands: RawHand[]; face: FaceFrame | null }
export class Tracker {
  static create(video: HTMLVideoElement, opts?: { faceEveryNFrames?: number }): Promise<Tracker>; // por defecto 2
  start(onFrame: (f: VisionFrame) => void): void; stop(): void;
}
```

- [ ] **Step 1: Pruebas que fallan (Review Focus 1, 3 y 5):**
  - Con `mirrored: true`, una mano con etiqueta `'Left'` es la mano derecha física, así que va a `chordHand`. Con `mirrored: false` es al revés. Esto se documenta en un comentario de prueba, verificado con la documentación de MediaPipe (las imágenes de la cámara frontal se asumen en espejo).
  - Una mano con score 0,5 se ignora. Una mano con algún punto en x = 1,08 se ignora.
  - Tres manos (dos `'Left'` con score 0,9 y 0,7, y una `'Right'`) da una mano por lado, quedándose con la de 0,9.
  - Sin manos da los dos lados `null`.
- [ ] **Step 2:** → FALLA. **Step 3:** Implementar `assignHands`. `Tracker` usa `GestureRecognizer` (numHands 2, delegate `GPU` con respaldo a `CPU`; entrega puntos, lateralidad y seña de cada mano) y `FaceLandmarker` (`outputFacialTransformationMatrixes: true`, numFaces 1) en modo `VIDEO`, con WASM y modelos servidos desde `public/mediapipe/` (copiados en el build) y caché inmutable. **Step 4:** → PASA.
- [ ] **Step 5:** Commit `feat(vision): tracker adapter and hand assignment`.

### Task 6: Pantalla de grabación y vista previa en Vercel (punto de control del usuario)

**Files:** Create: `web/recorder.html`, `web/src/dev/recorder.ts`, `web/vercel.json`, `web/tests/fixtures/hands/README.md` · Test: `tests/unit/dev/recorder.test.ts`

**Interfaces:** Produces: formato de grabación `{ gesture: Degree | 'none'; device: string; frames: { t: number; hands: RawHand[] }[] }` en JSON. Consumes `Tracker`, `assignHands`, `degreeFromGesture`.

- [ ] **Step 1:** Prueba que falla: `serializeRecording(...)` incluye solo puntos (sin imagen) y `parseRecording` lo lee de vuelta igual (ida y vuelta).
- [ ] **Step 2:** → FALLA. **Step 3:** Implementar la pantalla: elegir gesto → contar 3 → grabar 3 s → descargar el JSON. `recorder.html` solo existe en el build de vista previa (`VITE_ENABLE_RECORDER=1`), no en producción. `vercel.json` con `Content-Security-Policy` (default-src 'self'; media/worker/wasm según necesite MediaPipe; sin `unsafe-inline` en scripts), `Permissions-Policy: camera=(self), microphone=()`, `Referrer-Policy: no-referrer` y `X-Content-Type-Options: nosniff`. **Step 4:** → PASA.
- [ ] **Step 5:** Crear el repo en GitHub y conectarlo a Vercel. **Requiere que el usuario inicie sesión o lo apruebe** (lo hace la sesión principal, no el agente). Commit, push y obtener el enlace de vista previa.
- [ ] **Step 6: Punto de control:** el usuario graba las 7 señas y la mano relajada o fuera de una seña (`'none'`), con la derecha, y la mano izquierda arriba, abajo e inclinada, en computadora y celular. Los JSON van a `tests/fixtures/hands/` y se agrega `tests/unit/gestures/recorded.test.ts`, que exige que `degreeFromGesture` (sobre la seña que dio el reconocedor en cada cuadro) acierte en ≥ 95 % de los cuadros de cada gesto y que haya **0** cuadros con un grado distinto en `'none'`. Si alguna seña falla, primero se ajusta `minScore` o `minStableMs` (rama nueva). Si no alcanza, se reentrena el clasificador con MediaPipe Model Maker usando las grabaciones, y se consulta antes al usuario.

### Task 7: Canciones y secuenciador

**Files:** Create: `web/src/songs/types.ts`, `sequencer.ts`, `data/city-of-stars.json`, `data/cant-take-my-eyes-off-you.json`, `data/glimpse-of-us.json` · Test: `tests/unit/songs/sequencer.test.ts`, `songs-data.test.ts`

**Interfaces:**
```ts
export interface SongStep { degree: Degree; beats: number; note?: string } // note: simplificación hecha
export interface Song { id: string; title: string; artist: string; key: Key; bpm: number; steps: SongStep[] }
export class GuidedSession { constructor(song: Song); current(): SongStep; upcoming(n: number): SongStep[]; submit(d: Degree | null): 'hit'|'wait'; isDone(): boolean; restart(): void }
export function stepAtBeat(steps: SongStep[], beat: number, loop: boolean): { index: number; step: SongStep } | null;
```

- [ ] **Step 1: Pruebas que fallan:** cada JSON cumple el esquema (degree 1–7, beats > 0, bpm entre 50 y 200, título con autor) y **no tiene campos de melodía ni letra**. `GuidedSession.submit` con el grado correcto da `'hit'` y avanza; con otro grado da `'wait'` y no avanza. `stepAtBeat` con steps de 4+4 beats da index 1 en el beat 5, y con `loop` en el beat 9 vuelve a index 0.
- [ ] **Step 2:** → FALLA. **Step 3:** Implementar. Transcribir las progresiones (solo acordes) a una tonalidad donde quepan en 7 grados diatónicos. Los acordes no diatónicos se simplifican al grado más cercano, con `note` explicando el cambio. **Step 4:** → PASA. **Step 5:** Commit `feat(songs): chord-only guided songs and sequencer`.

### Task 8: Motor de audio, sonidos y muestras con licencia

**Files:** Create: `web/src/audio/presets.ts`, `engine.ts`, `web/public/samples/**`, `web/public/CREDITS.md`, `web/scripts/check-samples.mjs` · Test: `tests/unit/audio/presets.test.ts`, `tests/unit/audio/samples.test.ts`

**Interfaces:**
```ts
export type PresetId = 'piano'|'guitarra'|'violin'|'calido'|'cristal'|'8bit'|'nube';
export interface Preset { id: PresetId; name: string; behavior: 'sustain'|'strum'; samples?: { baseUrl: string; notes: Record<string,string> } }
export const PRESETS: Preset[];
export interface SoundEngine {
  start(): Promise<void>;                     // reanuda el AudioContext tras un gesto del usuario
  setPreset(id: PresetId): Promise<void>;     // carga las muestras bajo demanda
  playChord(chord: Chord): void;              // sustain: mantiene; strum: rasguea y repite a un pulso suave
  release(fadeMs?: number): void;             // por defecto 250
  setExpression(e: Expression): void;         // volumen + frecuencia de corte del filtro
  setBpm(bpm: number): void;
}
export class ToneEngine implements SoundEngine { … }
```
Fuentes candidatas (el agente **verifica la licencia** antes de usarlas): piano: Salamander Grand Piano (CC-BY 3.0); violín: VSCO 2 Community Edition (CC0); guitarra: buscar una fuente CC0 o CC-BY. Si no hay ninguna, usar `PluckSynth` de Tone y anotarlo. Muestras cada 3 semitonos (o menos) entre C3 y C5, en mp3 o ogg de ~96 kbps.

- [ ] **Step 1: Pruebas que fallan:** `PRESETS` tiene los 7 ids, nombres en español y ninguno igual a los de Gesture Synth (`Warm`, `Bright`, `Retro Synth`, `Dreamy`, `Strings`, `Horns`). Piano, guitarra y violín son `strum` (salvo violín, que puede ser `sustain`). `samples.test.ts`: cada archivo listado en un preset existe, cada carpeta de muestras aparece en `CREDITS.md` con licencia y autor, y el peso total por instrumento es ≤ 1,5 MB.
- [ ] **Step 2:** → FALLA. **Step 3:** Implementar `ToneEngine` (prueba manual en el navegador; la lógica de decisión vive en el controlador). Descargar, recortar y comprimir las muestras. **Step 4:** → PASA. **Step 5:** Commit `feat(audio): presets, tone engine, licensed samples`.

### Task 9: Controlador del instrumento

**Files:** Create: `web/src/app/controller.ts` · Test: `tests/unit/app/controller.test.ts`

**Interfaces:**
```ts
export type PlayMode = { kind: 'free' } | { kind: 'guided'; song: Song } | { kind: 'auto'; song: Song }; // distinto de music/Mode
export class InstrumentController {
  constructor(deps: { engine: SoundEngine; now: () => number; key: Key; mirrored: boolean });
  onFrame(f: VisionFrame): void;
  setKey(k: Key): void; setPreset(id: PresetId): Promise<void>; setMode(m: PlayMode): void;
  onVisibilityChange(hidden: boolean): void;
  subscribe(fn: (s: ControllerState) => void): () => void;
}
export interface ControllerState { degree: Degree | null; chord: Chord | null; expression: Expression; preset: PresetId; guided?: { index: number; lastResult: 'hit'|'wait' }; handsVisible: { chord: boolean; expression: boolean } }
```

- [ ] **Step 1: Pruebas que fallan (con un `FakeEngine` que registra las llamadas):**
  - En modo libre, si el grado 4 se mantiene 80 ms, se llama `playChord(chordForDegree(key,4))` **una sola vez** (los cuadros repetidos no lo vuelven a llamar).
  - Si la mano del acorde desaparece 80 ms, se llama `release()`. Un solo cuadro con un grado distinto no cambia nada.
  - Un flanco de boca (MouthTrigger) pasa al siguiente preset del ciclo.
  - En modo guiado, el grado incorrecto no suena y el correcto da `hit` y suena.
  - En modo automático, el acorde sale de `stepAtBeat` y la mano izquierda sigue llamando `setExpression`.
  - `onVisibilityChange(true)` llama `release()` y pausa el modo automático (Review Focus 4).
- [ ] **Step 2:** → FALLA. **Step 3:** Implementar componiendo `assignHands` → `degreeFromGesture` → `Stabilizer` + `ExpressionTracker` + `MouthTrigger`. **Step 4:** → PASA. **Step 5:** Commit `feat(app): instrument controller`.

### Task 10: Filtro de Spider-Man

**Files:** Create: `web/scripts/compress-model.mjs`, `web/public/models/spiderman.glb`, `web/src/face/pose.ts`, `web/src/face/filter.ts` · Test: `tests/unit/face/pose.test.ts`, `tests/unit/face/model-size.test.ts`

**Interfaces:**
```ts
export const BIND = { scale: 22.373248, translation: [0, 2.5, -1.5], rotationDeg: [0, 0, 0] } as const;
export function bindMatrix(b?: typeof BIND): Float32Array;
export function smoothPose(prev: Float32Array | null, next: Float32Array, alpha?: number): Float32Array; // alpha 0.55
export class FaceFilter { static load(canvas: HTMLCanvasElement, url: string): Promise<FaceFilter>; update(face: FaceFrame | null): void; setVisible(v: boolean): void; dispose(): void }
```

- [ ] **Step 1: Pruebas que fallan:** `smoothPose(null, M)` da M. Con prev = I y next = traslación (10,0,0) y alpha 0,55, la traslación resultante es 5,5 en x (o el comportamiento que tenga `suavizar_matriz_cabeza` en `PianoVirtual.py:194`: el agente lo lee y lo replica). `bindMatrix()` aplicada al origen da (0, 2.5, −1.5) tras la escala. `model-size.test.ts`: `public/models/spiderman.glb` pesa ≤ 3 MB.
- [ ] **Step 2:** → FALLA. **Step 3:** `compress-model.mjs` lee `../Filtros/source/spiderman.glb` y genera el modelo con texturas de máximo 1024 px en WebP y geometría comprimida (meshopt o draco). `FaceFilter` se importa con `import()` dinámico solo al activar el filtro, con una cámara three.js de FOV vertical 63°, near 1 y far 10000 (igual que el Python). Si `face` es `null`, oculta el modelo. **Step 4:** → PASA, y además se verifica a ojo en la vista previa que la máscara sigue la cabeza. **Step 5:** Commit `feat(face): compressed spider-man filter`.

### Task 11: Dirección visual (punto de control del usuario)

- [ ] **Step 1:** Usar el skill **Impeccable** para proponer 2 o 3 direcciones visuales originales (pantalla de inicio e instrumento, en celular y computadora), como maquetas que el usuario pueda ver.
- [ ] **Step 2: Punto de control:** el usuario elige una. Se guarda la decisión en `web/DESIGN.md` (colores, tipografías, espaciado y componentes). Commit `docs: visual direction`.

### Task 12: Interfaz

**Files:** Create: `web/src/ui/*.ts`, `web/src/ui/styles.css`, `web/src/main.ts`, `web/tests/e2e/*.spec.ts`

**Interfaces:** Consumes `InstrumentController`, `Tracker`, `ToneEngine`, `FaceFilter`, `PRESETS`, `ALL_KEYS`, las canciones de `songs/data`.

Pantallas: inicio (qué es, "Empezar", "La cámara se procesa solo en tu dispositivo") → instrumento (video en espejo con las manos dibujadas, acorde actual y número romano, sonido, tonalidad, modo libre/guiado/automático, BPM, interruptor del filtro) → guía de gestos (las 7 señas de la Tarea 3 con ilustraciones propias) → créditos (`CREDITS.md`, aviso de Spider-Man, "Acordes de …").

- [ ] **Step 1: Pruebas E2E que fallan** (Playwright con `--use-fake-device-for-media-stream` y un video de muestra `--use-file-for-fake-video-capture`):
  - Al pulsar "Empezar" aparece el video y desaparece "Esperando tus manos…" cuando hay una mano en el video.
  - Con el permiso de cámara rechazado aparece el mensaje en español y el botón "Reintentar" (Review Focus 2).
  - Cambiar el sonido con el botón actualiza la etiqueta. Elegir una canción guiada muestra "Acordes de City of Stars" y el primer gesto.
  - La página de créditos menciona cada licencia y el aviso de Spider-Man.
- [ ] **Step 2:** → FALLA. **Step 3:** Implementar siguiendo `web/DESIGN.md`. Debe ser accesible (contraste, foco visible, botones con texto y `prefers-reduced-motion`). **Step 4:** → PASA. **Step 5:** Commit `feat(ui): instrument screens`.

### Task 13: Rendimiento, prueba final y publicación (punto de control del usuario)

- [ ] **Step 1:** Medir en la vista previa (Lighthouse y un contador de fps en dev): tiempo hasta poder tocar, fps de detección y peso de la carga inicial (sin el modelo 3D ni las muestras de instrumentos no elegidos). Comparar con las metas de Global Constraints. Si no se cumplen, abrir una rama de mejora.
- [ ] **Step 2:** Correr todas las pruebas (`npm test && npm run e2e && npm run build`). Hacer una revisión completa con `code-reviewer` y `security-scanner` (cabeceras, CSP, ningún dato saliente).
- [ ] **Step 3: Punto de control:** el usuario prueba en su celular y su computadora. Se corrige lo que haga falta.
- [ ] **Step 4:** Unir a `main` y desplegar a producción en Vercel (con el OK del usuario).

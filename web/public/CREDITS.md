# Créditos

## samples/piano
- Instrumento: Salamander Grand Piano V2 (Yamaha C5). Se incluyen 9 notas, una cada 3 semitonos de C3 a C5.
- Autor: Alexander Holm
- Licencia: CC-BY 3.0 (https://creativecommons.org/licenses/by/3.0/)
- Modificaciones: ninguna por nosotros. Son copias sin cambios de los mp3 que publica el proyecto Tone.js (el proyecto Tone.js ya los había convertido a mp3 desde las grabaciones originales).
- Fuente: https://github.com/tonejs/audio/tree/master/salamander (su README indica la licencia CC-BY 3.0 y al autor)

## samples/violin
- Instrumento: violín de VSCO 2 Community Edition. Se incluyen 9 notas, de A3 a A5.
- Autor: Versilian Studios (proyecto VSCO 2 Community Edition)
- Licencia: CC0 1.0 (dominio público)
- Modificaciones: a partir de los mp3 ya recortados de tonejs-instruments, los recortamos a 3 s, los pasamos a mono, mp3 de 96 kbps, con un fundido de salida de 0,6 s.
- Fuente: https://github.com/nbrosowsky/tonejs-instruments/tree/master/samples/violin (su archivo https://github.com/nbrosowsky/tonejs-instruments/blob/master/sample-source-info.txt declara el violín como VSO2). La licencia CC0 de VSCO 2 CE está en https://github.com/sgossner/VSCO-2-CE/blob/master/LICENSE

## Guitarra
- Sintetizada en el navegador con PluckSynth de Tone.js (MIT, https://github.com/Tonejs/Tone.js). No usa muestras: no se encontró una fuente de guitarra con licencia CC0/CC-BY clara.

## Máscara de Spider-Man (filters/spiderman-mask.webp)
- Dibujo 2D de la máscara de uso libre, autor desconocido. Demo de fan sin fines comerciales.
- Modificaciones: reducido a 768 px de ancho y convertido a WebP con transparencia (scripts/build-mask-image.mjs).

## Malla de la cara (src/face/faceMesh.json)
- Triángulos y coordenadas UV del modelo canónico de la cara de MediaPipe (canonical_face_model.obj).
- Autor: The MediaPipe Authors (Google). Licencia: Apache 2.0 (https://www.apache.org/licenses/LICENSE-2.0)
- Modificaciones: solo se conservan los triángulos y una UV por vértice (scripts/build-face-mesh.mjs). Aviso completo en src/face/faceMesh.LICENSE.txt
- Fuente: https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model.obj

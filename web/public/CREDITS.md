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

## MediaPipe
- Biblioteca @mediapipe/tasks-vision y el modelo gesture_recognizer (señas de las manos), que corren en tu dispositivo.
- Autor: The MediaPipe Authors (Google)
- Licencia: Apache 2.0 (https://www.apache.org/licenses/LICENSE-2.0)
- Modificaciones: ninguna. Se copian tal cual a public/mediapipe (scripts/fetch-mediapipe.mjs).
- Fuente: https://github.com/google-ai-edge/mediapipe

## Tipografía
- Archivo, de Omnibus-Type (The Archivo Project Authors).
- Licencia: SIL Open Font License 1.1 (https://openfontlicense.org). El texto completo va junto a la fuente en src/ui/fonts/Archivo-OFL.txt.
- Modificaciones: ninguna. Se incluye el archivo variable (subconjunto latino, ejes de ancho y peso) de @fontsource-variable/archivo 5.3.0.
- Fuente: https://github.com/Omnibus-Type/Archivo

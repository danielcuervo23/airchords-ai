import { assignHands } from '../gestures/assignHands';
import { degreeFromGesture } from '../gestures/degree';
import { HANDEDNESS_LABELS_SWAPPED, Tracker, type VisionFrame } from '../vision/tracker';
import { serializeRecording, type Recording, type RecordedFrame } from './recording';

const OPTIONS: { value: string; label: string }[] = [
  { value: '1', label: '☝️ 1' },
  { value: '2', label: '✌️ 2' },
  { value: '3', label: '🤟 3' },
  { value: '4', label: '👍 4' },
  { value: '5', label: '🖐️ 5' },
  { value: '6', label: '👎 6' },
  { value: '7', label: '✊ 7' },
  { value: 'none', label: 'Sin seña / mano relajada' },
];
const COUNTDOWN_S = 3;
const RECORD_MS = 3000;

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const video = $<HTMLVideoElement>('video');
const readout = $('readout');
const statusEl = $('status');
const errorEl = $('error');
const select = $<HTMLSelectElement>('gesture');
const button = $<HTMLButtonElement>('record');

for (const o of OPTIONS) select.add(new Option(o.label, o.value));

let sink: RecordedFrame[] | null = null;
let aspect = 1;

function showReadout(f: VisionFrame): void {
  const { chordHand } = assignHands(f.hands, { labelsSwapped: HANDEDNESS_LABELS_SWAPPED });
  if (!chordHand) {
    readout.textContent = 'Mano de acordes: no detectada';
    return;
  }
  const g = chordHand.gesture;
  const degree = degreeFromGesture(g);
  readout.textContent =
    `Mano de acordes detectada: DERECHA ✔ | seña: ${g?.name ?? 'ninguna'} ` +
    `(${g ? g.score.toFixed(2) : '-'}) | grado: ${degree ?? 'ninguno'}`;
}

function onFrame(f: VisionFrame): void {
  aspect = f.aspect;
  showReadout(f);
  sink?.push({ t: f.t, hands: f.hands });
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function download(rec: Recording): void {
  const url = URL.createObjectURL(new Blob([serializeRecording(rec)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${rec.gesture}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function record(): Promise<void> {
  button.disabled = true;
  select.disabled = true;
  const value = select.value;
  for (let i = COUNTDOWN_S; i > 0; i--) {
    statusEl.textContent = `Prepárate... ${i}`;
    await sleep(1000);
  }
  statusEl.textContent = '🔴 Grabando...';
  const frames: RecordedFrame[] = [];
  sink = frames;
  await sleep(RECORD_MS);
  sink = null;
  const gesture = value === 'none' ? 'none' : (Number(value) as Recording['gesture']);
  download({ gesture, device: navigator.userAgent, labelsSwapped: HANDEDNESS_LABELS_SWAPPED, aspect, frames });
  statusEl.textContent = `Listo: ${frames.length} cuadros guardados. Se descargó el archivo.`;
  button.disabled = false;
  select.disabled = false;
}

async function openCamera(): Promise<boolean> {
  try {
    video.srcObject = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    await video.play();
    return true;
  } catch (e) {
    const name = e instanceof DOMException ? e.name : '';
    errorEl.textContent =
      name === 'NotFoundError' || name === 'OverconstrainedError'
        ? 'No se encontró ninguna cámara en este dispositivo.'
        : 'No se pudo usar la cámara. Revisa que diste permiso al navegador y que ninguna otra app la esté usando.';
    return false;
  }
}

async function main(): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia) {
    errorEl.textContent = 'Este navegador no permite usar la cámara (se necesita HTTPS o localhost).';
    return;
  }
  if (!(await openCamera())) {
    readout.textContent = '';
    return;
  }
  try {
    const tracker = await Tracker.create(video);
    tracker.start(onFrame, (e) => console.error('Error de seguimiento', e));
    readout.textContent = 'Mostrando tu mano...';
    button.disabled = false;
    button.addEventListener('click', () => void record());
  } catch (e) {
    console.error(e);
    errorEl.textContent = 'No se pudo cargar el reconocedor de manos. Recarga la página.';
  }
}

void main();

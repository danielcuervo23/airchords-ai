// Dev-only page: webcam + Spider-Man mask, to eyeball that it follows the head.
import { Tracker } from '../vision/tracker';

const video = document.getElementById('video') as HTMLVideoElement;
const canvas = document.getElementById('filter') as HTMLCanvasElement;
const errorEl = document.getElementById('error') as HTMLElement;

async function main(): Promise<void> {
  try {
    video.srcObject = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    await video.play();
    const { FaceFilter } = await import('../face/filter'); // loaded only now
    const filter = await FaceFilter.load(canvas, `${import.meta.env.BASE_URL}models/spiderman.glb`);
    const tracker = await Tracker.create(video, { faceEveryNFrames: 1 });
    window.addEventListener('pagehide', () => {
      tracker.close();
      filter.dispose();
    });
    tracker.start((f) => filter.update(f.face), (e) => console.error('Error de seguimiento', e));
  } catch (e) {
    console.error(e);
    errorEl.textContent = 'No se pudo iniciar la cámara o el filtro.';
  }
}

void main();

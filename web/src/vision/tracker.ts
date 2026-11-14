import { FilesetResolver, GestureRecognizer } from '@mediapipe/tasks-vision';
import type { RawHand } from '../gestures/assignHands';
import { toRawHands } from './toRawHands';

/** One camera frame's result. v1 tracks hands only (no face model: the mouth switch was removed). */
export interface VisionFrame { t: number; aspect: number; hands: RawHand[] }

/**
 * Verified with a real camera on 2026-11-14: MediaPipe labels on the raw (unflipped)
 * frame already match the user's physical hands.
 * Pass this as `labelsSwapped` to assignHands.
 */
export const HANDEDNESS_LABELS_SWAPPED = false;

const BASE = `${import.meta.env.BASE_URL}mediapipe/`;
const GESTURE_MODEL = `${BASE}models/gesture_recognizer.task`;

type Fileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

async function createGestures(fileset: Fileset): Promise<GestureRecognizer> {
  const make = (delegate: 'GPU' | 'CPU') =>
    GestureRecognizer.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: GESTURE_MODEL, delegate },
      numHands: 2,
      runningMode: 'VIDEO',
    });
  try {
    return await make('GPU');
  } catch (e) {
    console.warn('GPU delegate failed, falling back to CPU', e);
    return make('CPU');
  }
}

export class Tracker {
  private cancel: (() => void) | null = null;
  private running = false;
  private closed = false;
  private lastTs = -1;

  private constructor(
    private readonly video: HTMLVideoElement,
    private readonly gestures: GestureRecognizer,
  ) {}

  static async create(video: HTMLVideoElement): Promise<Tracker> {
    const fileset = await FilesetResolver.forVisionTasks(`${BASE}wasm`);
    return new Tracker(video, await createGestures(fileset));
  }

  start(onFrame: (f: VisionFrame) => void, onError?: (e: unknown) => void): void {
    if (this.closed) return;
    this.stop();
    this.running = true;
    const v = this.video;
    const tick = (): void => {
      if (!this.running) return;
      try {
        this.step(onFrame);
      } catch (e) {
        onError?.(e);
      }
      if (this.running) schedule();
    };
    const schedule = (): void => {
      if (typeof v.requestVideoFrameCallback === 'function') {
        const id = v.requestVideoFrameCallback(tick);
        this.cancel = () => v.cancelVideoFrameCallback(id);
      } else {
        const id = requestAnimationFrame(tick);
        this.cancel = () => cancelAnimationFrame(id);
      }
    };
    schedule();
  }

  stop(): void {
    this.running = false;
    this.cancel?.();
    this.cancel = null;
  }

  close(): void {
    if (this.closed) return;
    this.stop();
    this.closed = true;
    this.gestures.close();
  }

  private step(onFrame: (f: VisionFrame) => void): void {
    const v = this.video;
    if (v.readyState < 2 || v.videoWidth === 0) return;
    const t = Math.max(performance.now(), this.lastTs + 1); // MediaPipe needs increasing timestamps
    this.lastTs = t;
    const hands = toRawHands(this.gestures.recognizeForVideo(v, t));
    onFrame({ t, aspect: v.videoWidth / v.videoHeight, hands });
  }

}

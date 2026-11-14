import { FaceLandmarker, FilesetResolver, GestureRecognizer } from '@mediapipe/tasks-vision';
import type { RawHand } from '../gestures/assignHands';
import type { Landmark } from '../gestures/types';
import { toRawHands } from './toRawHands';

export interface FaceFrame { landmarks: Landmark[]; matrix: Float32Array /* 4x4 column-major */ }
export interface VisionFrame { t: number; aspect: number; hands: RawHand[]; face: FaceFrame | null }

const BASE = `${import.meta.env.BASE_URL}mediapipe/`;
const GESTURE_MODEL = `${BASE}models/gesture_recognizer.task`;
const FACE_MODEL = `${BASE}models/face_landmarker.task`;

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
  } catch {
    return make('CPU');
  }
}

async function createFace(fileset: Fileset): Promise<FaceLandmarker> {
  const make = (delegate: 'GPU' | 'CPU') =>
    FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: FACE_MODEL, delegate },
      numFaces: 1,
      outputFacialTransformationMatrixes: true,
      runningMode: 'VIDEO',
    });
  try {
    return await make('GPU');
  } catch {
    return make('CPU');
  }
}

export class Tracker {
  private cancel: (() => void) | null = null;
  private frameCount = 0;
  private lastFace: FaceFrame | null = null;
  private lastTs = -1;

  private constructor(
    private readonly video: HTMLVideoElement,
    private readonly gestures: GestureRecognizer,
    private readonly faces: FaceLandmarker,
    private readonly faceEvery: number,
  ) {}

  static async create(video: HTMLVideoElement, opts: { faceEveryNFrames?: number } = {}): Promise<Tracker> {
    const fileset = await FilesetResolver.forVisionTasks(`${BASE}wasm`);
    const [gestures, faces] = await Promise.all([createGestures(fileset), createFace(fileset)]);
    return new Tracker(video, gestures, faces, Math.max(1, opts.faceEveryNFrames ?? 2));
  }

  start(onFrame: (f: VisionFrame) => void): void {
    this.stop();
    const v = this.video;
    const tick = (): void => {
      this.step(onFrame);
      schedule();
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
    this.cancel?.();
    this.cancel = null;
  }

  close(): void {
    this.stop();
    this.gestures.close();
    this.faces.close();
  }

  private step(onFrame: (f: VisionFrame) => void): void {
    const v = this.video;
    if (v.readyState < 2 || v.videoWidth === 0) return;
    const t = Math.max(performance.now(), this.lastTs + 1); // MediaPipe needs increasing timestamps
    this.lastTs = t;
    const hands = toRawHands(this.gestures.recognizeForVideo(v, t));
    if (this.frameCount++ % this.faceEvery === 0) this.lastFace = this.readFace(t);
    onFrame({ t, aspect: v.videoWidth / v.videoHeight, hands, face: this.lastFace });
  }

  private readFace(t: number): FaceFrame | null {
    const r = this.faces.detectForVideo(this.video, t);
    const points = r.faceLandmarks[0];
    const m = r.facialTransformationMatrixes[0];
    if (!points || !m) return null;
    return {
      landmarks: points.map(({ x, y, z }) => ({ x, y, z })),
      matrix: Float32Array.from(m.data),
    };
  }
}

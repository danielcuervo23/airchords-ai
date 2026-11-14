/**
 * TEST-ONLY stand-in for vision/tracker.ts, used when the build flag VITE_E2E=1 is set
 * (see build/e2eFlag.ts). MediaPipe cannot see hands in a CI fake camera, so this plays a script.
 */
import type { VisionFrame } from '../vision/tracker';
import { scriptedFrame } from './script';

const FRAME_MS = 33;

export class FakeTracker {
  private timer: ReturnType<typeof setInterval> | null = null;

  static async create(_video: HTMLVideoElement): Promise<FakeTracker> {
    return new FakeTracker();
  }

  start(onFrame: (f: VisionFrame) => void): void {
    this.stop();
    const t0 = performance.now();
    this.timer = setInterval(() => onFrame(scriptedFrame(performance.now() - t0)), FRAME_MS);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  close(): void {
    this.stop();
  }
}

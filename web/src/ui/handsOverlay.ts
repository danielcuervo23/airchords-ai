import type { RawHand } from '../gestures/assignHands';

/** MediaPipe hand skeleton: pairs of landmark indices. */
const EDGES: readonly (readonly [number, number])[] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

/**
 * Draws the hands on a canvas that sits exactly over the video's cover rect and shares its
 * scaleX(-1) mirror, so normalized landmarks map straight to canvas pixels.
 * Style from DESIGN.md: white 3px lines at 90%, curtain joints with a 2.5px white stroke.
 */
export class HandsOverlay {
  private readonly ctx: CanvasRenderingContext2D | null;
  private dpr = 1;
  private drawn = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d');
  }

  resize(cssW: number, cssH: number): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(cssW * this.dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * this.dpr));
    this.drawn = true; // resizing cleared it; force the next clear to be a no-op-safe path
  }

  draw(hands: readonly RawHand[]): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const { width: w, height: h } = this.canvas;
    if (this.drawn) ctx.clearRect(0, 0, w, h);
    this.drawn = hands.length > 0;
    if (!this.drawn) return;
    const d = this.dpr;
    ctx.lineCap = 'round';
    for (const hand of hands) {
      const p = hand.landmarks;
      if (p.length < 21) continue;
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3 * d;
      ctx.beginPath();
      for (const [a, b] of EDGES) {
        ctx.moveTo(p[a]!.x * w, p[a]!.y * h);
        ctx.lineTo(p[b]!.x * w, p[b]!.y * h);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#1C1216';
      ctx.lineWidth = 2.5 * d;
      for (const q of p.slice(0, 21)) {
        ctx.beginPath();
        ctx.arc(q.x * w, q.y * h, 4.5 * d, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }
}

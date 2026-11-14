import type { Landmark } from './types';

export interface Expression { volume: number; brightness: number }

const DEFAULT: Expression = { volume: 0.7, brightness: 0.5 };
const WRIST = 0;
const INDEX_MCP = 5;
const PINKY_MCP = 17;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

function validHand(lm: Landmark[] | null): lm is Landmark[] {
  if (!lm || lm.length < 21) return false;
  return [WRIST, INDEX_MCP, PINKY_MCP].every((i) => {
    const p = lm[i];
    return !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  });
}

/**
 * Tilt of the index MCP -> pinky MCP line in degrees, folded into (-90, 90] so a
 * level hand is ~0 whichever side the pinky is on. Sign convention: image y grows
 * downward, so positive = pinky MCP lower on screen than index MCP (for a pinky
 * on the right), i.e. clockwise tilt as seen on screen. Coordinates are normalized
 * per axis, so dx is scaled by aspect (width/height) to get pixel-proportional angles.
 */
function tiltDegrees(lm: Landmark[], aspect: number): number {
  const a = lm[INDEX_MCP]!;
  const b = lm[PINKY_MCP]!;
  let deg = (Math.atan2(b.y - a.y, (b.x - a.x) * aspect) * 180) / Math.PI;
  if (deg > 90) deg -= 180;
  else if (deg <= -90) deg += 180;
  return deg;
}

export class ExpressionTracker {
  private readonly smoothing: number;
  private readonly aspect: number;
  private state: Expression = { ...DEFAULT };

  constructor(opts: { smoothing?: number; aspect?: number } = {}) {
    const sm = opts.smoothing;
    this.smoothing = sm !== undefined && Number.isFinite(sm) && sm > 0 && sm <= 1 ? sm : 0.3;
    const ar = opts.aspect;
    this.aspect = ar !== undefined && Number.isFinite(ar) && ar > 0 ? ar : 1;
  }

  update(lm: Landmark[] | null): Expression {
    let target = DEFAULT;
    if (validHand(lm)) {
      // wrist y 0.85 -> 0, 0.15 -> 1
      const volume = clamp01((0.85 - lm[WRIST]!.y) / 0.7);
      // tilt -45deg -> 0, +45deg -> 1
      const brightness = clamp01((tiltDegrees(lm, this.aspect) + 45) / 90);
      target = { volume, brightness };
    }
    this.state = {
      volume: this.state.volume + this.smoothing * (target.volume - this.state.volume),
      brightness: this.state.brightness + this.smoothing * (target.brightness - this.state.brightness),
    };
    return { ...this.state };
  }
}

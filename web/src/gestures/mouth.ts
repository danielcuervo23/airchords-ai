import type { Landmark } from './types';

const UPPER_LIP = 13;
const LOWER_LIP = 14;
const LEFT_CORNER = 61;
const RIGHT_CORNER = 291;

/** Lip gap divided by mouth width. Returns 0 for invalid input. */
export function mouthOpenness(face: Landmark[]): number {
  const up = face[UPPER_LIP];
  const lo = face[LOWER_LIP];
  const l = face[LEFT_CORNER];
  const r = face[RIGHT_CORNER];
  if (!up || !lo || !l || !r) return 0;
  const gap = Math.abs(lo.y - up.y);
  const width = Math.abs(r.x - l.x);
  if (!Number.isFinite(gap) || !Number.isFinite(width) || width === 0) return 0;
  return gap / width;
}

/** Hysteresis trigger: true only on the frame it goes from armed to open. */
export class MouthTrigger {
  private readonly open: number;
  private readonly close: number;
  private armed = true;

  constructor(opts: { open?: number; close?: number } = {}) {
    this.open = opts.open ?? 0.28;
    this.close = opts.close ?? 0.2;
  }

  update(openness: number): boolean {
    if (this.armed && openness >= this.open) {
      this.armed = false;
      return true;
    }
    if (!this.armed && openness < this.close) this.armed = true;
    return false;
  }
}

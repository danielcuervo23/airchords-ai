/** Adopts a value only after it has been received continuously for minStableMs. */
export class Stabilizer<T> {
  private readonly minStableMs: number;
  private cur: T | null = null;
  private candidate: T | null = null;
  private candidateSince = 0;
  private hasCandidate = false;

  constructor(opts: { minStableMs: number }) {
    this.minStableMs = opts.minStableMs;
  }

  update(v: T | null, nowMs: number): T | null {
    if (!Number.isFinite(nowMs)) return this.cur;
    if (!this.hasCandidate || v !== this.candidate || nowMs < this.candidateSince) {
      this.hasCandidate = true;
      this.candidate = v;
      this.candidateSince = nowMs;
    }
    if (nowMs - this.candidateSince >= this.minStableMs) this.cur = this.candidate;
    return this.cur;
  }

  current(): T | null {
    return this.cur;
  }
}

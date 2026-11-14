export interface Rect { width: number; height: number; left: number; top: number }

const r2 = (n: number): number => Math.round(n * 100) / 100 + 0; // +0 turns -0 into 0

/**
 * Where a video of size vw x vh lands when it covers a bw x bh box, centred (object-fit: cover).
 * The video and every overlay canvas get this same rect, so landmarks line up with the picture.
 */
export function coverRect(vw: number, vh: number, bw: number, bh: number): Rect {
  if (!(vw > 0 && vh > 0)) return { width: bw, height: bh, left: 0, top: 0 };
  const scale = Math.max(bw / vw, bh / vh);
  const width = vw * scale;
  const height = vh * scale;
  return { width: r2(width), height: r2(height), left: r2((bw - width) / 2), top: r2((bh - height) / 2) };
}

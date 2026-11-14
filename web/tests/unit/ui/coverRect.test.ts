import { describe, expect, it } from 'vitest';
import { coverRect } from '../../../src/ui/coverRect';

describe('coverRect (object-fit: cover as numbers)', () => {
  it('a wide video in a tall box is cropped left and right', () => {
    expect(coverRect(640, 480, 390, 540)).toEqual({ width: 720, height: 540, left: -165, top: 0 });
  });
  it('a tall video in a wide box is cropped top and bottom', () => {
    expect(coverRect(480, 640, 800, 600)).toEqual({ width: 800, height: 1066.67, left: 0, top: -233.33 });
  });
  it('unknown sizes fall back to filling the box', () => {
    expect(coverRect(0, 0, 300, 200)).toEqual({ width: 300, height: 200, left: 0, top: 0 });
  });
});

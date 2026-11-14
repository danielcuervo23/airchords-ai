import { describe, it, expect } from 'vitest';
import { Stabilizer } from '../../../src/gestures/stabilizer';

describe('Stabilizer', () => {
  it('starts null and adopts a value only after minStableMs', () => {
    const s = new Stabilizer<number>({ minStableMs: 80 });
    expect(s.current()).toBeNull();
    expect(s.update(3, 0)).toBeNull();
    expect(s.update(3, 50)).toBeNull();
    expect(s.update(3, 79)).toBeNull();
    expect(s.update(3, 80)).toBe(3);
    expect(s.current()).toBe(3);
  });

  it('keeps the current value until a new one lasts minStableMs', () => {
    const s = new Stabilizer<number>({ minStableMs: 80 });
    s.update(3, 0);
    s.update(3, 80);
    expect(s.update(5, 100)).toBe(3);
    expect(s.update(5, 179)).toBe(3);
    expect(s.update(5, 180)).toBe(5);
  });

  it('restarts the candidate timer when the candidate changes', () => {
    const s = new Stabilizer<number>({ minStableMs: 80 });
    s.update(3, 0);
    s.update(3, 80);
    s.update(5, 100);
    s.update(7, 150);
    expect(s.update(7, 200)).toBe(3);
    expect(s.update(7, 230)).toBe(7);
  });

  it('adopts null after receiving null for minStableMs', () => {
    const s = new Stabilizer<number>({ minStableMs: 80 });
    s.update(3, 0);
    s.update(3, 80);
    expect(s.update(null, 100)).toBe(3);
    expect(s.update(null, 179)).toBe(3);
    expect(s.update(null, 180)).toBeNull();
  });
});

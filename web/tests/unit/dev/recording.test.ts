import { describe, expect, it } from 'vitest';
import { hasAnyHand, parseRecording, rebaseTime, serializeRecording, type Recording } from '../../../src/dev/recording';

const lm = (i: number) => ({ x: 0.1 + i / 100, y: 0.5, z: -0.01 });
const hand = (label: 'Left' | 'Right') => ({
  label,
  score: 0.9,
  landmarks: Array.from({ length: 21 }, (_, i) => lm(i)),
  gesture: { name: 'Victory' as const, score: 0.8 },
});
const sample = (): Recording => ({
  gesture: 2,
  device: 'test-cam',
  labelsSwapped: true,
  aspect: 1.5,
  frames: [
    { t: 0, hands: [hand('Left')] },
    { t: 33, hands: [] },
  ],
});

describe('recording round trip', () => {
  it('parse(serialize(x)) equals x', () => {
    expect(parseRecording(serializeRecording(sample()))).toEqual(sample());
  });
  it('accepts gesture none and a null gesture guess', () => {
    const r = sample();
    r.gesture = 'none';
    r.frames[0]!.hands[0]!.gesture = null as never;
    expect(parseRecording(serializeRecording(r))).toEqual(r);
  });
  it('stores only landmarks and guesses, no image data', () => {
    const json = serializeRecording(sample());
    expect(json).not.toMatch(/data:image|base64|imageData/i);
    expect(Object.keys(JSON.parse(json)).sort()).toEqual(['aspect', 'device', 'frames', 'gesture', 'labelsSwapped']);
  });
});

describe('parseRecording rejects invalid data', () => {
  const bad = (mutate: (r: any) => void): string => {
    const r: any = JSON.parse(serializeRecording(sample()));
    mutate(r);
    return JSON.stringify(r);
  };
  it('rejects non-JSON', () => expect(() => parseRecording('{nope')).toThrow(/no es JSON válido/));
  it('rejects non-object', () => expect(() => parseRecording('42')).toThrow(/debe ser un objeto/));
  it('rejects unknown gesture', () => expect(() => parseRecording(bad((r) => (r.gesture = 9)))).toThrow(/gesture debe ser 1 a 7/));
  it('rejects 20 landmarks', () =>
    expect(() => parseRecording(bad((r) => r.frames[0].hands[0].landmarks.pop()))).toThrow(/21/));
  it('rejects non-finite numbers', () =>
    expect(() => parseRecording(bad((r) => (r.frames[0].hands[0].landmarks[3].x = null)))).toThrow(/debe ser un número finito/));
  it('rejects bad label', () =>
    expect(() => parseRecording(bad((r) => (r.frames[0].hands[0].label = 'Mid')))).toThrow(/label debe ser Left o Right/));
  it('rejects missing frames', () => expect(() => parseRecording(bad((r) => delete r.frames))).toThrow(/frames debe ser una lista/));
  it('rejects unknown gesture name in a guess', () =>
    expect(() => parseRecording(bad((r) => (r.frames[0].hands[0].gesture.name = 'Wave')))).toThrow(/gesture\.name desconocido/));
});

describe('helpers', () => {
  it('hasAnyHand is false when no frame has a hand', () => {
    expect(hasAnyHand([{ t: 0, hands: [] }])).toBe(false);
    expect(hasAnyHand(sample().frames)).toBe(true);
  });
  it('rebaseTime makes t relative to the first frame', () => {
    const f = rebaseTime([{ t: 1000, hands: [] }, { t: 1033, hands: [] }]);
    expect(f.map((x) => x.t)).toEqual([0, 33]);
    expect(rebaseTime([])).toEqual([]);
  });
});

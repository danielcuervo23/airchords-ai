import { describe, expect, it } from 'vitest';
import { PRESETS, VISIBLE_PRESETS } from '../../../src/audio/presets';

const GESTURE_SYNTH = ['Warm', 'Bright', 'Retro Synth', 'Dreamy', 'Strings', 'Horns'];

describe('PRESETS', () => {
  it('has the 7 ids in order', () => {
    expect(PRESETS.map((p) => p.id)).toEqual(['piano', 'guitarra', 'violin', 'calido', 'cristal', '8bit', 'nube']);
  });
  it('uses the agreed Spanish names', () => {
    expect(PRESETS.map((p) => p.name)).toEqual(['Piano', 'Guitarra', 'Violín', 'Cálido', 'Cristal', '8-bit', 'Nube']);
  });
  it('never reuses a Gesture Synth name', () => {
    for (const p of PRESETS) expect(GESTURE_SYNTH).not.toContain(p.name);
  });
  it('piano and guitarra strum; synth pads sustain', () => {
    const b = Object.fromEntries(PRESETS.map((p) => [p.id, p.behavior]));
    expect(b.piano).toBe('strum');
    expect(b.guitarra).toBe('strum');
    expect(['sustain', 'strum']).toContain(b.violin);
    for (const id of ['calido', 'cristal', '8bit', 'nube']) expect(b[id]).toBe('sustain');
  });
  it('only sampled presets carry samples with a baseUrl and notes', () => {
    for (const p of PRESETS.filter((x) => x.samples)) {
      expect(p.samples!.baseUrl.endsWith('/')).toBe(true);
      expect(Object.keys(p.samples!.notes).length).toBeGreaterThanOrEqual(5);
    }
  });
  it('hides Guitarra in v1 (it makes no sound) but keeps it in the engine table', () => {
    expect(VISIBLE_PRESETS.map((p) => p.id)).toEqual(['piano', 'violin', 'calido', 'cristal', '8bit', 'nube']);
    expect(PRESETS.find((p) => p.id === 'guitarra')?.available).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { brightnessToHz, shiftOctave, strumIntervalMs, strumOffsets, volumeToDb } from '../../../src/audio/mapping';

describe('brightnessToHz', () => {
  it('is exponential from 400 to 8000 Hz', () => {
    expect(brightnessToHz(0)).toBeCloseTo(400, 5);
    expect(brightnessToHz(1)).toBeCloseTo(8000, 5);
    expect(brightnessToHz(0.5)).toBeCloseTo(Math.sqrt(400 * 8000), 3);
  });
  it('clamps and tolerates NaN', () => {
    expect(brightnessToHz(-3)).toBeCloseTo(400, 5);
    expect(brightnessToHz(9)).toBeCloseTo(8000, 5);
    expect(brightnessToHz(NaN)).toBeCloseTo(brightnessToHz(0.5), 5);
  });
});

describe('volumeToDb', () => {
  it('maps 1 to 0 dB, halves to -12 dB, silence to the floor', () => {
    expect(volumeToDb(1)).toBeCloseTo(0, 5);
    expect(volumeToDb(0.5)).toBeCloseTo(-12.04, 1);
    expect(volumeToDb(0)).toBe(-60);
    expect(volumeToDb(-1)).toBe(-60);
  });
  it('is monotonic', () => {
    expect(volumeToDb(0.8)).toBeGreaterThan(volumeToDb(0.4));
  });
});

describe('strumOffsets', () => {
  it('spreads notes evenly over the strum time', () => {
    expect(strumOffsets(3, 60)).toEqual([0, 30, 60]);
    expect(strumOffsets(1, 60)).toEqual([0]);
    expect(strumOffsets(0, 60)).toEqual([]);
  });
});

describe('strumIntervalMs', () => {
  it('is one beat', () => {
    expect(strumIntervalMs(90)).toBeCloseTo(666.67, 1);
    expect(strumIntervalMs(120)).toBe(500);
  });
  it('clamps absurd bpm', () => {
    expect(strumIntervalMs(0)).toBe(2000);
    expect(strumIntervalMs(NaN)).toBeCloseTo(666.67, 1);
    expect(strumIntervalMs(10000)).toBe(250);
  });
});

describe('shiftOctave', () => {
  it('moves note names by octaves', () => {
    expect(shiftOctave(['C3', 'E3', 'G#3'], 1)).toEqual(['C4', 'E4', 'G#4']);
    expect(shiftOctave(['C3'], 0)).toEqual(['C3']);
  });
});

import { repeatIntervalMs } from '../../../src/audio/mapping';

describe('repeatIntervalMs', () => {
  it('strum presets repeat at one beat', () => {
    expect(repeatIntervalMs('strum', true, 120)).toBe(500);
  });
  it('sampled sustain presets refresh before the 3 s sample ends', () => {
    expect(repeatIntervalMs('sustain', true, 120)).toBe(2400);
  });
  it('synth pads never repeat', () => {
    expect(repeatIntervalMs('sustain', false, 120)).toBeNull();
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { InstrumentController, type ControllerState } from '../../../src/app/controller';
import type { SoundEngine } from '../../../src/audio/engine';
import { PRESETS, type PresetId } from '../../../src/audio/presets';
import { chordForDegree, type Chord, type Key } from '../../../src/music/theory';
import type { RawHand } from '../../../src/gestures/assignHands';
import type { GestureName } from '../../../src/gestures/types';
import type { Expression } from '../../../src/gestures/expression';
import type { Song } from '../../../src/songs/types';
import type { VisionFrame } from '../../../src/vision/tracker';

class FakeEngine implements SoundEngine {
  calls: string[] = [];
  chords: Chord[] = [];
  expressions: Expression[] = [];
  presets: PresetId[] = [];
  bpms: number[] = [];
  failPreset = false;
  async start(): Promise<void> { this.calls.push('start'); }
  async setPreset(id: PresetId): Promise<void> {
    this.calls.push('setPreset');
    this.presets.push(id);
    if (this.failPreset) throw new Error('boom');
  }
  playChord(c: Chord): void { this.calls.push('playChord'); this.chords.push(c); }
  release(): void { this.calls.push('release'); }
  setExpression(e: Expression): void { this.calls.push('setExpression'); this.expressions.push(e); }
  setBpm(b: number): void { this.calls.push('setBpm'); this.bpms.push(b); }
  dispose(): void { this.calls.push('dispose'); }
  count(name: string): number { return this.calls.filter((c) => c === name).length; }
}

const C_MAJOR: Key = { tonic: 'C', mode: 'major' };
const G_MAJOR: Key = { tonic: 'G', mode: 'major' };

function hand(label: 'Left' | 'Right', gesture: GestureName | null = null): RawHand {
  const landmarks = Array.from({ length: 21 }, (_, i) => ({ x: 0.3 + i * 0.01, y: 0.5, z: 0 }));
  return { label, score: 0.9, landmarks, gesture: gesture ? { name: gesture, score: 0.9 } : null };
}

function frame(hands: RawHand[], aspect = 4 / 3): VisionFrame {
  return { t: 0, aspect, hands };
}

const song: Song = {
  id: 's', title: 's', artist: 'a', key: G_MAJOR, bpm: 120,
  steps: [{ degree: 1, beats: 2 }, { degree: 4, beats: 2 }, { degree: 5, beats: 4 }],
};

describe('InstrumentController', () => {
  let engine: FakeEngine;
  let clock: number;
  let c: InstrumentController;
  const at = (ms: number, f: VisionFrame) => { clock = ms; c.onFrame(f); };

  beforeEach(() => {
    engine = new FakeEngine();
    clock = 0;
    c = new InstrumentController({ engine, now: () => clock, key: C_MAJOR });
  });

  describe('free mode', () => {
    it('plays the chord once after the degree is stable for 80 ms', () => {
      const f = frame([hand('Right', 'Thumb_Up')]);
      at(0, f); at(40, f);
      expect(engine.count('playChord')).toBe(0);
      at(80, f); at(120, f); at(200, f);
      expect(engine.chords).toEqual([chordForDegree(C_MAJOR, 4)]);
    });

    it('releases once when the chord hand disappears for 80 ms; a single odd frame changes nothing', () => {
      const up = frame([hand('Right', 'Thumb_Up')]);
      at(0, up); at(80, up);
      at(100, frame([hand('Right', 'Victory')]));
      at(120, up);
      expect(engine.count('release')).toBe(0);
      expect(engine.count('playChord')).toBe(1);
      at(200, frame([])); at(250, frame([])); at(280, frame([])); at(400, frame([]));
      expect(engine.count('release')).toBe(1);
    });

    it('the physical right hand (label Right, labelsSwapped false) is the chord hand', () => {
      const f = frame([hand('Left', 'Victory'), hand('Right', 'Open_Palm')]);
      at(0, f); at(100, f);
      expect(engine.chords[0]).toEqual(chordForDegree(C_MAJOR, 5));
    });

    it('labelsSwapped true makes label Left the chord hand', () => {
      const c2 = new InstrumentController({ engine, now: () => clock, key: C_MAJOR, labelsSwapped: true });
      const f = frame([hand('Left', 'Victory'), hand('Right', 'Open_Palm')]);
      clock = 0; c2.onFrame(f); clock = 100; c2.onFrame(f);
      expect(engine.chords[0]).toEqual(chordForDegree(C_MAJOR, 2));
    });

    it('setKey affects free mode and replays a sounding chord in the new key', () => {
      const f = frame([hand('Right', 'Thumb_Up')]);
      at(0, f); at(100, f);
      c.setKey(G_MAJOR);
      expect(engine.chords.at(-1)).toEqual(chordForDegree(G_MAJOR, 4));
      expect(engine.count('playChord')).toBe(2);
    });

    it('setKey with nothing sounding does not play', () => {
      c.setKey(G_MAJOR);
      expect(engine.count('playChord')).toBe(0);
    });
  });

  describe('expression', () => {
    it('calls setExpression every frame, driven by the other hand', () => {
      at(0, frame([hand('Left')])); at(16, frame([hand('Left')])); at(32, frame([]));
      expect(engine.count('setExpression')).toBe(3);
    });

    it('recreates the tracker when the aspect changes by more than 1%', () => {
      const tilted = hand('Left');
      tilted.landmarks[5] = { x: 0.3, y: 0.4, z: 0 };
      tilted.landmarks[17] = { x: 0.5, y: 0.6, z: 0 };
      const mk = () => new InstrumentController({ engine: new FakeEngine(), now: () => 0, key: C_MAJOR });
      const a = mk();
      const b = mk();
      a.onFrame(frame([tilted], 1.0));
      a.onFrame(frame([tilted], 2.0));
      b.onFrame(frame([tilted], 2.0));
      // a fresh tracker at 2.0 and a recreated one see the first frame at 2.0 the same way
      const fresh = b.getState().expression.brightness;
      const reset = new InstrumentController({ engine: new FakeEngine(), now: () => 0, key: C_MAJOR });
      reset.onFrame(frame([tilted], 1.0));
      reset.onFrame(frame([tilted], 2.0));
      expect(reset.getState().expression.brightness).toBeCloseTo(fresh, 10);
      expect(a.getState().expression.brightness).toBeCloseTo(fresh, 10);
    });
  });

  describe('sound changes', () => {
    it('keeps the old preset when setPreset rejects', async () => {
      engine.failPreset = true;
      await expect(c.setPreset('cristal')).rejects.toThrow('boom');
      expect(c.getState().preset).toBe(PRESETS[0]!.id);
    });

    it('updates the state preset when setPreset succeeds', async () => {
      await c.setPreset('cristal');
      expect(c.getState().preset).toBe('cristal');
    });
  });

  describe('guided mode', () => {
    beforeEach(() => { c.setMode({ kind: 'guided', song }); });

    it('a wrong degree plays nothing; the correct one is a hit and sounds in the song key', () => {
      const wrong = frame([hand('Right', 'Thumb_Up')]);
      at(0, wrong); at(100, wrong);
      expect(engine.count('playChord')).toBe(0);
      expect(c.getState().guided).toMatchObject({ index: 0, lastResult: 'wait' });
      const right = frame([hand('Right', 'Pointing_Up')]);
      at(200, right); at(300, right);
      expect(engine.chords).toEqual([chordForDegree(G_MAJOR, 1)]);
      expect(c.getState().guided).toMatchObject({ index: 1, lastResult: 'hit' });
    });

    it('releases after the step beats elapse (2 beats at 120 bpm = 1000 ms)', () => {
      const right = frame([hand('Right', 'Pointing_Up')]);
      at(0, right); at(100, right);
      const before = engine.count('release');
      at(1000, right);
      expect(engine.count('release')).toBe(before);
      at(1100, right);
      expect(engine.count('release')).toBe(before + 1);
      at(1200, right);
      expect(engine.count('release')).toBe(before + 1);
    });

    it('reports done when the song finishes', () => {
      const g = (n: GestureName) => frame([hand('Right', n)]);
      let t = 0;
      for (const n of ['Pointing_Up', 'Thumb_Up', 'Open_Palm'] as GestureName[]) {
        at(t, g(n)); t += 100; at(t, g(n)); t += 100;
        at(t, frame([])); t += 100; at(t, frame([])); t += 100;
      }
      expect(c.getState().guided?.done).toBe(true);
    });
  });

  describe('auto mode', () => {
    beforeEach(() => { clock = 0; c.setMode({ kind: 'auto', song }); });

    it('sets bpm, plays chords from stepAtBeat and keeps driving expression', () => {
      expect(engine.bpms).toEqual([120]);
      const f = frame([hand('Left')]);
      at(0, f);
      expect(engine.chords).toEqual([chordForDegree(G_MAJOR, 1)]);
      at(500, f);
      expect(engine.count('playChord')).toBe(1);
      at(1000, f);
      expect(engine.chords.at(-1)).toEqual(chordForDegree(G_MAJOR, 4));
      expect(engine.count('setExpression')).toBe(3);
    });

    it('chord hand gestures do not change what plays', () => {
      at(0, frame([hand('Right', 'Victory')]));
      expect(engine.chords).toEqual([chordForDegree(G_MAJOR, 1)]);
    });

    it('pause releases and freezes the beat clock; resume continues from the same beat', () => {
      const f = frame([]);
      at(0, f);
      at(900, f);
      clock = 900;
      c.onVisibilityChange(true);
      expect(engine.count('release')).toBeGreaterThanOrEqual(1);
      const plays = engine.count('playChord');
      at(5000, f);
      expect(engine.count('playChord')).toBe(plays);
      clock = 5000;
      c.onVisibilityChange(false);
      at(5100, f); // beat = (900 + 100) * 120 / 60000 = 2 -> degree 4
      expect(engine.chords.at(-1)).toEqual(chordForDegree(G_MAJOR, 4));
    });
  });

  describe('visibility and lifecycle', () => {
    it('releases on hidden in free mode', () => {
      c.onVisibilityChange(true);
      expect(engine.count('release')).toBe(1);
    });

    it('setMode releases and notifies', () => {
      const seen: ControllerState[] = [];
      c.subscribe((s) => seen.push(s));
      c.setMode({ kind: 'guided', song });
      expect(engine.count('release')).toBe(1);
      expect(seen.length).toBe(1);
      expect(seen[0]!.guided).toMatchObject({ index: 0, lastResult: 'wait' });
    });

    it('dispose disposes the engine and clears subscribers', () => {
      const seen: ControllerState[] = [];
      c.subscribe((s) => seen.push(s));
      c.dispose();
      expect(engine.count('dispose')).toBe(1);
      at(0, frame([hand('Right', 'Thumb_Up')]));
      at(100, frame([hand('Right', 'Thumb_Up')]));
      expect(seen).toEqual([]);
    });
  });

  describe('subscribers', () => {
    it('are not called on identical frames, are on change, and unsubscribe works', () => {
      const seen: ControllerState[] = [];
      const off = c.subscribe((s) => seen.push(s));
      const f = frame([hand('Right', 'Thumb_Up')]);
      at(0, f);
      const afterFirst = seen.length;
      at(100, f);
      expect(seen.length).toBeGreaterThan(afterFirst);
      const n = seen.length;
      at(200, f); at(300, f);
      expect(seen.length).toBe(n);
      off();
      at(400, frame([])); at(500, frame([]));
      expect(seen.length).toBe(n);
    });
  });

  describe('fix round 1', () => {
    const repeat: Song = { ...song, steps: [{ degree: 1, beats: 1 }, { degree: 1, beats: 1 }, { degree: 4, beats: 1 }] };
    const up = () => frame([hand('Right', 'Pointing_Up')]);

    it('guided: a repeated degree needs re-articulation (drop or change, then repeat)', () => {
      c.setMode({ kind: 'guided', song: repeat });
      at(0, up()); at(100, up());
      expect(engine.count('playChord')).toBe(1);
      at(200, up()); at(400, up()); at(800, up());
      expect(engine.count('playChord')).toBe(1);
      expect(c.getState().guided?.needsRearticulate).toBe(true);
      at(900, frame([])); at(1000, frame([]));
      expect(c.getState().guided?.needsRearticulate).toBe(false);
      at(1100, up()); at(1200, up());
      expect(engine.count('playChord')).toBe(2);
      expect(c.getState().guided?.index).toBe(2);
    });

    it('frames 125 ms apart: one differing frame does nothing, two frames play once', () => {
      at(0, up()); at(125, up());
      expect(engine.count('playChord')).toBe(1);
      at(250, frame([hand('Right', 'Victory')]));
      at(375, up());
      expect(engine.count('playChord')).toBe(1);
      expect(engine.count('release')).toBe(0);
      at(500, frame([hand('Right', 'Victory')])); at(625, frame([hand('Right', 'Victory')]));
      expect(engine.chords.at(-1)).toEqual(chordForDegree(C_MAJOR, 2));
      expect(engine.count('playChord')).toBe(2);
    });

    it('auto advances on tick with no frames', () => {
      c.setMode({ kind: 'auto', song });
      clock = 0;
      c.tick(0);
      expect(engine.chords).toEqual([chordForDegree(G_MAJOR, 1)]);
      c.tick(1000);
      expect(engine.chords.at(-1)).toEqual(chordForDegree(G_MAJOR, 4));
    });

    it('guided chord expires on tick with no frames', () => {
      c.setMode({ kind: 'guided', song });
      at(0, up()); at(100, up());
      const before = engine.count('release');
      c.tick(1200);
      expect(engine.count('release')).toBe(before + 1);
    });

    it('watchdog: releases once and hides hands after a 600 ms frame gap', () => {
      const f = frame([hand('Right', 'Thumb_Up'), hand('Left')]);
      at(0, f); at(100, f);
      expect(c.getState().handsVisible).toEqual({ chord: true, expression: true });
      c.tick(400);
      expect(engine.count('release')).toBe(0);
      c.tick(700);
      expect(engine.count('release')).toBe(1);
      expect(c.getState().handsVisible).toEqual({ chord: false, expression: false });
      c.tick(900);
      expect(engine.count('release')).toBe(1);
    });

    it('setMode with an invalid song throws and keeps the previous mode', () => {
      c.setMode({ kind: 'guided', song });
      expect(() => c.setMode({ kind: 'guided', song: { ...song, steps: [] } })).toThrow();
      expect(() => c.setMode({ kind: 'auto', song: { ...song, bpm: 0 } })).toThrow();
      expect(() => c.setMode({ kind: 'auto', song: { ...song, bpm: NaN } })).toThrow();
      expect(c.getState().guided).toBeDefined();
      at(0, up()); at(100, up());
      expect(engine.chords).toEqual([chordForDegree(G_MAJOR, 1)]);
    });

    it('keeps the paused state across setMode', () => {
      c.setMode({ kind: 'auto', song });
      clock = 0; c.onVisibilityChange(true);
      c.setMode({ kind: 'auto', song });
      const plays = engine.count('playChord');
      at(3000, frame([]));
      expect(engine.count('playChord')).toBe(plays);
    });

    it('setPreset: latest request wins', async () => {
      let release1!: () => void;
      engine.setPreset = async (id: PresetId) => {
        engine.presets.push(id);
        if (id === 'cristal') await new Promise<void>((r) => { release1 = r; });
      };
      const p1 = c.setPreset('cristal');
      await c.setPreset('nube');
      release1();
      await p1;
      expect(c.getState().preset).toBe('nube');
    });

    it('after dispose, onFrame and tick do nothing', () => {
      c.dispose();
      const n = engine.calls.length;
      at(0, up()); at(100, up());
      c.tick(5000);
      expect(engine.calls.length).toBe(n);
    });

    it('state expression is a copy', () => {
      at(0, frame([]));
      const s = c.getState();
      s.expression.volume = 0.123;
      expect(c.getState().expression.volume).not.toBe(0.123);
    });
  });

  describe('robustness', () => {
    it('never throws on empty hands or a NaN aspect', () => {
      expect(() => at(0, frame([], NaN))).not.toThrow();
      expect(() => at(10, frame([hand('Left', 'Victory')], NaN))).not.toThrow();
      expect(() => at(20, frame([], 0))).not.toThrow();
    });
  });
});

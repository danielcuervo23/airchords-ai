import { describe, expect, it } from 'vitest';
import type { ControllerState } from '../../../src/app/state';
import { chordForDegree, type Key } from '../../../src/music/theory';
import type { Song } from '../../../src/songs/types';
import { toView } from '../../../src/ui/viewState';

const C: Key = { tonic: 'C', mode: 'major' };
const song: Song = {
  id: 's', title: 'Canción', artist: 'Artista', key: { tonic: 'D', mode: 'minor' }, bpm: 100,
  steps: [{ degree: 4, beats: 4 }, { degree: 7, beats: 4 }, { degree: 1, beats: 4 }, { degree: 4, beats: 4 }],
};
const base = (over: Partial<ControllerState> = {}): ControllerState => ({
  degree: null, chord: null, expression: { volume: 0.7, brightness: 0.5 }, preset: 'piano',
  handsVisible: { chord: false, expression: false }, ...over,
});

describe('toView', () => {
  it('waits for hands when none are visible (free mode)', () => {
    const v = toView(base(), { mode: 'free', key: C, song: null });
    expect(v.chord).toBeNull();
    expect(v.status).toBe('Esperando tus manos…');
  });
  it('asks for a sign when the hand is there but nothing sounds', () => {
    const v = toView(base({ handsVisible: { chord: true, expression: false } }), { mode: 'free', key: C, song: null });
    expect(v.status).toBe('Haz una seña con la mano derecha');
  });
  it('describes the sounding chord with numeral, Spanish name, key and gel', () => {
    const v = toView(
      base({ degree: 2, chord: chordForDegree(C, 2), handsVisible: { chord: true, expression: false } }),
      { mode: 'free', key: C, song: null },
    );
    expect(v.status).toBe('');
    expect(v.chord).toEqual({
      degree: 2, symbol: 'Dm', numeral: 'ii', name: 'Re menor', context: 'Re menor · tono Do mayor', gel: 'var(--g2)',
    });
    expect(v.announcement).toBe('Suena Re menor, grado ii');
    expect(v.washLabel).toContain('rosa');
  });
  it('maps meters to whole percentages', () => {
    const v = toView(base({ expression: { volume: 0.723, brightness: 0.4 } }), { mode: 'free', key: C, song: null });
    expect(v.meters).toEqual({ volume: 72, brightness: 40 });
  });
  it('guided: title, artist, step, current and next sign in the song key', () => {
    const v = toView(
      base({ guided: { index: 0, lastResult: 'wait', done: false, needsRearticulate: false } }),
      { mode: 'guided', key: C, song },
    );
    expect(v.guided).toMatchObject({ title: 'Acordes de Canción', artist: 'Artista', stepText: 'Paso 1 de 4', done: false, hint: null });
    expect(v.guided!.now).toMatchObject({ degree: 4, numeral: 'iv', symbol: 'Gm', emoji: '👍', signName: 'Pulgar arriba' });
    expect(v.guided!.next).toMatchObject({ degree: 7, numeral: 'VII', symbol: 'C', emoji: '✊' });
    expect(v.guided!.feedback).toBe('Haz la seña 👍 Pulgar arriba');
  });
  it('guided: hit feedback and the re-articulate hint', () => {
    const v = toView(
      base({ guided: { index: 3, lastResult: 'hit', done: false, needsRearticulate: true } }),
      { mode: 'guided', key: C, song },
    );
    expect(v.guided!.feedback).toBe('¡Bien! Ahora 👍 Pulgar arriba');
    expect(v.guided!.hint).toBe('Baja la mano y repite la seña');
    expect(v.guided!.next).toBeNull();
  });
  it('guided: done state', () => {
    const v = toView(
      base({ guided: { index: 4, lastResult: 'hit', done: true, needsRearticulate: false } }),
      { mode: 'guided', key: C, song },
    );
    expect(v.guided).toMatchObject({ done: true, now: null, next: null, stepText: 'Paso 4 de 4', feedback: '¡Terminaste Canción!' });
  });
  it('auto: lists the song chords once each, in order, marking the one that sounds; no hand prompt', () => {
    const v = toView(base({ degree: 7, chord: chordForDegree(song.key, 7) }), { mode: 'auto', key: C, song });
    expect(v.status).toBe('');
    expect(v.auto!.summary).toBe('iv – VII – i');
    expect(v.auto!.rows.map((r) => [r.symbol, r.current])).toEqual([['Gm', false], ['C', true], ['Dm', false]]);
    expect(v.chord!.context).toBe('Do mayor · tono Re menor');
  });
});

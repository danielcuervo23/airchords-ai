import type { Expression } from '../gestures/expression';
import type { Chord, Degree } from '../music/theory';
import type { PresetId } from '../audio/presets';
import type { Song } from '../songs/types';

/** How the instrument is being played. Not the same as music/Mode (major/minor). */
export type PlayMode = { kind: 'free' } | { kind: 'guided'; song: Song } | { kind: 'auto'; song: Song };

export interface ControllerState {
  degree: Degree | null;
  chord: Chord | null;
  expression: Expression;
  preset: PresetId;
  guided?: { index: number; lastResult: 'hit' | 'wait'; done: boolean; needsRearticulate: boolean };
  handsVisible: { chord: boolean; expression: boolean };
}

/** Field-by-field comparison so subscribers only hear about real changes. */
export function sameState(a: ControllerState, b: ControllerState): boolean {
  return (
    a.degree === b.degree &&
    a.chord === b.chord &&
    a.preset === b.preset &&
    a.expression.volume === b.expression.volume &&
    a.expression.brightness === b.expression.brightness &&
    a.handsVisible.chord === b.handsVisible.chord &&
    a.handsVisible.expression === b.handsVisible.expression &&
    a.guided?.index === b.guided?.index &&
    a.guided?.lastResult === b.guided?.lastResult &&
    a.guided?.done === b.guided?.done &&
    a.guided?.needsRearticulate === b.guided?.needsRearticulate
  );
}

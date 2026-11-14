import type { Chord, Degree, Key, PitchClass, Quality } from '../music/theory';

const NOTE_ES: Record<PitchClass, string> = {
  C: 'Do', 'C#': 'Do sostenido', D: 'Re', 'D#': 'Re sostenido', E: 'Mi', F: 'Fa',
  'F#': 'Fa sostenido', G: 'Sol', 'G#': 'Sol sostenido', A: 'La', 'A#': 'La sostenido', B: 'Si',
};
const QUALITY_ES: Record<Quality, string> = { maj: 'mayor', min: 'menor', dim: 'disminuido' };

export const noteNameEs = (pc: PitchClass): string => NOTE_ES[pc];
export const keyNameEs = (k: Key): string => `${NOTE_ES[k.tonic]} ${k.mode === 'major' ? 'mayor' : 'menor'}`;
export const chordNameEs = (c: Chord): string => `${NOTE_ES[c.root]} ${QUALITY_ES[c.quality]}`;

export interface Sign { degree: Degree; emoji: string; name: string }

/** Same order as gestures/degree.ts GESTURE_TO_DEGREE. Descriptions are what the Guide teaches. */
export const SIGNS: readonly Sign[] = [
  { degree: 1, emoji: '☝️', name: 'Índice arriba' },
  { degree: 2, emoji: '✌️', name: 'Índice y medio (victoria)' },
  { degree: 3, emoji: '🤟', name: 'Pulgar, índice y meñique' },
  { degree: 4, emoji: '👍', name: 'Pulgar arriba' },
  { degree: 5, emoji: '🖐️', name: 'Mano abierta' },
  { degree: 6, emoji: '👎', name: 'Pulgar abajo' },
  { degree: 7, emoji: '✊', name: 'Puño cerrado' },
];

export const signFor = (d: Degree): Sign => SIGNS[d - 1]!;

export type PitchClass = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';
export type Mode = 'major' | 'minor';
export interface Key { tonic: PitchClass; mode: Mode }
export type Degree = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Quality = 'maj' | 'min' | 'dim';
export interface Chord { degree: Degree; root: PitchClass; quality: Quality; notes: string[]; label: string }

const PITCH_CLASSES: readonly PitchClass[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const SCALES: Record<Mode, readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};

const SUFFIX: Record<Quality, string> = { maj: '', min: 'm', dim: '°' };

export const ALL_KEYS: Key[] = (['major', 'minor'] as const).flatMap((mode) =>
  PITCH_CLASSES.map((tonic): Key => ({ tonic, mode })),
);

/** Absolute semitone (from C0) of the scale degree, extending the scale upward past the octave. */
function scaleSemitone(key: Key, index: number): number {
  const scale = SCALES[key.mode];
  const octaves = Math.floor(index / 7);
  return PITCH_CLASSES.indexOf(key.tonic) + scale[index % 7]! + octaves * 12;
}

function qualityOf(third: number, fifth: number): Quality {
  if (fifth === 6) return 'dim';
  return third === 4 ? 'maj' : 'min';
}

function toNote(semitone: number, octave: number): string {
  return `${PITCH_CLASSES[semitone % 12]!}${octave + Math.floor(semitone / 12)}`;
}

export function chordForDegree(key: Key, degree: Degree, octave = 3): Chord {
  const i = degree - 1;
  const root = scaleSemitone(key, i);
  const third = scaleSemitone(key, i + 2);
  const fifth = scaleSemitone(key, i + 4);
  const quality = qualityOf(third - root, fifth - root);
  const rootClass = PITCH_CLASSES[root % 12]!;
  // Octave is anchored at the chord root; upper notes bump the octave when they cross C.
  const base = root % 12;
  const notes = [0, third - root, fifth - root].map((interval) => toNote(base + interval, octave));
  return {
    degree,
    root: rootClass,
    quality,
    notes,
    label: rootClass + SUFFIX[quality],
  };
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const;

export function romanNumeral(key: Key, degree: Degree): string {
  const { quality } = chordForDegree(key, degree);
  const numeral = ROMAN[degree - 1]!;
  return quality === 'maj' ? numeral : numeral.toLowerCase() + (quality === 'dim' ? '°' : '');
}

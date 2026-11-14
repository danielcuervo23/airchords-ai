export type PresetId = 'piano' | 'guitarra' | 'violin' | 'calido' | 'cristal' | '8bit' | 'nube';
export interface Preset {
  id: PresetId;
  name: string;
  behavior: 'sustain' | 'strum';
  samples?: { baseUrl: string; notes: Record<string, string> };
}

/** Piano: Salamander Grand Piano, a sample every 3 semitones from C3 to C5. */
const PIANO_NOTES: Record<string, string> = {
  C3: 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3', A3: 'A3.mp3',
  C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3', A4: 'A4.mp3', C5: 'C5.mp3',
};

/** Violin: VSCO 2 CE (CC0), A3 to A5 (its lowest string is G3, so it is played one octave up). */
const VIOLIN_NOTES: Record<string, string> = {
  A3: 'A3.mp3', C4: 'C4.mp3', E4: 'E4.mp3', G4: 'G4.mp3', A4: 'A4.mp3',
  C5: 'C5.mp3', E5: 'E5.mp3', G5: 'G5.mp3', A5: 'A5.mp3',
};

export const PRESETS: Preset[] = [
  { id: 'piano', name: 'Piano', behavior: 'strum', samples: { baseUrl: '/samples/piano/', notes: PIANO_NOTES } },
  { id: 'guitarra', name: 'Guitarra', behavior: 'strum' }, // synthesized (PluckSynth): no clean CC0/CC-BY guitar source
  { id: 'violin', name: 'Violín', behavior: 'sustain', samples: { baseUrl: '/samples/violin/', notes: VIOLIN_NOTES } },
  { id: 'calido', name: 'Cálido', behavior: 'sustain' },
  { id: 'cristal', name: 'Cristal', behavior: 'sustain' },
  { id: '8bit', name: '8-bit', behavior: 'sustain' },
  { id: 'nube', name: 'Nube', behavior: 'sustain' },
];

/** Octave shift applied to the chord voicing so every instrument sits in its natural register. */
export const REGISTER_SHIFT: Partial<Record<PresetId, number>> = { violin: 1 };

import type { Degree, Key } from '../music/theory';

/** Chord-only step. `note` documents a simplification made to the original chord. */
export interface SongStep { degree: Degree; beats: number; note?: string }
export interface Song { id: string; title: string; artist: string; key: Key; bpm: number; steps: SongStep[] }

import type { Degree, Mode, PitchClass } from '../music/theory';
import type { Song, SongStep } from './types';

const TONICS: readonly string[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MODES: readonly string[] = ['major', 'minor'];
const TOP_KEYS = ['id', 'title', 'artist', 'key', 'bpm', 'steps'];
const MAX_NOTE = 80;
const STEP_KEYS = ['degree', 'beats', 'note'];

function fail(msg: string): never { throw new Error(`Canción inválida: ${msg}`); }
function isObj(x: unknown): x is Record<string, unknown> { return typeof x === 'object' && x !== null && !Array.isArray(x); }
function str(x: unknown, name: string): string {
  if (typeof x !== 'string' || x.trim() === '') fail(`${name} debe ser texto no vacío`);
  return x;
}
function onlyKeys(o: Record<string, unknown>, allowed: string[], where: string): void {
  for (const k of Object.keys(o)) if (!allowed.includes(k)) fail(`campo no permitido "${k}" en ${where}`);
}

function validateStep(x: unknown, i: number): SongStep {
  if (!isObj(x)) fail(`paso ${i} no es un objeto`);
  onlyKeys(x, STEP_KEYS, `paso ${i}`);
  const { degree, beats, note } = x;
  if (!Number.isInteger(degree) || (degree as number) < 1 || (degree as number) > 7) fail(`degree del paso ${i} debe ser 1-7`);
  if (typeof beats !== 'number' || !Number.isFinite(beats) || beats <= 0) fail(`beats del paso ${i} debe ser > 0`);
  if (note !== undefined && (typeof note !== 'string' || note.length > MAX_NOTE)) fail(`note del paso ${i} debe ser texto de máximo ${MAX_NOTE} caracteres`);
  return note === undefined ? { degree: degree as Degree, beats } : { degree: degree as Degree, beats, note };
}

export function validateSong(x: unknown): Song {
  if (!isObj(x)) fail('no es un objeto');
  onlyKeys(x, TOP_KEYS, 'la canción');
  const key = x.key;
  if (!isObj(key) || !TONICS.includes(key.tonic as string) || !MODES.includes(key.mode as string)) fail('key inválida');
  const bpm = x.bpm;
  if (typeof bpm !== 'number' || !Number.isFinite(bpm) || bpm < 50 || bpm > 200) fail('bpm debe estar entre 50 y 200');
  if (!Array.isArray(x.steps) || x.steps.length === 0) fail('steps vacío');
  return {
    id: str(x.id, 'id'), title: str(x.title, 'title'), artist: str(x.artist, 'artist'),
    key: { tonic: key.tonic as PitchClass, mode: key.mode as Mode },
    bpm, steps: x.steps.map(validateStep),
  };
}

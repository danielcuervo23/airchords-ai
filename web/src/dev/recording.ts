import type { RawHand } from '../gestures/assignHands';
import type { GestureName } from '../gestures/types';
import type { Degree } from '../music/theory';

export interface RecordedFrame { t: number; hands: RawHand[] }
export interface Recording {
  gesture: Degree | 'none';
  device: string;
  /** assignHands setting in effect while recording, so tests can interpret labels. */
  labelsSwapped: boolean;
  aspect: number;
  frames: RecordedFrame[];
}

const LANDMARKS = 21;
const DEGREES = [1, 2, 3, 4, 5, 6, 7];
const GESTURES: readonly string[] = [
  'None', 'Closed_Fist', 'Open_Palm', 'Pointing_Up', 'Thumb_Down', 'Thumb_Up', 'Victory', 'ILoveYou',
] satisfies GestureName[];

const fail = (msg: string): never => {
  throw new Error(`Grabación inválida (recording): ${msg}`);
};
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, what: string): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fail(`${what} debe ser un número finite (número finito)`);

function checkHand(h: unknown, where: string): RawHand {
  if (!isObj(h)) return fail(`${where} no es un objeto`);
  if (h.label !== 'Left' && h.label !== 'Right') fail(`${where}.label debe ser Left o Right`);
  const score = num(h.score, `${where}.score`);
  if (!Array.isArray(h.landmarks) || h.landmarks.length !== LANDMARKS) {
    fail(`${where}.landmarks debe tener ${LANDMARKS} puntos`);
  }
  const landmarks = (h.landmarks as unknown[]).map((p, i) => {
    if (!isObj(p)) return fail(`${where}.landmarks[${i}] no es un objeto`);
    return { x: num(p.x, `${where}.landmarks[${i}].x`), y: num(p.y, `${where}.landmarks[${i}].y`), z: num(p.z, `${where}.landmarks[${i}].z`) };
  });
  let gesture: RawHand['gesture'] = null;
  if (h.gesture !== null && h.gesture !== undefined) {
    const g = h.gesture;
    if (!isObj(g) || typeof g.name !== 'string' || !GESTURES.includes(g.name)) fail(`${where}.gesture.name desconocido (gesture)`);
    const gg = g as Record<string, unknown>;
    gesture = { name: gg.name as GestureName, score: num(gg.score, `${where}.gesture.score`) };
  }
  return { label: h.label as 'Left' | 'Right', score, landmarks, gesture };
}

export function serializeRecording(rec: Recording): string {
  return JSON.stringify(rec);
}

export function parseRecording(json: string): Recording {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return fail('no es JSON válido (JSON)');
  }
  if (!isObj(raw)) return fail('la grabación debe ser un objeto');
  if (raw.gesture !== 'none' && !(typeof raw.gesture === 'number' && DEGREES.includes(raw.gesture))) {
    fail('gesture debe ser 1 a 7 o "none"');
  }
  if (typeof raw.device !== 'string') fail('device debe ser texto');
  if (typeof raw.labelsSwapped !== 'boolean') fail('labelsSwapped debe ser booleano');
  const aspect = num(raw.aspect, 'aspect');
  if (!Array.isArray(raw.frames)) return fail('frames debe ser una lista');
  const frames = (raw.frames as unknown[]).map((f, i) => {
    if (!isObj(f) || !Array.isArray(f.hands)) return fail(`frames[${i}] inválido`);
    const fr = f as { t: unknown; hands: unknown[] };
    return { t: num(fr.t, `frames[${i}].t`), hands: fr.hands.map((h, j) => checkHand(h, `frames[${i}].hands[${j}]`)) };
  });
  return { gesture: raw.gesture as Recording['gesture'], device: raw.device as string, labelsSwapped: raw.labelsSwapped as boolean, aspect, frames };
}

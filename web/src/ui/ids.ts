import { PRESETS, type PresetId } from '../audio/presets';
import { ALL_KEYS, type Key } from '../music/theory';

/** Values round-trip through the DOM (radio values), so they are parsed back, never trusted. */
export const keyId = (k: Key): string => `${k.tonic}|${k.mode}`;

export function parseKeyId(id: string): Key | null {
  return ALL_KEYS.find((k) => keyId(k) === id) ?? null;
}

export function parsePresetId(id: string): PresetId | null {
  return PRESETS.find((p) => p.id === id)?.id ?? null;
}

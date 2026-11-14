import { describe, expect, it } from 'vitest';
import { ALL_KEYS } from '../../../src/music/theory';
import { keyId, parseKeyId, parsePresetId } from '../../../src/ui/ids';

describe('ids coming back from the DOM are validated', () => {
  it('accepts every real preset id', () => {
    expect(parsePresetId('piano')).toBe('piano');
    expect(parsePresetId('8bit')).toBe('8bit');
  });
  it('rejects unknown or inherited names', () => {
    expect(parsePresetId('órgano')).toBeNull();
    expect(parsePresetId('constructor')).toBeNull();
    expect(parsePresetId('guitarra')).toBeNull(); // hidden in v1
    expect(parsePresetId('')).toBeNull();
  });
  it('round-trips all 24 keys and rejects garbage', () => {
    for (const k of ALL_KEYS) expect(parseKeyId(keyId(k))).toEqual(k);
    expect(parseKeyId('H|major')).toBeNull();
    expect(parseKeyId('C|dorian')).toBeNull();
  });
});

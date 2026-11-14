import { describe, expect, it } from 'vitest';
import { audioNotice } from '../../../src/ui/audioNotice';

describe('audioNotice (when to ask for a tap to unlock sound)', () => {
  it('nothing while the audio runs', () => expect(audioNotice('running')).toBeNull());
  it('asks for a tap while suspended (iOS before a gesture)', () =>
    expect(audioNotice('suspended')).toBe('Toca para activar el sonido'));
  it('asks for a tap after an iOS interruption (a call)', () =>
    expect(audioNotice('interrupted')).toBe('Toca para activar el sonido'));
  it('nothing once closed (the session ended)', () => expect(audioNotice('closed')).toBeNull());
});

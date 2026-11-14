import { describe, expect, it } from 'vitest';
import { shouldIncludeRecorder } from '../../../build/recorderFlag';

describe('shouldIncludeRecorder', () => {
  it('includes it when VERCEL_ENV is undefined (local build)', () => expect(shouldIncludeRecorder({})).toBe(true));
  it('includes it on preview', () => expect(shouldIncludeRecorder({ VERCEL_ENV: 'preview' })).toBe(true));
  it('excludes it on production', () => expect(shouldIncludeRecorder({ VERCEL_ENV: 'production' })).toBe(false));
  it('production + VITE_ENABLE_RECORDER=1 includes it', () =>
    expect(shouldIncludeRecorder({ VERCEL_ENV: 'production', VITE_ENABLE_RECORDER: '1' })).toBe(true));
  it('production + other flag values stays excluded', () =>
    expect(shouldIncludeRecorder({ VERCEL_ENV: 'production', VITE_ENABLE_RECORDER: 'true' })).toBe(false));
});

import { describe, expect, it } from 'vitest';
import { shouldUseFakeTracker } from '../../../build/e2eFlag';

describe('shouldUseFakeTracker', () => {
  it('is off by default', () => expect(shouldUseFakeTracker({}, 'production')).toBe(false));
  it('is on with VITE_E2E=1 and --mode e2e, locally', () =>
    expect(shouldUseFakeTracker({ VITE_E2E: '1' }, 'e2e')).toBe(true));
  it('the flag alone is not enough: the build mode must be e2e', () =>
    expect(shouldUseFakeTracker({ VITE_E2E: '1' }, 'production')).toBe(false));
  it('the mode alone is not enough either', () => expect(shouldUseFakeTracker({}, 'e2e')).toBe(false));
  it('only the exact value 1 turns it on', () => expect(shouldUseFakeTracker({ VITE_E2E: 'true' }, 'e2e')).toBe(false));
  it('is impossible on Vercel production, even with flag and mode', () =>
    expect(shouldUseFakeTracker({ VERCEL_ENV: 'production', VITE_E2E: '1' }, 'e2e')).toBe(false));
  it('is impossible on any Vercel build', () =>
    expect(shouldUseFakeTracker({ VERCEL: '1', VERCEL_ENV: 'preview', VITE_E2E: '1' }, 'e2e')).toBe(false));
});

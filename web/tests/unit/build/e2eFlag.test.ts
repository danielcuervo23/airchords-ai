import { describe, expect, it } from 'vitest';
import { shouldUseFakeTracker } from '../../../build/e2eFlag';

describe('shouldUseFakeTracker', () => {
  it('is off by default', () => expect(shouldUseFakeTracker({})).toBe(false));
  it('is on locally with VITE_E2E=1', () => expect(shouldUseFakeTracker({ VITE_E2E: '1' })).toBe(true));
  it('only the exact value 1 turns it on', () => expect(shouldUseFakeTracker({ VITE_E2E: 'true' })).toBe(false));
  it('is impossible on Vercel production, even with the flag', () =>
    expect(shouldUseFakeTracker({ VERCEL_ENV: 'production', VITE_E2E: '1' })).toBe(false));
  it('is impossible on any Vercel build', () =>
    expect(shouldUseFakeTracker({ VERCEL: '1', VERCEL_ENV: 'preview', VITE_E2E: '1' })).toBe(false));
});

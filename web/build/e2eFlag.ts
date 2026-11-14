/**
 * The scripted fake tracker (for Playwright) replaces MediaPipe only in local test builds made
 * with `vite build --mode e2e` AND the exact flag VITE_E2E=1, and never on any Vercel build.
 * vite.config turns this into a compile-time constant, so production bundles do not contain it.
 */
export function shouldUseFakeTracker(env: Record<string, string | undefined>, mode: string): boolean {
  const onVercel = env.VERCEL === '1' || env.VERCEL_ENV !== undefined;
  return !onVercel && mode === 'e2e' && env.VITE_E2E === '1';
}

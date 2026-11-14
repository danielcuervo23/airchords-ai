/**
 * The scripted fake tracker (for Playwright) replaces MediaPipe only in local test builds:
 * never on any Vercel build, and only with the exact flag VITE_E2E=1.
 * vite.config turns this into a compile-time constant, so production bundles do not contain it.
 */
export function shouldUseFakeTracker(env: Record<string, string | undefined>): boolean {
  const onVercel = env.VERCEL === '1' || env.VERCEL_ENV !== undefined;
  return !onVercel && env.VITE_E2E === '1';
}

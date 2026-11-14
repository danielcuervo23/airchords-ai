/** recorder.html ships in every build except Vercel production, unless explicitly enabled. */
export function shouldIncludeRecorder(env: Record<string, string | undefined>): boolean {
  return env.VERCEL_ENV !== 'production' || env.VITE_ENABLE_RECORDER === '1';
}

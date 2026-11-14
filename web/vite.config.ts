import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { shouldUseFakeTracker } from './build/e2eFlag.ts';
import { shouldIncludeRecorder } from './build/recorderFlag.ts';

const input: Record<string, string> = { main: resolve(import.meta.dirname, 'index.html') };
if (shouldIncludeRecorder(process.env)) {
  input.recorder = resolve(import.meta.dirname, 'recorder.html');
}

export default defineConfig(({ mode }) => ({
  // A literal constant, so the bundler removes the fake-tracker branch from real builds.
  define: { __E2E__: JSON.stringify(shouldUseFakeTracker(process.env, mode)) },
  build: { rollupOptions: { input } },
}));

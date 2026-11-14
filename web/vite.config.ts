import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { shouldIncludeRecorder } from './build/recorderFlag.ts';

const input: Record<string, string> = { main: resolve(import.meta.dirname, 'index.html') };
if (shouldIncludeRecorder(process.env)) {
  input.recorder = resolve(import.meta.dirname, 'recorder.html');
  input.filterTest = resolve(import.meta.dirname, 'filter-test.html');
}

export default defineConfig({ build: { rollupOptions: { input } } });

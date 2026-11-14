import { defineConfig, devices } from '@playwright/test';

/**
 * E2E runs against a production-style build made with VITE_E2E=1, which swaps MediaPipe for a
 * scripted fake tracker (see build/e2eFlag.ts). Chromium supplies a fake camera stream.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5173',
    ...devices['Desktop Chrome'],
    launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] },
  },
  projects: [
    { name: 'escritorio', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'telefono', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: false } },
  ],
  webServer: {
    command: 'npx vite build --outDir dist-e2e --emptyOutDir && npx vite preview --outDir dist-e2e --port 5173 --strictPort',
    url: 'http://localhost:5173',
    env: { VITE_E2E: '1' },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

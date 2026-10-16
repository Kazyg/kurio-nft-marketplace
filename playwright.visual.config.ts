import { defineConfig, devices } from '@playwright/test'

const development = process.env.E2E_TARGET === 'dev'

export default defineConfig({
  testDir: './scripts',
  testMatch: 'visual-regression.spec.ts',
  fullyParallel: true,
  workers: 2,
  retries: 0,
  forbidOnly: !!process.env.CI,
  outputDir: 'reports/phase-5b/visual/results',
  snapshotPathTemplate:
    '{testDir}/../tests/visual-baselines/{platform}/{projectName}/{arg}{ext}',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/phase-5b/visual/html', open: 'never' }],
    ['json', { outputFile: 'reports/phase-5b/visual/results.json' }],
  ],
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      threshold: 0.2,
      maxDiffPixels: 0,
    },
  },
  use: {
    baseURL: 'http://127.0.0.1:4180',
    locale: 'pt-BR',
    timezoneId: 'UTC',
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [390, 768, 1440].map((width) => ({
    name: `chromium-${width}`,
    use: {
      ...devices['Desktop Chrome'],
      viewport: { width, height: 900 },
      deviceScaleFactor: 1,
    },
  })),
  webServer: {
    command: development
      ? 'bun run dev --host 127.0.0.1 --port 4180 --strictPort'
      : 'bun run build:demo && bun run preview --host 127.0.0.1 --port 4180 --strictPort',
    env: { VITE_ENABLE_MSW: 'true', ...(development && { E2E_TARGET: 'dev' }) },
    url: 'http://127.0.0.1:4180',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})

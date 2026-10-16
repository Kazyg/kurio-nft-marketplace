import { defineConfig } from '@playwright/test'
import base from './playwright.config.js'

export default defineConfig({
  ...base,
  testDir: './scripts',
  testMatch: 'visual-audit.spec.ts',
  outputDir: `reports/phase-5/${process.env.KURIO_AUDIT_STAGE || 'after'}/runner`,
  reporter: [['list']],
  workers: 2,
  retries: 0,
  webServer: {
    ...base.webServer,
    command: 'bun run dev --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    env: { VITE_ENABLE_MSW: 'true', E2E_TARGET: 'dev' },
    reuseExistingServer: false,
  },
})

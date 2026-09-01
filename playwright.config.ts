import { defineConfig, devices } from '@playwright/test'

/**
 * PULSE Frontend — Playwright configuration
 *
 * By default tests run against the deployed production frontend:
 *   https://pulse-frontend-jt53.onrender.com
 *
 * For local development:
 *   PW_BASE_URL=http://localhost:5173 npx playwright test
 *
 * Usage:
 *   npx playwright test          — run all E2E tests
 *   npx playwright test --ui     — run in UI mode
 *   npm run test:e2e             — convenience script
 */
const baseURL = process.env.PW_BASE_URL || 'https://pulse-frontend-jt53.onrender.com'
const isLocal = baseURL.includes('localhost') || baseURL.includes('127.0.0.1')

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,

  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: isLocal
    ? {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      }
    : undefined,
})

import { defineConfig, devices } from '@playwright/test';

// Read-only smoke checks against the live site (production by default).
// Run by .github/workflows/site-smoke.yml every 3 hours.
// No local server: set SMOKE_URL to point at a preview instead.
export default defineConfig({
  testDir: './tests/smoke',
  timeout: 60000,
  retries: 1,
  // The JSON report feeds the Telegram alert (scripts/smoke-telegram.sh).
  reporter: [['list'], ['json', { outputFile: 'test-results/smoke-report.json' }]],
  outputDir: 'test-results/smoke',
  use: {
    baseURL: process.env.SMOKE_URL || 'https://briancline.co',
    // Browse as a local customer would. The CI runner is on UTC, which makes
    // the scheduler add a second "your time" line to every slot.
    timezoneId: 'America/Los_Angeles',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});

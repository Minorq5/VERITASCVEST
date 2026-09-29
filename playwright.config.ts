import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against the local stack: `npm run db:start` + `npm run dev`.
 * Emails are read from the local test inbox (Mailpit), never sent anywhere.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  outputDir: 'test-results/e2e',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    {
      name: 'phone',
      // The sync tests open a phone next to the computer themselves.
      testIgnore: /sync\.spec\.ts/,
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 393, height: 852 },
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/ru',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});

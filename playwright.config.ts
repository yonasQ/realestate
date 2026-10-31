import { defineConfig, devices } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'

// Local .env values (gitignored) supply the dev admin used by admin journeys.
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]
  }
}

const PORT = Number(process.env.E2E_PORT ?? 3300)
export const BASE_URL = `http://127.0.0.1:${PORT}`
const E2E_DB = process.env.E2E_DATABASE_URL ?? (process.env.DATABASE_URL ?? '').replace(/\/[^/?]+(\?|$)/, '/realtor_e2e$1')
process.env.E2E_DATABASE_URL = E2E_DB

/**
 * Runs against the production standalone server (`pnpm build` first), not the dev
 * server, so what is tested is what ships.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './e2e/global-setup.ts',
  use: { baseURL: BASE_URL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /responsive|journeys/ },
  ],
  webServer: {
    command: 'mkdir -p .next/standalone/.next && cp -r .next/static .next/standalone/.next/ && node .next/standalone/server.js',
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      PORT: String(PORT),
      HOSTNAME: '127.0.0.1',
      DATABASE_URL: E2E_DB,
      SITE_URL: BASE_URL,
      APP_SECRET: process.env.APP_SECRET ?? 'e2e-secret-e2e-secret-e2e-secret-0123456789',
      STORAGE_DIR: `${process.cwd()}/storage`,
      CRON_SECRET: 'e2e-cron-secret-0123456789abcdef',
      LOG_LEVEL: 'warn',
    },
  },
})

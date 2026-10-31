import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

// Load .env (if present) without overriding variables already set (CI provides its own).
const file = path.resolve(__dirname, '../../.env')
if (existsSync(file)) {
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]
  }
}
// Always use the dedicated test database and never real notification channels.
const base = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL?.replace(/\/[^/?]+(\?|$)/, '/realtor_test$1')
if (!base || !base.includes('test')) throw new Error('Refusing to run tests without a *test* database (set TEST_DATABASE_URL)')
Object.assign(process.env, {
  DATABASE_URL: base,
  NODE_ENV: 'test',
  APP_SECRET: process.env.APP_SECRET || 'test-secret-test-secret-test-secret-0123456789',
  SITE_URL: 'http://localhost:3200',
  STORAGE_DIR: path.resolve(__dirname, '../../.test-storage'),
  SMTP_HOST: '',
  INQUIRY_NOTIFY_EMAIL: '',
  CRM_WEBHOOK_URL: '',
  CRM_WEBHOOK_SECRET: '',
  TURNSTILE_SECRET_KEY: '',
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: '',
  LOG_LEVEL: 'error',
})

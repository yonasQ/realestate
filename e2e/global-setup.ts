import { execFileSync } from 'node:child_process'
import postgres from 'postgres'

/** Clean per-run state in the e2e database and make sure the e2e admin exists. */
export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL!
  if (!url.includes('e2e')) throw new Error('E2E_DATABASE_URL must point to an e2e database')
  const sql = postgres(url, { max: 1, onnotice: () => {} })
  try {
    await sql`TRUNCATE inquiries, rate_limits, sessions`
    await sql`UPDATE admin_users SET failed_login_count = 0, locked_until = NULL`
  } finally {
    await sql.end()
  }
  if (!process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD) throw new Error('Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (see .env.example)')
  execFileSync('npx', ['tsx', '--conditions=react-server', 'scripts/create-admin.ts', '--email', process.env.E2E_ADMIN_EMAIL, '--name', 'E2E Admin', '--role', 'admin'], {
    env: { ...process.env, DATABASE_URL: url, ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD, APP_SECRET: process.env.APP_SECRET ?? 'x'.repeat(40) },
    stdio: 'inherit',
  })
}

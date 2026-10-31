/**
 * Applies pending SQL migrations from ./drizzle. Run once per deploy as a release
 * step (before new app instances take traffic). A Postgres advisory lock makes
 * concurrent invocations safe: the second waits, then finds nothing to apply.
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const LOCK_KEY = 727_001 // arbitrary app-wide constant

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')
  const sql = postgres(url, { max: 1, onnotice: () => {}, connect_timeout: 10 })
  try {
    await sql`SELECT pg_advisory_lock(${LOCK_KEY})`
    const started = Date.now()
    await migrate(drizzle(sql), { migrationsFolder: './drizzle' })
    console.log(JSON.stringify({ level: 'info', event: 'migrations.applied', ms: Date.now() - started }))
  } finally {
    await sql`SELECT pg_advisory_unlock(${LOCK_KEY})`.catch(() => {})
    await sql.end({ timeout: 5 })
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ level: 'error', event: 'migrations.failed', message: String(err?.message ?? err) }))
  process.exit(1)
})

import { sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { log } from '@/lib/log'

export const dynamic = 'force-dynamic'

/** Liveness + readiness: 200 only if the database answers within 2s. No internals exposed. */
export async function GET() {
  const started = Date.now()
  try {
    await Promise.race([
      db().execute(sql`SELECT 1`),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
    ])
    return Response.json({ status: 'ok', db: 'ok', ms: Date.now() - started }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    log.error('health.check_failed', { err })
    return Response.json({ status: 'degraded', db: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}

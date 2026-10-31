import 'server-only'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { log } from '@/lib/log'

export type RateLimitRule = { name: string; limit: number; windowSeconds: number }

export const RULES = {
  inquiryPerIp: { name: 'inquiry:ip', limit: 8, windowSeconds: 60 * 10 },
  inquiryPerIpDaily: { name: 'inquiry:ip:day', limit: 40, windowSeconds: 60 * 60 * 24 },
  loginPerIp: { name: 'login:ip', limit: 10, windowSeconds: 60 * 15 },
  loginPerEmail: { name: 'login:email', limit: 6, windowSeconds: 60 * 15 },
  uploadPerUser: { name: 'upload:user', limit: 120, windowSeconds: 60 * 60 },
} satisfies Record<string, RateLimitRule>

/**
 * Fixed-window counter stored in Postgres: atomic across all app instances with
 * no extra infrastructure. One upsert per check. Fails open (allows) if the
 * database errors, because the same request would then fail anyway at its own
 * write and we never want rate limiting to be the outage.
 */
export async function hit(rule: RateLimitRule, key: string): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const nowMs = Date.now()
  const windowMs = rule.windowSeconds * 1000
  const windowStart = new Date(Math.floor(nowMs / windowMs) * windowMs)
  const bucket = `${rule.name}:${key}`
  try {
    const rows = await db().execute<{ count: number }>(sql`
      INSERT INTO rate_limits (bucket, window_start, count)
      VALUES (${bucket}, ${windowStart.toISOString()}, 1)
      ON CONFLICT (bucket, window_start) DO UPDATE SET count = rate_limits.count + 1
      RETURNING count`)
    const count = Number(rows[0]?.count ?? 1)
    // Opportunistic cleanup (~1% of calls) keeps the table small without a cron.
    if (Math.random() < 0.01) {
      await db().execute(sql`DELETE FROM rate_limits WHERE window_start < now() - interval '2 days'`)
    }
    const retryAfterSeconds = Math.ceil((windowStart.getTime() + windowMs - nowMs) / 1000)
    return { allowed: count <= rule.limit, retryAfterSeconds }
  } catch (err) {
    log.error('rate_limit.check_failed', { rule: rule.name, err })
    return { allowed: true, retryAfterSeconds: 0 }
  }
}

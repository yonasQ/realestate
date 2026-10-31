import { timingSafeEqual } from 'node:crypto'
import { env } from '@/lib/env'
import { processDueDeliveries } from '@/lib/inquiries/delivery'
import { log } from '@/lib/log'

export const dynamic = 'force-dynamic'

function authorized(req: Request): boolean {
  const secret = env().CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') ?? ''
  const expected = Buffer.from(`Bearer ${secret}`)
  const actual = Buffer.from(header)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

/** Retries pending/failed inquiry notifications. Call every few minutes from a scheduler. */
export async function POST(req: Request) {
  if (!authorized(req)) return new Response('Unauthorized', { status: 401 })
  const result = await processDueDeliveries(25)
  if (result.processed) log.info('cron.notifications', result)
  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
}

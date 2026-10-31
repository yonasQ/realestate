import 'server-only'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { inquiries, type Inquiry } from '@/lib/db/schema'
import { log } from '@/lib/log'
import { PermanentDeliveryError, configuredChannels, sendEmailNotification, sendWebhook, type Channel } from './channels'

export const MAX_DELIVERY_ATTEMPTS = 8
const LOCK_SECONDS = 120

/** Exponential backoff with jitter: ~1m, 2m, 4m … capped at 6h. */
export function nextAttemptDelaySeconds(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(60 * 2 ** Math.max(0, attempt - 1), 6 * 3600)
  return Math.round(base * (0.8 + random() * 0.4))
}

/**
 * Claims inquiries due for delivery. A lease (delivery_locked_until) plus
 * SKIP LOCKED means concurrent workers never process the same row, and a
 * crashed worker's rows become claimable again once the lease expires.
 */
export async function claimDue(limit: number, onlyId?: string): Promise<Inquiry[]> {
  const rows = await db().execute(sql`
    UPDATE inquiries SET
      delivery_status = 'processing',
      delivery_locked_until = now() + make_interval(secs => ${LOCK_SECONDS}),
      delivery_attempts = delivery_attempts + 1,
      updated_at = now()
    WHERE id IN (
      SELECT id FROM inquiries
      WHERE (delivery_status IN ('pending', 'failed') AND delivery_next_attempt_at <= now())
         OR (delivery_status = 'processing' AND delivery_locked_until < now())
      ${onlyId ? sql`AND id = ${onlyId}` : sql``}
      ORDER BY created_at
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id`)
  const ids = (rows as unknown as { id: string }[]).map((r) => r.id)
  if (!ids.length) return []
  return db().select().from(inquiries).where(sql`${inquiries.id} IN ${ids}`)
}

async function deliverOne(i: Inquiry): Promise<void> {
  const channels = configuredChannels()
  if (!channels.length) {
    // Nothing external configured: the admin inbox is the destination.
    await db()
      .update(inquiries)
      .set({ deliveryStatus: 'skipped', deliveryLockedUntil: null, deliveryNextAttemptAt: null, deliveryLastError: 'No notification channel configured', updatedAt: new Date() })
      .where(eq(inquiries.id, i.id))
    log.warn('inquiry.delivery_skipped', { inquiryId: i.id, reason: 'no_channels' })
    return
  }

  const errors: string[] = []
  let permanent = false
  const done: Partial<Record<Channel, Date>> = {}
  for (const ch of channels) {
    if (ch === 'email' && i.emailSentAt) continue
    if (ch === 'webhook' && i.webhookSentAt) continue
    try {
      if (ch === 'email') await sendEmailNotification(i)
      else await sendWebhook(i)
      done[ch] = new Date()
      // Record each channel immediately so a crash before the final update does not resend it.
      await db()
        .update(inquiries)
        .set(ch === 'email' ? { emailSentAt: done[ch] } : { webhookSentAt: done[ch] })
        .where(eq(inquiries.id, i.id))
    } catch (err) {
      permanent ||= err instanceof PermanentDeliveryError
      errors.push(`${ch}: ${(err as Error).message}`.slice(0, 300))
      log.error('inquiry.delivery_channel_failed', { inquiryId: i.id, channel: ch, attempt: i.deliveryAttempts, err })
    }
  }

  if (!errors.length) {
    await db()
      .update(inquiries)
      .set({ deliveryStatus: 'delivered', deliveredAt: new Date(), deliveryLockedUntil: null, deliveryNextAttemptAt: null, deliveryLastError: null, updatedAt: new Date() })
      .where(eq(inquiries.id, i.id))
    log.info('inquiry.delivered', { inquiryId: i.id, channels })
    return
  }

  const exhausted = permanent || i.deliveryAttempts >= MAX_DELIVERY_ATTEMPTS
  const delay = nextAttemptDelaySeconds(i.deliveryAttempts)
  await db()
    .update(inquiries)
    .set({
      deliveryStatus: 'failed',
      deliveryLockedUntil: null,
      deliveryLastError: errors.join(' | '),
      // NULL next attempt = stop retrying; visible in admin for manual retry.
      deliveryNextAttemptAt: exhausted ? null : new Date(Date.now() + delay * 1000),
      updatedAt: new Date(),
    })
    .where(eq(inquiries.id, i.id))
  ;(exhausted ? log.error : log.warn)('inquiry.delivery_failed', {
    inquiryId: i.id,
    attempt: i.deliveryAttempts,
    willRetry: !exhausted,
    retryInSeconds: exhausted ? null : delay,
  })
}

/** Attempts delivery of one specific inquiry (called right after it is stored). */
export async function deliverInquiry(id: string): Promise<void> {
  const [row] = await claimDue(1, id)
  if (row) await deliverOne(row)
}

/** Processes a batch of due inquiries (cron / admin "retry"). Sequential to bound load on providers. */
export async function processDueDeliveries(limit = 20): Promise<{ processed: number }> {
  const rows = await claimDue(limit)
  for (const r of rows) {
    try {
      await deliverOne(r)
    } catch (err) {
      log.error('inquiry.delivery_unexpected_error', { inquiryId: r.id, err })
    }
  }
  return { processed: rows.length }
}

/** Admin action: make a failed inquiry eligible again immediately. */
export async function requeueDelivery(id: string): Promise<void> {
  await db()
    .update(inquiries)
    .set({ deliveryStatus: 'pending', deliveryNextAttemptAt: new Date(), deliveryLockedUntil: null, updatedAt: new Date() })
    .where(sql`${inquiries.id} = ${id} AND ${inquiries.deliveryStatus} IN ('failed', 'skipped')`)
}

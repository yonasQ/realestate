import { createServer, type Server } from 'node:http'
import { randomUUID } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, db } from '@/lib/db/client'
import { inquiries } from '@/lib/db/schema'
import { resetEnvCache } from '@/lib/env'
import { claimDue, deliverInquiry, processDueDeliveries, requeueDelivery } from '@/lib/inquiries/delivery'
import { webhookSignature } from '@/lib/inquiries/channels'
import { InquiryRejectedError, createInquiry } from '@/lib/inquiries/service'
import { inquiryInputSchema, type InquiryInput } from '@/lib/validation/inquiry'
import { resetDb, seedCatalog } from '../support/db'

const ctx = { ipHash: 'test', userAgent: 'vitest' }
const input = (o: Partial<Record<string, unknown>> = {}): InquiryInput =>
  inquiryInputSchema.parse({
    idempotencyKey: randomUUID(),
    type: 'property',
    propertySlug: 'cp-1br',
    name: 'Abebe Kebede',
    phone: '0911223344',
    preferredContact: 'phone',
    message: 'Is this still available?',
    consent: true,
    ...o,
  })
const count = async () => Number((await db().execute(sql`SELECT count(*)::int AS n FROM inquiries`))[0]!.n)

beforeAll(async () => {
  await resetDb()
  await seedCatalog()
})
beforeEach(async () => {
  await db().execute(sql`TRUNCATE inquiries`)
})
afterAll(() => closeDb())

describe('createInquiry', () => {
  it('stores an inquiry with a reference and resolved subject snapshot', async () => {
    const r = await createInquiry(input(), ctx)
    expect(r.created).toBe(true)
    expect(r.reference).toMatch(/^INQ-[A-Z2-9]{6}$/)
    const [row] = await db().select().from(inquiries).where(eq(inquiries.id, r.id))
    expect(row!.subjectLabel).toBe('cp-1br')
    expect(row!.deliveryStatus).toBe('pending')
    expect(row!.consentVersion).toBeTruthy()
  })

  it('is idempotent: retries with the same key return the same inquiry', async () => {
    const i = input()
    const a = await createInquiry(i, ctx)
    const b = await createInquiry(i, ctx)
    expect(b).toEqual({ ...a, created: false })
    expect(await count()).toBe(1)
  })

  it('is safe under concurrent duplicate submissions (database-enforced)', async () => {
    const i = input()
    const results = await Promise.all(Array.from({ length: 12 }, () => createInquiry(i, ctx)))
    expect(new Set(results.map((r) => r.id)).size).toBe(1)
    expect(results.filter((r) => r.created)).toHaveLength(1)
    expect(await count()).toBe(1)
  })

  it('treats identical content from a fresh form on the same day as a duplicate', async () => {
    const a = await createInquiry(input({ message: 'Same text' }), ctx)
    const b = await createInquiry(input({ message: 'Same text' }), ctx)
    expect(b.id).toBe(a.id)
    expect(b.created).toBe(false)
    const c = await createInquiry(input({ message: 'Different text' }), ctx)
    expect(c.created).toBe(true)
  })

  it('rejects reuse of a key with different content instead of merging', async () => {
    const key = randomUUID()
    await createInquiry(input({ idempotencyKey: key, message: 'first' }), ctx)
    await expect(createInquiry(input({ idempotencyKey: key, message: 'second' }), ctx)).rejects.toMatchObject({ status: 409 })
  })

  it('rejects unpublished, hidden or sold listings', async () => {
    await expect(createInquiry(input({ propertySlug: 'draft-listing' }), ctx)).rejects.toBeInstanceOf(InquiryRejectedError)
    await expect(createInquiry(input({ propertySlug: 'in-hidden-dev' }), ctx)).rejects.toBeInstanceOf(InquiryRejectedError)
    await expect(createInquiry(input({ propertySlug: 'sold-unit' }), ctx)).rejects.toBeInstanceOf(InquiryRejectedError)
    await expect(createInquiry(input({ type: 'development', propertySlug: undefined, developmentSlug: 'hidden-dev' }), ctx)).rejects.toBeInstanceOf(InquiryRejectedError)
    expect(await count()).toBe(0)
  })

  it('stores viewing requests with date and window', async () => {
    const d = new Date(Date.now() + 3 * 864e5)
    if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1)
    const date = d.toISOString().slice(0, 10)
    const r = await createInquiry(input({ type: 'viewing', preferredDate: date, preferredWindow: 'morning' }), ctx)
    const [row] = await db().select().from(inquiries).where(eq(inquiries.id, r.id))
    expect(row!.preferredDate).toBe(date)
    expect(row!.preferredWindow).toBe('morning')
  })
})

describe('notification delivery', () => {
  let server: Server
  let url = ''
  let mode: 'ok' | 'fail' | 'reject' = 'ok'
  const received: { headers: Record<string, string | string[] | undefined>; body: string }[] = []

  beforeAll(async () => {
    server = createServer((req, res) => {
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', () => {
        received.push({ headers: req.headers, body })
        res.statusCode = mode === 'ok' ? 200 : mode === 'fail' ? 503 : 400
        res.end()
      })
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    const addr = server.address() as { port: number }
    url = `http://127.0.0.1:${addr.port}/hook`
  })
  afterAll(async () => {
    await new Promise((r) => server.close(r))
    process.env.CRM_WEBHOOK_URL = ''
    process.env.CRM_WEBHOOK_SECRET = ''
    resetEnvCache()
  })
  const enableWebhook = () => {
    process.env.CRM_WEBHOOK_URL = url
    process.env.CRM_WEBHOOK_SECRET = 'whsec-test'
    resetEnvCache()
  }

  it('marks inquiries as skipped (still in inbox) when no channel is configured', async () => {
    process.env.CRM_WEBHOOK_URL = ''
    resetEnvCache()
    const r = await createInquiry(input(), ctx)
    await deliverInquiry(r.id)
    const [row] = await db().select().from(inquiries).where(eq(inquiries.id, r.id))
    expect(row!.deliveryStatus).toBe('skipped')
  })

  it('delivers a signed webhook with an idempotency key exactly once on success', async () => {
    enableWebhook()
    mode = 'ok'
    received.length = 0
    const r = await createInquiry(input(), ctx)
    await deliverInquiry(r.id)
    await deliverInquiry(r.id) // second call finds nothing to claim
    expect(received).toHaveLength(1)
    const h = received[0]!.headers
    expect(h['idempotency-key']).toBe(r.id)
    expect(h['x-webhook-signature']).toBe(`sha256=${webhookSignature('whsec-test', String(h['x-webhook-timestamp']), received[0]!.body)}`)
    const [row] = await db().select().from(inquiries).where(eq(inquiries.id, r.id))
    expect(row!.deliveryStatus).toBe('delivered')
    expect(row!.webhookSentAt).not.toBeNull()
  })

  it('schedules a backoff retry on transient failure, then succeeds', async () => {
    enableWebhook()
    mode = 'fail'
    const r = await createInquiry(input(), ctx)
    await deliverInquiry(r.id)
    let [row] = await db().select().from(inquiries).where(eq(inquiries.id, r.id))
    expect(row!.deliveryStatus).toBe('failed')
    expect(row!.deliveryNextAttemptAt!.getTime()).toBeGreaterThan(Date.now())
    expect(row!.deliveryLastError).toMatch(/503/)
    // Not due yet → not reprocessed.
    expect((await processDueDeliveries()).processed).toBe(0)
    // Admin retry makes it due immediately.
    mode = 'ok'
    await requeueDelivery(r.id)
    await processDueDeliveries()
    ;[row] = await db().select().from(inquiries).where(eq(inquiries.id, r.id))
    expect(row!.deliveryStatus).toBe('delivered')
    expect(row!.deliveryAttempts).toBe(2)
  })

  it('stops retrying on a permanent (4xx) failure', async () => {
    enableWebhook()
    mode = 'reject'
    const r = await createInquiry(input(), ctx)
    await deliverInquiry(r.id)
    const [row] = await db().select().from(inquiries).where(eq(inquiries.id, r.id))
    expect(row!.deliveryStatus).toBe('failed')
    expect(row!.deliveryNextAttemptAt).toBeNull()
  })

  it('never lets two workers claim the same inquiry', async () => {
    await db().execute(sql`TRUNCATE inquiries`)
    for (let k = 0; k < 10; k++) await createInquiry(input({ message: `m${k}` }), ctx)
    const [a, b, c] = await Promise.all([claimDue(6), claimDue(6), claimDue(6)])
    const ids = [...a!, ...b!, ...c!].map((r) => r.id)
    expect(ids).toHaveLength(10)
    expect(new Set(ids).size).toBe(10)
  })

  it('reclaims work abandoned by a crashed worker after the lease expires', async () => {
    await db().execute(sql`TRUNCATE inquiries`)
    const r = await createInquiry(input(), ctx)
    await claimDue(1) // simulate a worker that claimed then died
    expect(await claimDue(1)).toHaveLength(0)
    await db().update(inquiries).set({ deliveryLockedUntil: new Date(Date.now() - 1000) }).where(eq(inquiries.id, r.id))
    expect((await claimDue(1)).map((x) => x.id)).toEqual([r.id])
  })
})

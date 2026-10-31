import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ContentError, saveImages, saveProperty } from '@/lib/admin/content-service'
import { attemptLogin } from '@/lib/auth/login'
import { hashPassword } from '@/lib/auth/password'
import { closeDb, db } from '@/lib/db/client'
import { adminUsers, auditLog, properties } from '@/lib/db/schema'
import { RULES, hit } from '@/lib/security/rate-limit'
import { propertyFormSchema } from '@/lib/validation/content'
import { makeMedia, resetDb, seedCatalog } from '../support/db'

let actorId = ''
let seeded: Awaited<ReturnType<typeof seedCatalog>>

beforeAll(async () => {
  await resetDb()
  seeded = await seedCatalog()
  const [u] = await db().insert(adminUsers).values({ email: 'Editor@Example.test', name: 'Ed', role: 'editor', passwordHash: await hashPassword('a-very-good-passphrase') }).returning()
  actorId = u!.id
})
afterAll(() => closeDb())

const form = (o: Record<string, string>) =>
  propertyFormSchema.parse({
    version: '1', title: 'Edited title for listing', slug: 'cp-1br', developmentId: seeded.devs.sarbet.id, propertyType: 'apartment',
    status: 'published', availability: 'available', bedrooms: '1', bathrooms: '1', sizeSqm: '76', priceMode: 'on_request',
    summary: 'Updated summary for the one bedroom unit.', description: '', ...o,
  })

describe('content editing', () => {
  it('updates a listing, bumps the version and writes an audit entry', async () => {
    const id = seeded.props.cp1.id
    const res = await saveProperty(id, form({ priceMode: 'fixed', priceAmount: '8000000', priceCurrency: 'ETB' }), actorId)
    expect(res.version).toBe(2)
    const [row] = await db().select().from(properties).where(eq(properties.id, id))
    expect(row!.title).toBe('Edited title for listing')
    expect(row!.priceAmount).toBe('8000000.00')
    expect(row!.priceCurrency).toBe('ETB')
    const logs = await db().select().from(auditLog).where(eq(auditLog.entityId, id))
    expect(logs.length).toBeGreaterThan(0)
  })

  it('rejects stale edits (optimistic concurrency)', async () => {
    await expect(saveProperty(seeded.props.cp1.id, form({ version: '1' }), actorId)).rejects.toMatchObject({ code: 'conflict' })
  })

  it('serialises concurrent saves of the same version: exactly one wins', async () => {
    const id = seeded.props.af4.id
    const f = (t: string) => form({ version: '1', slug: 'af-4br', developmentId: seeded.devs.ayat.id, title: t, bedrooms: '4' })
    const results = await Promise.allSettled([saveProperty(id, f('Writer one wins'), actorId), saveProperty(id, f('Writer two wins'), actorId)])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1)
  })

  it('enforces publish rules: needs images and a published development', async () => {
    const id = seeded.props.draft.id
    await saveImages('property', id, [], null, actorId)
    await expect(saveProperty(id, form({ version: '1', slug: 'draft-listing', bedrooms: '2' }), actorId)).rejects.toThrow(/image/)
    await expect(
      saveProperty(seeded.props.inHiddenDev.id, form({ version: '1', slug: 'in-hidden-dev', developmentId: seeded.devs.hidden.id, bedrooms: '2' }), actorId),
    ).rejects.toThrow(/development/)
  })

  it('rejects duplicate slugs with a field error', async () => {
    const err = await saveProperty(seeded.props.af2.id, form({ version: '1', slug: 'cp-3br', developmentId: seeded.devs.ayat.id, bedrooms: '2' }), actorId).catch((e) => e)
    expect(err).toBeInstanceOf(ContentError)
    expect((err as ContentError).fields.slug).toBeTruthy()
  })

  it('blocks removing every photo from a published listing, and reorders atomically', async () => {
    const id = seeded.props.cp3.id
    await expect(saveImages('property', id, [], null, actorId)).rejects.toThrow(/at least one photo/)
    const a = await makeMedia()
    const b = await makeMedia()
    await saveImages('property', id, [{ mediaId: b, kind: 'photo', caption: null, alt: 'B' }, { mediaId: a, kind: 'plan', caption: 'Plan', alt: 'A' }], a, actorId)
    const [row] = await db().select().from(properties).where(eq(properties.id, id))
    expect(row!.coverMediaId).toBe(b) // plans can't be covers
  })

  it('database constraints reject invalid prices even if application checks are bypassed', async () => {
    await expect(db().update(properties).set({ priceMode: 'fixed', priceAmount: null }).where(eq(properties.id, seeded.props.cp1.id))).rejects.toThrow()
    await expect(db().update(properties).set({ priceMode: 'on_request', priceAmount: '5', priceCurrency: 'ETB' }).where(eq(properties.id, seeded.props.cp1.id))).rejects.toThrow()
  })
})

describe('authentication', () => {
  it('accepts valid credentials case-insensitively on email', async () => {
    expect(await attemptLogin('editor@example.test', 'a-very-good-passphrase', '10.0.0.1')).toMatchObject({ ok: true })
  })
  it('uses a generic error for unknown users and wrong passwords', async () => {
    const a = await attemptLogin('nobody@example.test', 'whatever-password', '10.0.0.2')
    const b = await attemptLogin('editor@example.test', 'wrong-password-123', '10.0.0.3')
    expect(a).toEqual(b)
  })
  it('locks the account after repeated failures, even with the right password', async () => {
    await db().execute(sql`TRUNCATE rate_limits`)
    await db().update(adminUsers).set({ failedLoginCount: 0, lockedUntil: null }).where(eq(adminUsers.id, actorId))
    for (let k = 0; k < 5; k++) await attemptLogin('editor@example.test', `wrong-${k}-password`, `10.1.0.${k}`)
    const r = await attemptLogin('editor@example.test', 'a-very-good-passphrase', '10.1.1.1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/locked/i)
    await db().update(adminUsers).set({ failedLoginCount: 0, lockedUntil: null }).where(eq(adminUsers.id, actorId))
  })
})

describe('rate limiting', () => {
  it('allows up to the limit then blocks, atomically under concurrency', async () => {
    await db().execute(sql`TRUNCATE rate_limits`)
    const results = await Promise.all(Array.from({ length: 12 }, () => hit(RULES.inquiryPerIp, 'concurrent-key')))
    expect(results.filter((r) => r.allowed)).toHaveLength(RULES.inquiryPerIp.limit)
    expect(results.find((r) => !r.allowed)!.retryAfterSeconds).toBeGreaterThan(0)
  })
})

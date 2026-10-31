import { describe, expect, it } from 'vitest'
import { hashPassword, passwordProblem, verifyPassword } from '@/lib/auth/password'
import { nextAttemptDelaySeconds } from '@/lib/inquiries/delivery'
import { jsonLd } from '@/lib/seo/site'
import { canTransition, propertyFormSchema } from '@/lib/validation/content'
import { webhookSignature } from '@/lib/inquiries/channels'

describe('password hashing', () => {
  it('verifies correct and rejects wrong passwords; hashes are salted', async () => {
    const h1 = await hashPassword('correct horse battery')
    const h2 = await hashPassword('correct horse battery')
    expect(h1).not.toBe(h2)
    expect(await verifyPassword('correct horse battery', h1)).toBe(true)
    expect(await verifyPassword('wrong horse battery', h1)).toBe(false)
    expect(await verifyPassword('x', 'garbage')).toBe(false)
  })
  it('enforces the password policy', () => {
    expect(passwordProblem('short')).toMatch(/12/)
    expect(passwordProblem('selam-is-great-2026', 'selam@x.com')).toMatch(/email/)
    expect(passwordProblem('a-long-unique-passphrase')).toBeNull()
  })
})

describe('delivery backoff', () => {
  it('grows exponentially with bounded jitter and a 6h cap', () => {
    expect(nextAttemptDelaySeconds(1, () => 0.5)).toBe(60)
    expect(nextAttemptDelaySeconds(3, () => 0.5)).toBe(240)
    expect(nextAttemptDelaySeconds(20, () => 1)).toBe(Math.round(6 * 3600 * 1.2))
    expect(nextAttemptDelaySeconds(2, () => 0)).toBe(96)
  })
})

describe('jsonLd', () => {
  it('cannot break out of a script tag', () => {
    expect(jsonLd({ name: '</script><script>alert(1)</script>' })).not.toContain('</script>')
  })
})

describe('webhook signature', () => {
  it('is a deterministic HMAC over timestamp and body', () => {
    expect(webhookSignature('s', '1', '{}')).toBe(webhookSignature('s', '1', '{}'))
    expect(webhookSignature('s', '1', '{}')).not.toBe(webhookSignature('s', '2', '{}'))
  })
})

describe('content rules', () => {
  const valid = {
    version: '1', title: 'Three-bedroom apartment', slug: 'three-bed', developmentId: '7c0b5a52-8f39-4b0b-9a7c-2f5d1e3c4b6a',
    propertyType: 'apartment', status: 'published', availability: 'available', bedrooms: '3', sizeSqm: '145',
    priceMode: 'on_request', priceAmount: '', priceCurrency: '', summary: 'A spacious three bedroom apartment in Sarbet.', description: '',
  }
  it('accepts a valid published listing', () => {
    expect(propertyFormSchema.safeParse(valid).success).toBe(true)
  })
  it('requires amount and currency together for priced listings', () => {
    expect(propertyFormSchema.safeParse({ ...valid, priceMode: 'fixed', priceAmount: '1000000' }).success).toBe(false)
    expect(propertyFormSchema.safeParse({ ...valid, priceMode: 'fixed', priceAmount: '1000000', priceCurrency: 'ETB' }).success).toBe(true)
    expect(propertyFormSchema.safeParse({ ...valid, priceAmount: '5', priceCurrency: 'ETB' }).success).toBe(false)
  })
  it('requires key facts before publishing', () => {
    expect(propertyFormSchema.safeParse({ ...valid, bedrooms: '' }).success).toBe(false)
    expect(propertyFormSchema.safeParse({ ...valid, sizeSqm: '' }).success).toBe(false)
    expect(propertyFormSchema.safeParse({ ...valid, status: 'draft', sizeSqm: '' }).success).toBe(true)
  })
  it('rejects bad slugs', () => {
    expect(propertyFormSchema.safeParse({ ...valid, slug: 'Bad Slug!' }).success).toBe(false)
  })
  it('enforces status transitions', () => {
    expect(canTransition('archived', 'published')).toBe(false)
    expect(canTransition('archived', 'draft')).toBe(true)
    expect(canTransition('draft', 'published')).toBe(true)
  })
})

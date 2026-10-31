import { describe, expect, it } from 'vitest'
import { addisToday, inquiryInputSchema, normalizePhone, validateViewingDate } from '@/lib/validation/inquiry'

const base = {
  idempotencyKey: '7c0b5a52-8f39-4b0b-9a7c-2f5d1e3c4b6a',
  type: 'general' as const,
  name: 'Selam Bekele',
  phone: '0911 22 33 44',
  preferredContact: 'phone' as const,
  message: 'Looking for a 3-bedroom in Sarbet',
  consent: true,
}

describe('inquiry schema', () => {
  it('accepts a valid general inquiry and normalises the phone', () => {
    const r = inquiryInputSchema.parse(base)
    expect(r.phone).toBe('+251911223344')
    expect(r.email).toBeUndefined()
  })
  it('requires consent', () => {
    expect(inquiryInputSchema.safeParse({ ...base, consent: false }).success).toBe(false)
  })
  it('requires a phone or email and the one matching the preferred method', () => {
    expect(inquiryInputSchema.safeParse({ ...base, phone: '' }).success).toBe(false)
    expect(inquiryInputSchema.safeParse({ ...base, preferredContact: 'email' }).success).toBe(false)
    expect(inquiryInputSchema.safeParse({ ...base, phone: '', email: 'a@b.co', preferredContact: 'email' }).success).toBe(true)
  })
  it('strips CR/LF from single-line fields (email header injection)', () => {
    const r = inquiryInputSchema.parse({ ...base, name: 'Eve\r\nBcc: x@y.z' })
    expect(r.name).not.toMatch(/[\r\n]/)
  })
  it('rejects invalid emails and phones', () => {
    expect(inquiryInputSchema.safeParse({ ...base, email: 'not-an-email' }).success).toBe(false)
    expect(inquiryInputSchema.safeParse({ ...base, phone: '12ab' }).success).toBe(false)
  })
  it('requires a subject and date for viewings, and a date only for viewings', () => {
    expect(inquiryInputSchema.safeParse({ ...base, type: 'viewing' }).success).toBe(false)
    expect(inquiryInputSchema.safeParse({ ...base, preferredDate: '2030-01-07' }).success).toBe(false)
  })
  it('bounds message length', () => {
    expect(inquiryInputSchema.safeParse({ ...base, message: 'x'.repeat(2001) }).success).toBe(false)
  })
})

describe('validateViewingDate', () => {
  const now = new Date('2026-10-12T09:00:00Z') // Monday in Addis Ababa
  it('uses Addis Ababa local date', () => {
    expect(addisToday(new Date('2026-10-12T22:30:00Z'))).toBe('2026-10-13') // 01:30 next day in UTC+3
  })
  it('rejects today, the past, Sundays, invalid and far-future dates', () => {
    expect(validateViewingDate('2026-10-12', now)).toMatch(/tomorrow/)
    expect(validateViewingDate('2026-10-01', now)).toMatch(/tomorrow/)
    expect(validateViewingDate('2026-10-18', now)).toMatch(/Sunday/)
    expect(validateViewingDate('2026-02-30', now)).toMatch(/valid/)
    expect(validateViewingDate('2027-06-01', now)).toMatch(/6 months/)
  })
  it('accepts a weekday within the horizon', () => {
    expect(validateViewingDate('2026-10-13', now)).toBeNull()
  })
})

describe('normalizePhone', () => {
  it('handles local mobile formats', () => {
    expect(normalizePhone('0711 234 567')).toBe('+251711234567')
    expect(normalizePhone('911234567')).toBe('+251911234567')
    expect(normalizePhone('+44 20 7946 0958')).toBe('+442079460958')
  })
})

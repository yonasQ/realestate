import { describe, expect, it } from 'vitest'
import { formatPrice, formatSize, telHref, toE164Digits, whatsappHref } from '@/lib/format'

describe('formatPrice', () => {
  it('never shows a number when price is on request', () => {
    expect(formatPrice({ priceMode: 'on_request', priceAmount: null, priceCurrency: null })).toBe('Price on request')
  })
  it('always shows the stored currency and never converts', () => {
    expect(formatPrice({ priceMode: 'fixed', priceAmount: '12500000.00', priceCurrency: 'ETB' })).toBe('ETB 12,500,000')
    expect(formatPrice({ priceMode: 'fixed', priceAmount: '125000', priceCurrency: 'USD' })).toBe('USD 125,000')
  })
  it('formats starting and per-m² prices', () => {
    expect(formatPrice({ priceMode: 'from', priceAmount: 9000000, priceCurrency: 'ETB' })).toBe('From ETB 9,000,000')
    expect(formatPrice({ priceMode: 'per_sqm_from', priceAmount: 120000, priceCurrency: 'ETB' })).toBe('From ETB 120,000 per m²')
  })
  it('falls back safely on inconsistent data instead of showing a wrong price', () => {
    expect(formatPrice({ priceMode: 'fixed', priceAmount: null, priceCurrency: 'ETB' })).toBe('Price on request')
    expect(formatPrice({ priceMode: 'fixed', priceAmount: '100', priceCurrency: null })).toBe('Price on request')
    expect(formatPrice({ priceMode: 'fixed', priceAmount: '-5', priceCurrency: 'ETB' })).toBe('Price on request')
  })
})

describe('formatSize', () => {
  it('handles exact, ranges and open ranges', () => {
    expect(formatSize({ sizeSqm: '76.00' })).toBe('76 m²')
    expect(formatSize({ sizeSqm: '100', sizeMinSqm: '99', sizeMaxSqm: '100' })).toBe('99–100 m²')
    expect(formatSize({ sizeMinSqm: '10' })).toBe('From 10 m²')
    expect(formatSize({})).toBeNull()
  })
})

describe('phone links', () => {
  it('normalises Ethiopian numbers to E.164', () => {
    expect(toE164Digits('0975 66 66 99')).toBe('251975666699')
    expect(toE164Digits('+251 975 666 699')).toBe('251975666699')
    expect(toE164Digits('00251975666699')).toBe('251975666699')
    expect(toE164Digits('12')).toBeNull()
  })
  it('supports short-code hotlines and WhatsApp deep links', () => {
    expect(telHref('6033')).toBe('tel:6033')
    expect(whatsappHref('0975666699', 'Hi & hello')).toBe('https://wa.me/251975666699?text=Hi%20%26%20hello')
    expect(whatsappHref(null)).toBeNull()
  })
})

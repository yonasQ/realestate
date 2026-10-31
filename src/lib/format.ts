import type { Currency, PriceMode } from '@/lib/domain'

const NUMBER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const AREA = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

export type PriceInput = { priceMode: PriceMode; priceAmount: string | number | null; priceCurrency: Currency | null }

/**
 * Formats a price exactly as stored. Currency is always explicit and never
 * converted; missing or invalid data falls back to "Price on request".
 */
export function formatPrice(p: PriceInput): string {
  const amount = p.priceAmount == null ? NaN : Number(p.priceAmount)
  if (p.priceMode === 'on_request' || !p.priceCurrency || !Number.isFinite(amount) || amount <= 0) {
    return 'Price on request'
  }
  const value = `${p.priceCurrency} ${NUMBER.format(amount)}`
  switch (p.priceMode) {
    case 'fixed':
      return value
    case 'from':
      return `From ${value}`
    case 'per_sqm_from':
      return `From ${value} per m²`
  }
}

export function hasPrice(p: PriceInput): boolean {
  return formatPrice(p) !== 'Price on request'
}

export function formatArea(value: string | number | null | undefined): string | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? `${AREA.format(n)} m²` : null
}

/** "76 m²", "99–100 m²", "From 10 m²", or null. */
export function formatSize(p: {
  sizeSqm?: string | number | null
  sizeMinSqm?: string | number | null
  sizeMaxSqm?: string | number | null
}): string | null {
  const min = p.sizeMinSqm == null ? null : Number(p.sizeMinSqm)
  const max = p.sizeMaxSqm == null ? null : Number(p.sizeMaxSqm)
  if (min && max && min !== max) return `${AREA.format(min)}–${AREA.format(max)} m²`
  if (min && !max && !p.sizeSqm) return `From ${AREA.format(min)} m²`
  return formatArea(p.sizeSqm ?? min ?? max)
}

export function formatRange(min: string | number | null, max: string | number | null): string | null {
  return formatSize({ sizeMinSqm: min, sizeMaxSqm: max, sizeSqm: min != null && min === max ? min : null })
}

export function bedroomsLabel(n: number | null | undefined): string | null {
  if (n == null) return null
  if (n === 0) return 'Studio'
  return `${n} bedroom${n === 1 ? '' : 's'}`
}

export function bathroomsLabel(n: number | null | undefined): string | null {
  if (n == null) return null
  return `${n} bathroom${n === 1 ? '' : 's'}`
}

/** Converts a local Ethiopian number to E.164 digits for tel:/wa.me links. Returns null if implausible. */
export function toE164Digits(phone: string | null | undefined): string | null {
  if (!phone) return null
  let digits = phone.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) digits = digits.slice(1)
  else if (digits.startsWith('00')) digits = digits.slice(2)
  else if (digits.startsWith('0') && digits.length === 10) digits = `251${digits.slice(1)}`
  return /^\d{8,15}$/.test(digits) ? digits : null
}

export function telHref(phone: string | null | undefined): string | null {
  if (!phone) return null
  if (/^\d{3,5}$/.test(phone.trim())) return `tel:${phone.trim()}` // short-code hotline e.g. 6033
  const d = toE164Digits(phone)
  return d ? `tel:+${d}` : null
}

export function whatsappHref(phone: string | null | undefined, text?: string): string | null {
  const d = toE164Digits(phone)
  if (!d) return null
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

export function formatDate(d: Date | string, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Addis_Ababa', ...opts }).format(new Date(d))
}

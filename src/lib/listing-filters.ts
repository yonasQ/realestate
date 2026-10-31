import { BEDROOM_FILTERS, CURRENCIES, PROPERTY_TYPES, SORTS, type Currency, type PropertyType, type Sort } from '@/lib/domain'

/**
 * Normalised listing filters. Parsing is total: any malformed or hostile query
 * value is dropped rather than erroring, so shared URLs never break the page.
 */
export type ListingFilters = {
  q?: string
  type?: PropertyType
  area?: string
  beds?: (typeof BEDROOM_FILTERS)[number]
  development?: string
  minSize?: number
  maxSize?: number
  currency?: Currency
  minPrice?: number
  maxPrice?: number
  sort: Sort
  page: number
}

type Params = Record<string, string | string[] | undefined> | URLSearchParams

function first(params: Params, key: string): string | undefined {
  const v = params instanceof URLSearchParams ? params.get(key) ?? undefined : params[key]
  const s = Array.isArray(v) ? v[0] : v
  return typeof s === 'string' ? s.trim() : undefined
}

function positiveNumber(v: string | undefined, max: number): number | undefined {
  if (!v || !/^\d{1,12}(\.\d{1,2})?$/.test(v)) return undefined
  const n = Number(v)
  return n > 0 && n <= max ? n : undefined
}

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

export function parseListingFilters(params: Params): ListingFilters {
  const f: ListingFilters = { sort: 'featured', page: 1 }

  const q = first(params, 'q')
  if (q) {
    // Strip control characters; bound length to keep queries cheap.
    const clean = q.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
    if (clean.length >= 2) f.q = clean
  }
  const type = first(params, 'type')
  if (type && (PROPERTY_TYPES as readonly string[]).includes(type)) f.type = type as PropertyType

  const area = first(params, 'area')
  if (area && area.length <= 40 && /^[\p{L}\p{N} .'-]+$/u.test(area)) f.area = area

  const beds = first(params, 'beds')
  if (beds && (BEDROOM_FILTERS as readonly string[]).includes(beds)) f.beds = beds as ListingFilters['beds']

  const dev = first(params, 'development')
  if (dev && dev.length <= 80 && SLUG_RE.test(dev)) f.development = dev

  f.minSize = positiveNumber(first(params, 'minSize'), 100_000)
  f.maxSize = positiveNumber(first(params, 'maxSize'), 100_000)
  if (f.minSize && f.maxSize && f.minSize > f.maxSize) [f.minSize, f.maxSize] = [f.maxSize, f.minSize]

  const currency = first(params, 'currency')
  if (currency && (CURRENCIES as readonly string[]).includes(currency)) {
    f.currency = currency as Currency
    f.minPrice = positiveNumber(first(params, 'minPrice'), 1e13)
    f.maxPrice = positiveNumber(first(params, 'maxPrice'), 1e13)
    if (f.minPrice && f.maxPrice && f.minPrice > f.maxPrice) [f.minPrice, f.maxPrice] = [f.maxPrice, f.minPrice]
  }

  const sort = first(params, 'sort')
  if (sort && (SORTS as readonly string[]).includes(sort)) f.sort = sort as Sort

  const page = first(params, 'page')
  if (page && /^\d{1,4}$/.test(page)) f.page = Math.max(1, Number(page))

  // Drop empty optional keys so serialisation is canonical.
  for (const k of Object.keys(f) as (keyof ListingFilters)[]) if (f[k] === undefined) delete f[k]
  return f
}

/** Canonical query string (stable key order, defaults omitted). */
export function serializeListingFilters(f: Partial<ListingFilters>): string {
  const p = new URLSearchParams()
  if (f.q) p.set('q', f.q)
  if (f.type) p.set('type', f.type)
  if (f.area) p.set('area', f.area)
  if (f.beds) p.set('beds', f.beds)
  if (f.development) p.set('development', f.development)
  if (f.minSize) p.set('minSize', String(f.minSize))
  if (f.maxSize) p.set('maxSize', String(f.maxSize))
  if (f.currency && (f.minPrice || f.maxPrice)) {
    p.set('currency', f.currency)
    if (f.minPrice) p.set('minPrice', String(f.minPrice))
    if (f.maxPrice) p.set('maxPrice', String(f.maxPrice))
  }
  if (f.sort && f.sort !== 'featured') p.set('sort', f.sort)
  if (f.page && f.page > 1) p.set('page', String(f.page))
  return p.toString()
}

export function activeFilterCount(f: ListingFilters): number {
  return [f.q, f.type, f.area, f.beds, f.development, f.minSize, f.maxSize, f.minPrice, f.maxPrice].filter(
    (v) => v !== undefined,
  ).length
}

/** Escapes LIKE wildcards so user input is matched literally. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`)
}

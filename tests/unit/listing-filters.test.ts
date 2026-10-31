import { describe, expect, it } from 'vitest'
import { escapeLike, parseListingFilters, serializeListingFilters } from '@/lib/listing-filters'

describe('parseListingFilters', () => {
  it('parses valid filters', () => {
    const f = parseListingFilters({ type: 'apartment', area: 'Sarbet', beds: '3', minSize: '100', maxSize: '150', sort: 'size_desc', page: '2' })
    expect(f).toEqual({ type: 'apartment', area: 'Sarbet', beds: '3', minSize: 100, maxSize: 150, sort: 'size_desc', page: 2 })
  })
  it('drops hostile or malformed values instead of failing', () => {
    const f = parseListingFilters({ type: 'castle', area: "'; DROP TABLE x;--", beds: '99', minSize: '-1', sort: 'evil', page: 'abc', development: '../etc' })
    expect(f).toEqual({ sort: 'featured', page: 1 })
  })
  it('swaps inverted ranges', () => {
    expect(parseListingFilters({ minSize: '200', maxSize: '50' })).toMatchObject({ minSize: 50, maxSize: 200 })
  })
  it('ignores price bounds without an explicit currency (no silent conversion)', () => {
    expect(parseListingFilters({ minPrice: '1000' }).minPrice).toBeUndefined()
    expect(parseListingFilters({ currency: 'ETB', minPrice: '1000' })).toMatchObject({ currency: 'ETB', minPrice: 1000 })
  })
  it('bounds and cleans free-text search', () => {
    expect(parseListingFilters({ q: 'a' }).q).toBeUndefined()
    expect(parseListingFilters({ q: '  city\u0000 plus ' }).q).toBe('city plus')
    expect(parseListingFilters({ q: 'x'.repeat(500) }).q).toHaveLength(80)
  })
  it('accepts URLSearchParams and array values', () => {
    expect(parseListingFilters(new URLSearchParams('beds=4%2B')).beds).toBe('4+')
    expect(parseListingFilters({ type: ['shop', 'apartment'] }).type).toBe('shop')
  })
})

describe('serializeListingFilters', () => {
  it('round-trips and omits defaults (canonical, shareable URLs)', () => {
    const qs = 'type=apartment&area=Ayat&beds=2&sort=newest&page=3'
    expect(serializeListingFilters(parseListingFilters(new URLSearchParams(qs)))).toBe(qs)
    expect(serializeListingFilters({ sort: 'featured', page: 1 })).toBe('')
  })
})

describe('escapeLike', () => {
  it('escapes LIKE wildcards', () => {
    expect(escapeLike('100%_\\')).toBe('100\\%\\_\\\\')
  })
})

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeDb } from '@/lib/db/client'
import { parseListingFilters } from '@/lib/listing-filters'
import { searchListingsUncached as search } from '@/lib/queries/catalog'
import { resetDb, seedCatalog } from '../support/db'

const run = (q: Record<string, string>) => search(parseListingFilters(q))
const slugs = async (q: Record<string, string>) => (await run(q)).items.map((i) => i.slug).sort()

beforeAll(async () => {
  await resetDb()
  await seedCatalog()
})
afterAll(() => closeDb())

describe('public listing search', () => {
  it('never exposes drafts or listings in unpublished developments', async () => {
    const all = await slugs({})
    expect(all).not.toContain('draft-listing')
    expect(all).not.toContain('in-hidden-dev')
    expect(all).toHaveLength(6)
  })
  it('filters by type, area, bedrooms and development', async () => {
    expect(await slugs({ type: 'shop' })).toEqual(['adwa-shops'])
    expect(await slugs({ area: 'ayat' })).toEqual(['af-2br', 'af-4br'])
    expect(await slugs({ beds: '4+' })).toEqual(['af-4br'])
    expect(await slugs({ beds: '2' })).toEqual(['af-2br', 'sold-unit'])
    expect(await slugs({ development: 'city-plus' })).toEqual(['cp-1br', 'cp-3br', 'sold-unit'])
  })
  it('matches size ranges by overlap', async () => {
    expect(await slugs({ minSize: '140', maxSize: '160' })).toEqual(['cp-3br'])
    expect(await slugs({ maxSize: '20' })).toEqual(['adwa-shops'])
  })
  it('price filters only match listings priced in the chosen currency', async () => {
    expect(await slugs({ currency: 'ETB', minPrice: '1000' })).toEqual(['cp-3br'])
    expect(await slugs({ currency: 'USD', maxPrice: '100000' })).toEqual(['af-2br'])
    expect(await slugs({ currency: 'ETB', maxPrice: '100000' })).toEqual([])
  })
  it('searches text literally (wildcards escaped, no injection)', async () => {
    expect(await slugs({ q: 'city plus' })).toEqual(['cp-1br', 'cp-3br', 'sold-unit'])
    expect(await slugs({ q: '%%' })).toEqual([])
    expect(await slugs({ q: "'; DROP TABLE properties; --" })).toEqual([])
    expect((await run({})).total).toBe(6)
  })
  it('sorts by size and puts featured first by default', async () => {
    expect((await run({ sort: 'size_desc' })).items[0]!.slug).toBe('af-4br')
    expect((await run({})).items[0]!.slug).toBe('cp-1br')
  })
  it('clamps out-of-range pages', async () => {
    const r = await run({ page: '99' })
    expect(r.page).toBe(1)
    expect(r.items.length).toBe(6)
  })
})

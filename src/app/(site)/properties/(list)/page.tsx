import type { Metadata } from 'next'
import Link from 'next/link'
import { ListingControls, ResultsRegion } from '@/components/property/ListingControls'
import { PropertyCard } from '@/components/property/PropertyCard'
import { Icon } from '@/components/ui/Icon'
import { PROPERTY_TYPE_PLURAL } from '@/lib/domain'
import { parseListingFilters, serializeListingFilters, type ListingFilters } from '@/lib/listing-filters'
import { getListingFacets, searchListings } from '@/lib/queries/catalog'
import { getSettings } from '@/lib/queries/settings'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function headline(f: ListingFilters): string {
  const what = f.type ? PROPERTY_TYPE_PLURAL[f.type] : 'Properties'
  const beds = f.beds ? `${f.beds}-bedroom ` : ''
  const where = f.area ? ` in ${f.area}` : ' in Addis Ababa'
  return `${beds}${beds ? what.toLowerCase() : what} for sale${where}`.replace(/^./, (c) => c.toUpperCase())
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const f = parseListingFilters(await searchParams)
  const s = await getSettings()
  const title = `${headline(f)} | ${s.brandName}`
  // Index only the canonical category views (type/area/beds); other combinations are noindex.
  const indexable = !f.q && !f.development && !f.minSize && !f.maxSize && !f.minPrice && !f.maxPrice && f.sort === 'featured' && f.page === 1
  const canonicalQs = serializeListingFilters({ type: f.type, area: f.area, beds: f.beds })
  return {
    title,
    description: `${headline(f)}: apartments and commercial shops in ${s.developerName} developments. Filter by area, bedrooms and size, then request details or a viewing.`,
    alternates: { canonical: `/properties${canonicalQs ? `?${canonicalQs}` : ''}` },
    robots: indexable ? undefined : { index: false, follow: true },
  }
}

export default async function PropertiesPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = parseListingFilters(await searchParams)
  const [facets, result] = await Promise.all([getListingFacets(), searchListings(filters)])

  const chips: { label: string; without: Partial<ListingFilters> }[] = []
  if (filters.q) chips.push({ label: `“${filters.q}”`, without: { q: undefined } })
  if (filters.type) chips.push({ label: PROPERTY_TYPE_PLURAL[filters.type], without: { type: undefined } })
  if (filters.area) chips.push({ label: filters.area, without: { area: undefined } })
  if (filters.beds) chips.push({ label: `${filters.beds} bedrooms`, without: { beds: undefined } })
  if (filters.development) {
    const d = facets.developments.find((x) => x.slug === filters.development)
    chips.push({ label: d?.name ?? filters.development, without: { development: undefined } })
  }
  if (filters.minSize || filters.maxSize) chips.push({ label: `${filters.minSize ?? 0}–${filters.maxSize ?? '∞'} m²`, without: { minSize: undefined, maxSize: undefined } })
  if (filters.minPrice || filters.maxPrice) chips.push({ label: `${filters.currency} ${filters.minPrice ?? 0}–${filters.maxPrice ?? '∞'}`, without: { minPrice: undefined, maxPrice: undefined } })
  const hrefWithout = (w: Partial<ListingFilters>) => {
    const qs = serializeListingFilters({ ...filters, page: 1, ...w })
    return qs ? `/properties?${qs}` : '/properties'
  }

  return (
    <>
      <section className="bg-ivory pb-8 pt-32 md:pt-36">
        <div className="container-page">
          <nav aria-label="Breadcrumb" className="text-xs font-semibold uppercase tracking-[0.14em] text-stone">
            <Link href="/" className="link-underline">Home</Link> <span aria-hidden>/</span> Properties
          </nav>
          <h1 className="mt-4 text-4xl md:text-6xl">{headline(filters)}</h1>
          <p className="mt-4 max-w-2xl text-lg text-stone">
            Every listing below is published by Temer Properties. Prices are confirmed on request, and I will check current availability before your viewing.
          </p>
        </div>
      </section>

      <ListingControls filters={filters} facets={facets}>
        <ResultsRegion>
          <section className="container-page py-10 md:py-14" aria-labelledby="results-heading">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <h2 id="results-heading" className="font-sans text-sm font-semibold uppercase tracking-[0.14em] text-stone" aria-live="polite">
                {result.total} {result.total === 1 ? 'property' : 'properties'}
                {result.pageCount > 1 ? ` · page ${result.page} of ${result.pageCount}` : ''}
              </h2>
              {chips.length ? (
                <ul className="flex flex-wrap items-center gap-2" aria-label="Active filters">
                  {chips.map((c) => (
                    <li key={c.label}>
                      <Link href={hrefWithout(c.without)} scroll={false} className="chip hover:border-charcoal" aria-label={`Remove filter ${c.label}`}>
                        {c.label} <Icon name="close" size={12} />
                      </Link>
                    </li>
                  ))}
                  <li><Link href="/properties" scroll={false} className="ml-2 text-sm font-semibold underline underline-offset-4">Clear all</Link></li>
                </ul>
              ) : null}
            </div>

            {result.items.length ? (
              <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {result.items.map((p, i) => <PropertyCard key={p.id} property={p} priority={i === 0} />)}
              </div>
            ) : (
              <div className="mt-10 border border-dashed border-line bg-paper px-6 py-16 text-center">
                <Icon name="search" size={32} className="mx-auto text-bronze" />
                <h3 className="mt-4 text-2xl">No properties match these filters</h3>
                <p className="mx-auto mt-3 max-w-md text-stone">
                  Try removing a filter or widening the size range. If you are looking for something specific, tell me and I will ask the developer about upcoming units.
                </p>
                <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                  <Link href="/properties" className="btn btn-outline">Clear all filters</Link>
                  <Link href="/contact" className="btn btn-primary">Ask about upcoming units</Link>
                </div>
              </div>
            )}

            {result.pageCount > 1 ? <Pagination filters={filters} page={result.page} pageCount={result.pageCount} /> : null}
          </section>
        </ResultsRegion>
      </ListingControls>
    </>
  )
}

function Pagination({ filters, page, pageCount }: { filters: ListingFilters; page: number; pageCount: number }) {
  const href = (p: number) => {
    const qs = serializeListingFilters({ ...filters, page: p })
    return qs ? `/properties?${qs}` : '/properties'
  }
  return (
    <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-2">
      {page > 1 ? <Link href={href(page - 1)} className="btn btn-outline min-h-11 px-4" rel="prev"><Icon name="arrowLeft" size={16} /><span className="sr-only">Previous page</span></Link> : null}
      {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
        <Link key={p} href={href(p)} aria-current={p === page ? 'page' : undefined} className={`flex h-11 w-11 items-center justify-center text-sm font-semibold ${p === page ? 'bg-charcoal text-white' : 'border border-line bg-paper hover:border-charcoal'}`}>
          {p}
        </Link>
      ))}
      {page < pageCount ? <Link href={href(page + 1)} className="btn btn-outline min-h-11 px-4" rel="next"><Icon name="arrowRight" size={16} /><span className="sr-only">Next page</span></Link> : null}
    </nav>
  )
}

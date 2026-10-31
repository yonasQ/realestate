'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createContext, useContext, useRef, useState, useTransition } from 'react'
import { Icon } from '@/components/ui/Icon'
import { PROPERTY_TYPE_PLURAL, SORT_LABELS, SORTS, type Sort } from '@/lib/domain'
import { activeFilterCount, serializeListingFilters, type ListingFilters } from '@/lib/listing-filters'
import type { ListingFacets } from '@/lib/queries/catalog'

const PendingContext = createContext(false)

export function ResultsRegion({ children }: { children: React.ReactNode }) {
  const pending = useContext(PendingContext)
  return (
    <div aria-busy={pending} className={`transition-opacity duration-200 ${pending ? 'pointer-events-none opacity-50' : ''}`}>
      {children}
    </div>
  )
}

type Props = { filters: ListingFilters; facets: ListingFacets; children: React.ReactNode }

export function ListingControls({ filters, facets, children }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState(filters.q ?? '')
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined)
  const priceCurrencies = facets.priced.map((p) => p.currency)

  // Follow external URL changes (back/forward, chip removal) without an effect.
  const [lastQ, setLastQ] = useState(filters.q)
  if (lastQ !== filters.q) {
    setLastQ(filters.q)
    setQ(filters.q ?? '')
  }

  function navigate(next: Partial<ListingFilters>) {
    // Any filter change resets pagination.
    const merged: Partial<ListingFilters> = { ...filters, page: 1, ...next }
    const qs = serializeListingFilters(merged)
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }

  function onSelect(key: keyof ListingFilters) {
    return (e: React.ChangeEvent<HTMLSelectElement>) => navigate({ [key]: e.target.value || undefined } as Partial<ListingFilters>)
  }

  function onNumber(key: 'minSize' | 'maxSize' | 'minPrice' | 'maxPrice') {
    return (e: React.FocusEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>) => {
      if ('key' in e && e.key !== 'Enter') return
      const raw = (e.currentTarget.value || '').replace(/[^\d.]/g, '')
      const n = raw ? Number(raw) : undefined
      if ((filters[key] ?? undefined) === n) return
      navigate({ [key]: n && n > 0 ? n : undefined, ...(key.includes('Price') ? { currency: filters.currency ?? priceCurrencies[0] } : {}) })
    }
  }

  const count = activeFilterCount(filters)

  const fields = (
    <>
      <div className="sm:col-span-2 lg:col-span-1">
        <label htmlFor="f-type" className="field-label">Property type</label>
        <select id="f-type" name="type" className="field" value={filters.type ?? ''} onChange={onSelect('type')}>
          <option value="">All types</option>
          {facets.types.map((t) => <option key={t.value} value={t.value}>{PROPERTY_TYPE_PLURAL[t.value]} ({t.count})</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="f-area" className="field-label">Neighbourhood</label>
        <select id="f-area" name="area" className="field" value={filters.area ?? ''} onChange={onSelect('area')}>
          <option value="">All areas</option>
          {facets.areas.map((a) => <option key={a.value} value={a.value}>{a.value} ({a.count})</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="f-beds" className="field-label">Bedrooms</label>
        <select id="f-beds" name="beds" className="field" value={filters.beds ?? ''} onChange={onSelect('beds')}>
          <option value="">Any</option>
          {facets.bedrooms.map((b) => {
            const v = b.value >= 4 ? '4+' : String(b.value)
            return <option key={v} value={v}>{v} bedroom{b.value === 1 ? '' : 's'}</option>
          })}
        </select>
      </div>
      <div>
        <label htmlFor="f-dev" className="field-label">Development</label>
        <select id="f-dev" name="development" className="field" value={filters.development ?? ''} onChange={onSelect('development')}>
          <option value="">All developments</option>
          {facets.developments.map((d) => <option key={d.slug} value={d.slug}>{d.name} ({d.count})</option>)}
        </select>
      </div>
      <fieldset className="sm:col-span-2 lg:col-span-1">
        <legend className="field-label">Size (m²)</legend>
        <div className="grid grid-cols-2 gap-2">
          <label className="sr-only" htmlFor="f-minSize">Minimum size in square metres</label>
          <input id="f-minSize" name="minSize" inputMode="numeric" placeholder={facets.sizeMin ? `Min ${facets.sizeMin}` : 'Min'} defaultValue={filters.minSize ?? ''} key={`min-${filters.minSize}`} onBlur={onNumber('minSize')} onKeyDown={onNumber('minSize')} className="field" />
          <label className="sr-only" htmlFor="f-maxSize">Maximum size in square metres</label>
          <input id="f-maxSize" name="maxSize" inputMode="numeric" placeholder={facets.sizeMax ? `Max ${facets.sizeMax}` : 'Max'} defaultValue={filters.maxSize ?? ''} key={`max-${filters.maxSize}`} onBlur={onNumber('maxSize')} onKeyDown={onNumber('maxSize')} className="field" />
        </div>
      </fieldset>
      {priceCurrencies.length ? (
        <fieldset className="sm:col-span-2 lg:col-span-1">
          <legend className="field-label">Price</legend>
          <div className="grid grid-cols-[auto_1fr_1fr] gap-2">
            <label className="sr-only" htmlFor="f-currency">Currency</label>
            <select id="f-currency" name="currency" className="field !w-auto" value={filters.currency ?? priceCurrencies[0]} onChange={(e) => navigate({ currency: e.target.value as 'ETB' | 'USD' })}>
              {priceCurrencies.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input aria-label="Minimum price" name="minPrice" inputMode="numeric" placeholder="Min" defaultValue={filters.minPrice ?? ''} key={`minp-${filters.minPrice}`} onBlur={onNumber('minPrice')} onKeyDown={onNumber('minPrice')} className="field" />
            <input aria-label="Maximum price" name="maxPrice" inputMode="numeric" placeholder="Max" defaultValue={filters.maxPrice ?? ''} key={`maxp-${filters.maxPrice}`} onBlur={onNumber('maxPrice')} onKeyDown={onNumber('maxPrice')} className="field" />
          </div>
          <p className="mt-1 text-xs text-stone">Only listings with a published price match a price filter.</p>
        </fieldset>
      ) : null}
    </>
  )

  return (
    <PendingContext.Provider value={pending}>
      <form
        action="/properties"
        method="get"
        role="search"
        aria-label="Filter properties"
        onSubmit={(e) => {
          e.preventDefault()
          navigate({ q: q.trim() || undefined })
          setOpen(false)
        }}
        className="border-b border-line bg-paper"
      >
        <div className="container-page py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <label htmlFor="f-q" className="field-label">Search</label>
              <div className="relative">
                <Icon name="search" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone" />
                <input
                  id="f-q"
                  name="q"
                  type="search"
                  value={q}
                  maxLength={80}
                  onChange={(e) => {
                    const v = e.target.value
                    setQ(v)
                    clearTimeout(debounce.current)
                    debounce.current = setTimeout(() => {
                      const t = v.trim()
                      if (t.length === 0 || t.length >= 2) navigate({ q: t || undefined })
                    }, 450)
                  }}
                  placeholder="Development, area or keyword"
                  className="field pl-10"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1 md:w-56">
                <label htmlFor="f-sort" className="field-label">Sort by</label>
                <select id="f-sort" name="sort" className="field" value={filters.sort} onChange={(e) => navigate({ sort: e.target.value as Sort })}>
                  {SORTS.filter((s) => priceCurrencies.length || !s.startsWith('price')).map((s) => <option key={s} value={s}>{SORT_LABELS[s]}</option>)}
                </select>
              </div>
              <button type="button" className="btn btn-outline self-end lg:hidden" aria-expanded={open} aria-controls="filter-panel" onClick={() => setOpen((o) => !o)}>
                <Icon name="sliders" size={18} /> Filters{count ? ` (${count})` : ''}
              </button>
            </div>
          </div>
          <div id="filter-panel" className={`${open ? 'grid' : 'hidden'} mt-5 gap-4 sm:grid-cols-2 lg:grid lg:grid-cols-5`}>
            {fields}
            <div className="flex gap-3 sm:col-span-2 lg:hidden">
              <button type="submit" className="btn btn-primary flex-1">Show results</button>
            </div>
          </div>
          <noscript>
            <button type="submit" className="btn btn-primary mt-4">Apply filters</button>
          </noscript>
        </div>
      </form>
      {children}
    </PendingContext.Provider>
  )
}

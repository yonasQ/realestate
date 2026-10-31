import { Icon } from '@/components/ui/Icon'
import { PROPERTY_TYPE_PLURAL } from '@/lib/domain'
import type { ListingFacets } from '@/lib/queries/catalog'

/**
 * Plain GET form to /properties: works without JavaScript, and every option
 * shown comes from published inventory (no options that can never match).
 */
export function QuickSearch({ facets }: { facets: ListingFacets }) {
  return (
    <form action="/properties" method="get" role="search" aria-label="Find a property" className="grid gap-px bg-line shadow-[0_24px_60px_-30px_rgb(0_0_0/0.55)] sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_auto]">
      <label className="flex flex-col bg-paper px-5 py-3.5">
        <span className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-bronze">Property type</span>
        <select name="type" className="mt-1 cursor-pointer appearance-none bg-transparent py-1 text-base text-charcoal focus:outline-none" defaultValue="">
          <option value="">All types</option>
          {facets.types.map((t) => (
            <option key={t.value} value={t.value}>{PROPERTY_TYPE_PLURAL[t.value]} ({t.count})</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col bg-paper px-5 py-3.5">
        <span className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-bronze">Neighbourhood</span>
        <select name="area" className="mt-1 cursor-pointer appearance-none bg-transparent py-1 text-base text-charcoal focus:outline-none" defaultValue="">
          <option value="">All of Addis Ababa</option>
          {facets.areas.map((a) => (
            <option key={a.value} value={a.value}>{a.value} ({a.count})</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col bg-paper px-5 py-3.5">
        <span className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-bronze">Bedrooms</span>
        <select name="beds" className="mt-1 cursor-pointer appearance-none bg-transparent py-1 text-base text-charcoal focus:outline-none" defaultValue="">
          <option value="">Any</option>
          {facets.bedrooms.map((b) => (
            <option key={b.value} value={b.value >= 4 ? '4+' : String(b.value)}>
              {b.value >= 4 ? '4+' : b.value} bedroom{b.value === 1 ? '' : 's'}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="btn btn-primary min-h-16 rounded-none px-8 sm:col-span-2 lg:col-span-1">
        <Icon name="search" size={18} /> Search
      </button>
    </form>
  )
}

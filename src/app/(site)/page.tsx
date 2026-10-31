import type { Metadata } from 'next'
import Link from 'next/link'
import { PropertyCard } from '@/components/property/PropertyCard'
import { QuickSearch } from '@/components/property/QuickSearch'
import { InquirySection } from '@/components/inquiry/InquirySection'
import { Icon } from '@/components/ui/Icon'
import { ResponsiveImage } from '@/components/ui/ResponsiveImage'
import { BUILDING_TYPE_LABELS } from '@/lib/domain'
import { formatRange } from '@/lib/format'
import { getFeaturedListings, getListingFacets, getPublicDevelopments } from '@/lib/queries/catalog'
import { getSettings } from '@/lib/queries/settings'
import { absoluteUrl } from '@/lib/seo/site'


export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings()
  const title = `${s.brandName} | Apartments & shops by ${s.developerName} in Addis Ababa`
  const description =
    'Browse apartments and commercial shops for sale in Temer Properties developments across Sarbet, Aware, Ayat, Piassa and Gelan, Addis Ababa. Request details or book a site viewing.'
  return {
    title,
    description,
    alternates: { canonical: '/' },
    openGraph: { type: 'website', title, description, url: absoluteUrl('/'), siteName: s.brandName },
  }
}

export default async function HomePage() {
  const [settings, facets, featured, developments] = await Promise.all([
    getSettings(),
    getListingFacets(),
    getFeaturedListings(6),
    getPublicDevelopments(),
  ])
  const heroImage = settings.heroImage ?? developments.find((d) => d.cover)?.cover ?? null
  const showcase = developments.filter((d) => d.featured && d.cover).slice(0, 4)
  const apartmentCount = facets.types.find((t) => t.value === 'apartment')?.count ?? 0
  const shopCount = facets.types.find((t) => t.value === 'shop')?.count ?? 0

  return (
    <>
      {/* Hero */}
      <section className="relative isolate flex min-h-[100svh] flex-col justify-end overflow-hidden bg-charcoal text-white">
        {heroImage ? (
          <ResponsiveImage image={heroImage} fill priority sizes="100vw" alt="" className="-z-10 scale-[1.02]" />
        ) : null}
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(20_19_17/0.55)_0%,rgb(20_19_17/0.2)_35%,rgb(20_19_17/0.82)_100%)]" />
        <div className="container-page pb-10 pt-32 md:pb-16">
          <p className="eyebrow reveal !text-bronze-light">{settings.developerName} developments · Addis Ababa</p>
          <h1 className="reveal reveal-delay-1 mt-5 max-w-4xl text-[2.6rem] leading-[1.04] !text-white sm:text-6xl lg:text-[5.2rem]">
            {settings.heroHeadline}
          </h1>
          {settings.heroSubheadline ? (
            <p className="reveal reveal-delay-2 mt-6 max-w-2xl text-base leading-relaxed text-white/85 md:text-lg">{settings.heroSubheadline}</p>
          ) : null}
          <div className="reveal reveal-delay-2 mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/properties" className="btn btn-accent">Explore properties <Icon name="arrowRight" size={18} /></Link>
            <Link href="/contact?type=viewing" className="btn btn-ghost-light">Book a viewing</Link>
          </div>
          <div className="reveal reveal-delay-3 mt-12 md:mt-16">
            <QuickSearch facets={facets} />
          </div>
        </div>
      </section>

      {/* Inventory at a glance (computed from published data) */}
      <section aria-label="Inventory at a glance" className="border-b border-line bg-paper">
        <dl className="container-page grid grid-cols-2 divide-line py-8 md:grid-cols-4 md:divide-x">
          {[
            { k: 'Developments', v: developments.length },
            { k: 'Apartment listings', v: apartmentCount },
            { k: 'Commercial listings', v: shopCount },
            { k: 'Neighbourhoods', v: facets.areas.length },
          ].map((s) => (
            <div key={s.k} className="px-2 py-3 md:px-8">
              <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-stone">{s.k}</dt>
              <dd className="mt-1 font-display text-4xl text-charcoal">{s.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Featured listings */}
      <section className="container-page py-20 md:py-28" aria-labelledby="featured-heading">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="eyebrow">Selected listings</p>
            <h2 id="featured-heading" className="mt-3 text-4xl md:text-5xl">Homes and spaces on offer now</h2>
          </div>
          <Link href="/properties" className="link-underline inline-flex items-center gap-2 text-sm font-semibold">
            View all {facets.total} listings <Icon name="arrowRight" size={16} />
          </Link>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((p) => <PropertyCard key={p.id} property={p} />)}
        </div>
      </section>

      {/* Browse by category */}
      <section className="bg-sand/60 py-20 md:py-24" aria-labelledby="categories-heading">
        <div className="container-page">
          <p className="eyebrow">Browse by category</p>
          <h2 id="categories-heading" className="mt-3 max-w-2xl text-4xl md:text-5xl">Find the right fit for how you live or trade</h2>
          <ul className="mt-12 grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
            {facets.bedrooms.map((b) => (
              <li key={b.value}>
                <Link href={`/properties?type=apartment&beds=${b.value >= 4 ? '4%2B' : b.value}`} className="group flex h-full flex-col bg-paper p-7 transition-colors hover:bg-ivory">
                  <span className="font-display text-5xl text-bronze">{b.value}</span>
                  <span className="mt-3 text-lg text-charcoal">{b.value === 1 ? 'One-bedroom' : b.value === 2 ? 'Two-bedroom' : b.value === 3 ? 'Three-bedroom' : `${b.value}-bedroom`} apartments</span>
                  <span className="mt-1 text-sm text-stone">{b.count} listing{b.count === 1 ? '' : 's'}</span>
                  <Icon name="arrowRight" className="mt-6 transition-transform group-hover:translate-x-1" />
                </Link>
              </li>
            ))}
            {shopCount ? (
              <li>
                <Link href="/properties?type=shop" className="group flex h-full flex-col bg-charcoal p-7 text-white transition-colors hover:bg-ink">
                  <Icon name="building" size={44} className="text-bronze-light" />
                  <span className="mt-3 text-lg">Commercial shops</span>
                  <span className="mt-1 text-sm text-white/70">{shopCount} listing{shopCount === 1 ? '' : 's'} in Piassa and Gelan</span>
                  <Icon name="arrowRight" className="mt-6 transition-transform group-hover:translate-x-1" />
                </Link>
              </li>
            ) : null}
          </ul>
        </div>
      </section>

      {/* Developments showcase */}
      {showcase.length ? (
        <section className="container-page py-20 md:py-28" aria-labelledby="dev-heading">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="eyebrow">Developments</p>
              <h2 id="dev-heading" className="mt-3 text-4xl md:text-5xl">Buildings worth knowing</h2>
            </div>
            <Link href="/developments" className="link-underline inline-flex items-center gap-2 text-sm font-semibold">
              All {developments.length} developments <Icon name="arrowRight" size={16} />
            </Link>
          </div>
          <div className="mt-12 grid gap-x-8 gap-y-14 md:grid-cols-2">
            {showcase.map((d, i) => (
              <article key={d.slug} className={`group relative ${i % 2 === 1 ? 'md:mt-24' : ''}`}>
                <div className="img-zoom relative aspect-[4/5] overflow-hidden bg-sand sm:aspect-[5/4] md:aspect-[4/5]">
                  <ResponsiveImage image={d.cover!} fill sizes="(min-width: 768px) 50vw, 100vw" alt="" />
                </div>
                <div className="mt-6 flex items-start justify-between gap-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-bronze">
                      {d.area} · {BUILDING_TYPE_LABELS[d.buildingType]}
                    </p>
                    <h3 className="mt-2 text-3xl">
                      <Link href={`/developments/${d.slug}`} className="after:absolute after:inset-0">{d.name}</Link>
                    </h3>
                    <p className="mt-3 max-w-md text-[0.95rem] leading-relaxed text-stone">{d.summary}</p>
                  </div>
                  <span className="mt-2 hidden h-12 w-12 shrink-0 items-center justify-center rounded-full border border-charcoal transition-colors group-hover:bg-charcoal group-hover:text-white sm:flex" aria-hidden>
                    <Icon name="arrowRight" size={18} />
                  </span>
                </div>
                <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                  {d.buildingConfig ? <div><dt className="sr-only">Configuration</dt><dd>{d.buildingConfig}</dd></div> : null}
                  {formatRange(d.unitSizeMin, d.unitSizeMax) ? <div><dt className="sr-only">Unit sizes</dt><dd>{formatRange(d.unitSizeMin, d.unitSizeMax)}</dd></div> : null}
                  {d.deliveryEstimate ? <div><dt className="sr-only">Delivery</dt><dd>{d.deliveryEstimate}</dd></div> : null}
                </dl>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {/* Neighbourhoods */}
      <section className="bg-charcoal py-20 text-white md:py-24" aria-labelledby="areas-heading">
        <div className="container-page grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="eyebrow !text-bronze-light">Locations</p>
            <h2 id="areas-heading" className="mt-3 text-4xl !text-white md:text-5xl">Across Addis Ababa</h2>
            <p className="mt-5 max-w-sm leading-relaxed text-white/70">
              From the diplomatic quarter around Sarbet to the established streets of Piassa and the growing eastern district of Ayat, each area offers a different pace of city life.
            </p>
          </div>
          <ul className="grid gap-px bg-white/10 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-3">
            {facets.areas.map((a) => (
              <li key={a.value}>
                <Link href={`/properties?area=${encodeURIComponent(a.value)}`} className="group flex h-full items-center justify-between bg-charcoal p-6 transition-colors hover:bg-ink">
                  <span>
                    <span className="block font-display text-2xl">{a.value}</span>
                    <span className="mt-1 block text-sm text-white/60">{a.count} listing{a.count === 1 ? '' : 's'}</span>
                  </span>
                  <Icon name="arrowRight" className="text-bronze-light transition-transform group-hover:translate-x-1" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Value proposition, grounded in listed amenities */}
      <ValueSection developments={developments.length} />

      {/* Realtor introduction */}
      <section className="container-page grid items-center gap-12 py-20 md:py-28 lg:grid-cols-12" aria-labelledby="realtor-heading">
        <div className="lg:col-span-5">
          {settings.realtorPhoto ? (
            <div className="relative aspect-[4/5] overflow-hidden bg-sand">
              <ResponsiveImage image={settings.realtorPhoto} fill sizes="(min-width: 1024px) 40vw, 100vw" />
            </div>
          ) : (
            <div className="flex aspect-[4/5] flex-col justify-end bg-sand p-10">
              <p className="font-display text-6xl leading-none text-bronze">“</p>
              <p className="mt-4 font-display text-2xl leading-snug text-charcoal">
                One point of contact from your first question to the day you receive your keys.
              </p>
            </div>
          )}
        </div>
        <div className="lg:col-span-6 lg:col-start-7">
          <p className="eyebrow">Your realtor</p>
          <h2 id="realtor-heading" className="mt-3 text-4xl md:text-5xl">{settings.realtorName ?? 'Personal guidance, start to finish'}</h2>
          {settings.realtorTitle ? <p className="mt-3 text-sm font-semibold uppercase tracking-[0.14em] text-stone">{settings.realtorTitle}</p> : null}
          <p className="mt-6 text-lg leading-relaxed text-ink">{settings.realtorBio ?? 'I help buyers compare Temer Properties developments side by side, arrange site visits, and get clear answers from the developer on pricing, payment plans and delivery.'}</p>
          <p className="mt-4 leading-relaxed text-stone">{settings.relationshipStatement}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/about" className="btn btn-outline">How I work</Link>
            <Link href="/contact?type=viewing" className="btn btn-primary">Book a viewing</Link>
          </div>
        </div>
      </section>

      <InquirySection
        id="inquire"
        eyebrow="Start a conversation"
        title="Tell me what you are looking for"
        description="Share your budget, preferred area and timeline. I will reply with suitable options and the developer's current availability."
      />
    </>
  )
}

function ValueSection({ developments }: { developments: number }) {
  const points = [
    { icon: 'building' as const, title: 'Developer-built towers', text: `${developments} current developments by a single developer, so specifications, finishes and buying processes are consistent from one building to the next.` },
    { icon: 'car' as const, title: 'Parking and EV charging', text: 'Listings include dedicated parking, and the developer lists EV charging stations as a standard building amenity.' },
    { icon: 'layers' as const, title: 'Elevators, terraces and services', text: 'Elevators, garbage chutes, CCTV in common areas, water storage and green terraces are listed for the residential buildings.' },
    { icon: 'clock' as const, title: 'Published delivery timelines', text: 'Each development carries the developer’s own estimated delivery period, which I confirm in writing before you commit.' },
  ]
  return (
    <section className="border-y border-line bg-paper py-20 md:py-24" aria-labelledby="value-heading">
      <div className="container-page">
        <p className="eyebrow">Why these properties</p>
        <h2 id="value-heading" className="mt-3 max-w-3xl text-4xl md:text-5xl">Modern buildings in central and growing districts</h2>
        <div className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {points.map((p) => (
            <div key={p.title}>
              <Icon name={p.icon} size={30} className="text-bronze" />
              <h3 className="mt-5 text-xl">{p.title}</h3>
              <p className="mt-3 text-[0.95rem] leading-relaxed text-stone">{p.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-12 flex items-start gap-2 text-xs text-stone">
          <Icon name="info" size={16} className="mt-px shrink-0" />
          Amenities and timelines are as published by the developer and can differ between buildings; each listing shows the details that apply to it.
        </p>
      </div>
    </section>
  )
}

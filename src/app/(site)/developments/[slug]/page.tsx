import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ContactChannels } from '@/components/inquiry/ContactChannels'
import { InquiryForm } from '@/components/inquiry/InquiryForm'
import { Gallery } from '@/components/property/Gallery'
import { LocationMap } from '@/components/property/LocationMap'
import { ShareButtons } from '@/components/property/ShareButtons'
import { Icon } from '@/components/ui/Icon'
import { ResponsiveImage, mediaUrl } from '@/components/ui/ResponsiveImage'
import { AVAILABILITY_LABELS, BUILDING_TYPE_LABELS, CONSTRUCTION_STAGE_LABELS } from '@/lib/domain'
import { formatPrice, formatRange, formatSize } from '@/lib/format'
import { getPublicDevelopment } from '@/lib/queries/catalog'
import { getSettings } from '@/lib/queries/settings'
import { absoluteUrl, jsonLd } from '@/lib/seo/site'


type Params = Promise<{ slug: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  const data = await getPublicDevelopment(slug)
  if (!data) return { title: 'Development not found', robots: { index: false } }
  const { development: d } = data
  const s = await getSettings()
  const title = d.seoTitle || `${d.name}, ${d.area}: ${BUILDING_TYPE_LABELS[d.buildingType].toLowerCase()} development | ${s.brandName}`
  const description = d.seoDescription || d.summary
  const og = data.photos[0]?.variants.find((v) => v.width >= 1200) ?? data.photos[0]?.variants.at(-1)
  return {
    title,
    description,
    alternates: { canonical: `/developments/${d.slug}` },
    openGraph: {
      title,
      description,
      url: absoluteUrl(`/developments/${d.slug}`),
      images: og ? [{ url: absoluteUrl(mediaUrl(og.key)), width: og.width, height: og.height }] : undefined,
    },
  }
}

export default async function DevelopmentPage({ params }: { params: Params }) {
  const { slug } = await params
  const [data, settings] = await Promise.all([getPublicDevelopment(slug), getSettings()])
  if (!data) notFound()
  const { development: d, photos, plans, units } = data
  const url = absoluteUrl(`/developments/${d.slug}`)
  const hero = photos[0]
  const lat = d.latitude == null ? null : Number(d.latitude)
  const lng = d.longitude == null ? null : Number(d.longitude)
  const sizes = formatRange(d.unitSizeMin, d.unitSizeMax)

  const facts = [
    { label: 'Type', value: BUILDING_TYPE_LABELS[d.buildingType] },
    ...(d.buildingConfig ? [{ label: 'Building', value: d.buildingConfig }] : []),
    ...(sizes ? [{ label: 'Unit sizes', value: sizes }] : []),
    { label: 'Construction', value: d.constructionStage === 'not_confirmed' ? 'To be confirmed' : (d.constructionNote ?? CONSTRUCTION_STAGE_LABELS[d.constructionStage]) },
    ...(d.deliveryEstimate ? [{ label: 'Delivery', value: d.deliveryEstimate }] : []),
    ...(d.priceMode !== 'on_request' ? [{ label: 'Pricing', value: formatPrice(d) }] : []),
  ]

  const structured = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
      { '@type': 'ListItem', position: 2, name: 'Developments', item: absoluteUrl('/developments') },
      { '@type': 'ListItem', position: 3, name: d.name, item: url },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structured) }} />
      <section className="relative isolate flex min-h-[82svh] flex-col justify-end overflow-hidden bg-charcoal text-white">
        {hero ? <ResponsiveImage image={hero} fill priority sizes="100vw" alt="" className="-z-10" /> : null}
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(20_19_17/0.5)_0%,rgb(20_19_17/0.1)_40%,rgb(20_19_17/0.85)_100%)]" />
        <div className="container-page pb-12 pt-32 md:pb-16">
          <nav aria-label="Breadcrumb" className="text-xs font-semibold uppercase tracking-[0.14em] text-white/75">
            <Link href="/" className="link-underline">Home</Link> <span aria-hidden>/</span>{' '}
            <Link href="/developments" className="link-underline">Developments</Link>
          </nav>
          <p className="eyebrow reveal mt-6 !text-bronze-light">{d.area}, {d.city} · {BUILDING_TYPE_LABELS[d.buildingType]}</p>
          <h1 className="reveal reveal-delay-1 mt-4 text-5xl !text-white md:text-7xl">{d.name}</h1>
          {d.tagline ? <p className="reveal reveal-delay-2 mt-4 max-w-xl text-lg text-white/85">{d.tagline}</p> : null}
          <div className="reveal reveal-delay-2 mt-8 flex flex-col gap-3 sm:flex-row">
            {units.length ? <a href="#units" className="btn btn-accent">View {units.length} unit type{units.length === 1 ? '' : 's'}</a> : null}
            <a href="#inquire" className="btn btn-ghost-light">Book a site visit</a>
          </div>
        </div>
      </section>

      <section aria-label="Key facts" className="border-b border-line bg-paper">
        <dl className="container-page grid grid-cols-2 gap-y-6 py-8 md:grid-cols-3 lg:grid-cols-6">
          {facts.map((f) => (
            <div key={f.label} className="pr-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-stone">{f.label}</dt>
              <dd className="mt-1.5 font-semibold text-charcoal">{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="container-page grid gap-14 py-16 md:py-20 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <section aria-labelledby="about-dev">
            <p className="eyebrow">Overview</p>
            <h2 id="about-dev" className="mt-3 text-3xl md:text-4xl">About {d.name}</h2>
            <p className="mt-6 text-xl leading-relaxed text-ink">{d.summary}</p>
            <div className="prose-estate mt-5 leading-relaxed text-stone">
              {d.description.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
            </div>
          </section>

          {units.length ? (
            <section id="units" className="mt-16 scroll-mt-24" aria-labelledby="units-heading">
              <h2 id="units-heading" className="text-3xl md:text-4xl">Available unit types</h2>
              <p className="mt-2 text-stone">Each unit type has its own page with specifications and an inquiry form.</p>
              <ul className="mt-8 divide-y divide-line border-y border-line">
                {units.map((u) => (
                  <li key={u.id}>
                    <Link href={`/properties/${u.slug}`} className="group grid grid-cols-[auto_1fr_auto] items-center gap-5 py-5 hover:bg-paper">
                      <div className="relative h-20 w-24 overflow-hidden bg-sand sm:w-32">
                        {u.cover ? <ResponsiveImage image={u.cover} fill sizes="128px" alt="" /> : null}
                      </div>
                      <div>
                        <p className="font-display text-xl text-charcoal">{u.title.replace(`, ${d.name}`, '')}</p>
                        <p className="mt-1 text-sm text-stone">
                          {[u.bedrooms != null ? `${u.bedrooms} bed` : null, u.bathrooms != null ? `${u.bathrooms} bath` : null, formatSize(u)].filter(Boolean).join(' · ')}
                        </p>
                        <p className="mt-1 text-sm font-semibold">{formatPrice(u)} <span className="font-normal text-stone">· {AVAILABILITY_LABELS[u.availability]}</span></p>
                      </div>
                      <Icon name="arrowRight" className="mr-2 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {photos.length > 1 ? (
            <section className="mt-16" aria-labelledby="gallery-heading">
              <h2 id="gallery-heading" className="text-3xl md:text-4xl">Gallery</h2>
              <p className="mt-2 text-sm text-stone">Architectural renders and interiors published by the developer.</p>
              <div className="mt-6"><Gallery images={photos} title={d.name} layout="grid" /></div>
            </section>
          ) : null}

          {plans.length ? (
            <section className="mt-16" aria-labelledby="plans-heading">
              <h2 id="plans-heading" className="text-3xl md:text-4xl">Floor and unit plans</h2>
              <div className="mt-6"><Gallery images={plans} title={`${d.name} plans`} layout="grid" /></div>
            </section>
          ) : null}

          {d.amenities.length ? (
            <section className="mt-16" aria-labelledby="amen-heading">
              <h2 id="amen-heading" className="text-3xl md:text-4xl">Amenities and facilities</h2>
              <ul className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                {d.amenities.map((a) => (
                  <li key={a} className="flex items-center gap-3 border-b border-line/70 pb-3"><span className="h-1.5 w-1.5 rotate-45 bg-bronze" aria-hidden />{a}</li>
                ))}
              </ul>
              {d.finishingOptions.length ? <p className="mt-6 text-stone">Finishing options: <strong className="text-charcoal">{d.finishingOptions.join(', ')}</strong></p> : null}
            </section>
          ) : null}

          <section className="mt-16" aria-labelledby="loc-heading">
            <h2 id="loc-heading" className="text-3xl md:text-4xl">Location</h2>
            <p className="mt-3 text-stone">{d.area}, {d.city}{d.addressNote ? ` · ${d.addressNote}` : ''}</p>
            {lat != null && lng != null ? (
              <div className="mt-6"><LocationMap lat={lat} lng={lng} label={d.name} approximate={d.locationPrecision !== 'exact'} /></div>
            ) : (
              <p className="mt-4 border-l-2 border-bronze pl-4 text-sm text-stone">The exact site location is shared when we arrange your visit.</p>
            )}
          </section>

          {d.brochureUrl ? (
            <section className="mt-16 flex flex-col items-start justify-between gap-5 bg-sand/70 p-8 sm:flex-row sm:items-center" aria-labelledby="docs-heading">
              <div className="flex items-start gap-4">
                <Icon name="file" size={32} className="shrink-0 text-bronze" />
                <div>
                  <h2 id="docs-heading" className="text-2xl">Developer brochure</h2>
                  <p className="mt-1 text-sm text-stone">Official {d.name} catalogue (PDF, hosted by {settings.developerName}).</p>
                </div>
              </div>
              <a href={d.brochureUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline">Open brochure</a>
            </section>
          ) : null}

          <div className="mt-12 space-y-4">
            <ShareButtons url={url} title={d.name} />
            <p className="text-xs leading-relaxed text-stone">
              Details are as published by {settings.developerName}. Timelines are developer estimates, renders are illustrative, and all specifications are confirmed in writing before any reservation.
            </p>
          </div>
        </div>

        <aside className="lg:col-span-5 lg:col-start-8" aria-label={`Inquire about ${d.name}`}>
          <div id="inquire" className="scroll-mt-24 bg-paper p-6 shadow-[0_0_0_1px_var(--color-line)] sm:p-8 lg:sticky lg:top-24">
            <p className="eyebrow">{d.name}</p>
            <h2 className="mt-2 text-2xl">Request information or a site visit</h2>
            <div className="mt-6">
              <InquiryForm fixedSubject={{ kind: 'development', slug: d.slug, label: d.name }} compact idPrefix="dev" />
            </div>
            <ContactChannels settings={settings} subject={d.name} className="mt-8 border-t border-line pt-6" />
          </div>
        </aside>
      </div>
    </>
  )
}

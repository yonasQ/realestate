import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { InquiryForm } from '@/components/inquiry/InquiryForm'
import { ContactChannels } from '@/components/inquiry/ContactChannels'
import { Gallery } from '@/components/property/Gallery'
import { LocationMap } from '@/components/property/LocationMap'
import { PropertyCard } from '@/components/property/PropertyCard'
import { ShareButtons } from '@/components/property/ShareButtons'
import { MobileActionBar } from '@/components/property/MobileActionBar'
import { Icon } from '@/components/ui/Icon'
import { mediaUrl } from '@/components/ui/ResponsiveImage'
import {
  AVAILABILITY_LABELS,
  BUILDING_TYPE_LABELS,
  CONSTRUCTION_STAGE_LABELS,
  ENQUIRABLE_AVAILABILITIES,
  PROPERTY_TYPE_LABELS,
} from '@/lib/domain'
import { bathroomsLabel, bedroomsLabel, formatPrice, formatRange, formatSize } from '@/lib/format'
import { getPublicProperty } from '@/lib/queries/catalog'
import { getSettings } from '@/lib/queries/settings'
import { offerAvailability } from '@/lib/seo/jsonld'
import { pageMetadata } from '@/lib/seo/metadata'
import { absoluteUrl, jsonLd } from '@/lib/seo/site'


type Params = Promise<{ slug: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  const data = await getPublicProperty(slug)
  if (!data) return { title: 'Property not found', robots: { index: false } }
  const { property: p, development: d } = data
  const s = await getSettings()
  const title = p.seoTitle || `${p.title} in ${d.area}, Addis Ababa | ${s.brandName}`
  const description = p.seoDescription || `${p.summary} ${formatPrice(p)}. Request details or book a viewing.`.slice(0, 300)
  return pageMetadata({ title, description, path: `/properties/${p.slug}`, siteName: s.brandName, image: data.images[0] })
}

export default async function PropertyPage({ params }: { params: Params }) {
  const { slug } = await params
  const [data, settings] = await Promise.all([getPublicProperty(slug), getSettings()])
  if (!data) notFound()
  const { property: p, development: d, images, plans, similar } = data
  const url = absoluteUrl(`/properties/${p.slug}`)
  const enquirable = ENQUIRABLE_AVAILABILITIES.includes(p.availability)
  const size = formatSize(p)
  const price = formatPrice(p)
  const lat = d.latitude == null ? null : Number(d.latitude)
  const lng = d.longitude == null ? null : Number(d.longitude)

  const specs: { label: string; value: string }[] = [
    { label: 'Property type', value: PROPERTY_TYPE_LABELS[p.propertyType] },
    ...(p.bedrooms != null ? [{ label: 'Bedrooms', value: String(p.bedrooms) }] : []),
    ...(p.bathrooms != null ? [{ label: 'Bathrooms', value: String(p.bathrooms) }] : []),
    ...(size ? [{ label: p.propertyType === 'shop' ? 'Unit sizes' : 'Unit area', value: size }] : []),
    ...(p.parkingSpaces != null ? [{ label: 'Parking', value: `${p.parkingSpaces} space${p.parkingSpaces === 1 ? '' : 's'}` }] : []),
    { label: 'Availability', value: AVAILABILITY_LABELS[p.availability] },
    { label: 'Development', value: d.name },
    { label: 'Location', value: `${d.area}, ${d.city}` },
    ...(d.buildingConfig ? [{ label: 'Building', value: d.buildingConfig }] : []),
    { label: 'Building type', value: BUILDING_TYPE_LABELS[d.buildingType] },
    ...(d.constructionStage !== 'not_confirmed'
      ? [{ label: 'Construction', value: d.constructionNote ?? CONSTRUCTION_STAGE_LABELS[d.constructionStage] }]
      : []),
    ...(d.deliveryEstimate ? [{ label: 'Delivery', value: d.deliveryEstimate }] : []),
    ...(d.finishingOptions.length ? [{ label: 'Finishing', value: d.finishingOptions.join(' or ') }] : []),
  ]

  const structured = [
    {
      '@context': 'https://schema.org',
      '@type': 'RealEstateListing',
      name: p.title,
      url,
      description: p.summary,
      datePosted: p.publishedAt ? new Date(p.publishedAt).toISOString() : undefined,
      image: images.slice(0, 6).map((i) => absoluteUrl(mediaUrl(i.variants.at(-1)!.key))),
      about: {
        '@type': p.propertyType === 'apartment' ? 'Apartment' : 'Place',
        name: p.title,
        ...(p.bedrooms != null ? { numberOfBedrooms: p.bedrooms } : {}),
        ...(p.bathrooms != null ? { numberOfBathroomsTotal: p.bathrooms } : {}),
        ...(p.sizeSqm ? { floorSize: { '@type': 'QuantitativeValue', value: Number(p.sizeSqm), unitCode: 'MTK' } } : {}),
        address: { '@type': 'PostalAddress', addressLocality: d.city, addressRegion: d.area, addressCountry: 'ET' },
        ...(lat != null && lng != null && d.locationPrecision === 'exact' ? { geo: { '@type': 'GeoCoordinates', latitude: lat, longitude: lng } } : {}),
      },
      ...(p.priceMode === 'fixed' && p.priceAmount && p.priceCurrency
        ? { offers: { '@type': 'Offer', price: Number(p.priceAmount), priceCurrency: p.priceCurrency, availability: offerAvailability(p.availability) } }
        : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
        { '@type': 'ListItem', position: 2, name: 'Properties', item: absoluteUrl('/properties') },
        { '@type': 'ListItem', position: 3, name: p.title, item: url },
      ],
    },
  ]

  return (
    <div className="pb-24 lg:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structured) }} />

      <div className="container-page pt-28 md:pt-32">
        <nav aria-label="Breadcrumb" className="text-xs font-semibold uppercase tracking-[0.14em] text-stone">
          <Link href="/" className="link-underline">Home</Link> <span aria-hidden>/</span>{' '}
          <Link href="/properties" className="link-underline">Properties</Link> <span aria-hidden>/</span>{' '}
          <Link href={`/developments/${d.slug}`} className="link-underline">{d.name}</Link>
        </nav>
        <header className="mt-5 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-bronze">
              <Icon name="pin" size={14} /> {d.area}, {d.city}
            </p>
            <h1 className="mt-3 text-4xl leading-[1.08] md:text-[3.4rem]">{p.title}</h1>
          </div>
          <div className="lg:text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone">Price</p>
            <p className="mt-1 font-display text-3xl text-charcoal">{price}</p>
            {p.priceMode === 'on_request' ? <p className="mt-1 text-sm text-stone">Current pricing and payment plans are confirmed by {settings.developerName}.</p> : null}
          </div>
        </header>
        <div className="mt-8">
          {images.length ? <Gallery images={images} title={p.title} /> : null}
        </div>
      </div>

      <div className="container-page mt-12 grid gap-14 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <ul className="flex flex-wrap gap-x-8 gap-y-4 border-y border-line py-6 text-charcoal" aria-label="Key facts">
            {p.bedrooms != null ? <li className="flex items-center gap-2"><Icon name="bed" />{bedroomsLabel(p.bedrooms)}</li> : null}
            {p.bathrooms != null ? <li className="flex items-center gap-2"><Icon name="bath" />{bathroomsLabel(p.bathrooms)}</li> : null}
            {size ? <li className="flex items-center gap-2"><Icon name="area" />{size}</li> : null}
            {p.parkingSpaces ? <li className="flex items-center gap-2"><Icon name="car" />{p.parkingSpaces} parking</li> : null}
            <li className="flex items-center gap-2"><Icon name="check" />{AVAILABILITY_LABELS[p.availability]}</li>
          </ul>

          <section className="mt-10" aria-labelledby="overview">
            <h2 id="overview" className="text-3xl">Overview</h2>
            <div className="prose-estate mt-5 text-lg leading-relaxed text-ink">
              <p>{p.summary}</p>
              {(p.description || d.description).split(/\n{2,}/).map((para, i) => <p key={i} className="text-base text-stone">{para}</p>)}
            </div>
            {p.highlights.length ? (
              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {p.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-3 bg-paper p-4 shadow-[0_0_0_1px_var(--color-line)]">
                    <Icon name="check" size={18} className="mt-0.5 shrink-0 text-bronze" /> <span>{h}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="mt-14" aria-labelledby="specs">
            <h2 id="specs" className="text-3xl">Specifications</h2>
            <dl className="mt-6 grid border-t border-line sm:grid-cols-2 sm:gap-x-10">
              {specs.map((s) => (
                <div key={s.label} className="flex justify-between gap-6 border-b border-line py-3.5 text-[0.95rem]">
                  <dt className="text-stone">{s.label}</dt>
                  <dd className="text-right font-semibold text-charcoal">{s.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {d.amenities.length ? (
            <section className="mt-14" aria-labelledby="amenities">
              <h2 id="amenities" className="text-3xl">Building amenities</h2>
              <ul className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                {d.amenities.map((a) => (
                  <li key={a} className="flex items-center gap-3 border-b border-line/70 pb-3"><span className="h-1.5 w-1.5 rotate-45 bg-bronze" aria-hidden />{a}</li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-stone">As listed by the developer for {d.name}.</p>
            </section>
          ) : null}

          {plans.length ? (
            <section className="mt-14" aria-labelledby="plans">
              <h2 id="plans" className="text-3xl">Floor and unit plans</h2>
              <p className="mt-2 text-sm text-stone">Plans published by the developer for {d.name}. Ask me which plan matches the unit you are considering.</p>
              <div className="mt-6"><Gallery images={plans} title={`${d.name} plans`} layout="grid" /></div>
            </section>
          ) : null}

          <section className="mt-14" aria-labelledby="location">
            <h2 id="location" className="text-3xl">Location</h2>
            <p className="mt-3 text-stone">{d.area}, {d.city}{d.addressNote ? ` · ${d.addressNote}` : ''}</p>
            {lat != null && lng != null ? (
              <div className="mt-6"><LocationMap lat={lat} lng={lng} label={d.name} approximate={d.locationPrecision !== 'exact'} /></div>
            ) : (
              <p className="mt-4 border-l-2 border-bronze pl-4 text-sm text-stone">The exact site location is shared when we arrange your viewing.</p>
            )}
          </section>

          <section className="mt-14 bg-charcoal p-8 text-white md:p-10" aria-labelledby="dev-info">
            <p className="eyebrow !text-bronze-light">The development</p>
            <h2 id="dev-info" className="mt-3 text-3xl !text-white">{d.name}</h2>
            <p className="mt-4 max-w-xl leading-relaxed text-white/75">{d.summary}</p>
            <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-3 text-sm">
              {formatRange(d.unitSizeMin, d.unitSizeMax) ? <div><dt className="text-white/55">Unit sizes</dt><dd className="mt-1 font-semibold">{formatRange(d.unitSizeMin, d.unitSizeMax)}</dd></div> : null}
              {d.deliveryEstimate ? <div><dt className="text-white/55">Delivery</dt><dd className="mt-1 font-semibold">{d.deliveryEstimate}</dd></div> : null}
            </dl>
            <Link href={`/developments/${d.slug}`} className="btn btn-ghost-light mt-8">Explore {d.name} <Icon name="arrowRight" size={16} /></Link>
          </section>

          <div className="mt-10 space-y-4">
            <ShareButtons url={url} title={p.title} />
            <p className="text-xs leading-relaxed text-stone">
              Information is as published by {settings.developerName}{p.updatedAt ? ` and was last updated on this site on ${new Date(p.updatedAt).toLocaleDateString('en-GB', { timeZone: 'Africa/Addis_Ababa', dateStyle: 'medium' })}` : ''}. Images may be renders or representative interiors. Specifications, prices and availability can change; all details are confirmed in writing before any reservation.
            </p>
          </div>
        </div>

        <aside className="lg:col-span-5 lg:col-start-8" aria-label="Inquire about this property">
          <div id="inquire" className="scroll-mt-24 bg-paper p-6 shadow-[0_0_0_1px_var(--color-line)] sm:p-8 lg:sticky lg:top-24">
            <p className="eyebrow">{enquirable ? 'Interested?' : 'Currently unavailable'}</p>
            <h2 className="mt-2 text-2xl">{enquirable ? 'Ask a question or book a viewing' : 'This listing is not taking inquiries'}</h2>
            {enquirable ? (
              <div className="mt-6">
                <InquiryForm fixedSubject={{ kind: 'property', slug: p.slug, label: p.title }} compact idPrefix="detail" />
              </div>
            ) : (
              <p className="mt-4 text-stone">
                Ask me about similar units in {d.name} or other developments. <Link className="font-semibold underline" href="/contact">Contact me</Link>.
              </p>
            )}
            <ContactChannels settings={settings} subject={p.title} className="mt-8 border-t border-line pt-6" />
          </div>
        </aside>
      </div>

      {similar.length ? (
        <section className="container-page py-20 md:py-28" aria-labelledby="similar">
          <h2 id="similar" className="text-3xl md:text-4xl">Similar properties</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((s) => <PropertyCard key={s.id} property={s} />)}
          </div>
        </section>
      ) : <div className="h-20" />}

      <MobileActionBar phone={settings.phone} whatsapp={settings.whatsapp} subject={p.title} enquirable={enquirable} />
    </div>
  )
}

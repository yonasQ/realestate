import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon } from '@/components/ui/Icon'
import { ResponsiveImage } from '@/components/ui/ResponsiveImage'
import { BUILDING_TYPE_LABELS, BUILDING_TYPES, CONSTRUCTION_STAGE_LABELS, PROPERTY_TYPE_PLURAL, type BuildingType, type ConstructionStage } from '@/lib/domain'
import { formatRange } from '@/lib/format'
import { getPublicDevelopments } from '@/lib/queries/catalog'
import { getSettings } from '@/lib/queries/settings'
import { breadcrumbs, itemList, webPage } from '@/lib/seo/jsonld'
import { pageMetadata } from '@/lib/seo/metadata'
import { jsonLd } from '@/lib/seo/site'


export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings()
  return pageMetadata({
    title: `${s.developerName} developments in Addis Ababa | ${s.brandName}`,
    description: `Residential, commercial and mixed-use developments by ${s.developerName} in Sarbet, Aware, Ayat, Piassa, Garment and Gelan: building details, delivery estimates, plans and available units.`,
    path: '/developments',
    siteName: s.brandName,
    image: s.heroImage,
  })
}

type SearchParams = Promise<{ type?: string }>

export default async function DevelopmentsPage({ searchParams }: { searchParams: SearchParams }) {
  const { type } = await searchParams
  const filter = (BUILDING_TYPES as readonly string[]).includes(type ?? '') ? (type as BuildingType) : undefined
  const all = await getPublicDevelopments()
  const list = filter ? all.filter((d) => d.buildingType === filter) : all
  const typesPresent = BUILDING_TYPES.filter((t) => all.some((d) => d.buildingType === t))

  const structured = [
    webPage('CollectionPage', 'Developments in Addis Ababa', '/developments', 'Residential, commercial and mixed-use developments in Addis Ababa.'),
    breadcrumbs([{ name: 'Home', path: '/' }, { name: 'Developments', path: '/developments' }]),
    itemList('Developments', all.map((d) => ({ name: d.name, path: `/developments/${d.slug}` }))),
  ]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structured) }} />
      <section className="pb-10 pt-32 md:pt-36">
        <div className="container-page">
          <nav aria-label="Breadcrumb" className="text-xs font-semibold uppercase tracking-[0.14em] text-stone">
            <Link href="/" className="link-underline">Home</Link> <span aria-hidden>/</span> Developments
          </nav>
          <h1 className="mt-4 max-w-4xl text-4xl md:text-6xl">Developments by Temer Properties</h1>
          <p className="mt-5 max-w-2xl text-lg text-stone">
            A development is a whole building project; each one contains several unit types you can buy. Compare buildings here, then open a development to see its units, plans and timeline.
          </p>
          <ul className="mt-8 flex flex-wrap gap-2" aria-label="Filter by building type">
            <li><Link href="/developments" scroll={false} aria-current={!filter ? 'page' : undefined} className={`chip min-h-10 px-4 ${!filter ? '!border-charcoal !bg-charcoal !text-white' : 'hover:border-charcoal'}`}>All ({all.length})</Link></li>
            {typesPresent.map((t) => (
              <li key={t}>
                <Link href={`/developments?type=${t}`} scroll={false} aria-current={filter === t ? 'page' : undefined} className={`chip min-h-10 px-4 ${filter === t ? '!border-charcoal !bg-charcoal !text-white' : 'hover:border-charcoal'}`}>
                  {BUILDING_TYPE_LABELS[t]} ({all.filter((d) => d.buildingType === t).length})
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-page pb-24" aria-label="Developments">
        <ul className="grid gap-x-8 gap-y-14 md:grid-cols-2 xl:grid-cols-3">
          {list.map((d, i) => (
            <li key={d.slug}>
              <article className="group relative">
                <div className="img-zoom relative aspect-[4/3] overflow-hidden bg-sand">
                  {d.cover ? <ResponsiveImage image={d.cover} fill priority={i === 0} sizes="(min-width: 1280px) 30vw, (min-width: 768px) 50vw, 100vw" alt="" /> : null}
                  <span className="chip absolute left-3 top-3 !border-transparent bg-paper/95">{BUILDING_TYPE_LABELS[d.buildingType]}</span>
                </div>
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-bronze">{d.area}, {d.city}</p>
                <h2 className="mt-2 text-3xl">
                  <Link href={`/developments/${d.slug}`} className="after:absolute after:inset-0">{d.name}</Link>
                </h2>
                <p className="mt-3 leading-relaxed text-stone">{d.summary}</p>
                <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 text-sm">
                  <div><dt className="text-stone">Units listed</dt><dd className="mt-0.5 font-semibold">{d.unitCount} · {d.propertyTypes.map((t) => PROPERTY_TYPE_PLURAL[t]).join(', ')}</dd></div>
                  {formatRange(d.unitSizeMin, d.unitSizeMax) ? <div><dt className="text-stone">Sizes</dt><dd className="mt-0.5 font-semibold">{formatRange(d.unitSizeMin, d.unitSizeMax)}</dd></div> : null}
                  {d.constructionStage !== 'not_confirmed' ? <div><dt className="text-stone">Status</dt><dd className="mt-0.5 font-semibold">{d.constructionNote?.replace(/ \(.*\)$/, '') ?? CONSTRUCTION_STAGE_LABELS[d.constructionStage as ConstructionStage]}</dd></div> : null}
                  {d.deliveryEstimate ? <div><dt className="text-stone">Delivery</dt><dd className="mt-0.5 font-semibold">{d.deliveryEstimate.replace(' (developer estimate)', '')}</dd></div> : null}
                </dl>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold" aria-hidden>View development <Icon name="arrowRight" size={16} className="transition-transform group-hover:translate-x-1" /></span>
              </article>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

import 'server-only'
import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { and, asc, desc, eq, gte, ilike, inArray, lte, ne, or, sql, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/lib/db/client'
import {
  developmentImages,
  developments,
  media,
  properties,
  propertyImages,
  type MediaVariant,
} from '@/lib/db/schema'
import { PAGE_SIZE, type Availability, type ImageKind, type PropertyType } from '@/lib/domain'
import { escapeLike, type ListingFilters } from '@/lib/listing-filters'

export const CATALOG_TAG = 'catalog'
// Safety net only: edits invalidate by tag immediately. Bounds staleness if several instances run without a shared cache handler.
const REVALIDATE_SECONDS = 900

export type PublicImage = {
  id: string
  alt: string
  width: number
  height: number
  variants: MediaVariant[]
  dominantColor: string | null
  caption?: string | null
  kind?: ImageKind
  credit?: string | null
}

export type PropertyCard = {
  id: string
  slug: string
  title: string
  propertyType: PropertyType
  availability: Availability
  featured: boolean
  bedrooms: number | null
  bathrooms: number | null
  sizeSqm: string | null
  sizeMinSqm: string | null
  sizeMaxSqm: string | null
  priceMode: 'on_request' | 'fixed' | 'from' | 'per_sqm_from'
  priceAmount: string | null
  priceCurrency: 'ETB' | 'USD' | null
  summary: string
  updatedAt: Date
  development: { slug: string; name: string; area: string; city: string }
  cover: PublicImage | null
}

const coverMedia = alias(media, 'cover_media')

const cardColumns = {
  id: properties.id,
  slug: properties.slug,
  title: properties.title,
  propertyType: properties.propertyType,
  availability: properties.availability,
  featured: properties.featured,
  bedrooms: properties.bedrooms,
  bathrooms: properties.bathrooms,
  sizeSqm: properties.sizeSqm,
  sizeMinSqm: properties.sizeMinSqm,
  sizeMaxSqm: properties.sizeMaxSqm,
  priceMode: properties.priceMode,
  priceAmount: properties.priceAmount,
  priceCurrency: properties.priceCurrency,
  summary: properties.summary,
  updatedAt: properties.updatedAt,
  devSlug: developments.slug,
  devName: developments.name,
  devArea: developments.area,
  devCity: developments.city,
  coverId: coverMedia.id,
  coverAlt: coverMedia.alt,
  coverWidth: coverMedia.width,
  coverHeight: coverMedia.height,
  coverVariants: coverMedia.variants,
  coverColor: coverMedia.dominantColor,
}

/** Both the listing and its parent development must be published to be public. */
const publiclyVisible = and(eq(properties.status, 'published'), eq(developments.status, 'published'))

function baseCardQuery() {
  return db()
    .select(cardColumns)
    .from(properties)
    .innerJoin(developments, eq(developments.id, properties.developmentId))
    .leftJoin(coverMedia, eq(coverMedia.id, properties.coverMediaId))
}

type CardRow = Awaited<ReturnType<typeof baseCardQuery>>[number]

function toCard(row: CardRow): PropertyCard {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    propertyType: row.propertyType,
    availability: row.availability,
    featured: row.featured,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    sizeSqm: row.sizeSqm,
    sizeMinSqm: row.sizeMinSqm,
    sizeMaxSqm: row.sizeMaxSqm,
    priceMode: row.priceMode,
    priceAmount: row.priceAmount,
    priceCurrency: row.priceCurrency,
    summary: row.summary,
    updatedAt: new Date(row.updatedAt),
    development: { slug: row.devSlug, name: row.devName, area: row.devArea, city: row.devCity },
    cover:
      row.coverId && row.coverVariants
        ? {
            id: row.coverId,
            alt: row.coverAlt ?? '',
            width: row.coverWidth ?? 0,
            height: row.coverHeight ?? 0,
            variants: row.coverVariants,
            dominantColor: row.coverColor,
          }
        : null,
  }
}

/** Effective size used for filtering/sorting: exact size, else the range bounds. */
const sizeLow = sql`COALESCE(${properties.sizeSqm}, ${properties.sizeMinSqm}, ${properties.sizeMaxSqm})`
const sizeHigh = sql`COALESCE(${properties.sizeSqm}, ${properties.sizeMaxSqm}, ${properties.sizeMinSqm})`

export function buildListingConditions(f: ListingFilters): SQL {
  const conds: (SQL | undefined)[] = [publiclyVisible]
  if (f.q) {
    const pattern = `%${escapeLike(f.q)}%`
    conds.push(
      or(
        ilike(properties.title, pattern),
        ilike(properties.summary, pattern),
        ilike(developments.name, pattern),
        ilike(developments.area, pattern),
      ),
    )
  }
  if (f.type) conds.push(eq(properties.propertyType, f.type))
  if (f.area) conds.push(sql`lower(${developments.area}) = lower(${f.area})`)
  if (f.beds) conds.push(f.beds === '4+' ? gte(properties.bedrooms, 4) : eq(properties.bedrooms, Number(f.beds)))
  if (f.development) conds.push(eq(developments.slug, f.development))
  // Range overlap: a listing matches if any part of its size range is within the requested bounds.
  if (f.minSize) conds.push(sql`${sizeHigh} >= ${f.minSize}`)
  if (f.maxSize) conds.push(sql`${sizeLow} <= ${f.maxSize}`)
  if (f.currency && (f.minPrice || f.maxPrice)) {
    // Price filters only ever match listings that publish a price in the chosen currency.
    conds.push(and(ne(properties.priceMode, 'on_request'), eq(properties.priceCurrency, f.currency)))
    if (f.minPrice) conds.push(gte(properties.priceAmount, String(f.minPrice)))
    if (f.maxPrice) conds.push(lte(properties.priceAmount, String(f.maxPrice)))
  }
  return and(...conds)!
}

function orderFor(sort: ListingFilters['sort']): SQL[] {
  switch (sort) {
    case 'newest':
      return [desc(properties.publishedAt), asc(properties.id)]
    case 'size_asc':
      return [sql`${sizeLow} ASC NULLS LAST`, asc(properties.id)]
    case 'size_desc':
      return [sql`${sizeHigh} DESC NULLS LAST`, asc(properties.id)]
    case 'price_asc':
      return [sql`${properties.priceAmount} ASC NULLS LAST`, asc(properties.id)]
    case 'price_desc':
      return [sql`${properties.priceAmount} DESC NULLS LAST`, asc(properties.id)]
    default:
      return [desc(properties.featured), asc(developments.sortOrder), asc(properties.sortOrder), asc(properties.id)]
  }
}

export type ListingResult = { items: PropertyCard[]; total: number; page: number; pageCount: number }

export async function searchListingsUncached(f: ListingFilters): Promise<ListingResult> {
  const where = buildListingConditions(f)
  const [{ total }] = (await db()
    .select({ total: sql<number>`count(*)::int` })
    .from(properties)
    .innerJoin(developments, eq(developments.id, properties.developmentId))
    .where(where)) as [{ total: number }]
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.min(f.page, pageCount)
  const rows = await baseCardQuery()
    .where(where)
    .orderBy(...orderFor(f.sort))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
  return { items: rows.map(toCard), total, page, pageCount }
}

const searchListingsCached = unstable_cache(searchListingsUncached, ['listings-v1'], {
  tags: [CATALOG_TAG],
  revalidate: REVALIDATE_SECONDS,
})

export function searchListings(f: ListingFilters): Promise<ListingResult> {
  // Free-text queries have unbounded cardinality; don't let them fill the cache.
  return f.q ? searchListingsUncached(f) : searchListingsCached(f)
}

export type ListingFacets = {
  types: { value: PropertyType; count: number }[]
  areas: { value: string; count: number }[]
  bedrooms: { value: number; count: number }[]
  developments: { slug: string; name: string; count: number }[]
  priced: { currency: 'ETB' | 'USD'; count: number; min: number; max: number }[]
  sizeMin: number | null
  sizeMax: number | null
  total: number
}

export const getListingFacets = unstable_cache(
  async (): Promise<ListingFacets> => {
    const rows = await db()
      .select({
        type: properties.propertyType,
        area: developments.area,
        beds: properties.bedrooms,
        devSlug: developments.slug,
        devName: developments.name,
        devSort: developments.sortOrder,
        priceMode: properties.priceMode,
        priceCurrency: properties.priceCurrency,
        priceAmount: properties.priceAmount,
        low: sql<string | null>`${sizeLow}`,
        high: sql<string | null>`${sizeHigh}`,
      })
      .from(properties)
      .innerJoin(developments, eq(developments.id, properties.developmentId))
      .where(publiclyVisible)

    const count = <K>(vals: K[]) => {
      const m = new Map<K, number>()
      for (const v of vals) m.set(v, (m.get(v) ?? 0) + 1)
      return m
    }
    const types = [...count(rows.map((r) => r.type))].map(([value, c]) => ({ value, count: c }))
    const areas = [...count(rows.map((r) => r.area))]
      .map(([value, c]) => ({ value, count: c }))
      .sort((a, b) => a.value.localeCompare(b.value))
    const bedrooms = [...count(rows.filter((r) => r.beds != null).map((r) => r.beds!))]
      .map(([value, c]) => ({ value, count: c }))
      .sort((a, b) => a.value - b.value)
    const devMap = new Map<string, { slug: string; name: string; count: number; sort: number }>()
    for (const r of rows) {
      const e = devMap.get(r.devSlug) ?? { slug: r.devSlug, name: r.devName, count: 0, sort: r.devSort }
      e.count++
      devMap.set(r.devSlug, e)
    }
    const priced = new Map<'ETB' | 'USD', { currency: 'ETB' | 'USD'; count: number; min: number; max: number }>()
    for (const r of rows) {
      if (r.priceMode === 'on_request' || !r.priceCurrency || r.priceAmount == null) continue
      const a = Number(r.priceAmount)
      const e = priced.get(r.priceCurrency) ?? { currency: r.priceCurrency, count: 0, min: a, max: a }
      e.count++
      e.min = Math.min(e.min, a)
      e.max = Math.max(e.max, a)
      priced.set(r.priceCurrency, e)
    }
    const lows = rows.map((r) => (r.low == null ? null : Number(r.low))).filter((v): v is number => v != null)
    const highs = rows.map((r) => (r.high == null ? null : Number(r.high))).filter((v): v is number => v != null)
    return {
      types,
      areas,
      bedrooms,
      developments: [...devMap.values()]
        .sort((a, b) => a.sort - b.sort)
        .map(({ slug, name, count: c }) => ({ slug, name, count: c })),
      priced: [...priced.values()],
      sizeMin: lows.length ? Math.min(...lows) : null,
      sizeMax: highs.length ? Math.max(...highs) : null,
      total: rows.length,
    }
  },
  ['listing-facets-v1'],
  { tags: [CATALOG_TAG], revalidate: REVALIDATE_SECONDS },
)

export const getFeaturedListings = unstable_cache(
  async (limit: number): Promise<PropertyCard[]> => {
    const rows = await baseCardQuery()
      .where(publiclyVisible)
      .orderBy(...orderFor('featured'))
      .limit(limit)
    return rows.map(toCard)
  },
  ['featured-listings-v1'],
  { tags: [CATALOG_TAG], revalidate: REVALIDATE_SECONDS },
)

// ---------------------------------------------------------------------------
// Detail pages
// ---------------------------------------------------------------------------

async function imagesFor(kind: 'property' | 'development', ownerId: string): Promise<PublicImage[]> {
  const t = kind === 'property' ? propertyImages : developmentImages
  const fk = kind === 'property' ? propertyImages.propertyId : developmentImages.developmentId
  const rows = await db()
    .select({
      id: media.id,
      alt: media.alt,
      width: media.width,
      height: media.height,
      variants: media.variants,
      dominantColor: media.dominantColor,
      credit: media.credit,
      caption: t.caption,
      kind: t.kind,
    })
    .from(t)
    .innerJoin(media, eq(media.id, t.mediaId))
    .where(eq(fk, ownerId))
    .orderBy(asc(t.position))
  return rows
}

export type PropertyDetail = Awaited<ReturnType<typeof loadProperty>>

async function loadProperty(slug: string) {
  const rows = await db()
    .select({ p: properties, d: developments })
    .from(properties)
    .innerJoin(developments, eq(developments.id, properties.developmentId))
    .where(and(eq(properties.slug, slug), publiclyVisible))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  const [images, devImages, siblings] = await Promise.all([
    imagesFor('property', row.p.id),
    imagesFor('development', row.d.id),
    baseCardQuery()
      .where(and(publiclyVisible, ne(properties.id, row.p.id), eq(properties.developmentId, row.d.id)))
      .orderBy(...orderFor('featured'))
      .limit(6),
  ])
  // Similar = same development first, then same type and bedroom count elsewhere.
  let similar = siblings.map(toCard)
  if (similar.length < 3) {
    const more = await baseCardQuery()
      .where(
        and(
          publiclyVisible,
          ne(properties.developmentId, row.d.id),
          eq(properties.propertyType, row.p.propertyType),
          row.p.bedrooms == null ? undefined : eq(properties.bedrooms, row.p.bedrooms),
        ),
      )
      .orderBy(...orderFor('featured'))
      .limit(3 - similar.length)
    similar = similar.concat(more.map(toCard))
  }
  const {
    reviewNotes: _pn,
    sourceUrl: _ps,
    verifiedAt: _pv,
    ...property
  } = row.p
  const { reviewNotes: _dn, verifiedAt: _dv, ...development } = row.d
  return {
    property,
    development,
    images: images.length ? images : devImages.filter((i) => i.kind !== 'plan'),
    plans: devImages.filter((i) => i.kind === 'plan'),
    similar: similar.slice(0, 3),
  }
}

const loadPropertyCached = unstable_cache(loadProperty, ['property-detail-v1'], {
  tags: [CATALOG_TAG],
  revalidate: REVALIDATE_SECONDS,
})
/** Request-deduplicated (metadata + page share one call). */
export const getPublicProperty = cache((slug: string) => loadPropertyCached(slug))

async function loadDevelopment(slug: string) {
  const rows = await db()
    .select()
    .from(developments)
    .where(and(eq(developments.slug, slug), eq(developments.status, 'published')))
    .limit(1)
  const d = rows[0]
  if (!d) return null
  const [images, units] = await Promise.all([
    imagesFor('development', d.id),
    baseCardQuery()
      .where(and(publiclyVisible, eq(properties.developmentId, d.id)))
      .orderBy(asc(properties.bedrooms), asc(properties.sortOrder)),
  ])
  const { reviewNotes: _n, verifiedAt: _v, ...development } = d
  return {
    development,
    photos: images.filter((i) => i.kind !== 'plan'),
    plans: images.filter((i) => i.kind === 'plan'),
    units: units.map(toCard),
  }
}

const loadDevelopmentCached = unstable_cache(loadDevelopment, ['development-detail-v1'], {
  tags: [CATALOG_TAG],
  revalidate: REVALIDATE_SECONDS,
})
export const getPublicDevelopment = cache((slug: string) => loadDevelopmentCached(slug))

export type DevelopmentCard = {
  slug: string
  name: string
  tagline: string | null
  summary: string
  area: string
  city: string
  buildingType: 'residential' | 'commercial' | 'mixed_use'
  buildingConfig: string | null
  constructionStage: string
  constructionNote: string | null
  deliveryEstimate: string | null
  unitSizeMin: string | null
  unitSizeMax: string | null
  featured: boolean
  unitCount: number
  propertyTypes: PropertyType[]
  cover: PublicImage | null
}

export const getPublicDevelopments = unstable_cache(
  async (): Promise<DevelopmentCard[]> => {
    const rows = await db()
      .select({
        d: developments,
        coverId: coverMedia.id,
        coverAlt: coverMedia.alt,
        coverWidth: coverMedia.width,
        coverHeight: coverMedia.height,
        coverVariants: coverMedia.variants,
        coverColor: coverMedia.dominantColor,
        unitCount: sql<number>`(SELECT count(*)::int FROM ${properties} p WHERE p.development_id = ${developments.id} AND p.status = 'published')`,
        types: sql<PropertyType[]>`(SELECT coalesce(array_agg(DISTINCT p.property_type), '{}') FROM ${properties} p WHERE p.development_id = ${developments.id} AND p.status = 'published')`,
      })
      .from(developments)
      .leftJoin(coverMedia, eq(coverMedia.id, developments.coverMediaId))
      .where(eq(developments.status, 'published'))
      .orderBy(desc(developments.featured), asc(developments.sortOrder), asc(developments.name))
    return rows.map((r) => ({
      slug: r.d.slug,
      name: r.d.name,
      tagline: r.d.tagline,
      summary: r.d.summary,
      area: r.d.area,
      city: r.d.city,
      buildingType: r.d.buildingType,
      buildingConfig: r.d.buildingConfig,
      constructionStage: r.d.constructionStage,
      constructionNote: r.d.constructionNote,
      deliveryEstimate: r.d.deliveryEstimate,
      unitSizeMin: r.d.unitSizeMin,
      unitSizeMax: r.d.unitSizeMax,
      featured: r.d.featured,
      unitCount: r.unitCount,
      propertyTypes: r.types,
      cover: r.coverId
        ? {
            id: r.coverId,
            alt: r.coverAlt!,
            width: r.coverWidth!,
            height: r.coverHeight!,
            variants: r.coverVariants!,
            dominantColor: r.coverColor,
          }
        : null,
    }))
  },
  ['developments-v1'],
  { tags: [CATALOG_TAG], revalidate: REVALIDATE_SECONDS },
)

/** For sitemap generation. */
export const getSitemapEntries = unstable_cache(
  async () => {
    const [props, devs] = await Promise.all([
      db()
        .select({ slug: properties.slug, updatedAt: properties.updatedAt })
        .from(properties)
        .innerJoin(developments, eq(developments.id, properties.developmentId))
        .where(publiclyVisible),
      db()
        .select({ slug: developments.slug, updatedAt: developments.updatedAt })
        .from(developments)
        .where(eq(developments.status, 'published')),
    ])
    return { properties: props, developments: devs }
  },
  ['sitemap-v1'],
  { tags: [CATALOG_TAG], revalidate: REVALIDATE_SECONDS },
)

/** Options for inquiry forms (published, enquirable subjects only). */
export const getInquirySubjects = unstable_cache(
  async () => {
    const [props, devs] = await Promise.all([
      db()
        .select({ id: properties.id, slug: properties.slug, title: properties.title, devName: developments.name })
        .from(properties)
        .innerJoin(developments, eq(developments.id, properties.developmentId))
        .where(and(publiclyVisible, inArray(properties.availability, ['available', 'limited', 'coming_soon'])))
        .orderBy(asc(developments.sortOrder), asc(properties.sortOrder)),
      db()
        .select({ id: developments.id, slug: developments.slug, name: developments.name })
        .from(developments)
        .where(eq(developments.status, 'published'))
        .orderBy(asc(developments.sortOrder)),
    ])
    return { properties: props, developments: devs }
  },
  ['inquiry-subjects-v1'],
  { tags: [CATALOG_TAG], revalidate: REVALIDATE_SECONDS },
)

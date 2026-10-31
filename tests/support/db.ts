import { sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { developmentImages, developments, media, properties, propertyImages, siteSettings } from '@/lib/db/schema'
import { DEFAULT_SITE_SETTINGS } from '@/lib/content/defaults'

export async function resetDb() {
  await db().execute(sql`TRUNCATE inquiries, rate_limits, sessions, audit_log, property_images, development_images, properties, developments, media, admin_users, site_settings RESTART IDENTITY CASCADE`)
}

let n = 0
export async function makeMedia() {
  n++
  const key = `media/test/${n}-${Date.now()}`
  const [row] = await db()
    .insert(media)
    .values({ storageKey: key, mime: 'image/jpeg', width: 1600, height: 1200, bytes: 1000, variants: [{ width: 480, height: 360, key: `${key}-480.webp`, bytes: 100 }], alt: 'test' })
    .returning({ id: media.id })
  return row!.id
}

type DevInput = Partial<typeof developments.$inferInsert> & { slug: string }
export async function makeDevelopment(d: DevInput) {
  const cover = await makeMedia()
  const [row] = await db()
    .insert(developments)
    .values({ name: d.slug, area: 'Sarbet', buildingType: 'residential', status: 'published', publishedAt: new Date(), summary: 'A development for testing purposes only.', coverMediaId: cover, ...d })
    .returning()
  await db().insert(developmentImages).values({ developmentId: row!.id, mediaId: cover, position: 0, kind: 'render' })
  return row!
}

type PropInput = Partial<typeof properties.$inferInsert> & { slug: string; developmentId: string }
export async function makeProperty(p: PropInput, withImage = true) {
  const cover = withImage ? await makeMedia() : null
  const [row] = await db()
    .insert(properties)
    .values({ title: p.slug, propertyType: 'apartment', status: 'published', publishedAt: new Date(), summary: 'A listing for testing purposes only.', coverMediaId: cover, ...p })
    .returning()
  if (cover) await db().insert(propertyImages).values({ propertyId: row!.id, mediaId: cover, position: 0, kind: 'photo' })
  return row!
}

export async function seedSettings() {
  await db().insert(siteSettings).values(DEFAULT_SITE_SETTINGS).onConflictDoNothing()
}

/** Small realistic catalogue used by listing/search tests. */
export async function seedCatalog() {
  const sarbet = await makeDevelopment({ slug: 'city-plus', name: 'City Plus', area: 'Sarbet', sortOrder: 1, featured: true })
  const ayat = await makeDevelopment({ slug: 'ayat-feres-bet', name: 'Ayat Feres Bet', area: 'Ayat', sortOrder: 2 })
  const piassa = await makeDevelopment({ slug: 'adwa-empire', name: 'Adwa Empire', area: 'Piassa', buildingType: 'commercial', sortOrder: 3 })
  const hidden = await makeDevelopment({ slug: 'hidden-dev', name: 'Hidden', area: 'Gelan', status: 'draft', publishedAt: null })
  const props = {
    cp1: await makeProperty({ slug: 'cp-1br', developmentId: sarbet.id, bedrooms: 1, bathrooms: 1, sizeSqm: '76', featured: true, sortOrder: 1 }),
    cp3: await makeProperty({ slug: 'cp-3br', developmentId: sarbet.id, title: 'City Plus 3BR', bedrooms: 3, bathrooms: 2, sizeSqm: '151', sizeMinSqm: '136', sizeMaxSqm: '151', priceMode: 'fixed', priceAmount: '15000000', priceCurrency: 'ETB', sortOrder: 2 }),
    af2: await makeProperty({ slug: 'af-2br', developmentId: ayat.id, bedrooms: 2, bathrooms: 1, sizeSqm: '86', priceMode: 'fixed', priceAmount: '90000', priceCurrency: 'USD' }),
    af4: await makeProperty({ slug: 'af-4br', developmentId: ayat.id, bedrooms: 4, bathrooms: 3, sizeSqm: '180' }),
    shop: await makeProperty({ slug: 'adwa-shops', developmentId: piassa.id, propertyType: 'shop', sizeMinSqm: '10' }),
    draft: await makeProperty({ slug: 'draft-listing', developmentId: sarbet.id, status: 'draft', publishedAt: null, bedrooms: 2 }),
    inHiddenDev: await makeProperty({ slug: 'in-hidden-dev', developmentId: hidden.id, bedrooms: 2 }),
    sold: await makeProperty({ slug: 'sold-unit', developmentId: sarbet.id, bedrooms: 2, sizeSqm: '100', availability: 'sold_out' }),
  }
  return { devs: { sarbet, ayat, piassa, hidden }, props }
}

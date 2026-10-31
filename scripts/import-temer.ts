/**
 * Bootstraps the catalogue from content/temer/catalog.json (curated from the
 * developer's public website, with provenance and review notes).
 *
 *   pnpm import:catalog            # insert missing records only (safe to re-run)
 *   pnpm import:catalog --update   # also overwrite text fields of existing records
 *
 * Idempotency: media are keyed by source_url (unique), developments/properties by
 * slug (unique); gallery links are only created for entities that have none, so
 * ordering changed in /admin is never clobbered.
 */
import { readFile } from 'node:fs/promises'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { closeDb, db } from '@/lib/db/client'
import { developmentImages, developments, media, properties, propertyImages, siteSettings } from '@/lib/db/schema'
import { DEFAULT_SITE_SETTINGS } from '@/lib/content/defaults'
import { ImageRejectedError, deleteProcessedImage, processImage } from '@/lib/media/process'
import {
  AVAILABILITIES,
  BUILDING_TYPES,
  CONSTRUCTION_STAGES,
  CONTENT_STATUSES,
  IMAGE_KINDS,
  PROPERTY_TYPES,
} from '@/lib/domain'

const ALLOWED_IMAGE_HOST = 'temerproperties.com'
const FETCH_TIMEOUT_MS = 30_000
const CONCURRENCY = 4

const imageSchema = z.object({ url: z.string().url(), kind: z.enum(IMAGE_KINDS), caption: z.string().nullable() })
const num = z.number().positive().nullable().optional()

const catalogSchema = z.object({
  source: z.string().url(),
  retrievedAt: z.string(),
  developments: z.array(
    z.object({
      slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
      name: z.string().min(2),
      status: z.enum(CONTENT_STATUSES),
      featured: z.boolean(),
      sortOrder: z.number().int(),
      tagline: z.string().nullable().optional(),
      summary: z.string(),
      description: z.string(),
      area: z.string(),
      city: z.string(),
      buildingType: z.enum(BUILDING_TYPES),
      buildingConfig: z.string().nullable(),
      constructionStage: z.enum(CONSTRUCTION_STAGES),
      constructionNote: z.string().nullable().optional(),
      deliveryEstimate: z.string().nullable().optional(),
      unitSizeMin: num,
      unitSizeMax: num,
      amenities: z.array(z.string()),
      finishingOptions: z.array(z.string()),
      brochureUrl: z.string().url().nullable(),
      lat: z.number().nullable(),
      lng: z.number().nullable(),
      locationPrecision: z.enum(['exact', 'approximate']).nullable(),
      sourceUrl: z.string().url(),
      reviewNotes: z.string().nullable(),
      images: z.array(imageSchema),
    }),
  ),
  properties: z.array(
    z.object({
      slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
      development: z.string(),
      title: z.string(),
      propertyType: z.enum(PROPERTY_TYPES),
      status: z.enum(CONTENT_STATUSES),
      availability: z.enum(AVAILABILITIES).default('available'),
      featured: z.boolean(),
      sortOrder: z.number().int(),
      bedrooms: z.number().int().nullable(),
      bathrooms: z.number().int().nullable(),
      sizeSqm: num,
      sizeMinSqm: num,
      sizeMaxSqm: num,
      parkingSpaces: z.number().int().nullable(),
      summary: z.string(),
      highlights: z.array(z.string()),
      reviewNotes: z.string().nullable(),
      sourceUrl: z.string().url(),
      images: z.array(imageSchema).nullable(),
    }),
  ),
})

const n = (v: number | null | undefined) => (v == null ? null : String(v))

async function fetchImage(url: string): Promise<Buffer> {
  const u = new URL(url)
  if (u.protocol !== 'https:' || u.hostname !== ALLOWED_IMAGE_HOST) throw new Error(`Refusing to fetch ${url}`)
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(u, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), redirect: 'error' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const len = Number(res.headers.get('content-length') ?? 0)
      if (len > 25 * 1024 * 1024) throw new Error('Remote image too large')
      return Buffer.from(await res.arrayBuffer())
    } catch (err) {
      if (attempt === 3) throw err
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt + Math.random() * 300))
    }
  }
  throw new Error('unreachable')
}

/** Returns media id for a source URL, importing it if needed. Null if the image is unusable. */
async function ensureMedia(url: string, alt: string): Promise<string | null> {
  const existing = await db().select({ id: media.id }).from(media).where(eq(media.sourceUrl, url)).limit(1)
  if (existing[0]) return existing[0].id
  let processed
  try {
    processed = await processImage(await fetchImage(url))
  } catch (err) {
    const reason = err instanceof ImageRejectedError ? err.message : String((err as Error).message ?? err)
    console.warn(JSON.stringify({ level: 'warn', event: 'import.image_skipped', url, reason }))
    return null
  }
  const inserted = await db()
    .insert(media)
    .values({
      storageKey: processed.storageKey,
      mime: processed.mime,
      width: processed.width,
      height: processed.height,
      bytes: processed.bytes,
      variants: processed.variants,
      dominantColor: processed.dominantColor,
      alt,
      credit: '© Temer Properties',
      sourceUrl: url,
      originalFilename: url.split('/').pop() ?? null,
    })
    .onConflictDoNothing({ target: media.sourceUrl })
    .returning({ id: media.id })
  if (inserted[0]) return inserted[0].id
  // Lost a race with a concurrent import: discard our files, use the winner's row.
  await deleteProcessedImage(processed.variants)
  const winner = await db().select({ id: media.id }).from(media).where(eq(media.sourceUrl, url)).limit(1)
  return winner[0]?.id ?? null
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        results[i] = await fn(items[i]!)
      }
    }),
  )
  return results
}

async function main() {
  const update = process.argv.includes('--update')
  const raw = JSON.parse(await readFile(new URL('../content/temer/catalog.json', import.meta.url), 'utf8'))
  const catalog = catalogSchema.parse(raw)

  await db().insert(siteSettings).values(DEFAULT_SITE_SETTINGS).onConflictDoNothing({ target: siteSettings.id })

  // 1. Media (bounded concurrency, idempotent by source URL).
  const altFor = new Map<string, string>()
  for (const d of catalog.developments) for (const img of d.images) altFor.set(img.url, altText(d.name, img))
  for (const p of catalog.properties) for (const img of p.images ?? []) altFor.set(img.url, altText(p.title, img))
  const urls = [...altFor.keys()]
  const ids = await mapLimit(urls, CONCURRENCY, (u) => ensureMedia(u, altFor.get(u)!))
  const mediaByUrl = new Map(urls.map((u, i) => [u, ids[i] ?? null]))
  console.log(JSON.stringify({ level: 'info', event: 'import.media', total: urls.length, usable: ids.filter(Boolean).length }))

  // 2. Developments.
  const now = new Date()
  for (const d of catalog.developments) {
    const firstPhoto = d.images.find((i) => i.kind !== 'plan' && mediaByUrl.get(i.url))
    const values = {
      slug: d.slug,
      name: d.name,
      status: d.status,
      featured: d.featured,
      sortOrder: d.sortOrder,
      tagline: d.tagline ?? null,
      summary: d.summary,
      description: d.description,
      area: d.area,
      city: d.city,
      buildingType: d.buildingType,
      buildingConfig: d.buildingConfig,
      constructionStage: d.constructionStage,
      constructionNote: d.constructionNote ?? null,
      deliveryEstimate: d.deliveryEstimate ?? null,
      unitSizeMin: n(d.unitSizeMin),
      unitSizeMax: n(d.unitSizeMax),
      amenities: d.amenities,
      finishingOptions: d.finishingOptions,
      brochureUrl: d.brochureUrl,
      latitude: d.lat == null ? null : d.lat.toFixed(6),
      longitude: d.lng == null ? null : d.lng.toFixed(6),
      locationPrecision: d.locationPrecision,
      sourceUrl: d.sourceUrl,
      reviewNotes: d.reviewNotes,
      coverMediaId: firstPhoto ? mediaByUrl.get(firstPhoto.url)! : null,
      publishedAt: d.status === 'published' ? now : null,
    }
    const q = db().insert(developments).values(values)
    if (update) {
      const { slug: _slug, publishedAt: _p, ...rest } = values
      await q.onConflictDoUpdate({
        target: developments.slug,
        set: { ...rest, updatedAt: now, version: sql`${developments.version} + 1` },
      })
    } else {
      await q.onConflictDoNothing({ target: developments.slug })
    }
  }
  const devRows = await db().select({ id: developments.id, slug: developments.slug }).from(developments)
  const devId = new Map(devRows.map((r) => [r.slug, r.id]))

  for (const d of catalog.developments) {
    await linkImages('development', devId.get(d.slug)!, d.images, mediaByUrl)
  }

  // 3. Properties (inherit development photos when they have none of their own).
  for (const p of catalog.properties) {
    const dev = catalog.developments.find((d) => d.slug === p.development)
    if (!dev) throw new Error(`Unknown development ${p.development} for ${p.slug}`)
    const imgs = p.images ?? dev.images.filter((i) => i.kind !== 'plan')
    const cover = imgs.find((i) => mediaByUrl.get(i.url))
    const values = {
      slug: p.slug,
      developmentId: devId.get(p.development)!,
      title: p.title,
      propertyType: p.propertyType,
      status: p.status,
      availability: p.availability,
      featured: p.featured,
      sortOrder: p.sortOrder,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      sizeSqm: n(p.sizeSqm),
      sizeMinSqm: n(p.sizeMinSqm),
      sizeMaxSqm: n(p.sizeMaxSqm),
      parkingSpaces: p.parkingSpaces,
      summary: p.summary,
      description: '',
      highlights: p.highlights,
      sourceUrl: p.sourceUrl,
      reviewNotes: p.reviewNotes,
      coverMediaId: cover ? mediaByUrl.get(cover.url)! : null,
      publishedAt: p.status === 'published' ? now : null,
    }
    const q = db().insert(properties).values(values)
    if (update) {
      const { slug: _slug, publishedAt: _p, ...rest } = values
      await q.onConflictDoUpdate({
        target: properties.slug,
        set: { ...rest, updatedAt: now, version: sql`${properties.version} + 1` },
      })
    } else {
      await q.onConflictDoNothing({ target: properties.slug })
    }
    const row = await db().select({ id: properties.id }).from(properties).where(eq(properties.slug, p.slug)).limit(1)
    await linkImages('property', row[0]!.id, imgs, mediaByUrl)
  }

  const counts = await db().execute(
    sql`SELECT (SELECT count(*) FROM developments) AS developments, (SELECT count(*) FROM properties) AS properties, (SELECT count(*) FROM media) AS media`,
  )
  console.log(JSON.stringify({ level: 'info', event: 'import.done', ...counts[0] }))
}

function altText(subject: string, img: { kind: string; caption: string | null }): string {
  if (img.kind === 'plan') return `${img.caption ?? 'Plan'} – ${subject}`
  return img.caption ? `${subject}: ${img.caption.split(';')[0]}` : subject
}

async function linkImages(
  type: 'development' | 'property',
  entityId: string,
  imgs: { url: string; kind: 'photo' | 'render' | 'plan'; caption: string | null }[],
  mediaByUrl: Map<string, string | null>,
) {
  const table = type === 'development' ? developmentImages : propertyImages
  const fk = type === 'development' ? developmentImages.developmentId : propertyImages.propertyId
  const existing = await db().select({ m: table.mediaId }).from(table).where(eq(fk, entityId)).limit(1)
  if (existing.length) return // never clobber curated ordering
  const seen = new Set<string>()
  const rows = imgs
    .map((i) => ({ ...i, mediaId: mediaByUrl.get(i.url) }))
    .filter((i): i is typeof i & { mediaId: string } => Boolean(i.mediaId) && !seen.has(i.mediaId!) && !!seen.add(i.mediaId!))
    .map((i, position) => ({ mediaId: i.mediaId, position, kind: i.kind, caption: i.caption }))
  if (!rows.length) return
  if (type === 'development') {
    await db()
      .insert(developmentImages)
      .values(rows.map((r) => ({ ...r, developmentId: entityId })))
      .onConflictDoNothing()
  } else {
    await db()
      .insert(propertyImages)
      .values(rows.map((r) => ({ ...r, propertyId: entityId })))
      .onConflictDoNothing()
  }
}

main()
  .catch((err) => {
    console.error(JSON.stringify({ level: 'error', event: 'import.failed', message: String(err?.message ?? err) }))
    process.exitCode = 1
  })
  .finally(() => closeDb())


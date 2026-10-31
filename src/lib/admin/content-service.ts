import 'server-only'
import { and, eq, inArray, sql } from 'drizzle-orm'
import type { z } from 'zod'
import { db } from '@/lib/db/client'
import {
  auditLog,
  developmentImages,
  developments,
  inquiries,
  media,
  properties,
  propertyImages,
  siteSettings,
} from '@/lib/db/schema'
import type { InquiryStatus } from '@/lib/domain'
import {
  canTransition,
  type developmentFormSchema,
  type imageListSchema,
  type propertyFormSchema,
  type settingsFormSchema,
} from '@/lib/validation/content'

export class ContentError extends Error {
  constructor(
    message: string,
    readonly fields: Record<string, string> = {},
    readonly code: 'validation' | 'conflict' | 'not_found' = 'validation',
  ) {
    super(message)
  }
}

type Tx = Parameters<Parameters<ReturnType<typeof db>['transaction']>[0]>[0]
type PropertyData = z.output<typeof propertyFormSchema>
type DevelopmentData = z.output<typeof developmentFormSchema>
type SettingsData = z.output<typeof settingsFormSchema>
export type ImageList = z.output<typeof imageListSchema>

const num = (v: number | null) => (v === null ? null : String(v))

function isUniqueViolation(err: unknown, constraint: string): boolean {
  const e = err as { code?: string; constraint_name?: string; cause?: { code?: string; constraint_name?: string } }
  const c = e.cause ?? e
  return c.code === '23505' && (c.constraint_name ?? '').includes(constraint)
}

/** Equality for audit diffs: numeric strings compare by value ("123.00" equals "123"). */
function sameValue(a: unknown, b: unknown): boolean {
  if (typeof a === 'string' && typeof b === 'string' && a !== '' && b !== '' && !Number.isNaN(Number(a)) && !Number.isNaN(Number(b))) {
    return Number(a) === Number(b)
  }
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

async function audit(tx: Tx, actorId: string, action: string, entityType: string, entityId: string, details?: Record<string, unknown>) {
  await tx.insert(auditLog).values({ actorId, action, entityType, entityId, details })
}

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

export async function saveProperty(id: string | null, data: PropertyData, actorId: string): Promise<{ id: string; slug: string; version: number }> {
  try {
    return await db().transaction(async (tx) => {
      const dev = await tx.select({ status: developments.status }).from(developments).where(eq(developments.id, data.developmentId)).limit(1)
      if (!dev[0]) throw new ContentError('Choose a development', { developmentId: 'Development not found' })

      const values = {
        title: data.title,
        slug: data.slug,
        developmentId: data.developmentId,
        propertyType: data.propertyType,
        availability: data.availability,
        featured: data.featured,
        sortOrder: data.sortOrder,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        sizeSqm: num(data.sizeSqm),
        sizeMinSqm: num(data.sizeMinSqm),
        sizeMaxSqm: num(data.sizeMaxSqm),
        parkingSpaces: data.parkingSpaces,
        priceMode: data.priceMode,
        priceAmount: num(data.priceAmount),
        priceCurrency: data.priceCurrency,
        summary: data.summary,
        description: data.description,
        highlights: data.highlights,
        features: data.features,
        seoTitle: data.seoTitle,
        seoDescription: data.seoDescription,
        sourceUrl: data.sourceUrl,
        reviewNotes: data.reviewNotes,
      }

      if (data.status === 'published' && dev[0].status !== 'published') {
        throw new ContentError('Publish the development first; listings in an unpublished development are not visible.', {
          status: 'The selected development is not published',
        })
      }

      if (!id) {
        if (data.status === 'published') {
          throw new ContentError('Save as draft first, add images, then publish.', { status: 'New listings start as drafts' })
        }
        const [row] = await tx
          .insert(properties)
          .values({ ...values, status: data.status })
          .returning({ id: properties.id, slug: properties.slug, version: properties.version })
        await audit(tx, actorId, 'create', 'property', row!.id, { title: data.title })
        return row!
      }

      // Row lock serialises concurrent editors; version check rejects stale forms.
      const current = await tx.select().from(properties).where(eq(properties.id, id)).for('update').limit(1)
      const cur = current[0]
      if (!cur) throw new ContentError('This listing no longer exists.', {}, 'not_found')
      if (cur.version !== data.version) {
        throw new ContentError('Someone else saved this listing after you opened it. Reload to see their changes, then reapply yours.', {}, 'conflict')
      }
      if (!canTransition(cur.status, data.status)) {
        throw new ContentError(`Cannot change status from ${cur.status} to ${data.status}. Move it to draft first.`, { status: 'Invalid status change' })
      }
      if (data.status === 'published') {
        const imgs = await tx.select({ n: sql<number>`count(*)::int` }).from(propertyImages).where(eq(propertyImages.propertyId, id))
        if (!imgs[0]?.n) throw new ContentError('Add at least one image before publishing.', { status: 'No images' })
      }
      const [row] = await tx
        .update(properties)
        .set({
          ...values,
          status: data.status,
          publishedAt: data.status === 'published' ? (cur.publishedAt ?? new Date()) : cur.publishedAt,
          version: cur.version + 1,
          updatedAt: new Date(),
        })
        .where(and(eq(properties.id, id), eq(properties.version, data.version)))
        .returning({ id: properties.id, slug: properties.slug, version: properties.version })
      if (!row) throw new ContentError('This listing changed while saving. Reload and try again.', {}, 'conflict')
      const changed = Object.keys(values).filter((k) => !sameValue((cur as Record<string, unknown>)[k], (values as Record<string, unknown>)[k]))
      await audit(tx, actorId, cur.status !== data.status ? `status:${cur.status}->${data.status}` : 'update', 'property', id, { changed })
      return row
    })
  } catch (err) {
    if (isUniqueViolation(err, 'slug')) throw new ContentError('That URL slug is already used by another listing.', { slug: 'Already in use' })
    throw err
  }
}

// ---------------------------------------------------------------------------
// Developments
// ---------------------------------------------------------------------------

export async function saveDevelopment(id: string | null, data: DevelopmentData, actorId: string): Promise<{ id: string; slug: string; version: number }> {
  const values = {
    name: data.name,
    slug: data.slug,
    featured: data.featured,
    sortOrder: data.sortOrder,
    tagline: data.tagline,
    summary: data.summary,
    description: data.description,
    area: data.area,
    city: data.city,
    addressNote: data.addressNote,
    latitude: data.latitude === null ? null : data.latitude.toFixed(6),
    longitude: data.longitude === null ? null : data.longitude.toFixed(6),
    locationPrecision: data.locationPrecision,
    buildingType: data.buildingType,
    buildingConfig: data.buildingConfig,
    constructionStage: data.constructionStage,
    constructionNote: data.constructionNote,
    deliveryEstimate: data.deliveryEstimate,
    unitSizeMin: num(data.unitSizeMin),
    unitSizeMax: num(data.unitSizeMax),
    amenities: data.amenities,
    finishingOptions: data.finishingOptions,
    brochureUrl: data.brochureUrl,
    priceMode: data.priceMode,
    priceAmount: num(data.priceAmount),
    priceCurrency: data.priceCurrency,
    seoTitle: data.seoTitle,
    seoDescription: data.seoDescription,
    sourceUrl: data.sourceUrl,
    reviewNotes: data.reviewNotes,
  }
  try {
    return await db().transaction(async (tx) => {
      if (!id) {
        if (data.status === 'published') throw new ContentError('Save as draft first, add images, then publish.', { status: 'New developments start as drafts' })
        const [row] = await tx.insert(developments).values({ ...values, status: data.status }).returning({ id: developments.id, slug: developments.slug, version: developments.version })
        await audit(tx, actorId, 'create', 'development', row!.id, { name: data.name })
        return row!
      }
      const current = await tx.select().from(developments).where(eq(developments.id, id)).for('update').limit(1)
      const cur = current[0]
      if (!cur) throw new ContentError('This development no longer exists.', {}, 'not_found')
      if (cur.version !== data.version) {
        throw new ContentError('Someone else saved this development after you opened it. Reload and reapply your changes.', {}, 'conflict')
      }
      if (!canTransition(cur.status, data.status)) {
        throw new ContentError(`Cannot change status from ${cur.status} to ${data.status}. Move it to draft first.`, { status: 'Invalid status change' })
      }
      if (data.status === 'published') {
        const imgs = await tx.select({ n: sql<number>`count(*)::int` }).from(developmentImages).where(eq(developmentImages.developmentId, id))
        if (!imgs[0]?.n) throw new ContentError('Add at least one image before publishing.', { status: 'No images' })
      }
      const [row] = await tx
        .update(developments)
        .set({
          ...values,
          status: data.status,
          publishedAt: data.status === 'published' ? (cur.publishedAt ?? new Date()) : cur.publishedAt,
          version: cur.version + 1,
          updatedAt: new Date(),
        })
        .where(and(eq(developments.id, id), eq(developments.version, data.version)))
        .returning({ id: developments.id, slug: developments.slug, version: developments.version })
      if (!row) throw new ContentError('This development changed while saving. Reload and try again.', {}, 'conflict')
      await audit(tx, actorId, cur.status !== data.status ? `status:${cur.status}->${data.status}` : 'update', 'development', id)
      return row
    })
  } catch (err) {
    if (isUniqueViolation(err, 'slug')) throw new ContentError('That URL slug is already used by another development.', { slug: 'Already in use' })
    throw err
  }
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

/** Replaces an entity's gallery (order, captions, kinds) and cover atomically. */
export async function saveImages(
  entity: 'property' | 'development',
  ownerId: string,
  list: ImageList,
  coverMediaId: string | null,
  actorId: string,
): Promise<void> {
  await db().transaction(async (tx) => {
    const owner =
      entity === 'property'
        ? await tx.select({ status: properties.status }).from(properties).where(eq(properties.id, ownerId)).for('update').limit(1)
        : await tx.select({ status: developments.status }).from(developments).where(eq(developments.id, ownerId)).for('update').limit(1)
    if (!owner[0]) throw new ContentError('Not found', {}, 'not_found')
    if (owner[0].status === 'published' && !list.some((i) => i.kind !== 'plan')) {
      throw new ContentError('A published item needs at least one photo or render. Unpublish it first to remove all images.')
    }
    if (list.length) {
      const found = await tx.select({ id: media.id }).from(media).where(inArray(media.id, list.map((i) => i.mediaId)))
      if (found.length !== list.length) throw new ContentError('One or more images no longer exist. Reload the page.')
    }
    const cover = coverMediaId && list.some((i) => i.mediaId === coverMediaId && i.kind !== 'plan') ? coverMediaId : (list.find((i) => i.kind !== 'plan')?.mediaId ?? null)

    if (entity === 'property') {
      await tx.delete(propertyImages).where(eq(propertyImages.propertyId, ownerId))
      if (list.length) await tx.insert(propertyImages).values(list.map((i, position) => ({ propertyId: ownerId, mediaId: i.mediaId, position, kind: i.kind, caption: i.caption })))
      await tx.update(properties).set({ coverMediaId: cover, updatedAt: new Date() }).where(eq(properties.id, ownerId))
    } else {
      await tx.delete(developmentImages).where(eq(developmentImages.developmentId, ownerId))
      if (list.length) await tx.insert(developmentImages).values(list.map((i, position) => ({ developmentId: ownerId, mediaId: i.mediaId, position, kind: i.kind, caption: i.caption })))
      await tx.update(developments).set({ coverMediaId: cover, updatedAt: new Date() }).where(eq(developments.id, ownerId))
    }
    for (const i of list) await tx.update(media).set({ alt: i.alt }).where(eq(media.id, i.mediaId))
    await audit(tx, actorId, 'images', entity, ownerId, { count: list.length })
  })
}

/** Appends newly uploaded media to the end of a gallery. */
export async function appendImages(entity: 'property' | 'development', ownerId: string, mediaIds: string[]): Promise<void> {
  if (!mediaIds.length) return
  await db().transaction(async (tx) => {
    const t = entity === 'property' ? propertyImages : developmentImages
    const fk = entity === 'property' ? propertyImages.propertyId : developmentImages.developmentId
    // Lock the owner row so concurrent uploads get distinct positions.
    if (entity === 'property') await tx.select({ id: properties.id }).from(properties).where(eq(properties.id, ownerId)).for('update')
    else await tx.select({ id: developments.id }).from(developments).where(eq(developments.id, ownerId)).for('update')
    const [{ max }] = (await tx.select({ max: sql<number>`coalesce(max(${t.position}), -1)::int` }).from(t).where(eq(fk, ownerId))) as [{ max: number }]
    const rows = mediaIds.map((mediaId, k) => ({ mediaId, position: max + 1 + k, kind: 'photo' as const, caption: null }))
    if (entity === 'property') await tx.insert(propertyImages).values(rows.map((r) => ({ ...r, propertyId: ownerId })))
    else await tx.insert(developmentImages).values(rows.map((r) => ({ ...r, developmentId: ownerId })))
    // First image of an entity without a cover becomes the cover.
    if (entity === 'property') {
      await tx.update(properties).set({ coverMediaId: sql`coalesce(${properties.coverMediaId}, ${mediaIds[0]}::uuid)` }).where(eq(properties.id, ownerId))
    } else {
      await tx.update(developments).set({ coverMediaId: sql`coalesce(${developments.coverMediaId}, ${mediaIds[0]}::uuid)` }).where(eq(developments.id, ownerId))
    }
  })
}

// ---------------------------------------------------------------------------
// Inquiries & settings
// ---------------------------------------------------------------------------

export async function updateInquiry(id: string, status: InquiryStatus, adminNotes: string | null, actorId: string): Promise<void> {
  await db().transaction(async (tx) => {
    const res = await tx
      .update(inquiries)
      .set({ status, adminNotes, updatedAt: new Date() })
      .where(eq(inquiries.id, id))
      .returning({ id: inquiries.id })
    if (!res.length) throw new ContentError('Inquiry not found', {}, 'not_found')
    await audit(tx, actorId, `inquiry:${status}`, 'inquiry', id)
  })
}

export async function saveSettings(data: SettingsData, actorId: string): Promise<number> {
  const { version, facebook, instagram, telegramChannel, tiktok, linkedin, youtube, ...rest } = data
  const social = Object.fromEntries(
    Object.entries({ facebook, instagram, telegram: telegramChannel, tiktok, linkedin, youtube }).filter(([, v]) => v),
  ) as Record<string, string>
  await db().transaction(async (tx) => {
    const res = await tx
      .update(siteSettings)
      .set({ ...rest, social, version: version + 1, updatedAt: new Date() })
      .where(and(eq(siteSettings.id, 1), eq(siteSettings.version, version)))
      .returning({ id: siteSettings.id })
    if (!res.length) throw new ContentError('Settings were changed by someone else. Reload and try again.', {}, 'conflict')
    await audit(tx, actorId, 'update', 'settings', '1')
  })
  return version + 1
}

export async function setSettingsImage(field: 'realtorPhotoMediaId' | 'heroMediaId', mediaId: string | null, actorId: string): Promise<void> {
  await db().transaction(async (tx) => {
    await tx.update(siteSettings).set({ [field]: mediaId, updatedAt: new Date(), version: sql`${siteSettings.version} + 1` }).where(eq(siteSettings.id, 1))
    await audit(tx, actorId, `settings:${field}`, 'settings', '1', { mediaId })
  })
}

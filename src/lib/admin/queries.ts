import 'server-only'
import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { developmentImages, developments, inquiries, media, properties, propertyImages, siteSettings } from '@/lib/db/schema'
import type { ContentStatus, InquiryStatus } from '@/lib/domain'
import { escapeLike } from '@/lib/listing-filters'

export async function dashboardStats() {
  const [row] = (await db().execute(sql`
    SELECT
      (SELECT count(*)::int FROM inquiries WHERE status = 'new') AS new_inquiries,
      (SELECT count(*)::int FROM inquiries WHERE created_at > now() - interval '7 days' AND status <> 'spam') AS inquiries_7d,
      (SELECT count(*)::int FROM inquiries WHERE delivery_status = 'failed') AS failed_deliveries,
      (SELECT count(*)::int FROM properties WHERE status = 'published') AS published_properties,
      (SELECT count(*)::int FROM properties WHERE status = 'draft') AS draft_properties,
      (SELECT count(*)::int FROM developments WHERE status = 'published') AS published_developments,
      (SELECT count(*)::int FROM properties WHERE review_notes IS NOT NULL AND status <> 'archived') AS needs_review
  `)) as unknown as [Record<string, number>]
  return row
}

export async function listInquiries(opts: { status?: InquiryStatus; q?: string; page: number; pageSize?: number }) {
  const pageSize = opts.pageSize ?? 25
  const conds = []
  if (opts.status) conds.push(eq(inquiries.status, opts.status))
  else conds.push(sql`${inquiries.status} <> 'spam'`)
  if (opts.q) {
    const p = `%${escapeLike(opts.q)}%`
    conds.push(or(ilike(inquiries.name, p), ilike(inquiries.email, p), ilike(inquiries.phone, p), ilike(inquiries.reference, p), ilike(inquiries.subjectLabel, p)))
  }
  const where = and(...conds)
  const [{ total }] = (await db().select({ total: sql<number>`count(*)::int` }).from(inquiries).where(where)) as [{ total: number }]
  const rows = await db()
    .select({
      id: inquiries.id,
      reference: inquiries.reference,
      type: inquiries.type,
      name: inquiries.name,
      subjectLabel: inquiries.subjectLabel,
      preferredDate: inquiries.preferredDate,
      status: inquiries.status,
      deliveryStatus: inquiries.deliveryStatus,
      createdAt: inquiries.createdAt,
    })
    .from(inquiries)
    .where(where)
    .orderBy(desc(inquiries.createdAt))
    .limit(pageSize)
    .offset((opts.page - 1) * pageSize)
  return { rows, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) }
}

export async function getInquiry(id: string) {
  const rows = await db().select().from(inquiries).where(eq(inquiries.id, id)).limit(1)
  const i = rows[0]
  if (!i) return null
  const [prop, dev] = await Promise.all([
    i.propertyId ? db().select({ slug: properties.slug, title: properties.title }).from(properties).where(eq(properties.id, i.propertyId)).limit(1) : [],
    i.developmentId ? db().select({ slug: developments.slug, name: developments.name }).from(developments).where(eq(developments.id, i.developmentId)).limit(1) : [],
  ])
  return { inquiry: i, property: prop[0] ?? null, development: dev[0] ?? null }
}

export async function listAdminProperties(opts: { status?: ContentStatus; q?: string }) {
  const conds = []
  if (opts.status) conds.push(eq(properties.status, opts.status))
  if (opts.q) {
    const p = `%${escapeLike(opts.q)}%`
    conds.push(or(ilike(properties.title, p), ilike(developments.name, p), ilike(properties.slug, p)))
  }
  return db()
    .select({
      id: properties.id,
      slug: properties.slug,
      title: properties.title,
      status: properties.status,
      availability: properties.availability,
      featured: properties.featured,
      devName: developments.name,
      devStatus: developments.status,
      reviewNotes: properties.reviewNotes,
      updatedAt: properties.updatedAt,
      coverKey: sql<string | null>`(${media.variants}->0->>'key')`,
    })
    .from(properties)
    .innerJoin(developments, eq(developments.id, properties.developmentId))
    .leftJoin(media, eq(media.id, properties.coverMediaId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(developments.sortOrder), asc(properties.sortOrder), asc(properties.title))
}

export async function listAdminDevelopments() {
  return db()
    .select({
      id: developments.id,
      slug: developments.slug,
      name: developments.name,
      area: developments.area,
      status: developments.status,
      featured: developments.featured,
      reviewNotes: developments.reviewNotes,
      updatedAt: developments.updatedAt,
      units: sql<number>`(SELECT count(*)::int FROM properties p WHERE p.development_id = ${developments.id})`,
      coverKey: sql<string | null>`(${media.variants}->0->>'key')`,
    })
    .from(developments)
    .leftJoin(media, eq(media.id, developments.coverMediaId))
    .orderBy(asc(developments.sortOrder), asc(developments.name))
}

export async function developmentOptions() {
  return db().select({ id: developments.id, name: developments.name, status: developments.status }).from(developments).orderBy(asc(developments.name))
}

export type AdminImage = {
  mediaId: string
  kind: 'photo' | 'render' | 'plan'
  caption: string | null
  alt: string
  thumbKey: string
  width: number
  height: number
}

export async function entityImages(entity: 'property' | 'development', id: string): Promise<AdminImage[]> {
  const t = entity === 'property' ? propertyImages : developmentImages
  const fk = entity === 'property' ? propertyImages.propertyId : developmentImages.developmentId
  const rows = await db()
    .select({ mediaId: t.mediaId, kind: t.kind, caption: t.caption, alt: media.alt, variants: media.variants, width: media.width, height: media.height })
    .from(t)
    .innerJoin(media, eq(media.id, t.mediaId))
    .where(eq(fk, id))
    .orderBy(asc(t.position))
  return rows.map((r) => ({ mediaId: r.mediaId, kind: r.kind, caption: r.caption, alt: r.alt, thumbKey: r.variants[0]!.key, width: r.width, height: r.height }))
}

export async function getAdminProperty(id: string) {
  const rows = await db().select().from(properties).where(eq(properties.id, id)).limit(1)
  return rows[0] ?? null
}

export async function getAdminDevelopment(id: string) {
  const rows = await db().select().from(developments).where(eq(developments.id, id)).limit(1)
  return rows[0] ?? null
}

export async function getAdminSettings() {
  const rows = await db().select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1)
  return rows[0] ?? null
}

export async function mediaThumb(id: string | null) {
  if (!id) return null
  const rows = await db().select({ variants: media.variants }).from(media).where(eq(media.id, id)).limit(1)
  return rows[0]?.variants[0]?.key ?? null
}

import 'server-only'
import { createHash, randomInt } from 'node:crypto'
import { and, eq, or } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { developments, inquiries, properties } from '@/lib/db/schema'
import { ENQUIRABLE_AVAILABILITIES } from '@/lib/domain'
import { CONSENT_VERSION, addisToday, type InquiryInput } from '@/lib/validation/inquiry'

export class InquiryRejectedError extends Error {
  constructor(
    message: string,
    readonly fields?: Record<string, string>,
    readonly status = 422,
  ) {
    super(message)
  }
}

export type CreateInquiryContext = { ipHash: string | null; userAgent: string | null; now?: Date }
export type CreateInquiryResult = { id: string; reference: string; created: boolean }

const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no 0/O/1/I/L confusion

export function generateReference(): string {
  let s = ''
  for (let i = 0; i < 6; i++) s += REF_ALPHABET[randomInt(REF_ALPHABET.length)]
  return `INQ-${s}`
}

/**
 * Content fingerprint scoped to one calendar day (Addis time): the same person
 * submitting the same request again from a fresh form is treated as a duplicate.
 */
export function inquiryFingerprint(input: InquiryInput, subjectId: string | null, now: Date = new Date()): string {
  const parts = [
    input.type,
    subjectId ?? '',
    (input.email ?? '').toLowerCase(),
    input.phone ?? '',
    input.preferredDate ?? '',
    input.message.replace(/\s+/g, ' ').trim().toLowerCase(),
    addisToday(now),
  ]
  return createHash('sha256').update(parts.join('␟')).digest('hex')
}

async function resolveSubject(input: InquiryInput) {
  if (input.propertySlug) {
    const rows = await db()
      .select({
        id: properties.id,
        title: properties.title,
        availability: properties.availability,
        developmentId: developments.id,
        devName: developments.name,
      })
      .from(properties)
      .innerJoin(developments, eq(developments.id, properties.developmentId))
      .where(and(eq(properties.slug, input.propertySlug), eq(properties.status, 'published'), eq(developments.status, 'published')))
      .limit(1)
    const p = rows[0]
    if (!p) throw new InquiryRejectedError('This listing is no longer available.', { propertySlug: 'This listing is no longer available' })
    if (!ENQUIRABLE_AVAILABILITIES.includes(p.availability)) {
      throw new InquiryRejectedError('This listing is no longer taking inquiries.', {
        propertySlug: 'This listing is no longer taking inquiries',
      })
    }
    return { propertyId: p.id, developmentId: p.developmentId, label: p.title }
  }
  if (input.developmentSlug) {
    const rows = await db()
      .select({ id: developments.id, name: developments.name })
      .from(developments)
      .where(and(eq(developments.slug, input.developmentSlug), eq(developments.status, 'published')))
      .limit(1)
    const d = rows[0]
    if (!d) throw new InquiryRejectedError('This development is not available.', { developmentSlug: 'This development is not available' })
    return { propertyId: null, developmentId: d.id, label: d.name }
  }
  return { propertyId: null, developmentId: null, label: null }
}

/**
 * Persists an inquiry exactly once per (idempotency key) and per (content, day).
 * Concurrency-safe: uniqueness is enforced by database constraints, not by a
 * prior SELECT, so racing duplicate requests resolve to the same row.
 */
export async function createInquiry(input: InquiryInput, ctx: CreateInquiryContext): Promise<CreateInquiryResult> {
  const now = ctx.now ?? new Date()
  const subject = await resolveSubject(input)
  const fingerprint = inquiryFingerprint(input, subject.propertyId ?? subject.developmentId, now)

  for (let attempt = 0; attempt < 3; attempt++) {
    const reference = generateReference()
    const inserted = await db()
      .insert(inquiries)
      .values({
        reference,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
        type: input.type,
        propertyId: subject.propertyId,
        developmentId: subject.developmentId,
        subjectLabel: subject.label,
        name: input.name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        preferredContact: input.preferredContact,
        preferredDate: input.preferredDate ?? null,
        preferredWindow: input.preferredWindow ?? null,
        message: input.message,
        consentAt: now,
        consentVersion: CONSENT_VERSION,
        sourcePath: input.sourcePath ?? null,
        ipHash: ctx.ipHash,
        userAgent: ctx.userAgent?.slice(0, 300) ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .returning({ id: inquiries.id, reference: inquiries.reference })
    if (inserted[0]) return { ...inserted[0], created: true }

    // Conflict: either a duplicate (idempotency key / fingerprint) or, very rarely, a reference collision.
    const existing = await db()
      .select({ id: inquiries.id, reference: inquiries.reference, fingerprint: inquiries.fingerprint, key: inquiries.idempotencyKey })
      .from(inquiries)
      .where(or(eq(inquiries.idempotencyKey, input.idempotencyKey), eq(inquiries.fingerprint, fingerprint)))
      .limit(1)
    const row = existing[0]
    if (row) {
      if (row.key === input.idempotencyKey && row.fingerprint !== fingerprint) {
        // Same key, different content: a client bug or tampering; never merge silently.
        throw new InquiryRejectedError('This form was already submitted. Please reload the page to send a new request.', undefined, 409)
      }
      return { id: row.id, reference: row.reference, created: false }
    }
    // Reference collision: retry with a new reference.
  }
  throw new Error('Could not allocate an inquiry reference')
}

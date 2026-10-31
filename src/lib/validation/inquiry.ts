import { z } from 'zod'
import { CONTACT_METHODS, INQUIRY_TYPES, VIEWING_WINDOWS } from '@/lib/domain'

/**
 * Inquiry validation shared by the browser form (instant feedback) and the API
 * (authoritative). Server-side parsing is the security boundary.
 */
export const CONSENT_VERSION = '2026-10-v1'
export const VIEWING_HORIZON_DAYS = 180
export const MIN_FILL_MS = 2500

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
// Strip control characters (incl. CR/LF, which matter for email headers).
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim()
const oneLine = (s: string) => clean(s).replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ')

/** Today's date in Addis Ababa as YYYY-MM-DD. */
export function addisToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Addis_Ababa' }).format(now)
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function validateViewingDate(value: string, now: Date = new Date()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Choose a date'
  const d = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return 'Choose a valid date'
  const today = addisToday(now)
  if (value <= today) return 'Choose a date from tomorrow onwards'
  if (value > addDays(today, VIEWING_HORIZON_DAYS)) return 'Choose a date within the next 6 months'
  if (d.getUTCDay() === 0) return 'Site viewings are not available on Sundays'
  return null
}

export function normalizePhone(raw: string): string {
  const s = raw.replace(/[^\d+]/g, '')
  if (s.startsWith('+')) return s
  if (s.startsWith('00')) return `+${s.slice(2)}`
  if (/^0[79]\d{8}$/.test(s)) return `+251${s.slice(1)}` // Ethiopian mobile, e.g. 0911…, 0711…
  if (/^[79]\d{8}$/.test(s)) return `+251${s}`
  return s
}

export const inquiryInputSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    type: z.enum(INQUIRY_TYPES),
    propertySlug: z.string().max(120).regex(SLUG).optional(),
    developmentSlug: z.string().max(120).regex(SLUG).optional(),
    name: z
      .string()
      .transform(oneLine)
      .pipe(z.string().min(2, 'Please enter your name').max(100, 'Name is too long')),
    email: z
      .string()
      .transform((s) => oneLine(s).toLowerCase())
      .pipe(z.union([z.literal(''), z.string().email('Enter a valid email address').max(254)]))
      .optional()
      .transform((v) => v || undefined),
    phone: z
      .string()
      .transform(oneLine)
      .pipe(
        z.union([
          z.literal(''),
          z
            .string()
            .max(24, 'Phone number is too long')
            .regex(/^\+?[\d\s()-]{7,24}$/, 'Enter a valid phone number')
            .refine((v) => v.replace(/\D/g, '').length >= 9, 'Enter a valid phone number'),
        ]),
      )
      .optional()
      .transform((v) => (v ? normalizePhone(v) : undefined)),
    preferredContact: z.enum(CONTACT_METHODS),
    preferredDate: z
      .string()
      .optional()
      .transform((v) => v || undefined),
    preferredWindow: z
      .enum(VIEWING_WINDOWS)
      .or(z.literal(''))
      .optional()
      .transform((v) => v || undefined),
    message: z
      .string()
      .transform(clean)
      .pipe(z.string().max(2000, 'Message is too long (2,000 characters max)'))
      .optional()
      .transform((v) => v ?? ''),
    consent: z.literal(true, { error: 'Please confirm you agree to be contacted' }),
    /** Honeypot: hidden from people, often filled by bots. */
    website: z.string().max(200).optional(),
    /** Milliseconds between form render and submit (bot heuristic). */
    elapsedMs: z.number().int().nonnegative().max(86_400_000 * 7).optional(),
    turnstileToken: z.string().max(4096).optional(),
    sourcePath: z.string().max(300).regex(/^\//).optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.email && !v.phone) {
      ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Enter a phone number or an email address' })
    }
    if (v.preferredContact === 'email' && !v.email) {
      ctx.addIssue({ code: 'custom', path: ['email'], message: 'Enter an email address to be contacted by email' })
    }
    if (v.preferredContact !== 'email' && !v.phone) {
      ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Enter a phone number for this contact method' })
    }
    if (v.type === 'property' && !v.propertySlug) {
      ctx.addIssue({ code: 'custom', path: ['propertySlug'], message: 'Choose a property' })
    }
    if (v.type === 'development' && !v.developmentSlug) {
      ctx.addIssue({ code: 'custom', path: ['developmentSlug'], message: 'Choose a development' })
    }
    if (v.type === 'viewing') {
      const err = v.preferredDate ? validateViewingDate(v.preferredDate) : 'Choose a preferred date'
      if (err) ctx.addIssue({ code: 'custom', path: ['preferredDate'], message: err })
      if (!v.propertySlug && !v.developmentSlug) {
        ctx.addIssue({ code: 'custom', path: ['propertySlug'], message: 'Choose what you would like to view' })
      }
    } else if (v.preferredDate) {
      ctx.addIssue({ code: 'custom', path: ['preferredDate'], message: 'A date only applies to viewing requests' })
    }
    if (v.type === 'general' && v.message.length < 10) {
      ctx.addIssue({ code: 'custom', path: ['message'], message: 'Tell me a little about what you are looking for' })
    }
  })

export type InquiryInput = z.infer<typeof inquiryInputSchema>

/** Flattens zod issues into { field: firstMessage } for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form')
    if (!out[key]) out[key] = issue.message
  }
  return out
}

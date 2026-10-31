import { z } from 'zod'
import {
  AVAILABILITIES,
  BUILDING_TYPES,
  CONSTRUCTION_STAGES,
  CONTENT_STATUSES,
  CURRENCIES,
  IMAGE_KINDS,
  PRICE_MODES,
  PROPERTY_TYPES,
  type ContentStatus,
} from '@/lib/domain'

const text = (max: number) => z.string().trim().max(max)
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null))
const optNumber = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null
      const n = Number(v.replace(/,/g, ''))
      if (!Number.isFinite(n) || n < min || n > max) {
        ctx.addIssue({ code: 'custom', message: `${label} must be between ${min} and ${max}` })
        return z.NEVER
      }
      return n
    })
const optInt = (min: number, max: number, label: string) =>
  optNumber(min, max, label).refine((v) => v === null || Number.isInteger(v), `${label} must be a whole number`)
/** Textarea → array, one item per line. */
const lines = (maxItems: number) =>
  z
    .string()
    .optional()
    .transform((v) =>
      (v ?? '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, maxItems),
    )
    .pipe(z.array(z.string().max(160, 'Each line must be 160 characters or fewer')))
const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(100)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens')
const httpsUrl = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^https:\/\/[^\s]+$/.test(v), 'Must be an https:// URL')

const priceFields = {
  priceMode: z.enum(PRICE_MODES),
  priceAmount: optNumber(1, 1e13, 'Price'),
  priceCurrency: z
    .enum(CURRENCIES)
    .or(z.literal(''))
    .optional()
    .transform((v) => v || null),
}

function refinePrice(v: { priceMode: string; priceAmount: number | null; priceCurrency: string | null }, ctx: z.RefinementCtx) {
  if (v.priceMode === 'on_request') {
    if (v.priceAmount !== null || v.priceCurrency !== null) {
      ctx.addIssue({ code: 'custom', path: ['priceAmount'], message: 'Clear the amount and currency, or choose a price type other than “On request”' })
    }
  } else {
    if (v.priceAmount === null) ctx.addIssue({ code: 'custom', path: ['priceAmount'], message: 'Enter the price amount' })
    if (v.priceCurrency === null) ctx.addIssue({ code: 'custom', path: ['priceCurrency'], message: 'Choose the currency (prices are never converted)' })
  }
}

export const propertyFormSchema = z
  .object({
    version: z.coerce.number().int().min(0),
    title: text(140).min(5, 'Title is required'),
    slug,
    developmentId: z.string().uuid('Choose a development'),
    propertyType: z.enum(PROPERTY_TYPES),
    status: z.enum(CONTENT_STATUSES),
    availability: z.enum(AVAILABILITIES),
    featured: z.literal('on').optional().transform(Boolean),
    sortOrder: optInt(-10000, 10000, 'Sort order').transform((v) => v ?? 0),
    bedrooms: optInt(0, 20, 'Bedrooms'),
    bathrooms: optInt(0, 20, 'Bathrooms'),
    sizeSqm: optNumber(1, 100000, 'Size'),
    sizeMinSqm: optNumber(1, 100000, 'Minimum size'),
    sizeMaxSqm: optNumber(1, 100000, 'Maximum size'),
    parkingSpaces: optInt(0, 50, 'Parking spaces'),
    ...priceFields,
    summary: text(400),
    description: text(8000),
    highlights: lines(12),
    features: lines(30),
    seoTitle: optText(70),
    seoDescription: optText(170),
    sourceUrl: httpsUrl,
    reviewNotes: optText(4000),
  })
  .superRefine((v, ctx) => {
    refinePrice(v, ctx)
    if (v.sizeMinSqm !== null && v.sizeMaxSqm !== null && v.sizeMinSqm > v.sizeMaxSqm) {
      ctx.addIssue({ code: 'custom', path: ['sizeMaxSqm'], message: 'Maximum must be greater than minimum' })
    }
    if (v.status === 'published') {
      if (v.summary.length < 20) ctx.addIssue({ code: 'custom', path: ['summary'], message: 'A summary of at least 20 characters is required to publish' })
      if (v.propertyType !== 'shop' && v.bedrooms === null) ctx.addIssue({ code: 'custom', path: ['bedrooms'], message: 'Bedrooms are required to publish a residential listing' })
      if (v.sizeSqm === null && v.sizeMinSqm === null) ctx.addIssue({ code: 'custom', path: ['sizeSqm'], message: 'A size (or size range) is required to publish' })
    }
  })

export const developmentFormSchema = z
  .object({
    version: z.coerce.number().int().min(0),
    name: text(120).min(2, 'Name is required'),
    slug,
    status: z.enum(CONTENT_STATUSES),
    featured: z.literal('on').optional().transform(Boolean),
    sortOrder: optInt(-10000, 10000, 'Sort order').transform((v) => v ?? 0),
    tagline: optText(140),
    summary: text(500),
    description: text(10000),
    area: text(60).min(2, 'Area is required'),
    city: text(60).min(2, 'City is required'),
    addressNote: optText(200),
    latitude: optNumber(-90, 90, 'Latitude'),
    longitude: optNumber(-180, 180, 'Longitude'),
    locationPrecision: z
      .enum(['exact', 'approximate'])
      .or(z.literal(''))
      .optional()
      .transform((v) => v || null),
    buildingType: z.enum(BUILDING_TYPES),
    buildingConfig: optText(60),
    constructionStage: z.enum(CONSTRUCTION_STAGES),
    constructionNote: optText(160),
    deliveryEstimate: optText(120),
    unitSizeMin: optNumber(1, 100000, 'Minimum unit size'),
    unitSizeMax: optNumber(1, 100000, 'Maximum unit size'),
    amenities: lines(40),
    finishingOptions: lines(6),
    brochureUrl: httpsUrl,
    ...priceFields,
    seoTitle: optText(70),
    seoDescription: optText(170),
    sourceUrl: httpsUrl,
    reviewNotes: optText(4000),
  })
  .superRefine((v, ctx) => {
    refinePrice(v, ctx)
    if ((v.latitude === null) !== (v.longitude === null)) {
      ctx.addIssue({ code: 'custom', path: ['longitude'], message: 'Enter both latitude and longitude, or neither' })
    }
    if (v.latitude !== null && v.locationPrecision === null) {
      ctx.addIssue({ code: 'custom', path: ['locationPrecision'], message: 'Say whether the pin is exact or approximate' })
    }
    if (v.latitude === null && v.locationPrecision !== null) {
      ctx.addIssue({ code: 'custom', path: ['locationPrecision'], message: 'Remove the precision or add coordinates' })
    }
    if (v.unitSizeMin !== null && v.unitSizeMax !== null && v.unitSizeMin > v.unitSizeMax) {
      ctx.addIssue({ code: 'custom', path: ['unitSizeMax'], message: 'Maximum must be greater than minimum' })
    }
    if (v.status === 'published' && v.summary.length < 20) {
      ctx.addIssue({ code: 'custom', path: ['summary'], message: 'A summary of at least 20 characters is required to publish' })
    }
  })

export const settingsFormSchema = z.object({
  version: z.coerce.number().int().min(0),
  brandName: text(60).min(2),
  brandTagline: optText(80),
  realtorName: optText(100),
  realtorTitle: optText(120),
  realtorBio: optText(1500),
  phone: optText(24).refine((v) => v === null || /^\+?[\d\s()-]{7,24}$/.test(v), 'Enter a valid phone number'),
  whatsapp: optText(24).refine((v) => v === null || /^\+?[\d\s()-]{7,24}$/.test(v), 'Enter a valid WhatsApp number'),
  email: optText(254).refine((v) => v === null || z.string().email().safeParse(v).success, 'Enter a valid email'),
  telegram: optText(64),
  officeAddress: optText(200),
  officeHours: optText(120),
  relationshipStatement: text(800).min(40, 'Explain your relationship with the developer (at least 40 characters)'),
  developerName: text(80).min(2),
  developerWebsite: httpsUrl,
  developerPhone: optText(24),
  developerHotline: optText(10),
  developerEmail: optText(254),
  developerAddress: optText(200),
  heroHeadline: text(120).min(5),
  heroSubheadline: optText(400),
  facebook: httpsUrl,
  instagram: httpsUrl,
  telegramChannel: httpsUrl,
  tiktok: httpsUrl,
  linkedin: httpsUrl,
  youtube: httpsUrl,
})

export const imageListSchema = z
  .array(
    z.object({
      mediaId: z.string().uuid(),
      kind: z.enum(IMAGE_KINDS),
      caption: z
        .string()
        .trim()
        .max(200)
        .nullable()
        .transform((v) => v || null),
      alt: z.string().trim().max(200),
    }),
  )
  .max(60)
  .refine((arr) => new Set(arr.map((a) => a.mediaId)).size === arr.length, 'Duplicate images')

/** Allowed content status transitions (archived must go back through draft before republishing). */
export const STATUS_TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  draft: ['draft', 'published', 'archived'],
  published: ['published', 'draft', 'archived'],
  archived: ['archived', 'draft'],
}

export function canTransition(from: ContentStatus, to: ContentStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to)
}

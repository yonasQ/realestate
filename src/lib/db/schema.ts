import { sql } from 'drizzle-orm'
import {
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import type {
  AdminRole,
  Availability,
  BuildingType,
  ConstructionStage,
  ContactMethod,
  ContentStatus,
  Currency,
  DeliveryStatus,
  ImageKind,
  InquiryStatus,
  InquiryType,
  PriceMode,
  PropertyType,
} from '@/lib/domain'

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}

/** Responsive variant generated from an uploaded original. */
export type MediaVariant = { width: number; height: number; key: string; bytes: number }

export const media = pgTable(
  'media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storageKey: text('storage_key').notNull(),
    originalFilename: text('original_filename'),
    mime: text('mime').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    bytes: integer('bytes').notNull(),
    variants: jsonb('variants').$type<MediaVariant[]>().notNull(),
    dominantColor: text('dominant_color'),
    alt: text('alt').notNull().default(''),
    credit: text('credit'),
    /** Where an imported asset came from; unique so imports are idempotent. */
    sourceUrl: text('source_url'),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('media_storage_key_uq').on(t.storageKey),
    uniqueIndex('media_source_url_uq').on(t.sourceUrl),
    check('media_dimensions_ck', sql`${t.width} > 0 AND ${t.height} > 0 AND ${t.bytes} > 0`),
  ],
)

const priceColumns = {
  priceMode: text('price_mode').$type<PriceMode>().notNull().default('on_request'),
  priceAmount: numeric('price_amount', { precision: 16, scale: 2 }),
  priceCurrency: text('price_currency').$type<Currency>(),
}

const seoColumns = {
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  ogMediaId: uuid('og_media_id').references(() => media.id, { onDelete: 'set null' }),
}

const provenanceColumns = {
  /** Public page the facts were taken from (developer website, brochure…). */
  sourceUrl: text('source_url'),
  /** Internal notes about unverified or conflicting facts. Never rendered publicly. */
  reviewNotes: text('review_notes'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
}

export const developments = pgTable(
  'developments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    status: text('status').$type<ContentStatus>().notNull().default('draft'),
    featured: boolean('featured').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    tagline: text('tagline'),
    summary: text('summary').notNull().default(''),
    description: text('description').notNull().default(''),
    area: text('area').notNull(),
    city: text('city').notNull().default('Addis Ababa'),
    addressNote: text('address_note'),
    latitude: numeric('latitude', { precision: 9, scale: 6 }),
    longitude: numeric('longitude', { precision: 9, scale: 6 }),
    locationPrecision: text('location_precision').$type<'exact' | 'approximate'>(),
    buildingType: text('building_type').$type<BuildingType>().notNull(),
    buildingConfig: text('building_config'),
    constructionStage: text('construction_stage').$type<ConstructionStage>().notNull().default('not_confirmed'),
    constructionNote: text('construction_note'),
    deliveryEstimate: text('delivery_estimate'),
    unitSizeMin: numeric('unit_size_min', { precision: 8, scale: 2 }),
    unitSizeMax: numeric('unit_size_max', { precision: 8, scale: 2 }),
    amenities: text('amenities').array().notNull().default(sql`'{}'::text[]`),
    finishingOptions: text('finishing_options').array().notNull().default(sql`'{}'::text[]`),
    brochureUrl: text('brochure_url'),
    ...priceColumns,
    coverMediaId: uuid('cover_media_id').references(() => media.id, { onDelete: 'set null' }),
    ...seoColumns,
    ...provenanceColumns,
    version: integer('version').notNull().default(1),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('developments_slug_uq').on(t.slug),
    index('developments_public_idx').on(t.status, t.featured, t.sortOrder),
    check('developments_status_ck', sql`${t.status} IN ('draft','published','archived')`),
    check('developments_building_type_ck', sql`${t.buildingType} IN ('residential','commercial','mixed_use')`),
    check(
      'developments_stage_ck',
      sql`${t.constructionStage} IN ('not_confirmed','pre_construction','excavation','structure','finishing','completed','on_hold')`,
    ),
    check('developments_slug_ck', sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check(
      'developments_coords_ck',
      sql`(${t.latitude} IS NULL) = (${t.longitude} IS NULL) AND (${t.latitude} IS NULL) = (${t.locationPrecision} IS NULL)`,
    ),
    check(
      'developments_lat_lng_range_ck',
      sql`${t.latitude} IS NULL OR (${t.latitude} BETWEEN -90 AND 90 AND ${t.longitude} BETWEEN -180 AND 180)`,
    ),
    check(
      'developments_size_range_ck',
      sql`${t.unitSizeMin} IS NULL OR ${t.unitSizeMax} IS NULL OR ${t.unitSizeMin} <= ${t.unitSizeMax}`,
    ),
    check(
      'developments_price_ck',
      sql`(${t.priceMode} = 'on_request' AND ${t.priceAmount} IS NULL AND ${t.priceCurrency} IS NULL)
        OR (${t.priceMode} IN ('fixed','from','per_sqm_from') AND ${t.priceAmount} IS NOT NULL AND ${t.priceAmount} > 0 AND ${t.priceCurrency} IS NOT NULL AND ${t.priceCurrency} IN ('ETB','USD'))`,
    ),
    check('developments_published_at_ck', sql`${t.status} <> 'published' OR ${t.publishedAt} IS NOT NULL`),
  ],
)

export const properties = pgTable(
  'properties',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    developmentId: uuid('development_id')
      .notNull()
      .references(() => developments.id, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    propertyType: text('property_type').$type<PropertyType>().notNull(),
    status: text('status').$type<ContentStatus>().notNull().default('draft'),
    availability: text('availability').$type<Availability>().notNull().default('available'),
    featured: boolean('featured').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    bedrooms: smallint('bedrooms'),
    bathrooms: smallint('bathrooms'),
    sizeSqm: numeric('size_sqm', { precision: 8, scale: 2 }),
    sizeMinSqm: numeric('size_min_sqm', { precision: 8, scale: 2 }),
    sizeMaxSqm: numeric('size_max_sqm', { precision: 8, scale: 2 }),
    parkingSpaces: smallint('parking_spaces'),
    ...priceColumns,
    summary: text('summary').notNull().default(''),
    description: text('description').notNull().default(''),
    highlights: text('highlights').array().notNull().default(sql`'{}'::text[]`),
    features: text('features').array().notNull().default(sql`'{}'::text[]`),
    coverMediaId: uuid('cover_media_id').references(() => media.id, { onDelete: 'set null' }),
    ...seoColumns,
    ...provenanceColumns,
    version: integer('version').notNull().default(1),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('properties_slug_uq').on(t.slug),
    index('properties_development_idx').on(t.developmentId),
    index('properties_public_idx').on(t.status, t.featured, t.sortOrder),
    index('properties_filter_idx').on(t.status, t.propertyType, t.bedrooms),
    check('properties_status_ck', sql`${t.status} IN ('draft','published','archived')`),
    check(
      'properties_type_ck',
      sql`${t.propertyType} IN ('apartment','shop','office','penthouse','townhouse','villa')`,
    ),
    check(
      'properties_availability_ck',
      sql`${t.availability} IN ('available','limited','reserved','sold_out','coming_soon','on_hold')`,
    ),
    check('properties_slug_ck', sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check('properties_bedrooms_ck', sql`${t.bedrooms} IS NULL OR ${t.bedrooms} BETWEEN 0 AND 20`),
    check('properties_bathrooms_ck', sql`${t.bathrooms} IS NULL OR ${t.bathrooms} BETWEEN 0 AND 20`),
    check('properties_parking_ck', sql`${t.parkingSpaces} IS NULL OR ${t.parkingSpaces} BETWEEN 0 AND 50`),
    check(
      'properties_size_ck',
      sql`(${t.sizeSqm} IS NULL OR ${t.sizeSqm} > 0)
        AND (${t.sizeMinSqm} IS NULL OR ${t.sizeMinSqm} > 0)
        AND (${t.sizeMinSqm} IS NULL OR ${t.sizeMaxSqm} IS NULL OR ${t.sizeMinSqm} <= ${t.sizeMaxSqm})`,
    ),
    check(
      'properties_price_ck',
      sql`(${t.priceMode} = 'on_request' AND ${t.priceAmount} IS NULL AND ${t.priceCurrency} IS NULL)
        OR (${t.priceMode} IN ('fixed','from','per_sqm_from') AND ${t.priceAmount} IS NOT NULL AND ${t.priceAmount} > 0 AND ${t.priceCurrency} IS NOT NULL AND ${t.priceCurrency} IN ('ETB','USD'))`,
    ),
    check('properties_published_at_ck', sql`${t.status} <> 'published' OR ${t.publishedAt} IS NOT NULL`),
  ],
)

const imageLinkColumns = {
  mediaId: uuid('media_id')
    .notNull()
    .references(() => media.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  kind: text('kind').$type<ImageKind>().notNull().default('photo'),
  caption: text('caption'),
}

export const propertyImages = pgTable(
  'property_images',
  {
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    ...imageLinkColumns,
  },
  (t) => [
    primaryKey({ columns: [t.propertyId, t.mediaId] }),
    uniqueIndex('property_images_position_uq').on(t.propertyId, t.position),
    index('property_images_media_idx').on(t.mediaId),
    check('property_images_kind_ck', sql`${t.kind} IN ('photo','render','plan')`),
    check('property_images_position_ck', sql`${t.position} >= 0`),
  ],
)

export const developmentImages = pgTable(
  'development_images',
  {
    developmentId: uuid('development_id')
      .notNull()
      .references(() => developments.id, { onDelete: 'cascade' }),
    ...imageLinkColumns,
  },
  (t) => [
    primaryKey({ columns: [t.developmentId, t.mediaId] }),
    uniqueIndex('development_images_position_uq').on(t.developmentId, t.position),
    index('development_images_media_idx').on(t.mediaId),
    check('development_images_kind_ck', sql`${t.kind} IN ('photo','render','plan')`),
    check('development_images_position_ck', sql`${t.position} >= 0`),
  ],
)

export const inquiries = pgTable(
  'inquiries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reference: text('reference').notNull(),
    /** Client-generated per form instance: retries of the same submission are no-ops. */
    idempotencyKey: uuid('idempotency_key').notNull(),
    /** Hash of normalized content + day: blocks identical re-submissions from new form instances. */
    fingerprint: text('fingerprint').notNull(),
    type: text('type').$type<InquiryType>().notNull(),
    propertyId: uuid('property_id').references(() => properties.id, { onDelete: 'set null' }),
    developmentId: uuid('development_id').references(() => developments.id, { onDelete: 'set null' }),
    /** Snapshot of what the visitor was looking at, in case the listing later changes. */
    subjectLabel: text('subject_label'),
    name: text('name').notNull(),
    email: text('email'),
    phone: text('phone'),
    preferredContact: text('preferred_contact').$type<ContactMethod>().notNull(),
    preferredDate: date('preferred_date'),
    preferredWindow: text('preferred_window'),
    message: text('message').notNull().default(''),
    consentAt: timestamp('consent_at', { withTimezone: true }).notNull(),
    consentVersion: text('consent_version').notNull(),
    sourcePath: text('source_path'),
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),
    status: text('status').$type<InquiryStatus>().notNull().default('new'),
    adminNotes: text('admin_notes'),
    deliveryStatus: text('delivery_status').$type<DeliveryStatus>().notNull().default('pending'),
    deliveryAttempts: integer('delivery_attempts').notNull().default(0),
    deliveryNextAttemptAt: timestamp('delivery_next_attempt_at', { withTimezone: true }).defaultNow(),
    deliveryLockedUntil: timestamp('delivery_locked_until', { withTimezone: true }),
    deliveryLastError: text('delivery_last_error'),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    /** Per-channel completion so a retry never re-sends a channel that already succeeded. */
    emailSentAt: timestamp('email_sent_at', { withTimezone: true }),
    webhookSentAt: timestamp('webhook_sent_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('inquiries_reference_uq').on(t.reference),
    uniqueIndex('inquiries_idempotency_key_uq').on(t.idempotencyKey),
    uniqueIndex('inquiries_fingerprint_uq').on(t.fingerprint),
    index('inquiries_inbox_idx').on(t.status, t.createdAt),
    index('inquiries_delivery_idx').on(t.deliveryStatus, t.deliveryNextAttemptAt),
    index('inquiries_property_idx').on(t.propertyId),
    index('inquiries_development_idx').on(t.developmentId),
    check('inquiries_type_ck', sql`${t.type} IN ('general','property','development','viewing')`),
    check('inquiries_status_ck', sql`${t.status} IN ('new','contacted','viewing_scheduled','closed','spam')`),
    check(
      'inquiries_delivery_status_ck',
      sql`${t.deliveryStatus} IN ('pending','processing','delivered','failed','skipped')`,
    ),
    check('inquiries_contact_ck', sql`${t.email} IS NOT NULL OR ${t.phone} IS NOT NULL`),
    check('inquiries_contact_method_ck', sql`${t.preferredContact} IN ('phone','whatsapp','email','telegram')`),
    check('inquiries_viewing_ck', sql`${t.type} <> 'viewing' OR ${t.preferredDate} IS NOT NULL`),
  ],
)

export const adminUsers = pgTable(
  'admin_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role').$type<AdminRole>().notNull().default('editor'),
    failedLoginCount: integer('failed_login_count').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('admin_users_email_uq').on(sql`lower(${t.email})`),
    check('admin_users_role_ck', sql`${t.role} IN ('admin','editor')`),
  ],
)

export const sessions = pgTable(
  'sessions',
  {
    /** SHA-256 of the opaque cookie token; the raw token is never stored. */
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sessions_user_idx').on(t.userId), index('sessions_expires_idx').on(t.expiresAt)],
)

export const rateLimits = pgTable(
  'rate_limits',
  {
    bucket: text('bucket').notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.bucket, t.windowStart] }), index('rate_limits_window_idx').on(t.windowStart)],
)

export type SocialLinks = Partial<
  Record<'facebook' | 'instagram' | 'telegram' | 'tiktok' | 'linkedin' | 'youtube' | 'x', string>
>

export const siteSettings = pgTable(
  'site_settings',
  {
    id: smallint('id').primaryKey().default(1),
    brandName: text('brand_name').notNull(),
    brandTagline: text('brand_tagline'),
    realtorName: text('realtor_name'),
    realtorTitle: text('realtor_title'),
    realtorBio: text('realtor_bio'),
    realtorPhotoMediaId: uuid('realtor_photo_media_id').references(() => media.id, { onDelete: 'set null' }),
    phone: text('phone'),
    whatsapp: text('whatsapp'),
    email: text('email'),
    telegram: text('telegram'),
    officeAddress: text('office_address'),
    officeHours: text('office_hours'),
    relationshipStatement: text('relationship_statement').notNull(),
    developerName: text('developer_name').notNull(),
    developerWebsite: text('developer_website'),
    developerPhone: text('developer_phone'),
    developerHotline: text('developer_hotline'),
    developerEmail: text('developer_email'),
    developerAddress: text('developer_address'),
    social: jsonb('social').$type<SocialLinks>().notNull().default({}),
    heroHeadline: text('hero_headline').notNull(),
    heroSubheadline: text('hero_subheadline'),
    heroMediaId: uuid('hero_media_id').references(() => media.id, { onDelete: 'set null' }),
    version: integer('version').notNull().default(1),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('site_settings_singleton_ck', sql`${t.id} = 1`)],
)

export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    actorId: uuid('actor_id').references(() => adminUsers.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    details: jsonb('details').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_log_entity_idx').on(t.entityType, t.entityId), index('audit_log_created_idx').on(t.createdAt)],
)

export type Media = typeof media.$inferSelect
export type Development = typeof developments.$inferSelect
export type Property = typeof properties.$inferSelect
export type Inquiry = typeof inquiries.$inferSelect
export type AdminUser = typeof adminUsers.$inferSelect
export type SiteSettings = typeof siteSettings.$inferSelect
export type ImageLink = { mediaId: string; position: number; kind: ImageKind; caption: string | null }

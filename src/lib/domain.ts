/**
 * Domain vocabulary shared by the database schema, validation, UI and tests.
 * Keep labels customer-facing and factual.
 */

export const CONTENT_STATUSES = ['draft', 'published', 'archived'] as const
export type ContentStatus = (typeof CONTENT_STATUSES)[number]

export const PROPERTY_TYPES = ['apartment', 'shop', 'office', 'penthouse', 'townhouse', 'villa'] as const
export type PropertyType = (typeof PROPERTY_TYPES)[number]
export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  apartment: 'Apartment',
  shop: 'Commercial shop',
  office: 'Office',
  penthouse: 'Penthouse',
  townhouse: 'Townhouse',
  villa: 'Villa',
}
export const PROPERTY_TYPE_PLURAL: Record<PropertyType, string> = {
  apartment: 'Apartments',
  shop: 'Commercial shops',
  office: 'Offices',
  penthouse: 'Penthouses',
  townhouse: 'Townhouses',
  villa: 'Villas',
}

export const AVAILABILITIES = ['available', 'limited', 'reserved', 'sold_out', 'coming_soon', 'on_hold'] as const
export type Availability = (typeof AVAILABILITIES)[number]
export const AVAILABILITY_LABELS: Record<Availability, string> = {
  available: 'Available',
  limited: 'Limited units',
  reserved: 'Reserved',
  sold_out: 'Sold out',
  coming_soon: 'Coming soon',
  on_hold: 'On hold',
}
/** Availabilities that can still receive purchase inquiries. */
export const ENQUIRABLE_AVAILABILITIES: readonly Availability[] = ['available', 'limited', 'coming_soon']

export const CURRENCIES = ['ETB', 'USD'] as const
export type Currency = (typeof CURRENCIES)[number]

export const PRICE_MODES = ['on_request', 'fixed', 'from', 'per_sqm_from'] as const
export type PriceMode = (typeof PRICE_MODES)[number]

export const BUILDING_TYPES = ['residential', 'commercial', 'mixed_use'] as const
export type BuildingType = (typeof BUILDING_TYPES)[number]
export const BUILDING_TYPE_LABELS: Record<BuildingType, string> = {
  residential: 'Residential',
  commercial: 'Commercial',
  mixed_use: 'Mixed use',
}

export const CONSTRUCTION_STAGES = [
  'not_confirmed',
  'pre_construction',
  'excavation',
  'structure',
  'finishing',
  'completed',
  'on_hold',
] as const
export type ConstructionStage = (typeof CONSTRUCTION_STAGES)[number]
export const CONSTRUCTION_STAGE_LABELS: Record<ConstructionStage, string> = {
  not_confirmed: 'Status to be confirmed',
  pre_construction: 'Pre-construction',
  excavation: 'Excavation',
  structure: 'Structural works',
  finishing: 'Finishing works',
  completed: 'Completed',
  on_hold: 'On hold',
}

export const IMAGE_KINDS = ['photo', 'render', 'plan'] as const
export type ImageKind = (typeof IMAGE_KINDS)[number]

export const INQUIRY_TYPES = ['general', 'property', 'development', 'viewing'] as const
export type InquiryType = (typeof INQUIRY_TYPES)[number]
export const INQUIRY_TYPE_LABELS: Record<InquiryType, string> = {
  general: 'General inquiry',
  property: 'Property inquiry',
  development: 'Development inquiry',
  viewing: 'Viewing request',
}

export const CONTACT_METHODS = ['phone', 'whatsapp', 'email', 'telegram'] as const
export type ContactMethod = (typeof CONTACT_METHODS)[number]
export const CONTACT_METHOD_LABELS: Record<ContactMethod, string> = {
  phone: 'Phone call',
  whatsapp: 'WhatsApp',
  email: 'Email',
  telegram: 'Telegram',
}

export const VIEWING_WINDOWS = ['morning', 'midday', 'afternoon'] as const
export type ViewingWindow = (typeof VIEWING_WINDOWS)[number]
export const VIEWING_WINDOW_LABELS: Record<ViewingWindow, string> = {
  morning: 'Morning (8:30 – 11:30)',
  midday: 'Midday (11:30 – 14:00)',
  afternoon: 'Afternoon (14:00 – 17:00)',
}

export const INQUIRY_STATUSES = ['new', 'contacted', 'viewing_scheduled', 'closed', 'spam'] as const
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number]
export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  viewing_scheduled: 'Viewing scheduled',
  closed: 'Closed',
  spam: 'Spam',
}

export const DELIVERY_STATUSES = ['pending', 'processing', 'delivered', 'failed', 'skipped'] as const
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number]

export const ADMIN_ROLES = ['admin', 'editor'] as const
export type AdminRole = (typeof ADMIN_ROLES)[number]

export const BEDROOM_FILTERS = ['1', '2', '3', '4+'] as const

export const SORTS = ['featured', 'newest', 'size_asc', 'size_desc', 'price_asc', 'price_desc'] as const
export type Sort = (typeof SORTS)[number]
export const SORT_LABELS: Record<Sort, string> = {
  featured: 'Featured first',
  newest: 'Newest listings',
  size_asc: 'Size: smallest first',
  size_desc: 'Size: largest first',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
}

export const PAGE_SIZE = 12

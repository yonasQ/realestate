import type { PublicSettings } from '@/lib/queries/settings'
import type { Availability } from '@/lib/domain'
import { absoluteUrl } from '@/lib/seo/site'

export const ORG_ID = () => `${absoluteUrl('/')}#organization`
export const WEBSITE_ID = () => `${absoluteUrl('/')}#website`

const CTX = 'https://schema.org'

/** schema.org availability for an Offer; a sold or held unit must not be advertised as in stock. */
export function offerAvailability(a: Availability): string {
  switch (a) {
    case 'available':
      return 'https://schema.org/InStock'
    case 'limited':
      return 'https://schema.org/LimitedAvailability'
    case 'coming_soon':
      return 'https://schema.org/PreOrder'
    case 'sold_out':
      return 'https://schema.org/SoldOut'
    default:
      return 'https://schema.org/OutOfStock'
  }
}

function compact<T extends Record<string, unknown>>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')) as T
}

/** Site-wide entities: the realtor business and the website (with sitelinks search action). */
export function siteGraph(s: PublicSettings, logoUrl?: string) {
  const sameAs = Object.values(s.social ?? {}).filter((u): u is string => typeof u === 'string' && /^https?:\/\//.test(u))
  const org = compact({
    '@type': 'RealEstateAgent',
    '@id': ORG_ID(),
    name: s.brandName,
    description: s.brandTagline ?? undefined,
    url: absoluteUrl('/'),
    logo: logoUrl,
    image: logoUrl,
    telephone: s.phone ?? undefined,
    email: s.email ?? undefined,
    address: s.officeAddress
      ? { '@type': 'PostalAddress', streetAddress: s.officeAddress, addressLocality: 'Addis Ababa', addressCountry: 'ET' }
      : undefined,
    areaServed: { '@type': 'City', name: 'Addis Ababa' },
    openingHours: s.officeHours ?? undefined,
    sameAs: sameAs.length ? sameAs : undefined,
  })
  const website = {
    '@type': 'WebSite',
    '@id': WEBSITE_ID(),
    url: absoluteUrl('/'),
    name: s.brandName,
    publisher: { '@id': ORG_ID() },
    inLanguage: 'en',
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${absoluteUrl('/properties')}?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  }
  return { '@context': CTX, '@graph': [org, website] }
}

export function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    '@context': CTX,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: absoluteUrl(it.path) })),
  }
}

export function itemList(name: string, items: { name: string; path: string }[]) {
  return {
    '@context': CTX,
    '@type': 'ItemList',
    name,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, url: absoluteUrl(it.path), name: it.name })),
  }
}

export function webPage(type: 'CollectionPage' | 'AboutPage' | 'ContactPage', name: string, path: string, description: string) {
  return {
    '@context': CTX,
    '@type': type,
    name,
    description,
    url: absoluteUrl(path),
    isPartOf: { '@id': WEBSITE_ID() },
    about: { '@id': ORG_ID() },
    inLanguage: 'en',
  }
}

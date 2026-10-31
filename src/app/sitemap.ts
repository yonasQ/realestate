import type { MetadataRoute } from 'next'
import { connection } from 'next/server'
import { serializeListingFilters } from '@/lib/listing-filters'
import { getListingFacets, getSitemapEntries } from '@/lib/queries/catalog'
import { absoluteUrl } from '@/lib/seo/site'


export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection()
  const [{ properties, developments }, facets] = await Promise.all([getSitemapEntries(), getListingFacets()])
  // Canonical, indexable category views (see properties page: type / area only).
  const categories = [
    ...facets.types.map((t) => serializeListingFilters({ type: t.value })),
    ...facets.areas.map((a) => serializeListingFilters({ area: a.value })),
  ].map((qs) => ({ url: absoluteUrl(`/properties?${qs}`), changeFrequency: 'weekly' as const, priority: 0.6 }))
  const staticPages = ['/', '/properties', '/developments', '/about', '/contact', '/privacy', '/terms'].map((p) => ({
    url: absoluteUrl(p),
    changeFrequency: (p === '/' || p === '/properties' ? 'daily' : 'monthly') as 'daily' | 'monthly',
    priority: p === '/' ? 1 : p === '/properties' || p === '/developments' ? 0.9 : 0.4,
  }))
  return [
    ...staticPages,
    ...categories,
    ...developments.map((d) => ({ url: absoluteUrl(`/developments/${d.slug}`), lastModified: new Date(d.updatedAt), changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...properties.map((p) => ({ url: absoluteUrl(`/properties/${p.slug}`), lastModified: new Date(p.updatedAt), changeFrequency: 'weekly' as const, priority: 0.7 })),
  ]
}

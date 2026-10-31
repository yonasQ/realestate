import type { MetadataRoute } from 'next'
import { connection } from 'next/server'
import { getSitemapEntries } from '@/lib/queries/catalog'
import { absoluteUrl } from '@/lib/seo/site'


export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection()
  const { properties, developments } = await getSitemapEntries()
  const staticPages = ['/', '/properties', '/developments', '/about', '/contact', '/privacy', '/terms'].map((p) => ({
    url: absoluteUrl(p),
    changeFrequency: (p === '/' || p === '/properties' ? 'daily' : 'monthly') as 'daily' | 'monthly',
    priority: p === '/' ? 1 : p === '/properties' || p === '/developments' ? 0.9 : 0.4,
  }))
  return [
    ...staticPages,
    ...developments.map((d) => ({ url: absoluteUrl(`/developments/${d.slug}`), lastModified: new Date(d.updatedAt), changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...properties.map((p) => ({ url: absoluteUrl(`/properties/${p.slug}`), lastModified: new Date(p.updatedAt), changeFrequency: 'weekly' as const, priority: 0.7 })),
  ]
}

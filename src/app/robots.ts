import type { MetadataRoute } from 'next'
import { connection } from 'next/server'
import { absoluteUrl } from '@/lib/seo/site'

export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection() // evaluate at runtime, not with build-time env
  // Non-production deployments (staging, previews) must never be indexed.
  const production = process.env.NODE_ENV === 'production' && process.env.SITE_URL?.startsWith('https://') && process.env.ALLOW_INDEXING !== 'false'
  if (!production) return { rules: { userAgent: '*', disallow: '/' } }
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] },
    sitemap: absoluteUrl('/sitemap.xml'),
  }
}

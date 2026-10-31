import type { Metadata } from 'next'
import { mediaUrl } from '@/components/ui/ResponsiveImage'
import type { PublicImage } from '@/lib/queries/catalog'
import { absoluteUrl } from '@/lib/seo/site'

/** Best share-card variant: the smallest one at least 1200px wide, else the largest available. */
export function shareImage(image: PublicImage | null | undefined) {
  if (!image) return undefined
  const v = image.variants.filter((x) => x.width >= 1200).sort((a, b) => a.width - b.width)[0] ?? image.variants.at(-1)
  if (!v) return undefined
  return { url: absoluteUrl(mediaUrl(v.key)), width: v.width, height: v.height, alt: image.alt }
}

type PageMeta = {
  title: string
  description: string
  /** Canonical path, optionally with a query string. */
  path: string
  siteName: string
  image?: PublicImage | null
  type?: 'website' | 'article'
  noindex?: boolean
}

/**
 * One place that builds title/description/canonical plus matching Open Graph and Twitter
 * cards. Next replaces (not merges) `openGraph`/`twitter` per segment, so every page must
 * supply the complete set or it loses siteName/locale from the root layout.
 */
export function pageMetadata(m: PageMeta): Metadata {
  // Pages without a photo fall back to the generated brand card so social previews are never text-only.
  const img = shareImage(m.image) ?? { url: absoluteUrl('/og'), width: 1200, height: 630, alt: m.siteName }
  return {
    title: m.title,
    description: m.description,
    alternates: { canonical: m.path },
    robots: m.noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      type: m.type ?? 'website',
      title: m.title,
      description: m.description,
      url: absoluteUrl(m.path),
      siteName: m.siteName,
      locale: 'en_ET',
      images: [img],
    },
    twitter: {
      card: 'summary_large_image',
      title: m.title,
      description: m.description,
      images: [img.url],
    },
  }
}

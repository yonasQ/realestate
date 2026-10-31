import type { PublicImage } from '@/lib/queries/catalog'

type Props = {
  image: PublicImage
  sizes: string
  className?: string
  /** Above-the-fold images: eager load with high fetch priority. */
  priority?: boolean
  alt?: string
  /** Fill the parent (parent must be positioned and sized). */
  fill?: boolean
}

export function mediaUrl(key: string): string {
  return `/${key}`
}

/**
 * Renders pre-generated WebP variants with srcset. Width/height attributes are
 * always set (aspect-ratio reservation → no layout shift); the dominant colour
 * paints the box while the image loads.
 */
export function ResponsiveImage({ image, sizes, className = '', priority = false, alt, fill = false }: Props) {
  const variants = [...image.variants].sort((a, b) => a.width - b.width)
  const largest = variants[variants.length - 1]
  if (!largest) return null
  const fallback = variants.find((v) => v.width >= 960) ?? largest
  return (
    // eslint-disable-next-line @next/next/no-img-element -- variants are pre-optimised; next/image optimizer intentionally disabled
    <img
      src={mediaUrl(fallback.key)}
      srcSet={variants.map((v) => `${mediaUrl(v.key)} ${v.width}w`).join(', ')}
      sizes={sizes}
      width={largest.width}
      height={largest.height}
      alt={alt ?? image.alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      fetchPriority={priority ? 'high' : 'auto'}
      style={{ backgroundColor: image.dominantColor ?? '#e9e1d3' }}
      className={`${fill ? 'absolute inset-0 h-full w-full object-cover' : ''} ${className}`.trim()}
    />
  )
}

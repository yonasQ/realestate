import Link from 'next/link'
import { Icon } from '@/components/ui/Icon'
import { ResponsiveImage } from '@/components/ui/ResponsiveImage'
import { AVAILABILITY_LABELS, PROPERTY_TYPE_LABELS } from '@/lib/domain'
import { formatPrice, formatSize } from '@/lib/format'
import type { PropertyCard as Card } from '@/lib/queries/catalog'

export function PropertyCard({ property: p, priority = false, sizes }: { property: Card; priority?: boolean; sizes?: string }) {
  const size = formatSize(p)
  const price = formatPrice(p)
  return (
    <article className="group relative flex flex-col bg-paper shadow-[0_0_0_1px_var(--color-line)] transition-shadow duration-300 hover:shadow-[0_0_0_1px_var(--color-line),0_18px_40px_-24px_rgb(29_28_26/0.45)]">
      <div className="img-zoom relative aspect-[4/3] overflow-hidden bg-sand">
        {p.cover ? (
          <ResponsiveImage
            image={p.cover}
            fill
            priority={priority}
            sizes={sizes ?? '(min-width: 1280px) 400px, (min-width: 768px) 50vw, 100vw'}
            alt=""
          />
        ) : (
          <div className="flex h-full items-center justify-center text-stone"><Icon name="building" size={40} /></div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <span className="chip !border-transparent bg-paper/95">{PROPERTY_TYPE_LABELS[p.propertyType]}</span>
          {p.availability !== 'available' ? (
            <span className="chip !border-transparent !bg-charcoal !text-white">{AVAILABILITY_LABELS[p.availability]}</span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-bronze">
          <Icon name="pin" size={14} />
          {p.development.area}, {p.development.city}
        </p>
        <h3 className="mt-2 text-[1.35rem] leading-snug">
          <Link href={`/properties/${p.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {p.title}
          </Link>
        </h3>
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-stone" aria-label="Key specifications">
          {p.bedrooms != null ? (
            <li className="flex items-center gap-1.5"><Icon name="bed" size={18} />{p.bedrooms} bed</li>
          ) : null}
          {p.bathrooms != null ? (
            <li className="flex items-center gap-1.5"><Icon name="bath" size={18} />{p.bathrooms} bath</li>
          ) : null}
          {size ? <li className="flex items-center gap-1.5"><Icon name="area" size={18} />{size}</li> : null}
        </ul>
        <div className="mt-auto flex items-end justify-between gap-4 border-t border-line pt-4 mt-5">
          <p className={`text-sm font-semibold ${price === 'Price on request' ? 'text-stone' : 'text-charcoal'}`}>{price}</p>
          <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-charcoal transition-transform duration-300 group-hover:translate-x-1" aria-hidden>
            View <Icon name="arrowRight" size={16} />
          </span>
        </div>
      </div>
    </article>
  )
}

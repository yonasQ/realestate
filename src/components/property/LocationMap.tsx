'use client'

import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'

/**
 * Click-to-load OpenStreetMap embed: no third-party requests (or tracking) until
 * the visitor asks for the map, and no layout shift (fixed aspect box).
 */
export function LocationMap({ lat, lng, label, approximate }: { lat: number; lng: number; label: string; approximate: boolean }) {
  const [loaded, setLoaded] = useState(false)
  const d = approximate ? 0.012 : 0.006
  const bbox = [lng - d, lat - d * 0.7, lng + d, lat + d * 0.7].map((n) => n.toFixed(5)).join(',')
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(5)},${lng.toFixed(5)}`
  const link = `https://www.openstreetmap.org/?mlat=${lat.toFixed(5)}&mlon=${lng.toFixed(5)}#map=16/${lat.toFixed(5)}/${lng.toFixed(5)}`
  return (
    <div>
      <div className="relative aspect-[16/10] overflow-hidden border border-line bg-sand">
        {loaded ? (
          <iframe title={`Map of ${label}`} src={src} className="absolute inset-0 h-full w-full" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <button type="button" onClick={() => setLoaded(true)} className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_center,var(--color-paper),var(--color-sand))] text-charcoal">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-charcoal text-white"><Icon name="pin" /></span>
            <span className="text-sm font-semibold">Show map</span>
            <span className="text-xs text-stone">Loads OpenStreetMap</span>
          </button>
        )}
      </div>
      <p className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-stone">
        <span>{approximate ? 'Approximate location as published by the developer. The exact site is confirmed at your viewing.' : 'Site location.'}</span>
        <a href={link} target="_blank" rel="noopener noreferrer" className="font-semibold text-charcoal underline underline-offset-2">Open larger map</a>
      </p>
    </div>
  )
}

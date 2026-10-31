'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { ResponsiveImage } from '@/components/ui/ResponsiveImage'
import type { PublicImage } from '@/lib/queries/catalog'

/**
 * Editorial gallery grid + accessible full-screen viewer (native <dialog>:
 * focus is trapped and restored by the browser). Keyboard: ←/→ to navigate,
 * Esc to close. Touch: horizontal swipe.
 */
export function Gallery({ images, title, layout = 'mosaic' }: { images: PublicImage[]; title: string; layout?: 'mosaic' | 'grid' }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [index, setIndex] = useState(0)
  const touchX = useRef<number | null>(null)
  const count = images.length

  const open = (i: number) => {
    setIndex(i)
    dialog.current?.showModal()
  }
  const go = useCallback((delta: number) => setIndex((i) => (i + delta + count) % count), [count])

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    const onKey = (e: KeyboardEvent) => {
      if (!d.open) return
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    const lock = () => (document.body.style.overflow = d.open ? 'hidden' : '')
    document.addEventListener('keydown', onKey)
    d.addEventListener('close', lock)
    return () => {
      document.removeEventListener('keydown', onKey)
      d.removeEventListener('close', lock)
    }
  }, [go])

  if (!count) return null
  const current = images[index]!

  const tile = (img: PublicImage, i: number, className: string, sizes: string, priority = false) => (
    <button
      key={img.id}
      type="button"
      onClick={() => open(i)}
      className={`group img-zoom relative overflow-hidden bg-sand ${className}`}
      aria-label={`View image ${i + 1} of ${count}: ${img.alt || title}`}
    >
      <ResponsiveImage image={img} fill sizes={sizes} priority={priority} alt="" />
      {img.kind === 'plan' ? null : <span className="absolute inset-0 bg-charcoal/0 transition-colors group-hover:bg-charcoal/10" />}
    </button>
  )

  return (
    <>
      {layout === 'mosaic' ? (
        <div className="relative grid grid-cols-4 grid-rows-2 gap-2 md:h-[34rem]">
          {tile(images[0]!, 0, 'col-span-4 aspect-[4/3] md:col-span-2 md:row-span-2 md:aspect-auto', '(min-width: 768px) 50vw, 100vw', true)}
          {images.slice(1, 5).map((img, k) => tile(img, k + 1, 'hidden md:block', '25vw'))}
          <button type="button" onClick={() => open(0)} className="btn absolute bottom-4 right-4 min-h-10 bg-paper/95 px-4 text-charcoal hover:bg-paper">
            <Icon name="expand" size={16} /> {count} {count === 1 ? 'image' : 'images'}
          </button>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img, i) => (
            <li key={img.id}>
              {tile(img, i, 'block aspect-[4/3] w-full border border-line', '(min-width: 1024px) 25vw, 50vw')}
              {img.caption ? <p className="mt-2 text-xs text-stone">{img.caption}</p> : null}
            </li>
          ))}
        </ul>
      )}

      <dialog
        ref={dialog}
        aria-label={`${title} image viewer`}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-charcoal p-0 text-white backdrop:bg-black/90"
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close()
        }}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-4 py-3 text-sm md:px-6">
            <p aria-live="polite">{index + 1} / {count}</p>
            <button type="button" onClick={() => dialog.current?.close()} className="inline-flex h-11 w-11 items-center justify-center" autoFocus>
              <Icon name="close" size={24} /><span className="sr-only">Close viewer</span>
            </button>
          </div>
          <div
            className="relative flex flex-1 items-center justify-center px-2 md:px-20"
            onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
            onTouchEnd={(e) => {
              const start = touchX.current
              const end = e.changedTouches[0]?.clientX
              if (start != null && end != null && Math.abs(end - start) > 50) go(end < start ? 1 : -1)
              touchX.current = null
            }}
          >
            <ResponsiveImage key={current.id} image={current} sizes="100vw" className="max-h-[78dvh] w-auto max-w-full object-contain" />
            {count > 1 ? (
              <>
                <button type="button" onClick={() => go(-1)} className="absolute left-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 md:flex">
                  <Icon name="arrowLeft" /><span className="sr-only">Previous image</span>
                </button>
                <button type="button" onClick={() => go(1)} className="absolute right-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 md:flex">
                  <Icon name="arrowRight" /><span className="sr-only">Next image</span>
                </button>
              </>
            ) : null}
          </div>
          <div className="px-4 pb-5 pt-3 text-center text-sm text-white/75 md:px-6">
            <p>{current.caption ?? current.alt}</p>
            {current.credit ? <p className="mt-1 text-xs text-white/50">{current.credit}</p> : null}
          </div>
        </div>
      </dialog>
    </>
  )
}

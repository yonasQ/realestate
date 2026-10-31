'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveImagesAction, uploadImagesAction } from '@/app/admin/(protected)/actions'
import type { AdminImage } from '@/lib/admin/queries'
import { IMAGE_KINDS } from '@/lib/domain'
import { FormStatus } from './fields'

type Props = { entity: 'property' | 'development'; ownerId: string; images: AdminImage[]; coverMediaId: string | null; defaultAlt: string }

export function ImageManager({ entity, ownerId, images, coverMediaId, defaultAlt }: Props) {
  const router = useRouter()
  const [items, setItems] = useState(images)
  const [cover, setCover] = useState(coverMediaId)
  const [dirty, setDirty] = useState(false)
  const [state, setState] = useState<{ ok?: boolean; error?: string; message?: string }>({})
  const [pending, start] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const update = (i: number, patch: Partial<AdminImage>) => {
    setItems((arr) => arr.map((it, k) => (k === i ? { ...it, ...patch } : it)))
    setDirty(true)
  }
  const move = (i: number, d: -1 | 1) => {
    setItems((arr) => {
      const j = i + d
      if (j < 0 || j >= arr.length) return arr
      const next = [...arr]
      ;[next[i], next[j]] = [next[j]!, next[i]!]
      return next
    })
    setDirty(true)
  }
  const remove = (i: number) => {
    setItems((arr) => arr.filter((_, k) => k !== i))
    setDirty(true)
  }

  const save = () =>
    start(async () => {
      const res = await saveImagesAction(
        entity,
        ownerId,
        items.map((i) => ({ mediaId: i.mediaId, kind: i.kind, caption: i.caption, alt: i.alt })),
        cover,
      )
      setState(res)
      if (res.ok) {
        setDirty(false)
        router.refresh()
      }
    })

  const upload = (files: FileList | null) => {
    if (!files?.length) return
    if (dirty) {
      setState({ error: 'Save or discard your image changes before uploading more.' })
      return
    }
    const fd = new FormData()
    for (const f of Array.from(files)) fd.append('files', f)
    fd.set('alt', defaultAlt)
    start(async () => {
      const res = await uploadImagesAction(entity, ownerId, fd)
      setState(res)
      if (fileRef.current) fileRef.current.value = ''
      router.refresh()
    })
  }

  // Keep local state in sync after server refresh when nothing is being edited.
  if (!dirty && !pending && images !== items && JSON.stringify(images) !== JSON.stringify(items)) {
    setItems(images)
    setCover(coverMediaId)
  }

  return (
    <section className="space-y-4 border border-line bg-paper p-5 sm:p-6" aria-labelledby="img-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="img-heading" className="font-display text-xl">Images ({items.length})</h2>
        <label className="btn btn-outline min-h-10 cursor-pointer">
          Upload images
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple className="sr-only" onChange={(e) => upload(e.target.files)} disabled={pending} />
        </label>
      </div>
      <p className="text-xs text-stone">JPEG, PNG, WebP or AVIF, up to 15 MB each, max 10 per upload. Images are resized and stripped of location metadata automatically. The cover appears on cards and social shares; plans are shown in a separate section.</p>
      <FormStatus state={state} />
      {items.length ? (
        <ol className="space-y-3">
          {items.map((img, i) => (
            <li key={img.mediaId} className={`grid gap-4 border p-3 sm:grid-cols-[8rem_1fr_auto] ${cover === img.mediaId ? 'border-bronze' : 'border-line'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/${img.thumbKey}`} alt="" width={128} height={96} className="aspect-[4/3] w-32 bg-sand object-cover" />
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs font-semibold">Alt text (describes the image)
                  <input value={img.alt} maxLength={200} onChange={(e) => update(i, { alt: e.target.value })} className="field !min-h-9 mt-1 !py-1.5 text-sm" />
                </label>
                <label className="text-xs font-semibold">Caption (optional)
                  <input value={img.caption ?? ''} maxLength={200} onChange={(e) => update(i, { caption: e.target.value || null })} className="field !min-h-9 mt-1 !py-1.5 text-sm" />
                </label>
                <label className="text-xs font-semibold">Kind
                  <select value={img.kind} onChange={(e) => update(i, { kind: e.target.value as AdminImage['kind'] })} className="field !min-h-9 mt-1 !py-1.5 text-sm">
                    {IMAGE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2 self-end pb-2 text-xs font-semibold">
                  <input type="radio" name="cover" checked={cover === img.mediaId} disabled={img.kind === 'plan'} onChange={() => { setCover(img.mediaId); setDirty(true) }} /> Cover image
                </label>
              </div>
              <div className="flex gap-1 sm:flex-col">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="border border-line px-2 py-1 text-xs disabled:opacity-40" aria-label={`Move image ${i + 1} up`}>↑</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="border border-line px-2 py-1 text-xs disabled:opacity-40" aria-label={`Move image ${i + 1} down`}>↓</button>
                <button type="button" onClick={() => remove(i)} className="border border-danger/40 px-2 py-1 text-xs text-danger" aria-label={`Remove image ${i + 1}`}>Remove</button>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="border border-dashed border-line p-6 text-center text-sm text-stone">No images yet. Upload at least one before publishing.</p>
      )}
      <div className="flex gap-3">
        <button type="button" className="btn btn-primary min-h-10" onClick={save} disabled={!dirty || pending}>{pending ? 'Working…' : 'Save image changes'}</button>
        {dirty ? <button type="button" className="btn btn-outline min-h-10" onClick={() => { setItems(images); setCover(coverMediaId); setDirty(false) }}>Discard</button> : null}
      </div>
    </section>
  )
}

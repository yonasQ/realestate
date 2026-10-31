import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { DevelopmentForm } from '@/components/admin/DevelopmentForm'
import { ImageManager } from '@/components/admin/ImageManager'
import { StatusBadge } from '@/components/admin/fields'
import { entityImages, getAdminDevelopment } from '@/lib/admin/queries'

export default async function EditDevelopment({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const [{ id }, { created }] = await Promise.all([params, searchParams])
  if (!z.string().uuid().safeParse(id).success) notFound()
  const [d, images] = await Promise.all([getAdminDevelopment(id), entityImages('development', id)])
  if (!d) notFound()
  return (
    <div className="space-y-6">
      <Link href="/admin/developments" className="text-sm underline">← Developments</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl md:text-4xl">{d.name}</h1>
        <StatusBadge status={d.status} />
        {d.status === 'published' ? <Link href={`/developments/${d.slug}`} target="_blank" className="text-sm underline">View live ↗</Link> : null}
      </div>
      {created ? <p role="status" className="border border-success/40 bg-success/5 p-3 text-sm text-success">Draft created. Add images, then publish.</p> : null}
      {d.reviewNotes ? <p className="border-l-4 border-bronze bg-paper p-4 text-sm"><strong>Review notes:</strong> {d.reviewNotes}</p> : null}
      <ImageManager entity="development" ownerId={d.id} images={images} coverMediaId={d.coverMediaId} defaultAlt={d.name} />
      <DevelopmentForm development={d} />
    </div>
  )
}

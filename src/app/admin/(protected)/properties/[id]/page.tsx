import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { ImageManager } from '@/components/admin/ImageManager'
import { PropertyForm } from '@/components/admin/PropertyForm'
import { StatusBadge } from '@/components/admin/fields'
import { developmentOptions, entityImages, getAdminProperty } from '@/lib/admin/queries'

export default async function EditProperty({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const [{ id }, { created }] = await Promise.all([params, searchParams])
  if (!z.string().uuid().safeParse(id).success) notFound()
  const [property, developments, images] = await Promise.all([getAdminProperty(id), developmentOptions(), entityImages('property', id)])
  if (!property) notFound()
  return (
    <div className="space-y-6">
      <Link href="/admin/properties" className="text-sm underline">← Listings</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl md:text-4xl">{property.title}</h1>
        <StatusBadge status={property.status} />
        {property.status === 'published' ? <Link href={`/properties/${property.slug}`} target="_blank" className="text-sm underline">View live ↗</Link> : null}
      </div>
      {created ? <p role="status" className="border border-success/40 bg-success/5 p-3 text-sm text-success">Draft created. Add images below, then set the status to published.</p> : null}
      {property.reviewNotes ? <p className="border-l-4 border-bronze bg-paper p-4 text-sm"><strong>Review notes:</strong> {property.reviewNotes}</p> : null}
      <ImageManager entity="property" ownerId={property.id} images={images} coverMediaId={property.coverMediaId} defaultAlt={property.title} />
      <PropertyForm property={property} developments={developments} />
    </div>
  )
}

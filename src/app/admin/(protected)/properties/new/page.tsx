import Link from 'next/link'
import { PropertyForm } from '@/components/admin/PropertyForm'
import { developmentOptions } from '@/lib/admin/queries'

export default async function NewProperty() {
  const developments = await developmentOptions()
  return (
    <div className="space-y-6">
      <Link href="/admin/properties" className="text-sm underline">← Listings</Link>
      <h1 className="text-4xl">New listing</h1>
      <p className="text-stone">Create the listing as a draft, then add images and publish.</p>
      <PropertyForm property={null} developments={developments} />
    </div>
  )
}

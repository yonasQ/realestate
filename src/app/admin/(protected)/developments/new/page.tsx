import Link from 'next/link'
import { DevelopmentForm } from '@/components/admin/DevelopmentForm'

export default function NewDevelopment() {
  return (
    <div className="space-y-6">
      <Link href="/admin/developments" className="text-sm underline">← Developments</Link>
      <h1 className="text-4xl">New development</h1>
      <DevelopmentForm development={null} />
    </div>
  )
}

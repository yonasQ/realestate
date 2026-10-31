import Link from 'next/link'
import { StatusBadge } from '@/components/admin/fields'
import { listAdminDevelopments } from '@/lib/admin/queries'

export default async function AdminDevelopments() {
  const rows = await listAdminDevelopments()
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-4xl">Developments</h1>
        <Link href="/admin/developments/new" className="btn btn-primary min-h-10">New development</Link>
      </div>
      <div className="overflow-x-auto border border-line bg-paper">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-stone"><tr><th className="p-3" /><th className="p-3">Name</th><th className="p-3">Area</th><th className="p-3">Listings</th><th className="p-3">Status</th><th className="p-3">Review</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line/60 last:border-0 hover:bg-ivory">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <td className="p-2">{r.coverKey ? <img src={`/${r.coverKey}`} alt="" width={64} height={48} className="h-12 w-16 object-cover" /> : <div className="h-12 w-16 bg-sand" />}</td>
                <td className="p-3"><Link className="font-semibold hover:underline" href={`/admin/developments/${r.id}`}>{r.name}</Link>{r.featured ? <span className="ml-2 text-xs text-bronze">★ featured</span> : null}</td>
                <td className="p-3">{r.area}</td>
                <td className="p-3">{r.units}</td>
                <td className="p-3"><StatusBadge status={r.status} /></td>
                <td className="max-w-xs p-3 text-xs text-stone">{r.reviewNotes ? <span title={r.reviewNotes}>⚠ {r.reviewNotes.slice(0, 70)}…</span> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

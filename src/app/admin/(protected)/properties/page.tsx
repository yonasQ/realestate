import Link from 'next/link'
import { StatusBadge } from '@/components/admin/fields'
import { listAdminProperties } from '@/lib/admin/queries'
import { AVAILABILITY_LABELS, CONTENT_STATUSES, type ContentStatus } from '@/lib/domain'

export default async function AdminProperties({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const sp = await searchParams
  const status = (CONTENT_STATUSES as readonly string[]).includes(sp.status ?? '') ? (sp.status as ContentStatus) : undefined
  const q = sp.q?.trim().slice(0, 80) || undefined
  const rows = await listAdminProperties({ status, q })
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-4xl">Listings</h1>
        <Link href="/admin/properties/new" className="btn btn-primary min-h-10">New listing</Link>
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <ul className="flex flex-wrap gap-2 text-sm">
          <li><Link href="/admin/properties" className={`chip min-h-9 ${!status ? '!bg-charcoal !text-white' : ''}`}>All</Link></li>
          {CONTENT_STATUSES.map((s) => <li key={s}><Link href={`/admin/properties?status=${s}`} className={`chip min-h-9 ${status === s ? '!bg-charcoal !text-white' : ''}`}>{s}</Link></li>)}
        </ul>
        <form className="flex gap-2" action="/admin/properties">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <label htmlFor="pq" className="sr-only">Search listings</label>
          <input id="pq" name="q" defaultValue={q} placeholder="Search title or development" className="field !min-h-10 w-64" />
          <button className="btn btn-outline min-h-10">Search</button>
        </form>
      </div>
      <div className="overflow-x-auto border border-line bg-paper">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-stone"><tr><th className="p-3" /><th className="p-3">Title</th><th className="p-3">Development</th><th className="p-3">Status</th><th className="p-3">Availability</th><th className="p-3">Review</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line/60 last:border-0 hover:bg-ivory">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <td className="p-2">{r.coverKey ? <img src={`/${r.coverKey}`} alt="" width={64} height={48} className="h-12 w-16 object-cover" /> : <div className="h-12 w-16 bg-sand" />}</td>
                <td className="p-3"><Link className="font-semibold hover:underline" href={`/admin/properties/${r.id}`}>{r.title}</Link>{r.featured ? <span className="ml-2 text-xs text-bronze">★ featured</span> : null}</td>
                <td className="p-3">{r.devName}{r.devStatus !== 'published' ? <span className="ml-1 text-xs text-stone">({r.devStatus})</span> : null}</td>
                <td className="p-3"><StatusBadge status={r.status} /></td>
                <td className="p-3">{AVAILABILITY_LABELS[r.availability]}</td>
                <td className="max-w-xs p-3 text-xs text-stone">{r.reviewNotes ? <span title={r.reviewNotes}>⚠ {r.reviewNotes.slice(0, 70)}{r.reviewNotes.length > 70 ? '…' : ''}</span> : null}</td>
              </tr>
            ))}
            {!rows.length ? <tr><td colSpan={6} className="p-6 text-center text-stone">No listings match.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

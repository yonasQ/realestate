import Link from 'next/link'
import { StatusBadge } from '@/components/admin/fields'
import { listInquiries } from '@/lib/admin/queries'
import { INQUIRY_STATUS_LABELS, INQUIRY_STATUSES, INQUIRY_TYPE_LABELS, type InquiryStatus } from '@/lib/domain'
import { formatDate } from '@/lib/format'

type SP = Promise<{ status?: string; q?: string; page?: string }>

export default async function InquiriesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const status = (INQUIRY_STATUSES as readonly string[]).includes(sp.status ?? '') ? (sp.status as InquiryStatus) : undefined
  const q = sp.q?.trim().slice(0, 80) || undefined
  const page = Math.max(1, Number(sp.page) || 1)
  const { rows, total, pageCount } = await listInquiries({ status, q, page })
  const qs = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries({ status, q, ...o })) if (v) p.set(k, v)
    return `/admin/inquiries${p.size ? `?${p}` : ''}`
  }
  return (
    <div className="space-y-6">
      <h1 className="text-4xl">Inquiries</h1>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <ul className="flex flex-wrap gap-2 text-sm">
          <li><Link href={qs({ status: undefined, page: undefined })} className={`chip min-h-9 ${!status ? '!bg-charcoal !text-white' : ''}`}>Active</Link></li>
          {INQUIRY_STATUSES.map((s) => (
            <li key={s}><Link href={qs({ status: s, page: undefined })} className={`chip min-h-9 ${status === s ? '!bg-charcoal !text-white' : ''}`}>{INQUIRY_STATUS_LABELS[s]}</Link></li>
          ))}
        </ul>
        <form className="flex gap-2" action="/admin/inquiries">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <label className="sr-only" htmlFor="iq">Search inquiries</label>
          <input id="iq" name="q" defaultValue={q} placeholder="Name, phone, email, reference" className="field !min-h-10 w-64" />
          <button className="btn btn-outline min-h-10">Search</button>
        </form>
      </div>
      <p className="text-sm text-stone">{total} result{total === 1 ? '' : 's'}</p>
      <div className="overflow-x-auto border border-line bg-paper">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-stone">
            <tr><th className="p-3">Received</th><th className="p-3">Ref</th><th className="p-3">Name</th><th className="p-3">Type</th><th className="p-3">About</th><th className="p-3">Viewing</th><th className="p-3">Status</th><th className="p-3">Alert</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line/60 last:border-0 hover:bg-ivory">
                <td className="whitespace-nowrap p-3">{formatDate(r.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}</td>
                <td className="p-3 font-mono text-xs">{r.reference}</td>
                <td className="p-3"><Link className="font-semibold hover:underline" href={`/admin/inquiries/${r.id}`}>{r.name}</Link></td>
                <td className="p-3">{INQUIRY_TYPE_LABELS[r.type]}</td>
                <td className="p-3">{r.subjectLabel ?? '—'}</td>
                <td className="whitespace-nowrap p-3">{r.preferredDate ?? '—'}</td>
                <td className="p-3"><StatusBadge status={r.status} /></td>
                <td className="p-3"><StatusBadge status={r.deliveryStatus} /></td>
              </tr>
            ))}
            {!rows.length ? <tr><td colSpan={8} className="p-6 text-center text-stone">No inquiries match.</td></tr> : null}
          </tbody>
        </table>
      </div>
      {pageCount > 1 ? (
        <nav aria-label="Pagination" className="flex gap-2">
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
            <Link key={p} href={qs({ page: String(p) })} aria-current={p === page ? 'page' : undefined} className={`flex h-9 w-9 items-center justify-center border text-sm ${p === page ? 'bg-charcoal text-white' : 'bg-paper'}`}>{p}</Link>
          ))}
        </nav>
      ) : null}
    </div>
  )
}

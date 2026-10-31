import Link from 'next/link'
import { StatusBadge } from '@/components/admin/fields'
import { dashboardStats, listInquiries } from '@/lib/admin/queries'
import { INQUIRY_TYPE_LABELS } from '@/lib/domain'
import { formatDate } from '@/lib/format'
import { configuredChannels } from '@/lib/inquiries/channels'

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, stats, recent] = await Promise.all([searchParams, dashboardStats(), listInquiries({ page: 1, pageSize: 8 })])
  const channels = configuredChannels()
  const cards = [
    { label: 'New inquiries', value: stats.new_inquiries, href: '/admin/inquiries?status=new' },
    { label: 'Inquiries, last 7 days', value: stats.inquiries_7d, href: '/admin/inquiries' },
    { label: 'Published listings', value: stats.published_properties, href: '/admin/properties?status=published' },
    { label: 'Draft listings', value: stats.draft_properties, href: '/admin/properties?status=draft' },
  ]
  return (
    <div className="space-y-10">
      <h1 className="text-4xl">Dashboard</h1>
      {error === 'forbidden' ? <p role="alert" className="border border-danger/40 bg-danger/5 p-3 text-sm text-danger">That area requires an admin account.</p> : null}
      {!channels.length ? (
        <div className="border-l-4 border-bronze bg-paper p-4 text-sm">
          <strong>Inquiry notifications are not configured.</strong> Inquiries are saved and shown here, but no email or CRM alert is sent. Set SMTP_* and INQUIRY_NOTIFY_EMAIL (or CRM_WEBHOOK_URL) to enable alerts. See docs/DEPLOYMENT.md.
        </div>
      ) : null}
      {stats.failed_deliveries ? (
        <div className="border-l-4 border-danger bg-paper p-4 text-sm">
          <strong>{stats.failed_deliveries} inquiry notification(s) failed.</strong> The inquiries are safe in the inbox; open them to retry. <Link className="underline" href="/admin/inquiries">Review</Link>
        </div>
      ) : null}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <li key={c.label}>
            <Link href={c.href} className="block border border-line bg-paper p-5 hover:border-charcoal">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone">{c.label}</p>
              <p className="mt-2 font-display text-4xl">{c.value ?? 0}</p>
            </Link>
          </li>
        ))}
      </ul>
      {stats.needs_review ? (
        <p className="text-sm text-stone">{stats.needs_review} listing(s) have open review notes (conflicting developer data). <Link className="underline" href="/admin/properties">Open listings</Link></p>
      ) : null}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl">Latest inquiries</h2>
          <Link href="/admin/inquiries" className="text-sm underline">All inquiries</Link>
        </div>
        <div className="mt-4 overflow-x-auto border border-line bg-paper">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-[0.08em] text-stone"><tr><th className="p-3">Received</th><th className="p-3">Name</th><th className="p-3">Type</th><th className="p-3">About</th><th className="p-3">Status</th></tr></thead>
            <tbody>
              {recent.rows.map((r) => (
                <tr key={r.id} className="border-b border-line/60 last:border-0 hover:bg-ivory">
                  <td className="whitespace-nowrap p-3">{formatDate(r.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td className="p-3"><Link className="font-semibold underline-offset-2 hover:underline" href={`/admin/inquiries/${r.id}`}>{r.name}</Link></td>
                  <td className="p-3">{INQUIRY_TYPE_LABELS[r.type]}</td>
                  <td className="p-3">{r.subjectLabel ?? '—'}</td>
                  <td className="p-3"><StatusBadge status={r.status} /></td>
                </tr>
              ))}
              {!recent.rows.length ? <tr><td colSpan={5} className="p-6 text-center text-stone">No inquiries yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

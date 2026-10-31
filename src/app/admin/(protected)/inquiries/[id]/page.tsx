import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { StatusBadge } from '@/components/admin/fields'
import { InquiryStatusForm } from '@/components/admin/InquiryStatusForm'
import { getInquiry } from '@/lib/admin/queries'
import { CONTACT_METHOD_LABELS, INQUIRY_TYPE_LABELS, VIEWING_WINDOW_LABELS, type ViewingWindow } from '@/lib/domain'
import { formatDate, telHref, whatsappHref } from '@/lib/format'
import { retryDeliveryAction } from '../../actions'

export default async function InquiryDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) notFound()
  const data = await getInquiry(id)
  if (!data) notFound()
  const { inquiry: i, property, development } = data
  const tel = telHref(i.phone)
  const wa = whatsappHref(i.phone, `Hello ${i.name}, regarding your inquiry ${i.reference}`)
  return (
    <div className="space-y-8">
      <Link href="/admin/inquiries" className="text-sm underline">← All inquiries</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-4xl">{i.name}</h1>
        <StatusBadge status={i.status} />
      </div>
      <div className="grid gap-8 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-2">
          <dl className="grid gap-x-8 gap-y-4 border border-line bg-paper p-6 sm:grid-cols-2">
            <div><dt className="text-xs uppercase tracking-[0.1em] text-stone">Reference</dt><dd className="font-mono">{i.reference}</dd></div>
            <div><dt className="text-xs uppercase tracking-[0.1em] text-stone">Type</dt><dd>{INQUIRY_TYPE_LABELS[i.type]}</dd></div>
            <div><dt className="text-xs uppercase tracking-[0.1em] text-stone">Received</dt><dd>{formatDate(i.createdAt, { dateStyle: 'full', timeStyle: 'short' })}</dd></div>
            <div><dt className="text-xs uppercase tracking-[0.1em] text-stone">About</dt><dd>
              {property ? <Link className="underline" href={`/properties/${property.slug}`} target="_blank">{property.title}</Link> : development ? <Link className="underline" href={`/developments/${development.slug}`} target="_blank">{development.name}</Link> : (i.subjectLabel ?? 'General inquiry')}
            </dd></div>
            <div><dt className="text-xs uppercase tracking-[0.1em] text-stone">Phone</dt><dd>{i.phone ? <a className="underline" href={tel ?? undefined}>{i.phone}</a> : '—'}{wa ? <> · <a className="underline" href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a></> : null}</dd></div>
            <div><dt className="text-xs uppercase tracking-[0.1em] text-stone">Email</dt><dd>{i.email ? <a className="underline" href={`mailto:${i.email}?subject=${encodeURIComponent(`Your inquiry ${i.reference}`)}`}>{i.email}</a> : '—'}</dd></div>
            <div><dt className="text-xs uppercase tracking-[0.1em] text-stone">Preferred contact</dt><dd>{CONTACT_METHOD_LABELS[i.preferredContact]}</dd></div>
            {i.preferredDate ? <div><dt className="text-xs uppercase tracking-[0.1em] text-stone">Requested viewing</dt><dd>{formatDate(`${i.preferredDate}T12:00:00Z`, { dateStyle: 'full' })}{i.preferredWindow ? `, ${VIEWING_WINDOW_LABELS[i.preferredWindow as ViewingWindow] ?? i.preferredWindow}` : ''}</dd></div> : null}
          </dl>
          <div className="border border-line bg-paper p-6">
            <h2 className="text-xl">Message</h2>
            <p className="mt-3 whitespace-pre-wrap leading-relaxed">{i.message || <span className="text-stone">No message.</span>}</p>
          </div>
          <p className="text-xs text-stone">Consent recorded {formatDate(i.consentAt, { dateStyle: 'medium', timeStyle: 'short' })} (notice version {i.consentVersion}). Submitted from {i.sourcePath ?? 'unknown page'}.</p>
        </section>
        <aside className="space-y-6">
          <div className="border border-line bg-paper p-6">
            <h2 className="text-xl">Follow-up</h2>
            <InquiryStatusForm id={i.id} status={i.status} notes={i.adminNotes} />
          </div>
          <div className="border border-line bg-paper p-6 text-sm">
            <h2 className="text-xl">Notification</h2>
            <p className="mt-3 flex items-center gap-2">Status: <StatusBadge status={i.deliveryStatus} /></p>
            <p className="mt-2 text-stone">Attempts: {i.deliveryAttempts}{i.deliveredAt ? ` · delivered ${formatDate(i.deliveredAt, { dateStyle: 'medium', timeStyle: 'short' })}` : ''}</p>
            {i.deliveryLastError ? <p className="mt-2 break-words text-danger">{i.deliveryLastError}</p> : null}
            {i.deliveryStatus === 'failed' || i.deliveryStatus === 'skipped' ? (
              <form action={retryDeliveryAction} className="mt-4"><input type="hidden" name="id" value={i.id} /><button className="btn btn-outline min-h-10">Retry notification</button></form>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  )
}

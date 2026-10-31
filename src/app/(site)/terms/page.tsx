import type { Metadata } from 'next'
import { LegalPage } from '@/components/site/LegalPage'
import { getSettings } from '@/lib/queries/settings'

export const metadata: Metadata = { title: 'Terms of use', alternates: { canonical: '/terms' } }

export default async function TermsPage() {
  const s = await getSettings()
  return (
    <LegalPage title="Terms of use" updated="12 October 2026">
      <h2>About this website</h2>
      <p>{s.relationshipStatement}</p>
      <h2>Property information</h2>
      <p>Descriptions, specifications, plans, images, construction status and delivery timelines are based on information published or supplied by {s.developerName}. Images may be architectural renders or representative interiors and may not show the exact unit. Delivery periods are the developer’s estimates.</p>
      <p>Information can change without notice and may contain errors. Nothing on this website is an offer, a reservation, or a guarantee of price, availability, size, finish or completion date. All terms are confirmed in writing by {s.developerName} in its own sale documents before you commit.</p>
      <h2>No investment advice</h2>
      <p>Nothing on this website is financial, legal or investment advice, and no rental yield or capital growth is promised. Please take independent advice before buying.</p>
      <h2>Viewing requests</h2>
      <p>Submitting a viewing request does not book an appointment. A viewing is confirmed only after we have agreed a date and time directly.</p>
      <h2>Acceptable use</h2>
      <p>Do not misuse the forms on this website, submit other people’s details without permission, or attempt to disrupt the service.</p>
      <h2>Trademarks and images</h2>
      <p>{s.developerName} names, logos and project images belong to {s.developerName} and are used to market its developments.</p>
    </LegalPage>
  )
}

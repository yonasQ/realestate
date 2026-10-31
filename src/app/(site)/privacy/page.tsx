import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage } from '@/components/site/LegalPage'
import { getSettings } from '@/lib/queries/settings'

export const metadata: Metadata = { title: 'Privacy notice', alternates: { canonical: '/privacy' } }

export default async function PrivacyPage() {
  const s = await getSettings()
  const controller = s.realtorName ? `${s.realtorName} (${s.brandName})` : s.brandName
  return (
    <LegalPage title="Privacy notice" updated="12 October 2026">
      <p>This notice explains how {controller} (“I”, “me”) collects and uses personal information through this website.</p>
      <h2>What I collect</h2>
      <ul>
        <li><strong>Information you send me</strong> through inquiry and viewing forms: your name, phone number and/or email address, preferred contact method, preferred viewing date and time, the property or development you asked about, and your message.</li>
        <li><strong>Consent record</strong>: the date and time you agreed to be contacted.</li>
        <li><strong>Technical data for security</strong>: a one-way, keyed hash of your IP address (not the address itself) and your browser’s user-agent string, used to prevent spam and abuse.</li>
      </ul>
      <p>The site does not use advertising cookies or cross-site tracking. If privacy-friendly analytics are enabled, they are cookieless and record only aggregated page views.</p>
      <h2>Why I use it</h2>
      <ul>
        <li>To respond to your inquiry and arrange viewings you request.</li>
        <li>To ask {s.developerName} for the pricing, availability and documents you need. Your name and contact details may be shared with {s.developerName} for this purpose only.</li>
        <li>To keep this website secure and protect it from spam.</li>
      </ul>
      <p>I do not sell your information, and I do not add you to marketing lists without your separate permission.</p>
      <h2>Where it is stored</h2>
      <p>Inquiries are stored in this website’s database and may also be delivered to my business email or customer-management system. Access is restricted to authorised people with individual, password-protected accounts.</p>
      <h2>How long I keep it</h2>
      <p>Inquiries are kept for as long as needed to handle your request and any resulting purchase, and are reviewed regularly. Inquiries that did not lead to a purchase are deleted within 24 months, and spam immediately.</p>
      <h2>Your choices</h2>
      <p>You can ask me to show you, correct or delete the information I hold about you, or to stop contacting you, at any time via the <Link href="/contact" className="underline underline-offset-2">contact page</Link>{s.email ? <> or by email to <a href={`mailto:${s.email}`} className="underline underline-offset-2">{s.email}</a></> : null}.</p>
      <h2>Changes</h2>
      <p>If this notice changes, the updated version will be published on this page with a new date.</p>
    </LegalPage>
  )
}

import type { Metadata } from 'next'
import { InquirySection } from '@/components/inquiry/InquirySection'
import { getSettings } from '@/lib/queries/settings'
import { pageMetadata } from '@/lib/seo/metadata'

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings()
  return pageMetadata({
    title: `Contact & book a viewing | ${s.brandName}`,
    description: `Ask about apartments and commercial units in ${s.developerName} developments, or book a site viewing in Addis Ababa.`,
    path: '/contact',
    siteName: s.brandName,
    image: s.heroImage,
  })
}

type SearchParams = Promise<{ type?: string; subject?: string }>

export default async function ContactPage({ searchParams }: { searchParams: SearchParams }) {
  const { type, subject } = await searchParams
  const viewing = type === 'viewing'
  const safeSubject = subject && /^(property|development):[a-z0-9-]{1,120}$/.test(subject) ? subject : undefined
  return (
    <div className="pt-24">
      <InquirySection
        eyebrow="Contact"
        title={viewing ? 'Book a viewing' : 'How can I help?'}
        description={
          viewing
            ? 'Choose a development or listing and a preferred date. I will call or message you to confirm the time. Nothing is booked until we have spoken.'
            : 'Ask about a development, unit availability, pricing or the buying process. You will receive a reference number as soon as your message is recorded.'
        }
        defaultMode={viewing ? 'viewing' : 'inquiry'}
        defaultSubject={safeSubject}
        headingLevel="h1"
      />
    </div>
  )
}

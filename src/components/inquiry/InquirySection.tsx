import { InquiryForm } from './InquiryForm'
import { ContactChannels } from './ContactChannels'
import { getInquirySubjects } from '@/lib/queries/catalog'
import { getSettings } from '@/lib/queries/settings'

export async function InquirySection({
  id,
  eyebrow,
  title,
  description,
  defaultMode,
  defaultSubject,
  headingLevel = 'h2',
}: {
  id?: string
  eyebrow: string
  title: string
  description: string
  defaultMode?: 'inquiry' | 'viewing'
  defaultSubject?: string
  headingLevel?: 'h1' | 'h2'
}) {
  const [subjects, settings] = await Promise.all([getInquirySubjects(), getSettings()])
  const Heading = headingLevel
  return (
    <section id={id} className="bg-sand/60 py-20 md:py-28" aria-labelledby={id ? `${id}-heading` : undefined}>
      <div className="container-page grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <p className="eyebrow">{eyebrow}</p>
          <Heading id={id ? `${id}-heading` : undefined} className="mt-3 text-4xl md:text-5xl">{title}</Heading>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-stone">{description}</p>
          <ContactChannels settings={settings} className="mt-10" />
        </div>
        <div className="lg:col-span-6 lg:col-start-7">
          <div className="bg-ivory p-6 shadow-[0_0_0_1px_var(--color-line)] sm:p-10">
            <InquiryForm subjects={subjects} defaultMode={defaultMode} defaultSubject={defaultSubject} idPrefix={id ?? 'inq'} />
          </div>
        </div>
      </div>
    </section>
  )
}

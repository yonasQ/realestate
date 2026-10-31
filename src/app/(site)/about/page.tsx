import type { Metadata } from 'next'
import Link from 'next/link'
import { ContactChannels } from '@/components/inquiry/ContactChannels'
import { Icon } from '@/components/ui/Icon'
import { ResponsiveImage } from '@/components/ui/ResponsiveImage'
import { getPublicDevelopments } from '@/lib/queries/catalog'
import { getSettings } from '@/lib/queries/settings'


export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings()
  return {
    title: `About ${s.realtorName ?? s.brandName} | Realtor for ${s.developerName}`,
    description: `How ${s.realtorName ?? s.brandName} helps buyers choose and purchase apartments and commercial units in ${s.developerName} developments in Addis Ababa.`,
    alternates: { canonical: '/about' },
  }
}

const HOW_I_HELP = [
  { title: 'Clarify what you need', text: 'We start with your budget, preferred area, size, timeline and whether you are buying to live in, rent out or trade from.' },
  { title: 'Compare developments honestly', text: 'I put suitable buildings side by side: location, unit sizes, construction status and the developer’s delivery estimate, including what is not yet confirmed.' },
  { title: 'Get answers from the developer', text: 'Pricing, payment schedules, unit availability and finishing options come from Temer Properties. I request them on your behalf and share them in writing.' },
  { title: 'Support you through purchase', text: 'From reservation to contract signing with the developer, I help you prepare documents and follow up until the process is complete.' },
]

const PROCESS = [
  { step: '01', title: 'Send an inquiry', text: 'Use any form on this site, or call or message me directly. You receive a reference number immediately.' },
  { step: '02', title: 'Initial conversation', text: 'I contact you using your preferred method, usually within one business day, to understand your requirements.' },
  { step: '03', title: 'Site viewing', text: 'We agree a date and time (Monday to Saturday) to visit the site or the developer’s sales office together.' },
  { step: '04', title: 'Offer and documents', text: 'Temer Properties confirms the price, payment plan and unit. Nothing is binding until you sign the developer’s contract.' },
]

export default async function AboutPage() {
  const [s, developments] = await Promise.all([getSettings(), getPublicDevelopments()])
  return (
    <>
      <section className="pb-16 pt-32 md:pt-40">
        <div className="container-page grid items-end gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className="eyebrow">About</p>
            <h1 className="mt-4 text-4xl leading-[1.06] md:text-6xl">
              {s.realtorName ? <>{s.realtorName}<span className="block text-bronze">{s.realtorTitle}</span></> : 'A realtor focused on Temer Properties developments'}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink">
              {s.realtorBio ?? 'I help buyers find the right apartment or commercial unit across Temer Properties’ developments in Addis Ababa, from first questions through to site visits and the developer’s purchase process.'}
            </p>
          </div>
          <div className="lg:col-span-4 lg:col-start-9">
            {s.realtorPhoto ? (
              <div className="relative aspect-[4/5] overflow-hidden bg-sand"><ResponsiveImage image={s.realtorPhoto} fill priority sizes="(min-width: 1024px) 33vw, 100vw" /></div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-paper py-16" aria-labelledby="relationship">
        <div className="container-page grid gap-8 lg:grid-cols-12">
          <h2 id="relationship" className="text-3xl lg:col-span-4">My relationship with {s.developerName}</h2>
          <div className="lg:col-span-7 lg:col-start-6">
            <p className="text-lg leading-relaxed text-ink">{s.relationshipStatement}</p>
            {s.developerWebsite ? (
              <p className="mt-4 text-stone">
                The developer’s own website is{' '}
                <a href={s.developerWebsite} target="_blank" rel="noopener noreferrer" className="font-semibold text-charcoal underline underline-offset-2">{s.developerWebsite.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a>.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="container-page py-20" aria-labelledby="represent">
        <p className="eyebrow">Developments I represent</p>
        <h2 id="represent" className="mt-3 text-3xl md:text-4xl">{developments.length} current developments</h2>
        <ul className="mt-10 grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
          {developments.map((d) => (
            <li key={d.slug}>
              <Link href={`/developments/${d.slug}`} className="group flex h-full items-center justify-between bg-ivory p-5 hover:bg-paper">
                <span><span className="block font-display text-xl">{d.name}</span><span className="text-sm text-stone">{d.area}</span></span>
                <Icon name="arrowRight" size={18} className="text-bronze transition-transform group-hover:translate-x-1" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-sand/60 py-20" aria-labelledby="help">
        <div className="container-page">
          <p className="eyebrow">How I help buyers</p>
          <h2 id="help" className="mt-3 max-w-2xl text-3xl md:text-4xl">Choosing the right property, with the facts in front of you</h2>
          <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_I_HELP.map((h) => (
              <div key={h.title} className="border-t border-charcoal pt-5">
                <h3 className="text-xl">{h.title}</h3>
                <p className="mt-3 leading-relaxed text-stone">{h.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-20" aria-labelledby="process">
        <p className="eyebrow">Inquiry and viewing process</p>
        <h2 id="process" className="mt-3 text-3xl md:text-4xl">What happens after you get in touch</h2>
        <ol className="mt-12 grid gap-8 md:grid-cols-4">
          {PROCESS.map((p) => (
            <li key={p.step}>
              <span className="font-display text-5xl text-bronze">{p.step}</span>
              <h3 className="mt-3 text-xl">{p.title}</h3>
              <p className="mt-2 leading-relaxed text-stone">{p.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-charcoal py-20 text-white" aria-labelledby="contact-cta">
        <div className="container-page grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <h2 id="contact-cta" className="text-4xl !text-white md:text-5xl">Ready to see a property?</h2>
            <p className="mt-4 max-w-lg text-white/75">Tell me which development interests you and when you are free. I will arrange the visit and confirm the time with you.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/contact?type=viewing" className="btn btn-accent">Book a viewing</Link>
              <Link href="/properties" className="btn btn-ghost-light">Browse properties</Link>
            </div>
          </div>
          <div className="rounded-sm bg-ivory p-8 text-charcoal lg:col-span-5 lg:col-start-8">
            <ContactChannels settings={s} />
          </div>
        </div>
      </section>
    </>
  )
}

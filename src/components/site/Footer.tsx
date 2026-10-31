import Link from 'next/link'
import type { PublicSettings } from '@/lib/queries/settings'
import { telHref, whatsappHref } from '@/lib/format'

export function Footer({ settings }: { settings: PublicSettings }) {
  const year = new Date().getFullYear()
  const realtorTel = telHref(settings.phone)
  const realtorWa = whatsappHref(settings.whatsapp)
  const social = Object.entries(settings.social ?? {}).filter(([, url]) => typeof url === 'string' && url.startsWith('https://'))
  return (
    <footer className="bg-charcoal text-[#d9d1c3]">
      <div className="container-page grid gap-12 py-16 md:grid-cols-12 md:py-20">
        <div className="md:col-span-5">
          <p className="font-display text-3xl text-white">{settings.brandName}</p>
          {settings.brandTagline ? <p className="eyebrow mt-3 !text-bronze-light">{settings.brandTagline}</p> : null}
          <p className="mt-6 max-w-md text-sm leading-relaxed text-[#bfb6a7]">{settings.relationshipStatement}</p>
        </div>

        <nav aria-label="Footer" className="md:col-span-3">
          <p className="eyebrow !text-bronze-light">Explore</p>
          <ul className="mt-5 space-y-3 text-sm">
            <li><Link className="link-underline" href="/properties">All properties</Link></li>
            <li><Link className="link-underline" href="/properties?type=apartment">Apartments</Link></li>
            <li><Link className="link-underline" href="/properties?type=shop">Commercial shops</Link></li>
            <li><Link className="link-underline" href="/developments">Developments</Link></li>
            <li><Link className="link-underline" href="/about">About &amp; process</Link></li>
            <li><Link className="link-underline" href="/contact?type=viewing">Book a viewing</Link></li>
          </ul>
        </nav>

        <div className="md:col-span-4">
          <p className="eyebrow !text-bronze-light">Contact</p>
          <ul className="mt-5 space-y-3 text-sm">
            {settings.realtorName ? <li className="text-white">{settings.realtorName}</li> : null}
            {realtorTel ? <li><a className="link-underline" href={realtorTel}>{settings.phone}</a></li> : null}
            {realtorWa ? <li><a className="link-underline" href={realtorWa} rel="noopener noreferrer" target="_blank">WhatsApp</a></li> : null}
            {settings.email ? <li><a className="link-underline" href={`mailto:${settings.email}`}>{settings.email}</a></li> : null}
            <li><Link className="link-underline" href="/contact">Send an inquiry</Link></li>
          </ul>
          <div className="mt-8 border-t border-white/10 pt-6 text-xs leading-relaxed text-[#a9a092]">
            <p className="font-semibold uppercase tracking-[0.16em] text-[#cfc6b6]">{settings.developerName} sales office</p>
            {settings.developerAddress ? <p className="mt-2">{settings.developerAddress}</p> : null}
            <p className="mt-1">
              {settings.developerHotline ? <>Hotline <a className="link-underline" href={telHref(settings.developerHotline) ?? undefined}>{settings.developerHotline}</a></> : null}
              {settings.developerPhone ? <> · <a className="link-underline" href={telHref(settings.developerPhone) ?? undefined}>{settings.developerPhone}</a></> : null}
            </p>
          </div>
          {social.length ? (
            <ul className="mt-6 flex flex-wrap gap-4 text-xs font-semibold uppercase tracking-[0.14em]">
              {social.map(([name, url]) => (
                <li key={name}><a className="link-underline" href={url} target="_blank" rel="noopener noreferrer">{name}</a></li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-3 py-6 text-xs text-[#a9a092] md:flex-row md:items-center md:justify-between">
          <p>© {year} {settings.brandName}. Property information is provided by {settings.developerName} and may change; confirm all details before purchase.</p>
          <ul className="flex gap-6">
            <li><Link className="link-underline" href="/privacy">Privacy</Link></li>
            <li><Link className="link-underline" href="/terms">Terms</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  )
}

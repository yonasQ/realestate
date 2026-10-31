import { Icon, WhatsAppGlyph } from '@/components/ui/Icon'
import { telHref, whatsappHref } from '@/lib/format'
import type { PublicSettings } from '@/lib/queries/settings'

/**
 * Direct contact options. Realtor channels appear only once configured in
 * /admin/settings; the developer's sales office is always shown, clearly labelled.
 */
export function ContactChannels({ settings, className = '', subject }: { settings: PublicSettings; className?: string; subject?: string }) {
  const tel = telHref(settings.phone)
  const wa = whatsappHref(settings.whatsapp, subject ? `Hello, I am interested in ${subject}.` : undefined)
  return (
    <div className={className}>
      {tel || wa || settings.email ? (
        <ul className="space-y-3">
          {tel ? (
            <li><a href={tel} className="group flex items-center gap-3 text-charcoal"><span className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-paper"><Icon name="phone" size={18} /></span><span className="link-underline font-semibold">{settings.phone}</span></a></li>
          ) : null}
          {wa ? (
            <li><a href={wa} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 text-charcoal"><span className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-paper"><WhatsAppGlyph size={18} /></span><span className="link-underline font-semibold">Message on WhatsApp</span></a></li>
          ) : null}
          {settings.email ? (
            <li><a href={`mailto:${settings.email}`} className="group flex items-center gap-3 text-charcoal"><span className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-paper"><Icon name="mail" size={18} /></span><span className="link-underline font-semibold">{settings.email}</span></a></li>
          ) : null}
        </ul>
      ) : null}
      <div className="mt-8 border-l-2 border-bronze pl-5 text-sm leading-relaxed text-stone">
        <p className="font-semibold text-charcoal">{settings.developerName} sales office</p>
        {settings.developerAddress ? <p>{settings.developerAddress}</p> : null}
        <p>
          {settings.developerHotline ? <>Hotline <a className="font-semibold text-charcoal" href={telHref(settings.developerHotline) ?? undefined}>{settings.developerHotline}</a></> : null}
          {settings.developerPhone ? <> · <a className="font-semibold text-charcoal" href={telHref(settings.developerPhone) ?? undefined}>{settings.developerPhone}</a></> : null}
        </p>
      </div>
    </div>
  )
}

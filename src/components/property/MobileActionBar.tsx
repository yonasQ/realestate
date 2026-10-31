import { Icon, WhatsAppGlyph } from '@/components/ui/Icon'
import { telHref, whatsappHref } from '@/lib/format'

/** Compact bottom bar on small screens; the page adds bottom padding so content is never covered. */
export function MobileActionBar({ phone, whatsapp, subject, enquirable }: { phone: string | null; whatsapp: string | null; subject: string; enquirable: boolean }) {
  const tel = telHref(phone)
  const wa = whatsappHref(whatsapp, `Hello, I am interested in ${subject}.`)
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ivory/95 px-4 py-3 backdrop-blur-sm lg:hidden" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
      <div className="flex gap-2">
        {enquirable ? <a href="#inquire" className="btn btn-primary min-h-12 flex-1">Inquire or book viewing</a> : null}
        {wa ? (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-outline min-h-12 w-12 px-0" aria-label="Message on WhatsApp"><WhatsAppGlyph size={20} /></a>
        ) : null}
        {tel ? (
          <a href={tel} className="btn btn-outline min-h-12 w-12 px-0" aria-label="Call"><Icon name="phone" size={20} /></a>
        ) : null}
      </div>
    </div>
  )
}

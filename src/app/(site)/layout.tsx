import { connection } from 'next/server'
import Script from 'next/script'
import { Footer } from '@/components/site/Footer'
import { HeaderSlot } from '@/components/site/HeaderSlot'
import { getSettings } from '@/lib/queries/settings'

/**
 * Public pages render per request (no build-time database access needed), while
 * their data comes from Next's data cache (unstable_cache, tagged) so a page view
 * normally costs zero database queries. Admin edits expire the tags immediately.
 */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  await connection()
  const settings = await getSettings()
  const plausible = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN
  return (
    <>
      <HeaderSlot brandName={settings.brandName} brandTagline={settings.brandTagline} />
      <main id="main">{children}</main>
      <Footer settings={settings} />
      {plausible ? (
        <Script
          defer
          data-domain={plausible}
          src={process.env.NEXT_PUBLIC_PLAUSIBLE_SRC || 'https://plausible.io/js/script.js'}
          strategy="afterInteractive"
        />
      ) : null}
    </>
  )
}

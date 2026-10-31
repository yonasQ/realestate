import type { Metadata, Viewport } from 'next'
import { Fraunces, Manrope } from 'next/font/google'
import { siteUrl } from '@/lib/seo/site'
import './globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  axes: ['opsz'],
})
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' })

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: 'New homes in Addis Ababa', template: '%s' },
  description: 'Apartments and commercial shops for sale in new developments across Addis Ababa. Request details or book a site viewing.',
  formatDetection: { telephone: false },
  openGraph: { type: 'website', locale: 'en_ET', images: [{ url: '/og', width: 1200, height: 630 }] },
  twitter: { card: 'summary_large_image', images: ['/og'] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
}

export const viewport: Viewport = {
  themeColor: '#f6f1e8',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${manrope.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  )
}

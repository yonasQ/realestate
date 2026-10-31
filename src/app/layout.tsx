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
  formatDetection: { telephone: false },
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

import type { NextConfig } from 'next'

const isProd = process.env.NODE_ENV === 'production'
const plausibleSrc = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN
  ? new URL(process.env.NEXT_PUBLIC_PLAUSIBLE_SRC || 'https://plausible.io/js/script.js').origin
  : ''
const turnstile = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? 'https://challenges.cloudflare.com' : ''

/**
 * CSP note: Next.js injects inline bootstrap scripts, so without per-request nonces
 * (which would force every page to render dynamically and disable ISR) script-src
 * needs 'unsafe-inline'. XSS exposure is limited by React's escaping, no
 * dangerouslySetInnerHTML except JSON-LD serialised with escaping, and no
 * third-party scripts beyond the opt-in analytics/Turnstile origins below.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"} ${plausibleSrc} ${turnstile}`.trim(),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
  "font-src 'self'",
  `connect-src 'self' ${plausibleSrc} ${turnstile}`.trim(),
  `frame-src https://www.openstreetmap.org ${turnstile}`.trim(),
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(isProd ? ['upgrade-insecure-requests'] : []),
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ...(isProd ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }] : []),
]

const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  // Images are pre-processed into responsive WebP variants at upload time, so the
  // runtime optimizer (and its CPU cost) is not needed.
  images: { unoptimized: true },
  serverExternalPackages: ['sharp'],
  experimental: { serverActions: { bodySizeLimit: '16mb' } },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/admin/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }, { key: 'Cache-Control', value: 'no-store' }] },
    ]
  },
}

export default config

import 'server-only'
import { createHmac } from 'node:crypto'
import { env } from '@/lib/env'

type HeaderBag = { get(name: string): string | null }

/**
 * Client IP for rate limiting. X-Forwarded-For is trusted only when TRUST_PROXY
 * is set (i.e. a proxy we control overwrites it); otherwise it is attacker-controlled.
 * We take the right-most entry, which is the one appended by our own proxy.
 */
export function clientIp(headers: HeaderBag): string {
  if (env().TRUST_PROXY) {
    const xff = headers.get('x-forwarded-for')
    if (xff) {
      const parts = xff.split(',').map((s) => s.trim()).filter(Boolean)
      const last = parts[parts.length - 1]
      if (last) return last.slice(0, 64)
    }
    const real = headers.get('x-real-ip')
    if (real) return real.trim().slice(0, 64)
    return 'unknown'
  }
  // Untrusted mode (local dev / misconfigured proxy): still bucket by the header so
  // all visitors don't share one limit, accepting that it is spoofable. Production
  // deployments must set TRUST_PROXY=true behind their reverse proxy.
  return (headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'direct').slice(0, 64)
}

/** Keyed hash so stored IP fingerprints cannot be reversed by brute force without APP_SECRET. */
export function hashIdentifier(value: string, purpose: string): string {
  return createHmac('sha256', env().APP_SECRET).update(`${purpose}:${value}`).digest('base64url').slice(0, 32)
}

/**
 * CSRF defence for cookie-free JSON endpoints and any state-changing route:
 * require a same-origin Origin header (or Sec-Fetch-Site same-origin).
 */
export function isSameOrigin(headers: HeaderBag): boolean {
  const site = headers.get('sec-fetch-site')
  if (site && site !== 'same-origin' && site !== 'none') return false
  const origin = headers.get('origin')
  if (!origin) return site === 'same-origin'
  try {
    const expected = new URL(env().SITE_URL)
    const actual = new URL(origin)
    if (actual.origin === expected.origin) return true
    // Behind a proxy the Host header reflects the public host.
    const host = headers.get('x-forwarded-host') ?? headers.get('host')
    return Boolean(host && actual.host === host && (env().NODE_ENV !== 'production' || actual.protocol === 'https:'))
  } catch {
    return false
  }
}

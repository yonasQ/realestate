import 'server-only'
import { env } from '@/lib/env'
import { log } from '@/lib/log'

/** Returns true when Turnstile is disabled or the token verifies. Fails closed on verification errors. */
export async function verifyTurnstile(token: string | undefined, ip: string | null): Promise<boolean> {
  const secret = env().TURNSTILE_SECRET_KEY
  if (!secret) return true
  if (!token) return false
  try {
    const body = new URLSearchParams({ secret, response: token })
    if (ip && ip !== 'unknown' && ip !== 'direct') body.set('remoteip', ip)
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(5000),
    })
    const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] }
    if (!data.success) log.warn('turnstile.rejected', { codes: data['error-codes'] })
    return Boolean(data.success)
  } catch (err) {
    log.error('turnstile.verify_failed', { err })
    return false
  }
}

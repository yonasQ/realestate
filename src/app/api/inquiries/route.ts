import { after } from 'next/server'
import { deliverInquiry } from '@/lib/inquiries/delivery'
import { InquiryRejectedError, createInquiry } from '@/lib/inquiries/service'
import { log } from '@/lib/log'
import { RULES, hit } from '@/lib/security/rate-limit'
import { clientIp, hashIdentifier, isSameOrigin } from '@/lib/security/request'
import { verifyTurnstile } from '@/lib/security/turnstile'
import { MIN_FILL_MS, fieldErrors, inquiryInputSchema } from '@/lib/validation/inquiry'

export const dynamic = 'force-dynamic'
const MAX_BODY_BYTES = 16 * 1024

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } })
}

export async function POST(req: Request) {
  const started = Date.now()
  if (!isSameOrigin(req.headers)) return json(403, { ok: false, error: 'Request origin not allowed.' })
  if (!(req.headers.get('content-type') ?? '').startsWith('application/json')) {
    return json(415, { ok: false, error: 'Unsupported content type.' })
  }
  const declared = Number(req.headers.get('content-length') ?? 0)
  if (declared > MAX_BODY_BYTES) return json(413, { ok: false, error: 'Request too large.' })

  const ip = clientIp(req.headers)
  const ipHash = hashIdentifier(ip, 'ip')
  for (const rule of [RULES.inquiryPerIp, RULES.inquiryPerIpDaily]) {
    const r = await hit(rule, ipHash)
    if (!r.allowed) {
      log.warn('inquiry.rate_limited', { rule: rule.name, ipHash })
      return json(429, { ok: false, error: 'Too many requests. Please try again later.' }, { 'Retry-After': String(r.retryAfterSeconds) })
    }
  }

  let raw: unknown
  try {
    const text = await req.text()
    if (text.length > MAX_BODY_BYTES) return json(413, { ok: false, error: 'Request too large.' })
    raw = JSON.parse(text)
  } catch {
    return json(400, { ok: false, error: 'Malformed request.' })
  }

  const parsed = inquiryInputSchema.safeParse(raw)
  if (!parsed.success) {
    return json(422, { ok: false, error: 'Please check the highlighted fields.', fields: fieldErrors(parsed.error) })
  }
  const input = parsed.data

  // Bot heuristics. Generic error: don't teach bots which check failed.
  if (input.website || (input.elapsedMs !== undefined && input.elapsedMs < MIN_FILL_MS)) {
    log.warn('inquiry.spam_rejected', { ipHash, honeypot: Boolean(input.website), elapsedMs: input.elapsedMs })
    return json(400, { ok: false, error: 'Your request could not be accepted. Please wait a moment and try again.' })
  }
  if (!(await verifyTurnstile(input.turnstileToken, ip))) {
    return json(400, { ok: false, error: 'The security check failed. Please refresh the page and try again.' })
  }

  try {
    const result = await createInquiry(input, { ipHash, userAgent: req.headers.get('user-agent') })
    log.info('inquiry.accepted', { inquiryId: result.id, type: input.type, created: result.created, ms: Date.now() - started })
    // Notify after the response is sent; the stored row is the source of truth and
    // the cron retry picks it up if this process dies before delivery completes.
    if (result.created) {
      after(async () => {
        try {
          await deliverInquiry(result.id)
        } catch (err) {
          log.error('inquiry.delivery_after_failed', { inquiryId: result.id, err })
        }
      })
    }
    return json(result.created ? 201 : 200, { ok: true, reference: result.reference, duplicate: !result.created })
  } catch (err) {
    if (err instanceof InquiryRejectedError) {
      return json(err.status, { ok: false, error: err.message, fields: err.fields })
    }
    log.error('inquiry.store_failed', { err, ms: Date.now() - started })
    return json(503, { ok: false, error: 'We could not save your request right now. Please try again in a minute or call instead.' })
  }
}

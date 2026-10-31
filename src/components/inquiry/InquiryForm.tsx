'use client'

import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { Icon } from '@/components/ui/Icon'
import {
  CONTACT_METHOD_LABELS,
  CONTACT_METHODS,
  VIEWING_WINDOW_LABELS,
  VIEWING_WINDOWS,
  type ContactMethod,
  type InquiryType,
} from '@/lib/domain'
import { addisToday, fieldErrors, inquiryInputSchema } from '@/lib/validation/inquiry'
import { Turnstile } from './Turnstile'

export type InquirySubjects = {
  properties: { slug: string; title: string; devName: string }[]
  developments: { slug: string; name: string }[]
}

type Props = {
  /** Which tab is selected initially. */
  defaultMode?: 'inquiry' | 'viewing'
  /** Lock the form to one listing or development (detail pages). */
  fixedSubject?: { kind: 'property' | 'development'; slug: string; label: string }
  subjects?: InquirySubjects
  defaultSubject?: string
  compact?: boolean
  idPrefix?: string
}

type Status =
  | { state: 'idle' }
  | { state: 'submitting' }
  | { state: 'success'; reference: string; type: InquiryType }
  | { state: 'error'; message: string; retryable: boolean }

const REQUEST_TIMEOUT_MS = 15_000
const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)

const noopSubscribe = () => () => {}

function tomorrowInAddis(): string {
  const t = new Date(`${addisToday()}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() + 1)
  return t.toISOString().slice(0, 10)
}

function newKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
        (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0]! & (15 >> (Number(c) / 4)))).toString(16),
      )
}

export function InquiryForm({ defaultMode = 'inquiry', fixedSubject, subjects, defaultSubject, compact = false, idPrefix }: Props) {
  const uid = useId()
  const id = (name: string) => `${idPrefix ?? uid}-${name}`
  const [mode, setMode] = useState<'inquiry' | 'viewing'>(defaultMode)
  const [status, setStatus] = useState<Status>({ state: 'idle' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [contact, setContact] = useState<ContactMethod>('phone')
  const [turnstileToken, setTurnstileToken] = useState<string>()
  const formRef = useRef<HTMLFormElement>(null)
  const successRef = useRef<HTMLDivElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  // Stable per attempt: retries after a timeout reuse it, so the server stores at most one inquiry.
  const idempotencyKey = useRef<string>('')
  const mountedAt = useRef<number>(0)
  // Client clock only (server-rendered HTML has no min date).
  const minDate = useSyncExternalStore(noopSubscribe, tomorrowInAddis, () => undefined)

  useEffect(() => {
    idempotencyKey.current = newKey()
    mountedAt.current = Date.now()
  }, [])

  useEffect(() => {
    if (status.state === 'success') successRef.current?.focus()
    if (status.state === 'error') errorRef.current?.focus()
  }, [status])

  const isViewing = mode === 'viewing'

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (status.state === 'submitting') return
    const fd = new FormData(e.currentTarget)
    const subject = fixedSubject ? `${fixedSubject.kind}:${fixedSubject.slug}` : String(fd.get('subject') ?? '')
    const [kind, slug] = subject.includes(':') ? (subject.split(':') as [string, string]) : ['', '']
    const type: InquiryType = isViewing ? 'viewing' : kind === 'property' ? 'property' : kind === 'development' ? 'development' : 'general'
    const payload = {
      idempotencyKey: idempotencyKey.current,
      type,
      propertySlug: kind === 'property' ? slug : undefined,
      developmentSlug: kind === 'development' ? slug : undefined,
      name: String(fd.get('name') ?? ''),
      email: String(fd.get('email') ?? ''),
      phone: String(fd.get('phone') ?? ''),
      preferredContact: contact,
      preferredDate: isViewing ? String(fd.get('preferredDate') ?? '') : undefined,
      preferredWindow: isViewing ? String(fd.get('preferredWindow') ?? '') : undefined,
      message: String(fd.get('message') ?? ''),
      consent: fd.get('consent') === 'on',
      website: String(fd.get('website') ?? ''),
      elapsedMs: Math.max(0, Date.now() - mountedAt.current),
      turnstileToken,
      sourcePath: window.location.pathname,
    }

    const parsed = inquiryInputSchema.safeParse(payload)
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error)
      setErrors(errs)
      const first = Object.keys(errs)[0]
      const el = first ? formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`) : null
      el?.focus()
      return
    }
    if (turnstileEnabled && !turnstileToken) {
      setErrors({})
      setStatus({ state: 'error', message: 'Please complete the security check above the submit button.', retryable: true })
      return
    }

    setErrors({})
    setStatus({ state: 'submitting' })
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      const body = (await res.json().catch(() => null)) as
        | { ok: true; reference: string }
        | { ok: false; error: string; fields?: Record<string, string> }
        | null
      if (res.ok && body && body.ok) {
        setStatus({ state: 'success', reference: body.reference, type })
        idempotencyKey.current = newKey()
        mountedAt.current = Date.now()
        formRef.current?.reset()
        return
      }
      if (body && !body.ok && body.fields) setErrors(body.fields)
      const message =
        res.status === 429
          ? 'Too many requests from your connection. Please wait a few minutes and try again, or call instead.'
          : (body && !body.ok && body.error) || 'Something went wrong on our side. Please try again.'
      setStatus({ state: 'error', message, retryable: res.status >= 500 || res.status === 429 })
    } catch {
      setStatus({
        state: 'error',
        message:
          'We could not confirm that your request reached us (the connection timed out or dropped). Please try again. Resubmitting is safe and will not create a duplicate.',
        retryable: true,
      })
    } finally {
      clearTimeout(timer)
    }
  }

  if (status.state === 'success') {
    return (
      <div ref={successRef} tabIndex={-1} role="status" className="border border-line bg-paper p-8 focus:outline-none">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success text-white"><Icon name="check" /></span>
        <h3 className="mt-5 text-2xl">{status.type === 'viewing' ? 'Viewing request received' : 'Inquiry received'}</h3>
        <p className="mt-3 leading-relaxed text-stone">
          Thank you. Your request has been recorded with reference{' '}
          <strong className="font-semibold text-charcoal">{status.reference}</strong>.{' '}
          {status.type === 'viewing'
            ? 'I will contact you to confirm a viewing time. Viewings are confirmed only once we have spoken.'
            : 'I will get back to you, usually within one business day.'}
        </p>
        <button type="button" className="btn btn-outline mt-6" onClick={() => setStatus({ state: 'idle' })}>
          Send another request
        </button>
      </div>
    )
  }

  const err = (name: string) =>
    errors[name] ? (
      <p id={id(`${name}-error`)} className="field-error">{errors[name]}</p>
    ) : null
  const aria = (name: string) => ({
    'aria-invalid': errors[name] ? (true as const) : undefined,
    'aria-describedby': errors[name] ? id(`${name}-error`) : undefined,
    'data-field': name,
  })

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-5" aria-label={isViewing ? 'Viewing request' : 'Inquiry'}>
      <div role="radiogroup" aria-label="Request type" className="grid grid-cols-2 border border-line bg-paper p-1 text-sm font-semibold">
        {(['inquiry', 'viewing'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={`min-h-11 transition-colors ${mode === m ? 'bg-charcoal text-white' : 'text-stone hover:text-charcoal'}`}
          >
            {m === 'inquiry' ? 'Ask a question' : 'Request a viewing'}
          </button>
        ))}
      </div>

      {fixedSubject ? (
        <p className="text-sm text-stone">
          About: <span className="font-semibold text-charcoal">{fixedSubject.label}</span>
        </p>
      ) : subjects ? (
        <div>
          <label htmlFor={id('subject')} className="field-label">
            {isViewing ? 'What would you like to view?' : 'Property or development (optional)'}
          </label>
          <select id={id('subject')} name="subject" className="field" defaultValue={defaultSubject ?? ''} {...aria('propertySlug')}>
            <option value="">{isViewing ? 'Choose a property or development' : 'General inquiry'}</option>
            <optgroup label="Developments">
              {subjects.developments.map((d) => (
                <option key={d.slug} value={`development:${d.slug}`}>{d.name}</option>
              ))}
            </optgroup>
            <optgroup label="Listings">
              {subjects.properties.map((p) => (
                <option key={p.slug} value={`property:${p.slug}`}>{p.title}</option>
              ))}
            </optgroup>
          </select>
          {err('propertySlug') ?? err('developmentSlug')}
        </div>
      ) : null}

      <div className={`grid gap-5 ${compact ? '' : 'sm:grid-cols-2'}`}>
        <div className={compact ? '' : 'sm:col-span-2'}>
          <label htmlFor={id('name')} className="field-label">Full name</label>
          <input id={id('name')} name="name" autoComplete="name" className="field" maxLength={100} required {...aria('name')} />
          {err('name')}
        </div>
        <div>
          <label htmlFor={id('phone')} className="field-label">
            Phone {contact === 'email' ? <span className="font-normal text-stone">(optional)</span> : null}
          </label>
          <input id={id('phone')} name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="09xx xxx xxx" className="field" maxLength={24} {...aria('phone')} />
          {err('phone')}
        </div>
        <div>
          <label htmlFor={id('email')} className="field-label">
            Email {contact !== 'email' ? <span className="font-normal text-stone">(optional)</span> : null}
          </label>
          <input id={id('email')} name="email" type="email" inputMode="email" autoComplete="email" className="field" maxLength={254} {...aria('email')} />
          {err('email')}
        </div>
      </div>

      <fieldset>
        <legend className="field-label">Preferred way to reach you</legend>
        <div className="flex flex-wrap gap-2">
          {CONTACT_METHODS.map((m) => (
            <label key={m} className={`cursor-pointer border px-3.5 py-2 text-sm transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-bronze ${contact === m ? 'border-charcoal bg-charcoal text-white' : 'border-line bg-paper hover:border-charcoal'}`}>
              <input type="radio" name="preferredContact" value={m} checked={contact === m} onChange={() => setContact(m)} className="sr-only" />
              {CONTACT_METHOD_LABELS[m]}
            </label>
          ))}
        </div>
      </fieldset>

      {isViewing ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor={id('preferredDate')} className="field-label">Preferred date</label>
            <input id={id('preferredDate')} name="preferredDate" type="date" min={minDate} className="field" {...aria('preferredDate')} />
            {err('preferredDate') ?? <p className="mt-1.5 text-xs text-stone">Monday to Saturday. I will confirm the exact time with you.</p>}
          </div>
          <div>
            <label htmlFor={id('preferredWindow')} className="field-label">Time of day <span className="font-normal text-stone">(optional)</span></label>
            <select id={id('preferredWindow')} name="preferredWindow" className="field" defaultValue="">
              <option value="">No preference</option>
              {VIEWING_WINDOWS.map((w) => <option key={w} value={w}>{VIEWING_WINDOW_LABELS[w]}</option>)}
            </select>
          </div>
        </div>
      ) : null}

      <div>
        <label htmlFor={id('message')} className="field-label">
          Message {isViewing || fixedSubject ? <span className="font-normal text-stone">(optional)</span> : null}
        </label>
        <textarea
          id={id('message')}
          name="message"
          rows={compact ? 3 : 4}
          maxLength={2000}
          className="field resize-y"
          placeholder={isViewing ? 'Anything I should know before the visit?' : 'Budget, preferred size, timeline, payment questions…'}
          {...aria('message')}
        />
        {err('message')}
      </div>

      {/* Honeypot: visually hidden and removed from the accessibility tree. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div>
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-stone">
          <input type="checkbox" name="consent" className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-charcoal)]" {...aria('consent')} />
          <span>
            I agree to be contacted about this request by phone, email or messaging app, and to my details being shared with Temer Properties where needed to answer it. See the{' '}
            <a href="/privacy" className="font-semibold text-charcoal underline underline-offset-2">privacy notice</a>.
          </span>
        </label>
        {err('consent')}
      </div>

      {turnstileEnabled ? <Turnstile onToken={setTurnstileToken} /> : null}

      {status.state === 'error' ? (
        <div ref={errorRef} tabIndex={-1} role="alert" className="flex gap-3 border border-danger/40 bg-danger/5 p-4 text-sm text-danger focus:outline-none">
          <Icon name="info" size={18} className="mt-0.5 shrink-0" />
          <p>{status.message}</p>
        </div>
      ) : null}

      <button type="submit" className="btn btn-primary w-full" disabled={status.state === 'submitting'} aria-busy={status.state === 'submitting'}>
        {status.state === 'submitting' ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />
            Sending…
          </>
        ) : status.state === 'error' && status.retryable ? (
          'Try again'
        ) : isViewing ? (
          'Request viewing'
        ) : (
          'Send inquiry'
        )}
      </button>
    </form>
  )
}

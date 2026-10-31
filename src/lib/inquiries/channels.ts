import 'server-only'
import { createHmac } from 'node:crypto'
import nodemailer, { type Transporter } from 'nodemailer'
import { env } from '@/lib/env'
import type { Inquiry } from '@/lib/db/schema'
import { CONTACT_METHOD_LABELS, INQUIRY_TYPE_LABELS, VIEWING_WINDOW_LABELS, type ViewingWindow } from '@/lib/domain'
import { formatDate } from '@/lib/format'

/** Thrown for failures that will not succeed on retry (bad config, 4xx from webhook). */
export class PermanentDeliveryError extends Error {}

export type Channel = 'email' | 'webhook'

export function configuredChannels(): Channel[] {
  const e = env()
  const out: Channel[] = []
  if (e.SMTP_HOST && e.SMTP_FROM && e.INQUIRY_NOTIFY_EMAIL) out.push('email')
  if (e.CRM_WEBHOOK_URL && e.CRM_WEBHOOK_SECRET) out.push('webhook')
  return out
}

const g = globalThis as unknown as { __realtorMailer?: Transporter }
function mailer(): Transporter {
  if (!g.__realtorMailer) {
    const e = env()
    g.__realtorMailer = nodemailer.createTransport({
      host: e.SMTP_HOST,
      port: e.SMTP_PORT,
      secure: e.SMTP_SECURE,
      requireTLS: !e.SMTP_SECURE,
      auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASSWORD } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      pool: true,
      maxConnections: 2,
    })
  }
  return g.__realtorMailer
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export function inquirySummaryLines(i: Inquiry): [string, string][] {
  const rows: [string, string][] = [
    ['Reference', i.reference],
    ['Type', INQUIRY_TYPE_LABELS[i.type]],
    ['About', i.subjectLabel ?? 'General inquiry'],
    ['Name', i.name],
    ['Phone', i.phone ?? '—'],
    ['Email', i.email ?? '—'],
    ['Preferred contact', CONTACT_METHOD_LABELS[i.preferredContact]],
  ]
  if (i.preferredDate) rows.push(['Preferred date', formatDate(`${i.preferredDate}T12:00:00Z`, { dateStyle: 'full' })])
  if (i.preferredWindow) rows.push(['Time of day', VIEWING_WINDOW_LABELS[i.preferredWindow as ViewingWindow] ?? i.preferredWindow])
  rows.push(['Received', formatDate(i.createdAt, { dateStyle: 'medium', timeStyle: 'short' }) + ' (Addis Ababa)'])
  return rows
}

export async function sendEmailNotification(i: Inquiry): Promise<void> {
  const e = env()
  const adminUrl = `${e.SITE_URL.replace(/\/$/, '')}/admin/inquiries/${i.id}`
  const rows = inquirySummaryLines(i)
  const subject = `${INQUIRY_TYPE_LABELS[i.type]}: ${i.subjectLabel ?? 'General'} (${i.reference})`.replace(/[\r\n]+/g, ' ')
  const text = [
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    'Message:',
    i.message || '(none)',
    '',
    `Open in admin: ${adminUrl}`,
  ].join('\n')
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">
<h2 style="font-weight:normal">${escapeHtml(subject)}</h2>
<table cellpadding="6" style="border-collapse:collapse">${rows
    .map(([k, v]) => `<tr><td style="color:#666">${escapeHtml(k)}</td><td><strong>${escapeHtml(v)}</strong></td></tr>`)
    .join('')}</table>
<p style="color:#666;margin-top:16px">Message</p>
<p style="white-space:pre-wrap">${escapeHtml(i.message || '(none)')}</p>
<p><a href="${escapeHtml(adminUrl)}">Open in admin</a></p></div>`
  try {
    await mailer().sendMail({
      from: e.SMTP_FROM,
      to: e.INQUIRY_NOTIFY_EMAIL,
      replyTo: i.email ? { name: i.name.replace(/["\r\n<>]/g, ''), address: i.email } : undefined,
      subject,
      text,
      html,
      headers: { 'X-Inquiry-Reference': i.reference },
    })
  } catch (err) {
    const code = (err as { responseCode?: number; code?: string }).responseCode
    // 5xx SMTP replies other than temporary ones are permanent (e.g. 535 bad credentials, 550 rejected recipient).
    if (code && code >= 500 && code !== 554) throw new PermanentDeliveryError(`SMTP ${code}`)
    throw err
  }
}

export function webhookSignature(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
}

export async function sendWebhook(i: Inquiry): Promise<void> {
  const e = env()
  const body = JSON.stringify({
    event: 'inquiry.created',
    id: i.id,
    reference: i.reference,
    type: i.type,
    subject: i.subjectLabel,
    propertyId: i.propertyId,
    developmentId: i.developmentId,
    contact: { name: i.name, email: i.email, phone: i.phone, preferred: i.preferredContact },
    preferredDate: i.preferredDate,
    preferredWindow: i.preferredWindow,
    message: i.message,
    consentAt: i.consentAt,
    createdAt: i.createdAt,
  })
  const ts = Math.floor(Date.now() / 1000).toString()
  const res = await fetch(e.CRM_WEBHOOK_URL!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Receivers should dedupe on this: retries after ambiguous failures resend the same key.
      'Idempotency-Key': i.id,
      'X-Webhook-Timestamp': ts,
      'X-Webhook-Signature': `sha256=${webhookSignature(e.CRM_WEBHOOK_SECRET!, ts, body)}`,
    },
    body,
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  })
  if (res.ok) return
  if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
    throw new PermanentDeliveryError(`Webhook HTTP ${res.status}`)
  }
  throw new Error(`Webhook HTTP ${res.status}`)
}

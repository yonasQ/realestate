import 'server-only'
import { z } from 'zod'

/**
 * Server-side configuration. Parsed lazily so that `next build` and tooling can
 * import modules without a full production environment, while any request that
 * needs a value fails loudly if it is missing or malformed.
 */
const optionalString = z
  .string()
  .trim()
  .transform((v) => (v === '' ? undefined : v))
  .optional()

const boolFromString = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1')

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().url(),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    SITE_URL: z.string().url().default('http://localhost:3000'),
    APP_SECRET: z.string().min(32, 'APP_SECRET must be at least 32 characters'),
    STORAGE_DIR: z.string().default('./storage'),
    TRUST_PROXY: boolFromString,
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

    // Inquiry notification channels (all optional; inquiries are always stored first).
    INQUIRY_NOTIFY_EMAIL: optionalString.pipe(z.string().email().optional()),
    SMTP_HOST: optionalString,
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_SECURE: boolFromString,
    SMTP_USER: optionalString,
    SMTP_PASSWORD: optionalString,
    SMTP_FROM: optionalString,
    CRM_WEBHOOK_URL: optionalString.pipe(z.string().url().optional()),
    CRM_WEBHOOK_SECRET: optionalString,

    CRON_SECRET: optionalString.pipe(z.string().min(24).optional()),

    // Cloudflare Turnstile (optional bot challenge).
    TURNSTILE_SECRET_KEY: optionalString,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: optionalString,
  })
  .superRefine((env, ctx) => {
    if (env.SMTP_HOST && !env.SMTP_FROM) {
      ctx.addIssue({ code: 'custom', path: ['SMTP_FROM'], message: 'SMTP_FROM is required when SMTP_HOST is set' })
    }
    if (env.SMTP_HOST && !env.INQUIRY_NOTIFY_EMAIL) {
      ctx.addIssue({
        code: 'custom',
        path: ['INQUIRY_NOTIFY_EMAIL'],
        message: 'INQUIRY_NOTIFY_EMAIL is required when SMTP_HOST is set',
      })
    }
    if (env.CRM_WEBHOOK_URL && !env.CRM_WEBHOOK_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['CRM_WEBHOOK_SECRET'],
        message: 'CRM_WEBHOOK_SECRET is required when CRM_WEBHOOK_URL is set',
      })
    }
    if (Boolean(env.TURNSTILE_SECRET_KEY) !== Boolean(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)) {
      ctx.addIssue({
        code: 'custom',
        path: ['TURNSTILE_SECRET_KEY'],
        message: 'Set both TURNSTILE_SECRET_KEY and NEXT_PUBLIC_TURNSTILE_SITE_KEY, or neither',
      })
    }
    const loopback = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(env.SITE_URL)
    if (env.NODE_ENV === 'production' && !env.SITE_URL.startsWith('https://') && !loopback) {
      ctx.addIssue({ code: 'custom', path: ['SITE_URL'], message: 'SITE_URL must use https in production' })
    }
  })

export type Env = z.infer<typeof schema>

let cached: Env | undefined

export function env(): Env {
  if (cached) return cached
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Invalid environment configuration: ${issues}`)
  }
  cached = parsed.data
  return cached
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

/** Test hook: re-read process.env on next access. */
export function resetEnvCache(): void {
  cached = undefined
}

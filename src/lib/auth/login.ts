import 'server-only'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { adminUsers, auditLog } from '@/lib/db/schema'
import { log } from '@/lib/log'
import { RULES, hit } from '@/lib/security/rate-limit'
import { hashIdentifier } from '@/lib/security/request'
import { DUMMY_HASH, verifyPassword } from './password'

const LOCK_AFTER_FAILURES = 5
const LOCK_MINUTES = 15
export const GENERIC_LOGIN_ERROR = 'Email or password is incorrect.'

export type LoginResult = { ok: true; userId: string } | { ok: false; error: string }

/** Verifies credentials with per-IP + per-account rate limits and temporary lockout. */
export async function attemptLogin(emailRaw: string, password: string, ip: string): Promise<LoginResult> {
  const email = emailRaw.trim().toLowerCase().slice(0, 254)
  const ipKey = hashIdentifier(ip, 'ip')
  const [byIp, byEmail] = await Promise.all([hit(RULES.loginPerIp, ipKey), hit(RULES.loginPerEmail, hashIdentifier(email, 'email'))])
  if (!byIp.allowed || !byEmail.allowed) {
    log.warn('auth.login_rate_limited', { ipKey })
    return { ok: false, error: 'Too many sign-in attempts. Please wait 15 minutes and try again.' }
  }

  const rows = await db().select().from(adminUsers).where(sql`lower(${adminUsers.email}) = ${email}`).limit(1)
  const user = rows[0]
  // Always run the KDF so timing doesn't reveal whether the account exists.
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH)

  if (!user || user.disabledAt) {
    log.warn('auth.login_failed', { reason: 'unknown_or_disabled', ipKey })
    return { ok: false, error: GENERIC_LOGIN_ERROR }
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    log.warn('auth.login_locked', { userId: user.id })
    return { ok: false, error: 'This account is temporarily locked after repeated failed attempts. Try again in 15 minutes.' }
  }
  if (!valid) {
    // Atomic increment; lock when the threshold is reached.
    await db().execute(sql`
      UPDATE admin_users SET
        failed_login_count = failed_login_count + 1,
        locked_until = CASE WHEN failed_login_count + 1 >= ${LOCK_AFTER_FAILURES}
                            THEN now() + make_interval(mins => ${LOCK_MINUTES}) ELSE locked_until END,
        updated_at = now()
      WHERE id = ${user.id}`)
    log.warn('auth.login_failed', { reason: 'bad_password', userId: user.id })
    return { ok: false, error: GENERIC_LOGIN_ERROR }
  }

  await db()
    .update(adminUsers)
    .set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(adminUsers.id, user.id))
  await db().insert(auditLog).values({ actorId: user.id, action: 'login', entityType: 'admin_user', entityId: user.id })
  log.info('auth.login_succeeded', { userId: user.id })
  return { ok: true, userId: user.id }
}

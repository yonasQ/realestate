import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { and, eq, gt, isNull, lt, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { adminUsers, sessions } from '@/lib/db/schema'
import type { AdminRole } from '@/lib/domain'
import { isProduction } from '@/lib/env'
import { clientIp, hashIdentifier } from '@/lib/security/request'

const ABSOLUTE_TTL_MS = 7 * 24 * 3600 * 1000 // re-login weekly
const IDLE_TTL_MS = 12 * 3600 * 1000 // or after 12h of inactivity
const TOUCH_INTERVAL_MS = 5 * 60 * 1000

export function sessionCookieName(): string {
  // __Host- prefix: Secure, Path=/, no Domain; prevents subdomain cookie injection.
  return isProduction() ? '__Host-admin_session' : 'admin_session'
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export type AdminSession = { userId: string; email: string; name: string; role: AdminRole; sessionId: string }

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString('base64url')
  const h = await headers()
  const now = Date.now()
  await db().insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt: new Date(now + ABSOLUTE_TTL_MS),
    lastSeenAt: new Date(now),
    ipHash: hashIdentifier(clientIp(h), 'ip'),
    userAgent: h.get('user-agent')?.slice(0, 300) ?? null,
  })
  // Housekeeping: expired sessions are useless; delete opportunistically.
  await db().delete(sessions).where(lt(sessions.expiresAt, new Date(now)))
  ;(await cookies()).set(sessionCookieName(), token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/',
    maxAge: ABSOLUTE_TTL_MS / 1000,
  })
}

/** Validates the session cookie against the database (revocable, never trusted client-side). */
export const getSession = cache(async (): Promise<AdminSession | null> => {
  const token = (await cookies()).get(sessionCookieName())?.value
  if (!token || token.length > 100) return null
  const id = hashToken(token)
  const now = new Date()
  const rows = await db()
    .select({
      sessionId: sessions.id,
      lastSeenAt: sessions.lastSeenAt,
      userId: adminUsers.id,
      email: adminUsers.email,
      name: adminUsers.name,
      role: adminUsers.role,
    })
    .from(sessions)
    .innerJoin(adminUsers, eq(adminUsers.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, now), isNull(adminUsers.disabledAt)))
    .limit(1)
  const s = rows[0]
  if (!s) return null
  if (now.getTime() - s.lastSeenAt.getTime() > IDLE_TTL_MS) {
    await db().delete(sessions).where(eq(sessions.id, id))
    return null
  }
  if (now.getTime() - s.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db().update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, id))
  }
  return { sessionId: s.sessionId, userId: s.userId, email: s.email, name: s.name, role: s.role }
})

/** Guard for every admin page AND every server action (layouts alone don't protect actions). */
export async function requireAdmin(role?: AdminRole): Promise<AdminSession> {
  const s = await getSession()
  if (!s) redirect('/admin/login')
  if (role === 'admin' && s.role !== 'admin') redirect('/admin?error=forbidden')
  return s
}

export async function destroySession(): Promise<void> {
  const jar = await cookies()
  const token = jar.get(sessionCookieName())?.value
  if (token) await db().delete(sessions).where(eq(sessions.id, hashToken(token)))
  jar.delete(sessionCookieName())
}

export async function revokeOtherSessions(userId: string, keepSessionId: string): Promise<void> {
  await db().delete(sessions).where(and(eq(sessions.userId, userId), sql`${sessions.id} <> ${keepSessionId}`))
}

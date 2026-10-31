'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { attemptLogin } from '@/lib/auth/login'
import { createSession, destroySession } from '@/lib/auth/session'
import { clientIp } from '@/lib/security/request'

export type LoginState = { error?: string; email?: string }

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get('email') ?? '')
  const password = String(form.get('password') ?? '')
  if (!email || !password || password.length > 200) return { error: 'Enter your email and password.', email }
  const result = await attemptLogin(email, password, clientIp(await headers()))
  if (!result.ok) return { error: result.error, email }
  await createSession(result.userId)
  redirect('/admin')
}

export async function logoutAction(): Promise<void> {
  await destroySession()
  redirect('/admin/login')
}

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = { title: 'Sign in · Admin', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  if (await getSession()) redirect('/admin')
  return (
    <main className="flex min-h-dvh items-center justify-center bg-sand/50 px-4">
      <div className="w-full max-w-sm bg-paper p-8 shadow-[0_0_0_1px_var(--color-line)]">
        <p className="eyebrow">Admin</p>
        <h1 className="mt-2 text-3xl">Sign in</h1>
        <p className="mt-2 text-sm text-stone">Authorised staff only.</p>
        <div className="mt-8"><LoginForm /></div>
      </div>
    </main>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { logoutAction } from '../login/actions'
import { AdminNav } from '@/components/admin/AdminNav'
import { requireAdmin } from '@/lib/auth/session'
import { dashboardStats } from '@/lib/admin/queries'

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin()
  const stats = await dashboardStats()
  return (
    <div className="min-h-dvh bg-[#f3eee5] lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="border-b border-line bg-charcoal text-white lg:sticky lg:top-0 lg:h-dvh lg:border-b-0">
        <div className="flex items-center justify-between px-5 py-5 lg:block">
          <Link href="/admin" className="font-display text-xl">Admin</Link>
          <Link href="/" className="text-xs text-white/60 underline underline-offset-2 lg:mt-1 lg:block" target="_blank">View website ↗</Link>
        </div>
        <AdminNav newInquiries={stats.new_inquiries ?? 0} isAdmin={session.role === 'admin'} />
        <div className="hidden border-t border-white/10 px-5 py-4 text-xs text-white/60 lg:absolute lg:inset-x-0 lg:bottom-0 lg:block">
          <p className="truncate text-white/85">{session.name}</p>
          <p className="truncate">{session.email} · {session.role}</p>
          <form action={logoutAction} className="mt-3"><button className="underline underline-offset-2" type="submit">Sign out</button></form>
        </div>
      </aside>
      <div className="min-w-0">
        <div className="flex justify-end px-5 pt-4 lg:hidden">
          <form action={logoutAction}><button className="text-sm underline" type="submit">Sign out</button></form>
        </div>
        <main id="main" className="mx-auto max-w-6xl px-5 py-8 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  )
}

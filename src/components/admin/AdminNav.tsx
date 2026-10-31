'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function AdminNav({ newInquiries, isAdmin }: { newInquiries: number; isAdmin: boolean }) {
  const pathname = usePathname()
  const items = [
    { href: '/admin', label: 'Dashboard', exact: true },
    { href: '/admin/inquiries', label: 'Inquiries', badge: newInquiries },
    { href: '/admin/properties', label: 'Listings' },
    { href: '/admin/developments', label: 'Developments' },
    ...(isAdmin ? [{ href: '/admin/settings', label: 'Site settings' }] : []),
    { href: '/admin/account', label: 'My account' },
  ]
  return (
    <nav aria-label="Admin" className="overflow-x-auto px-3 pb-3 lg:px-3 lg:pb-0">
      <ul className="flex gap-1 lg:flex-col">
        {items.map((i) => {
          const active = i.exact ? pathname === i.href : pathname.startsWith(i.href)
          return (
            <li key={i.href}>
              <Link href={i.href} aria-current={active ? 'page' : undefined} className={`flex items-center justify-between gap-3 whitespace-nowrap px-3 py-2.5 text-sm ${active ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}>
                {i.label}
                {i.badge ? <span className="rounded-full bg-bronze-light px-2 text-xs font-semibold text-charcoal">{i.badge}</span> : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

'use client'

import { usePathname } from 'next/navigation'
import { Header } from './Header'

/** Pages with a full-bleed dark hero get a transparent header until scrolled. */
const OVERLAY_ROUTES = [/^\/$/, /^\/developments\/[^/]+$/]

export function HeaderSlot(props: { brandName: string; brandTagline: string | null }) {
  const pathname = usePathname()
  return <Header {...props} overlay={OVERLAY_ROUTES.some((r) => r.test(pathname))} />
}

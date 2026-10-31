'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/ui/Icon'

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/properties', label: 'Properties' },
  { href: '/developments', label: 'Developments' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
]

export function Header({ brandName, brandTagline, overlay = false }: { brandName: string; brandTagline: string | null; overlay?: boolean }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close the mobile menu on navigation (adjust state during render, not in an effect).
  const [lastPath, setLastPath] = useState(pathname)
  if (lastPath !== pathname) {
    setLastPath(pathname)
    setOpen(false)
  }
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        menuButton.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  const transparent = overlay && !scrolled && !open
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

  return (
    <>
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-[background-color,box-shadow,color] duration-300 ${
        transparent ? 'bg-transparent text-white' : 'bg-ivory/95 text-charcoal shadow-[0_1px_0_var(--color-line)] backdrop-blur-sm'
      }`}
    >
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:bg-paper focus:px-4 focus:py-2 focus:text-charcoal">
        Skip to content
      </a>
      <div className="container-page flex h-[4.5rem] items-center justify-between gap-6">
        <Link href="/" className="group flex flex-col leading-none" aria-label={`${brandName}, home`}>
          <span className="font-display text-[1.45rem] tracking-[-0.01em]">{brandName}</span>
          {brandTagline ? (
            <span className={`mt-1 hidden text-[0.62rem] font-semibold uppercase tracking-[0.2em] sm:block ${transparent ? 'text-white/75' : 'text-bronze'}`}>
              {brandTagline}
            </span>
          ) : null}
        </Link>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-8 text-[0.84rem] font-semibold tracking-[0.03em]">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  className={`link-underline pb-1 ${isActive(item.href) ? 'bg-[length:100%_1px]' : ''}`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/contact?type=viewing" className={`btn hidden min-h-11 px-5 sm:inline-flex ${transparent ? 'btn-ghost-light' : 'btn-primary'}`}>
            Book a viewing
          </Link>
          <button
            ref={menuButton}
            type="button"
            className="-mr-2 inline-flex h-11 w-11 items-center justify-center lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
          >
            <Icon name={open ? 'close' : 'menu'} size={24} />
            <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
          </button>
        </div>
      </div>

    </header>
      <div id="mobile-menu" hidden={!open} className="fixed inset-x-0 bottom-0 top-[4.5rem] z-40 overflow-y-auto bg-ivory lg:hidden">
        <nav aria-label="Mobile" className="container-page flex min-h-full flex-col py-8">
          <ul className="space-y-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  className="flex items-center justify-between border-b border-line py-4 font-display text-[1.75rem] text-charcoal"
                >
                  {item.label}
                  <Icon name="arrowRight" className="text-bronze" />
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/contact?type=viewing" className="btn btn-primary mt-10 w-full">
            Book a viewing
          </Link>
        </nav>
      </div>
    </>
  )
}

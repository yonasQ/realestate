'use client'

import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      remove: (id: string) => void
    }
  }
}

const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

/** Cloudflare Turnstile widget, loaded only when a site key is configured. */
export function Turnstile({ onToken }: { onToken: (token: string | undefined) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    if (!siteKey || !ref.current) return
    let widgetId: string | undefined
    const mount = () => {
      if (!window.turnstile || !ref.current) return
      widgetId = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        callback: (t: string) => onToken(t),
        'expired-callback': () => onToken(undefined),
        'error-callback': () => onToken(undefined),
      })
    }
    if (window.turnstile) mount()
    else {
      let script = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`)
      if (!script) {
        script = document.createElement('script')
        script.src = SRC
        script.async = true
        document.head.appendChild(script)
      }
      script.addEventListener('load', mount, { once: true })
    }
    return () => {
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
    }
  }, [onToken])
  return <div ref={ref} className="min-h-[65px]" />
}

'use client'

import { useState, useSyncExternalStore } from 'react'
import { Icon, WhatsAppGlyph } from '@/components/ui/Icon'

const noopSubscribe = () => () => {}

export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle')
  const text = `${title} ${url}`
  const canShare = useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator.share === 'function',
    () => false,
  )

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied('copied')
    } catch {
      setCopied('failed')
    }
    setTimeout(() => setCopied('idle'), 2500)
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, url })
    } catch {
      /* user cancelled */
    }
  }

  const btn = 'inline-flex h-10 items-center gap-2 border border-line bg-paper px-3 text-xs font-semibold uppercase tracking-[0.1em] hover:border-charcoal'
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs font-semibold uppercase tracking-[0.14em] text-stone">Share</span>
      <button type="button" onClick={copy} className={btn}>
        <Icon name={copied === 'copied' ? 'check' : 'link'} size={16} />
        <span aria-live="polite">{copied === 'copied' ? 'Link copied' : copied === 'failed' ? 'Copy failed' : 'Copy link'}</span>
      </button>
      <a className={btn} href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
        <WhatsAppGlyph size={16} /> WhatsApp
      </a>
      <a className={btn} href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`} target="_blank" rel="noopener noreferrer">
        Telegram
      </a>
      <a className={btn} href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">
        Facebook
      </a>
      {canShare ? (
        <button type="button" onClick={nativeShare} className={`${btn} md:hidden`}>
          <Icon name="share" size={16} /> More
        </button>
      ) : null}
    </div>
  )
}

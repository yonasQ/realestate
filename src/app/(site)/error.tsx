'use client'

import Link from 'next/link'
import { useEffect } from 'react'

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])
  return (
    <div className="container-page flex min-h-[70vh] flex-col items-start justify-center py-36">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="mt-4 text-4xl md:text-5xl">This page could not be loaded</h1>
      <p className="mt-4 max-w-lg text-lg text-stone">
        A temporary problem stopped the page from loading. Please try again. If it keeps happening, you can still reach me through the contact page.
      </p>
      {error.digest ? <p className="mt-2 text-xs text-stone">Reference: {error.digest}</p> : null}
      <div className="mt-8 flex gap-3">
        <button type="button" onClick={reset} className="btn btn-primary">Try again</button>
        <Link href="/contact" className="btn btn-outline">Contact</Link>
      </div>
    </div>
  )
}

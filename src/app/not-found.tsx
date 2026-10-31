import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-start justify-center bg-ivory px-6 md:px-16">
      <p className="eyebrow">404</p>
      <h1 className="mt-4 text-4xl md:text-6xl">This page isn’t available</h1>
      <p className="mt-4 max-w-lg text-lg text-stone">The listing may have been sold, withdrawn or moved. Browse current properties, or contact me and I will help you find something similar.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/properties" className="btn btn-primary">Browse properties</Link>
        <Link href="/contact" className="btn btn-outline">Contact</Link>
      </div>
    </main>
  )
}

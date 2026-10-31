export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <article className="container-page max-w-3xl pb-24 pt-32 md:pt-40">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-4 text-4xl md:text-5xl">{title}</h1>
      <p className="mt-3 text-sm text-stone">Last updated {updated}</p>
      <div className="mt-10 space-y-6 leading-relaxed text-ink [&_h2]:mt-12 [&_h2]:text-2xl [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-2">{children}</div>
    </article>
  )
}

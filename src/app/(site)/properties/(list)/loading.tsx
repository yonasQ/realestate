export default function Loading() {
  return (
    <div className="container-page pb-20 pt-36" role="status" aria-label="Loading properties">
      <div className="h-12 w-2/3 animate-pulse bg-sand" />
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="bg-paper shadow-[0_0_0_1px_var(--color-line)]">
            <div className="aspect-[4/3] animate-pulse bg-sand" />
            <div className="space-y-3 p-6">
              <div className="h-3 w-1/3 animate-pulse bg-sand" />
              <div className="h-6 w-3/4 animate-pulse bg-sand" />
              <div className="h-4 w-1/2 animate-pulse bg-sand" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

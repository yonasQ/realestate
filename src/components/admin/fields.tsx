import type { ReactNode } from 'react'

type Common = { name: string; label: string; error?: string; hint?: ReactNode; className?: string }

function Wrap({ name, label, error, hint, className = '', children }: Common & { children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={`f-${name}`} className="field-label">{label}</label>
      {children}
      {error ? <p id={`f-${name}-err`} className="field-error">{error}</p> : hint ? <p className="mt-1 text-xs text-stone">{hint}</p> : null}
    </div>
  )
}

const a11y = (name: string, error?: string) => ({
  id: `f-${name}`,
  name,
  'aria-invalid': error ? (true as const) : undefined,
  'aria-describedby': error ? `f-${name}-err` : undefined,
})

export function TextField(p: Common & { defaultValue?: string | number | null; type?: string; required?: boolean; maxLength?: number; placeholder?: string; inputMode?: 'numeric' | 'decimal' | 'text' | 'tel' | 'email' | 'url' }) {
  return (
    <Wrap {...p}>
      <input {...a11y(p.name, p.error)} type={p.type ?? 'text'} defaultValue={p.defaultValue ?? ''} required={p.required} maxLength={p.maxLength} placeholder={p.placeholder} inputMode={p.inputMode} className="field" />
    </Wrap>
  )
}

export function TextArea(p: Common & { defaultValue?: string | null; rows?: number; maxLength?: number }) {
  return (
    <Wrap {...p}>
      <textarea {...a11y(p.name, p.error)} defaultValue={p.defaultValue ?? ''} rows={p.rows ?? 4} maxLength={p.maxLength} className="field resize-y" />
    </Wrap>
  )
}

export function Select(p: Common & { defaultValue?: string | null; options: { value: string; label: string }[] }) {
  return (
    <Wrap {...p}>
      <select {...a11y(p.name, p.error)} defaultValue={p.defaultValue ?? ''} className="field">
        {p.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Wrap>
  )
}

export function Checkbox({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 accent-[var(--color-charcoal)]" />
      {label}
    </label>
  )
}

export function Fieldset({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <fieldset className="border border-line bg-paper p-5 sm:p-6">
      <legend className="px-1 font-display text-xl text-charcoal">{title}</legend>
      {description ? <p className="mb-4 text-sm text-stone">{description}</p> : null}
      <div className="grid gap-5 sm:grid-cols-2">{children}</div>
    </fieldset>
  )
}

export function FormStatus({ state, pending = false }: { state: { ok?: boolean; error?: string; message?: string }; pending?: boolean }) {
  // Hide the previous outcome while a new submission is in flight, so it can't be mistaken for the new result.
  if (pending) return <p role="status" className="sr-only">Saving…</p>
  if (state.error) return <p role="alert" className="border border-danger/40 bg-danger/5 p-3 text-sm text-danger">{state.error}</p>
  if (state.ok && state.message) return <p role="status" className="border border-success/40 bg-success/5 p-3 text-sm text-success">{state.message}</p>
  return null
}

export function StatusBadge({ status }: { status: string }) {
  const tone: Record<string, string> = {
    published: 'bg-success/10 text-success border-success/30',
    draft: 'bg-sand text-ink border-line',
    archived: 'bg-stone/10 text-stone border-stone/30',
    new: 'bg-bronze/10 text-bronze border-bronze/40',
    contacted: 'bg-sand text-ink border-line',
    viewing_scheduled: 'bg-success/10 text-success border-success/30',
    closed: 'bg-stone/10 text-stone border-stone/30',
    spam: 'bg-danger/10 text-danger border-danger/30',
    delivered: 'bg-success/10 text-success border-success/30',
    failed: 'bg-danger/10 text-danger border-danger/30',
    pending: 'bg-sand text-ink border-line',
    processing: 'bg-sand text-ink border-line',
    skipped: 'bg-stone/10 text-stone border-stone/30',
  }
  return <span className={`inline-block border px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-[0.08em] ${tone[status] ?? 'border-line'}`}>{status.replace(/_/g, ' ')}</span>
}

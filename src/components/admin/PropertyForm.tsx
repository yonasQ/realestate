'use client'

import { submitWithoutReset } from './useFormSubmit'
import { useActionState } from 'react'
import { savePropertyAction, type FormState } from '@/app/admin/(protected)/actions'
import type { Property } from '@/lib/db/schema'
import { AVAILABILITIES, AVAILABILITY_LABELS, CONTENT_STATUSES, CURRENCIES, PRICE_MODES, PROPERTY_TYPE_LABELS, PROPERTY_TYPES } from '@/lib/domain'
import { Checkbox, Fieldset, FormStatus, Select, TextArea, TextField } from './fields'

const PRICE_MODE_LABELS = { on_request: 'On request (no price shown)', fixed: 'Fixed price', from: 'From (starting price)', per_sqm_from: 'From, per m²' }

export function PropertyForm({ property, developments }: { property: Property | null; developments: { id: string; name: string; status: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(savePropertyAction, {})
  const e = state.fields ?? {}
  const v = (name: string, fallback: string | number | null | undefined): string => state.values?.[name] ?? (fallback == null ? '' : String(fallback))
  const p = property
  return (
    <form onSubmit={submitWithoutReset(action)} className="space-y-6" noValidate>
      {p ? <input type="hidden" name="id" value={p.id} /> : null}
      <input type="hidden" name="version" value={state.version ?? p?.version ?? 0} />
      <FormStatus state={state} pending={pending} />

      <Fieldset title="Listing">
        <TextField name="title" label="Title" defaultValue={v('title', p?.title)} error={e.title} required maxLength={140} className="sm:col-span-2" />
        <TextField name="slug" label="URL slug" defaultValue={v('slug', p?.slug)} error={e.slug} hint="Lowercase words separated by hyphens. Changing it breaks shared links." />
        <Select name="developmentId" label="Development" defaultValue={v('developmentId', p?.developmentId)} error={e.developmentId} options={[{ value: '', label: 'Choose…' }, ...developments.map((d) => ({ value: d.id, label: `${d.name}${d.status !== 'published' ? ` (${d.status})` : ''}` }))]} />
        <Select name="propertyType" label="Property type" defaultValue={v('propertyType', p?.propertyType ?? 'apartment')} error={e.propertyType} options={PROPERTY_TYPES.map((t) => ({ value: t, label: PROPERTY_TYPE_LABELS[t] }))} />
        <Select name="status" label="Publication status" defaultValue={v('status', p?.status ?? 'draft')} error={e.status} options={CONTENT_STATUSES.map((s) => ({ value: s, label: s }))} hint="Published listings need a summary, size, at least one image and a published development." />
        <Select name="availability" label="Availability" defaultValue={v('availability', p?.availability ?? 'available')} error={e.availability} options={AVAILABILITIES.map((a) => ({ value: a, label: AVAILABILITY_LABELS[a] }))} />
        <TextField name="sortOrder" label="Sort order" defaultValue={v('sortOrder', p?.sortOrder ?? 0)} error={e.sortOrder} inputMode="numeric" hint="Lower numbers appear first." />
        <div className="self-end pb-3"><Checkbox name="featured" label="Feature on homepage" defaultChecked={state.values ? state.values.featured === 'on' : p?.featured} /></div>
      </Fieldset>

      <Fieldset title="Specifications" description="Only enter facts confirmed by the developer. Leave a field empty rather than guessing.">
        <TextField name="bedrooms" label="Bedrooms" defaultValue={v('bedrooms', p?.bedrooms)} error={e.bedrooms} inputMode="numeric" />
        <TextField name="bathrooms" label="Bathrooms" defaultValue={v('bathrooms', p?.bathrooms)} error={e.bathrooms} inputMode="numeric" />
        <TextField name="sizeSqm" label="Size (m²)" defaultValue={v('sizeSqm', p?.sizeSqm)} error={e.sizeSqm} inputMode="decimal" />
        <TextField name="parkingSpaces" label="Parking spaces" defaultValue={v('parkingSpaces', p?.parkingSpaces)} error={e.parkingSpaces} inputMode="numeric" />
        <TextField name="sizeMinSqm" label="Size range: minimum (m²)" defaultValue={v('sizeMinSqm', p?.sizeMinSqm)} error={e.sizeMinSqm} inputMode="decimal" />
        <TextField name="sizeMaxSqm" label="Size range: maximum (m²)" defaultValue={v('sizeMaxSqm', p?.sizeMaxSqm)} error={e.sizeMaxSqm} inputMode="decimal" />
      </Fieldset>

      <Fieldset title="Price" description="Prices are displayed exactly as entered, with the currency. They are never converted.">
        <Select name="priceMode" label="Price type" defaultValue={v('priceMode', p?.priceMode ?? 'on_request')} error={e.priceMode} options={PRICE_MODES.map((m) => ({ value: m, label: PRICE_MODE_LABELS[m] }))} />
        <Select name="priceCurrency" label="Currency" defaultValue={v('priceCurrency', p?.priceCurrency ?? '')} error={e.priceCurrency} options={[{ value: '', label: '—' }, ...CURRENCIES.map((c) => ({ value: c, label: c }))]} />
        <TextField name="priceAmount" label="Amount" defaultValue={v('priceAmount', p?.priceAmount)} error={e.priceAmount} inputMode="decimal" hint="Numbers only, e.g. 12500000" />
      </Fieldset>

      <Fieldset title="Description">
        <TextArea name="summary" label="Summary (cards and search results)" defaultValue={v('summary', p?.summary)} error={e.summary} rows={3} maxLength={400} className="sm:col-span-2" />
        <TextArea name="description" label="Full description (optional; falls back to the development description)" defaultValue={v('description', p?.description)} error={e.description} rows={6} maxLength={8000} className="sm:col-span-2" />
        <TextArea name="highlights" label="Highlights (one per line)" defaultValue={v('highlights', p?.highlights.join('\n'))} error={e.highlights} rows={4} />
        <TextArea name="features" label="Unit features (one per line)" defaultValue={v('features', p?.features.join('\n'))} error={e.features} rows={4} />
      </Fieldset>

      <Fieldset title="Search & sharing">
        <TextField name="seoTitle" label="SEO title (optional)" defaultValue={v('seoTitle', p?.seoTitle)} error={e.seoTitle} maxLength={70} />
        <TextArea name="seoDescription" label="SEO description (optional)" defaultValue={v('seoDescription', p?.seoDescription)} error={e.seoDescription} rows={2} maxLength={170} />
      </Fieldset>

      <Fieldset title="Internal (never shown publicly)">
        <TextField name="sourceUrl" label="Source URL" defaultValue={v('sourceUrl', p?.sourceUrl)} error={e.sourceUrl} type="url" className="sm:col-span-2" />
        <TextArea name="reviewNotes" label="Review notes" defaultValue={v('reviewNotes', p?.reviewNotes)} error={e.reviewNotes} rows={3} className="sm:col-span-2" />
      </Fieldset>

      <div className="sticky bottom-0 -mx-1 flex items-center gap-4 border-t border-line bg-[#f3eee5]/95 px-1 py-4 backdrop-blur-sm">
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? 'Saving…' : p ? 'Save listing' : 'Create draft'}</button>
        {state.error ? <span className="text-sm text-danger">{state.error}</span> : null}
      </div>
    </form>
  )
}

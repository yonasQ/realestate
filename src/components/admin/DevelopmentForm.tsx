'use client'

import { submitWithoutReset } from './useFormSubmit'
import { useActionState } from 'react'
import { saveDevelopmentAction, type FormState } from '@/app/admin/(protected)/actions'
import type { Development } from '@/lib/db/schema'
import { BUILDING_TYPE_LABELS, BUILDING_TYPES, CONSTRUCTION_STAGE_LABELS, CONSTRUCTION_STAGES, CONTENT_STATUSES, CURRENCIES, PRICE_MODES } from '@/lib/domain'
import { Checkbox, Fieldset, FormStatus, Select, TextArea, TextField } from './fields'

const PRICE_MODE_LABELS = { on_request: 'On request (no price shown)', fixed: 'Fixed price', from: 'From (starting price)', per_sqm_from: 'From, per m²' }

export function DevelopmentForm({ development: d }: { development: Development | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveDevelopmentAction, {})
  const e = state.fields ?? {}
  const v = (name: string, fallback: string | number | null | undefined): string => state.values?.[name] ?? (fallback == null ? '' : String(fallback))
  return (
    <form onSubmit={submitWithoutReset(action)} className="space-y-6" noValidate>
      {d ? <input type="hidden" name="id" value={d.id} /> : null}
      <input type="hidden" name="version" value={state.version ?? d?.version ?? 0} />
      <FormStatus state={state} pending={pending} />
      <Fieldset title="Development">
        <TextField name="name" label="Name" defaultValue={v('name', d?.name)} error={e.name} required />
        <TextField name="slug" label="URL slug" defaultValue={v('slug', d?.slug)} error={e.slug} hint="Changing it breaks shared links." />
        <Select name="status" label="Publication status" defaultValue={v('status', d?.status ?? 'draft')} error={e.status} options={CONTENT_STATUSES.map((s) => ({ value: s, label: s }))} hint="Unpublishing a development also hides all of its listings." />
        <Select name="buildingType" label="Building type" defaultValue={v('buildingType', d?.buildingType ?? 'residential')} error={e.buildingType} options={BUILDING_TYPES.map((t) => ({ value: t, label: BUILDING_TYPE_LABELS[t] }))} />
        <TextField name="tagline" label="Tagline" defaultValue={v('tagline', d?.tagline)} error={e.tagline} maxLength={140} />
        <TextField name="sortOrder" label="Sort order" defaultValue={v('sortOrder', d?.sortOrder ?? 0)} error={e.sortOrder} inputMode="numeric" />
        <div className="self-end pb-3"><Checkbox name="featured" label="Feature on homepage" defaultChecked={state.values ? state.values.featured === 'on' : d?.featured} /></div>
      </Fieldset>
      <Fieldset title="Location">
        <TextField name="area" label="Area / neighbourhood" defaultValue={v('area', d?.area)} error={e.area} />
        <TextField name="city" label="City" defaultValue={v('city', d?.city ?? 'Addis Ababa')} error={e.city} />
        <TextField name="addressNote" label="Address note (optional)" defaultValue={v('addressNote', d?.addressNote)} error={e.addressNote} className="sm:col-span-2" />
        <TextField name="latitude" label="Latitude" defaultValue={v('latitude', d?.latitude)} error={e.latitude} inputMode="decimal" />
        <TextField name="longitude" label="Longitude" defaultValue={v('longitude', d?.longitude)} error={e.longitude} inputMode="decimal" />
        <Select name="locationPrecision" label="Pin precision" defaultValue={v('locationPrecision', d?.locationPrecision ?? '')} error={e.locationPrecision} options={[{ value: '', label: 'No map pin' }, { value: 'approximate', label: 'Approximate' }, { value: 'exact', label: 'Exact site' }]} />
      </Fieldset>
      <Fieldset title="Building & timeline" description="Use the developer's confirmed facts. Choose 'Status to be confirmed' when unsure.">
        <TextField name="buildingConfig" label="Configuration (e.g. 2B+G+20+T)" defaultValue={v('buildingConfig', d?.buildingConfig)} error={e.buildingConfig} />
        <Select name="constructionStage" label="Construction stage" defaultValue={v('constructionStage', d?.constructionStage ?? 'not_confirmed')} error={e.constructionStage} options={CONSTRUCTION_STAGES.map((s) => ({ value: s, label: CONSTRUCTION_STAGE_LABELS[s] }))} />
        <TextField name="constructionNote" label="Construction note (shown publicly)" defaultValue={v('constructionNote', d?.constructionNote)} error={e.constructionNote} className="sm:col-span-2" />
        <TextField name="deliveryEstimate" label="Delivery estimate (shown publicly)" defaultValue={v('deliveryEstimate', d?.deliveryEstimate)} error={e.deliveryEstimate} className="sm:col-span-2" />
        <TextField name="unitSizeMin" label="Smallest unit (m²)" defaultValue={v('unitSizeMin', d?.unitSizeMin)} error={e.unitSizeMin} inputMode="decimal" />
        <TextField name="unitSizeMax" label="Largest unit (m²)" defaultValue={v('unitSizeMax', d?.unitSizeMax)} error={e.unitSizeMax} inputMode="decimal" />
        <TextArea name="amenities" label="Amenities (one per line)" defaultValue={v('amenities', d?.amenities.join('\n'))} error={e.amenities} rows={6} />
        <TextArea name="finishingOptions" label="Finishing options (one per line)" defaultValue={v('finishingOptions', d?.finishingOptions.join('\n'))} error={e.finishingOptions} rows={3} />
        <TextField name="brochureUrl" label="Brochure URL (https)" defaultValue={v('brochureUrl', d?.brochureUrl)} error={e.brochureUrl} type="url" className="sm:col-span-2" />
      </Fieldset>
      <Fieldset title="Development pricing (optional)">
        <Select name="priceMode" label="Price type" defaultValue={v('priceMode', d?.priceMode ?? 'on_request')} error={e.priceMode} options={PRICE_MODES.map((m) => ({ value: m, label: PRICE_MODE_LABELS[m] }))} />
        <Select name="priceCurrency" label="Currency" defaultValue={v('priceCurrency', d?.priceCurrency ?? '')} error={e.priceCurrency} options={[{ value: '', label: '—' }, ...CURRENCIES.map((c) => ({ value: c, label: c }))]} />
        <TextField name="priceAmount" label="Amount" defaultValue={v('priceAmount', d?.priceAmount)} error={e.priceAmount} inputMode="decimal" />
      </Fieldset>
      <Fieldset title="Description">
        <TextArea name="summary" label="Summary" defaultValue={v('summary', d?.summary)} error={e.summary} rows={3} maxLength={500} className="sm:col-span-2" />
        <TextArea name="description" label="Description (blank line between paragraphs)" defaultValue={v('description', d?.description)} error={e.description} rows={8} maxLength={10000} className="sm:col-span-2" />
      </Fieldset>
      <Fieldset title="Search & sharing">
        <TextField name="seoTitle" label="SEO title (optional)" defaultValue={v('seoTitle', d?.seoTitle)} error={e.seoTitle} maxLength={70} />
        <TextArea name="seoDescription" label="SEO description (optional)" defaultValue={v('seoDescription', d?.seoDescription)} error={e.seoDescription} rows={2} maxLength={170} />
      </Fieldset>
      <Fieldset title="Internal (never shown publicly)">
        <TextField name="sourceUrl" label="Source URL" defaultValue={v('sourceUrl', d?.sourceUrl)} error={e.sourceUrl} type="url" className="sm:col-span-2" />
        <TextArea name="reviewNotes" label="Review notes" defaultValue={v('reviewNotes', d?.reviewNotes)} error={e.reviewNotes} rows={3} className="sm:col-span-2" />
      </Fieldset>
      <div className="sticky bottom-0 flex items-center gap-4 border-t border-line bg-[#f3eee5]/95 py-4 backdrop-blur-sm">
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? 'Saving…' : d ? 'Save development' : 'Create draft'}</button>
        {state.error ? <span className="text-sm text-danger">{state.error}</span> : null}
      </div>
    </form>
  )
}

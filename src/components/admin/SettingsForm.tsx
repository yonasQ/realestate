'use client'

import { submitWithoutReset } from './useFormSubmit'
import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveSettingsAction, uploadSettingsImageAction, type FormState } from '@/app/admin/(protected)/actions'
import type { SiteSettings } from '@/lib/db/schema'
import { Fieldset, FormStatus, TextArea, TextField } from './fields'

export function SettingsForm({ s }: { s: SiteSettings }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveSettingsAction, {})
  const e = state.fields ?? {}
  const v = (name: string, fallback: string | number | null | undefined): string => state.values?.[name] ?? (fallback == null ? '' : String(fallback))
  const social = s.social ?? {}
  return (
    <form onSubmit={submitWithoutReset(action)} className="space-y-6" noValidate>
      <input type="hidden" name="version" value={Math.max(state.version ?? 0, s.version)} />
      <FormStatus state={state} pending={pending} />
      <Fieldset title="Brand">
        <TextField name="brandName" label="Brand / site name" defaultValue={v('brandName', s.brandName)} error={e.brandName} />
        <TextField name="brandTagline" label="Tagline" defaultValue={v('brandTagline', s.brandTagline)} error={e.brandTagline} />
        <TextField name="heroHeadline" label="Homepage headline" defaultValue={v('heroHeadline', s.heroHeadline)} error={e.heroHeadline} className="sm:col-span-2" />
        <TextArea name="heroSubheadline" label="Homepage introduction" defaultValue={v('heroSubheadline', s.heroSubheadline)} error={e.heroSubheadline} rows={3} className="sm:col-span-2" />
      </Fieldset>
      <Fieldset title="Realtor profile" description="Shown on the homepage, About page and footer. Leave empty fields blank. Never add qualifications or awards you can't evidence.">
        <TextField name="realtorName" label="Your name" defaultValue={v('realtorName', s.realtorName)} error={e.realtorName} />
        <TextField name="realtorTitle" label="Title" defaultValue={v('realtorTitle', s.realtorTitle)} error={e.realtorTitle} />
        <TextArea name="realtorBio" label="Introduction" defaultValue={v('realtorBio', s.realtorBio)} error={e.realtorBio} rows={5} className="sm:col-span-2" />
        <TextArea name="relationshipStatement" label="Relationship with the developer (shown publicly)" defaultValue={v('relationshipStatement', s.relationshipStatement)} error={e.relationshipStatement} rows={4} className="sm:col-span-2" />
      </Fieldset>
      <Fieldset title="Your contact details" description="Phone and WhatsApp numbers enable call and WhatsApp buttons across the site.">
        <TextField name="phone" label="Phone" defaultValue={v('phone', s.phone)} error={e.phone} inputMode="tel" placeholder="+251 9xx xxx xxx" />
        <TextField name="whatsapp" label="WhatsApp number" defaultValue={v('whatsapp', s.whatsapp)} error={e.whatsapp} inputMode="tel" />
        <TextField name="email" label="Public email" defaultValue={v('email', s.email)} error={e.email} inputMode="email" />
        <TextField name="telegram" label="Telegram username" defaultValue={v('telegram', s.telegram)} error={e.telegram} />
        <TextField name="officeAddress" label="Office address" defaultValue={v('officeAddress', s.officeAddress)} error={e.officeAddress} />
        <TextField name="officeHours" label="Office hours" defaultValue={v('officeHours', s.officeHours)} error={e.officeHours} />
      </Fieldset>
      <Fieldset title="Social links (https URLs)">
        <TextField name="facebook" label="Facebook" defaultValue={v('facebook', social.facebook)} error={e.facebook} />
        <TextField name="instagram" label="Instagram" defaultValue={v('instagram', social.instagram)} error={e.instagram} />
        <TextField name="telegramChannel" label="Telegram channel" defaultValue={v('telegramChannel', social.telegram)} error={e.telegramChannel} />
        <TextField name="tiktok" label="TikTok" defaultValue={v('tiktok', social.tiktok)} error={e.tiktok} />
        <TextField name="linkedin" label="LinkedIn" defaultValue={v('linkedin', social.linkedin)} error={e.linkedin} />
        <TextField name="youtube" label="YouTube" defaultValue={v('youtube', social.youtube)} error={e.youtube} />
      </Fieldset>
      <Fieldset title="Developer sales office" description="Shown as a clearly labelled secondary contact.">
        <TextField name="developerName" label="Developer name" defaultValue={v('developerName', s.developerName)} error={e.developerName} />
        <TextField name="developerWebsite" label="Website" defaultValue={v('developerWebsite', s.developerWebsite)} error={e.developerWebsite} />
        <TextField name="developerPhone" label="Phone" defaultValue={v('developerPhone', s.developerPhone)} error={e.developerPhone} />
        <TextField name="developerHotline" label="Hotline" defaultValue={v('developerHotline', s.developerHotline)} error={e.developerHotline} />
        <TextField name="developerEmail" label="Email" defaultValue={v('developerEmail', s.developerEmail)} error={e.developerEmail} />
        <TextField name="developerAddress" label="Address" defaultValue={v('developerAddress', s.developerAddress)} error={e.developerAddress} />
      </Fieldset>
      <div className="sticky bottom-0 flex items-center gap-4 border-t border-line bg-[#f3eee5]/95 py-4 backdrop-blur-sm">
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? 'Saving…' : 'Save settings'}</button>
        {state.error ? <span className="text-sm text-danger">{state.error}</span> : null}
      </div>
    </form>
  )
}

export function SettingsImage({ field, label, thumbKey }: { field: 'realtorPhotoMediaId' | 'heroMediaId'; label: string; thumbKey: string | null }) {
  const router = useRouter()
  const [state, setState] = useState<FormState>({})
  const [pending, start] = useTransition()
  const run = (fd: FormData) =>
    start(async () => {
      setState(await uploadSettingsImageAction(field, fd))
      router.refresh()
    })
  return (
    <div className="flex flex-wrap items-center gap-4 border border-line bg-paper p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {thumbKey ? <img src={`/${thumbKey}`} alt="" width={96} height={72} className="h-18 w-24 object-cover" /> : <div className="flex h-18 w-24 items-center justify-center bg-sand text-xs text-stone">None</div>}
      <div className="flex-1">
        <p className="font-semibold">{label}</p>
        <FormStatus state={state} pending={pending} />
      </div>
      <label className="btn btn-outline min-h-10 cursor-pointer">
        {pending ? 'Uploading…' : 'Upload'}
        <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" disabled={pending} onChange={(ev) => { const f = ev.target.files?.[0]; if (f) { const fd = new FormData(); fd.set('file', f); run(fd) } }} />
      </label>
      {thumbKey ? <button type="button" className="text-sm text-danger underline" disabled={pending} onClick={() => { const fd = new FormData(); fd.set('remove', '1'); run(fd) }}>Remove</button> : null}
    </div>
  )
}

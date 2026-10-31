'use client'

import { submitWithoutReset } from './useFormSubmit'
import { useActionState } from 'react'
import { updateInquiryAction, type FormState } from '@/app/admin/(protected)/actions'
import { INQUIRY_STATUS_LABELS, INQUIRY_STATUSES } from '@/lib/domain'
import { FormStatus } from './fields'

export function InquiryStatusForm({ id, status, notes }: { id: string; status: string; notes: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateInquiryAction, {})
  return (
    <form onSubmit={submitWithoutReset(action)} className="mt-4 space-y-4">
      <input type="hidden" name="id" value={id} />
      <div>
        <label htmlFor="st" className="field-label">Status</label>
        <select id="st" name="status" defaultValue={status} className="field">
          {INQUIRY_STATUSES.map((s) => <option key={s} value={s}>{INQUIRY_STATUS_LABELS[s]}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="notes" className="field-label">Private notes</label>
        <textarea id="notes" name="adminNotes" rows={5} maxLength={4000} defaultValue={notes ?? ''} className="field" />
      </div>
      <FormStatus state={state} pending={pending} />
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>
    </form>
  )
}

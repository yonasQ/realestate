'use client'

import { useActionState } from 'react'
import { changePasswordAction, type FormState } from '@/app/admin/(protected)/actions'
import { FormStatus, TextField } from './fields'

export function PasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changePasswordAction, {})
  const e = state.fields ?? {}
  return (
    <form action={action} className="max-w-md space-y-4 border border-line bg-paper p-6">
      <FormStatus state={state} />
      <TextField name="current" label="Current password" type="password" error={e.current} />
      <TextField name="next" label="New password (12+ characters)" type="password" error={e.next} />
      <TextField name="confirm" label="Confirm new password" type="password" error={e.confirm} />
      <button className="btn btn-primary" disabled={pending}>{pending ? 'Saving…' : 'Change password'}</button>
    </form>
  )
}

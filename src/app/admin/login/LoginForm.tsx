'use client'

import { useActionState } from 'react'
import { loginAction, type LoginState } from './actions'

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {})
  return (
    <form action={action} className="space-y-5">
      {state.error ? <p role="alert" className="border border-danger/40 bg-danger/5 p-3 text-sm text-danger">{state.error}</p> : null}
      <div>
        <label htmlFor="email" className="field-label">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required defaultValue={state.email} className="field" />
      </div>
      <div>
        <label htmlFor="password" className="field-label">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="field" />
      </div>
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
    </form>
  )
}

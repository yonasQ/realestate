'use client'

import { startTransition, type FormEvent } from 'react'

/**
 * Submits a form to a useActionState dispatcher without React 19's automatic form
 * reset. Editors must keep showing the values just saved (a reset would put stale
 * defaults back, and a later save would silently revert the edit).
 */
export function submitWithoutReset(dispatch: (fd: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(() => dispatch(fd))
  }
}

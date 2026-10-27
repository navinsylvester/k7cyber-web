'use client'

import React from 'react'
import { useFormStatus } from 'react-dom'

/* The submit button of a slow K7 form (B-03): approving writes to Dynamics and can take 10 to 20 seconds, so while the action
   runs the button is disabled (`.btn[disabled]`, bundle.css) and says what is happening, and a second click cannot post the
   same decision again. Server-rendered as a plain submit, so the form still posts without script. */

export function SubmitButton({ className = 'btn btn-primary', pendingLabel = 'Recording…', title, children }: { className?: string; pendingLabel?: string; title?: string; children: React.ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <button className={className} type="submit" title={title} disabled={pending} aria-busy={pending || undefined}>
      {pending ? pendingLabel : children}
    </button>
  )
}

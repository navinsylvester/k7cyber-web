'use client'
import Link from 'next/link'
import React, { useState } from 'react'

export type HomeFormField = {
  blockType: string
  name: string
  label?: string | null
  required?: boolean | null
  options?: { label: string; value: string }[] | null
}

const AUTOCOMPLETE: Record<string, string> = { name: 'name', email: 'email', company: 'organization' }

/* 09 · Contact: the design's underlined fields on ink, posted to the form builder (the "Homepage enquiry" form in /admin, whose
   fields, labels and options it renders). Text and email sit two to a row; a textarea takes the full width. */
export const ContactForm: React.FC<{ formId: number | string; fields: HomeFormField[]; submitLabel: string; thanks: string }> = ({
  formId,
  fields,
  submitLabel,
  thanks,
}) => {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null)

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch('/api/form-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form: formId,
          submissionData: fields.map((f) => ({ field: f.name, value: String(data.get(f.name) ?? '') })),
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { errors?: { message?: string }[] } | null
        setStatus({ text: body?.errors?.[0]?.message || 'Something went wrong. Please try again.', error: true })
        return
      }
      form.reset()
      setStatus({ text: thanks, error: false })
    } catch {
      setStatus({ text: 'Something went wrong. Please try again.', error: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="ss-form" id="ss-form" onSubmit={onSubmit} aria-label="Talk to a K7 specialist">
      {fields.map((f) => {
        const id = `ss-${f.name}`
        const label = (
          <label className="m-mono" htmlFor={id}>
            {f.label || f.name}
          </label>
        )
        const required = Boolean(f.required)
        if (f.blockType === 'textarea')
          return (
            <div className="is-wide" key={f.name}>
              {label}
              <textarea className="m-in" id={id} name={f.name} rows={3} required={required} />
            </div>
          )
        if (f.blockType === 'select')
          return (
            <div key={f.name}>
              {label}
              <select className="m-in" id={id} name={f.name} required={required}>
                {(f.options ?? []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )
        if (f.blockType === 'text' || f.blockType === 'email')
          return (
            <div key={f.name}>
              {label}
              <input
                className="m-in"
                id={id}
                name={f.name}
                type={f.blockType === 'email' ? 'email' : 'text'}
                required={required}
                autoComplete={AUTOCOMPLETE[f.name]}
              />
            </div>
          )
        return null
      })}
      <div className="is-wide ss-form-foot">
        <span>
          By submitting, you agree to our <Link href="/privacy-policy">Privacy Policy</Link>.
        </span>
        <button className="m-btn ss-btn ss-btn-lg ss-btn-send" type="submit" disabled={busy}>
          {busy ? 'Sending…' : submitLabel}
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" aria-hidden="true">
            <path d="M4 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
      <p className={`m-mono is-wide ss-status${status?.error ? ' is-error' : ''}`} role="status">
        {status?.text ?? ''}
      </p>
    </form>
  )
}

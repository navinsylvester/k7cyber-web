'use client'
import type { Form as FormType } from '@/payload-types'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { useRouter } from 'next/navigation'
import React, { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'

import { getClientSideURL } from '@/utilities/getURL'

type AnyField = {
  blockType: string
  name: string
  label?: string
  required?: boolean
  width?: number
  defaultValue?: unknown
  options?: { label: string; value: string }[]
  message?: unknown
}

const COUNTRIES = ['India', 'Singapore', 'United Arab Emirates', 'Malaysia', 'Other']

/* Field (design-system/components/Field): label in mono muted, a 2px ink underline that turns signal on focus,
   19px input text, 18px square checkboxes. Errors in acc-ink under the field. */
export const K7Form: React.FC<{ form: FormType; privacyUrl: string; maxWidth?: number }> = ({ form, privacyUrl, maxWidth }) => {
  const { id: formID, confirmationMessage, confirmationType, redirect, submitButtonLabel } = form
  const fields = (form.fields ?? []) as unknown as AnyField[]
  const { register, handleSubmit, formState: { errors } } = useForm()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const onSubmit = useCallback(
    async (data: Record<string, unknown>) => {
      setError(null)
      setBusy(true)
      try {
        const req = await fetch(`${getClientSideURL()}/api/form-submissions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ form: formID, submissionData: Object.entries(data).map(([field, value]) => ({ field, value: String(value ?? '') })) }),
        })
        const res = await req.json()
        if (req.status >= 400) {
          setError(res.errors?.[0]?.message || 'Something went wrong.')
          return
        }
        setDone(true)
        if (confirmationType === 'redirect' && redirect?.url) router.push(redirect.url)
      } catch {
        setError('Something went wrong.')
      } finally {
        setBusy(false)
      }
    },
    [formID, confirmationType, redirect, router],
  )

  if (done && confirmationType === 'message' && confirmationMessage) {
    return (
      <div className="prose" style={{ marginTop: 'clamp(40px, 5cqw, 72px)' }}>
        <RichText data={confirmationMessage as never} />
      </div>
    )
  }

  const checks = fields.filter((f) => f.blockType === 'checkbox')
  const inputs = fields.filter((f) => f.blockType !== 'checkbox')

  const control = (f: AnyField) => {
    const id = `f-${f.name}`
    const reg = register(f.name, { required: f.required ? 'This field is required' : false })
    const star = f.required ? ' *' : ''
    const invalid = errors[f.name] ? ' is-invalid' : ''
    const wide = f.blockType === 'textarea' || f.blockType === 'message' ? ' span-2' : ''
    if (f.blockType === 'message') {
      return (
        <div className="field span-2" key={f.name}>
          <div className="prose">
            <RichText data={f.message as never} />
          </div>
        </div>
      )
    }
    let input: React.ReactNode
    let select = false
    if (f.blockType === 'textarea') input = <textarea id={id} {...reg} />
    else if (f.blockType === 'select') {
      select = true
      input = (
        <select id={id} {...reg} defaultValue="">
          <option value="" disabled>
            Select
          </option>
          {(f.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )
    } else if (f.blockType === 'country') {
      select = true
      input = (
        <select id={id} {...reg} defaultValue="India">
          {COUNTRIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      )
    } else if (f.blockType === 'state') {
      input = <input id={id} type="text" {...reg} />
    } else {
      const type = f.blockType === 'email' ? 'email' : f.blockType === 'number' ? 'number' : f.name.toLowerCase().includes('phone') ? 'tel' : 'text'
      input = <input id={id} type={type} {...reg} min={type === 'number' ? 1 : undefined} />
    }
    return (
      <div className={`field${wide}${invalid}`} key={f.name}>
        <label className="label" htmlFor={id}>
          {f.label}
          {star}
        </label>
        <div className={`control${select ? ' is-select' : ''}`}>{input}</div>
        <span className="field-error">{(errors[f.name]?.message as string) || 'This field is required'}</span>
      </div>
    )
  }

  return (
    <form className="form-grid" id={String(formID)} onSubmit={handleSubmit(onSubmit)} style={{ marginTop: 'clamp(40px, 5cqw, 72px)', maxWidth }} noValidate>
      {inputs.map(control)}
      {checks.length > 0 && (
        <div className="consent span-2">
          {checks.map((f) => (
            <label className={`check${errors[f.name] ? ' is-invalid' : ''}`} key={f.name}>
              <input type="checkbox" {...register(f.name, { required: f.required ? 'Required' : false })} /> {f.label}
              {f.required ? ' *' : ''}
            </label>
          ))}
        </div>
      )}
      <div className="form-foot span-2">
        <a className="link-u" href={privacyUrl}>
          Privacy Policy
        </a>
        {error && <span style={{ color: 'var(--acc)', fontSize: 14 }}>{error}</span>}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {submitButtonLabel || 'Submit'}
        </button>
      </div>
    </form>
  )
}

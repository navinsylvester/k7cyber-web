'use client'
import Link from 'next/link'
import React, { useRef, useState } from 'react'

/* FR-TR-05: lead capture before a gated download. The route verifies the lead and returns the file URL. */
export const LeadButton: React.FC<{ reportId: number; title: string; className?: string; label?: string }> = ({ reportId, title, className = 'btn btn-line btn-sm', label = 'Get the report' }) => {
  const ref = useRef<HTMLDialogElement>(null)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    let bad = false
    form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[required]').forEach((inp) => {
      const ok = inp instanceof HTMLInputElement && inp.type === 'checkbox' ? inp.checked : inp.checkValidity() && inp.value.trim() !== ''
      inp.closest('.field')?.classList.toggle('is-invalid', !ok)
      if (!ok) bad = true
    })
    if (bad) return
    setBusy(true)
    setError(null)
    try {
      const fd = new FormData(form)
      const res = await fetch('/research/threat-reports/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ report: reportId, ...Object.fromEntries(fd.entries()), consent: fd.get('consent') === 'on' }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Something went wrong.')
      setDone(json.url)
      window.location.assign(json.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button className={className} type="button" onClick={() => ref.current?.showModal()}>
        {label} <span aria-hidden="true">→</span>
      </button>
      <dialog className={`lead g-paper${done ? ' is-done' : ''}`} ref={ref} aria-labelledby={`lead-h-${reportId}`} onClick={(e) => e.target === ref.current && ref.current?.close()}>
        <div className="lead-inner">
          <div className="lead-head">
            <span className="label">
              <span className="pixel" aria-hidden="true" /> {title}
            </span>
            <button className="x" type="button" aria-label="Close" onClick={() => ref.current?.close()}>
              ×
            </button>
          </div>
          <form noValidate onSubmit={submit}>
            <div>
              <h2 id={`lead-h-${reportId}`}>Get the report</h2>
              <p style={{ marginTop: 10 }}>Tell us where to send it. The download starts as soon as you submit.</p>
            </div>
            <div className="field">
              <label className="label" htmlFor={`l-name-${reportId}`}>
                Full name
              </label>
              <span className="control">
                <input id={`l-name-${reportId}`} name="name" required autoComplete="name" />
              </span>
              <span className="field-error label">Enter your name</span>
            </div>
            <div className="field">
              <label className="label" htmlFor={`l-email-${reportId}`}>
                Work email
              </label>
              <span className="control">
                <input id={`l-email-${reportId}`} name="email" type="email" required autoComplete="email" placeholder="you@company.com" />
              </span>
              <span className="field-error label">Enter a work email, like you@company.com</span>
            </div>
            <div className="field">
              <label className="label" htmlFor={`l-co-${reportId}`}>
                Company
              </label>
              <span className="control">
                <input id={`l-co-${reportId}`} name="company" required autoComplete="organization" />
              </span>
              <span className="field-error label">Enter your company name</span>
            </div>
            <div className="field">
              <label className="label" htmlFor={`l-country-${reportId}`}>
                Country
              </label>
              <span className="control is-select">
                <select id={`l-country-${reportId}`} name="country" required defaultValue="">
                  <option value="">Select a country</option>
                  {['India', 'Singapore', 'United Arab Emirates', 'Malaysia', 'Japan', 'United States', 'Other'].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </span>
              <span className="field-error label">Select your country</span>
            </div>
            <div className="field">
              <label className="check">
                <input type="checkbox" name="consent" required />{' '}
                <span>
                  K7 may contact me about this report and related products. I can unsubscribe at any time. <Link href="/privacy-policy">Privacy policy</Link>
                </span>
              </label>
              <span className="field-error label">Tick the box to continue</span>
            </div>
            {error && <p style={{ color: 'var(--acc)' }}>{error}</p>}
            <div>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                Download report <span aria-hidden="true">↓</span>
              </button>
            </div>
          </form>
          <div className="lead-done" style={{ flexDirection: 'column', gap: 18 }}>
            <h2>Your download has started</h2>
            <p>
              If it doesn’t start,{' '}
              <a className="link-u" href={done ?? '#'}>
                download the PDF directly
              </a>
              .
            </p>
            <div>
              <button className="btn btn-line btn-sm" type="button" onClick={() => ref.current?.close()}>
                Close
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </>
  )
}

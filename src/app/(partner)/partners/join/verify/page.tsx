import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import React from 'react'

import { JoinSteps } from '@/components/partner/Join'
import { Field, Flash } from '@/components/partner/Parts'
import { currentDraft } from '@/lib/partner/join'
import { editable, JOIN } from '@/lib/partner/registration'
import { smsConfigured } from '@/lib/partner/sms'
import { mailConfigured } from '@/lib/support/mail'

import { devJoinCode, resendJoinCode, verifyJoinCode } from '../actions'

export const metadata: Metadata = { title: 'Confirm your email' }

const ERRORS: Record<string, string> = {
  invalid: 'That code is not right. Check the email and try again.',
  expired: 'That code has expired or was already used. Request a new one.',
  locked: 'Too many wrong attempts. Request a new code.',
  rate: 'Too many codes requested. Wait a few minutes.',
}

/* Step 3 (FR-REG-03): the six-digit code sent to the primary contact's email, and to the mobile when an SMS gateway exists. */
export default async function JoinVerifyPage({ searchParams }: { searchParams: Promise<{ error?: string; resent?: string }> }) {
  const sp = await searchParams
  const app = await currentDraft()
  if (!app) redirect(`${JOIN}?error=expired`)
  if (!editable(app)) redirect(`${JOIN}/status?a=${encodeURIComponent(app.number)}&k=${encodeURIComponent(app.resumeKey)}`)
  if (!app.contact.email) redirect(`${JOIN}/company`)
  if (app.contact.emailVerifiedAt) redirect(`${JOIN}/terms`)
  const shown = !mailConfigured() ? await devJoinCode() : null
  const sms = smsConfigured()
  return (
    <section className="sheet ws g-paper">
      <div className="form-sheet">
        <span className="label muted">Check your email{sms ? ' and phone' : ''}</span>
        <h1 className="h-util" style={{ margin: '10px 0 14px' }}>
          Enter the six-digit code.
        </h1>
        <p className="form-intro">
          We sent it to <strong>{app.contact.email}</strong>
          {sms ? <> and by SMS to <strong>{app.contact.mobile}</strong></> : null}. It works for ten minutes.
          {!sms && ' Mobile numbers are confirmed by K7 when they call you; no SMS is sent at the moment.'}
        </p>
        <JoinSteps current="verify" />
        {sp.resent === '1' && <Flash>A new code is on its way.</Flash>}
        {sp.error && <Flash kind="error">{ERRORS[sp.error] ?? 'Try again.'}</Flash>}
        {shown && (
          <Flash>
            Development: no SMTP_URL is set, so the code is shown here: <strong className="lid">{shown}</strong>
          </Flash>
        )}
        <form action={verifyJoinCode} className="form-grid">
          <div className="code-input span-2">
            <Field id="code" label="Code" required>
              <input id="code" name="code" inputMode="numeric" pattern="[0-9 ]{6,7}" autoComplete="one-time-code" maxLength={7} required autoFocus placeholder="000000" />
            </Field>
          </div>
          <div className="form-actions span-2">
            <button className="btn btn-primary" type="submit">
              Confirm →
            </button>
          </div>
        </form>
        <form action={resendJoinCode} className="actions" style={{ marginTop: 24 }}>
          <button className="link-u textbtn" type="submit">
            Send a new code
          </button>
          <Link className="link-u" href={`${JOIN}/company`}>
            Change the email address
          </Link>
        </form>
      </div>
    </section>
  )
}

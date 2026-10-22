import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { Field, Flash } from '@/components/partner/Parts'
import { mailConfigured } from '@/lib/support/mail'

import { devPartnerCode, resendPartnerCode, verifyPartnerCode } from '../sign-in/actions'

export const metadata: Metadata = { title: 'Enter your code' }

const ERRORS: Record<string, string> = {
  invalid: 'That code is not right. Check the email and try again.',
  expired: 'That code has expired or was already used. Request a new one.',
  locked: 'Too many wrong attempts. Request a new code.',
  rate: 'Too many codes requested. Wait a few minutes.',
  allowlist: 'This test system only sends codes to approved email addresses. Ask the portal team to add yours.',
  account: 'We could not sign you in. Your user may have been disabled since the code was sent; ask your Partner Admin.',
}

export default async function PartnerVerifyPage({ searchParams }: { searchParams: Promise<{ email?: string; next?: string; error?: string; resent?: string }> }) {
  const sp = await searchParams
  const email = sp.email ?? ''
  const next = sp.next && /^\/partners\/portal(\/|$)/.test(sp.next) ? sp.next : undefined
  const shown = !mailConfigured() ? await devPartnerCode() : null
  return (
    <section className="sheet ws g-paper">
      <div className="signin">
        <span className="label muted">Check your email</span>
        <h1 className="h-util">Enter the six-digit code.</h1>
        <p>
          We sent it to <strong>{email}</strong>. It works for ten minutes.
        </p>
        {sp.resent === '1' && <Flash>A new code is on its way.</Flash>}
        {sp.error && <Flash kind="error">{ERRORS[sp.error] ?? 'Try again.'}</Flash>}
        {shown && (
          <Flash>
            Development: no SMTP_URL is set, so the code is shown here: <strong className="lid">{shown}</strong>
          </Flash>
        )}
        <form action={verifyPartnerCode} className="form-grid">
          <input type="hidden" name="email" value={email} />
          {next && <input type="hidden" name="next" value={next} />}
          <div className="code-input span-2">
            <Field id="code" label="Code" required>
              <input id="code" name="code" inputMode="numeric" pattern="[0-9 ]{6,7}" autoComplete="one-time-code" maxLength={7} required autoFocus placeholder="000000" />
            </Field>
          </div>
          <div className="form-actions span-2">
            <button className="btn btn-primary" type="submit">
              Continue →
            </button>
          </div>
        </form>
        <form action={resendPartnerCode} className="actions">
          <input type="hidden" name="email" value={email} />
          {next && <input type="hidden" name="next" value={next} />}
          <button className="link-u textbtn" type="submit">
            Send a new code
          </button>
          <Link className="link-u" href="/partners/portal/sign-in">
            Use a different email
          </Link>
        </form>
      </div>
    </section>
  )
}

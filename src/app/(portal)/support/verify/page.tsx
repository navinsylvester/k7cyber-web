import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { Field, Flash } from '@/components/support/Parts'
import { mailConfigured } from '@/lib/support/mail'

import { devCode, resendCode, verifyCode } from '../sign-in/actions'

export const metadata: Metadata = { title: 'Enter your code' }

const ERRORS: Record<string, string> = {
  invalid: 'That code is not right. Check the email and try again.',
  expired: 'That code has expired or was already used. Request a new one.',
  locked: 'Too many wrong attempts. Request a new code.',
  rate: 'Too many codes requested. Wait a few minutes.',
  account: 'We could not set up your account. Try again, or contact support by phone.',
}

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ email?: string; next?: string; error?: string; resent?: string; known?: string }> }) {
  const sp = await searchParams
  const email = sp.email ?? ''
  const next = sp.next && sp.next.startsWith('/support') ? sp.next : undefined
  const shown = !mailConfigured() ? await devCode() : null
  return (
    <section className="sheet ws g-paper">
      <div className="signin">
        <span className="label muted">Check your email</span>
        <h1 className="h-util">Enter the six-digit code.</h1>
        <p>
          We sent it to <strong>{email}</strong>. It works for ten minutes.
          {sp.known === '1' ? ' You already had an account with this address, so you are signing in to it.' : ''}
        </p>
        {sp.resent === '1' && <Flash>A new code is on its way.</Flash>}
        {sp.error && <Flash kind="error">{ERRORS[sp.error] ?? 'Try again.'}</Flash>}
        {shown && (
          <Flash>
            Development: no SMTP_URL is set, so the code is shown here: <strong className="lid">{shown}</strong>
          </Flash>
        )}
        <form action={verifyCode} className="form-grid">
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
        <form action={resendCode} className="actions">
          <input type="hidden" name="email" value={email} />
          {next && <input type="hidden" name="next" value={next} />}
          <button className="link-u textbtn" type="submit">
            Send a new code
          </button>
          <Link className="link-u" href="/support/sign-in">
            Use a different email
          </Link>
        </form>
      </div>
    </section>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import React from 'react'

import { auth } from '@/auth'
import { Field, Flash } from '@/components/support/Parts'

import { requestRegistrationCode } from '../sign-in/actions'

export const metadata: Metadata = { title: 'Create an account' }

const ERRORS: Record<string, string> = {
  email: 'Enter a valid email address.',
  name: 'Tell us your first name.',
  mobile: 'Enter a mobile number with 10 to 15 digits, or leave it empty.',
  organisation: 'Tell us the name of your organisation.',
  rate: 'Too many codes requested. Wait a few minutes and try again.',
  allowlist: 'This test system only sends codes to approved email addresses. Ask the portal team to add yours.',
}

type SP = { email?: string; firstName?: string; lastName?: string; mobile?: string; kind?: string; organisation?: string; error?: string; next?: string; new?: string }

/* Registration asks for four things and verifies the email with a code. The contact is created in Dynamics only after the code. */
export default async function RegisterPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const s = await auth()
  if (s?.user) redirect(s.user.kind === 'agent' ? '/support/workspace' : '/support/cases')
  const next = sp.next && sp.next.startsWith('/support') ? sp.next : undefined
  const org = sp.kind === 'organisation'
  return (
    <section className="sheet ws g-paper">
      <div className="form-sheet">
        <span className="label muted">Create an account</span>
        <h1 className="h-util" style={{ margin: '10px 0 14px' }}>
          Four details and you are in.
        </h1>
        <p className="form-intro">We will email you a code to confirm the address. Use the email you bought or registered your K7 product with, so your cases and licences line up.</p>
        {sp.new === '1' && <Flash>We could not find an account for {sp.email}. Create one below; it takes a minute.</Flash>}
        {sp.error && <Flash kind="error">{ERRORS[sp.error] ?? 'Check the form and try again.'}</Flash>}
        <form action={requestRegistrationCode} className="form-grid">
          {next && <input type="hidden" name="next" value={next} />}
          <Field id="firstName" label="First name" required>
            <input id="firstName" name="firstName" autoComplete="given-name" required defaultValue={sp.firstName ?? ''} placeholder="Priya" />
          </Field>
          <Field id="lastName" label="Last name">
            <input id="lastName" name="lastName" autoComplete="family-name" defaultValue={sp.lastName ?? ''} placeholder="Raman" />
          </Field>
          <Field id="email" label="Email address" required>
            <input id="email" name="email" type="email" inputMode="email" autoComplete="email" required defaultValue={sp.email ?? ''} placeholder="you@example.com" />
          </Field>
          <Field id="mobile" label="Mobile number" hint="Optional. Helps us reach you about an urgent case.">
            <input id="mobile" name="mobile" type="tel" inputMode="tel" autoComplete="tel" defaultValue={sp.mobile ?? ''} placeholder="98400 00000" />
          </Field>
          <fieldset className="field span-2" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="label" style={{ marginBottom: 10 }}>
              I am using K7
            </legend>
            <div className="choice" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))' }}>
              <label>
                <input type="radio" name="kind" value="individual" defaultChecked={!org} />
                <span className="t">At home</span>
                <span className="d">K7 Total Security, Ultimate Security, Antivirus or Mobile Security on my own devices.</span>
              </label>
              <label>
                <input type="radio" name="kind" value="organisation" defaultChecked={org} />
                <span className="t">For my organisation</span>
                <span className="d">Endpoint, server, UTM or enterprise products managed for a company, school or office.</span>
              </label>
            </div>
          </fieldset>
          <Field id="organisation" label="Organisation name" hint="Only if you use K7 for an organisation. We link your account to it so your team's cases show up together." span>
            <input id="organisation" name="organisation" autoComplete="organization" defaultValue={sp.organisation ?? ''} placeholder="Example Industries Pvt Ltd" />
          </Field>
          <div className="form-actions span-2">
            <button className="btn btn-primary" type="submit">
              Email me a code →
            </button>
            <Link className="link-u" href="/support/sign-in">
              I already have an account
            </Link>
          </div>
          <p className="hint span-2">By creating an account you agree that K7 stores your contact details to handle your support requests. Your data stays in India.</p>
        </form>
      </div>
    </section>
  )
}

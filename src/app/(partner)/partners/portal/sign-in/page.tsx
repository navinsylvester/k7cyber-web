import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import React from 'react'

import { auth } from '@/auth'
import { Field, Flash } from '@/components/partner/Parts'
import { devAgentDoorEnabled } from '@/lib/dataverse/auth'

import { requestPartnerCode, staffSignIn } from './actions'

export const metadata: Metadata = { title: 'Sign in' }

const ERRORS: Record<string, string> = {
  email: 'That does not look like an email address.',
  rate: 'Too many codes requested. Wait a few minutes and try again.',
  allowlist: 'This test system only sends codes to approved email addresses. Ask the portal team to add yours.',
  unknown: 'We have no partner user with that address. Your Partner Admin can add you, or your company can apply to the programme.',
  suspended: 'Your organisation’s access is suspended. Your Channel Manager can tell you why.',
  disabled: 'This user is disabled. Ask your Partner Admin.',
  gone: 'Your account no longer exists. Ask your Partner Admin.',
  SessionExpired: 'Your session ended. Sign in again.',
  probe: 'The probe token could not be used. Run the probe once to sign in (python3 -I scripts/dataverse-probe.py get WhoAmI).',
  dev: 'The development sign-in is off.',
  OAuthCallbackError: 'Microsoft sign-in did not complete. Try again.',
  AccessDenied: 'Microsoft sign-in was refused for this account.',
  Configuration: 'Microsoft sign-in failed on the server side. Try again from this page; if it keeps failing, tell the portal team.',
}
const PARTNER_ERRORS = new Set(['email', 'rate', 'allowlist', 'unknown', 'suspended', 'disabled', 'gone'])

/* One page, two doors (02-build-plan.md decisions 3 and 5): partner users by email code, K7 staff by Microsoft sign-in. The side
   the visitor came for leads; an error from a door is shown on that door's side. */
export default async function PartnerSignInPage({ searchParams }: { searchParams: Promise<{ next?: string; staff?: string; error?: string; email?: string }> }) {
  const sp = await searchParams
  const s = await auth()
  const next = sp.next && /^\/partners\/portal(\/|$)/.test(sp.next) ? sp.next : undefined
  if (s?.user?.kind === 'partner') redirect(next ?? '/partners/portal')
  if (s?.user?.kind === 'agent') redirect(next?.startsWith('/partners/portal/k7') ? next : '/partners/portal/k7')
  const staffError = !!sp.error && !PARTNER_ERRORS.has(sp.error)
  const staffFirst = sp.staff === '1' || staffError
  const error = sp.error ? (ERRORS[sp.error] ?? 'Sign-in did not complete. Try again.') : null

  const partner = (
    <div className="signin">
      <span className="label muted">Partners</span>
      <h1 className="h-util">Sign in with your email.</h1>
      <p>No password. We send a six-digit code to the address your Partner Admin registered; it works for ten minutes.</p>
      {error && !staffError && <Flash kind="error">{error}</Flash>}
      <form action={requestPartnerCode} className="form-grid">
        {next && <input type="hidden" name="next" value={next} />}
        <Field id="email" label="Work email" required span>
          <input id="email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="you@partner.example" required defaultValue={sp.email ?? ''} autoFocus={!staffFirst} />
        </Field>
        <div className="form-actions span-2">
          <button className={`btn ${staffFirst ? 'btn-line' : 'btn-primary'}`} type="submit">
            Send me a code →
          </button>
          <Link className="link-u" href="/partners/join">
            Not a partner yet? Apply to the programme
          </Link>
        </div>
      </form>
    </div>
  )

  const staff = (
    <div className="signin">
      <span className="label muted">K7 staff</span>
      <h2 className="h-util" style={{ fontSize: 'clamp(26px, 3cqw, 40px)' }}>
        Partner desk.
      </h2>
      <p>Sign in with your K7 Microsoft account. Your partner-portal roles come from the portal’s settings, not from Dynamics.</p>
      {error && staffError && <Flash kind="error">{error}</Flash>}
      <form action={staffSignIn} className="actions">
        {next && <input type="hidden" name="next" value={next} />}
        <button className={`btn ${staffFirst ? 'btn-primary' : 'btn-line'}`} type="submit" name="provider" value="microsoft-entra-id">
          Sign in with Microsoft →
        </button>
        {devAgentDoorEnabled() && (
          <button className="btn btn-line" type="submit" name="provider" value="dev-agent" title="Uses scripts/.token_cache.json (development only)">
            Continue as probe user
          </button>
        )}
      </form>
    </div>
  )

  return (
    <section className="sheet ws g-paper">
      <div className="signin-split">
        {staffFirst ? staff : partner}
        {staffFirst ? partner : staff}
      </div>
    </section>
  )
}

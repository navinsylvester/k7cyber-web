import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import React from 'react'

import { auth } from '@/auth'
import { Field, Flash } from '@/components/support/Parts'
import { devProbeEnabled } from '@/lib/dataverse/auth'

import { agentSignIn, requestSignInCode } from './actions'

export const metadata: Metadata = { title: 'Sign in' }

const ERRORS: Record<string, string> = {
  email: 'That does not look like an email address.',
  rate: 'Too many codes requested. Wait a few minutes and try again.',
  NoDataverseAccess: 'Your Microsoft account signed in, but it has no access to the support system. Ask the CRM administrator for a role.',
  SessionExpired: 'Your session ended. Sign in again.',
  probe: 'The probe token could not be used. Run the probe once to sign in (python3 -I scripts/dataverse-probe.py get WhoAmI).',
  dev: 'The development sign-in is off.',
  OAuthCallbackError: 'Microsoft sign-in did not complete. Try again.',
  AccessDenied: 'Microsoft sign-in was refused for this account.',
  Configuration: 'Agent sign-in is not configured on this server.',
}

/* One page, two doors: customers by email code (left), K7 staff by Microsoft sign-in (right). The side the visitor came for leads. */
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; agent?: string; error?: string; email?: string }> }) {
  const sp = await searchParams
  const s = await auth()
  if (s?.user) redirect(s.user.kind === 'agent' ? '/support/workspace' : (sp.next && sp.next.startsWith('/support') ? sp.next : '/support/cases'))
  const agentFirst = sp.agent === '1'
  const error = sp.error ? (ERRORS[sp.error] ?? 'Sign-in did not complete. Try again.') : null
  const next = sp.next && sp.next.startsWith('/support') ? sp.next : undefined

  const customer = (
    <div className="signin">
      <span className="label muted">Customers</span>
      <h1 className="h-util">Sign in with your email.</h1>
      <p>No password. We send a six-digit code to your email address; it works for ten minutes.</p>
      {error && !agentFirst && <Flash kind="error">{error}</Flash>}
      <form action={requestSignInCode} className="form-grid">
        {next && <input type="hidden" name="next" value={next} />}
        <Field id="email" label="Email address" required span>
          <input id="email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" required defaultValue={sp.email ?? ''} autoFocus={!agentFirst} />
        </Field>
        <div className="form-actions span-2">
          <button className={`btn ${agentFirst ? 'btn-line' : 'btn-primary'}`} type="submit">
            Send me a code →
          </button>
          <Link className="link-u" href={`/support/register${next ? `?next=${encodeURIComponent(next)}` : ''}`}>
            New here? Create an account
          </Link>
        </div>
      </form>
    </div>
  )

  const agent = (
    <div className="signin">
      <span className="label muted">K7 staff</span>
      <h2 className="h-util" style={{ fontSize: 'clamp(26px, 3cqw, 40px)' }}>
        Support workspace.
      </h2>
      <p>Sign in with your K7 Microsoft account. You work in Dynamics as yourself: the same cases, queues and rights.</p>
      {error && agentFirst && <Flash kind="error">{error}</Flash>}
      <form action={agentSignIn} className="actions">
        {next && <input type="hidden" name="next" value={next} />}
        <button className={`btn ${agentFirst ? 'btn-primary' : 'btn-line'}`} type="submit" name="provider" value="microsoft-entra-id">
          Sign in with Microsoft →
        </button>
        {devProbeEnabled() && (
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
        {agentFirst ? agent : customer}
        {agentFirst ? customer : agent}
      </div>
    </section>
  )
}

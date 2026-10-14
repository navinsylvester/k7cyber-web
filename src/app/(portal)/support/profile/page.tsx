import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { Field, Flash, MetaRows } from '@/components/support/Parts'
import { fv } from '@/lib/dataverse/types'
import { contractsOfAccount, getAccount, getContact } from '@/lib/support/customers'
import { dmy } from '@/lib/support/format'
import { requireCustomer } from '@/lib/support/session'

import { signOutAction } from '../actions'
import { updateProfile } from './actions'

export const metadata: Metadata = { title: 'My details' }

const ERRORS: Record<string, string> = {
  name: 'Tell us your first name.',
  mobile: 'Enter a mobile number with digits only, or leave it empty.',
  phone: 'Enter a phone number with digits only, or leave it empty.',
  failed: 'We could not save your details.',
}

const maskKey = (k: string): string => (k.length <= 4 ? k : `${'•'.repeat(Math.min(12, k.length - 4))}${k.slice(-4)}`)

/* The customer's own record: what we call them, how we reach them, which organisation they belong to, and their licences. */
export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string; message?: string }> }) {
  const sp = await searchParams
  const ctx = await requireCustomer('/support/profile')
  const contact = await getContact(ctx.auth, ctx.scope.contactId)
  const [account, contracts] = await Promise.all([
    ctx.scope.accountId ? getAccount(ctx.auth, ctx.scope.accountId).catch(() => null) : Promise.resolve(null),
    contractsOfAccount(ctx.auth, ctx.scope.accountId ?? ctx.scope.contactId, 25).catch(() => []),
  ])
  const error = sp.error ? `${ERRORS[sp.error] ?? 'Try again.'}${sp.error === 'failed' && sp.message ? ` ${sp.message}` : ''}` : null

  return (
    <section className="sheet ws g-paper">
      <div className="ws-head">
        <div className="ws-head-main">
          <span className="label muted">K7 Support · My account</span>
          <h1 className="h-util">Your details.</h1>
          <p className="lede">What we call you and how we reach you about a case. Your email address is your sign-in, so it stays as it is.</p>
        </div>
        <div className="ws-actions">
          <form action={signOutAction}>
            <button className="btn btn-line btn-sm" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>

      {sp.saved === '1' && <Flash>Saved. We will use these details from now on.</Flash>}
      {sp.saved === 'same' && <Flash>Nothing changed.</Flash>}
      {error && <Flash kind="error">{error}</Flash>}

      <div className="profile-grid">
        <form action={updateProfile} className="form-grid">
          <Field id="firstName" label="First name" required>
            <input id="firstName" name="firstName" autoComplete="given-name" required minLength={2} maxLength={50} defaultValue={String(contact?.firstname ?? '')} />
          </Field>
          <Field id="lastName" label="Last name">
            <input id="lastName" name="lastName" autoComplete="family-name" maxLength={50} defaultValue={String(contact?.lastname ?? '')} />
          </Field>
          <Field id="email" label="Email address" hint="This is how you sign in. To change it, tell us in a case.">
            <input id="email" value={ctx.scope.email} readOnly />
          </Field>
          <Field id="mobile" label="Mobile number" hint="For urgent cases only.">
            <input id="mobile" name="mobile" type="tel" inputMode="tel" autoComplete="tel" maxLength={20} defaultValue={String(contact?.mobilephone ?? '')} placeholder="98400 00000" />
          </Field>
          <Field id="phone" label="Other phone">
            <input id="phone" name="phone" type="tel" inputMode="tel" maxLength={20} defaultValue={String(contact?.telephone1 ?? '')} />
          </Field>
          <Field id="organisation" label="Organisation" hint={account ? 'To change your organisation, tell us in a case.' : 'Not linked to an organisation. If you use K7 at work, tell us in a case and we will link you.'}>
            <input id="organisation" value={account ? String(account.name) : 'None'} readOnly />
          </Field>
          <div className="form-actions span-2">
            <button className="btn btn-primary" type="submit">
              Save details →
            </button>
            <Link className="link-u" href="/support/cases">
              Back to my cases
            </Link>
          </div>
        </form>

        <aside>
          <h2 className="sub-head">
            Licences
            <span className="label">{contracts.length ? `${contracts.length}` : ''}</span>
          </h2>
          {contracts.length === 0 ? (
            <p className="hint">No licences are linked to this account yet. If you have a serial number, mention it in a case and we will connect it.</p>
          ) : (
            <div className="mini-rows">
              {contracts.map((k) => (
                <div className="mini-row" key={String(k.alletec_k7contractid)}>
                  <span className="t">{String(k.alletec_name ?? 'Licence')}</span>
                  <span className="s lid">{k.alletec_productkey ? maskKey(String(k.alletec_productkey)) : 'Key on file'}</span>
                  <span className="r">{k.alletec_invoicedate ? dmy(String(k.alletec_invoicedate)) : fv(k, 'statecode')}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 32 }}>
            <h2 className="sub-head">Where we send things</h2>
            <MetaRows items={[{ k: 'Email', v: ctx.scope.email }, { k: 'SMS', v: contact?.mobilephone ? String(contact.mobilephone) : 'Not set' }, { k: 'Data region', v: 'India', sans: true }]} />
          </div>
        </aside>
      </div>
    </section>
  )
}

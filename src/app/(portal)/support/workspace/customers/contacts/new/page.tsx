import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { Crumbs, Field, Flash, RequiredNote } from '@/components/support/Parts'
import { WS, WorkspaceBar } from '@/components/support/WorkspaceBar'
import { fv } from '@/lib/dataverse/types'
import { searchAccounts } from '@/lib/support/customers'
import { requireAgent } from '@/lib/support/session'

import { badFromQuery, ContactFields, contactFromQuery, loadGeo } from '../../forms'

import { createContactAction } from './actions'

export const metadata: Metadata = { title: 'New contact' }

type SP = { error?: string; firstName?: string; lastName?: string; email?: string; mobile?: string; phone?: string; jobTitle?: string; vertical?: string; stateId?: string; cityId?: string; bad?: string; account?: string; accountId?: string; return?: string; name?: string }

/* A new contact in four fields plus, when they belong to one, their organisation found by name. */
export default async function NewContactPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const me = await requireAgent()
  const accountQ = sp.account?.trim() ?? ''
  // Values come back in the query after a refused submit (TR-03), so the city list is loaded for the state that was chosen.
  const values = contactFromQuery(sp)
  const [geo, accounts] = await Promise.all([loadGeo(me.auth, values.stateId), accountQ ? searchAccounts(me.auth, accountQ, 10).catch(() => []) : Promise.resolve([])])
  const keep = new URLSearchParams()
  for (const k of ['firstName', 'lastName', 'email', 'mobile', 'phone', 'jobTitle', 'vertical', 'stateId', 'cityId', 'return'] as const) if (sp[k]) keep.set(k, sp[k]!)
  const [first, ...rest] = (sp.name ?? '').split(' ')
  const chosenAccount = (sp.accountId ?? '').toLowerCase()
  return (
    <>
      <WorkspaceBar active="customers" />
      <section className="sheet ws g-paper">
        <div className="form-sheet">
          <Crumbs items={[{ label: 'Customers', href: `${WS}/customers` }, { label: 'New contact' }]} />
          <h1 className="h-util" style={{ margin: '10px 0 14px' }}>
            New contact.
          </h1>
          <p className="form-intro">A person who uses K7. Add their organisation when they use it for one, so their team&rsquo;s cases stay together.</p>
          {sp.error && <Flash kind="error">{sp.error}</Flash>}
          <RequiredNote />
          {sp.return === 'cases/new' && <Flash>Once saved, you go straight to a new case for this contact.</Flash>}

          <form className="filters-inline" action={`${WS}/customers/contacts/new`} method="get" role="search">
            {[...keep.entries()].map(([k, v]) => (
              <input type="hidden" name={k} value={v} key={k} />
            ))}
            <Field id="account" label="Organisation (search by name)" hint="Leave empty for a home user.">
              <input id="account" name="account" type="search" defaultValue={accountQ} placeholder="Example Industries" autoComplete="off" />
            </Field>
            <div className="filters-actions">
              <button className="btn btn-line btn-sm" type="submit">
                Find
              </button>
            </div>
          </form>

          <form action={createContactAction} className="form-grid">
            {sp.return && <input type="hidden" name="return" value={sp.return} />}
            {accountQ && <input type="hidden" name="account" value={accountQ} />}
            {accountQ && (
              <fieldset className="field span-2" style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="label" style={{ marginBottom: 10 }}>
                  Organisation
                </legend>
                {accounts.length === 0 ? (
                  <p className="hint">
                    No account matches “{accountQ}”.{' '}
                    <Link className="link-u" href={`${WS}/customers/accounts/new?name=${encodeURIComponent(accountQ)}`}>
                      Create it first
                    </Link>
                    , then come back.
                  </p>
                ) : (
                  <div className="choice">
                    <label>
                      <input type="radio" name="accountId" value="" defaultChecked={!accounts.some((a) => String(a.accountid).toLowerCase() === chosenAccount)} />
                      <span className="t">No organisation</span>
                      <span className="d">A home user.</span>
                    </label>
                    {accounts.map((a) => (
                      <label key={String(a.accountid)}>
                        <input type="radio" name="accountId" value={String(a.accountid)} defaultChecked={String(a.accountid).toLowerCase() === chosenAccount} />
                        <span className="t">{String(a.name ?? '')}</span>
                        <span className="d">
                          {String(a.alletec_accountid ?? '')} {fv(a, 'alletec_accounttype') ? `· ${fv(a, 'alletec_accounttype')}` : ''} {fv(a, '_alletec_city_value') ? `· ${fv(a, '_alletec_city_value')}` : ''}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>
            )}
            <ContactFields v={{ ...values, firstName: sp.firstName ?? first ?? '', lastName: sp.lastName ?? rest.join(' ') }} geo={geo} bad={badFromQuery(sp)} />
            <div className="form-actions span-2">
              <button className="btn btn-primary" type="submit">
                {sp.return === 'cases/new' ? 'Save and open a case →' : 'Create contact →'}
              </button>
              <Link className="link-u" href={`${WS}/customers`}>
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </section>
    </>
  )
}

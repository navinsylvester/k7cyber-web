import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { Ledger } from '@/components/support/Ledger'
import { Field, PageHead } from '@/components/support/Parts'
import { WS, WorkspaceBar } from '@/components/support/WorkspaceBar'
import { fv } from '@/lib/dataverse/types'
import { searchAccounts, searchContacts } from '@/lib/support/customers'
import { dmy } from '@/lib/support/format'
import { requireAgent } from '@/lib/support/session'

export const metadata: Metadata = { title: 'Customers' }

const PATH = `${WS}/customers`

/* Customers (01-requirements.md §4.5): one search over contacts or accounts, newest-modified first when the box is empty. */
export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; kind?: string }> }) {
  const sp = await searchParams
  const me = await requireAgent()
  const q = sp.q?.trim() ?? ''
  const kind = sp.kind === 'accounts' ? 'accounts' : 'contacts'
  const rows = kind === 'contacts' ? await searchContacts(me.auth, q, 25) : await searchAccounts(me.auth, q, 25)
  const switchHref = (k: string) => `${PATH}?kind=${k}${q ? `&q=${encodeURIComponent(q)}` : ''}`
  return (
    <>
      <WorkspaceBar active="customers" />
      <section className="sheet ws g-paper">
        <PageHead
          above={<span className="label muted">Customers · contacts and accounts</span>}
          title="Customers."
          lede="Find a person or an organisation, open their record for cases and contracts, or create one before raising a case."
          actions={
            <>
              <Link className="btn btn-primary btn-sm" href={`${PATH}/contacts/new`}>
                New contact →
              </Link>
              <Link className="btn btn-line btn-sm" href={`${PATH}/accounts/new`}>
                New account
              </Link>
            </>
          }
        />
        <form className="filters-inline" action={PATH} method="get" role="search">
          <input type="hidden" name="kind" value={kind} />
          <Field id="q" label={kind === 'contacts' ? 'Name, email or mobile' : 'Name or account id'}>
            <input id="q" name="q" type="search" defaultValue={q} placeholder={kind === 'contacts' ? 'priya@example.com' : 'Example Industries'} autoComplete="off" />
          </Field>
          <div className="seg seg-l" role="group" aria-label="Kind">
            <Link href={switchHref('contacts')} aria-pressed={kind === 'contacts'}>
              Contacts
            </Link>
            <Link href={switchHref('accounts')} aria-pressed={kind === 'accounts'}>
              Accounts
            </Link>
          </div>
          <div className="filters-actions">
            <button className="btn btn-line btn-sm" type="submit">
              Search
            </button>
            {q && (
              <Link className="link-u" href={switchHref(kind)}>
                Clear
              </Link>
            )}
          </div>
        </form>
        <div className="ledger filed">
          <div className="ftab label">
            {rows.length} {kind} {q ? `matching “${q}”` : '· recently modified'}
          </div>
        {kind === 'contacts' ? (
          <Ledger caption="Contacts" heads={[{ label: 'Name' }, { label: 'Email' }, { label: 'Mobile' }, { label: 'Organisation' }, { label: 'City' }, { label: 'Modified' }]}>
            {rows.length === 0 && (
              <tr className="empty">
                <td colSpan={6}>No contacts match.</td>
              </tr>
            )}
            {rows.map((r) => (
              <tr className="row" key={String(r.contactid)}>
                <td className="title">
                  <Link href={`${PATH}/contacts/${String(r.contactid)}`}>{String(r.fullname ?? '') || '(no name)'}</Link>
                </td>
                <td className="text">{String(r.emailaddress1 ?? '')}</td>
                <td className="ver">{String(r.mobilephone ?? '')}</td>
                <td className="text">{fv(r, '_parentcustomerid_value')}</td>
                <td className="text">{fv(r, '_alletec_city_value')}</td>
                <td className="date">{dmy(String(r.modifiedon ?? ''))}</td>
              </tr>
            ))}
          </Ledger>
        ) : (
          <Ledger caption="Accounts" heads={[{ label: 'Name' }, { label: 'Account id' }, { label: 'Type' }, { label: 'City' }, { label: 'Primary contact' }, { label: 'Modified' }]}>
            {rows.length === 0 && (
              <tr className="empty">
                <td colSpan={6}>No accounts match.</td>
              </tr>
            )}
            {rows.map((r) => (
              <tr className="row" key={String(r.accountid)}>
                <td className="title">
                  <Link href={`${PATH}/accounts/${String(r.accountid)}`}>{String(r.name ?? '') || '(no name)'}</Link>
                </td>
                <td className="ver">{String(r.alletec_accountid ?? r.accountnumber ?? '')}</td>
                <td className="text">{fv(r, 'alletec_accounttype')}</td>
                <td className="text">{fv(r, '_alletec_city_value')}</td>
                <td className="text">{fv(r, '_primarycontactid_value')}</td>
                <td className="date">{dmy(String(r.modifiedon ?? ''))}</td>
              </tr>
            ))}
          </Ledger>
        )}
        </div>
      </section>
    </>
  )
}

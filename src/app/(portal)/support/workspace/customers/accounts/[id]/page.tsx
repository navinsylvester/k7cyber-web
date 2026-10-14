import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { CareTag } from '@/components/support/Csat'
import { CareFlagPanel, CsatHistory } from '@/components/support/CustomerCsat'
import { Crumbs, Empty, Flash, MetaRows, StatusTag, Tid, When } from '@/components/support/Parts'
import { WS, WorkspaceBar } from '@/components/support/WorkspaceBar'
import { fv, lookup } from '@/lib/dataverse/types'
import { casesForCustomer } from '@/lib/support/cases'
import { contactsOfAccount, contractsOfAccount, getAccount } from '@/lib/support/customers'
import { dmy, dmyHm } from '@/lib/support/format'
import { careForCustomer, csatForCustomer, flagHistory, followUpState } from '@/lib/support/csat'
import { getSettings } from '@/lib/support/kpi-config'
import { isManager, requireAgent } from '@/lib/support/session'

import { AccountFields, loadGeo } from '../../forms'

import { updateAccountAction } from './actions'

export const metadata: Metadata = { title: 'Account' }

/** A licence key shows its last four characters; the full key sits behind a disclosure. */
const LicenceKey: React.FC<{ value: string }> = ({ value }) => {
  if (!value) return null
  const tail = value.slice(-4)
  return (
    <details className="more" style={{ display: 'inline-block' }}>
      <summary className="lid">
        {'•'.repeat(Math.max(4, Math.min(12, value.length - 4)))}
        {tail}
      </summary>
      <span className="lid" style={{ display: 'block', marginTop: 6, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
        {value}
      </span>
    </details>
  )
}

/* An account: the organisation, its people, its cases and contracts; the edit panel on the right. */
export default async function AccountPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string; edit?: string }> }) {
  const { id } = await params
  const sp = await searchParams
  const me = await requireAgent()
  const a = await getAccount(me.auth, id)
  if (!a) notFound()
  const stateId = a._k7_state_value ? String(a._k7_state_value) : null
  const settings = await getSettings()
  const [contacts, cases, contracts, geo, care, ratings, flags, manager] = await Promise.all([contactsOfAccount(me.auth, a.accountid, 50).catch(() => []), casesForCustomer(me.auth, a.accountid, 25).catch(() => []), contractsOfAccount(me.auth, a.accountid), loadGeo(me.auth, stateId), careForCustomer(a.accountid, settings), csatForCustomer(a.accountid), flagHistory(a.accountid), isManager(me)])
  const readings = new Map(ratings.map((r) => [r.id, { status: r.followUp, reading: followUpState(r, settings) }]))
  const here = `${WS}/customers/accounts/${a.accountid}`
  const parent = lookup(a, 'parentaccountid')
  const partner = lookup(a, 'alletec_partneraccount')
  const primary = lookup(a, 'primarycontactid')
  const name = String(a.name ?? '') || '(no name)'
  return (
    <>
      <WorkspaceBar active="customers" />
      <section className="sheet ws g-paper">
        <div className="ws-head">
          <div className="ws-head-main">
            <Crumbs items={[{ label: 'Customers', href: `${WS}/customers` }, { label: 'Accounts', href: `${WS}/customers?kind=accounts` }, { label: name }]} />
            <h1 className="h-util">{name}</h1>
            <div className="tags">
              <span className="tag">Account</span>
              {String(a.alletec_accountid ?? '') && <span className="tag lid">{String(a.alletec_accountid)}</span>}
              {fv(a, 'alletec_accounttype') && <span className="tag tag-solid">{fv(a, 'alletec_accounttype')}</span>}
              {a.statecode === 1 && <span className="tag tag-quiet">Inactive</span>}
              {settings.csat.enabled && <CareTag care={care} href="#csat" />}
            </div>
          </div>
          <div className="ws-actions">
            <Link className="btn btn-primary btn-sm" href={`${WS}/cases/new?account=${a.accountid}`}>
              New case for this account →
            </Link>
            <Link className="btn btn-line btn-sm" href={`${WS}/customers/contacts/new?account=${encodeURIComponent(name)}`}>
              Add a contact
            </Link>
          </div>
        </div>
        {sp.ok && <Flash>{sp.ok}</Flash>}
        {sp.error && <Flash kind="error">{sp.error}</Flash>}
        <div className="ws-grid">
          <div>
            <div className="detail-cols">
              <MetaRows
                items={[
                  { k: 'Phone', v: String(a.telephone1 ?? '') },
                  { k: 'Email', v: a.emailaddress1 ? <a href={`mailto:${String(a.emailaddress1)}`}>{String(a.emailaddress1)}</a> : '' },
                  { k: 'Website', v: a.websiteurl ? <a href={String(a.websiteurl)} rel="noopener noreferrer" target="_blank">{String(a.websiteurl)}</a> : '' },
                  { k: 'Primary contact', v: primary ? <Link href={`${WS}/customers/contacts/${primary.id}`}>{primary.name}</Link> : '', sans: true },
                  { k: 'Lifecycle', v: fv(a, 'alletec_lifecyclestage'), sans: true },
                  { k: 'Vertical', v: fv(a, 'k7_verticaltype'), sans: true },
                  { k: 'Licence key', v: a.k7_description ? <LicenceKey value={String(a.k7_description)} /> : '' },
                ]}
              />
              <MetaRows
                items={[
                  { k: 'City', v: fv(a, '_alletec_city_value'), sans: true },
                  { k: 'State', v: fv(a, '_k7_state_value'), sans: true },
                  { k: 'Region', v: fv(a, '_k7_region_value'), sans: true },
                  { k: 'Country', v: fv(a, '_alletec_country_value'), sans: true },
                  { k: 'Parent account', v: parent ? <Link href={`${WS}/customers/accounts/${parent.id}`}>{parent.name}</Link> : '', sans: true },
                  { k: 'Partner', v: partner ? <Link href={`${WS}/customers/accounts/${partner.id}`}>{partner.name}</Link> : '', sans: true },
                  { k: 'Owner', v: fv(a, '_ownerid_value'), sans: true },
                  { k: 'Created', v: dmyHm(String(a.createdon ?? '')) },
                  { k: 'Modified', v: dmyHm(String(a.modifiedon ?? '')) },
                ]}
              />
            </div>

            <div style={{ marginTop: 40 }}>
              <h2 className="sub-head">
                Contacts <span className="label">{contacts.length}</span>
              </h2>
              {contacts.length === 0 ? (
                <Empty label="No contacts" action={<Link className="link-u" href={`${WS}/customers/contacts/new?account=${encodeURIComponent(name)}`}>Add the first contact</Link>}>
                  Nobody is linked to this account yet.
                </Empty>
              ) : (
                <div className="mini-rows">
                  {contacts.map((c) => (
                    <Link className="mini-row" href={`${WS}/customers/contacts/${String(c.contactid)}`} key={String(c.contactid)}>
                      <span className="t">{String(c.fullname ?? '') || '(no name)'}</span>
                      <span className="s">
                        {String(c.emailaddress1 ?? '')}
                        {c.mobilephone ? ` · ${String(c.mobilephone)}` : ''}
                        {c.jobtitle ? ` · ${String(c.jobtitle)}` : ''}
                      </span>
                      <span className="r">{primary?.id === String(c.contactid) ? 'Primary' : ''}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: 40 }}>
              <h2 className="sub-head">
                Cases <span className="label">{cases.length}</span>
              </h2>
              {cases.length === 0 ? (
                <Empty label="No cases">No case names this account as the customer.</Empty>
              ) : (
                <div className="mini-rows">
                  {cases.map((r) => (
                    <Link className="mini-row" href={`${WS}/cases/${String(r.incidentid)}`} key={String(r.incidentid)}>
                      <span className="t">
                        {r.prioritycode === 696720000 && <i className="crit" aria-label="Critical" />}
                        {String(r.title ?? '')}
                      </span>
                      <span className="s">
                        <Tid ticket={String(r.ticketnumber ?? '')} /> · {fv(r, '_productid_value') || 'No product'} · <When date={String(r.modifiedon ?? '')} />
                      </span>
                      <span className="r">
                        <StatusTag row={r} />
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {settings.csat.enabled && <CsatHistory care={care} ratings={ratings} settings={settings.csat} readings={readings} />}

            {contracts.length > 0 && (
              <div style={{ marginTop: 40 }}>
                <h2 className="sub-head">
                  Contracts <span className="label">{contracts.length}</span>
                </h2>
                <div className="mini-rows">
                  {contracts.map((k) => (
                    <div className="mini-row" key={String(k.alletec_k7contractid)}>
                      <span className="t">{String(k.alletec_name ?? 'Contract')}</span>
                      <span className="s">
                        {k.alletec_productkey ? `Key ${String(k.alletec_productkey)} · ` : ''}
                        {fv(k, 'statecode')} · invoice {dmy(String(k.alletec_invoicedate ?? '')) || '—'}
                      </span>
                      <span className="r">{fv(k, 'alletec_renewalprocessed') === 'Yes' ? 'Renewed' : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="ws-side">
            <div className="acts">
              {settings.csat.enabled && <CareFlagPanel manager={manager} customerId={a.accountid} customerName={name} customerKind="account" care={care} history={flags} returnTo={here} />}
              <details open={sp.edit === '1'}>
                <summary>Edit account</summary>
                <div className="act-body">
                  <form action={updateAccountAction} className="form-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
                    <input type="hidden" name="id" value={a.accountid} />
                    <AccountFields
                      v={{
                        name: String(a.name ?? ''),
                        phone: String(a.telephone1 ?? ''),
                        email: String(a.emailaddress1 ?? ''),
                        website: String(a.websiteurl ?? ''),
                        type: typeof a.alletec_accounttype === 'number' ? a.alletec_accounttype : null,
                        vertical: typeof a.k7_verticaltype === 'number' ? a.k7_verticaltype : null,
                        licenceKey: String(a.k7_description ?? ''),
                        stateId,
                        cityId: a._alletec_city_value ? String(a._alletec_city_value) : null,
                      }}
                      geo={geo}
                    />
                    <button className="btn btn-line btn-sm" type="submit">
                      Save changes
                    </button>
                  </form>
                </div>
              </details>
            </div>
          </aside>
        </div>
      </section>
    </>
  )
}

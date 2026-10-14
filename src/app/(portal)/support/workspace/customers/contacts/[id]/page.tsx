import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { Crumbs, Empty, Flash, MetaRows, StatusTag, Tid, When } from '@/components/support/Parts'
import { WS, WorkspaceBar } from '@/components/support/WorkspaceBar'
import { fv, lookup } from '@/lib/dataverse/types'
import { casesForCustomer } from '@/lib/support/cases'
import { contractsOfAccount, getContact } from '@/lib/support/customers'
import { dmy, dmyHm } from '@/lib/support/format'
import { requireAgent } from '@/lib/support/session'

import { ContactFields, loadGeo } from '../../forms'

import { updateContactAction } from './actions'

export const metadata: Metadata = { title: 'Contact' }

/* A contact: who they are, how to reach them, their organisation, their cases and contracts, and the edit panel on the right. */
export default async function ContactPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string; edit?: string }> }) {
  const { id } = await params
  const sp = await searchParams
  const me = await requireAgent()
  const c = await getContact(me.auth, id)
  if (!c) notFound()
  const stateId = c._k7_state_value ? String(c._k7_state_value) : null
  const [cases, contracts, geo] = await Promise.all([casesForCustomer(me.auth, c.contactid, 25).catch(() => []), contractsOfAccount(me.auth, c.contactid), loadGeo(me.auth, stateId)])
  const account = lookup(c, 'parentcustomerid')
  const name = String(c.fullname ?? '') || '(no name)'
  const inactive = c.statecode === 1
  return (
    <>
      <WorkspaceBar active="customers" />
      <section className="sheet ws g-paper">
        <div className="ws-head">
          <div className="ws-head-main">
            <Crumbs items={[{ label: 'Customers', href: `${WS}/customers` }, { label: 'Contacts', href: `${WS}/customers?kind=contacts` }, { label: name }]} />
            <h1 className="h-util">{name}</h1>
            <div className="tags">
              <span className="tag">Contact</span>
              {fv(c, 'k7_verticaltype') && <span className="tag">{fv(c, 'k7_verticaltype')}</span>}
              {inactive && <span className="tag tag-quiet">Inactive</span>}
              {c.adx_identity_username ? <span className="tag tag-solid">Portal account</span> : null}
            </div>
          </div>
          <div className="ws-actions">
            <Link className="btn btn-primary btn-sm" href={`${WS}/cases/new?customer=${encodeURIComponent(String(c.emailaddress1 ?? c.contactid))}`}>
              New case for {String(c.firstname ?? '') || 'contact'} →
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
                  { k: 'Email', v: c.emailaddress1 ? <a href={`mailto:${String(c.emailaddress1)}`}>{String(c.emailaddress1)}</a> : '' },
                  { k: 'Mobile', v: String(c.mobilephone ?? '') },
                  { k: 'Phone', v: String(c.telephone1 ?? '') },
                  { k: 'Job title', v: String(c.jobtitle ?? ''), sans: true },
                  { k: 'Organisation', v: account ? <Link href={`${WS}/customers/accounts/${account.id}`}>{account.name}</Link> : '', sans: true },
                ]}
              />
              <MetaRows
                items={[
                  { k: 'City', v: fv(c, '_alletec_city_value'), sans: true },
                  { k: 'State', v: fv(c, '_k7_state_value'), sans: true },
                  { k: 'Region', v: fv(c, '_k7_region_value'), sans: true },
                  { k: 'Owner', v: fv(c, '_ownerid_value'), sans: true },
                  { k: 'Created', v: dmyHm(String(c.createdon ?? '')) },
                  { k: 'Modified', v: dmyHm(String(c.modifiedon ?? '')) },
                ]}
              />
            </div>
            {c.description ? (
              <div style={{ marginTop: 32 }}>
                <h2 className="block-title h-block" style={{ fontSize: 20 }}>
                  Notes
                </h2>
                <p className="desc-block">{String(c.description)}</p>
              </div>
            ) : null}

            <div style={{ marginTop: 40 }}>
              <h2 className="sub-head">
                Cases <span className="label">{cases.length}</span>
              </h2>
              {cases.length === 0 ? (
                <Empty label="No cases">This contact has not raised a case.</Empty>
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
              <details open={sp.edit === '1'}>
                <summary>Edit contact</summary>
                <div className="act-body">
                  <form action={updateContactAction} className="form-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
                    <input type="hidden" name="id" value={c.contactid} />
                    <ContactFields
                      v={{
                        firstName: String(c.firstname ?? ''),
                        lastName: String(c.lastname ?? ''),
                        email: String(c.emailaddress1 ?? ''),
                        mobile: String(c.mobilephone ?? ''),
                        phone: String(c.telephone1 ?? ''),
                        jobTitle: String(c.jobtitle ?? ''),
                        vertical: typeof c.k7_verticaltype === 'number' ? c.k7_verticaltype : null,
                        stateId,
                        cityId: c._alletec_city_value ? String(c._alletec_city_value) : null,
                      }}
                      geo={geo}
                      emailRequired={false}
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

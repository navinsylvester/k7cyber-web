import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { Crumbs, Field, Flash, MetaRows, Options } from '@/components/support/Parts'
import { WS, WorkspaceBar } from '@/components/support/WorkspaceBar'
import { fv, lookup } from '@/lib/dataverse/types'
import { dmyHm } from '@/lib/support/format'
import { RFE_STATUS, RFE_TYPE } from '@/lib/support/options'
import { getRfe } from '@/lib/support/rfe'
import { requireAgent } from '@/lib/support/session'

import { updateRfeAction } from './actions'

export const metadata: Metadata = { title: 'RFE' }

export default async function RfeDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string; edit?: string }> }) {
  const { id } = await params
  const sp = await searchParams
  const me = await requireAgent()
  const r = await getRfe(me.auth, id).catch(() => null)
  if (!r) notFound()
  const c = lookup(r, 'k7_case') ?? lookup(r, 'k7_associatedcaseno')
  const product = lookup(r, 'k7_product')
  const account = lookup(r, 'k7_account')
  const number = String(r.k7_rfeno ?? '')
  return (
    <>
      <WorkspaceBar active="rfe" />
      <section className="sheet ws g-paper">
        <div className="ws-head">
          <div className="ws-head-main">
            <Crumbs items={[{ label: 'RFEs', href: `${WS}/rfe` }, { label: number || 'RFE' }]} />
            <h1 className="h-util">{String(r.k7_rfetitle ?? '')}</h1>
            <div className="tags">
              {number && <span className="tag lid">{number}</span>}
              <span className={`tag${/^open|in-progress/i.test(fv(r, 'k7_rfestatus')) ? ' tag-solid' : ''}`}>{fv(r, 'k7_rfestatus') || 'No status'}</span>
              {fv(r, 'k7_rfetype') && <span className="tag">{fv(r, 'k7_rfetype')}</span>}
            </div>
          </div>
        </div>
        {sp.ok && <Flash>{sp.ok}</Flash>}
        {sp.error && <Flash kind="error">{sp.error}</Flash>}
        <div className="ws-grid">
          <div>
            <MetaRows
              items={[
                { k: 'Case', v: c ? <Link href={`${WS}/cases/${c.id}`}>{c.name}</Link> : '', sans: true },
                { k: 'Product', v: product?.name ?? '', sans: true },
                { k: 'Account', v: account ? <Link href={`${WS}/customers/accounts/${account.id}`}>{account.name}</Link> : '', sans: true },
                { k: 'Customer', v: fv(r, '_k7_customer_value'), sans: true },
                { k: 'YODIZ id', v: String(r.k7_yodizid ?? '') },
                { k: 'Serial', v: String(r.k7_serialno ?? '') },
                { k: 'Mode', v: fv(r, 'k7_rfemode'), sans: true },
                { k: 'Users', v: String(r.k7_numberofusers ?? '') },
                { k: 'Vertical', v: fv(r, 'k7_verticaltype'), sans: true },
                { k: 'Owner', v: fv(r, '_ownerid_value'), sans: true },
                { k: 'Created', v: dmyHm(String(r.createdon ?? '')) },
                { k: 'Modified', v: dmyHm(String(r.modifiedon ?? '')) },
              ]}
            />
          </div>
          <aside className="ws-side">
            <div className="acts">
              <details open={sp.edit === '1'}>
                <summary>Edit RFE</summary>
                <div className="act-body">
                  <form action={updateRfeAction} className="form-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
                    <input type="hidden" name="id" value={String(r.k7_rfeid)} />
                    <Field id="title" label="Title" required>
                      <input id="title" name="title" required defaultValue={String(r.k7_rfetitle ?? '')} />
                    </Field>
                    <Field id="type" label="Type" select>
                      <select id="type" name="type" defaultValue={typeof r.k7_rfetype === 'number' ? r.k7_rfetype : ''}>
                        <Options items={RFE_TYPE} empty="Not set" />
                      </select>
                    </Field>
                    <Field id="status" label="Status" select>
                      <select id="status" name="status" defaultValue={typeof r.k7_rfestatus === 'number' ? r.k7_rfestatus : ''}>
                        <Options items={RFE_STATUS} empty="Not set" />
                      </select>
                    </Field>
                    <Field id="yodizId" label="YODIZ id">
                      <input id="yodizId" name="yodizId" defaultValue={String(r.k7_yodizid ?? '')} />
                    </Field>
                    <Field id="users" label="Number of users">
                      <input id="users" name="users" inputMode="numeric" defaultValue={String(r.k7_numberofusers ?? '')} />
                    </Field>
                    <button className="btn btn-line btn-sm" type="submit">
                      Save RFE
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

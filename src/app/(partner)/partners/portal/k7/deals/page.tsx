import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { DealStateTag, Did } from '@/components/partner/Deals'
import { K7Nav } from '@/components/partner/K7Nav'
import { Empty, Flash, Pid } from '@/components/partner/Parts'
import { Pager, qs } from '@/components/support/Parts'
import { dealCounts, K7_DEALS, listDealsK7, type DealView } from '@/lib/partner/deals'
import { daysLeft, formatInr } from '@/lib/partner/deals-model'
import { owedOutboxCount } from '@/lib/partner/mirror'
import { requireK7Role } from '@/lib/partner/session'
import { getPartnerSettings } from '@/lib/partner/settings'
import { dmy, relative } from '@/lib/support/format'

import { runDealOutboxAction, sweepDealsAction, syncNowAction } from './actions'

export const metadata: Metadata = { title: 'Deals' }

type SP = { view?: string; q?: string; page?: string; ok?: string; error?: string }
const VIEWS: { key: DealView; label: string }[] = [
  { key: 'submitted', label: 'New' },
  { key: 'extensionRequested', label: 'Extensions' },
  { key: 'infoRequested', label: 'Awaiting partner' },
  { key: 'approved', label: 'Approved' },
  { key: 'closed', label: 'Closed' },
  { key: 'all', label: 'All' },
]

/* The Deal Desk Approver's queue (FR-DEAL-05, 02-build-plan.md §4): the counters, the views, the search, the ledger with what
   waits oldest first; the conflicts found at submission are counted on the row. The sweep and the CRM jobs run from here too. */
export default async function K7DealsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const me = await requireK7Role(['dealDeskApprover'], K7_DEALS)
  const view = (VIEWS.some((v) => v.key === sp.view) ? sp.view : 'submitted') as DealView
  const page = Math.max(1, Number(sp.page) || 1)
  const [list, counts, owed, settings] = await Promise.all([listDealsK7({ view, q: sp.q, page }), dealCounts(), owedOutboxCount(), getPartnerSettings()])
  const base = { view, q: sp.q }
  const counter = (label: string, n: number, href: string, hot = false) => (
    <Link className={`kpi${hot && n > 0 ? ' is-signal' : ''}`} href={href} key={label}>
      <span className="n">{n}</span>
      <span className="label">{label}</span>
    </Link>
  )
  return (
    <>
      <K7Nav active="deals" roles={me.roles} counts={{ deals: counts.open }} />
      <section className="sheet ws g-paper">
        <div className="ws-head">
          <div className="ws-head-main">
            <span className="label muted">Partner desk · deals</span>
            <h1 className="h-util">What partners have registered.</h1>
            <p className="lede">New registrations and extension requests, oldest first. Open one, read the conflicts, decide; the partner is told at every step and the opportunity is written to Dynamics on approval.</p>
          </div>
          <div className="ws-actions">
            <form action={sweepDealsAction}>
              <button className="btn btn-line btn-sm" type="submit" title="Expire ended protection and send the ending notices now">
                Run the sweep
              </button>
            </form>
            {owed > 0 && settings.crm.enabled && (
              <form action={runDealOutboxAction}>
                <button className="btn btn-line btn-sm" type="submit" title="Run the CRM jobs that are waiting">
                  Run {owed} CRM job{owed === 1 ? '' : 's'}
                </button>
              </form>
            )}
            <form action={syncNowAction}>
              <button className="btn btn-line btn-sm" type="submit" title="Read the portal's opportunities back from Dynamics for the partner dashboards now">
                Sync the CRM
              </button>
            </form>
            <Link className="link-u label" href={`${K7_DEALS}/sync`}>
              Reconciliation log →
            </Link>
          </div>
        </div>
        {sp.ok && <Flash>{sp.ok}</Flash>}
        {sp.error && <Flash kind="error">{sp.error}</Flash>}

        <div className="kpis" style={{ marginBottom: 'clamp(32px, 4cqw, 48px)' }}>
          {counter('New', counts.submitted, `${K7_DEALS}?view=submitted`, true)}
          {counter('Extensions', counts.extensionRequested, `${K7_DEALS}?view=extensionRequested`, true)}
          {counter('Awaiting partner', counts.infoRequested, `${K7_DEALS}?view=infoRequested`)}
          {counter('Approved', counts.approved, `${K7_DEALS}?view=approved`)}
          {counter('Ending soon', counts.endingSoon, `${K7_DEALS}?view=approved`)}
          {counter('CRM jobs waiting', owed, K7_DEALS, !settings.crm.enabled && owed > 0)}
        </div>

        <form className="views" action={K7_DEALS} method="get" role="search">
          <div className="seg-choice" role="group" aria-label="View">
            {VIEWS.map((v) => (
              <label key={v.key}>
                <input type="radio" name="view" value={v.key} defaultChecked={view === v.key} />
                {v.label}
              </label>
            ))}
          </div>
          <span className="control" style={{ flex: '1 1 240px', maxWidth: 360 }}>
            <input name="q" type="search" placeholder="Deal ID, customer, partner, OPP number" defaultValue={sp.q ?? ''} aria-label="Search deals" />
            <button type="submit" aria-label="Search">
              →
            </button>
          </span>
        </form>

        {list.rows.length === 0 ? (
          <Empty label={VIEWS.find((v) => v.key === view)?.label}>{sp.q ? `Nothing matches “${sp.q}”.` : view === 'submitted' ? 'Nothing is waiting. New registrations arrive from the partners’ portal and appear here and in your notifications.' : 'Nothing in this view.'}</Empty>
        ) : (
          <div className="filed ledger">
            <span className="ftab label">
              {list.total} deal{list.total === 1 ? '' : 's'}
            </span>
            <div className="table-wrap">
              <table className="dtable">
                <thead>
                  <tr>
                    <th scope="col">Deal</th>
                    <th scope="col">Customer</th>
                    <th scope="col">Partner</th>
                    <th scope="col">Products</th>
                    <th scope="col" className="num">
                      Value
                    </th>
                    <th scope="col">Status</th>
                    <th scope="col">Conflicts</th>
                    <th scope="col">Protection</th>
                    <th scope="col">{view === 'submitted' || view === 'extensionRequested' ? 'Waiting' : 'Updated'}</th>
                  </tr>
                </thead>
                <tbody>
                  {list.rows.map((d) => {
                    const left = d.status === 'approved' || d.status === 'extensionRequested' ? daysLeft(d.protectionEnds) : null
                    const waiting = d.status === 'extensionRequested' ? d.extension.requestedAt : d.submittedAt
                    return (
                      <tr className="row" key={d.id}>
                        <td className="id">
                          <Did id={d.dealId} href={`${K7_DEALS}/${d.dealId}`} />
                        </td>
                        <td className="title">
                          <Link href={`${K7_DEALS}/${d.dealId}`}>{d.customer.name}</Link>
                          <div className="muted">
                            {d.customer.city}
                            {d.reseller.name ? ` · for ${d.reseller.name}` : ''}
                          </div>
                        </td>
                        <td className="text">
                          <Pid id={d.orgPartnerId} href={`/partners/portal/k7/partners/${d.orgPartnerId}`} />
                          <div className="muted">{d.orgName}</div>
                        </td>
                        <td className="text">{d.products.map((l) => `${l.name} × ${l.quantity}`).join(', ') || <span className="muted">—</span>}</td>
                        <td className="num">{formatInr(d.expectedValue)}</td>
                        <td className="status">
                          <DealStateTag status={d.status} />
                        </td>
                        <td className="status">{d.conflicts.length ? <span className="tag tag-signal">{d.conflicts.length}</span> : <span className="muted">none</span>}</td>
                        <td className="text">{left !== null && d.protectionEnds ? `to ${dmy(d.protectionEnds)} · ${left > 0 ? `${left} d` : 'ended'}` : <span className="muted">—</span>}</td>
                        <td className="num" title={waiting ?? d.updatedAt}>
                          {view === 'submitted' || view === 'extensionRequested' ? (waiting ? relative(waiting) : '—') : relative(d.updatedAt)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="ledger-foot">
              <span className="label">
                {VIEWS.find((v) => v.key === view)?.label} · page {list.page} of {list.totalPages}
              </span>
              <Pager page={list.page} totalPages={list.totalPages} href={(p) => `${K7_DEALS}${qs(base, { page: p > 1 ? p : undefined })}`} label="Deals pages" />
            </div>
          </div>
        )}
      </section>
    </>
  )
}

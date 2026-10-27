import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { K7, K7Nav } from '@/components/partner/K7Nav'
import { Aid, AppStateTag, Empty, Flash, TypeTag } from '@/components/partner/Parts'
import { SlaTag } from '@/components/partner/Sla'
import { SubmitButton } from '@/components/partner/SubmitButton.client'
import { Pager, qs } from '@/components/support/Parts'
import { owedOutboxCount } from '@/lib/partner/mirror'
import { applicationCounts, K7_APPLICATIONS, listApplications, type ApplicationFilter } from '@/lib/partner/registration'
import { requireK7Role } from '@/lib/partner/session'
import { getPartnerSettings } from '@/lib/partner/settings'
import { readingFor } from '@/lib/partner/sla'
import { applicationClock } from '@/lib/partner/sla-model'
import { APPLICATION_STATUS_LABEL, type ApplicationStatus } from '@/lib/partner/status'
import { dmy, relative } from '@/lib/support/format'

import { runOutboxAction } from './actions'

export const metadata: Metadata = { title: 'Applications' }

type SP = { status?: string; q?: string; mine?: string; page?: string; ok?: string; error?: string }
const VIEWS: { key: NonNullable<ApplicationFilter['status']>; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'submitted', label: 'New' },
  { key: 'underReview', label: 'Under review' },
  { key: 'clarification', label: 'Awaiting partner' },
  { key: 'decided', label: 'Decided' },
  { key: 'all', label: 'All' },
]

/* The Channel Manager's queue (FR-REG-05, 02-build-plan.md §4): the counters, the view switch, the search, and the ledger of
   applications oldest-first so nothing waits unseen. Decided ones sort newest-first. */
export default async function K7ApplicationsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const me = await requireK7Role(['channelManager'], K7_APPLICATIONS)
  const status = (VIEWS.some((v) => v.key === sp.status) ? sp.status : 'open') as NonNullable<ApplicationFilter['status']>
  const page = Math.max(1, Number(sp.page) || 1)
  const mine = sp.mine === '1' ? me.email : undefined
  const [list, counts, owed, settings] = await Promise.all([listApplications({ status, q: sp.q, mine, page }), applicationCounts(), owedOutboxCount(), getPartnerSettings()])
  const base = { status, q: sp.q, mine: sp.mine }
  const counter = (label: string, n: number, href: string, hot = false) => (
    <Link className={`kpi${hot && n > 0 ? ' is-signal' : ''}`} href={href} key={label}>
      <span className="n">{n}</span>
      <span className="label">{label}</span>
    </Link>
  )
  return (
    <>
      <K7Nav active="applications" roles={me.roles} counts={{ applications: counts.submitted }} />
      <section className="sheet ws g-paper">
        <div className="ws-head">
          <div className="ws-head-main">
            <span className="label muted">Partner desk · applications</span>
            <h1 className="h-util">Who wants to join.</h1>
            <p className="lede">Every application to the programme, oldest first. Take one, read it, decide; the applicant is emailed at every step and the organisation is created on approval.</p>
          </div>
          <div className="ws-actions">
            {owed > 0 && settings.crm.enabled && (
              <form action={runOutboxAction}>
                <SubmitButton className="btn btn-line btn-sm" pendingLabel="Running…" title="Run the CRM jobs that are waiting">
                  Run {owed} CRM job{owed === 1 ? '' : 's'}
                </SubmitButton>
              </form>
            )}
          </div>
        </div>
        {sp.ok && <Flash>{sp.ok}</Flash>}
        {sp.error && <Flash kind="error">{sp.error}</Flash>}

        <div className="kpis" style={{ marginBottom: 'clamp(32px, 4cqw, 48px)' }}>
          {counter('New', counts.submitted, `${K7_APPLICATIONS}?status=submitted`, true)}
          {counter('Under review', counts.underReview, `${K7_APPLICATIONS}?status=underReview`)}
          {counter('Awaiting partner', counts.clarification, `${K7_APPLICATIONS}?status=clarification`)}
          {counter('Approved', counts.approved, `${K7_APPLICATIONS}?status=decided`)}
          {counter('Rejected', counts.rejected, `${K7_APPLICATIONS}?status=decided`)}
          {counter('CRM jobs waiting', owed, `${K7}/applications`, !settings.crm.enabled && owed > 0)}
        </div>

        <form className="views" action={K7_APPLICATIONS} method="get" role="search">
          <div className="seg-choice" role="group" aria-label="View">
            {VIEWS.map((v) => (
              <label key={v.key}>
                <input type="radio" name="status" value={v.key} defaultChecked={status === v.key} />
                {v.label}
              </label>
            ))}
          </div>
          <label className="check" style={{ fontSize: 13 }}>
            <input type="checkbox" name="mine" value="1" defaultChecked={sp.mine === '1'} />
            <span>Assigned to me</span>
          </label>
          <span className="control" style={{ flex: '1 1 240px', maxWidth: 360 }}>
            <input name="q" type="search" placeholder="Number, company, contact, city" defaultValue={sp.q ?? ''} aria-label="Search applications" />
            <button type="submit" aria-label="Search">
              →
            </button>
          </span>
        </form>

        {list.rows.length === 0 ? (
          <Empty label={VIEWS.find((v) => v.key === status)?.label}>{sp.q ? `Nothing matches “${sp.q}”.` : status === 'open' ? 'Nothing is waiting. New applications arrive from /partners/join and appear here and in your notifications.' : 'Nothing in this view.'}</Empty>
        ) : (
          <div className="filed ledger">
            <span className="ftab label">
              {list.total} application{list.total === 1 ? '' : 's'}
            </span>
            <div className="table-wrap">
              <table className="dtable">
                <thead>
                  <tr>
                    <th scope="col">Number</th>
                    <th scope="col">Company</th>
                    <th scope="col">Type</th>
                    <th scope="col">Where</th>
                    <th scope="col">Contact</th>
                    <th scope="col">Status</th>
                    <th scope="col">Assigned</th>
                    <th scope="col">{status === 'decided' ? 'Decided' : 'Submitted'}</th>
                    {status !== 'decided' && <th scope="col">Decision due</th>}
                  </tr>
                </thead>
                <tbody>
                  {list.rows.map((a) => (
                    <tr className="row" key={a.id}>
                      <td className="id">
                        <Aid number={a.number} href={`${K7_APPLICATIONS}/${a.number}`} />
                      </td>
                      <td className="title" style={{ position: 'relative' }}>
                        <Link href={`${K7_APPLICATIONS}/${a.number}`}>{a.company.legalName || 'Unnamed'}</Link>
                        {a.company.tradeName && a.company.tradeName !== a.company.legalName && <div className="muted">{a.company.tradeName}</div>}
                      </td>
                      <td className="status">
                        <TypeTag type={a.type} />
                      </td>
                      <td className="text">
                        {a.company.city}
                        {a.company.city && a.company.country ? ', ' : ''}
                        {a.company.country}
                      </td>
                      <td className="text">
                        {a.contact.name}
                        <div className="muted">{a.contact.email}</div>
                      </td>
                      <td className="status">
                        <AppStateTag status={a.status} />
                      </td>
                      <td className="text">{a.assignee.name || a.assignee.email || <span className="muted">—</span>}</td>
                      <td className="num" title={status === 'decided' ? (a.decidedAt ?? '') : (a.submittedAt ?? '')}>
                        {status === 'decided' ? (a.decidedAt ? dmy(a.decidedAt) : '—') : a.submittedAt ? relative(a.submittedAt) : '—'}
                      </td>
                      {status !== 'decided' && (
                        <td className="status">
                          {(() => {
                            const clock = applicationClock(a)
                            return clock ? <SlaTag reading={readingFor(clock, settings)} sla={settings.sla} /> : <span className="muted">{a.status === 'clarification' ? 'on the partner' : '—'}</span>
                          })()}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ledger-foot">
              <span className="label">
                {APPLICATION_STATUS_LABEL[status as ApplicationStatus] ?? VIEWS.find((v) => v.key === status)?.label} · page {list.page} of {list.totalPages}
              </span>
              <Pager page={list.page} totalPages={list.totalPages} href={(p) => `${K7_APPLICATIONS}${qs(base, { page: p > 1 ? p : undefined })}`} label="Applications pages" />
            </div>
          </div>
        )}
      </section>
    </>
  )
}

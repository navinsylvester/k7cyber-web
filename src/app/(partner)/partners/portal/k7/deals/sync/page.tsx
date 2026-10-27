import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { OutcomeTag } from '@/components/partner/Dashboard'
import { Did } from '@/components/partner/Deals'
import { K7Nav } from '@/components/partner/K7Nav'
import { Empty, Flash, Pid } from '@/components/partner/Parts'
import { SubmitButton } from '@/components/partner/SubmitButton.client'
import { Crumbs } from '@/components/support/Parts'
import { dealCounts, K7_DEALS } from '@/lib/partner/deals'
import { requireK7Role } from '@/lib/partner/session'
import { getPartnerSettings } from '@/lib/partner/settings'
import { dealsWithSyncErrors, listSyncRuns, unreadOpportunityCount } from '@/lib/partner/sync'
import { dmyHm, relative } from '@/lib/support/format'

import { syncNowAction } from '../actions'

export const metadata: Metadata = { title: 'CRM reconciliation' }

type SP = { ok?: string; error?: string }

/* The reconciliation log (FR-DASH-05, FR-DASH-11): every run of the dashboard read-back with what it scanned, fetched and changed,
   the lines it printed, and the deals whose opportunity the CRM no longer returns. The per-deal changes themselves are audit rows
   on the deal (its record on the sheet). Sync now runs it past the interval. */
export default async function K7SyncLogPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const me = await requireK7Role(['dealDeskApprover'], `${K7_DEALS}/sync`)
  const [runs, errored, unread, counts, settings] = await Promise.all([listSyncRuns(30), dealsWithSyncErrors(), unreadOpportunityCount(), dealCounts(), getPartnerSettings()])
  const last = runs.find((r) => !r.orgId) ?? runs[0]
  return (
    <>
      <K7Nav active="deals" roles={me.roles} counts={{ deals: counts.open }} />
      <section className="sheet ws g-paper">
        <Crumbs items={[{ label: 'Deals', href: K7_DEALS }, { label: 'CRM reconciliation' }]} />
        <div className="ws-head">
          <div className="ws-head-main">
            <span className="label muted">Partner desk · deals · CRM</span>
            <h1 className="h-util">What the CRM said.</h1>
            <p className="lede">
              The portal reads its own opportunities back from Dynamics every {settings.crm.syncMinutes} minutes for the partner dashboards: stage, state and value. Where the CRM and a registration disagree, the CRM wins and the deal’s record says so (FR-DASH-11). This is the log of those runs.
            </p>
          </div>
          <div className="ws-actions">
            <form action={syncNowAction}>
              <SubmitButton className="btn btn-primary btn-sm" pendingLabel="Reading…" title="Read every portal opportunity back from Dynamics now, whatever the interval">
                Sync now
              </SubmitButton>
            </form>
          </div>
        </div>
        {sp.ok && <Flash>{sp.ok}</Flash>}
        {sp.error && <Flash kind="error">{sp.error}</Flash>}

        <div className="kpis" style={{ marginBottom: 'clamp(32px, 4cqw, 48px)' }}>
          <div className="kpi">
            <span className="n is-money" title={last ? dmyHm(last.at) : ''}>
              {last ? relative(last.at) : 'never'}
            </span>
            <span className="label">Last run</span>
          </div>
          <div className="kpi">
            <span className="n">{last ? last.scanned : 0}</span>
            <span className="label">Opportunities read</span>
          </div>
          <div className={`kpi${last && last.changed > 0 ? ' is-signal' : ''}`}>
            <span className="n">{last ? last.changed : 0}</span>
            <span className="label">Changed on the last run</span>
          </div>
          <div className={`kpi${unread > 0 ? ' is-signal' : ''}`}>
            <span className="n">{unread}</span>
            <span className="label">Awaiting first read-back</span>
          </div>
          <div className={`kpi${errored.length > 0 ? ' is-signal' : ''}`}>
            <span className="n">{errored.length}</span>
            <span className="label">Not found in the CRM</span>
          </div>
        </div>

        {errored.length > 0 && (
          <div className="pending conflicts" style={{ marginBottom: 'clamp(32px, 4cqw, 48px)' }}>
            <h2>
              <span className="pixel" aria-hidden="true" /> {errored.length} deal{errored.length === 1 ? '' : 's'} whose opportunity the CRM does not return
            </h2>
            <ol className="ntf">
              {errored.map((d) => (
                <li key={d.id}>
                  <span className="ntf-when">
                    <Did id={d.dealId} href={`${K7_DEALS}/${d.dealId}`} />
                  </span>
                  <div className="ntf-body">
                    <strong>
                      {d.customer.name} <OutcomeTag deal={d} />
                    </strong>
                    <p>
                      <Pid id={d.orgPartnerId} /> {d.orgName} · {d.crm.opportunityNo || d.crm.opportunityId} · {d.crm.snapshot.error}
                      {d.crm.snapshot.syncedAt ? ` · last read ${relative(d.crm.snapshot.syncedAt)}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {runs.length === 0 ? (
          <Empty label="Runs">No run yet. The scheduler posts to /api/partners/sync; Sync now runs it from here.</Empty>
        ) : (
          <div className="filed ledger">
            <span className="ftab label">
              {runs.length} run{runs.length === 1 ? '' : 's'}
            </span>
            <div className="table-wrap">
              <table className="dtable sync-runs">
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">By</th>
                    <th scope="col" className="num">
                      Scanned
                    </th>
                    <th scope="col" className="num">
                      Returned
                    </th>
                    <th scope="col" className="num">
                      Changed
                    </th>
                    <th scope="col" className="num">
                      Missing
                    </th>
                    <th scope="col" className="num">
                      Errors
                    </th>
                    <th scope="col">Lines</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr className={`row${r.ok ? '' : ' is-failed'}`} key={r.id}>
                      <td className="text" title={r.at}>
                        {dmyHm(r.at)}
                        <div className="muted">{r.durationMs ? `${(r.durationMs / 1000).toFixed(1)} s` : ''}</div>
                      </td>
                      <td className="text">
                        {r.trigger === 'cron' ? 'Scheduler' : r.actor || 'By hand'}
                        {r.orgId ? <div className="muted">one organisation</div> : null}
                      </td>
                      <td className="num">{r.scanned}</td>
                      <td className="num">{r.fetched}</td>
                      <td className={`num${r.changed ? ' is-ending' : ''}`}>{r.changed}</td>
                      <td className="num">{r.missing}</td>
                      <td className={`num${r.errors ? ' is-ending' : ''}`}>{r.errors}</td>
                      <td className="text">
                        {r.lines.length === 0 ? (
                          <span className="muted">{r.ok ? 'Nothing changed' : 'Failed'}</span>
                        ) : (
                          <details>
                            <summary className="label">
                              {r.lines.length} line{r.lines.length === 1 ? '' : 's'}
                            </summary>
                            <ul className="sync-lines">
                              {r.lines.map((l, i) => (
                                <li key={i}>{l}</li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ledger-foot">
              <span className="label">Newest first · the last 30</span>
              <Link className="link-u label" href={`/admin/collections/partner-sync-runs`}>
                All runs in the admin →
              </Link>
            </div>
          </div>
        )}
      </section>
    </>
  )
}

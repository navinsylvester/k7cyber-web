import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { Cols, Bars } from '@/components/support/Charts'
import { CareTag } from '@/components/support/Csat'
import { Empty, StatusTag, Tid, When } from '@/components/support/Parts'
import { WS, WorkspaceBar } from '@/components/support/WorkspaceBar'
import { fv } from '@/lib/dataverse/types'
import { myCounts } from '@/lib/support/cases'
import { careForCustomers } from '@/lib/support/csat'
import { activeByStatus, creationTrend } from '@/lib/support/dashboards'
import { getSettings } from '@/lib/support/kpi-config'
import { myQueueItems } from '@/lib/support/queues'
import { requireAgent } from '@/lib/support/session'
import { getView, runCaseView } from '@/lib/support/views'

export const metadata: Metadata = { title: 'Workspace' }

const greeting = () => {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }).format(new Date()))
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

/* The agent's home: their numbers, their active cases, what they picked from queues, and the desk's pulse today. */
export default async function WorkspaceHome() {
  const me = await requireAgent()
  const [counts, myActiveView, queue, trend, byStatus] = await Promise.all([
    myCounts(me.auth, me.userId).catch(() => null),
    getView(me.auth, 'My Active Cases'),
    myQueueItems(me.auth, me.userId, 8).catch(() => []),
    creationTrend(me.auth),
    activeByStatus(me.auth),
  ])
  const mine = myActiveView ? await runCaseView(me.auth, myActiveView, { page: 1, pageSize: 8, sort: 'modifiedon', dir: 'desc' }).catch(() => null) : null
  const settings = await getSettings()
  const care = settings.csat.enabled && mine ? await careForCustomers(mine.rows.map((r) => String(r._customerid_value ?? '')), settings).catch(() => new Map()) : new Map()
  const caseHref = (id: string) => `${WS}/cases/${id}`
  return (
    <>
      <WorkspaceBar active="home" />
      <section className="sheet ws g-paper">
        <div className="ws-head">
          <div className="ws-head-main">
            <span className="label muted">{me.dev ? 'Development · UAT' : 'UAT'} · {new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })}</span>
            <h1 className="h-util">
              {greeting()}, {me.name.split(' ')[0] || 'there'}.
            </h1>
          </div>
          <div className="ws-actions">
            <Link className="btn btn-primary btn-sm" href={`${WS}/cases/new`}>
              New case →
            </Link>
            <Link className="btn btn-line btn-sm" href={`${WS}/cases`}>
              All views
            </Link>
          </div>
        </div>

        {counts && (
          <div className="kpis">
            <Link className="kpi" href={`${WS}/cases?view=My%20Active%20Cases`}>
              <span className="n">{mine?.total ?? counts.active}</span>
              <span className="label">My active cases</span>
            </Link>
            <Link className="kpi" href={`${WS}/cases?view=My%20Active%20Cases&sort=statuscode`}>
              <span className="n">{counts.waiting}</span>
              <span className="label">Waiting on customer</span>
            </Link>
            <Link className={`kpi${counts.critical ? ' is-signal' : ''}`} href={`${WS}/cases?view=My%20Active%20Cases&sort=prioritycode`}>
              <span className="n">{counts.critical}</span>
              <span className="label">High or critical</span>
            </Link>
            <Link className="kpi" href={`${WS}/cases?view=My%20Resolved%20Cases`}>
              <span className="n">{counts.resolvedToday}</span>
              <span className="label">Resolved today</span>
            </Link>
          </div>
        )}

        <div className="two-col" style={{ marginTop: 'clamp(32px, 4cqw, 48px)' }}>
          <div>
            <h2 className="sub-head">
              My active cases
              <Link className="label" href={`${WS}/cases?view=My%20Active%20Cases`}>
                View all →
              </Link>
            </h2>
            {!mine || mine.rows.length === 0 ? (
              <Empty label="Nothing assigned">No active cases are assigned to you. Pick one from a queue or create a new case.</Empty>
            ) : (
              <div className="mini-rows">
                {mine.rows.map((r) => (
                  <Link className="mini-row" href={caseHref(String(r.incidentid))} key={String(r.incidentid)}>
                    <span className="t">
                      {r.prioritycode === 696720000 && <i className="crit" aria-label="Critical" />}
                      {String(r.title ?? '')}
                    </span>
                    <span className="s">
                      <Tid ticket={String(r.ticketnumber ?? '')} /> · <CareTag care={care.get(String(r._customerid_value ?? ''))} mark />
                      {fv(r, '_customerid_value') || 'No customer'} · <When date={String(r.modifiedon ?? '')} />
                    </span>
                    <span className="r">
                      <StatusTag row={r} />
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div>
            <h2 className="sub-head">
              Items I am working on
              <Link className="label" href={`${WS}/queues`}>
                Queues →
              </Link>
            </h2>
            {queue.length === 0 ? (
              <Empty label="Queue">You have not picked anything from a queue.</Empty>
            ) : (
              <div className="mini-rows">
                {queue.map((q) => {
                  const objectId = String(q._objectid_value ?? '')
                  const isCase = String(q.objecttypecode ?? '') === 'incident'
                  return isCase ? (
                    <Link className="mini-row" href={caseHref(objectId)} key={String(q.queueitemid)}>
                      <span className="t">{String(q.title ?? '')}</span>
                      <span className="s">
                        {fv(q, '_queueid_value')} · entered <When date={String(q.enteredon ?? '')} />
                      </span>
                      <span className="r">Case</span>
                    </Link>
                  ) : (
                    <div className="mini-row" key={String(q.queueitemid)}>
                      <span className="t">{String(q.title ?? '')}</span>
                      <span className="s">{fv(q, '_queueid_value')}</span>
                      <span className="r">{fv(q, 'objecttypecode')}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="two-col" style={{ marginTop: 'clamp(32px, 4cqw, 48px)' }}>
          <div className="chart">
            <div className="chart-head">
              <h3>Cases opened, last 14 days</h3>
              <span className="label muted">All agents</span>
            </div>
            {trend.length ? <Cols series={trend} /> : <p className="hint">No data.</p>}
          </div>
          <div className="chart">
            <div className="chart-head">
              <h3>Active cases by status reason</h3>
              <Link className="label" href={`${WS}/dashboards/active-cases`}>
                Dashboard →
              </Link>
            </div>
            {byStatus.length ? <Bars series={byStatus} /> : <p className="hint">No data.</p>}
          </div>
        </div>
      </section>
    </>
  )
}

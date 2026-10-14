import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { Bars } from '@/components/support/Charts'
import { EngineerCard, KpiCard, MANAGE, ManageNav, PeriodSeg, SlaStrip, Trend2 } from '@/components/support/Manage'
import { PageHead } from '@/components/support/Parts'
import { WorkspaceBar } from '@/components/support/WorkspaceBar'
import { getSettings } from '@/lib/support/kpi-config'
import { asPeriod, PERIODS } from '@/lib/support/kpi-model'
import { breakdown, engineerStats, kpiValues, loadDesk, slaNow, trend, violations } from '@/lib/support/metrics'
import { requireManager } from '@/lib/support/session'
import { dmyHm } from '@/lib/support/format'

export const metadata: Metadata = { title: 'Service management' }

type SP = { period?: string }

/* The manager's overview (09-portal-guide.md §4c): the configured KPI cards against their targets, the live SLA strip,
   the engineers carrying the most, where this period's breaches fall, and the day-by-day flow. */
export default async function ManageOverview({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const me = await requireManager()
  const settings = await getSettings()
  const period = asPeriod(sp.period, settings.defaultPeriod)
  const [desk, prev] = await Promise.all([loadDesk(me.auth, settings, period), loadDesk(me.auth, settings, period, { previous: true }).catch(() => null)])
  const kpis = kpiValues(desk, prev)
  const now = slaNow(desk)
  const engineers = engineerStats(desk).filter((e) => e.owner.kind === 'user').slice(0, 6)
  const vio = violations(desk)
  const days = trend(desk).map((d) => ({ day: d.day, a: d.created, b: d.resolved }))
  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? period
  const kpiHref = (key: string) => (key === 'at-risk' || key === 'breached-open' || key === 'backlog' || key === 'oldest-open' ? `${MANAGE}/at-risk` : key === 'throughput' || key === 'fcr' ? `${MANAGE}/engineers?period=${period}` : `${MANAGE}/sla?period=${period}`)
  return (
    <>
      <WorkspaceBar active="manage" />
      <section className="sheet ws g-paper">
        <PageHead
          above={
            <span className="label muted">
              Manager view · {periodLabel} · data as of {dmyHm(desk.fetchedAt)}
            </span>
          }
          title="Service management"
          lede={
            <>
              {desk.resolvedCases.length.toLocaleString('en-IN')} cases resolved and {desk.createdCases.length.toLocaleString('en-IN')} opened in the period; {desk.activeCases.length.toLocaleString('en-IN')} active now.
            </>
          }
          actions={<PeriodSeg period={period} href={(p) => `${MANAGE}?period=${p}`} />}
        />
        <ManageNav active="overview" period={period} />

        <div className="kpic-grid">
          {kpis.map((k) => (
            <KpiCard k={k} key={k.def.key} href={kpiHref(k.def.key)} />
          ))}
        </div>

        <h2 className="sub-head">
          SLA right now
          <Link className="label" href={`${MANAGE}/at-risk`}>
            At-risk board →
          </Link>
        </h2>
        <SlaStrip n={now} href={`${MANAGE}/at-risk`} />

        <div className="two-col" style={{ marginBottom: 'clamp(32px, 4cqw, 48px)' }}>
          <div className="chart">
            <div className="chart-head">
              <h3>Opened and resolved per day</h3>
              <span className="label muted">{periodLabel}</span>
            </div>
            <Trend2 days={days} aLabel="Opened" bLabel="Resolved" />
          </div>
          <div className="chart">
            <div className="chart-head">
              <h3>Breaches by engineer</h3>
              <Link className="label" href={`${MANAGE}/sla?period=${period}`}>
                SLA report →
              </Link>
            </div>
            {vio.length ? <Bars series={breakdown(vio.map((v) => v.c), 'owner', 8)} /> : <p className="hint">No breaches in the period.</p>}
          </div>
        </div>

        <h2 className="sub-head">
          Engineers carrying the most
          <Link className="label" href={`${MANAGE}/engineers?period=${period}`}>
            All engineers →
          </Link>
        </h2>
        <div className="eng-grid-wrap">
          {engineers.map((e) => (
            <EngineerCard e={e} period={period} key={e.owner.id} />
          ))}
        </div>

        {desk.warnings.length > 0 && (
          <ul className="note-list caveats">
            {desk.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
        <p className="caveats">
          Readings use the targets and business hours from <Link href={`${MANAGE}/kpis`}>KPI settings</Link>; Dataverse&apos;s own KPI instances appear beside them on each case where one exists. Raw rows refresh every 90 seconds.
        </p>
      </section>
    </>
  )
}

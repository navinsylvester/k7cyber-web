import type { Metadata } from 'next'
import React from 'react'

import { K7Nav } from '@/components/partner/K7Nav'
import { Flash } from '@/components/partner/Parts'
import { ApplicationsLedger, Counter, money, PipelineLedger, SchemesLedger, SlaLedger } from '@/components/partner/Reports'
import { isPeriodKey, periodBounds, periodLabel, PERIODS, type PeriodKey } from '@/lib/partner/dashboard-model'
import { loadReports } from '@/lib/partner/reports'
import { REPORTS } from '@/lib/partner/reports-model'
import { requireK7Role } from '@/lib/partner/session'
import { hoursText, workingText } from '@/lib/partner/sla-model'
import { dmy } from '@/lib/support/format'

import { sweepSlaAction } from './actions'

export const metadata: Metadata = { title: 'Reports' }

const PATH = '/partners/portal/k7/reports'
type SP = { period?: string; ok?: string; error?: string }

/** "Pipeline by partner, applications by state and the approval SLA," from the labels. */
const lede = (labels: string[]): string => {
  const low = labels.map((l, i) => (i === 0 ? l : l.replace(/^[A-Z](?![A-Z])/, (c) => c.toLowerCase())))
  const joined = low.length > 1 ? `${low.slice(0, -1).join(', ')} and ${low[low.length - 1]}` : (low[0] ?? '')
  return `${joined},`
}

/* The K7 reports (02-build-plan.md M8): the pipeline by partner, applications by state, the schemes' results and the approval
   SLA, for the period on the registration date, each with its CSV. Nothing here is live: the deals' outcomes are the CRM
   snapshots the sync wrote. */
export default async function K7ReportsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const me = await requireK7Role(['channelManager', 'dealDeskApprover', 'schemeAdmin'], PATH)
  const period: PeriodKey = isPeriodKey(sp.period) ? sp.period : PERIODS[PERIODS.length - 1]!.key
  const p = periodBounds(period)
  const r = await loadReports(p)
  const csv = (key: string) => `${PATH}/${key}/export.csv?period=${period}`
  const periodNote = p.from && p.to ? `${dmy(p.from)} – ${dmy(p.to)}` : p.from ? `since ${dmy(p.from)}` : 'all time'
  const cm = me.roles.includes('channelManager')
  const dda = me.roles.includes('dealDeskApprover')
  const sch = me.roles.includes('schemeAdmin')
  return (
    <>
      <K7Nav active="reports" roles={me.roles} counts={{ reports: r.sla.breached || undefined }} />
      <section className="sheet ws g-paper">
        <div className="ws-head">
          <div className="ws-head-main">
            <span className="label muted">Partner desk · reports</span>
            <h1 className="h-util">How the programme is doing.</h1>
            <p className="lede">{lede(REPORTS.filter((x) => (x.key === 'schemes' ? sch : x.key === 'applications' ? cm : cm || dda)).map((x) => x.label))} for the period on the registration date, each with its CSV. Outcomes and values are what the CRM said at the last read-back.</p>
          </div>
          {(cm || dda) && (
            <form action={sweepSlaAction} className="ws-actions">
              <input type="hidden" name="period" value={period} />
              <button className="btn btn-line btn-sm" type="submit" title="Send the breach notices for everything past the target now">
                Run the SLA pass
              </button>
            </form>
          )}
        </div>
        {sp.ok && <Flash>{sp.ok}</Flash>}
        {sp.error && <Flash kind="error">{sp.error}</Flash>}

        <form className="views dash-period" action={PATH} method="get" aria-label="Period">
          <div className="seg-choice" role="group" aria-label="Period, by registration date">
            {PERIODS.map((x) => (
              <label key={x.key}>
                <input type="radio" name="period" value={x.key} defaultChecked={period === x.key} />
                {x.label}
              </label>
            ))}
          </div>
          <span className="label muted dash-period-note">Registered {periodNote}</span>
        </form>

        <div className="kpis rep-cards">
          {(cm || dda) && <Counter label="Deals in the period" n={r.pipelineTotals.deals} />}
          {(cm || dda) && <Counter label="Pipeline" n={money(r.pipelineTotals.pipelineValue)} />}
          {(cm || dda) && <Counter label="Won value" n={money(r.pipelineTotals.wonValue)} hot={r.pipelineTotals.won > 0} />}
          {cm && <Counter label="Applications" n={r.applicationsReport.total} />}
          {(cm || dda) && <Counter label="Waiting on K7" n={r.sla.open} />}
          {(cm || dda) && <Counter label="Past the target" n={r.sla.breached} hot={r.sla.breached > 0} title={`Target ${r.settings.deals.approvalSlaHours} working hours, ${hoursText(r.settings.sla.hours)}`} />}
          {(cm || dda) && <Counter label="Median decision" n={r.sla.decided ? workingText(r.sla.medianMinutes ?? 0, r.settings.sla) : '—'} title={`${r.sla.decided} decided in the period`} />}
          {sch && <Counter label="Benefit due" n={money(r.schemeRows.reduce((s, x) => s + x.benefitDue, 0))} />}
        </div>

        <div className="rep-stack">
          {(cm || dda) && <PipelineLedger rows={r.pipeline} totals={r.pipelineTotals} csv={csv('pipeline')} />}
          {cm && <ApplicationsLedger report={r.applicationsReport} sla={r.settings.sla} csv={csv('applications')} />}
          {sch && <SchemesLedger rows={r.schemeRows} csv={csv('schemes')} />}
          {(cm || dda) && <SlaLedger report={r.sla} sla={r.settings.sla} csv={csv('sla')} />}
        </div>
        <p className="hint" style={{ marginTop: 24 }}>
          {periodLabel(period)}: deals by the date they were registered, applications by the date they were submitted; the schemes are every scheme that is not a draft; the SLA queue is what waits now whatever the period. The target is {r.settings.deals.approvalSlaHours} working hours, {hoursText(r.settings.sla.hours)}; the scheduler runs the SLA pass hourly.
        </p>
      </section>
    </>
  )
}

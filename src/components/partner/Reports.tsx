import Link from 'next/link'
import React from 'react'

import { formatInr } from '@/lib/partner/deals-model'
import { shortInr } from '@/lib/partner/dashboard-model'
import type { ApplicationsReport, PipelineRow, SchemeReportRow, SlaReport } from '@/lib/partner/reports-model'
import { workingText, type SlaSettings } from '@/lib/partner/sla-model'
import { dmy, dmyHm } from '@/lib/support/format'

import { Pid } from './Parts'

/* P27 The reports (design-system/components/PartnerParts/README.md): each report is a filed ledger that sums, with its CSV
   as a small outlined action on the tab, and a line of counters above where a number says more than a row. Money in full
   in the rows, short on the counters. */

export const ReportTab: React.FC<{ label: string; csv: string; count?: number }> = ({ label, csv, count }) => (
  <span className="ftab label rep-tab">
    {label}
    {typeof count === 'number' ? ` · ${count}` : ''}
    <a className="btn btn-line btn-sm" href={csv} download>
      CSV
    </a>
  </span>
)

export const PipelineLedger: React.FC<{ rows: PipelineRow[]; totals: PipelineRow; csv: string }> = ({ rows, totals, csv }) => (
  <div className="filed ledger rep">
    <ReportTab label="Pipeline by partner" csv={csv} count={rows.length} />
    <div className="table-wrap">
      <table className="dtable rep-table">
        <thead>
          <tr>
            <th scope="col">Partner</th>
            <th scope="col">Type</th>
            <th scope="col" className="num">Deals</th>
            <th scope="col" className="num">Open</th>
            <th scope="col" className="num">Won</th>
            <th scope="col" className="num">Lost</th>
            <th scope="col" className="num">Pipeline</th>
            <th scope="col" className="num">Won value</th>
            <th scope="col" className="num">Win rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr className="row" key={r.orgId}>
              <td className="title">
                <Link href={`/partners/portal/k7/partners/${r.partnerId}`}>{r.partner}</Link>
                <div className="muted">
                  <Pid id={r.partnerId} />
                </div>
              </td>
              <td className="text">{r.type || <span className="muted">—</span>}</td>
              <td className="num">{r.deals}</td>
              <td className="num">{r.open}</td>
              <td className={`num${r.won ? ' is-won' : ''}`}>{r.won}</td>
              <td className="num">{r.lost}</td>
              <td className="num">{formatInr(r.pipelineValue)}</td>
              <td className="num">{formatInr(r.wonValue)}</td>
              <td className="num">{r.winRate === null ? '—' : `${r.winRate}%`}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="sum">
            <td colSpan={2}>Every partner</td>
            <td className="num">{totals.deals}</td>
            <td className="num">{totals.open}</td>
            <td className="num">{totals.won}</td>
            <td className="num">{totals.lost}</td>
            <td className="num">{formatInr(totals.pipelineValue)}</td>
            <td className="num">{formatInr(totals.wonValue)}</td>
            <td className="num">{totals.winRate === null ? '—' : `${totals.winRate}%`}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
)

export const ApplicationsLedger: React.FC<{ report: ApplicationsReport; sla: SlaSettings; csv: string }> = ({ report: r, sla, csv }) => (
  <div className="filed ledger rep">
    <ReportTab label="Applications by state" csv={csv} count={r.total} />
    <div className="table-wrap">
      <table className="dtable rep-table">
        <thead>
          <tr>
            <th scope="col">State</th>
            <th scope="col" className="num">Applications</th>
            {r.types.map((t) => (
              <th scope="col" className="num" key={t}>
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {r.rows.map((row) => (
            <tr className="row" key={row.status}>
              <td className="title">
                <Link href={`/partners/portal/k7/applications?status=${row.status}`}>{row.label}</Link>
              </td>
              <td className="num">{row.total}</td>
              {r.types.map((t) => (
                <td className="num" key={t}>
                  {row.byType[t] ?? 0}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="sum">
            <td>In the period</td>
            <td className="num">{r.total}</td>
            {r.types.map((t) => (
              <td className="num" key={t}>
                {r.rows.reduce((s, row) => s + (row.byType[t] ?? 0), 0)}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
    <div className="ledger-foot">
      <span className="label">
        {r.decided ? `${r.decided} decided · median ${workingText(r.medianDecisionMinutes ?? 0, sla)} to a decision · ${r.withinTarget ?? 0}% inside the target` : 'No decision in the period'}
      </span>
    </div>
  </div>
)

export const SchemesLedger: React.FC<{ rows: SchemeReportRow[]; csv: string }> = ({ rows, csv }) => (
  <div className="filed ledger rep">
    <ReportTab label="Scheme results" csv={csv} count={rows.length} />
    <div className="table-wrap">
      <table className="dtable rep-table">
        <thead>
          <tr>
            <th scope="col">Scheme</th>
            <th scope="col">Phase</th>
            <th scope="col">Runs</th>
            <th scope="col" className="num">Registered</th>
            <th scope="col" className="num">Results</th>
            <th scope="col" className="num">Eligible</th>
            <th scope="col" className="num">Benefit due</th>
            <th scope="col" className="num">Paid</th>
            <th scope="col" className="num">Disputes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr className="row" key={r.schemeId}>
              <td className="title">
                <Link href={`/partners/portal/k7/schemes/${r.schemeId}`}>{r.scheme}</Link>
                {r.published && <div className="muted">published {dmy(r.published)}</div>}
              </td>
              <td className="text">{r.phase}</td>
              <td className="text dates">
                {dmy(r.startDate)} – {dmy(r.endDate)}
              </td>
              <td className="num">
                {r.registered}
                {r.pending ? <span className="muted"> +{r.pending} waiting</span> : null}
              </td>
              <td className="num">{r.results}</td>
              <td className="num">{r.eligible}</td>
              <td className="num">{formatInr(r.benefitDue)}</td>
              <td className="num">
                {r.paid}
                {r.paidAmount ? <span className="muted"> · {formatInr(r.paidAmount)}</span> : null}
              </td>
              <td className={`num${r.disputesOpen ? ' is-hot' : ''}`}>{r.disputesOpen}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="sum">
            <td colSpan={3}>Every scheme</td>
            <td className="num">{rows.reduce((s, r) => s + r.registered, 0)}</td>
            <td className="num">{rows.reduce((s, r) => s + r.results, 0)}</td>
            <td className="num">{rows.reduce((s, r) => s + r.eligible, 0)}</td>
            <td className="num">{formatInr(rows.reduce((s, r) => s + r.benefitDue, 0))}</td>
            <td className="num">{formatInr(rows.reduce((s, r) => s + r.paidAmount, 0))}</td>
            <td className="num">{rows.reduce((s, r) => s + r.disputesOpen, 0)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
)

export const SlaLedger: React.FC<{ report: SlaReport; sla: SlaSettings; csv: string }> = ({ report: r, sla, csv }) => (
  <div className="filed ledger rep">
    <ReportTab label="Waiting on K7 now" csv={csv} count={r.open} />
    {r.queue.length === 0 ? (
      <p className="hint" style={{ padding: '18px 0 0' }}>
        Nothing waits for a decision.
      </p>
    ) : (
      <div className="table-wrap">
        <table className="dtable rep-table">
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Partner</th>
              <th scope="col">Waiting since</th>
              <th scope="col">Due</th>
              <th scope="col">Standing</th>
            </tr>
          </thead>
          <tbody>
            {r.queue.map((q) => (
              <tr className={`row${q.state === 'breached' ? ' is-breached' : ''}`} key={`${q.kind}-${q.number}`}>
                <td className="title">
                  <Link href={q.href}>{q.label}</Link>
                  <div className="muted">{q.kind === 'deal' ? 'deal' : 'application'}</div>
                </td>
                <td className="text">{q.partner}</td>
                <td className="num">{dmyHm(q.startedAt)}</td>
                <td className="num">{dmyHm(q.dueAt)}</td>
                <td className="status">
                  <span className={q.state === 'breached' ? 'tag tag-signal' : q.state === 'at-risk' ? 'tag tag-state' : 'tag tag-quiet'}>{q.state === 'breached' ? `overdue by ${workingText(-q.leftMinutes, sla)}` : `${workingText(q.leftMinutes, sla)} left${q.state === 'at-risk' ? ' · at risk' : ''}`}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
    <div className="ledger-foot">
      <span className="label">
        Target {Math.round(r.targetMinutes / 60)} working hours · {r.decided ? `${r.decided} decided in the period · median ${workingText(r.medianMinutes ?? 0, sla)} · 90% within ${workingText(r.p90Minutes ?? 0, sla)} · ${r.withinTarget ?? 0}% inside the target` : 'no decision in the period'}
      </span>
    </div>
  </div>
)

export const Counter: React.FC<{ label: string; n: React.ReactNode; hot?: boolean; title?: string }> = ({ label, n, hot, title }) => (
  <div className={`kpi${hot ? ' is-signal' : ''}`} title={title}>
    <span className="n">{n}</span>
    <span className="label">{label}</span>
  </div>
)

export const money = (v: number): React.ReactNode => <span title={formatInr(v)}>{shortInr(v)}</span>

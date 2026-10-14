import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { Bars } from '@/components/support/Charts'
import { MANAGE, ManageNav, PeriodSeg, SlaMeter, SlaTag, Trend2 } from '@/components/support/Manage'
import { Options, PageHead, Pager, qs, Tid, When } from '@/components/support/Parts'
import { WS, WorkspaceBar } from '@/components/support/WorkspaceBar'
import { getSettings } from '@/lib/support/kpi-config'
import { asPeriod, PERIODS } from '@/lib/support/kpi-model'
import { breakdown, engineerStats, loadDesk, trend, violations, type BreakBy, type Violation } from '@/lib/support/metrics'
import { label as optLabel, ORIGIN, PRIORITY, VERTICAL } from '@/lib/support/options'
import { requireManager } from '@/lib/support/session'
import { fmtMinutes, pct } from '@/lib/support/sla'

export const metadata: Metadata = { title: 'SLA report' }

export type SlaSP = { period?: string; kind?: string; state?: string; owner?: string; priority?: string; vertical?: string; by?: string; page?: string }

const PATH = `${MANAGE}/sla`
const PAGE = 25

export const filterViolations = (all: Violation[], sp: SlaSP): Violation[] =>
  all.filter((v) => {
    if (sp.kind === 'resolution' || sp.kind === 'response') if (v.kind !== sp.kind) return false
    if (sp.state === 'open' && !v.open) return false
    if (sp.state === 'resolved' && v.open) return false
    if (sp.owner && v.c.owner.id !== sp.owner) return false
    if (sp.priority && String(v.c.priority ?? '') !== sp.priority) return false
    if (sp.vertical && String(v.c.vertical ?? '') !== sp.vertical) return false
    return true
  })

const BY: { key: BreakBy; label: string }[] = [
  { key: 'owner', label: 'Engineer' },
  { key: 'priority', label: 'Priority' },
  { key: 'vertical', label: 'Vertical' },
  { key: 'origin', label: 'Origin' },
  { key: 'issue', label: 'Issue category' },
  { key: 'product', label: 'Product' },
]

/* SLA violation reporting: every breach of the period, the share it represents, where the breaches fall and the ledger behind it. */
export default async function SlaReport({ searchParams }: { searchParams: Promise<SlaSP> }) {
  const sp = await searchParams
  const me = await requireManager()
  const settings = await getSettings()
  const period = asPeriod(sp.period, settings.defaultPeriod)
  const desk = await loadDesk(me.auth, settings, period)
  const all = violations(desk)
  const rows = filterViolations(all, sp)
  const page = Math.max(1, Number(sp.page) || 1)
  const slice = rows.slice((page - 1) * PAGE, page * PAGE)
  const by = (BY.find((b) => b.key === sp.by)?.key ?? 'owner') as BreakBy
  const base = { period, kind: sp.kind, state: sp.state, owner: sp.owner, priority: sp.priority, vertical: sp.vertical, by: sp.by }
  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? period
  const resolvedLate = desk.resolvedCases.filter((c) => c.resolve.state === 'breached').length
  const respPool = desk.createdCases.filter((c) => c.firstResponseAt || c.response.state === 'breached')
  const respLate = respPool.filter((c) => c.response.state === 'breached').length
  const openBreached = desk.activeCases.filter((c) => c.resolve.state === 'breached').length
  const days = trend(desk).map((d) => ({ day: d.day, a: d.resolved, b: d.late }))
  const owners = engineerStats(desk, { includeShared: true }).map((e) => e.owner)
  return (
    <>
      <WorkspaceBar active="manage" />
      <section className="sheet ws g-paper">
        <PageHead
          above={<span className="label muted">Manager view · {periodLabel}</span>}
          title="SLA violations"
          lede={
            <>
              {resolvedLate.toLocaleString('en-IN')} of {desk.resolvedCases.length.toLocaleString('en-IN')} cases resolved in the period missed their resolution target; {openBreached} active cases are past target now.
            </>
          }
          actions={
            <>
              <PeriodSeg period={period} href={(p) => PATH + qs(base, { period: p, page: undefined })} />
              <a className="btn btn-line btn-sm" href={`${PATH}/export.csv${qs(base)}`}>
                Export CSV →
              </a>
            </>
          }
        />
        <ManageNav active="sla" period={period} />

        <div className="kpis" style={{ marginBottom: 'clamp(32px, 4cqw, 48px)' }}>
          <div className="kpi">
            <span className="n">{pct(desk.resolvedCases.length - resolvedLate, desk.resolvedCases.length)?.toLocaleString('en-IN') ?? '—'}%</span>
            <span className="label">Resolved within target</span>
          </div>
          <div className="kpi">
            <span className="n">{pct(respPool.length - respLate, respPool.length)?.toLocaleString('en-IN') ?? '—'}%</span>
            <span className="label">First response within target</span>
          </div>
          <div className={`kpi${resolvedLate ? ' is-signal' : ''}`}>
            <span className="n">{resolvedLate.toLocaleString('en-IN')}</span>
            <span className="label">Resolved late</span>
          </div>
          <div className={`kpi${openBreached ? ' is-signal' : ''}`}>
            <span className="n">{openBreached}</span>
            <span className="label">Open past target</span>
          </div>
          <div className="kpi">
            <span className="n">{desk.crmBreachesInPeriod.toLocaleString('en-IN')}</span>
            <span className="label">CRM KPI non-compliant</span>
          </div>
        </div>

        <div className="two-col" style={{ marginBottom: 'clamp(32px, 4cqw, 48px)' }}>
          <div className="chart">
            <div className="chart-head">
              <h3>Resolved and resolved late per day</h3>
              <span className="label muted">{periodLabel}</span>
            </div>
            <Trend2 days={days} aLabel="Resolved" bLabel="Resolved late" />
          </div>
          <div className="chart">
            <div className="chart-head">
              <h3>Breaches by {BY.find((b) => b.key === by)?.label.toLowerCase()}</h3>
              <span className="seg seg-l" role="group" aria-label="Break down by">
                {BY.map((b) => (
                  <Link href={PATH + qs(base, { by: b.key, page: undefined })} key={b.key} aria-pressed={b.key === by}>
                    {b.label}
                  </Link>
                ))}
              </span>
            </div>
            {rows.length ? <Bars series={breakdown(rows.map((v) => v.c), by)} /> : <p className="hint">No breaches match.</p>}
          </div>
        </div>

        <form className="filters-inline" action={PATH} method="get" aria-label="Filter breaches">
          <input type="hidden" name="period" value={period} />
          <input type="hidden" name="by" value={by} />
          <div className="field">
            <label className="label" htmlFor="f-kind">
              Clock
            </label>
            <span className="control is-select">
              <select id="f-kind" name="kind" defaultValue={sp.kind ?? ''}>
                <Options empty="Both" items={[{ value: 'resolution', label: 'Resolution' }, { value: 'response', label: 'First response' }]} />
              </select>
            </span>
          </div>
          <div className="field">
            <label className="label" htmlFor="f-state">
              Case
            </label>
            <span className="control is-select">
              <select id="f-state" name="state" defaultValue={sp.state ?? ''}>
                <Options empty="Open and resolved" items={[{ value: 'open', label: 'Still open' }, { value: 'resolved', label: 'Resolved late' }]} />
              </select>
            </span>
          </div>
          <div className="field">
            <label className="label" htmlFor="f-owner">
              Owner
            </label>
            <span className="control is-select">
              <select id="f-owner" name="owner" defaultValue={sp.owner ?? ''}>
                <Options empty="Anyone" items={owners.map((o) => ({ value: o.id, label: o.name }))} />
              </select>
            </span>
          </div>
          <div className="field">
            <label className="label" htmlFor="f-priority">
              Priority
            </label>
            <span className="control is-select">
              <select id="f-priority" name="priority" defaultValue={sp.priority ?? ''}>
                <Options empty="Any" items={PRIORITY} />
              </select>
            </span>
          </div>
          <div className="field">
            <label className="label" htmlFor="f-vertical">
              Vertical
            </label>
            <span className="control is-select">
              <select id="f-vertical" name="vertical" defaultValue={sp.vertical ?? ''}>
                <Options empty="Any" items={VERTICAL} />
              </select>
            </span>
          </div>
          <div className="filters-actions">
            <button className="btn btn-line btn-sm" type="submit">
              Filter
            </button>
            {(sp.kind || sp.state || sp.owner || sp.priority || sp.vertical) && (
              <Link className="link-u" href={PATH + qs({ period, by })}>
                Clear
              </Link>
            )}
          </div>
        </form>

        <div className="table-wrap">
          <table className="dtable" style={{ minWidth: 1200 }}>
            <caption className="sr-only">Breaches</caption>
            <thead>
              <tr>
                <th scope="col">Case</th>
                <th scope="col">Title</th>
                <th scope="col">Clock</th>
                <th scope="col">Owner</th>
                <th scope="col">Priority</th>
                <th scope="col">Vertical</th>
                <th scope="col">Origin</th>
                <th scope="col">Target</th>
                <th scope="col">Took</th>
                <th scope="col">Over by</th>
                <th scope="col">State</th>
                <th scope="col">CRM KPI</th>
                <th scope="col">Created</th>
              </tr>
            </thead>
            <tbody>
              {slice.length === 0 && (
                <tr className="empty">
                  <td colSpan={13}>No breaches match these filters.</td>
                </tr>
              )}
              {slice.map((v) => (
                <tr className="row" key={`${v.c.id}-${v.kind}`}>
                  <td>
                    <Tid ticket={v.c.ticket} href={`${WS}/cases/${v.c.id}`} />
                  </td>
                  <td className="title">{v.c.title}</td>
                  <td className="text">{v.kind === 'resolution' ? 'Resolution' : 'First response'}</td>
                  <td className="text">
                    <Link href={`${MANAGE}/engineers/${v.c.owner.id}?period=${period}`}>{v.c.owner.name}</Link>
                  </td>
                  <td className="text">{optLabel(PRIORITY, v.c.priority) || '—'}</td>
                  <td className="text">{optLabel(VERTICAL, v.c.vertical) || '—'}</td>
                  <td className="text">{optLabel(ORIGIN, v.c.origin) || '—'}</td>
                  <td className="num">{fmtMinutes(v.reading.target)}</td>
                  <td className="num">{v.open ? <SlaMeter r={v.reading} compact /> : fmtMinutes(v.reading.elapsed)}</td>
                  <td className="num is-missed">{fmtMinutes(-v.reading.left)}</td>
                  <td className="status">{v.open ? <span className="tag tag-solid">Open</span> : <span className="tag tag-closed">Resolved</span>}</td>
                  <td>{v.c.crm ? <SlaTag state={v.c.crm.state} /> : <span className="muted">—</span>}</td>
                  <td className="num">
                    <When date={v.c.createdon.toISOString()} exact />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="ledger-foot label">
          <span>
            {rows.length.toLocaleString('en-IN')} breaches · page {page}
          </span>
          <Pager page={page} totalPages={Math.max(1, Math.ceil(rows.length / PAGE))} href={(p) => PATH + qs(base, { page: p > 1 ? p : undefined })} label="Breaches" newer="Previous" older="Next" />
        </div>
        <p className="caveats">
          A breach is a case whose working time ran past the target that <Link href={`${MANAGE}/kpis`}>KPI settings</Link> assign it, counted on the clock the business hours define. Response breaches count the first outgoing email or desk note. Reopened cases keep their original creation time.
        </p>
      </section>
    </>
  )
}

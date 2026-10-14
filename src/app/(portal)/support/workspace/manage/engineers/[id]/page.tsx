import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { Bars } from '@/components/support/Charts'
import { ScoreTag } from '@/components/support/Csat'
import { MANAGE, ManageNav, PeriodSeg, SlaMeter, SlaTag } from '@/components/support/Manage'
import { Avatar, PageHead, StatusTag, Tid, When } from '@/components/support/Parts'
import { WS, WorkspaceBar } from '@/components/support/WorkspaceBar'
import { isGuid } from '@/lib/dataverse/odata'
import { getSettings } from '@/lib/support/kpi-config'
import { asPeriod, PERIODS } from '@/lib/support/kpi-model'
import { breakdown, engineerById, engineerStats, loadDesk, type EngineerStats } from '@/lib/support/metrics'
import { label as optLabel, PRIORITY, VERTICAL } from '@/lib/support/options'
import { requireManager } from '@/lib/support/session'
import { dmyHm } from '@/lib/support/format'
import { fmtMinutes } from '@/lib/support/sla'

export const metadata: Metadata = { title: 'Engineer' }

type SP = { period?: string }

const n = (v: number | null, suffix = '') => (v === null ? '—' : `${v.toLocaleString('en-IN', { maximumFractionDigits: 1 })}${suffix}`)

const teamAverage = (team: EngineerStats[], pick: (e: EngineerStats) => number | null): number | null => {
  const xs = team.map(pick).filter((x): x is number => x !== null)
  return xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null
}

/* One engineer: their numbers beside the team's, every active case with its clock, and the cases they resolved late. */
export default async function EngineerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const { id } = await params
  const sp = await searchParams
  if (!isGuid(id)) notFound()
  const me = await requireManager()
  const settings = await getSettings()
  const period = asPeriod(sp.period, settings.defaultPeriod)
  const desk = await loadDesk(me.auth, settings, period)
  const all = engineerStats(desk, { includeShared: true })
  const e = engineerById(all, id)
  if (!e) notFound()
  const team = all.filter((x) => x.owner.kind === 'user')
  const mine = desk.activeCases.filter((c) => c.owner.id === id).sort((a, b) => a.resolve.left - b.resolve.left)
  const resolved = desk.resolvedCases.filter((c) => c.owner.id === id)
  const late = resolved.filter((c) => c.resolve.state === 'breached').sort((a, b) => b.resolve.ratio - a.resolve.ratio)
  const ratings = desk.csat.filter((r) => r.ownerId === id && r.status === 'responded' && r.score !== null).sort((a, b) => (a.score ?? 0) - (b.score ?? 0) || (b.respondedAt ?? '').localeCompare(a.respondedAt ?? ''))
  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? period
  const rows: { k: string; mine: string; team: string }[] = [
    { k: 'Active cases', mine: String(e.active), team: n(teamAverage(team, (x) => x.active)) },
    { k: 'Past target now', mine: String(e.breached), team: n(teamAverage(team, (x) => x.breached)) },
    { k: 'At risk now', mine: String(e.atRisk), team: n(teamAverage(team, (x) => x.atRisk)) },
    { k: 'Resolved in period', mine: String(e.resolved), team: n(teamAverage(team, (x) => x.resolved)) },
    { k: 'Resolved per working day', mine: n(e.perDay), team: n(teamAverage(team, (x) => x.perDay)) },
    { k: 'Resolution within target', mine: n(e.resolvePct, '%'), team: n(teamAverage(team, (x) => x.resolvePct), '%') },
    { k: 'Median resolution', mine: n(e.medianResolveHours, ' h'), team: n(teamAverage(team, (x) => x.medianResolveHours), ' h') },
    { k: 'First response within target', mine: n(e.responsePct, '%'), team: n(teamAverage(team, (x) => x.responsePct), '%') },
    { k: 'Median first response', mine: n(e.medianResponseMin, ' min'), team: n(teamAverage(team, (x) => x.medianResponseMin), ' min') },
    { k: 'First-contact resolution', mine: n(e.fcrPct, '%'), team: n(teamAverage(team, (x) => x.fcrPct), '%') },
    { k: 'Reopened', mine: String(e.reopened), team: n(teamAverage(team, (x) => x.reopened)) },
    { k: 'Customer satisfaction', mine: n(e.csatPct, '%'), team: n(teamAverage(team, (x) => x.csatPct), '%') },
    { k: 'Average rating · responses', mine: `${n(e.csatAverage)} · ${e.csatResponses}`, team: `${n(teamAverage(team, (x) => x.csatAverage))} · ${n(teamAverage(team, (x) => x.csatResponses))}` },
    { k: 'Low ratings', mine: String(e.csatUnhappy), team: n(teamAverage(team, (x) => x.csatUnhappy)) },
    { k: 'Emails sent · notes', mine: `${e.emails} · ${e.notes}`, team: `${n(teamAverage(team, (x) => x.emails))} · ${n(teamAverage(team, (x) => x.notes))}` },
    { k: 'Touches per resolved case', mine: n(e.touchesPerResolved), team: n(teamAverage(team, (x) => x.touchesPerResolved)) },
  ]
  return (
    <>
      <WorkspaceBar active="manage" />
      <section className="sheet ws g-paper">
        <PageHead
          above={
            <span className="label muted">
              <Link href={`${MANAGE}/engineers?period=${period}`}>Engineers</Link> · {periodLabel}
            </span>
          }
          title={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 16 }}>
              <Avatar name={e.owner.name} large /> {e.owner.name}
            </span>
          }
          lede={e.owner.kind === 'user' ? `${e.active} active cases, ${e.resolved} resolved in the period.` : `A ${e.owner.kind} account: ${e.active} active cases wait here for an engineer.`}
          actions={<PeriodSeg period={period} href={(p) => `${MANAGE}/engineers/${id}?period=${p}`} />}
        />
        <ManageNav active="engineers" period={period} />

        <div className="two-col" style={{ marginBottom: 'clamp(32px, 4cqw, 48px)' }}>
          <div>
            <h2 className="sub-head">Against the team</h2>
            <div className="table-wrap">
              <table className="dtable">
                <thead>
                  <tr>
                    <th scope="col">Measure</th>
                    <th scope="col">{e.owner.name.split(' ')[0]}</th>
                    <th scope="col">Team average</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr className="row" key={r.k}>
                      <td className="text">{r.k}</td>
                      <td className="num">{r.mine}</td>
                      <td className="num">{r.team}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <div className="chart">
              <div className="chart-head">
                <h3>Active cases by status reason</h3>
                <span className="label muted">now</span>
              </div>
              {mine.length ? <Bars series={breakdown(mine, 'status')} /> : <p className="hint">No active cases.</p>}
            </div>
            <div className="chart" style={{ marginTop: 32 }}>
              <div className="chart-head">
                <h3>Resolved by issue category</h3>
                <span className="label muted">{periodLabel}</span>
              </div>
              {resolved.length ? <Bars series={breakdown(resolved, 'issue', 8)} /> : <p className="hint">Nothing resolved in the period.</p>}
            </div>
          </div>
        </div>

        <h2 className="sub-head">
          Active cases, most urgent first
          <span className="label">{mine.length}</span>
        </h2>
        <div className="table-wrap">
          <table className="dtable" style={{ minWidth: 1100 }}>
            <thead>
              <tr>
                <th scope="col">Case</th>
                <th scope="col">Title</th>
                <th scope="col">Status</th>
                <th scope="col">Priority</th>
                <th scope="col">Vertical</th>
                <th scope="col">Target</th>
                <th scope="col">Resolution clock</th>
                <th scope="col">First response</th>
                <th scope="col">CRM KPI</th>
                <th scope="col">Last change</th>
              </tr>
            </thead>
            <tbody>
              {mine.length === 0 && (
                <tr className="empty">
                  <td colSpan={10}>No active cases.</td>
                </tr>
              )}
              {mine.map((c) => (
                <tr className="row" key={c.id}>
                  <td>
                    <Tid ticket={c.ticket} href={`${WS}/cases/${c.id}`} />
                  </td>
                  <td className="title">{c.title}</td>
                  <td className="status">
                    <StatusTag row={{ statuscode: c.statuscode, statecode: c.statecode, prioritycode: c.priority, 'statuscode@OData.Community.Display.V1.FormattedValue': c.status }} />
                  </td>
                  <td className="text">{optLabel(PRIORITY, c.priority) || '—'}</td>
                  <td className="text">{optLabel(VERTICAL, c.vertical) || '—'}</td>
                  <td className="num">{fmtMinutes(c.target.resolveMinutes)}</td>
                  <td>
                    <SlaMeter r={c.resolve} compact />
                  </td>
                  <td>{c.firstResponseAt ? <SlaTag state={c.response.state} /> : <SlaMeter r={c.response} compact />}</td>
                  <td>{c.crm ? <SlaTag state={c.crm.state} /> : <span className="muted">—</span>}</td>
                  <td className="num">
                    <When date={c.modifiedon.toISOString()} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {settings.csat.enabled && (
          <>
            <h2 className="sub-head" style={{ marginTop: 'clamp(32px, 4cqw, 48px)' }}>
              Ratings in the period, lowest first
              <span className="label">{ratings.length}</span>
            </h2>
            {ratings.length === 0 ? (
              <p className="hint">No customer rated this engineer&apos;s cases in the period.</p>
            ) : (
              <div className="mini-rows ratings">
                {ratings.slice(0, 25).map((r) => (
                  <Link className="mini-row" href={`${WS}/cases/${r.caseId}`} key={r.id}>
                    <span className="t">
                      <ScoreTag score={r.score} settings={settings.csat} />
                      <Tid ticket={r.ticket} />
                      <span style={{ fontWeight: 400 }}>{r.title}</span>
                    </span>
                    <span className="s">
                      {r.customerName || 'Customer'}
                      {r.comment ? ` · “${r.comment}”` : ''}
                    </span>
                    <span className="r">{dmyHm(r.respondedAt)}</span>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        <h2 className="sub-head" style={{ marginTop: 'clamp(32px, 4cqw, 48px)' }}>
          Resolved late in the period
          <span className="label">
            {late.length} of {resolved.length}
          </span>
        </h2>
        {late.length === 0 ? (
          <p className="hint">Every case this engineer resolved in the period stayed within its target.</p>
        ) : (
          <div className="table-wrap">
            <table className="dtable" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th scope="col">Case</th>
                  <th scope="col">Title</th>
                  <th scope="col">Priority</th>
                  <th scope="col">Target</th>
                  <th scope="col">Took</th>
                  <th scope="col">Over by</th>
                  <th scope="col">Resolved</th>
                </tr>
              </thead>
              <tbody>
                {late.slice(0, 25).map((c) => (
                  <tr className="row" key={c.id}>
                    <td>
                      <Tid ticket={c.ticket} href={`${WS}/cases/${c.id}`} />
                    </td>
                    <td className="title">{c.title}</td>
                    <td className="text">{optLabel(PRIORITY, c.priority) || '—'}</td>
                    <td className="num">{fmtMinutes(c.target.resolveMinutes)}</td>
                    <td className="num">{fmtMinutes(c.resolve.elapsed)}</td>
                    <td className="num is-missed">{fmtMinutes(-c.resolve.left)}</td>
                    <td className="num">{c.resolvedAt ? <When date={c.resolvedAt.toISOString()} exact /> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

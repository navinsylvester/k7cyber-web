import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { EngineerCard, MANAGE, ManageNav, PeriodSeg } from '@/components/support/Manage'
import { PageHead, qs, SortHead } from '@/components/support/Parts'
import { WorkspaceBar } from '@/components/support/WorkspaceBar'
import { getSettings } from '@/lib/support/kpi-config'
import { asPeriod, PERIODS } from '@/lib/support/kpi-model'
import { engineerStats, loadDesk, type EngineerStats } from '@/lib/support/metrics'
import { requireManager } from '@/lib/support/session'

export const metadata: Metadata = { title: 'Engineers' }

type SP = { period?: string; view?: string; sort?: string; dir?: string; all?: string }

const PATH = `${MANAGE}/engineers`

const SORTS: Record<string, (e: EngineerStats) => number | string> = {
  name: (e) => e.owner.name,
  active: (e) => e.active,
  breached: (e) => e.breached,
  atRisk: (e) => e.atRisk,
  resolved: (e) => e.resolved,
  resolvePct: (e) => e.resolvePct ?? -1,
  responsePct: (e) => e.responsePct ?? -1,
  medianResolve: (e) => e.medianResolveHours ?? Number.MAX_SAFE_INTEGER,
  medianResponse: (e) => e.medianResponseMin ?? Number.MAX_SAFE_INTEGER,
  fcrPct: (e) => e.fcrPct ?? -1,
  perDay: (e) => e.perDay ?? -1,
  touches: (e) => e.touchesPerResolved ?? -1,
  csatPct: (e) => e.csatPct ?? -1,
  csatAverage: (e) => e.csatAverage ?? -1,
  csatUnhappy: (e) => e.csatUnhappy,
  score: (e) => e.score,
}

const n = (v: number | null, suffix = '') => (v === null ? '—' : `${v.toLocaleString('en-IN', { maximumFractionDigits: 1 })}${suffix}`)

/* Engineer efficiency: a card per engineer, or the ledger when the manager wants to sort on one measure. */
export default async function EngineersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const me = await requireManager()
  const settings = await getSettings()
  const period = asPeriod(sp.period, settings.defaultPeriod)
  const view = sp.view === 'table' ? 'table' : 'cards'
  const sort = sp.sort && SORTS[sp.sort] ? sp.sort : 'score'
  const dir: 'asc' | 'desc' = sp.dir === 'asc' ? 'asc' : sp.dir === 'desc' ? 'desc' : sort === 'name' ? 'asc' : 'desc'
  const includeShared = sp.all === '1'
  const desk = await loadDesk(me.auth, settings, period)
  const stats = engineerStats(desk, { includeShared }).filter((e) => includeShared || e.owner.kind === 'user')
  const key = SORTS[sort]!
  stats.sort((a, b) => {
    const x = key(a)
    const y = key(b)
    const c = typeof x === 'string' && typeof y === 'string' ? x.localeCompare(y) : Number(x) - Number(y)
    return dir === 'asc' ? c : -c
  })
  const base = { period, view, sort, dir, all: includeShared ? '1' : undefined }
  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? period
  const team = stats.filter((e) => e.owner.kind === 'user')
  const totals = { active: team.reduce((s, e) => s + e.active, 0), resolved: team.reduce((s, e) => s + e.resolved, 0), breached: team.reduce((s, e) => s + e.breached, 0) }
  return (
    <>
      <WorkspaceBar active="manage" />
      <section className="sheet ws g-paper">
        <PageHead
          above={<span className="label muted">Manager view · {periodLabel}</span>}
          title="Engineers"
          lede={
            <>
              {team.length} engineers hold {totals.active.toLocaleString('en-IN')} active cases and resolved {totals.resolved.toLocaleString('en-IN')} in the period; {totals.breached} active cases are past target.
            </>
          }
          actions={<PeriodSeg period={period} href={(p) => PATH + qs(base, { period: p })} />}
        />
        <ManageNav active="engineers" period={period} />
        <div className="views">
          <div className="seg seg-l" role="group" aria-label="Layout">
            <Link href={PATH + qs(base, { view: 'cards' })} aria-pressed={view === 'cards'}>
              Cards
            </Link>
            <Link href={PATH + qs(base, { view: 'table' })} aria-pressed={view === 'table'}>
              Table
            </Link>
          </div>
          <div className="seg seg-l" role="group" aria-label="Sort cards">
            {(['score', 'active', 'breached', 'resolved', 'resolvePct', 'medianResolve', 'csatPct', 'name'] as const).map((s) => (
              <Link href={PATH + qs(base, { sort: s, dir: undefined })} key={s} aria-pressed={sort === s}>
                {s === 'score' ? 'Composite' : s === 'resolvePct' ? 'Resolution SLA' : s === 'medianResolve' ? 'Median resolve' : s === 'breached' ? 'Past target' : s === 'csatPct' ? 'CSAT' : s.replace(/^\w/, (c) => c.toUpperCase())}
              </Link>
            ))}
          </div>
          <Link className="link-u label" href={PATH + qs(base, { all: includeShared ? undefined : '1' })}>
            {includeShared ? 'Hide teams and shared accounts' : 'Show teams and shared accounts'}
          </Link>
        </div>

        {view === 'cards' ? (
          <div className="eng-grid-wrap">
            {stats.map((e) => (
              <EngineerCard e={e} period={period} key={`${e.owner.kind}:${e.owner.id}`} />
            ))}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="dtable" style={{ minWidth: 1420 }}>
              <caption className="sr-only">Engineers</caption>
              <thead>
                <tr>
                  <SortHead col="name" label="Engineer" current={sort} dir={dir} base={base} path={PATH} />
                  <SortHead col="active" label="Active" current={sort} dir={dir} base={base} path={PATH} />
                  <SortHead col="atRisk" label="At risk" current={sort} dir={dir} base={base} path={PATH} />
                  <SortHead col="breached" label="Past target" current={sort} dir={dir} base={base} path={PATH} />
                  <SortHead col="resolved" label="Resolved" current={sort} dir={dir} base={base} path={PATH} />
                  <SortHead col="perDay" label="Per day" current={sort} dir={dir} base={base} path={PATH} />
                  <SortHead col="resolvePct" label="Resolution SLA" current={sort} dir={dir} base={base} path={PATH} />
                  <SortHead col="medianResolve" label="Median resolve" current={sort} dir={dir} base={base} path={PATH} />
                  <SortHead col="responsePct" label="Response SLA" current={sort} dir={dir} base={base} path={PATH} />
                  <SortHead col="medianResponse" label="Median response" current={sort} dir={dir} base={base} path={PATH} />
                  <SortHead col="fcrPct" label="FCR" current={sort} dir={dir} base={base} path={PATH} />
                  <SortHead col="touches" label="Touches / case" current={sort} dir={dir} base={base} path={PATH} />
                  <SortHead col="csatPct" label="CSAT" current={sort} dir={dir} base={base} path={PATH} />
                  <SortHead col="csatAverage" label="Avg rating" current={sort} dir={dir} base={base} path={PATH} />
                  <SortHead col="csatUnhappy" label="Low ratings" current={sort} dir={dir} base={base} path={PATH} />
                  <SortHead col="score" label="Composite" current={sort} dir={dir} base={base} path={PATH} />
                </tr>
              </thead>
              <tbody>
                {stats.map((e) => (
                  <tr className="row" key={`${e.owner.kind}:${e.owner.id}`}>
                    <td className="title">
                      <Link href={`${PATH}/${e.owner.id}?period=${period}`}>{e.owner.name}</Link>
                      {e.owner.kind !== 'user' && <span className="muted"> · {e.owner.kind}</span>}
                    </td>
                    <td className="num">{e.active}</td>
                    <td className="num">{e.atRisk}</td>
                    <td className={`num${e.breached ? ' is-missed' : ''}`}>{e.breached}</td>
                    <td className="num">{e.resolved}</td>
                    <td className="num">{n(e.perDay)}</td>
                    <td className="num">{n(e.resolvePct, '%')}</td>
                    <td className="num">{n(e.medianResolveHours, ' h')}</td>
                    <td className="num">{n(e.responsePct, '%')}</td>
                    <td className="num">{n(e.medianResponseMin, ' m')}</td>
                    <td className="num">{n(e.fcrPct, '%')}</td>
                    <td className="num">{n(e.touchesPerResolved)}</td>
                    <td className="num" title={e.csatResponses ? `${e.csatResponses} ratings` : 'No ratings in the period'}>
                      {n(e.csatPct, '%')}
                    </td>
                    <td className="num">{n(e.csatAverage)}</td>
                    <td className={`num${e.csatUnhappy ? ' is-missed' : ''}`}>{e.csatUnhappy}</td>
                    <td className="num">{e.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="caveats">
          Composite: 40% resolution SLA, 20% response SLA, 20% FCR, 20% a load penalty (25 points per case past target, 10 per case at risk). When an engineer has survey responses in the period, CSAT takes 20% and the first three shrink to 30/15/15. It orders the cards; it is not a grade. Touches are outgoing emails plus desk notes written in the period, divided by cases resolved. CSAT credits the engineer who held the case when the customer rated it.
        </p>
      </section>
    </>
  )
}

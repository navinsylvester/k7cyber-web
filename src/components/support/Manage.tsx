import Link from 'next/link'
import React from 'react'

import { fmtKpi, type EngineerStats, type KpiValue, type SlaNow } from '@/lib/support/metrics'
import { PERIODS, type Period } from '@/lib/support/kpi-model'
import { fmtLeft, fmtMinutes, type SlaReading, type SlaState } from '@/lib/support/sla'

import { Avatar } from './Parts'
import { WS } from './WorkspaceBar'

/* Section 09 · Manager parts (S12–S16): KPI cards with a target line, the SLA meter, engineer cards on a hairline grid,
   the period switch and the two-series trend. Ink and weight carry the state; signal marks only a breach. */

export const MANAGE = `${WS}/manage`

/** S15 Period switch: a segmented control that keeps the other query parameters. */
export const PeriodSeg: React.FC<{ period: Period; href: (p: Period) => string }> = ({ period, href }) => (
  <div className="seg seg-l" role="group" aria-label="Period">
    {PERIODS.map((p) => (
      <Link href={href(p.key)} key={p.key} aria-pressed={p.key === period}>
        {p.label}
      </Link>
    ))}
  </div>
)

/** S12 KPI card: the number, its label, the target line and a thin meter of progress to target. Missed targets go signal. */
export const KpiCard: React.FC<{ k: KpiValue; href?: string }> = ({ k, href }) => {
  const { def, value, target, met, delta, n } = k
  const ratio = value === null || target === null || target === 0 ? null : def.direction === 'up' ? Math.min(1, value / target) : Math.min(1, target / Math.max(value, 0.0001))
  const state = met === null ? 'none' : met ? 'met' : 'missed'
  const inner = (
    <>
      <span className="kpic-top">
        <span className="label">{def.short}</span>
        {state !== 'none' && <span className={`label kpic-state${state === 'missed' ? ' is-missed' : ''}`}>{state === 'met' ? 'On target' : 'Below target'}</span>}
      </span>
      <span className="n">{fmtKpi(def, value)}</span>
      <span className="kpic-meter" aria-hidden="true">
        <i style={{ width: `${Math.round((ratio ?? 0) * 100)}%` }} className={state === 'missed' ? 'is-missed' : undefined} />
      </span>
      <span className="kpic-foot label">
        <span>{target === null ? 'No target' : `Target ${def.direction === 'up' ? '≥' : '≤'} ${fmtKpi(def, target)}`}</span>
        <span>{delta === null ? `n = ${n.toLocaleString('en-IN')}` : `${delta > 0 ? '+' : ''}${delta.toLocaleString('en-IN', { maximumFractionDigits: 1 })} vs previous`}</span>
      </span>
    </>
  )
  return href ? (
    <Link className={`kpic${state === 'missed' ? ' is-missed' : ''}`} href={href} title={def.what}>
      {inner}
    </Link>
  ) : (
    <div className={`kpic${state === 'missed' ? ' is-missed' : ''}`} title={def.what}>
      {inner}
    </div>
  )
}

/** S13 SLA meter: elapsed share of the target as a 6px bar with the time left in mono. Breached fills signal; at risk is hatched. */
export const SlaMeter: React.FC<{ r: SlaReading; label?: string; compact?: boolean }> = ({ r, label, compact }) => {
  if (r.state === 'none') return <span className="label muted">{label ? `${label}: ` : ''}—</span>
  const w = Math.min(100, Math.round(r.ratio * 100))
  return (
    <span className={`slam is-${r.state}${compact ? ' is-compact' : ''}`} title={`${label ? `${label}: ` : ''}${fmtMinutes(r.elapsed)} of ${fmtMinutes(r.target)}`}>
      {label && <span className="label">{label}</span>}
      <span className="slam-bar" aria-hidden="true">
        <i style={{ width: `${w}%` }} />
      </span>
      <span className="slam-left">{fmtLeft(r)}</span>
    </span>
  )
}

export const STATE_WORD: Record<SlaState, string> = { ok: 'On track', 'at-risk': 'At risk', breached: 'Past target', met: 'Met', paused: 'Paused', none: '—' }

/** S14 State tag: the SLA state as a word; signal only for a breach, dashed for paused. */
export const SlaTag: React.FC<{ state: SlaState }> = ({ state }) => (
  <span className={`tag${state === 'breached' ? ' tag-signal' : state === 'at-risk' ? ' tag-solid' : state === 'paused' ? ' tag-dashed' : state === 'met' ? ' tag-closed' : ''}`}>{STATE_WORD[state]}</span>
)

/** The strip of live SLA counts: on track, at risk, past target, paused, unanswered. */
export const SlaStrip: React.FC<{ n: SlaNow; href: string }> = ({ n, href }) => (
  <div className="slastrip">
    <Link href={`${href}?state=ok`}>
      <span className="n">{n.ok}</span>
      <span className="label">On track</span>
    </Link>
    <Link href={`${href}?state=at-risk`}>
      <span className="n">{n.atRisk}</span>
      <span className="label">At risk</span>
    </Link>
    <Link href={`${href}?state=breached`} className={n.breached ? 'is-signal' : undefined}>
      <span className="n">{n.breached}</span>
      <span className="label">Past target</span>
    </Link>
    <Link href={`${href}?state=paused`}>
      <span className="n">{n.paused}</span>
      <span className="label">Paused · customer</span>
    </Link>
    <Link href={`${href}?state=response`} className={n.responseBreached ? 'is-signal' : undefined}>
      <span className="n">{n.responsePending}</span>
      <span className="label">Unanswered{n.responseBreached ? ` · ${n.responseBreached} late` : ''}</span>
    </Link>
  </div>
)

const num = (v: number | null, suffix = ''): string => (v === null ? '—' : `${v.toLocaleString('en-IN', { maximumFractionDigits: 1 })}${suffix}`)

/** S16 Engineer card: load now, SLA this period, FCR and the medians. Hairline grid, inversion on hover, the row link covers the card. */
export const EngineerCard: React.FC<{ e: EngineerStats; period: Period }> = ({ e, period }) => (
  <article className={`eng${e.breached ? ' has-breach' : ''}`}>
    <header className="eng-head">
      <Avatar name={e.owner.name} />
      <span className="eng-name">
        <Link href={`${MANAGE}/engineers/${e.owner.id}?period=${period}`}>{e.owner.name}</Link>
        <span className="label muted">{e.owner.kind === 'user' ? `${e.active} active · ${e.resolved} resolved` : `${e.owner.kind} · ${e.active} active`}</span>
      </span>
    </header>
    <dl className="eng-grid">
      <div>
        <dt className="label">Resolve SLA</dt>
        <dd className="n">{num(e.resolvePct, '%')}</dd>
      </div>
      <div>
        <dt className="label">Respond SLA</dt>
        <dd className="n">{num(e.responsePct, '%')}</dd>
      </div>
      <div>
        <dt className="label">FCR</dt>
        <dd className="n">{num(e.fcrPct, '%')}</dd>
      </div>
      <div>
        <dt className="label">Med. resolve</dt>
        <dd className="n">{num(e.medianResolveHours, ' h')}</dd>
      </div>
      <div>
        <dt className="label">Med. respond</dt>
        <dd className="n">{num(e.medianResponseMin, ' min')}</dd>
      </div>
      <div>
        <dt className="label">Per day</dt>
        <dd className="n">{num(e.perDay)}</dd>
      </div>
    </dl>
    <footer className="eng-foot label">
      <span className={e.breached ? 'is-missed' : undefined}>{e.breached} past target</span>
      <span>{e.atRisk} at risk</span>
      <span>{e.waiting} waiting</span>
      <span>{e.critical} high/critical</span>
      {e.oldestHours !== null && <span>oldest {num(e.oldestHours, ' h')}</span>}
    </footer>
  </article>
)

/** Two series over time as inline SVG: solid for the first, dashed for the second, a legend, direct label on the last point. */
export const Trend2: React.FC<{ days: { day: string; a: number; b: number }[]; aLabel: string; bLabel: string; height?: number }> = ({ days, aLabel, bLabel, height = 160 }) => {
  if (days.length < 2) return <p className="hint">Not enough days.</p>
  const w = 640
  const h = height
  const padL = 8
  const padB = 22
  const padT = 14
  const max = Math.max(1, ...days.map((d) => Math.max(d.a, d.b)))
  const x = (i: number) => padL + (i / (days.length - 1)) * (w - padL * 2)
  const y = (v: number) => padT + (1 - v / max) * (h - padB - padT)
  const path = (k: 'a' | 'b') => days.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(d[k]).toFixed(1)}`).join(' ')
  const step = Math.max(1, Math.ceil(days.length / 8))
  const last = days[days.length - 1]!
  return (
    <div>
      <svg className="trend trend2" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${aLabel} and ${bLabel} per day`}>
        <path d={path('a')} />
        <path d={path('b')} className="b" />
        {days.map((d, i) => (i === days.length - 1 || (i % step === 0 && days.length - 1 - i >= step / 2)) && (
          <text key={d.day} x={x(i)} y={h - 4} textAnchor={i === days.length - 1 ? 'end' : i === 0 ? 'start' : 'middle'}>
            {d.day}
          </text>
        ))}
        <text x={x(days.length - 1)} y={y(last.a) - 6} textAnchor="end">
          {last.a}
        </text>
      </svg>
      <div className="legend label">
        <span>
          <i className="sw" /> {aLabel}
        </span>
        <span>
          <i className="sw is-b" /> {bLabel}
        </span>
      </div>
    </div>
  )
}

/** The manager's sub-navigation: overview, engineers, SLA report, CSAT, unhappy customers, at-risk board, KPI settings. */
export const ManageNav: React.FC<{ active: 'overview' | 'engineers' | 'sla' | 'csat' | 'unhappy' | 'at-risk' | 'kpis'; period: Period }> = ({ active, period }) => {
  const q = `?period=${period}`
  const items: { key: typeof active; label: string; href: string }[] = [
    { key: 'overview', label: 'Overview', href: `${MANAGE}${q}` },
    { key: 'engineers', label: 'Engineers', href: `${MANAGE}/engineers${q}` },
    { key: 'sla', label: 'SLA report', href: `${MANAGE}/sla${q}` },
    { key: 'csat', label: 'CSAT', href: `${MANAGE}/csat${q}` },
    { key: 'unhappy', label: 'Unhappy customers', href: `${MANAGE}/unhappy${q}` },
    { key: 'at-risk', label: 'At risk', href: `${MANAGE}/at-risk` },
    { key: 'kpis', label: 'KPI settings', href: `${MANAGE}/kpis` },
  ]
  return (
    <nav className="seg seg-l manage-nav" aria-label="Manager view">
      {items.map((i) => (
        <Link href={i.href} key={i.key} aria-pressed={i.key === active}>
          {i.label}
        </Link>
      ))}
    </nav>
  )
}

import React from 'react'

import type { ChartData, ChartSeries } from '@/lib/support/dashboards'

/* Dashboards on the ledger grid: horizontal bars for categories, columns for short series, an inline SVG line for trends.
   Ink only, with signal for Critical. No chart library (08-implementation-plan.md §4). */

const fmt = (n: number) => n.toLocaleString('en-IN')

export const Bars: React.FC<{ series: ChartSeries[] }> = ({ series }) => {
  const max = Math.max(1, ...series.map((s) => s.value))
  return (
    <div className="bars" role="list">
      {series.map((s, i) => (
        <React.Fragment key={`${s.label}-${i}`}>
          <span className="l" title={s.label} role="listitem">
            {s.label}
          </span>
          <span>
            <span className={`b${s.critical ? ' is-critical' : ''}`} style={{ display: 'block', width: `${Math.max(1, (s.value / max) * 100)}%` }} aria-hidden="true" />
          </span>
          <span className="v">{fmt(s.value)}</span>
        </React.Fragment>
      ))}
    </div>
  )
}

export const Cols: React.FC<{ series: ChartSeries[] }> = ({ series }) => {
  const max = Math.max(1, ...series.map((s) => s.value))
  return (
    <div className="cols" style={{ '--n': series.length } as React.CSSProperties} role="list">
      {series.map((s, i) => (
        <div key={`${s.label}-${i}`} role="listitem" title={`${s.label}: ${fmt(s.value)}`}>
          <span className="v">{s.value ? fmt(s.value) : ''}</span>
          <span className={`b${s.critical ? ' is-critical' : ''}`} style={{ '--h': (s.value / max) * 100 } as React.CSSProperties} aria-hidden="true" />
          <span className="l">{s.label}</span>
        </div>
      ))}
    </div>
  )
}

export const Trend: React.FC<{ series: ChartSeries[]; height?: number }> = ({ series, height = 140 }) => {
  if (series.length < 2) return <Cols series={series} />
  const w = 600
  const h = height
  const padL = 8
  const padB = 20
  const padT = 10
  const max = Math.max(1, ...series.map((s) => s.value))
  const x = (i: number) => padL + (i / (series.length - 1)) * (w - padL * 2)
  const y = (v: number) => padT + (1 - v / max) * (h - padB - padT)
  const d = series.map((s, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(s.value).toFixed(1)}`).join(' ')
  const last = series[series.length - 1]!
  const step = Math.max(1, Math.ceil(series.length / 7))
  return (
    <svg className="trend" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Trend, latest ${fmt(last.value)}`}>
      <path d={d} />
      {series.map((s, i) => (i % step === 0 || i === series.length - 1) && (
        <text key={i} x={x(i)} y={h - 4} textAnchor={i === series.length - 1 ? 'end' : i === 0 ? 'start' : 'middle'}>
          {s.label}
        </text>
      ))}
      <rect className="pt" x={x(series.length - 1) - 3} y={y(last.value) - 3} width="6" height="6" />
      <text x={x(series.length - 1)} y={y(last.value) - 8} textAnchor="end">
        {fmt(last.value)}
      </text>
    </svg>
  )
}

export const ChartCard: React.FC<{ chart: ChartData }> = ({ chart }) => (
  <section className="chart" aria-labelledby={`c-${chart.id}`}>
    <div className="chart-head">
      <h3 id={`c-${chart.id}`}>{chart.name}</h3>
      <span className="label muted">{chart.viewName || chart.entity}</span>
    </div>
    {chart.error ? (
      <p className="hint">Not available: {chart.error}</p>
    ) : chart.series.length === 0 ? (
      <p className="hint">No rows.</p>
    ) : chart.type === 'line' || chart.type === 'area' ? (
      <Trend series={chart.series} />
    ) : chart.type === 'column' && chart.series.length <= 12 ? (
      <Cols series={chart.series} />
    ) : (
      <Bars series={chart.series} />
    )}
    {!chart.error && chart.series.length > 0 && (
      <div className="chart-foot label">
        <span>Total {fmt(chart.total)}</span>
        <span>{chart.series.length} groups</span>
      </div>
    )}
  </section>
)

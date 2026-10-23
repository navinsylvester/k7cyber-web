import Link from 'next/link'
import React from 'react'

import { dealOutcome, formatInrPlain, orderValue, OUTCOME_LABEL, shortInr, stageText, type Outcome, type Series, type Summary } from '@/lib/partner/dashboard-model'
import { formatInr, type Deal } from '@/lib/partner/deals-model'
import { dmy, dmyHm, relative } from '@/lib/support/format'

import { Did } from './Deals'

/* Section 10 · Partners, P17–P19 (M5): the dashboard's cards, the synced line, the outcome tag, the money charts on section 09's
   S9 grid, the CRM facts on a deal sheet and the dashboard ledger (01-requirements.md §8). Everything here reads the snapshot the
   sync wrote; nothing calls the CRM. */

/* ---------- P18 The outcome tag ---------- */

const OUTCOME_CLASS: Record<Outcome, string> = { awaiting: 'tag tag-state', notInCrm: 'tag tag-dashed', open: 'tag tag-state', onHold: 'tag tag-dashed', won: 'tag tag-solid', lost: 'tag tag-closed', closed: 'tag tag-closed' }

export const OutcomeTag: React.FC<{ deal: Pick<Deal, 'status' | 'crm'> }> = ({ deal }) => {
  const o = dealOutcome(deal)
  return <span className={OUTCOME_CLASS[o]}>{OUTCOME_LABEL[o]}</span>
}

/* ---------- P17 The synced line and the cards ---------- */

export const Synced: React.FC<{ at: string | null; minutes: number; mirrorOn: boolean; action?: React.ReactNode }> = ({ at, minutes, mirrorOn, action }) => (
  <p className="synced">
    <span className={`pixel${at ? '' : ' is-off'}`} aria-hidden="true" />
    <span>
      {at ? (
        <>
          Last updated from K7’s CRM <time dateTime={at} title={dmyHm(at)}>{relative(at)}</time> · read back every {minutes} minutes
        </>
      ) : mirrorOn ? (
        'Not yet read back from K7’s CRM. Stages and values appear after the first sync.'
      ) : (
        'K7’s CRM is not connected to the portal yet; stages and values appear once it is.'
      )}
    </span>
    {action}
  </p>
)

export const Cards: React.FC<{ summary: Summary; href?: (view: 'all' | 'open' | 'won' | 'lost') => string }> = ({ summary: sm, href }) => {
  const card = (label: string, n: React.ReactNode, o: { money?: boolean; hot?: boolean; to?: 'all' | 'open' | 'won' | 'lost' } = {}) => {
    const inner = (
      <>
        <span className={`n${o.money ? ' is-money' : ''}`}>{n}</span>
        <span className="label">{label}</span>
      </>
    )
    const cls = `kpi${o.hot ? ' is-signal' : ''}`
    return href && o.to ? (
      <Link className={cls} href={href(o.to)} key={label}>
        {inner}
      </Link>
    ) : (
      <div className={cls} key={label}>
        {inner}
      </div>
    )
  }
  return (
    <div className="kpis dash-cards">
      {card('Deals', sm.total, { to: 'all' })}
      {card('Open', sm.open, { to: 'open' })}
      {card('Won', sm.won, { to: 'won', hot: sm.won > 0 })}
      {card('Lost', sm.lost, { to: 'lost' })}
      {card('Pipeline value', <span title={formatInrPlain(sm.pipelineValue)}>{shortInr(sm.pipelineValue)}</span>, { money: true })}
      {card('Won value', <span title={formatInrPlain(sm.wonValue)}>{shortInr(sm.wonValue)}</span>, { money: true })}
      {card('Win rate', sm.winRate === null ? '—' : `${sm.winRate}%`, {})}
    </div>
  )
}

/* ---------- P19 The money charts (section 09 S9: bars and cols, the values in ₹) ---------- */

export const MoneyBars: React.FC<{ series: Series[]; money?: boolean }> = ({ series, money = true }) => {
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
          <span className="v" title={money ? formatInrPlain(s.value) : undefined}>
            {money ? shortInr(s.value) : s.value.toLocaleString('en-IN')}
          </span>
        </React.Fragment>
      ))}
    </div>
  )
}

export const MoneyCols: React.FC<{ series: Series[] }> = ({ series }) => {
  const max = Math.max(1, ...series.map((s) => s.value))
  // Past eight columns the labels would collide: every other one is shown, the last always; the title carries them all.
  const step = series.length > 8 ? 2 : 1
  return (
    <div className="cols" style={{ '--n': series.length } as React.CSSProperties} role="list">
      {series.map((s, i) => (
        <div key={`${s.label}-${i}`} role="listitem" title={`${s.label}: ${formatInrPlain(s.value)}`}>
          <span className="v">{s.value ? shortInr(s.value) : ''}</span>
          <span className={`b${s.critical ? ' is-critical' : ''}`} style={{ '--h': (s.value / max) * 100 } as React.CSSProperties} aria-hidden="true" />
          <span className={`l${i % step === 0 || i === series.length - 1 ? '' : ' is-quiet'}`}>{s.label}</span>
        </div>
      ))}
    </div>
  )
}

export const Chart: React.FC<{ id: string; title: string; note?: string; foot?: React.ReactNode; empty: string; count: number; children: React.ReactNode }> = ({ id, title, note, foot, empty, count, children }) => (
  <section className="chart" aria-labelledby={`c-${id}`}>
    <div className="chart-head">
      <h3 id={`c-${id}`}>{title}</h3>
      {note && <span className="label muted">{note}</span>}
    </div>
    {count === 0 ? <p className="hint">{empty}</p> : children}
    {count > 0 && foot && <div className="chart-foot label">{foot}</div>}
  </section>
)

/* ---------- The CRM facts on a deal sheet (both sides) ---------- */

export const CrmFacts: React.FC<{ deal: Deal }> = ({ deal }) => {
  const sn = deal.crm.snapshot
  if (!sn.syncedAt) return null
  return (
    <dl className="meta-rows label crm-facts">
      <dt>In K7’s CRM</dt>
      <dd>
        <OutcomeTag deal={deal} />
      </dd>
      <dt>Stage</dt>
      <dd className="sans">{sn.stageLabel || stageText(deal)}{sn.statusLabel && sn.statuscode !== null && sn.statecode !== 0 ? ` · ${sn.statusLabel}` : sn.statuscode === 2 ? ' · on hold' : ''}</dd>
      <dt>Estimated value</dt>
      <dd>{formatInr(sn.estimatedValue)}</dd>
      {sn.statecode === 1 && (
        <>
          <dt>Order value</dt>
          <dd>{formatInr(orderValue(deal))}</dd>
        </>
      )}
      <dt>Expected closure</dt>
      <dd>{sn.estimatedCloseDate ? dmy(sn.estimatedCloseDate) : '—'}</dd>
      {sn.actualCloseDate && (
        <>
          <dt>Closed on</dt>
          <dd>{dmy(sn.actualCloseDate)}</dd>
        </>
      )}
      <dt>Read back</dt>
      <dd title={sn.syncedAt}>{relative(sn.syncedAt)}</dd>
      {sn.error && (
        <>
          <dt>Read-back</dt>
          <dd className="sans is-ending">{sn.error}</dd>
        </>
      )}
    </dl>
  )
}

/* ---------- The dashboard ledger (FR-DASH-02) ---------- */

export const DashboardLedger: React.FC<{ rows: Deal[]; href: (dealId: string) => string; label: string }> = ({ rows, href, label }) => (
  <div className="filed ledger">
    <span className="ftab label">{label}</span>
    <div className="table-wrap">
      <table className="dtable dash-table">
        <thead>
          <tr>
            <th scope="col">Deal</th>
            <th scope="col">Customer</th>
            <th scope="col">Product</th>
            <th scope="col">Registered</th>
            <th scope="col" className="num">
              Expected value
            </th>
            <th scope="col">CRM stage</th>
            <th scope="col">Status</th>
            <th scope="col" className="num">
              Order value
            </th>
            <th scope="col">Expected closure</th>
            <th scope="col">Last updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => {
            const sn = d.crm.snapshot
            const closure = sn.estimatedCloseDate ?? (d.closeDate ? d.closeDate.slice(0, 10) : null)
            const value = sn.estimatedValue ?? d.expectedValue
            const won = orderValue(d)
            return (
              <tr className="row" key={d.id}>
                <td className="id">
                  <Did id={d.dealId} href={href(d.dealId)} />
                  {d.crm.opportunityNo && <div className="muted">{d.crm.opportunityNo}</div>}
                </td>
                <td className="title">
                  <Link href={href(d.dealId)}>{d.customer.name}</Link>
                  {d.customer.city && <div className="muted">{d.customer.city}</div>}
                </td>
                <td className="text">{d.products.map((l) => l.name).join(', ') || <span className="muted">—</span>}</td>
                <td className="num">{d.submittedAt ? dmy(d.submittedAt) : '—'}</td>
                <td className="num" title={sn.estimatedValue !== null && sn.estimatedValue !== d.expectedValue ? `Registered as ${formatInr(d.expectedValue)}; the CRM’s estimate is shown` : undefined}>
                  {formatInr(value)}
                  {sn.estimatedValue !== null && sn.estimatedValue !== d.expectedValue && <span className="muted"> *</span>}
                </td>
                <td className="text">{stageText(d)}</td>
                <td className="status">
                  <OutcomeTag deal={d} />
                </td>
                <td className="num">{won === null ? <span className="muted">—</span> : formatInr(won)}</td>
                <td className="num">{closure ? dmy(closure) : '—'}</td>
                <td className="num" title={sn.syncedAt ?? undefined}>
                  {sn.syncedAt ? relative(sn.syncedAt) : <span className="muted">—</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  </div>
)

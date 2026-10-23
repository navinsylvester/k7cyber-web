import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { DealStateTag, Did } from '@/components/partner/Deals'
import { Empty, Field, Flash, Options } from '@/components/partner/Parts'
import { Pager, qs } from '@/components/support/Parts'
import { dealCounts, listDeals, listProducts, PARTNER_DEALS, registerGate, type DealView } from '@/lib/partner/deals'
import { daysLeft, formatInr } from '@/lib/partner/deals-model'
import { requirePartner } from '@/lib/partner/session'
import { dmy, relative } from '@/lib/support/format'

export const metadata: Metadata = { title: 'Deals' }

type SP = { view?: string; q?: string; product?: string; from?: string; to?: string; min?: string; max?: string; page?: string; ok?: string; error?: string }
const VIEWS: { key: DealView; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'live', label: 'Live' },
  { key: 'approved', label: 'Approved' },
  { key: 'submitted', label: 'With K7' },
  { key: 'infoRequested', label: 'Needs your answer' },
  { key: 'closed', label: 'Closed' },
]

const num = (v?: string): number | undefined => (v && /^\d+$/.test(v) ? Number(v) : undefined)

/* The organisation's deals (FR-DEAL-08): counters, the view switch, the filters (product, dates, value), the ledger newest
   first. Every read carries `me.scope`. Technical users see the list; Partner Admins and Sales users register. */
export default async function DealsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const me = await requirePartner(PARTNER_DEALS)
  const view = (VIEWS.some((v) => v.key === sp.view) ? sp.view : 'all') as DealView
  const page = Math.max(1, Number(sp.page) || 1)
  const filter = { view, q: sp.q, productId: sp.product, from: sp.from, to: sp.to, min: num(sp.min), max: num(sp.max), page }
  const [list, counts, products, blocked] = await Promise.all([listDeals(me.scope, filter), dealCounts(me.scope), listProducts(), registerGate(me)])
  const base = { view: view === 'all' ? undefined : view, q: sp.q, product: sp.product, from: sp.from, to: sp.to, min: sp.min, max: sp.max }
  const filtered = Boolean(sp.q || sp.product || sp.from || sp.to || sp.min || sp.max)
  const counter = (label: string, n: number, href: string, hot = false) => (
    <Link className={`kpi${hot && n > 0 ? ' is-signal' : ''}`} href={href} key={label}>
      <span className="n">{n}</span>
      <span className="label">{label}</span>
    </Link>
  )
  return (
    <section className="sheet ws g-paper">
      <div className="ws-head">
        <div className="ws-head-main">
          <span className="label muted">{me.org.tradeName || me.org.name} · deals</span>
          <h1 className="h-util">Your deals.</h1>
          <p className="lede">Every deal your organisation has registered with K7: what is with the approvers, what is protected and until when, what closed. After approval the sales stage comes from K7’s CRM (the dashboard, next).</p>
        </div>
        <div className="ws-actions">
          {blocked ? (
            <span className="hint" title={blocked}>
              Registration is not open to you: {blocked}
            </span>
          ) : (
            <Link className="btn btn-primary" href={`${PARTNER_DEALS}/new`}>
              Register a deal →
            </Link>
          )}
        </div>
      </div>
      {sp.ok && <Flash>{sp.ok}</Flash>}
      {sp.error && <Flash kind="error">{sp.error}</Flash>}

      <div className="kpis" style={{ marginBottom: 'clamp(32px, 4cqw, 48px)' }}>
        {counter('With K7', counts.submitted + counts.extensionRequested, `${PARTNER_DEALS}?view=submitted`)}
        {counter('Need your answer', counts.infoRequested, `${PARTNER_DEALS}?view=infoRequested`, true)}
        {counter('Approved', counts.approved, `${PARTNER_DEALS}?view=approved`)}
        {counter('Ending soon', counts.endingSoon, `${PARTNER_DEALS}?view=approved`, true)}
        {counter('Closed', counts.rejected + counts.expired + counts.withdrawn, `${PARTNER_DEALS}?view=closed`)}
      </div>

      <form className="views deal-filters" action={PARTNER_DEALS} method="get" role="search">
        <div className="seg-choice" role="group" aria-label="View">
          {VIEWS.map((v) => (
            <label key={v.key}>
              <input type="radio" name="view" value={v.key} defaultChecked={view === v.key} />
              {v.label}
            </label>
          ))}
        </div>
        <span className="control" style={{ flex: '1 1 220px', maxWidth: 320 }}>
          <input name="q" type="search" placeholder="Deal ID, customer, city, email" defaultValue={sp.q ?? ''} aria-label="Search deals" />
          <button type="submit" aria-label="Search">
            →
          </button>
        </span>
        <details open={filtered}>
          <summary className="label">Filters</summary>
          <div className="form-grid filters-grid">
            <Field id="product" label="Product" select>
              <select id="product" name="product" defaultValue={sp.product ?? ''}>
                <Options items={products.map((p) => ({ value: p.id, label: `${p.name} · ${p.sku}` }))} empty="Any" />
              </select>
            </Field>
            <Field id="from" label="Registered from">
              <input id="from" name="from" type="date" defaultValue={sp.from ?? ''} />
            </Field>
            <Field id="to" label="Registered to">
              <input id="to" name="to" type="date" defaultValue={sp.to ?? ''} />
            </Field>
            <Field id="min" label="Value from (₹)">
              <input id="min" name="min" type="number" min={0} inputMode="numeric" defaultValue={sp.min ?? ''} />
            </Field>
            <Field id="max" label="Value to (₹)">
              <input id="max" name="max" type="number" min={0} inputMode="numeric" defaultValue={sp.max ?? ''} />
            </Field>
            <div className="form-actions">
              <button className="btn btn-line btn-sm" type="submit">
                Apply
              </button>
              {filtered && (
                <Link className="link-u" href={`${PARTNER_DEALS}${view === 'all' ? '' : `?view=${view}`}`}>
                  Clear
                </Link>
              )}
            </div>
          </div>
        </details>
      </form>

      {list.rows.length === 0 ? (
        <Empty label={VIEWS.find((v) => v.key === view)?.label}>{filtered ? 'Nothing matches these filters.' : view === 'all' ? 'No deal registered yet. Register the first one and K7 will review it.' : 'Nothing in this view.'}</Empty>
      ) : (
        <div className="filed ledger">
          <span className="ftab label">
            {list.total} deal{list.total === 1 ? '' : 's'}
          </span>
          <div className="table-wrap">
            <table className="dtable">
              <thead>
                <tr>
                  <th scope="col">Deal</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Products</th>
                  <th scope="col" className="num">
                    Value
                  </th>
                  <th scope="col">Closure</th>
                  <th scope="col">Status</th>
                  <th scope="col">Protection</th>
                  <th scope="col">Registered</th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((d) => {
                  const left = d.status === 'approved' || d.status === 'extensionRequested' ? daysLeft(d.protectionEnds) : null
                  return (
                    <tr className="row" key={d.id}>
                      <td className="id">
                        <Did id={d.dealId} href={`${PARTNER_DEALS}/${d.dealId}`} />
                      </td>
                      <td className="title">
                        <Link href={`${PARTNER_DEALS}/${d.dealId}`}>{d.customer.name}</Link>
                        <div className="muted">
                          {d.customer.city}
                          {d.reseller.name ? ` · for ${d.reseller.name}` : ''}
                        </div>
                      </td>
                      <td className="text">
                        {d.products.map((l) => `${l.name} × ${l.quantity}`).join(', ') || <span className="muted">—</span>}
                      </td>
                      <td className="num">{formatInr(d.expectedValue)}</td>
                      <td className="num">{d.closeDate ? dmy(d.closeDate) : '—'}</td>
                      <td className="status">
                        <DealStateTag status={d.status} audience="partner" />
                      </td>
                      <td className="text">
                        {left !== null && d.protectionEnds ? (
                          <>
                            to {dmy(d.protectionEnds)}
                            <div className={`muted${left <= 14 ? ' is-ending' : ''}`}>{left > 0 ? `${left} day${left === 1 ? '' : 's'} left` : 'ended'}</div>
                          </>
                        ) : d.status === 'expired' && d.protectionEnds ? (
                          `ended ${dmy(d.protectionEnds)}`
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="num" title={d.submittedAt ?? ''}>
                        {d.submittedAt ? relative(d.submittedAt) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="ledger-foot">
            <span className="label">
              {VIEWS.find((v) => v.key === view)?.label} · page {list.page} of {list.totalPages}
            </span>
            <Pager page={list.page} totalPages={list.totalPages} href={(p) => `${PARTNER_DEALS}${qs(base, { page: p > 1 ? p : undefined })}`} label="Deals pages" />
          </div>
        </div>
      )}
    </section>
  )
}

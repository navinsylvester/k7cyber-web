import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { Cards, Chart, DashboardLedger, MoneyBars, MoneyCols, Synced } from '@/components/partner/Dashboard'
import { Empty } from '@/components/partner/Parts'
import { dealOutcome, formatInrPlain, isOpenOutcome, isPeriodKey, periodBounds, periodLabel, PERIODS, pipelineByStage, shortInr, summarise, valueByMonth, valueByProduct, type PeriodKey } from '@/lib/partner/dashboard-model'
import { listDeals, PARTNER_DASHBOARD, PARTNER_DEALS } from '@/lib/partner/deals'
import { requirePartner } from '@/lib/partner/session'
import { getPartnerSettings } from '@/lib/partner/settings'
import { lastUpdatedFor } from '@/lib/partner/sync'

export const metadata: Metadata = { title: 'Dashboard' }

type SP = { period?: string; view?: string }
type View = 'all' | 'open' | 'won' | 'lost'
const VIEWS: { key: View; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
]

/* The deal status and value dashboard (01-requirements.md §8): the cards, the three charts and the ledger over the organisation's
   deals registered in the period, every CRM fact from the snapshot the sync wrote (never live, FR-DASH-04, 05), the CRM's figure
   winning over the registration where they differ (FR-DASH-11). Every read carries `me.scope` (FR-DASH-03). */
export default async function DashboardPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const me = await requirePartner(PARTNER_DASHBOARD)
  const period: PeriodKey = isPeriodKey(sp.period) ? sp.period : 'fy'
  const view = (VIEWS.some((v) => v.key === sp.view) ? sp.view : 'all') as View
  const bounds = periodBounds(period)
  const [list, settings, updatedAt] = await Promise.all([listDeals(me.scope, { from: bounds.from ?? undefined, to: bounds.to ?? undefined, limit: 500 }), getPartnerSettings(), lastUpdatedFor(me.scope)])
  const deals = list.rows
  const summary = summarise(deals)
  const stages = pipelineByStage(deals)
  const months = valueByMonth(deals, bounds)
  const products = valueByProduct(deals)
  const shown = view === 'all' ? deals : deals.filter((d) => (view === 'open' ? isOpenOutcome(dealOutcome(d)) : dealOutcome(d) === view))
  const q = (p: PeriodKey, v: View) => `${PARTNER_DASHBOARD}?period=${p}${v === 'all' ? '' : `&view=${v}`}`
  const periodNote = bounds.from ? `${bounds.from} to ${bounds.to}` : 'every registration'
  return (
    <section className="sheet ws g-paper">
      <div className="ws-head">
        <div className="ws-head-main">
          <span className="label muted">{me.org.tradeName || me.org.name} · dashboard</span>
          <h1 className="h-util">Deals, as K7’s CRM sees them.</h1>
          <p className="lede">The status and value of every deal you have registered, read back from K7’s CRM on a schedule: where each one stands in the sales process, what was won and for how much. Where the CRM and your registration differ, the CRM’s figure is shown.</p>
        </div>
        <div className="ws-actions">
          <Link className="btn btn-line btn-sm" href={PARTNER_DEALS}>
            Your deals →
          </Link>
        </div>
      </div>

      <Synced at={updatedAt} minutes={settings.crm.syncMinutes} mirrorOn={settings.crm.enabled} />

      <form className="views dash-period" action={PARTNER_DASHBOARD} method="get" aria-label="Period">
        {view !== 'all' && <input type="hidden" name="view" value={view} />}
        <div className="seg-choice" role="group" aria-label="Period, by registration date">
          {PERIODS.map((p) => (
            <label key={p.key}>
              <input type="radio" name="period" value={p.key} defaultChecked={period === p.key} />
              {p.label}
            </label>
          ))}
        </div>
        <button className="btn btn-line btn-sm" type="submit">
          Show
        </button>
        <span className="label muted dash-period-note">Registered {periodNote}</span>
      </form>

      <Cards summary={summary} href={(v) => q(period, v)} />

      {deals.length === 0 ? (
        <Empty label={periodLabel(period)}>{period === 'all' ? 'No deal registered yet. The dashboard fills as you register deals and K7 approves them.' : 'No deal was registered in this period.'}</Empty>
      ) : (
        <>
          <div className="dash-charts">
            <Chart id="stage" title="Pipeline by stage" note="open deals" count={stages.length} empty="No open deal." foot={<><span>{summary.open} open</span><span title={formatInrPlain(summary.pipelineValue)}>{shortInr(summary.pipelineValue)} in the pipeline</span></>}>
              <MoneyBars series={stages} money={false} />
            </Chart>
            <Chart id="month" title="Value by month" note="registered" count={months.length} empty="Nothing registered." foot={<><span>{months.length} month{months.length === 1 ? '' : 's'}</span><span title={formatInrPlain(months.reduce((n, s) => n + s.value, 0))}>{shortInr(months.reduce((n, s) => n + s.value, 0))} registered</span></>}>
              <MoneyCols series={months} />
            </Chart>
            <Chart id="product" title="Value by product" note="a deal’s value split over its lines" count={products.length} empty="No product line." foot={<><span>{products.length} product{products.length === 1 ? '' : 's'}</span><span>{deals.length} deal{deals.length === 1 ? '' : 's'}</span></>}>
              <MoneyBars series={products} />
            </Chart>
          </div>

          <div className="views" style={{ marginBottom: 16 }}>
            <div className="seg-choice" role="group" aria-label="Status">
              {VIEWS.map((v) => (
                <Link key={v.key} className={view === v.key ? 'is-on' : undefined} href={q(period, v.key)} aria-current={view === v.key ? 'page' : undefined}>
                  {v.label}
                </Link>
              ))}
            </div>
          </div>
          {shown.length === 0 ? (
            <Empty label={VIEWS.find((v) => v.key === view)?.label}>Nothing in this view for the period.</Empty>
          ) : (
            <DashboardLedger rows={shown} href={(id) => `${PARTNER_DEALS}/${id}`} label={`${shown.length} deal${shown.length === 1 ? '' : 's'} · ${periodLabel(period).toLowerCase()}`} />
          )}
          <p className="hint" style={{ marginTop: 12 }}>
            * the CRM’s estimate differs from the value you registered; the CRM’s is shown. Order value is the CRM’s actual value once a deal is won.
          </p>
        </>
      )}
    </section>
  )
}

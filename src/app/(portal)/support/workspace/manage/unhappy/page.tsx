import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { AreaLegend, AreaStack, CareTag, CauseTag, FollowUpTag, ReasonSelect, ScoreTag } from '@/components/support/Csat'
import { MANAGE, ManageNav, PeriodSeg } from '@/components/support/Manage'
import { Flash, Options, PageHead, Pager, qs, Tid, When } from '@/components/support/Parts'
import { WS, WorkspaceBar } from '@/components/support/WorkspaceBar'
import { careForCustomers, followUpState, respondedSince } from '@/lib/support/csat'
import { AREA_LABEL, AREA_SHORT, AREAS, areaCounts, causeBuckets, causeLines, causeOf, productLines, REASONS, repeatCustomers, share, unhappyRows } from '@/lib/support/csat-model'
import { dmy, dmyHm } from '@/lib/support/format'
import { getSettings } from '@/lib/support/kpi-config'
import { asPeriod, PERIODS } from '@/lib/support/kpi-model'
import { engineerStats, loadDesk } from '@/lib/support/metrics'
import { productFamily } from '@/lib/support/reference'
import { requireManager } from '@/lib/support/session'

import { classifyAction } from './actions'
import { familyKey, filterUnhappy, type UnhappySP } from './filters'

export const metadata: Metadata = { title: 'Unhappy customers' }

const PATH = `${MANAGE}/unhappy`
const PAGE = 25

const n = (v: number | null, suffix = '') => (v === null ? '—' : `${v.toLocaleString('en-IN', { maximumFractionDigits: 1 })}${suffix}`)
const signed = (v: number) => `${v > 0 ? '+' : ''}${v.toLocaleString('en-IN', { maximumFractionDigits: 1 })}`
const customerHref = (r: { customerKind: 'account' | 'contact' | ''; customerId: string; caseId: string }) => (r.customerKind && r.customerId ? `${WS}/customers/${r.customerKind === 'account' ? 'accounts' : 'contacts'}/${r.customerId}#csat` : `${WS}/cases/${r.caseId}`)

/* Unhappy customers for management (09-portal-guide.md §4e): how many customers rated us low and whether that is getting better,
   whether it is the product, product support or licensing they are unhappy about, which products carry the low scores, who keeps
   rating us low, and the ledger of every low score with the manager's classification. The reasons come from the customer's pick
   on the survey and from the manager who called them back; the desk's call wins. */
export default async function UnhappyPage({ searchParams }: { searchParams: Promise<UnhappySP> }) {
  const sp = await searchParams
  const me = await requireManager()
  const settings = await getSettings()
  const cs = settings.csat
  const period = asPeriod(sp.period, settings.defaultPeriod)
  const [desk, prev] = await Promise.all([loadDesk(me.auth, settings, period), loadDesk(me.auth, settings, period, { previous: true }).catch(() => null)])
  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? period
  const sum = desk.csatSummary
  const low = unhappyRows(desk.csat, cs)
  const prevSum = prev?.csatSummary ?? null
  const lowShare = share(low.length, sum.responses)
  const prevShare = prevSum ? share(prevSum.unhappy, prevSum.responses) : null
  const areas = areaCounts(desk.csat, cs)
  const causes = causeLines(desk.csat, cs, prev?.csat)
  const products = productLines(desk.csat, cs, productFamily)
  const spanDays = Math.ceil((desk.to.getTime() - desk.from.getTime()) / 864e5)
  const bucketDays = spanDays <= 14 ? 1 : 7
  const buckets = causeBuckets(desk.csat, cs, desk.from, desk.to, bucketDays)
  const since = new Date(desk.now.getTime() - cs.careWindowDays * 864e5)
  const repeats = repeatCustomers(await respondedSince(since).catch(() => []), cs)
  const customers = new Set(low.map((r) => r.customerId || r.contactId || r.id)).size
  const rows = filterUnhappy(desk.csat, sp, settings, desk.now).sort((a, b) => (b.respondedAt ?? '').localeCompare(a.respondedAt ?? ''))
  const page = Math.max(1, Number(sp.page) || 1)
  const slice = rows.slice((page - 1) * PAGE, page * PAGE)
  const care = await careForCustomers([...slice.map((r) => r.customerId), ...repeats.map((c) => c.customerId)], settings).catch(() => new Map())
  const owners = engineerStats(desk, { includeShared: true }).map((e) => e.owner)
  const base = { period, area: sp.area, reason: sp.reason, product: sp.product, owner: sp.owner, fu: sp.fu, q: sp.q }
  const ret = PATH + qs(base, { page: page > 1 ? page : undefined })
  const filtered = Boolean(sp.area || sp.reason || sp.product || sp.owner || sp.fu || sp.q)
  const maxProduct = Math.max(1, ...products.map((p) => p.low))
  const maxBucket = Math.max(1, ...buckets.map((b) => b.low))
  const maxRepeat = Math.max(1, ...repeats.map((c) => c.low))
  const bucketLabel = (b: { from: Date; to: Date }) => (bucketDays === 1 ? dmy(b.from.toISOString()) : `${dmy(b.from.toISOString())} – ${dmy(new Date(b.to.getTime() - 1).toISOString())}`)
  const lede = sum.responses
    ? `${low.length === 1 ? '1 customer' : `${customers.toLocaleString('en-IN')} customers`} rated us ${cs.unhappyAtOrBelow} or below in the period: ${lowShare}% of ${sum.responses.toLocaleString('en-IN')} responses${prevShare !== null && lowShare !== null ? ` (${prevShare}% before)` : ''}. ${low.length ? `${areas.product} about the product, ${areas.support} about support, ${areas.commercial} about licensing${areas.other ? `, ${areas.other} other` : ''}${areas.none ? `; ${areas.none} not classified yet` : ''}.` : ''}`
    : 'No ratings in the period yet. Low scores arrive from the survey on resolved cases, the portal and ratings agents record.'
  return (
    <>
      <WorkspaceBar active="manage" />
      <section className="sheet ws g-paper">
        <PageHead
          above={<span className="label muted">Manager view · {periodLabel} · data as of {dmyHm(desk.fetchedAt)}</span>}
          title="Unhappy customers"
          lede={lede}
          actions={
            <>
              <PeriodSeg period={period} href={(p) => PATH + qs(base, { period: p, page: undefined })} />
              <a className="btn btn-line btn-sm" href={`${PATH}/export.csv${qs(base)}`}>
                Export CSV →
              </a>
            </>
          }
        />
        <ManageNav active="unhappy" period={period} />
        {!cs.enabled && <Flash kind="error">CSAT is switched off in KPI settings: no surveys go out and customers cannot rate. The figures below are history.</Flash>}
        {sp.ok && <Flash>{sp.ok === 'classified' ? 'Saved. The low score now counts under that reason.' : 'Cleared. The customer’s own pick, if any, counts again.'}</Flash>}
        {sp.error && <Flash kind="error">{sp.error}</Flash>}

        <div className="kpis" style={{ marginBottom: 'clamp(32px, 4cqw, 48px)' }}>
          <div className={`kpi${low.length ? ' is-signal' : ''}`}>
            <span className="n">{low.length.toLocaleString('en-IN')}</span>
            <span className="label">
              Low scores (≤ {cs.unhappyAtOrBelow}){prevSum ? ` · ${signed(low.length - prevSum.unhappy)} vs previous` : ''}
            </span>
          </div>
          <div className="kpi">
            <span className="n">{lowShare === null ? '—' : `${lowShare}%`}</span>
            <span className="label">Of responses{prevShare !== null && lowShare !== null ? ` · ${signed(Math.round((lowShare - prevShare) * 10) / 10)} vs previous` : ''}</span>
          </div>
          {AREAS.filter((a) => a !== 'other').map((a) => (
            <Link className="kpi" href={PATH + qs(base, { area: a, reason: undefined, page: undefined })} key={a}>
              <span className="n">{areas[a].toLocaleString('en-IN')}</span>
              <span className="label">
                {AREA_LABEL[a]}
                {low.length ? ` · ${share(areas[a], low.length)}%` : ''}
              </span>
            </Link>
          ))}
          <Link className={`kpi${areas.none ? ' is-signal' : ''}`} href={PATH + qs(base, { area: 'none', reason: undefined, page: undefined })}>
            <span className="n">{areas.none.toLocaleString('en-IN')}</span>
            <span className="label">Not classified yet{areas.other ? ` · ${areas.other} other` : ''}</span>
          </Link>
          <Link className="kpi" href="#repeat">
            <span className="n">{repeats.length.toLocaleString('en-IN')}</span>
            <span className="label">Rated low more than once in {cs.careWindowDays} days</span>
          </Link>
          <Link className={`kpi${desk.followUps.length ? ' is-signal' : ''}`} href={`${MANAGE}/csat?period=${period}#follow-ups`}>
            <span className="n">{desk.followUps.length.toLocaleString('en-IN')}</span>
            <span className="label">Awaiting a call back{sum.followUpsOverdue ? ` · ${sum.followUpsOverdue} overdue` : ''}</span>
          </Link>
        </div>

        <div className="two-col" style={{ marginBottom: 'clamp(32px, 4cqw, 48px)' }}>
          <div className="chart">
            <div className="chart-head">
              <h3>Why they are unhappy</h3>
              <span className="label muted">{low.length} low scores</span>
            </div>
            {causes.length === 0 ? (
              <p className="hint">No low scores in the period.</p>
            ) : (
              <div className="table-wrap">
                <table className="dtable">
                  <thead>
                    <tr>
                      <th scope="col">Reason</th>
                      <th scope="col">Area</th>
                      <th scope="col">Low</th>
                      <th scope="col">Share</th>
                      {prev && <th scope="col">Before</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {causes.map((l) => (
                      <tr className="row" key={l.key || 'none'}>
                        <td className="text">
                          <Link href={PATH + qs(base, l.key ? { reason: l.key, area: undefined, page: undefined } : { area: 'none', reason: undefined, page: undefined })}>{l.label}</Link>
                        </td>
                        <td className="text">{l.area ? AREA_SHORT[l.area] : '—'}</td>
                        <td className="num">{l.n}</td>
                        <td className="num">{n(l.share, '%')}</td>
                        {prev && <td className="num muted">{l.prev ?? 0}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="caveats" style={{ marginTop: 12 }}>
              The desk&apos;s classification (a manager closing the follow-up, or an agent) wins; otherwise the customer&apos;s own pick on the survey; otherwise not classified. Classify from the ledger below.
            </p>
          </div>
          <div className="chart">
            <div className="chart-head">
              <h3>By product</h3>
              <span className="label muted">{products.length} families</span>
            </div>
            {products.length === 0 ? (
              <p className="hint">No ratings in the period.</p>
            ) : (
              <>
                <div className="table-wrap">
                  <table className="dtable">
                    <thead>
                      <tr>
                        <th scope="col">Product</th>
                        <th scope="col">Rated</th>
                        <th scope="col">Low</th>
                        <th scope="col">Low %</th>
                        <th scope="col">CSAT</th>
                        <th scope="col">What about</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.slice(0, 14).map((p) => (
                        <tr className="row" key={p.key}>
                          <td className="text">
                            <Link href={PATH + qs(base, { product: p.key, page: undefined })}>{p.label}</Link>
                          </td>
                          <td className="num">{p.responses}</td>
                          <td className={`num${p.low ? ' is-missed' : ''}`}>{p.low}</td>
                          <td className="num">{n(p.lowShare, '%')}</td>
                          <td className="num">{n(p.csat, '%')}</td>
                          <td className="stackcell">
                            <span className="stack-rows is-cell">
                              <AreaStack areas={p.areas} max={maxProduct} href={(a) => PATH + qs(base, { product: p.key, area: a, reason: undefined, page: undefined })} />
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <AreaLegend />
              </>
            )}
          </div>
        </div>

        <div className="two-col" style={{ marginBottom: 'clamp(32px, 4cqw, 48px)' }}>
          <div className="chart">
            <div className="chart-head">
              <h3>{bucketDays === 1 ? 'Day by day' : 'Week by week'}</h3>
              <span className="label muted">{periodLabel}</span>
            </div>
            {low.length === 0 ? (
              <p className="hint">No low scores in the period.</p>
            ) : (
              <>
                <div className="stack-rows">
                  {buckets.map((b) => (
                    <AreaStack key={b.to.toISOString()} areas={b.areas} max={maxBucket} total={b.low} label={<span title={`${b.responses} responses`}>{bucketLabel(b)}</span>} />
                  ))}
                </div>
                <AreaLegend />
              </>
            )}
          </div>
          <div className="chart" id="repeat">
            <div className="chart-head">
              <h3>Customers who keep rating us low</h3>
              <span className="label muted">last {cs.careWindowDays} days</span>
            </div>
            {repeats.length === 0 ? (
              <p className="hint">Nobody has rated us low more than once in the last {cs.careWindowDays} days.</p>
            ) : (
              <div className="stack-rows">
                {repeats.slice(0, 12).map((c) => (
                  <AreaStack
                    key={c.customerId}
                    areas={c.areas}
                    max={maxRepeat}
                    total={c.low}
                    label={
                      <>
                        <CareTag care={care.get(c.customerId)} mark />
                        <Link href={customerHref({ customerKind: c.customerKind, customerId: c.customerId, caseId: c.last.caseId })} title={`${c.low} low of ${c.total} ratings · last ${c.last.ticket} ${c.last.score}/5 ${dmy(c.last.respondedAt)}${c.products.length ? ` · ${c.products.join(', ')}` : ''}`}>
                          {c.customerName || 'Customer'}
                        </Link>
                        {c.openFollowUp && <span className="muted"> · call back open</span>}
                      </>
                    }
                  />
                ))}
              </div>
            )}
            <p className="caveats" style={{ marginTop: 12 }}>
              Low ratings of {cs.careWindowDays} days, whatever the period: the care window agents see beside a customer. The bar says what they were about.
            </p>
          </div>
        </div>

        <h2 className="sub-head" id="ledger">
          Every low score
          <span className="label">{rows.length.toLocaleString('en-IN')}</span>
        </h2>
        <form className="filters-inline" action={PATH} method="get" aria-label="Filter low scores">
          <input type="hidden" name="period" value={period} />
          <div className="field">
            <label className="label" htmlFor="f-q">
              Search
            </label>
            <span className="control">
              <input id="f-q" name="q" type="search" defaultValue={sp.q ?? ''} placeholder="Case, customer, product, comment" />
            </span>
          </div>
          <div className="field">
            <label className="label" htmlFor="f-area">
              About
            </label>
            <span className="control is-select">
              <select id="f-area" name="area" defaultValue={sp.area ?? ''}>
                <Options empty="Anything" items={[...AREAS.map((a) => ({ value: a, label: AREA_LABEL[a] })), { value: 'none', label: 'Not classified' }]} />
              </select>
            </span>
          </div>
          <div className="field">
            <label className="label" htmlFor="f-reason">
              Reason
            </label>
            <span className="control is-select">
              <select id="f-reason" name="reason" defaultValue={sp.reason ?? ''}>
                <Options empty="Any" items={REASONS.map((r) => ({ value: r.key, label: `${AREA_SHORT[r.area]} · ${r.label}` }))} />
              </select>
            </span>
          </div>
          <div className="field">
            <label className="label" htmlFor="f-product">
              Product
            </label>
            <span className="control is-select">
              <select id="f-product" name="product" defaultValue={sp.product ?? ''}>
                <Options empty="Any" items={products.map((p) => ({ value: p.key, label: p.label }))} />
              </select>
            </span>
          </div>
          <div className="field">
            <label className="label" htmlFor="f-owner">
              Engineer
            </label>
            <span className="control is-select">
              <select id="f-owner" name="owner" defaultValue={sp.owner ?? ''}>
                <Options empty="Anyone" items={owners.map((o) => ({ value: o.id, label: o.name }))} />
              </select>
            </span>
          </div>
          <div className="field">
            <label className="label" htmlFor="f-fu">
              Call back
            </label>
            <span className="control is-select">
              <select id="f-fu" name="fu" defaultValue={sp.fu ?? ''}>
                <Options empty="Any" items={[{ value: 'open', label: 'Open' }, { value: 'overdue', label: 'Overdue' }, { value: 'done', label: 'Closed' }]} />
              </select>
            </span>
          </div>
          <div className="filters-actions">
            <button className="btn btn-line btn-sm" type="submit">
              Filter
            </button>
            {filtered && (
              <Link className="link-u" href={PATH + qs({ period })}>
                Clear
              </Link>
            )}
          </div>
        </form>

        <div className="table-wrap">
          <table className="dtable" style={{ minWidth: 1360 }}>
            <caption className="sr-only">Low scores</caption>
            <thead>
              <tr>
                <th scope="col">Customer</th>
                <th scope="col">Case</th>
                <th scope="col">Product</th>
                <th scope="col">Score</th>
                <th scope="col">What they said</th>
                <th scope="col">About</th>
                <th scope="col">Engineer</th>
                <th scope="col">Rated</th>
                <th scope="col">Call back</th>
              </tr>
            </thead>
            <tbody>
              {slice.length === 0 && (
                <tr className="empty">
                  <td colSpan={9}>{filtered ? 'No low scores match these filters.' : 'No low scores in the period.'}</td>
                </tr>
              )}
              {slice.map((r) => {
                const f = followUpState(r, settings, desk.now)
                const cause = causeOf(r)
                return (
                  <tr className="row" key={r.id}>
                    <td className="text">
                      <CareTag care={care.get(r.customerId)} mark />
                      <Link href={customerHref(r)}>{r.customerName || 'Customer'}</Link>
                    </td>
                    <td>
                      <Tid ticket={r.ticket} href={`${WS}/cases/${r.caseId}`} />
                    </td>
                    <td className="text" title={r.product}>
                      {r.product ? <Link href={PATH + qs(base, { product: familyKey(r.product), page: undefined })}>{productFamily(r.product) || r.product}</Link> : <span className="muted">—</span>}
                    </td>
                    <td className="status">
                      <ScoreTag score={r.score} settings={cs} word={false} />
                    </td>
                    <td className="title" title={r.comment}>
                      {r.comment ? (r.comment.length > 110 ? `${r.comment.slice(0, 109)}…` : r.comment) : <span className="muted">—</span>}
                    </td>
                    <td className="status">
                      {cause.by === 'desk' ? (
                        <details className="classify">
                          <summary>
                            <CauseTag cause={cause} />
                          </summary>
                          <form action={classifyAction}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="return" value={ret} />
                            <ReasonSelect id={`why-${r.id}`} value={cause.key} empty="Clear the desk's call" />
                            <button className="link-u textbtn" type="submit">
                              Save
                            </button>
                          </form>
                        </details>
                      ) : (
                        <form action={classifyAction} className="classify">
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="return" value={ret} />
                          {cause.by === 'customer' && <CauseTag cause={cause} />}
                          <ReasonSelect id={`why-${r.id}`} empty={cause.by === 'customer' ? 'Confirm or change…' : 'What was it about?'} />
                          <button className="link-u textbtn" type="submit">
                            Save
                          </button>
                        </form>
                      )}
                    </td>
                    <td className="text">{r.ownerId ? <Link href={`${MANAGE}/engineers/${r.ownerId}?period=${period}`}>{r.ownerName}</Link> : r.ownerName || '—'}</td>
                    <td className="num">
                      <When date={r.respondedAt} exact />
                    </td>
                    <td className="status" title={r.followUp === 'done' && r.followUpNote ? r.followUpNote : undefined}>
                      <FollowUpTag status={r.followUp} reading={f} />
                      {r.followUp === 'done' && r.followUpNote ? <span className="muted"> {r.followUpNote.length > 60 ? `${r.followUpNote.slice(0, 59)}…` : r.followUpNote}</span> : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="ledger-foot label">
          <span>
            {rows.length.toLocaleString('en-IN')} low scores · page {page}
          </span>
          <Pager page={page} totalPages={Math.max(1, Math.ceil(rows.length / PAGE))} href={(p) => PATH + qs(base, { page: p > 1 ? p : undefined })} label="Low scores" newer="Previous" older="Next" />
        </div>
        <p className="caveats">
          A low score is {cs.unhappyAtOrBelow} or below of 5 (KPI settings). &ldquo;About&rdquo; is the reason behind it: the customer picks one on the survey if they like; the manager who calls them back records what the call found, and that wins. Products fold to their family (&ldquo;Total Security - 5U3Y&rdquo; counts as Total Security). Ratings live in the portal, not in Dynamics. {Object.values(areas).some(Boolean) && areas.none ? `${areas.none} ${areas.none === 1 ? 'low score is' : 'low scores are'} still unclassified: filter on "Not classified" to clear them.` : ''}
        </p>
      </section>
    </>
  )
}

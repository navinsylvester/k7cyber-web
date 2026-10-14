import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { CareTag, CauseTag, FollowUpTag, ReasonSelect, ScoreDistribution, ScoreTag } from '@/components/support/Csat'
import { MANAGE, ManageNav, PeriodSeg, Trend2 } from '@/components/support/Manage'
import { Flash, Options, PageHead, Pager, qs, Tid, When } from '@/components/support/Parts'
import { WS, WorkspaceBar } from '@/components/support/WorkspaceBar'
import { careForCustomers, causeOf, followUpState } from '@/lib/support/csat'
import { SCORE_WORD } from '@/lib/support/csat-model'
import { dmyHm } from '@/lib/support/format'
import { getSettings } from '@/lib/support/kpi-config'
import { asPeriod, PERIODS } from '@/lib/support/kpi-model'
import { csatBreakdown, csatTrend, engineerStats, loadDesk, type CsatBreakBy } from '@/lib/support/metrics'
import { requireManager } from '@/lib/support/session'
import { fmtMinutes } from '@/lib/support/sla'

import { closeFollowUpAction, reopenFollowUpAction, takeFollowUpAction } from './actions'
import { filterCsat, type CsatSP } from './filters'

export const metadata: Metadata = { title: 'Customer satisfaction' }

const PATH = `${MANAGE}/csat`
const PAGE = 25

const BY: { key: CsatBreakBy; label: string }[] = [
  { key: 'owner', label: 'Engineer' },
  { key: 'product', label: 'Product' },
  { key: 'issue', label: 'Issue category' },
  { key: 'vertical', label: 'Vertical' },
  { key: 'priority', label: 'Priority' },
  { key: 'origin', label: 'Origin' },
]

const n = (v: number | null, suffix = '') => (v === null ? '—' : `${v.toLocaleString('en-IN', { maximumFractionDigits: 1 })}${suffix}`)

/* Customer satisfaction for managers (09-portal-guide.md §4d): the numbers, how the scores fall, the unhappy customers still waiting
   for a call, where low scores cluster, and the ledger of every response with its CSV. */
export default async function CsatPage({ searchParams }: { searchParams: Promise<CsatSP> }) {
  const sp = await searchParams
  const me = await requireManager()
  const settings = await getSettings()
  const period = asPeriod(sp.period, settings.defaultPeriod)
  const [desk, prev] = await Promise.all([loadDesk(me.auth, settings, period), loadDesk(me.auth, settings, period, { previous: true }).catch(() => null)])
  const cs = settings.csat
  const sum = desk.csatSummary
  const prevSum = prev?.csatSummary ?? null
  const rows = filterCsat(desk.csat, sp, settings, desk.now).sort((a, b) => (b.respondedAt ?? '').localeCompare(a.respondedAt ?? ''))
  const page = Math.max(1, Number(sp.page) || 1)
  const slice = rows.slice((page - 1) * PAGE, page * PAGE)
  const by = (BY.find((b) => b.key === sp.by)?.key ?? 'owner') as CsatBreakBy
  const lines = csatBreakdown(desk, by)
  const base = { period, score: sp.score, owner: sp.owner, fu: sp.fu, source: sp.source, by: sp.by, q: sp.q }
  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? period
  const queue = desk.followUps.map((r) => ({ r, f: followUpState(r, settings, desk.now) })).sort((a, b) => Number(b.f.state === 'overdue') - Number(a.f.state === 'overdue') || (a.r.respondedAt ?? '').localeCompare(b.r.respondedAt ?? ''))
  const care = await careForCustomers([...queue.map((q) => q.r.customerId), ...slice.map((r) => r.customerId)], settings).catch(() => new Map())
  const owners = engineerStats(desk, { includeShared: true }).map((e) => e.owner)
  const days = csatTrend(desk).map((d) => ({ day: d.day, a: d.responses, b: d.unhappy }))
  const ret = PATH + qs(base, { page: page > 1 ? page : undefined })
  const delta = (a: number | null, b: number | null) => (a === null || b === null ? null : Math.round((a - b) * 10) / 10)
  const dCsat = delta(sum.csat, prevSum?.csat ?? null)
  const dAvg = delta(sum.average, prevSum?.average ?? null)
  return (
    <>
      <WorkspaceBar active="manage" />
      <section className="sheet ws g-paper">
        <PageHead
          above={<span className="label muted">Manager view · {periodLabel} · data as of {dmyHm(desk.fetchedAt)}</span>}
          title="Customer satisfaction"
          lede={
            sum.responses
              ? `${sum.csat}% of ${sum.responses.toLocaleString('en-IN')} customers who answered were satisfied (${sum.average} of 5); ${desk.followUps.length} unhappy ${desk.followUps.length === 1 ? 'customer is' : 'customers are'} waiting for a call back.`
              : `No ratings in the period yet. ${sum.invited ? `${sum.invited} surveys were sent and are unanswered.` : 'Surveys go out when a case is resolved; customers can also rate a closed case on the portal.'}`
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
        <ManageNav active="csat" period={period} />
        {!cs.enabled && <Flash kind="error">CSAT is switched off in KPI settings: no surveys go out and customers cannot rate. The figures below are history.</Flash>}
        {sp.ok && <Flash>{sp.ok === 'taken' ? 'The follow-up is yours. Call the customer, then close it with what you agreed.' : sp.ok === 'closed' ? 'Follow-up closed. Thank you for calling the customer back.' : 'Follow-up reopened.'}</Flash>}
        {sp.error && <Flash kind="error">{sp.error}</Flash>}

        <div className="kpis" style={{ marginBottom: 'clamp(32px, 4cqw, 48px)' }}>
          <div className="kpi">
            <span className="n">{sum.csat === null ? '—' : `${sum.csat}%`}</span>
            <span className="label">
              Satisfied (≥ {cs.satisfiedFrom}){dCsat !== null ? ` · ${dCsat > 0 ? '+' : ''}${dCsat} vs previous` : ''}
            </span>
          </div>
          <div className="kpi">
            <span className="n">{sum.average === null ? '—' : sum.average.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
            <span className="label">Average of 5{dAvg !== null ? ` · ${dAvg > 0 ? '+' : ''}${dAvg} vs previous` : ''}</span>
          </div>
          <div className="kpi">
            <span className="n">{sum.responses.toLocaleString('en-IN')}</span>
            <span className="label">
              Responses · {sum.invited} invited{sum.responseRate !== null ? ` · ${sum.responseRate}% answered` : ''}
            </span>
          </div>
          <div className={`kpi${sum.unhappy ? ' is-signal' : ''}`}>
            <span className="n">{sum.unhappy.toLocaleString('en-IN')}</span>
            <span className="label">Low scores (≤ {cs.unhappyAtOrBelow}) in the period</span>
          </div>
          <Link className={`kpi${sum.followUpsOverdue || desk.followUps.length ? ' is-signal' : ''}`} href="#follow-ups">
            <span className="n">{desk.followUps.length}</span>
            <span className="label">
              Awaiting follow-up{sum.followUpsOverdue ? ` · ${sum.followUpsOverdue} overdue` : ''}
            </span>
          </Link>
          <div className="kpi">
            <span className="n">{sum.followUpPct === null ? '—' : `${sum.followUpPct}%`}</span>
            <span className="label">
              Contacted within {fmtMinutes(cs.followUpMinutes)} · {sum.followUpsClosed} closed
            </span>
          </div>
        </div>

        <div className="two-col" style={{ marginBottom: 'clamp(32px, 4cqw, 48px)' }}>
          <div className="chart">
            <div className="chart-head">
              <h3>How the scores fall</h3>
              <span className="label muted">{sum.responses} responses</span>
            </div>
            {sum.responses ? <ScoreDistribution dist={sum.distribution} settings={cs} /> : <p className="hint">No ratings in the period.</p>}
          </div>
          <div className="chart">
            <div className="chart-head">
              <h3>Responses and low scores per day</h3>
              <span className="label muted">{periodLabel}</span>
            </div>
            <Trend2 days={days} aLabel="Responses" bLabel="Low scores" />
          </div>
        </div>

        <h2 className="sub-head" id="follow-ups">
          <span>
            Unhappy customers to call back{' '}
            <Link className="label" href={`${MANAGE}/unhappy?period=${period}`} style={{ marginLeft: 12 }}>
              Why they are unhappy →
            </Link>
          </span>
          <span className="label">
            {queue.length} open{sum.followUpsOverdue ? ` · ${sum.followUpsOverdue} past ${fmtMinutes(cs.followUpMinutes)}` : ''}
          </span>
        </h2>
        <div className="board" style={{ marginBottom: 'clamp(32px, 4cqw, 48px)' }}>
          {queue.length === 0 && <p className="hint" style={{ padding: '24px 0' }}>Nobody is waiting. Every low score has been followed up.</p>}
          {queue.map(({ r, f }) => (
            <article className={`fu-row${f.state === 'overdue' ? ' is-overdue' : ''}`} key={r.id}>
              <div>
                <div className="t">
                  <CareTag care={care.get(r.customerId)} mark />
                  <Link href={r.customerKind ? `${WS}/customers/${r.customerKind === 'account' ? 'accounts' : 'contacts'}/${r.customerId}` : `${WS}/cases/${r.caseId}`}>{r.customerName || 'Customer'}</Link>
                </div>
                <div className="s">
                  <Tid ticket={r.ticket} href={`${WS}/cases/${r.caseId}`} />
                  <span>{r.title}</span>
                  <span>{r.email}</span>
                </div>
                {r.comment && <p className="q" style={{ margin: '8px 0 0' }}>{r.comment}</p>}
              </div>
              <div className="s" style={{ alignContent: 'start' }}>
                <ScoreTag score={r.score} settings={cs} />
                <span>
                  rated <When date={r.respondedAt} /> · {r.source === 'agent' ? 'by phone' : r.source === 'email' ? 'email survey' : 'on the portal'}
                </span>
                <span>
                  engineer <Link href={`${MANAGE}/engineers/${r.ownerId}?period=${period}`}>{r.ownerName || 'unassigned'}</Link>
                </span>
                <span>
                  <FollowUpTag status={r.followUp} reading={f} />
                  {r.followUpOwnerName ? ` with ${r.followUpOwnerName}` : ''}
                </span>
                {r.product && <span>{r.product}</span>}
                {causeOf(r).key && (
                  <span>
                    about <CauseTag cause={causeOf(r)} />
                  </span>
                )}
              </div>
              <div className="acts-inline">
                {r.followUp === 'pending' && (
                  <form action={takeFollowUpAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="return" value={ret} />
                    <button className="btn btn-line btn-sm" type="submit">
                      I will call them
                    </button>
                  </form>
                )}
                <form action={closeFollowUpAction}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="return" value={ret} />
                  <ReasonSelect id={`why-${r.id}`} value={r.reason || r.customerReason} required />
                  <input type="text" name="note" placeholder="What you agreed with the customer" aria-label="What you agreed" required minLength={3} />
                  <label className="check" style={{ fontSize: 12 }}>
                    <input type="checkbox" name="caseNote" value="1" defaultChecked /> note on case
                  </label>
                  <button className="btn btn-primary btn-sm" type="submit">
                    Contacted →
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>

        <div className="two-col" style={{ marginBottom: 'clamp(32px, 4cqw, 48px)' }}>
          <div className="chart">
            <div className="chart-head">
              <h3>By {BY.find((b) => b.key === by)?.label.toLowerCase()}</h3>
              <span className="seg seg-l" role="group" aria-label="Break down by">
                {BY.map((b) => (
                  <Link href={PATH + qs(base, { by: b.key, page: undefined })} key={b.key} aria-pressed={b.key === by}>
                    {b.label}
                  </Link>
                ))}
              </span>
            </div>
            {lines.length === 0 ? (
              <p className="hint">No ratings in the period.</p>
            ) : (
              <div className="table-wrap">
                <table className="dtable">
                  <thead>
                    <tr>
                      <th scope="col">{BY.find((b) => b.key === by)?.label}</th>
                      <th scope="col">Responses</th>
                      <th scope="col">Average</th>
                      <th scope="col">Satisfied</th>
                      <th scope="col">Low</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.slice(0, 14).map((l) => (
                      <tr className="row" key={l.key}>
                        <td className="text">{by === 'owner' && l.key !== 'none' ? <Link href={`${MANAGE}/engineers/${l.key}?period=${period}`}>{l.label}</Link> : l.label}</td>
                        <td className="num">{l.responses}</td>
                        <td className="num">{n(l.average)}</td>
                        <td className="num">{n(l.csat, '%')}</td>
                        <td className={`num${l.unhappy ? ' is-missed' : ''}`}>{l.unhappy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="chart">
            <div className="chart-head">
              <h3>What the scale means</h3>
              <Link className="label" href={`${MANAGE}/kpis#csat`}>
                CSAT settings →
              </Link>
            </div>
            <dl className="meta-rows label">
              {([5, 4, 3, 2, 1] as const).map((sc) => (
                <React.Fragment key={sc}>
                  <dt>
                    {sc} · {SCORE_WORD[sc]}
                  </dt>
                  <dd className="sans">{sc >= cs.satisfiedFrom ? 'Counts as satisfied' : sc <= cs.unhappyAtOrBelow ? `Opens a follow-up; the customer is "handle with care"` : 'Neutral: neither counts'}</dd>
                </React.Fragment>
              ))}
            </dl>
            <p className="caveats" style={{ marginTop: 16 }}>
              CSAT is the share of responses at or above {cs.satisfiedFrom}. A customer&apos;s care band comes from their latest {cs.careRecent} ratings in the last {cs.careWindowDays} days, or a manager&apos;s flag on their record. Unhappy customers should be contacted within {fmtMinutes(cs.followUpMinutes)} of rating, on the desk&apos;s business hours.
            </p>
          </div>
        </div>

        <h2 className="sub-head">
          Every response
          <span className="label">{rows.length.toLocaleString('en-IN')}</span>
        </h2>
        <form className="filters-inline" action={PATH} method="get" aria-label="Filter responses">
          <input type="hidden" name="period" value={period} />
          {sp.by && <input type="hidden" name="by" value={sp.by} />}
          <div className="field">
            <label className="label" htmlFor="f-q">
              Search
            </label>
            <span className="control">
              <input id="f-q" name="q" type="search" defaultValue={sp.q ?? ''} placeholder="Case, customer, comment or email" />
            </span>
          </div>
          <div className="field">
            <label className="label" htmlFor="f-score">
              Score
            </label>
            <span className="control is-select">
              <select id="f-score" name="score" defaultValue={sp.score ?? ''}>
                <Options
                  empty="Any"
                  items={[
                    { value: 'low', label: `Low (≤ ${cs.unhappyAtOrBelow})` },
                    { value: 'mid', label: 'Neutral' },
                    { value: 'high', label: `Satisfied (≥ ${cs.satisfiedFrom})` },
                    ...([1, 2, 3, 4, 5] as const).map((sc) => ({ value: String(sc), label: `${sc} · ${SCORE_WORD[sc]}` })),
                  ]}
                />
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
              Follow-up
            </label>
            <span className="control is-select">
              <select id="f-fu" name="fu" defaultValue={sp.fu ?? ''}>
                <Options empty="Any" items={[{ value: 'open', label: 'Open' }, { value: 'overdue', label: 'Overdue' }, { value: 'done', label: 'Closed' }, { value: 'none', label: 'Not needed' }]} />
              </select>
            </span>
          </div>
          <div className="field">
            <label className="label" htmlFor="f-source">
              Source
            </label>
            <span className="control is-select">
              <select id="f-source" name="source" defaultValue={sp.source ?? ''}>
                <Options empty="Any" items={[{ value: 'email', label: 'Email survey' }, { value: 'portal', label: 'Portal' }, { value: 'agent', label: 'Recorded by an agent' }]} />
              </select>
            </span>
          </div>
          <div className="filters-actions">
            <button className="btn btn-line btn-sm" type="submit">
              Filter
            </button>
            {(sp.q || sp.score || sp.owner || sp.fu || sp.source) && (
              <Link className="link-u" href={PATH + qs({ period, by: sp.by })}>
                Clear
              </Link>
            )}
          </div>
        </form>

        <div className="table-wrap">
          <table className="dtable" style={{ minWidth: 1400 }}>
            <caption className="sr-only">Survey responses</caption>
            <thead>
              <tr>
                <th scope="col">Case</th>
                <th scope="col">Customer</th>
                <th scope="col">Score</th>
                <th scope="col">Comment</th>
                <th scope="col">About</th>
                <th scope="col">Engineer</th>
                <th scope="col">Rated</th>
                <th scope="col">Resolved → rated</th>
                <th scope="col">Follow-up</th>
                <th scope="col">Source</th>
              </tr>
            </thead>
            <tbody>
              {slice.length === 0 && (
                <tr className="empty">
                  <td colSpan={10}>No responses match these filters.</td>
                </tr>
              )}
              {slice.map((r) => {
                const f = followUpState(r, settings, desk.now)
                const gap = r.resolvedAt && r.respondedAt ? Math.max(0, Math.round((new Date(r.respondedAt).getTime() - new Date(r.resolvedAt).getTime()) / 36e5)) : null
                return (
                  <tr className="row" key={r.id}>
                    <td>
                      <Tid ticket={r.ticket} href={`${WS}/cases/${r.caseId}`} />
                    </td>
                    <td className="text">
                      <CareTag care={care.get(r.customerId)} mark />
                      {r.customerKind ? <Link href={`${WS}/customers/${r.customerKind === 'account' ? 'accounts' : 'contacts'}/${r.customerId}#csat`}>{r.customerName || 'Customer'}</Link> : r.customerName || '—'}
                    </td>
                    <td className="status">
                      <ScoreTag score={r.score} settings={cs} word={false} />
                    </td>
                    <td className="title" title={r.comment}>
                      {r.comment ? (r.comment.length > 90 ? `${r.comment.slice(0, 89)}…` : r.comment) : <span className="muted">—</span>}
                    </td>
                    <td className="status">{r.score !== null && r.score <= cs.unhappyAtOrBelow ? <CauseTag cause={causeOf(r)} /> : causeOf(r).key ? <CauseTag cause={causeOf(r)} /> : <span className="muted">—</span>}</td>
                    <td className="text">{r.ownerId ? <Link href={`${MANAGE}/engineers/${r.ownerId}?period=${period}`}>{r.ownerName}</Link> : r.ownerName || '—'}</td>
                    <td className="num">
                      <When date={r.respondedAt} exact />
                    </td>
                    <td className="num">{gap === null ? '—' : gap < 1 ? '< 1 h' : gap < 48 ? `${gap} h` : `${Math.round(gap / 24)} d`}</td>
                    <td className="status">
                      <FollowUpTag status={r.followUp} reading={f} />
                      {r.followUp === 'done' && (
                        <form action={reopenFollowUpAction} style={{ display: 'inline' }}>
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="return" value={ret} />
                          <button className="link-u textbtn" type="submit" style={{ marginLeft: 8, fontSize: 12 }}>
                            reopen
                          </button>
                        </form>
                      )}
                    </td>
                    <td className="text">{r.source === 'agent' ? 'Agent' : r.source === 'email' ? 'Email' : 'Portal'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="ledger-foot label">
          <span>
            {rows.length.toLocaleString('en-IN')} responses · page {page}
          </span>
          <Pager page={page} totalPages={Math.max(1, Math.ceil(rows.length / PAGE))} href={(p) => PATH + qs(base, { page: p > 1 ? p : undefined })} label="Responses" newer="Previous" older="Next" />
        </div>
        <p className="caveats">
          Ratings are stored by the portal, not in Dynamics: the CRM has no satisfaction field. Each case carries one rating; a customer who rates again replaces it. &ldquo;Resolved → rated&rdquo; is wall-clock time from the case&apos;s resolution to the answer. Engineers are credited with the case&apos;s owner at the time of the rating.
        </p>
      </section>
    </>
  )
}

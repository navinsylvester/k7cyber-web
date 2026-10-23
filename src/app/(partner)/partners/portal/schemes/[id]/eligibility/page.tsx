import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { CountedLedger, PayoutTag, ProgressLine, ResultFacts, ResultTag, SlabTable } from '@/components/partner/Schemes'
import { Field, Flash, Strip } from '@/components/partner/Parts'
import { PARTNER_DEALS } from '@/lib/partner/deals'
import { loadSchemeFor, PARTNER_SCHEMES } from '@/lib/partner/schemes'
import { canDispute, disputeUntil, resultStatus, schemePhase } from '@/lib/partner/schemes-model'
import { requirePartner } from '@/lib/partner/session'
import { getPartnerSettings } from '@/lib/partner/settings'
import { dmy, dmyHm } from '@/lib/support/format'

import { disputeAction } from '../../actions'

export const metadata: Metadata = { title: 'Check eligibility' }

type SP = { ok?: string; error?: string }

/* The Check eligibility page (01-requirements.md §9.2, FR-ELG-03 … 06): the result once K7 publishes it (status, the value won
   against the target, the slab reached and its benefit, the gap when not eligible, the deals counted), the dispute within the
   window, the payout's state. Before publication the page says the results are under review. */
export default async function EligibilityPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const me = await requirePartner(`${PARTNER_SCHEMES}/${id}/eligibility`)
  const view = await loadSchemeFor(me, id)
  if (!view) notFound()
  const { scheme: sc, registration: reg, result: r } = view
  const settings = await getPartnerSettings()
  const phase = schemePhase(sc)
  const published = Boolean(sc.results.publishedAt)
  const until = disputeUntil(sc, settings.schemes.disputeDays)
  const head = (
    <div className="ws-head">
      <div className="ws-head-main">
        <span className="label muted">
          <Link className="link-u" href={PARTNER_SCHEMES}>
            Schemes
          </Link>{' '}
          ·{' '}
          <Link className="link-u" href={`${PARTNER_SCHEMES}/${sc.id}`}>
            {sc.name}
          </Link>
        </span>
        <h1 className="h-util">Check eligibility.</h1>
        <p className="lede">{r ? `K7 published the results on ${dmy(sc.results.publishedAt!)}. What is counted is what K7’s CRM recorded as won inside ${dmy(sc.startDate)} – ${dmy(sc.endDate)}, after any adjustment K7 made with its reason.` : `The results of ${sc.name} are computed after it closes on ${dmy(sc.endDate)}, reviewed by K7 and published here.`}</p>
      </div>
    </div>
  )
  if (!r) {
    return (
      <section className="sheet ws g-paper">
        {head}
        <Strip items={[{ label: 'Scheme', value: dmy(sc.endDate) < new Date().toISOString().slice(0, 10) ? 'Closed' : 'Running' }, { label: 'Your organisation', value: reg?.status === 'approved' ? 'Registered' : reg?.status === 'pending' ? 'Awaiting K7' : 'Not registered' }, { label: 'Result', value: <ResultTag status="review" /> }]} />
        <p className="lede" style={{ fontSize: 17 }}>
          {reg?.status === 'approved' ? (phase === 'closed' ? 'The scheme has closed; K7 is computing and reviewing the results. You are told by email and here when they are published.' : 'The scheme is still running; your provisional progress is on the scheme page.') : 'Your organisation was not registered for this scheme, so no result is computed for it.'}
        </p>
        <p className="more">
          <Link className="link-u" href={`${PARTNER_SCHEMES}/${sc.id}`}>
            ← The scheme
          </Link>
        </p>
      </section>
    )
  }
  const status = resultStatus(r, published)
  const slab = r.slabIndex >= 0 ? sc.slabs[r.slabIndex] : null
  const canRaise = me.roles.includes('admin') && canDispute(sc, r, settings.schemes.disputeDays) === null
  return (
    <section className="sheet ws g-paper">
      {head}
      {sp.ok && <Flash>{sp.ok}</Flash>}
      {sp.error && <Flash kind="error">{sp.error}</Flash>}
      <Strip
        items={[
          { label: 'Status', value: <ResultTag status={status} /> },
          { label: 'Counted value', value: `₹${r.final.toLocaleString('en-IN')}` },
          { label: 'Target', value: `₹${r.target.toLocaleString('en-IN')}` },
          { label: 'Slab reached', value: slab ? `${r.slabIndex + 1} · ${slab.benefit}` : 'None' },
          ...(r.eligible ? [{ label: 'Payout', value: <PayoutTag status={r.payout.status} /> }] : [{ label: 'Gap', value: `₹${r.gap.toLocaleString('en-IN')}` }]),
        ]}
      />
      <ProgressLine slabs={sc.slabs} value={r.final} label="Your result" />
      <div className="phome">
        <div>
          <h2>Deals counted</h2>
          <CountedLedger deals={r.dealsCounted} href={(d) => `${PARTNER_DEALS}/${d}`} label={`${r.dealsCounted.length} deal${r.dealsCounted.length === 1 ? '' : 's'} · ₹${r.achieved.toLocaleString('en-IN')}`} />
          <h2 style={{ marginTop: 'clamp(28px, 3cqw, 40px)' }}>Slabs</h2>
          <SlabTable slabs={sc.slabs} reached={r.slabIndex} value={r.final} />
        </div>
        <aside className="ws-side">
          <div>
            <h2>The result</h2>
            <ResultFacts scheme={sc} result={r} status={status} />
          </div>
          {r.eligible ? (
            <div>
              <h2>Payout</h2>
              <dl className="meta-rows">
                <dt>State</dt>
                <dd className="sans">
                  <PayoutTag status={r.payout.status} />
                </dd>
                {r.payout.reference ? (
                  <>
                    <dt>Reference</dt>
                    <dd>{r.payout.reference}</dd>
                  </>
                ) : null}
                {r.payout.at ? (
                  <>
                    <dt>Updated</dt>
                    <dd className="sans">{dmy(r.payout.at)}</dd>
                  </>
                ) : null}
                {r.payout.note ? (
                  <>
                    <dt>Note</dt>
                    <dd className="sans">{r.payout.note}</dd>
                  </>
                ) : null}
              </dl>
              <p className="muted" style={{ margin: '12px 0 0', fontSize: 14 }}>
                K7 records the payout’s state here; the payment itself is made outside the portal.
              </p>
            </div>
          ) : null}
          <div className={`dispute${r.dispute.status === 'open' ? ' is-open' : ''}`}>
            <h2>
              {r.dispute.status !== 'none' ? <i className="pixel" aria-hidden="true" /> : null}
              {r.dispute.status === 'open' ? 'Your query is with K7' : r.dispute.status === 'resolved' ? 'Your query was answered' : 'Query or dispute'}
            </h2>
            {r.dispute.status !== 'none' ? (
              <>
                <p className="muted" style={{ margin: 0, fontSize: 14 }}>
                  Raised {r.dispute.raisedAt ? dmyHm(r.dispute.raisedAt) : ''} by {r.dispute.raisedBy}
                </p>
                <blockquote>{r.dispute.text}</blockquote>
                {r.dispute.status === 'resolved' ? (
                  <>
                    <p className="muted" style={{ margin: '14px 0 0', fontSize: 14 }}>
                      K7’s answer, {r.dispute.resolvedAt ? dmyHm(r.dispute.resolvedAt) : ''}
                    </p>
                    <blockquote>{r.dispute.resolution}</blockquote>
                  </>
                ) : null}
              </>
            ) : canRaise ? (
              <form action={disputeAction} className="form-grid" style={{ gap: 14 }}>
                <input type="hidden" name="schemeId" value={sc.id} />
                <Field id="dispute-text" label="What you dispute and why" span hint={until ? `Open until ${dmy(until)}. A deal missing from the count, a value that differs from your invoice, a product K7 did not count.` : undefined}>
                  <textarea id="dispute-text" name="text" rows={4} required minLength={10} />
                </Field>
                <div className="form-actions span-2">
                  <button className="btn btn-primary" type="submit">
                    Send to the Scheme Admin →
                  </button>
                </div>
              </form>
            ) : (
              <p className="muted" style={{ margin: 0, fontSize: 15 }}>
                {!me.roles.includes('admin') ? 'A Partner Admin of your organisation can raise a query on this result.' : canDispute(sc, r, settings.schemes.disputeDays)}
              </p>
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}

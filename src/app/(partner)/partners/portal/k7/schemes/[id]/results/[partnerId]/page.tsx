import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { K7Nav } from '@/components/partner/K7Nav'
import { Field, Flash, Pid, Strip } from '@/components/partner/Parts'
import { CountedLedger, PayoutTag, ProgressLine, ResultFacts, ResultTag, SlabTable } from '@/components/partner/Schemes'
import { objectAudit } from '@/lib/partner/audit'
import { K7_DEALS } from '@/lib/partner/deals'
import { K7_SCHEMES, loadResultK7, loadScheme } from '@/lib/partner/schemes'
import { PAYOUT_STATUS_LABEL, PAYOUT_STATUSES, resultStatus } from '@/lib/partner/schemes-model'
import { requireK7Role } from '@/lib/partner/session'
import { dmy, dmyHm } from '@/lib/support/format'

import { adjustAction, payoutAction, resolveDisputeAction } from '../../../actions'

export const metadata: Metadata = { title: 'Result' }

type SP = { ok?: string; error?: string }

/* One organisation's result on the desk (FR-ELG-02, 05, 06): the deals counted, the standing, the adjustment with its reason,
   the dispute to answer, the payout to record. What the partner sees of it is the same row after publication. */
export default async function K7ResultPage({ params, searchParams }: { params: Promise<{ id: string; partnerId: string }>; searchParams: Promise<SP> }) {
  const [{ id, partnerId }, sp] = await Promise.all([params, searchParams])
  const me = await requireK7Role(['schemeAdmin'], `${K7_SCHEMES}/${id}/results/${partnerId}`)
  const sc = await loadScheme(id)
  if (!sc) notFound()
  const r = await loadResultK7(sc.id, partnerId)
  if (!r) notFound()
  const published = Boolean(sc.results.publishedAt)
  const status = published ? resultStatus(r, true) : r.eligible ? 'eligible' : 'notEligible'
  const trail = await objectAudit('partner-eligibility', r.id, 20)
  return (
    <>
      <K7Nav active="schemes" roles={me.roles} />
      <section className="sheet ws g-paper">
        <div className="ws-head">
          <div className="ws-head-main">
            <span className="label muted">
              <Link className="link-u" href={K7_SCHEMES}>
                Schemes
              </Link>{' '}
              ·{' '}
              <Link className="link-u" href={`${K7_SCHEMES}/${sc.id}`}>
                {sc.name}
              </Link>{' '}
              · <Pid id={r.orgPartnerId} href={`/partners/portal/k7/partners/${r.orgPartnerId}`} />
            </span>
            <h1 className="h-util">{r.orgName}.</h1>
            <p className="lede">
              {r.dealsCounted.length} deal{r.dealsCounted.length === 1 ? '' : 's'} won inside {dmy(sc.startDate)} – {dmy(sc.endDate)} for ₹{r.achieved.toLocaleString('en-IN')}
              {r.adjustment.amount ? `, adjusted by ${r.adjustment.amount > 0 ? '+' : ''}₹${r.adjustment.amount.toLocaleString('en-IN')}` : ''}; computed {r.computedAt ? dmyHm(r.computedAt) : '—'}.{published ? ` Published ${dmy(sc.results.publishedAt!)}; the partner reads this result.` : ' Not yet published; the partner does not see it.'}
            </p>
          </div>
        </div>
        {sp.ok && <Flash>{sp.ok}</Flash>}
        {sp.error && <Flash kind="error">{sp.error}</Flash>}
        <Strip
          items={[
            { label: 'Standing', value: <ResultTag status={status} /> },
            { label: 'Counted value', value: `₹${r.final.toLocaleString('en-IN')}` },
            { label: 'Target', value: `₹${r.target.toLocaleString('en-IN')}` },
            { label: 'Slab', value: r.slabIndex >= 0 ? `${r.slabIndex + 1} · ${sc.slabs[r.slabIndex]?.benefit ?? ''}` : 'None' },
            ...(r.eligible ? [{ label: 'Payout', value: <PayoutTag status={r.payout.status} /> }] : [{ label: 'Gap', value: `₹${r.gap.toLocaleString('en-IN')}` }]),
          ]}
        />
        <ProgressLine slabs={sc.slabs} value={r.final} label="Standing" />
        <div className="phome">
          <div>
            {r.dispute.status !== 'none' && (
              <div className={`dispute${r.dispute.status === 'open' ? ' is-open' : ''}`} style={{ marginBottom: 'clamp(28px, 3cqw, 40px)' }}>
                <h2>
                  <i className="pixel" aria-hidden="true" /> {r.dispute.status === 'open' ? 'Dispute to answer' : 'Dispute resolved'}
                </h2>
                <p className="muted" style={{ margin: 0, fontSize: 14 }}>
                  Raised {r.dispute.raisedAt ? dmyHm(r.dispute.raisedAt) : ''} by {r.dispute.raisedBy}
                </p>
                <blockquote>{r.dispute.text}</blockquote>
                {r.dispute.status === 'resolved' ? (
                  <>
                    <p className="muted" style={{ margin: '14px 0 0', fontSize: 14 }}>
                      Answered {r.dispute.resolvedAt ? dmyHm(r.dispute.resolvedAt) : ''} by {r.dispute.resolvedBy}
                    </p>
                    <blockquote>{r.dispute.resolution}</blockquote>
                  </>
                ) : (
                  <form action={resolveDisputeAction} className="form-grid" style={{ gap: 12, marginTop: 16 }}>
                    <input type="hidden" name="schemeId" value={sc.id} />
                    <input type="hidden" name="partnerId" value={r.orgPartnerId} />
                    <Field id="resolution" label="Your answer to the partner" span hint="If the count changes, record the adjustment with its reason first; then answer here.">
                      <textarea id="resolution" name="resolution" rows={4} required />
                    </Field>
                    <div className="form-actions span-2">
                      <button className="btn btn-primary" type="submit">
                        Resolve →
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
            <h2>Deals counted</h2>
            <CountedLedger deals={r.dealsCounted} href={(d) => `${K7_DEALS}/${d}`} label={`${r.dealsCounted.length} deal${r.dealsCounted.length === 1 ? '' : 's'}`} />
            <h2 style={{ marginTop: 'clamp(28px, 3cqw, 40px)' }}>Slabs</h2>
            <SlabTable slabs={sc.slabs} reached={r.slabIndex} value={r.final} />
          </div>
          <aside className="ws-side">
            <div>
              <h2>The result</h2>
              <ResultFacts scheme={sc} result={r} status={status} />
            </div>
            <div className="decide">
              <h2>Adjust</h2>
              <p className="hint" style={{ margin: '0 0 14px' }}>
                FR-ELG-02: add to or take from the won value with the reason recorded; the slab and the gap follow. One adjustment stands at a time; a new one replaces it.{r.adjustment.at ? ` Current: ${r.adjustment.amount > 0 ? '+' : ''}₹${r.adjustment.amount.toLocaleString('en-IN')} by ${r.adjustment.by} on ${dmy(r.adjustment.at)}: ${r.adjustment.reason}` : ''}
              </p>
              <form action={adjustAction} className="form-grid" style={{ gap: 12 }}>
                <input type="hidden" name="schemeId" value={sc.id} />
                <input type="hidden" name="partnerId" value={r.orgPartnerId} />
                <Field id="amount" label="Adjustment, ₹ (negative to reduce)">
                  <input id="amount" name="amount" inputMode="numeric" defaultValue={r.adjustment.amount || ''} placeholder="0" />
                </Field>
                <Field id="reason" label="Reason" span required>
                  <input id="reason" name="reason" required defaultValue={r.adjustment.reason} placeholder="e.g. invoice INV-2026-118 not yet read back from the CRM" />
                </Field>
                <div className="form-actions span-2">
                  <button className="btn btn-primary" type="submit">
                    Record the adjustment →
                  </button>
                </div>
              </form>
            </div>
            {r.eligible && published ? (
              <div className="decide">
                <h2>Payout</h2>
                <p className="hint" style={{ margin: '0 0 14px' }}>
                  FR-ELG-06: the state and the reference, updated as Finance moves it; the payment itself happens outside the portal. The partner is told of each change.
                </p>
                <form action={payoutAction} className="form-grid" style={{ gap: 12 }}>
                  <input type="hidden" name="schemeId" value={sc.id} />
                  <input type="hidden" name="partnerId" value={r.orgPartnerId} />
                  <Field id="status" label="State" select>
                    <select id="status" name="status" defaultValue={r.payout.status}>
                      {PAYOUT_STATUSES.map((p) => (
                        <option value={p} key={p}>
                          {PAYOUT_STATUS_LABEL[p]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field id="reference" label="Reference number" hint="Required once processed or paid.">
                    <input id="reference" name="reference" defaultValue={r.payout.reference} />
                  </Field>
                  <Field id="pnote" label="Note" span>
                    <input id="pnote" name="note" defaultValue={r.payout.note} />
                  </Field>
                  <div className="form-actions span-2">
                    <button className="btn btn-primary" type="submit">
                      Record the payout →
                    </button>
                  </div>
                </form>
              </div>
            ) : null}
            {trail.length > 0 && (
              <div>
                <h2>Record</h2>
                <ol className="ntf">
                  {trail.map((t) => (
                    <li key={t.id}>
                      <span className="ntf-when">{dmy(t.at)}</span>
                      <div className="ntf-body">
                        <strong>{t.action.replace(/[.-]/g, ' ')}</strong>
                        <p>
                          {t.from || t.to ? `${t.from || '—'} → ${t.to || '—'}` : ''}
                          {t.comment ? ` · ${t.comment}` : ''}
                          {t.actor.name ? ` · ${t.actor.name}` : ''}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </aside>
        </div>
      </section>
    </>
  )
}

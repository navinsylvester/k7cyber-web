import Link from 'next/link'
import React from 'react'

import { Pid } from '@/components/partner/Parts'
import { formatInr } from '@/lib/partner/deals-model'
import { GROUP_LABEL, PAYOUT_STATUS_LABEL, PHASE_LABEL, REGISTRATION_STATUS_LABEL, RESULT_STATUS_LABEL, standing, type CountedDeal, type EligibilityResult, type PayoutStatus, type RegistrationStatus, type ResultStatus, type Scheme, type SchemePhase, type SchemeRow, type Slab, type Standing } from '@/lib/partner/schemes-model'
import { dmy } from '@/lib/support/format'

/* Section 10 · Partners, the scheme parts (design-system/components/PartnerParts/README.md P22–P24): the phase and the
   registration as tags, the slab ladder, the progress line against the slabs, the result as filed facts with the gap, and the
   deals counted as a ledger. Money is ₹ in full here (the figures are what a partner is paid on); the dashboard's short
   forms stay on the cards. */

/** P22 Scheme phase: Open for registration on signal (the partner must act to be in), Running solid state, Starts soon
    dashed, Closed closed. */
export const PhaseTag: React.FC<{ phase: SchemePhase }> = ({ phase }) => <span className={phase === 'open' ? 'tag tag-signal' : phase === 'running' ? 'tag tag-state' : phase === 'upcoming' ? 'tag tag-dashed' : 'tag tag-closed'}>{PHASE_LABEL[phase]}</span>

/** The registration's state: Registered solid, Awaiting K7 on signal for the K7 queue (someone must decide) and quiet for the
    partner, Declined closed; "Not registered" dashed. */
export const RegistrationTag: React.FC<{ status: RegistrationStatus | null; audience?: 'partner' | 'k7' }> = ({ status, audience = 'partner' }) =>
  status === null ? <span className="tag tag-dashed">Not registered</span> : <span className={status === 'approved' ? 'tag tag-solid' : status === 'declined' ? 'tag tag-closed' : audience === 'k7' ? 'tag tag-signal' : 'tag tag-state'}>{REGISTRATION_STATUS_LABEL[status]}</span>

/** P24 The result's state (FR-ELG-03): Eligible solid, Not eligible closed, Under review dashed. */
export const ResultTag: React.FC<{ status: ResultStatus }> = ({ status }) => <span className={status === 'eligible' ? 'tag tag-solid' : status === 'notEligible' ? 'tag tag-closed' : 'tag tag-dashed'}>{RESULT_STATUS_LABEL[status]}</span>

export const PayoutTag: React.FC<{ status: PayoutStatus }> = ({ status }) => <span className={status === 'paid' ? 'tag tag-solid' : status === 'processed' ? 'tag tag-state' : 'tag tag-dashed'}>{PAYOUT_STATUS_LABEL[status]}</span>

/** The slab ladder: one row per slab in threshold order, the reached one marked. */
export const SlabTable: React.FC<{ slabs: Slab[]; reached?: number; value?: number }> = ({ slabs, reached = -1, value }) => (
  <table className="dtable slabs">
    <thead>
      <tr>
        <th scope="col">Slab</th>
        <th scope="col" className="num">
          Won value from
        </th>
        <th scope="col">Benefit</th>
        <th scope="col" className="num">
          Amount
        </th>
      </tr>
    </thead>
    <tbody>
      {slabs.map((sl, i) => (
        <tr className={`row${i === reached ? ' is-reached' : i < reached ? ' is-passed' : ''}`} key={i}>
          <td className="num">
            {i === reached ? <i className="pixel" aria-label="Reached" /> : null} {String(i + 1).padStart(2, '0')}
          </td>
          <td className="num">{formatInr(sl.threshold)}</td>
          <td className="text">{sl.benefit}</td>
          <td className="num">{sl.amount !== null ? formatInr(sl.amount) : '—'}</td>
        </tr>
      ))}
      {typeof value === 'number' && slabs.length === 0 ? (
        <tr className="row">
          <td colSpan={4} className="muted">
            No slabs on this scheme yet.
          </td>
        </tr>
      ) : null}
    </tbody>
  </table>
)

/** P23 The progress line (FR-SCH-05): one bar on the track's height, ink for the value won as a share of the top slab, a
    tick per slab, signal once the first slab (the target) is reached; beneath it the value and the gap in words. */
export const ProgressLine: React.FC<{ slabs: Slab[]; value: number; provisional?: boolean; label?: string }> = ({ slabs, value, provisional, label }) => {
  const st: Standing = standing(slabs, value)
  const top = slabs.length ? Math.max(...slabs.map((s) => s.threshold)) : 0
  return (
    <div className="sprog" aria-label={label ?? 'Progress'}>
      <div className="sprog-bar">
        <i className={st.eligible ? 'is-eligible' : undefined} style={{ width: `${Math.round(st.share * 100)}%` }} />
        {slabs.map((sl, i) => (
          <b key={i} className={i <= st.slabIndex ? 'is-passed' : undefined} style={{ left: `${top ? Math.round((sl.threshold / top) * 100) : 0}%` }} title={`Slab ${i + 1} · ${formatInr(sl.threshold)}`} />
        ))}
      </div>
      <div className="sprog-line">
        <span className="label">
          <strong>{formatInr(value)}</strong> won{provisional ? ' so far' : ''}
          {provisional ? ' · provisional' : ''}
        </span>
        <span className={`label${st.eligible ? '' : ' is-ending'}`}>
          {slabs.length === 0 ? 'No slabs yet' : st.eligible ? (st.next ? `Slab ${st.slabIndex + 1} reached · ${formatInr(st.gap)} to slab ${st.slabIndex + 2}` : `Top slab reached`) : `${formatInr(st.gap)} to the target of ${formatInr(st.target)}`}
        </span>
      </div>
    </div>
  )
}

/** The deals counted (FR-ELG-03's breakdown): deal, customer, products, closed on, value, the total under a double rule. */
export const CountedLedger: React.FC<{ deals: CountedDeal[]; href?: (dealId: string) => string; label: string }> = ({ deals, href, label }) => (
  <div className="filed ledger counted">
    <span className="ftab label">{label}</span>
    <div className="table-wrap">
      <table className="dtable">
        <thead>
          <tr>
            <th scope="col">Deal</th>
            <th scope="col">Customer</th>
            <th scope="col">Products</th>
            <th scope="col">Closed</th>
            <th scope="col" className="num">
              Order value
            </th>
          </tr>
        </thead>
        <tbody>
          {deals.map((c) => (
            <tr className="row" key={c.dealId}>
              <td className="id">
                <Pid id={c.dealId} href={href ? href(c.dealId) : undefined} />
                {c.opportunityNo ? <div className="muted">{c.opportunityNo}</div> : null}
              </td>
              <td className="title">{c.customer}</td>
              <td className="text">{c.products.join(', ') || '—'}</td>
              <td className="num">{c.closedOn ? dmy(c.closedOn) : '—'}</td>
              <td className="num">{formatInr(c.value)}</td>
            </tr>
          ))}
          {deals.length === 0 ? (
            <tr className="row">
              <td colSpan={5} className="muted">
                No won deal closed inside the scheme’s dates.
              </td>
            </tr>
          ) : null}
        </tbody>
        <tfoot>
          <tr className="sum">
            <th scope="row" colSpan={4}>
              Total
            </th>
            <td className="num">{formatInr(deals.reduce((t, c) => t + c.value, 0))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
)

/** P24 The result as filed facts (FR-ELG-03, 04): status, achieved against the target, the slab and the benefit, the gap. */
export const ResultFacts: React.FC<{ scheme: Scheme; result: EligibilityResult; status: ResultStatus }> = ({ scheme, result: r, status }) => {
  const slab = r.slabIndex >= 0 ? scheme.slabs[r.slabIndex] : null
  const next = scheme.slabs[r.slabIndex + 1]
  return (
    <dl className="meta-rows result-facts">
      <dt>Status</dt>
      <dd className="sans">
        <ResultTag status={status} />
      </dd>
      <dt>Won in the window</dt>
      <dd>{formatInr(r.achieved)}</dd>
      {r.adjustment.amount !== 0 ? (
        <>
          <dt>Adjustment</dt>
          <dd>
            {r.adjustment.amount > 0 ? '+' : ''}
            {formatInr(r.adjustment.amount)} <span className="muted sans">· {r.adjustment.reason}</span>
          </dd>
        </>
      ) : null}
      <dt>Counted value</dt>
      <dd>
        <strong>{formatInr(r.final)}</strong>
      </dd>
      <dt>Target</dt>
      <dd>{formatInr(r.target)}</dd>
      <dt>Slab reached</dt>
      <dd className="sans">{slab ? `Slab ${r.slabIndex + 1} · ${slab.benefit}` : 'None'}</dd>
      {slab?.amount !== null && slab?.amount !== undefined ? (
        <>
          <dt>Benefit amount</dt>
          <dd>{formatInr(slab.amount)}</dd>
        </>
      ) : null}
      <dt>{r.eligible ? (next ? 'To the next slab' : 'Gap') : 'Gap to the target'}</dt>
      <dd className={r.eligible ? undefined : 'is-ending'}>{r.eligible && !next ? 'Top slab reached' : formatInr(r.gap)}</dd>
      <dt>Deals counted</dt>
      <dd>{String(r.dealsCounted.length).padStart(2, '0')}</dd>
    </dl>
  )
}

/** The partner's listing (FR-SCH-02): one filed ledger per group, each scheme a row with its dates, who it is for, the
    organisation's standing and the one action. */
export const SchemeLedger: React.FC<{ groups: { group: 'open' | 'running' | 'closed'; rows: SchemeRow[] }[]; href: (sc: Scheme) => string }> = ({ groups, href }) => (
  <div className="library sch-list">
    {groups.map((g) => (
      <section className="filed ledger" key={g.group} aria-labelledby={`sch-${g.group}`}>
        <span className="ftab label" id={`sch-${g.group}`}>
          {GROUP_LABEL[g.group]} <span className="muted">· {String(g.rows.length).padStart(2, '0')}</span>
        </span>
        <div className="table-wrap">
          <table className="dtable sch-table">
            <thead>
              <tr>
                <th scope="col">Scheme</th>
                <th scope="col">Runs</th>
                <th scope="col">{g.group === 'open' ? 'Register by' : g.group === 'running' ? 'Ends' : 'Ended'}</th>
                <th scope="col">Target</th>
                <th scope="col">Your standing</th>
                <th scope="col" className="num">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {g.rows.map(({ scheme: sc, registration: reg, result }) => (
                <tr className="row" key={sc.id}>
                  <td className="title">
                    <Link href={href(sc)}>{sc.name}</Link>
                    {sc.description ? <div className="muted lib-desc">{sc.description}</div> : null}
                  </td>
                  <td className="num">
                    {dmy(sc.startDate)} – {dmy(sc.endDate)}
                  </td>
                  <td className="num">{dmy(g.group === 'open' ? sc.registrationDeadline : sc.endDate)}</td>
                  <td className="num">{sc.slabs[0] ? formatInr(sc.slabs[0].threshold) : '—'}</td>
                  <td className="status">
                    {result ? <ResultTag status={result.dispute.status === 'open' ? 'review' : result.eligible ? 'eligible' : 'notEligible'} /> : g.group === 'closed' && reg?.status === 'approved' ? <ResultTag status="review" /> : <RegistrationTag status={reg?.status ?? null} />}
                  </td>
                  <td className="num lib-act">
                    <Link className="btn btn-line btn-sm" href={result ? `${href(sc)}/eligibility` : href(sc)}>
                      {result ? 'Result' : g.group === 'open' && (!reg || reg.status === 'declined') ? 'Register' : 'Open'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    ))}
  </div>
)

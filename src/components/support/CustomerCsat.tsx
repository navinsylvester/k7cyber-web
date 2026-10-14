import Link from 'next/link'
import React from 'react'

import { clearFlagAction, setFlagAction } from '@/app/(portal)/support/workspace/customers/care-actions'
import { CARE_LABEL, type Care, type CareFlag, type CsatRow, type CsatSettings } from '@/lib/support/csat-model'
import { dmy, dmyHm } from '@/lib/support/format'

import { CareTag, FollowUpTag, ScoreTag } from './Csat'
import { Empty, Field, Tid } from './Parts'
import { WS } from './WorkspaceBar'

/* The customer's satisfaction history on a contact or account page, and the care-flag panel managers use (09-portal-guide.md §4d). */

export const CsatHistory: React.FC<{ care: Care; ratings: CsatRow[]; settings: CsatSettings; readings: Map<string, { status: CsatRow['followUp']; reading: Parameters<typeof FollowUpTag>[0]['reading'] }> }> = ({ care, ratings, settings, readings }) => (
  <div id="csat" style={{ marginTop: 40 }}>
    <h2 className="sub-head">
      Satisfaction <span className="label">{ratings.length === 0 ? 'no ratings' : ratings.length === 1 ? '1 rating' : `${ratings.length} ratings`}</span>
    </h2>
    {care.level !== 'none' && (
      <p className="care-band" style={{ margin: '0 0 16px' }}>
        <CareTag care={care} />
        <span className="care-why">{care.reason}</span>
        {care.average !== null && care.n > 1 && <span className="label muted">avg {care.average} over {care.n}</span>}
      </p>
    )}
    {ratings.length === 0 ? (
      <Empty label="No ratings">This customer has not rated a case yet. Surveys go out when a case is resolved.</Empty>
    ) : (
      <div className="mini-rows ratings">
        {ratings.map((r) => {
          const f = readings.get(r.id)
          return (
            <div className="mini-row" key={r.id}>
              <span className="t">
                <ScoreTag score={r.score} settings={settings} />
                <Tid ticket={r.ticket} href={`${WS}/cases/${r.caseId}`} />
                <span style={{ fontWeight: 400 }}>{r.title}</span>
              </span>
              <span className="s">
                {r.comment ? `“${r.comment}” · ` : ''}
                {r.ownerName ? `${r.ownerName} · ` : ''}
                {dmyHm(r.respondedAt)}
                {f && r.followUp !== 'none' ? (
                  <>
                    {' · '}
                    <FollowUpTag status={f.status} reading={f.reading} />
                  </>
                ) : null}
              </span>
              <span className="r">{r.source === 'agent' ? 'by phone' : r.source === 'email' ? 'email' : 'portal'}</span>
            </div>
          )
        })}
      </div>
    )}
  </div>
)

export const CareFlagPanel: React.FC<{ manager: boolean; customerId: string; customerName: string; customerKind: 'account' | 'contact'; care: Care; history: CareFlag[]; returnTo: string }> = ({ manager, customerId, customerName, customerKind, care, history, returnTo }) => {
  const flag = care.flag
  return (
    <details open={Boolean(flag)} id="care-flag">
      <summary>Care flag</summary>
      <div className="act-body">
        {flag ? (
          <>
            <p>
              <CareTag care={care} /> set by {flag.setBy || 'a manager'} on {dmy(flag.setAt)}
              {flag.until ? `, until ${dmy(flag.until)}` : ''}.
            </p>
            {flag.reason && <p style={{ color: 'var(--fg)', fontSize: 15 }}>&ldquo;{flag.reason}&rdquo;</p>}
          </>
        ) : (
          <p>{manager ? 'Mark this customer so every agent handles their cases with extra care, with the reason they will read.' : 'No manager flag. The band beside the name, if any, comes from recent ratings.'}</p>
        )}
        {manager && (
          <>
            <form action={setFlagAction} className="act-body" style={{ padding: 0 }}>
              <input type="hidden" name="customerId" value={customerId} />
              <input type="hidden" name="customerName" value={customerName} />
              <input type="hidden" name="customerKind" value={customerKind} />
              <input type="hidden" name="return" value={returnTo} />
              <div className="seg-choice" role="radiogroup" aria-label="Level">
                <label>
                  <input type="radio" name="level" value="high" defaultChecked={!flag || flag.level === 'high'} />
                  {CARE_LABEL.high}
                </label>
                <label>
                  <input type="radio" name="level" value="watch" defaultChecked={flag?.level === 'watch'} />
                  {CARE_LABEL.watch}
                </label>
              </div>
              <Field id="flag-reason" label="Why, in a line agents will read" required>
                <input id="flag-reason" name="reason" required maxLength={500} defaultValue={flag?.reason ?? ''} placeholder="Escalated to the CEO last month; wants one named engineer" />
              </Field>
              <Field id="flag-days" label="Clears itself after (days)" hint="Blank keeps it until a manager clears it.">
                <input id="flag-days" name="days" inputMode="numeric" placeholder="90" />
              </Field>
              <button className="btn btn-line btn-sm" type="submit">
                {flag ? 'Update flag' : 'Flag this customer'}
              </button>
            </form>
            {flag && (
              <form action={clearFlagAction}>
                <input type="hidden" name="customerId" value={customerId} />
                <input type="hidden" name="return" value={returnTo} />
                <button className="link-u textbtn" type="submit">
                  Clear the flag
                </button>
              </form>
            )}
          </>
        )}
        {history.filter((h) => !h.active).length > 0 && (
          <details>
            <summary className="hint" style={{ cursor: 'pointer' }}>
              Earlier flags ({history.filter((h) => !h.active).length})
            </summary>
            <ul className="note-list" style={{ marginTop: 8 }}>
              {history
                .filter((h) => !h.active)
                .map((h) => (
                  <li key={h.id}>
                    {CARE_LABEL[h.level]} · {dmy(h.setAt)} by {h.setBy || 'a manager'}
                    {h.reason ? `: ${h.reason}` : ''}
                  </li>
                ))}
            </ul>
          </details>
        )}
        <Link className="link-u" href={`${WS}/manage/csat`} style={{ fontSize: 13 }}>
          CSAT report →
        </Link>
      </div>
    </details>
  )
}

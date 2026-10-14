import Link from 'next/link'
import React from 'react'

import { CARE_LABEL, FOLLOW_UP_LABEL, SCORE_WORD, SCORES, type Care, type CsatScore, type CsatSettings, type Distribution, type FollowUpReading, type FollowUpStatus } from '@/lib/support/csat-model'
import { fmtMinutes } from '@/lib/support/sla'

/* Section 09 · CSAT parts (S17–S21). The score is a tag that reads by word and weight: a low score is the one that goes signal,
   a satisfied one is solid, the middle is outlined. The care band beside a customer uses the same three weights, so an agent
   reads "handle with care" before the first line of the reply. */

/** S17 Score tag: "2/5 · Unhappy". Signal for a low score, solid for a satisfied one. */
export const ScoreTag: React.FC<{ score: CsatScore | null; settings: CsatSettings; word?: boolean; prefix?: string }> = ({ score, settings, word = true, prefix }) => {
  if (score === null) return <span className="tag tag-dashed">No rating</span>
  const low = score <= settings.unhappyAtOrBelow
  const high = score >= settings.satisfiedFrom
  return (
    <span className={`tag score${low ? ' tag-signal is-low' : high ? ' tag-solid is-high' : ''}`} title={SCORE_WORD[score]}>
      {prefix ? `${prefix} ` : ''}
      {score}/5{word ? ` · ${SCORE_WORD[score]}` : ''}
    </span>
  )
}

/** S18 Care tag: the band in a word with its mark. `mark` alone is the 8px square for ledgers and lists. */
export const CareTag: React.FC<{ care: Care | undefined | null; mark?: boolean; href?: string }> = ({ care, mark, href }) => {
  if (!care || care.level === 'none') return null
  const title = `${CARE_LABEL[care.level]}${care.reason ? `: ${care.reason}` : ''}`
  if (mark) return <i className={`care-mark is-${care.level}`} title={title} aria-label={CARE_LABEL[care.level]} />
  const inner = (
    <>
      <i aria-hidden="true" />
      {CARE_LABEL[care.level]}
    </>
  )
  return href ? (
    <Link className={`care is-${care.level}`} href={href} title={title}>
      {inner}
    </Link>
  ) : (
    <span className={`care is-${care.level}`} title={title}>
      {inner}
    </span>
  )
}

/** S19 Care band: one line under a case head that says why this customer needs extra care and where the history is. */
export const CareBand: React.FC<{ care: Care; href?: string }> = ({ care, href }) => {
  if (care.level !== 'high' && care.level !== 'watch') return null
  return (
    <div className={`care-band is-${care.level}`} role="note">
      <CareTag care={care} />
      <span className="care-why">{care.reason}</span>
      {care.n > 0 && (
        <span className="label muted">
          {care.n === 1 ? '1 rating' : `${care.n} ratings`}
          {care.average !== null && care.n > 1 ? ` · avg ${care.average}` : ''}
        </span>
      )}
      {href && (
        <Link className="label" href={href}>
          History →
        </Link>
      )}
    </div>
  )
}

/** S20 Rating scale: five radio tiles, 1 to 5, each with its word. Large on the customer's page, compact in an action panel. */
export const RateScale: React.FC<{ name?: string; selected?: CsatScore | null; compact?: boolean; required?: boolean }> = ({ name = 'score', selected, compact, required = true }) => (
  <div className={`rate${compact ? ' is-compact' : ''}`} role="radiogroup" aria-label="Your rating from 1 to 5">
    {SCORES.map((n) => (
      <label key={n}>
        <input type="radio" name={name} value={n} defaultChecked={selected === n} required={required && n === 1} />
        <span className="n">{n}</span>
        <span className="w">{SCORE_WORD[n]}</span>
      </label>
    ))}
  </div>
)

/** S21 Distribution: the five scores as horizontal bars, 5 on top, counts and shares in mono; the low rows carry signal. */
export const ScoreDistribution: React.FC<{ dist: Distribution; settings: CsatSettings }> = ({ dist, settings }) => {
  const total = SCORES.reduce((t, n) => t + dist[n], 0)
  const max = Math.max(1, ...SCORES.map((n) => dist[n]))
  return (
    <div className="dist" role="list">
      {[...SCORES].reverse().map((n) => (
        <React.Fragment key={n}>
          <span className="l" role="listitem">
            <span className="n">{n}</span> <span className="w">{SCORE_WORD[n]}</span>
          </span>
          <span>
            <span className={`b${n <= settings.unhappyAtOrBelow ? ' is-low' : n >= settings.satisfiedFrom ? ' is-high' : ''}`} style={{ width: `${Math.max(dist[n] ? 1 : 0, (dist[n] / max) * 100)}%` }} aria-hidden="true" />
          </span>
          <span className="v">
            {dist[n].toLocaleString('en-IN')}
            <span className="muted"> · {total ? Math.round((dist[n] / total) * 100) : 0}%</span>
          </span>
        </React.Fragment>
      ))}
    </div>
  )
}

/** The follow-up on a low score as a tag: to contact (signal when overdue), in hand, closed within or late. */
export const FollowUpTag: React.FC<{ status: FollowUpStatus; reading: FollowUpReading }> = ({ status, reading }) => {
  if (status === 'none') return <span className="muted">—</span>
  if (status === 'done') return <span className={`tag tag-closed${reading.state === 'late' ? ' is-missed' : ''}`} title={`Contacted after ${fmtMinutes(reading.minutes)}`}>{reading.state === 'late' ? 'Closed late' : 'Closed'}</span>
  const overdue = reading.state === 'overdue'
  return (
    <span className={`tag${overdue ? ' tag-signal' : status === 'in-progress' ? ' tag-solid' : ''}`} title={overdue ? `Waiting ${fmtMinutes(reading.minutes)}, target ${fmtMinutes(reading.minutes + reading.left)}` : `${fmtMinutes(Math.max(0, reading.left))} left`}>
      {overdue ? `Overdue ${fmtMinutes(-reading.left)}` : FOLLOW_UP_LABEL[status]}
    </span>
  )
}

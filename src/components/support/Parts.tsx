import Link from 'next/link'
import React from 'react'

import type { Row } from '@/lib/dataverse/types'
import { dmyHm, initials, relative, splitTicket } from '@/lib/support/format'
import { PRIORITY_CRITICAL } from '@/lib/support/options'
import { CUSTOMER_STATE_HINT, CUSTOMER_STATE_LABEL, TRACK, caseStatusLabel, customerState, trackIndex, type CustomerState } from '@/lib/support/status'

export { Pager, qs, SortHead } from '@/components/research/Parts'

/* Section 09 · Support parts shared by both audiences. Identifiers read the unique part first (L1), status is a Tag,
   Critical is the only signal colour on a row, and the customer's state is a four-step track. */

/** A case number: CS-431548-V1T5 with the prefix dim. */
export const Tid: React.FC<{ ticket: string; display?: boolean; href?: string }> = ({ ticket, display, href }) => {
  const { pre, id } = splitTicket(ticket)
  const inner = (
    <>
      <span className="pre">{pre}</span>
      {id}
    </>
  )
  const cls = display ? 'tid tid-display' : 'tid'
  return href ? (
    <Link className={cls} href={href}>
      {inner}
    </Link>
  ) : (
    <span className={cls}>{inner}</span>
  )
}

/** Customer-facing state as a tag: solid for the current state, signal only when it is the customer's turn. */
export const StateTag: React.FC<{ statuscode?: number | null; statecode?: number | null; state?: CustomerState }> = ({ statuscode, statecode, state }) => {
  const s = state ?? customerState(statuscode, statecode)
  const cls = s === 'waiting' ? 'tag tag-signal' : s === 'closed' || s === 'hidden' ? 'tag tag-closed' : 'tag tag-state'
  return <span className={cls}>{CUSTOMER_STATE_LABEL[s]}</span>
}

/** Agent-facing status reason with the priority mark. */
export const StatusTag: React.FC<{ row: Row; solid?: boolean }> = ({ row, solid }) => {
  const critical = row.prioritycode === PRIORITY_CRITICAL
  const resolved = row.statecode === 1 || row.statecode === 2
  return (
    <span className={`tag${solid && !resolved ? ' tag-solid' : ''}${resolved ? ' tag-closed' : ''}`}>
      {critical && <i className="crit" aria-label="Critical" />}
      {caseStatusLabel(row) || '—'}
    </span>
  )
}

export const Sla: React.FC<{ value?: number | null; label: string }> = ({ value, label }) => {
  if (!value) return null
  const cls = value === 4 || value === 2 ? ' is-breach' : value === 3 ? ' is-ok' : ''
  const text = value === 1 ? 'in progress' : value === 2 ? 'nearing breach' : value === 3 ? 'met' : 'breached'
  return (
    <span className={`sla label${cls}`}>
      <i aria-hidden="true" /> {label} {text}
    </span>
  )
}

/** The four-step track with the hint for the current step. */
export const Track: React.FC<{ statuscode?: number | null; statecode?: number | null; hint?: boolean }> = ({ statuscode, statecode, hint = true }) => {
  const s = customerState(statuscode, statecode)
  const i = trackIndex(s)
  return (
    <div>
      <ol className="track" aria-label="Progress">
        {TRACK.map((t, n) => (
          <li key={t.key} className={n < i ? 'is-done' : n === i ? 'is-now' : undefined} {...(n === i ? { 'aria-current': 'step' as const } : {})}>
            <i aria-hidden="true" />
            <span className="label">{t.label}</span>
          </li>
        ))}
      </ol>
      {hint && <p className="track-hint">{CUSTOMER_STATE_HINT[s]}</p>}
    </div>
  )
}

export const Flash: React.FC<{ kind?: 'ok' | 'error'; children: React.ReactNode }> = ({ kind = 'ok', children }) => (
  <div className={`flash is-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
    <i className="pixel" aria-hidden="true" />
    <p>{children}</p>
  </div>
)

export const Empty: React.FC<{ label?: string; children: React.ReactNode; action?: React.ReactNode }> = ({ label, children, action }) => (
  <div className="empty">
    {label && <span className="label">{label}</span>}
    <p>{children}</p>
    {action}
  </div>
)

export const Avatar: React.FC<{ name: string; large?: boolean }> = ({ name, large }) => (
  <span className={`avatar${large ? ' avatar-l' : ''}`} aria-hidden="true">
    {initials(name || '?')}
  </span>
)

/** A definition list in the meta-rows shape; mono values unless `sans`. */
export const MetaRows: React.FC<{ items: { k: string; v: React.ReactNode; sans?: boolean }[]; className?: string }> = ({ items, className = '' }) => (
  <dl className={`meta-rows label ${className}`}>
    {items
      .filter((i) => i.v !== null && i.v !== undefined && i.v !== '')
      .map((i) => (
        <React.Fragment key={i.k}>
          <dt>{i.k}</dt>
          <dd className={i.sans ? 'sans' : undefined}>{i.v}</dd>
        </React.Fragment>
      ))}
  </dl>
)

export const When: React.FC<{ date?: string | null; exact?: boolean }> = ({ date, exact }) => {
  if (!date) return null
  return (
    <time dateTime={date} title={dmyHm(date)}>
      {exact ? dmyHm(date) : relative(date)}
    </time>
  )
}

/** A compact head for workspace and customer pages: title left, actions right. */
export const PageHead: React.FC<{ title: React.ReactNode; lede?: React.ReactNode; actions?: React.ReactNode; above?: React.ReactNode }> = ({ title, lede, actions, above }) => (
  <div className="ws-head">
    <div className="ws-head-main">
      {above}
      <h1 className="h-util">{title}</h1>
      {lede && <p className="lede">{lede}</p>}
    </div>
    {actions && <div className="ws-actions">{actions}</div>}
  </div>
)

export const Crumbs: React.FC<{ items: { label: string; href?: string }[] }> = ({ items }) => (
  <nav aria-label="Breadcrumb">
    <ol className="crumbs label" style={{ marginBottom: 0 }}>
      {items.map((c, i) => (
        <li key={i}>{c.href ? <Link href={c.href}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}</li>
      ))}
    </ol>
  </nav>
)

/** Field helpers in the Field shape: label in mono, underline control. */
export const Field: React.FC<{ id: string; label: string; required?: boolean; hint?: string; error?: string; span?: boolean; children: React.ReactNode; select?: boolean }> = ({ id, label, required, hint, error, span, children, select }) => (
  <div className={`field${span ? ' span-2' : ''}${error ? ' is-invalid' : ''}`}>
    <label className="label" htmlFor={id}>
      {label}
      {required ? <Req /> : null}
    </label>
    <span className={`control${select ? ' is-select' : ''}`}>{children}</span>
    {hint && !error && <span className="hint">{hint}</span>}
    {error && <span className="field-error">{error}</span>}
  </div>
)

/** The required mark after a label: an asterisk in the accent (Field README; 13-tester-round-1.md, TR-14). The input's own
    `required` attribute is what assistive technology announces, so the mark is hidden from it. */
export const Req: React.FC = () => (
  <span className="req" aria-hidden="true">
    {' *'}
  </span>
)

/** Said once above a form that has required fields. */
export const RequiredNote: React.FC = () => (
  <p className="req-note label">
    Fields marked <span className="req">*</span> are mandatory.
  </p>
)

export const Options: React.FC<{ items: { value: string | number; label: string }[]; empty?: string }> = ({ items, empty }) => (
  <>
    {empty !== undefined && <option value="">{empty}</option>}
    {items.map((o) => (
      <option value={o.value} key={o.value}>
        {o.label}
      </option>
    ))}
  </>
)

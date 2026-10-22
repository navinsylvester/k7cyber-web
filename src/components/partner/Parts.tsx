import Link from 'next/link'
import React from 'react'

import { PARTNER_ROLE_LABEL, PARTNER_TYPE_LABEL, STAFF_ROLE_LABEL, type PartnerRole, type PartnerType, type StaffRole } from '@/lib/partner/settings-model'
import { APPLICATION_STATUS_LABEL, type ApplicationStatus } from '@/lib/partner/status'
import type { PartnerOrg } from '@/lib/partner/users'
import { dmyHm, relative } from '@/lib/support/format'

export { Empty, Field, Flash, Options } from '@/components/support/Parts'

/* Section 10 · Partners (design-system/components/PartnerParts/README.md): the identifier reads the unique part first, status is a
   Tag, the organisation's facts sit on a strip, and the bell counts in a block. Everything else comes from sections 01–09. */

/** P1 Partner ID: K7P-00001 with the prefix dim. */
export const Pid: React.FC<{ id: string; display?: boolean; href?: string }> = ({ id, display, href }) => {
  const m = id.match(/^([A-Z0-9]+-)(.+)$/)
  const inner = m ? (
    <>
      <span className="pre">{m[1]}</span>
      {m[2]}
    </>
  ) : (
    id
  )
  const cls = display ? 'pid tid tid-display' : 'pid tid'
  return href ? (
    <Link className={cls} href={href}>
      {inner}
    </Link>
  ) : (
    <span className={cls}>{inner}</span>
  )
}

/** P2 Organisation state: Approved solid, Suspended on signal (the one state that stops the partner). */
export const OrgStateTag: React.FC<{ status: PartnerOrg['status'] }> = ({ status }) => <span className={status === 'suspended' ? 'tag tag-signal' : 'tag tag-state'}>{status === 'suspended' ? 'Suspended' : 'Approved'}</span>

export const TypeTag: React.FC<{ type: PartnerType }> = ({ type }) => <span className="tag">{PARTNER_TYPE_LABEL[type]}</span>

/** P5 Roles as outlined tags; a role someone must hold to act is not a state, so nothing here inverts. */
export const RoleTags: React.FC<{ roles: PartnerRole[] }> = ({ roles }) => (
  <span className="roles">
    {roles.length ? roles.map((r) => <span key={r} className="tag">{PARTNER_ROLE_LABEL[r]}</span>) : <span className="tag tag-dashed">No role</span>}
  </span>
)

export const StaffRoleTags: React.FC<{ roles: StaffRole[] }> = ({ roles }) => (
  <span className="roles">
    {roles.length ? roles.map((r) => <span key={r} className="tag">{STAFF_ROLE_LABEL[r]}</span>) : <span className="tag tag-dashed">No partner-portal role</span>}
  </span>
)

/** P3 Status strip: the organisation's facts in a row on hairlines, read before anything else on the home page. */
export const Strip: React.FC<{ items: { label: string; value: React.ReactNode }[] }> = ({ items }) => (
  <dl className="pstrip">
    {items.map((it) => (
      <div key={it.label}>
        <dt className="label">{it.label}</dt>
        <dd>{it.value}</dd>
      </div>
    ))}
  </dl>
)

/** P4 The bell: a text link with the unread count as a block; signal only while something is unread. */
export const Bell: React.FC<{ href: string; unread: number }> = ({ href, unread }) => (
  <Link className="bell" href={href} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
    <span>Notifications</span>
    {unread > 0 && <span className="bell-n">{unread > 99 ? '99+' : String(unread).padStart(2, '0')}</span>}
  </Link>
)

/** P4 Notification rows: time in mono, the subject, the body; unread rows carry the pixel. */
export const NotificationList: React.FC<{ rows: { id: string; at: string; subject: string; body: string; href: string; readAt: string | null }[] }> = ({ rows }) => (
  <ol className="ntf">
    {rows.map((r) => (
      <li key={r.id} className={r.readAt ? undefined : 'is-unread'}>
        <span className="ntf-when" title={dmyHm(r.at)}>
          {relative(r.at)}
        </span>
        <div className="ntf-body">
          <strong>
            {!r.readAt && <i className="pixel" aria-label="Unread" />}
            {r.href ? <Link href={r.href}>{r.subject}</Link> : r.subject}
          </strong>
          {r.body && <p>{r.body}</p>}
        </div>
      </li>
    ))}
  </ol>
)

/* ---------- M2: applications ---------- */

/** P8 Application state: one Tag; signal only where someone must act now (the K7 queue: Submitted; the applicant: Clarification). */
export const AppStateTag: React.FC<{ status: ApplicationStatus; audience?: 'applicant' | 'k7' }> = ({ status, audience = 'k7' }) => {
  const signal = audience === 'k7' ? status === 'submitted' : status === 'clarification'
  const closed = status === 'approved' || status === 'rejected'
  const cls = signal ? 'tag tag-signal' : status === 'approved' ? 'tag tag-solid' : closed ? 'tag tag-closed' : status === 'draft' ? 'tag tag-quiet' : 'tag tag-state'
  return <span className={cls}>{APPLICATION_STATUS_LABEL[status]}</span>
}

/** The mobile's verification state: by SMS, or skipped because no gateway exists (decision 4), which the Channel Manager sees. */
export const MobileVerifiedTag: React.FC<{ contact: { mobileVerifiedAt: string | null; mobileVerification: 'none' | 'sms' | 'skipped' } }> = ({ contact }) =>
  contact.mobileVerification === 'sms' && contact.mobileVerifiedAt ? <span className="tag tag-solid">Verified by SMS</span> : contact.mobileVerification === 'skipped' ? <span className="tag tag-quiet" title="No SMS gateway is configured; the number is as given.">Not verified · no SMS gateway</span> : <span className="tag tag-quiet">Not verified</span>

/** The application number, K7A-00001, in the P1 shape. */
export const Aid: React.FC<{ number: string; href?: string; display?: boolean }> = ({ number, href, display }) => <Pid id={number || 'K7A-—'} href={href} display={display} />

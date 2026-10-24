import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

import { Field, Flash, RoleTags, Strip, UserStateTag } from '@/components/partner/Parts'
import { Crumbs } from '@/components/support/Parts'
import { objectAudit } from '@/lib/partner/audit'
import { listMembers, loadMember, PARTNER_USERS } from '@/lib/partner/members'
import { PARTNER_ORG } from '@/lib/partner/organisation'
import { memberChangeError, memberRemoveError } from '@/lib/partner/organisation-model'
import { requirePartnerRole } from '@/lib/partner/session'
import { PARTNER_ROLE_LABEL, PARTNER_ROLES } from '@/lib/partner/settings'
import { dmy, dmyHm, relative } from '@/lib/support/format'

import { removeMemberAction, resendInvitationAction, setMemberStatusAction, updateMemberAction } from '../actions'

export const metadata: Metadata = { title: 'User' }

/* One person for the Partner Admin (M3): the facts, the form (name, designation, mobile, roles), and the levers the rules allow
   (disable or re-enable, resend the invitation, remove). The id is read through the organisation scope: another organisation's
   user is a 404, not a page. */
export default async function MemberPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const me = await requirePartnerRole(['admin'], `${PARTNER_USERS}/${id}`)
  const user = await loadMember(me.scope, id)
  if (!user) notFound()
  const [members, trail] = await Promise.all([listMembers(me.scope), objectAudit('partner-users', user.id, 20)])
  const self = user.id === me.user.id
  const disableBlocked = memberChangeError(me.user, user, { status: 'disabled' }, members)
  const removeBlocked = memberRemoveError(me.user, user, members)
  return (
    <section className="sheet ws g-paper">
      <Crumbs items={[{ label: 'Organisation', href: PARTNER_ORG }, { label: 'Users', href: PARTNER_USERS }, { label: user.name }]} />
      <div className="ws-head" style={{ marginTop: 16 }}>
        <div className="ws-head-main">
          <span className="label muted">{user.email}</span>
          <h1 className="h-util">
            {user.name}
            {self ? ' (you)' : ''}.
          </h1>
          <p className="lede">{user.designation ? `${user.designation} at ` : 'At '}{me.org.tradeName || me.org.name}.</p>
        </div>
      </div>
      {sp.ok && <Flash>{sp.ok}</Flash>}
      {sp.error && <Flash kind="error">{sp.error}</Flash>}
      <Strip
        items={[
          { label: 'Status', value: <UserStateTag status={user.status} /> },
          { label: 'Roles', value: <RoleTags roles={user.roles} /> },
          { label: 'Last sign-in', value: user.lastSignInAt ? relative(user.lastSignInAt) : 'Never' },
          { label: 'Invited', value: user.invitedAt ? dmy(user.invitedAt) : user.createdAt ? dmy(user.createdAt) : '—' },
        ]}
      />
      <div className="phome">
        <div>
          <h2 className="sub-head">Details and roles</h2>
          <form action={updateMemberAction} className="form-grid">
            <input type="hidden" name="id" value={user.id} />
            <Field id="name" label="Name" required>
              <input id="name" name="name" type="text" defaultValue={user.name} required />
            </Field>
            <Field id="designation" label="Designation">
              <input id="designation" name="designation" type="text" defaultValue={user.designation} />
            </Field>
            <Field id="mobile" label="Mobile" hint="Optional.">
              <input id="mobile" name="mobile" type="tel" inputMode="tel" defaultValue={user.mobile} />
            </Field>
            <Field id="email" label="Work email" hint="The sign-in identity; it does not change. Remove the user and add the new address instead.">
              <input id="email" type="email" defaultValue={user.email} disabled />
            </Field>
            <fieldset className="field span-2" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="label" style={{ marginBottom: 10 }}>
                Roles *
              </legend>
              <div className="checks">
                {PARTNER_ROLES.map((r) => (
                  <label className="check" key={r}>
                    <input type="checkbox" name="roles" value={r} defaultChecked={user.roles.includes(r)} />
                    <span>{PARTNER_ROLE_LABEL[r]}</span>
                  </label>
                ))}
              </div>
              {self && <span className="hint">You keep your own Partner Admin role; another admin can change it.</span>}
            </fieldset>
            <div className="form-actions span-2">
              <button className="btn btn-primary" type="submit">
                Save →
              </button>
            </div>
          </form>

          {trail.length > 0 && (
            <>
              <h2 className="sub-head" style={{ marginTop: 40 }}>
                Record
              </h2>
              <ol className="ntf">
                {trail.map((t) => (
                  <li key={t.id}>
                    <span className="ntf-when" title={dmyHm(t.at)}>
                      {dmy(t.at)}
                    </span>
                    <div className="ntf-body">
                      <strong>{t.action.replace(/^user\./, '').replace(/[.-]/g, ' ')}</strong>
                      <p>
                        {t.actor.name || t.actor.email || 'Portal'}
                        {t.from || t.to ? ` · ${t.from || '—'} → ${t.to || '—'}` : ''}
                        {t.comment ? ` · ${t.comment}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
        <aside className="ws-side">
          <div className="decide">
            <h2>Access</h2>
            {user.status === 'invited' && (
              <form action={resendInvitationAction} style={{ marginBottom: 16 }}>
                <input type="hidden" name="id" value={user.id} />
                <p className="hint" style={{ margin: '0 0 10px' }}>
                  They have not signed in yet.
                </p>
                <button className="btn btn-line btn-sm" type="submit">
                  Resend the invitation
                </button>
              </form>
            )}
            <form action={setMemberStatusAction}>
              <input type="hidden" name="id" value={user.id} />
              <input type="hidden" name="action" value={user.status === 'disabled' ? 'enable' : 'disable'} />
              <p className="hint" style={{ margin: '0 0 10px' }}>
                {user.status === 'disabled' ? 'Disabled: the door refuses their code. Re-enabling restores them as they were.' : disableBlocked ? disableBlocked : 'Disabling keeps the row and its record; they cannot sign in and any open session ends.'}
              </p>
              <button className="btn btn-line btn-sm" type="submit" disabled={user.status !== 'disabled' && Boolean(disableBlocked)}>
                {user.status === 'disabled' ? 'Re-enable' : 'Disable'}
              </button>
            </form>
          </div>
          <div>
            <h2>Remove</h2>
            {removeBlocked ? (
              <p className="hint" style={{ margin: 0 }}>
                {removeBlocked}
              </p>
            ) : (
              <form action={removeMemberAction} className="form-grid" style={{ gap: 12 }}>
                <input type="hidden" name="id" value={user.id} />
                <label className="check span-2" style={{ fontSize: 14 }}>
                  <input type="checkbox" name="confirm" value="1" />
                  <span>Remove {user.name}. They lose access at once; the record of what they did stays.</span>
                </label>
                <div className="form-actions span-2">
                  <button className="btn btn-line btn-sm" type="submit">
                    Remove this user
                  </button>
                </div>
              </form>
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}

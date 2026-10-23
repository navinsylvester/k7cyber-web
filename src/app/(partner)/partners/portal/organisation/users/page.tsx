import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { Empty, Field, Flash, RoleTags, UserStateTag } from '@/components/partner/Parts'
import { Crumbs } from '@/components/support/Parts'
import { listMembers, PARTNER_USERS } from '@/lib/partner/members'
import { PARTNER_ORG } from '@/lib/partner/organisation'
import { requirePartnerRole } from '@/lib/partner/session'
import { PARTNER_ROLE_LABEL, PARTNER_ROLES } from '@/lib/partner/settings'
import { dmy, relative } from '@/lib/support/format'

import { addMemberAction } from './actions'

export const metadata: Metadata = { title: 'Users' }

type SP = { ok?: string; error?: string; name?: string; email?: string; designation?: string; mobile?: string }

/* The organisation's people for the Partner Admin (FR-ROLE-01, FR-ROLE-02, M3): the ledger of users with their roles and
   state, and the form that invites one more. One person may hold several roles; a disabled user keeps their row and loses the
   door. Every row is the organisation's own (`listMembers` reads through the scope). */
export default async function UsersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const me = await requirePartnerRole(['admin'], PARTNER_USERS)
  const members = await listMembers(me.scope)
  const standing = members.filter((m) => m.status !== 'disabled')
  return (
    <section className="sheet ws g-paper">
      <Crumbs items={[{ label: 'Organisation', href: PARTNER_ORG }, { label: 'Users' }]} />
      <div className="ws-head" style={{ marginTop: 16 }}>
        <div className="ws-head-main">
          <span className="label muted">
            {String(standing.length).padStart(2, '0')} active or invited · {String(members.length - standing.length).padStart(2, '0')} disabled
          </span>
          <h1 className="h-util">Who signs in for {me.org.tradeName || me.org.name}.</h1>
          <p className="lede">Each person signs in with their own email and a one-time code. Give them the roles they need; one person may hold several. The organisation always keeps at least one Partner Admin.</p>
        </div>
      </div>
      {sp.ok && <Flash>{sp.ok}</Flash>}
      {sp.error && <Flash kind="error">{sp.error}</Flash>}
      <div className="phome">
        <div>
          {members.length === 0 ? (
            <Empty label="No users">Nobody yet; add the first person beside.</Empty>
          ) : (
            <div className="filed ledger members">
              <span className="ftab label">
                {members.length} user{members.length === 1 ? '' : 's'}
              </span>
              <div className="table-wrap">
                <table className="dtable">
                  <thead>
                    <tr>
                      <th scope="col">Person</th>
                      <th scope="col">Roles</th>
                      <th scope="col">Status</th>
                      <th scope="col">Last sign-in</th>
                      <th scope="col">Since</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr className={`row${m.status === 'disabled' ? ' is-off' : ''}`} key={m.id}>
                        <td className="title who">
                          <Link href={`${PARTNER_USERS}/${m.id}`}>
                            {m.name}
                            {m.id === me.user.id ? ' (you)' : ''}
                          </Link>
                          <div className="muted">
                            {m.email}
                            {m.designation ? ` · ${m.designation}` : ''}
                          </div>
                        </td>
                        <td className="status">
                          <RoleTags roles={m.roles} />
                        </td>
                        <td className="status">
                          <UserStateTag status={m.status} />
                        </td>
                        <td className="text" title={m.lastSignInAt ?? ''}>
                          {m.lastSignInAt ? relative(m.lastSignInAt) : <span className="muted">Never</span>}
                        </td>
                        <td className="num">{m.invitedAt ? dmy(m.invitedAt) : m.createdAt ? dmy(m.createdAt) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <aside className="ws-side">
          <div className="decide">
            <h2>Add a person</h2>
            <p className="hint" style={{ margin: '0 0 16px' }}>
              They get an email with the sign-in address; the first code activates them. The email must be new to the portal.
            </p>
            <form action={addMemberAction} className="form-grid" style={{ gap: 16 }}>
              <Field id="name" label="Name" required span>
                <input id="name" name="name" type="text" defaultValue={sp.name ?? ''} required autoComplete="off" />
              </Field>
              <Field id="email" label="Work email" required span>
                <input id="email" name="email" type="email" inputMode="email" defaultValue={sp.email ?? ''} required autoComplete="off" />
              </Field>
              <Field id="designation" label="Designation" span>
                <input id="designation" name="designation" type="text" defaultValue={sp.designation ?? ''} />
              </Field>
              <Field id="mobile" label="Mobile" span hint="Optional.">
                <input id="mobile" name="mobile" type="tel" inputMode="tel" defaultValue={sp.mobile ?? ''} />
              </Field>
              <fieldset className="field span-2" style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="label" style={{ color: 'var(--mu)', marginBottom: 10 }}>
                  Roles *
                </legend>
                <div className="checks" style={{ gridTemplateColumns: '1fr' }}>
                  {PARTNER_ROLES.map((r) => (
                    <label className="check" key={r}>
                      <input type="checkbox" name="roles" value={r} defaultChecked={r === 'sales'} />
                      <span>
                        {PARTNER_ROLE_LABEL[r]}
                        <span className="hint"> · {r === 'admin' ? 'the organisation, its users, deals and schemes' : r === 'sales' ? 'registers and sees own deals, sales training' : 'sees deals, technical training'}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="form-actions span-2">
                <button className="btn btn-primary" type="submit">
                  Invite →
                </button>
              </div>
            </form>
          </div>
        </aside>
      </div>
    </section>
  )
}

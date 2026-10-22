import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { K7Nav } from '@/components/partner/K7Nav'
import { Field, Flash, LegalChanges, OrgStateTag, Pid, RoleTags, Strip, TypeTag, UserStateTag } from '@/components/partner/Parts'
import { Crumbs } from '@/components/support/Parts'
import { orgAudit } from '@/lib/partner/audit'
import { listMembers } from '@/lib/partner/members'
import { outboxOf } from '@/lib/partner/mirror'
import { findOrgByPartnerId, K7_PARTNERS } from '@/lib/partner/organisation'
import { legalChanges } from '@/lib/partner/organisation-model'
import { K7_APPLICATIONS, loadApplication } from '@/lib/partner/registration'
import { requireK7Role } from '@/lib/partner/session'
import { getPartnerSettings } from '@/lib/partner/settings'
import { dmy, dmyHm, relative } from '@/lib/support/format'

import { decideLegalEditAction, setOrgStatusAction, setWaiverAction } from '../actions'

export const metadata: Metadata = { title: 'Partner' }

const Row: React.FC<{ k: string; v: React.ReactNode; sans?: boolean }> = ({ k, v, sans = true }) => (
  <>
    <dt>{k}</dt>
    <dd className={sans ? 'sans' : undefined}>{v || '—'}</dd>
  </>
)

/* One organisation for the Channel Manager (M3): the filed identity and details, the legal-identity edit waiting (approve or
   decline with a note, FR-REG-07), the people, the record; in the side column suspension and reinstatement with a reason, the
   certificate waiver (decision 8), the application it came from and the CRM account. The organisation's own scope is used for
   its people and its trail, the same reads the partner side makes. */
export default async function K7PartnerPage({ params, searchParams }: { params: Promise<{ partnerId: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [{ partnerId }, sp] = await Promise.all([params, searchParams])
  const me = await requireK7Role(['channelManager'], `${K7_PARTNERS}/${partnerId}`)
  const org = await findOrgByPartnerId(partnerId)
  if (!org) notFound()
  const scope = { orgId: org.id }
  const [settings, members, trail, jobs, app] = await Promise.all([getPartnerSettings(), listMembers(scope), orgAudit(scope, 30), outboxOf('partner-orgs', org.id), org.applicationId ? loadApplication(org.applicationId) : Promise.resolve(null)])
  const regions = settings.regions.filter((r) => org.regions.includes(r.code)).map((r) => r.name)
  const edit = org.pendingLegalEdit
  const changes = edit ? legalChanges(org, edit) : []
  const job = jobs[0]
  const admins = members.filter((m) => m.status !== 'disabled' && m.roles.includes('admin'))
  return (
    <>
      <K7Nav active="partners" roles={me.roles} />
      <section className="sheet ws g-paper">
        <Crumbs items={[{ label: 'Partners', href: K7_PARTNERS }, { label: org.partnerId }]} />
        <div className="ws-head" style={{ marginTop: 16 }}>
          <div className="ws-head-main">
            <Pid id={org.partnerId} display />
            <h1 className="h-util">{org.name}.</h1>
            <p className="lede">
              {org.tradeName && org.tradeName !== org.name ? `${org.tradeName}, ` : ''}
              {org.city}
              {org.city && org.country ? ', ' : ''}
              {org.country}. In the programme since {org.createdAt ? dmy(org.createdAt) : '—'}
              {admins.length ? `; Partner Admin ${admins.map((a) => a.name).join(', ')}` : '; no standing Partner Admin'}.
            </p>
          </div>
        </div>
        {sp.ok && <Flash>{sp.ok}</Flash>}
        {sp.error && <Flash kind="error">{sp.error}</Flash>}
        <Strip
          items={[
            { label: 'Status', value: <OrgStateTag status={org.status} /> },
            { label: 'Type', value: <TypeTag type={org.type} /> },
            { label: 'Users', value: `${String(members.filter((m) => m.status !== 'disabled').length).padStart(2, '0')} active or invited` },
            { label: 'Certificate', value: org.certificate.status === 'valid' ? `Valid${org.certificate.until ? ` to ${dmy(org.certificate.until)}` : ''}` : org.waiverUntil ? `Waived to ${dmy(org.waiverUntil)}` : settings.deals.requireCertificate ? 'None (gate on)' : 'None (gate off)' },
            { label: 'CRM account', value: org.crm.accountCode || (job ? job.state : '—') },
          ]}
        />
        {org.status === 'suspended' && (
          <Flash kind="error">
            Suspended {org.suspendedAt ? dmyHm(org.suspendedAt) : ''}: {org.suspendedReason || 'no reason recorded'}.
          </Flash>
        )}
        <div className="phome">
          <div>
            {edit && (
              <div className="pending" style={{ marginBottom: 'clamp(28px, 3cqw, 40px)' }}>
                <h2>
                  <i className="pixel" aria-hidden="true" /> Legal identity edit to decide
                </h2>
                <p className="hint" style={{ margin: 0 }}>
                  Proposed by {edit.proposedBy.name || edit.proposedBy.email} on {dmyHm(edit.proposedAt)}. Reason: {edit.reason}
                </p>
                <LegalChanges changes={changes} />
                <form action={decideLegalEditAction} className="form-grid" style={{ gap: 16 }}>
                  <input type="hidden" name="partnerId" value={org.partnerId} />
                  <fieldset className="field span-2" style={{ border: 0, padding: 0, margin: 0 }}>
                    <legend className="label" style={{ color: 'var(--mu)', marginBottom: 10 }}>
                      Decision
                    </legend>
                    <div className="choice">
                      <label>
                        <input type="radio" name="decision" value="approve" defaultChecked required />
                        <span className="t">Approve</span>
                        <span className="d">The organisation carries the new identity; the partner ID stays. The CRM account is not renamed by the portal.</span>
                      </label>
                      <label>
                        <input type="radio" name="decision" value="decline" required />
                        <span className="t">Decline</span>
                        <span className="d">Nothing changes; the admins read your reason and may propose again.</span>
                      </label>
                    </div>
                  </fieldset>
                  <Field id="note" label="Note to the Partner Admins" span hint="Required to decline; optional on approval.">
                    <textarea id="note" name="note" rows={3} />
                  </Field>
                  <div className="form-actions span-2">
                    <button className="btn btn-primary" type="submit">
                      Record the decision →
                    </button>
                  </div>
                </form>
              </div>
            )}
            <div className="app-summary">
              <div>
                <h2 className="sub-head">Legal identity</h2>
                <dl className="meta-rows label">
                  <Row k="Legal name" v={org.name} />
                  <Row k="GSTIN" v={org.gstin} sans={false} />
                  <Row k="PAN" v={org.pan} sans={false} />
                  <Row k="Type" v={<TypeTag type={org.type} />} />
                  {app && <Row k="Application" v={<Link href={`${K7_APPLICATIONS}/${app.number}`}>{app.number}</Link>} sans={false} />}
                </dl>
              </div>
              <div>
                <h2 className="sub-head">Details</h2>
                <dl className="meta-rows label">
                  <Row k="Trade name" v={org.tradeName} />
                  <Row k="Registered address" v={org.address ? `${org.address}, ${org.city}, ${org.state} ${org.pin}, ${org.country}` : ''} />
                  <Row k="Website" v={org.website ? <a href={org.website} rel="noreferrer" target="_blank">{org.website.replace(/^https?:\/\//, '')}</a> : ''} />
                  <Row k="K7 regions" v={regions.join(', ')} />
                </dl>
              </div>
            </div>

            <h2 className="sub-head" style={{ marginTop: 40 }}>
              People
            </h2>
            {members.length ? (
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
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => (
                        <tr className={`row${m.status === 'disabled' ? ' is-off' : ''}`} key={m.id}>
                          <td className="title who">
                            {m.name}
                            <div className="muted">
                              {m.email}
                              {m.designation ? ` · ${m.designation}` : ''}
                              {m.mobile ? ` · ${m.mobile}` : ''}
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="hint">No users. The Partner Admin row was removed; the organisation cannot sign in.</p>
            )}

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
                        <strong>{t.action.replace(/^(org|user|application|crm)\./, '').replace(/[.-]/g, ' ')}</strong>
                        <p>
                          {t.objectLabel && t.object !== 'partner-orgs' ? `${t.objectLabel} · ` : ''}
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
              <h2>{org.status === 'suspended' ? 'Reinstate' : 'Suspend'}</h2>
              <p className="hint" style={{ margin: '0 0 16px' }}>
                {org.status === 'suspended' ? 'Every user can sign in again and is told by email.' : 'Every user is refused at the door, told by email with your reason, and any open session ends on its next request. Deals and the record are kept.'}
              </p>
              <form action={setOrgStatusAction} className="form-grid" style={{ gap: 16 }}>
                <input type="hidden" name="partnerId" value={org.partnerId} />
                <input type="hidden" name="to" value={org.status === 'suspended' ? 'approved' : 'suspended'} />
                <Field id="reason" label={org.status === 'suspended' ? 'Note to the organisation' : 'Reason'} required={org.status !== 'suspended'} span>
                  <textarea id="reason" name="reason" rows={3} required={org.status !== 'suspended'} />
                </Field>
                <div className="form-actions span-2">
                  <button className={`btn ${org.status === 'suspended' ? 'btn-primary' : 'btn-line'}`} type="submit">
                    {org.status === 'suspended' ? 'Reinstate →' : 'Suspend the organisation'}
                  </button>
                </div>
              </form>
            </div>
            <div>
              <h2>Certificate waiver</h2>
              <p className="hint" style={{ margin: '0 0 12px' }}>
                {settings.deals.requireCertificate ? 'The deal gate needs a certificate; until this date the organisation may register deals without one.' : 'The certificate gate is off in the settings; the waiver is recorded for when it is switched on.'}
                {org.waiverUntil ? ` Current: to ${dmy(org.waiverUntil)}.` : ' None set.'}
              </p>
              <form action={setWaiverAction} className="form-grid" style={{ gap: 12 }}>
                <input type="hidden" name="partnerId" value={org.partnerId} />
                <Field id="until" label="Waive until" span>
                  <input id="until" name="until" type="date" defaultValue={org.waiverUntil?.slice(0, 10) ?? ''} min={new Date().toISOString().slice(0, 10)} />
                </Field>
                <div className="form-actions span-2">
                  <button className="btn btn-line btn-sm" type="submit">
                    Set
                  </button>
                  {org.waiverUntil && (
                    <button className="link-u textbtn" type="submit" name="clear" value="1">
                      Clear the waiver
                    </button>
                  )}
                </div>
              </form>
            </div>
            <div>
              <h2>CRM</h2>
              <dl className="meta-rows label">
                <dt>Account</dt>
                <dd className="sans">{org.crm.accountCode || (job ? (job.state === 'pending' ? (settings.crm.enabled ? 'Queued' : 'Queued; the mirror is off') : job.state === 'skipped' ? `Skipped: ${job.lastError}` : job.state === 'failed' ? `Failed: ${job.lastError}` : '—') : 'No job')}</dd>
                {org.crm.accountId && (
                  <>
                    <dt>Account id</dt>
                    <dd>{org.crm.accountId}</dd>
                  </>
                )}
                {org.crm.contactId && (
                  <>
                    <dt>Contact id</dt>
                    <dd>{org.crm.contactId}</dd>
                  </>
                )}
              </dl>
              <p className="more">
                {app && (
                  <>
                    <Link className="link-u" href={`${K7_APPLICATIONS}/${app.number}`}>
                      The application and its CRM job
                    </Link>
                    {' · '}
                  </>
                )}
                <Link className="link-u" href={`/admin/collections/partner-orgs/${org.id}`}>
                  The raw row
                </Link>
              </p>
            </div>
          </aside>
        </div>
      </section>
    </>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { Field, Flash, LegalChanges, OrgStateTag, Pid, Strip, TypeTag } from '@/components/partner/Parts'
import { orgAudit } from '@/lib/partner/audit'
import { listMembers } from '@/lib/partner/members'
import { PARTNER_ORG, scopedOrg } from '@/lib/partner/organisation'
import { legalChanges } from '@/lib/partner/organisation-model'
import { requirePartner } from '@/lib/partner/session'
import { getPartnerSettings } from '@/lib/partner/settings'
import { dmy, dmyHm } from '@/lib/support/format'

import { proposeLegalAction, saveDetailsAction, withdrawLegalAction } from './actions'

export const metadata: Metadata = { title: 'Organisation' }

const Row: React.FC<{ k: string; v: React.ReactNode; sans?: boolean }> = ({ k, v, sans = true }) => (
  <>
    <dt>{k}</dt>
    <dd className={sans ? 'sans' : undefined}>{v || '—'}</dd>
  </>
)

/* The organisation's profile (02-build-plan.md §4, M3): the filed facts for every user; for the Partner Admin the details form
   (saves at once) and the legal-identity form (proposes; K7 re-approves, FR-REG-07), with the waiting proposal shown as a diff. */
export default async function OrganisationPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; tab?: string }> }) {
  const sp = await searchParams
  const me = await requirePartner(PARTNER_ORG)
  const [org, settings, members, trail] = await Promise.all([scopedOrg(me.scope).then((o) => o ?? me.org), getPartnerSettings(), listMembers(me.scope), orgAudit(me.scope, 8)])
  const admin = me.roles.includes('admin')
  const regionNames = settings.regions.filter((r) => org.regions.includes(r.code)).map((r) => r.name)
  const edit = org.pendingLegalEdit
  const changes = edit ? legalChanges(org, edit) : []
  const standing = members.filter((m) => m.status !== 'disabled').length
  return (
    <section className="sheet ws g-paper">
      <div className="ws-head">
        <div className="ws-head-main">
          <Pid id={org.partnerId} display />
          <h1 className="h-util">{org.tradeName || org.name}.</h1>
          <p className="lede">
            {admin ? 'Your organisation as K7 has it on file. Change the details here; a change to the legal name, GSTIN or PAN goes to K7 for approval first.' : 'Your organisation as K7 has it on file. Your Partner Admin can change it.'}
          </p>
        </div>
        {admin && (
          <div className="ws-actions">
            <Link className="btn btn-line" href={`${PARTNER_ORG}/users`}>
              Users →
            </Link>
          </div>
        )}
      </div>
      {sp.ok && <Flash>{sp.ok}</Flash>}
      {sp.error && <Flash kind="error">{sp.error}</Flash>}
      <Strip
        items={[
          { label: 'Partner type', value: <TypeTag type={org.type} /> },
          { label: 'Status', value: <OrgStateTag status={org.status} /> },
          { label: 'Partner since', value: org.createdAt ? dmy(org.createdAt) : '—' },
          { label: 'Users', value: admin ? <Link href={`${PARTNER_ORG}/users`}>{String(standing).padStart(2, '0')} active or invited</Link> : `${String(standing).padStart(2, '0')} active or invited` },
          { label: 'Partner certificate', value: <Link href="/partners/portal/certificates">{org.certificate.status === 'valid' ? `Valid${org.certificate.until ? ` to ${dmy(org.certificate.until)}` : ''}` : org.certificate.status === 'expired' ? 'Expired' : org.certificate.status === 'revoked' ? 'Revoked' : org.waiverUntil ? `Waived to ${dmy(org.waiverUntil)}` : 'Not yet'}</Link> },
        ]}
      />
      <div className="phome">
        <div>
          {edit && (
            <div className="pending" style={{ marginBottom: 'clamp(28px, 3cqw, 40px)' }}>
              <h2>
                <i className="pixel" aria-hidden="true" /> Legal identity change waiting for K7
              </h2>
              <p className="hint" style={{ margin: 0 }}>
                Proposed by {edit.proposedBy.name || edit.proposedBy.email} on {dmyHm(edit.proposedAt)}. Reason: {edit.reason}
              </p>
              <LegalChanges changes={changes} />
              <div className="hint" style={{ margin: 0 }}>
                Until a Channel Manager approves it, the organisation keeps its current identity below.
                {admin && (
                  <form action={withdrawLegalAction} style={{ display: 'inline', marginLeft: 6 }}>
                    <button className="link-u textbtn" type="submit">
                      Withdraw the proposal
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
          <div className="app-summary">
            <div>
              <h2 className="sub-head">Legal identity</h2>
              <dl className="meta-rows label">
                <Row k="Legal name" v={org.name} />
                <Row k="GSTIN" v={org.gstin} sans={false} />
                <Row k="PAN" v={org.pan} sans={false} />
                <Row k="Partner ID" v={<Pid id={org.partnerId} />} sans={false} />
                {org.crm.accountCode && <Row k="K7 account" v={org.crm.accountCode} sans={false} />}
              </dl>
            </div>
            <div>
              <h2 className="sub-head">Details</h2>
              <dl className="meta-rows label">
                <Row k="Trade name" v={org.tradeName} />
                <Row k="Registered address" v={org.address ? `${org.address}, ${org.city}, ${org.state} ${org.pin}, ${org.country}` : ''} />
                <Row k="Website" v={org.website ? <a href={org.website} rel="noreferrer" target="_blank">{org.website.replace(/^https?:\/\//, '')}</a> : ''} />
                <Row k="K7 regions" v={regionNames.join(', ')} />
              </dl>
            </div>
          </div>

          {admin && (
            <div className="org-forms" style={{ marginTop: 'clamp(40px, 5cqw, 64px)' }}>
              <section id="details">
                <h2 className="sub-head">Change the details</h2>
                <p className="hint">Saved at once and recorded. The legal identity is the next form.</p>
                <form action={saveDetailsAction} className="form-grid">
                  <Field id="tradeName" label="Trade name" hint="How you are known, if not the legal name.">
                    <input id="tradeName" name="tradeName" type="text" defaultValue={org.tradeName} />
                  </Field>
                  <Field id="website" label="Website">
                    <input id="website" name="website" type="text" inputMode="url" defaultValue={org.website} placeholder="example.com" />
                  </Field>
                  <Field id="address" label="Registered address" required span>
                    <input id="address" name="address" type="text" defaultValue={org.address} required />
                  </Field>
                  <Field id="city" label="City" required>
                    <input id="city" name="city" type="text" defaultValue={org.city} required />
                  </Field>
                  <Field id="state" label="State" required>
                    <input id="state" name="state" type="text" defaultValue={org.state} required />
                  </Field>
                  <Field id="country" label="Country" required>
                    <input id="country" name="country" type="text" defaultValue={org.country} required />
                  </Field>
                  <Field id="pin" label="PIN or postal code" required>
                    <input id="pin" name="pin" type="text" inputMode="numeric" defaultValue={org.pin} required />
                  </Field>
                  {settings.regions.length > 0 && (
                    <fieldset className="field span-2" style={{ border: 0, padding: 0, margin: 0 }}>
                      <legend className="label" style={{ marginBottom: 10 }}>
                        K7 regions you operate in *
                      </legend>
                      <div className="checks">
                        {settings.regions.map((r) => (
                          <label className="check" key={r.code}>
                            <input type="checkbox" name="regions" value={r.code} defaultChecked={org.regions.includes(r.code)} />
                            <span>{r.name}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )}
                  <div className="form-actions span-2">
                    <button className="btn btn-primary" type="submit">
                      Save the details →
                    </button>
                  </div>
                </form>
              </section>
              <section id="legal">
                <h2 className="sub-head">Change the legal identity</h2>
                <p className="hint">{edit ? 'A change is already waiting for K7; withdraw it above to propose another.' : 'The legal name, GSTIN and PAN need K7’s approval (a Channel Manager checks them against your registration). Nothing changes until they agree.'}</p>
                <form action={proposeLegalAction} className="form-grid">
                  <fieldset disabled={Boolean(edit)} style={{ display: 'contents' }}>
                    <Field id="name" label="Legal name" required span>
                      <input id="name" name="name" type="text" defaultValue={edit?.name ?? org.name} required />
                    </Field>
                    <Field id="gstin" label="GSTIN" hint="15 characters; blank if not registered.">
                      <input id="gstin" name="gstin" type="text" defaultValue={edit?.gstin ?? org.gstin} maxLength={15} style={{ textTransform: 'uppercase' }} />
                    </Field>
                    <Field id="pan" label="PAN" hint="10 characters.">
                      <input id="pan" name="pan" type="text" defaultValue={edit?.pan ?? org.pan} maxLength={10} style={{ textTransform: 'uppercase' }} />
                    </Field>
                    <Field id="reason" label="Why it changes" required span hint="Read by the Channel Manager: a re-registration, a correction, a merger.">
                      <textarea id="reason" name="reason" rows={3} required />
                    </Field>
                    <div className="form-actions span-2">
                      <button className="btn btn-line" type="submit">
                        Send to K7 for approval →
                      </button>
                    </div>
                  </fieldset>
                </form>
              </section>
            </div>
          )}
        </div>
        <aside className="ws-side">
          <div>
            <h2>People</h2>
            <ol className="ntf">
              {members
                .filter((m) => m.status !== 'disabled')
                .slice(0, 6)
                .map((m) => (
                  <li key={m.id}>
                    <span className="ntf-when">{m.roles.includes('admin') ? 'admin' : m.roles[0] ?? ''}</span>
                    <div className="ntf-body">
                      <strong>{admin ? <Link href={`${PARTNER_ORG}/users/${m.id}`}>{m.name}</Link> : m.name}</strong>
                      <p>{m.email}</p>
                    </div>
                  </li>
                ))}
            </ol>
            {admin && (
              <p className="more">
                <Link className="link-u" href={`${PARTNER_ORG}/users`}>
                  Manage users →
                </Link>
              </p>
            )}
          </div>
          {trail.length > 0 && (
            <div>
              <h2>Record</h2>
              <ol className="ntf">
                {trail.map((t) => (
                  <li key={t.id}>
                    <span className="ntf-when" title={dmyHm(t.at)}>
                      {dmy(t.at)}
                    </span>
                    <div className="ntf-body">
                      <strong>{t.action.replace(/^(org|user)\./, '').replace(/[.-]/g, ' ')}</strong>
                      <p>
                        {t.objectLabel || t.object}
                        {t.actor.name ? ` · ${t.actor.name}` : ''}
                        {t.comment ? ` · ${t.comment}` : ''}
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
  )
}

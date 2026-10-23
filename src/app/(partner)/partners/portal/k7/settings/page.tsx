import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { K7Nav } from '@/components/partner/K7Nav'
import { Field, Flash } from '@/components/partner/Parts'
import { requireK7Role } from '@/lib/partner/session'
import { getPartnerSettings, PARTNER_TYPE_LABEL, PARTNER_TYPES, STAFF_ROLE_LABEL, STAFF_ROLES } from '@/lib/partner/settings'
import { serviceConfigured } from '@/lib/dataverse/auth'

import { savePartnerSettingsAction } from './actions'

export const metadata: Metadata = { title: 'Partner portal settings' }

/* The portal's settings for Channel Managers (02-build-plan.md §5, decision 5): who on K7's side holds which role, the programme
   (types, regions, terms), the deal rules, the CRM mirror and the notifications. The same global the Payload admin edits raw. */
export default async function K7SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams
  const me = await requireK7Role(['channelManager'], '/partners/portal/k7/settings')
  const s = await getPartnerSettings()
  const rows = [...s.staff, { email: '', name: '', roles: [] as (typeof STAFF_ROLES)[number][] }, { email: '', name: '', roles: [] as (typeof STAFF_ROLES)[number][] }]
  const check = (name: string, label: string, checked: boolean, hint?: string) => (
    <label className="check" key={name}>
      <input type="checkbox" name={name} value="1" defaultChecked={checked} />
      <span>
        {label}
        {hint ? <span className="hint"> · {hint}</span> : null}
      </span>
    </label>
  )
  const probe = process.env.NODE_ENV !== 'production' && process.env.SUPPORT_DEV_SERVICE === 'probe'
  return (
    <>
      <K7Nav active="settings" roles={me.roles} />
      <section className="sheet ws g-paper">
        <div className="ws-head">
          <div className="ws-head-main">
            <span className="label muted">Partner desk · settings</span>
            <h1 className="h-util">How the programme runs.</h1>
            <p className="lede">Who on K7’s side does what, what a company can apply as, the deal rules, what the portal writes to Dynamics, and how it writes to people. Changes apply within half a minute.</p>
          </div>
        </div>
        {sp.ok && <Flash>Settings saved.</Flash>}
        {sp.error && <Flash kind="error">{sp.error}</Flash>}
        <form action={savePartnerSettingsAction} className="form-grid" style={{ gap: 40 }}>
          <div className="span-2">
            <h2 className="sub-head">K7 staff</h2>
            <p className="hint" style={{ marginBottom: 16 }}>
              By work email, as they sign in with Microsoft. One person may hold several roles; a row without an email or a role is dropped. Two blank rows are there to add people.
            </p>
            <div className="table-wrap">
              <table className="dtable staff-table">
                <thead>
                  <tr>
                    <th scope="col">Work email</th>
                    <th scope="col">Name</th>
                    {STAFF_ROLES.map((r) => (
                      <th scope="col" key={r}>
                        {STAFF_ROLE_LABEL[r]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p, i) => (
                    <tr key={i}>
                      <td>
                        <input name={`staff_${i}_email`} type="email" defaultValue={p.email} placeholder="name@k7computing.com" aria-label={`Row ${i + 1} email`} />
                      </td>
                      <td>
                        <input name={`staff_${i}_name`} defaultValue={p.name} placeholder="Name" aria-label={`Row ${i + 1} name`} />
                      </td>
                      {STAFF_ROLES.map((r) => (
                        <td className="tick" key={r}>
                          <input type="checkbox" name={`staff_${i}_role_${r}`} value="1" defaultChecked={p.roles.includes(r)} aria-label={`Row ${i + 1} ${STAFF_ROLE_LABEL[r]}`} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="form-grid" style={{ marginTop: 20, gap: 12 }}>
              {check('channelManagersApproveDeals', 'Channel Managers also act as Deal Desk Approvers', s.channelManagersApproveDeals)}
              {check('marketingAdminsRunSchemes', 'Marketing Admins also act as Scheme Admins', s.marketingAdminsRunSchemes)}
              {check('devStaffPass', 'Development sign-ins hold every role', s.devStaffPass, 'the probe door only; ignored in production')}
            </div>
          </div>

          <div className="span-2 settings-grid">
            <div>
              <h2 className="sub-head">Programme</h2>
              <div className="form-grid">
                <fieldset className="field span-2" style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend className="label" style={{ color: 'var(--mu)', marginBottom: 10 }}>
                    A company can apply as
                  </legend>
                  <div className="checks">{PARTNER_TYPES.map((t) => check(`type_${t}`, PARTNER_TYPE_LABEL[t], s.partnerTypes.includes(t)))}</div>
                </fieldset>
                <Field id="regions" label="K7 regions" span hint="One per line: code, name. The applicant picks from these; the first one named goes to the CRM account's region.">
                  <textarea id="regions" name="regions" rows={5} defaultValue={s.regions.map((r) => `${r.code}, ${r.name}`).join('\n')} placeholder={'N, North\nS, South\nWCE, West and Central'} />
                </Field>
                <Field id="terms_version" label="Terms version" hint="Stored on every application with the time of acceptance.">
                  <input id="terms_version" name="terms_version" defaultValue={s.terms.version} />
                </Field>
                <Field id="terms_url" label="Terms URL" hint="Where the programme terms are published.">
                  <input id="terms_url" name="terms_url" type="url" defaultValue={s.terms.url} placeholder="https://www.k7computing.com/…" />
                </Field>
              </div>
            </div>
            <div>
              <h2 className="sub-head">Deals</h2>
              <div className="form-grid">
                <Field id="deals_protectionDays" label="Protection (days)">
                  <input id="deals_protectionDays" name="deals_protectionDays" inputMode="numeric" defaultValue={s.deals.protectionDays} />
                </Field>
                <Field id="deals_extensionDays" label="Extension (days)">
                  <input id="deals_extensionDays" name="deals_extensionDays" inputMode="numeric" defaultValue={s.deals.extensionDays} />
                </Field>
                <Field id="deals_approvalSlaHours" label="Decision within (working hours)" hint="Applications and deals; the breach notice arrives with M8.">
                  <input id="deals_approvalSlaHours" name="deals_approvalSlaHours" inputMode="numeric" defaultValue={s.deals.approvalSlaHours} />
                </Field>
                <Field id="deals_endingNoticeDays" label="Protection-ending notice (days before)" hint="The sweep tells the partner and the approvers once.">
                  <input id="deals_endingNoticeDays" name="deals_endingNoticeDays" inputMode="numeric" defaultValue={s.deals.endingNoticeDays} />
                </Field>
                <div className="span-2" style={{ display: 'grid', gap: 12 }}>
                  {check('deals_requireCertificate', 'A deal needs a certified organisation', s.deals.requireCertificate, 'off until the LMS exists; waivers per organisation')}
                  {check('deals_conflictCheckCrm', 'Also look for the end customer in the CRM when checking conflicts', s.deals.conflictCheckCrm)}
                </div>
              </div>
            </div>
          </div>

          <div className="span-2 settings-grid">
            <div>
              <h2 className="sub-head">CRM mirror</h2>
              <p className="hint" style={{ marginBottom: 16 }}>
                What the outbox writes to Dynamics: the partner account and its primary contact when an application is approved; the end customer, its contact and the opportunity when a deal is approved. Off: jobs queue and nothing reaches the CRM. {serviceConfigured() ? 'The service identity is configured.' : probe ? 'Development: the probe token stands in for the service identity on UAT.' : 'No service identity is configured yet; jobs will fail until it is.'}
              </p>
              <div className="form-grid">
                <div className="span-2">{check('crm_enabled', 'Write to Dynamics', s.crm.enabled)}</div>
                <Field id="crm_ownerRule" label="Account owner" select>
                  <select id="crm_ownerRule" name="crm_ownerRule" defaultValue={s.crm.ownerRule}>
                    <option value="approver">The approving Channel Manager</option>
                    <option value="fixed">A fixed owner</option>
                  </select>
                </Field>
                <Field id="crm_ownerId" label="Fixed owner (systemuserid)">
                  <input id="crm_ownerId" name="crm_ownerId" defaultValue={s.crm.ownerId} placeholder="00000000-0000-0000-0000-000000000000" />
                </Field>
                <Field id="crm_enquirySource" label="Enquiry source" hint="alletec_enquirysource on the opportunity; 1 = Partner Referral.">
                  <input id="crm_enquirySource" name="crm_enquirySource" inputMode="numeric" defaultValue={s.crm.enquirySource} />
                </Field>
                <Field id="crm_productCategory" label="Product category" hint="alletec_productcategory on the opportunity until the product has its own value; 36 = Others.">
                  <input id="crm_productCategory" name="crm_productCategory" inputMode="numeric" defaultValue={s.crm.productCategory} />
                </Field>
                <Field id="crm_accountNamePattern" label="Opportunity name" span hint="{customer} and {product} are replaced; the sales convention is customer-Fresh-product.">
                  <input id="crm_accountNamePattern" name="crm_accountNamePattern" defaultValue={s.crm.accountNamePattern} />
                </Field>
                <Field id="crm_syncMinutes" label="Dashboard read-back, minutes" hint="How often the opportunities are read back for the partner dashboard (FR-DASH-05): the sync route runs at most this often unless forced. Default 60, minimum 5.">
                  <input id="crm_syncMinutes" name="crm_syncMinutes" inputMode="numeric" defaultValue={s.crm.syncMinutes} />
                </Field>
              </div>
            </div>
            <div>
              <h2 className="sub-head">Notifications</h2>
              <div className="form-grid">
                <div className="span-2">{check('notify_emailEnabled', 'Email beside the bell', s.notify.emailEnabled, 'mail still goes only through SMTP_URL and the allowlist')}</div>
                <Field id="notify_mailFrom" label="Sender" span>
                  <input id="notify_mailFrom" name="notify_mailFrom" defaultValue={s.notify.mailFrom} />
                </Field>
                <Field id="notify_bellRetentionDays" label="Keep read notifications (days)">
                  <input id="notify_bellRetentionDays" name="notify_bellRetentionDays" inputMode="numeric" defaultValue={s.notify.bellRetentionDays} />
                </Field>
              </div>
            </div>
          </div>

          <div className="form-actions span-2">
            <button className="btn btn-primary" type="submit">
              Save settings →
            </button>
            <Link className="link-u" href="/admin/globals/partner-settings">
              The raw global in the admin
            </Link>
          </div>
        </form>
      </section>
    </>
  )
}

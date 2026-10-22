import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import React from 'react'

import { JoinSteps } from '@/components/partner/Join'
import { Field, Flash, Options } from '@/components/partner/Parts'
import { currentDraft } from '@/lib/partner/join'
import { editable, JOIN } from '@/lib/partner/registration'
import { SIZE_BANDS, TURNOVER_BANDS } from '@/lib/partner/registration-model'
import { getPartnerSettings, PARTNER_TYPE_LABEL } from '@/lib/partner/settings'

import { saveDetailsAction } from '../actions'

export const metadata: Metadata = { title: 'Company and contact' }

/* Step 2 (FR-REG-02): the common fields, GSTIN and PAN (optional, appendix 6), the primary contact and the K7 regions. Errors come
   back as `e.<field>` query keys and sit under their fields; what was typed is already saved on the draft. */
export default async function JoinCompanyPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const app = await currentDraft()
  if (!app) redirect(`${JOIN}?error=expired`)
  if (!editable(app)) redirect(`${JOIN}/status?a=${encodeURIComponent(app.number)}&k=${encodeURIComponent(app.resumeKey)}`)
  const settings = await getPartnerSettings()
  const e = (k: string) => sp[`e.${k}`]
  const c = app.company
  const p = app.contact
  const resubmit = app.status === 'clarification'
  return (
    <section className="sheet ws g-paper">
      <div className="form-sheet" style={{ maxWidth: 960 }}>
        <span className="label muted">
          Applying as {PARTNER_TYPE_LABEL[app.type]}
          {app.number ? ` · ${app.number}` : ''}
        </span>
        <h1 className="h-util" style={{ margin: '10px 0 14px' }}>
          {resubmit ? 'Edit and resubmit.' : 'Your company and its primary contact.'}
        </h1>
        <p className="form-intro">{resubmit ? 'Change what K7 asked about; the rest stays as you filed it. You will confirm the terms again before it goes back.' : 'The legal name and registered address go on the partner account K7 keeps for you; the primary contact becomes the organisation’s Partner Admin on approval.'}</p>
        <JoinSteps current="company" />
        {e('form') && <Flash kind="error">{e('form')}</Flash>}
        {Object.keys(sp).some((k) => k.startsWith('e.') && k !== 'e.form') && <Flash kind="error">Some fields need attention; they are marked below.</Flash>}
        <form action={saveDetailsAction} className="form-grid">
          <h2 className="sub-head span-2">Company</h2>
          <Field id="legalName" label="Legal name" required error={e('legalName')}>
            <input id="legalName" name="legalName" required defaultValue={c.legalName} autoComplete="organization" placeholder="Example Technologies Private Limited" />
          </Field>
          <Field id="tradeName" label="Trade name" hint="If you trade under a different name." error={e('tradeName')}>
            <input id="tradeName" name="tradeName" defaultValue={c.tradeName} placeholder="Example Tech" />
          </Field>
          <Field id="address" label="Registered address" required span error={e('address')}>
            <textarea id="address" name="address" rows={2} required defaultValue={c.address} autoComplete="street-address" placeholder="Street, building, area" />
          </Field>
          <Field id="city" label="City" required error={e('city')}>
            <input id="city" name="city" required defaultValue={c.city} autoComplete="address-level2" />
          </Field>
          <Field id="state" label="State" required error={e('state')}>
            <input id="state" name="state" required defaultValue={c.state} autoComplete="address-level1" />
          </Field>
          <Field id="pin" label="PIN / postal code" required error={e('pin')}>
            <input id="pin" name="pin" required defaultValue={c.pin} autoComplete="postal-code" inputMode="numeric" />
          </Field>
          <Field id="country" label="Country" required error={e('country')}>
            <input id="country" name="country" required defaultValue={c.country} autoComplete="country-name" />
          </Field>
          <Field id="website" label="Website" error={e('website')}>
            <input id="website" name="website" type="text" inputMode="url" defaultValue={c.website} placeholder="www.example.com" />
          </Field>
          <Field id="yearOfIncorporation" label="Year of incorporation" required error={e('yearOfIncorporation')}>
            <input id="yearOfIncorporation" name="yearOfIncorporation" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required defaultValue={c.yearOfIncorporation ?? ''} placeholder="2012" />
          </Field>
          <Field id="size" label="Company size" required select error={e('size')}>
            <select id="size" name="size" required defaultValue={c.size}>
              <Options empty="Choose…" items={SIZE_BANDS.map((b) => ({ value: b.key, label: b.label }))} />
            </select>
          </Field>
          <Field id="turnover" label="Annual turnover" required select error={e('turnover')}>
            <select id="turnover" name="turnover" required defaultValue={c.turnover}>
              <Options empty="Choose…" items={TURNOVER_BANDS.map((b) => ({ value: b.key, label: b.label }))} />
            </select>
          </Field>
          <Field id="gstin" label="GSTIN" hint="Optional. Indian companies; 15 characters." error={e('gstin')}>
            <input id="gstin" name="gstin" defaultValue={c.gstin} maxLength={15} style={{ textTransform: 'uppercase' }} />
          </Field>
          <Field id="pan" label="PAN" hint="Optional. 10 characters." error={e('pan')}>
            <input id="pan" name="pan" defaultValue={c.pan} maxLength={10} style={{ textTransform: 'uppercase' }} />
          </Field>

          {settings.regions.length > 0 && (
            <fieldset className={`field span-2${e('regions') ? ' is-invalid' : ''}`} style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="label" style={{ color: 'var(--mu)', marginBottom: 10 }}>
                K7 regions you operate in *
              </legend>
              <div className="checks">
                {settings.regions.map((r) => (
                  <label className="check" key={r.code}>
                    <input type="checkbox" name="regions" value={r.code} defaultChecked={app.regions.includes(r.code)} />
                    <span>{r.name}</span>
                  </label>
                ))}
              </div>
              {e('regions') && <span className="field-error">{e('regions')}</span>}
            </fieldset>
          )}

          <h2 className="sub-head span-2" style={{ marginTop: 16 }}>
            Primary contact
          </h2>
          <Field id="contactName" label="Name" required error={e('contactName')}>
            <input id="contactName" name="contactName" required defaultValue={p.name} autoComplete="name" />
          </Field>
          <Field id="contactDesignation" label="Designation" required error={e('contactDesignation')}>
            <input id="contactDesignation" name="contactDesignation" required defaultValue={p.designation} autoComplete="organization-title" placeholder="Director, Channel Head…" />
          </Field>
          <Field id="contactEmail" label="Work email" required hint={p.emailVerifiedAt ? 'Verified. Changing it means verifying again.' : 'We send a code here to confirm it.'} error={e('contactEmail')}>
            <input id="contactEmail" name="contactEmail" type="email" inputMode="email" required defaultValue={p.email} autoComplete="email" />
          </Field>
          <Field id="contactMobile" label="Mobile" required hint="10 to 15 digits, with the country code if outside India." error={e('contactMobile')}>
            <input id="contactMobile" name="contactMobile" type="tel" inputMode="tel" required defaultValue={p.mobile} autoComplete="tel" placeholder="+91 98400 00000" />
          </Field>
          <div className="form-actions span-2">
            <button className="btn btn-primary" type="submit">
              {p.emailVerifiedAt ? 'Save and review →' : 'Save and send the code →'}
            </button>
            <span className="hint">Nothing is sent to K7 until you accept the terms on the last step.</span>
          </div>
        </form>
      </div>
    </section>
  )
}

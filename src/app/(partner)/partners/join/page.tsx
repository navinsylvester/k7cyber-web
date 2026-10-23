import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { JoinSteps } from '@/components/partner/Join'
import { Flash } from '@/components/partner/Parts'
import { currentDraft } from '@/lib/partner/join'
import { editable } from '@/lib/partner/registration'
import { getPartnerSettings, PARTNER_TYPE_LABEL, type PartnerType } from '@/lib/partner/settings'

import { abandonDraft, startApplication } from './actions'

export const metadata: Metadata = { title: 'Join the programme' }

const ABOUT: Record<PartnerType, string> = {
  distributor: 'You stock K7 and sell through your own resellers. You register deals for them and run the channel in your territory.',
  integrationPartner: 'You build K7 into a wider solution or service and deliver it to your customers with your own engineering.',
  var: 'You sell K7 to your own customers with your services around it: deployment, support, managed security.',
  msp: 'You run security for your customers from a console and bill them for the service, K7 included.',
}

const ERRORS: Record<string, string> = { expired: 'That application could not be found. Start again below; it takes a few minutes.' }

/* Step 1 (FR-REG-01): the partner type. A visitor with a draft in the cookie sees it and may continue or start over. */
export default async function JoinPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const [settings, draft] = await Promise.all([getPartnerSettings(), currentDraft()])
  const open = draft && editable(draft) ? draft : null
  return (
    <section className="sheet ws g-paper">
      <div className="form-sheet">
        <span className="label muted">K7 Partner Programme · apply</span>
        <h1 className="h-util" style={{ margin: '10px 0 14px' }}>
          Join the programme.
        </h1>
        <p className="form-intro">Four steps: what kind of partner you are, your company and its primary contact, a code to confirm the contact’s email, and the programme terms. K7’s channel team reviews every application and you hear from us by email at every step.</p>
        <JoinSteps current="type" />
        {sp.error && <Flash kind="error">{ERRORS[sp.error] ?? 'Try again.'}</Flash>}
        {sp['e.type'] && <Flash kind="error">{sp['e.type']}</Flash>}
        {open && (
          <Flash>
            You have an application in progress{open.company.legalName ? ` for ${open.company.legalName}` : ''}{open.number ? ` (${open.number})` : ''}.{' '}
            <Link className="link-u" href="/partners/join/company">
              Continue it
            </Link>
            , or start over below.
          </Flash>
        )}
        <form action={startApplication} className="form-grid">
          <fieldset className="field span-2" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="label" style={{ color: 'var(--mu)', marginBottom: 10 }}>
              We are applying as *
            </legend>
            <div className="choice">
              {settings.partnerTypes.map((t, i) => (
                <label key={t}>
                  <input type="radio" name="type" value={t} defaultChecked={open ? open.type === t : i === 0} required />
                  <span className="t">{PARTNER_TYPE_LABEL[t]}</span>
                  <span className="d">{ABOUT[t]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="form-actions span-2">
            <button className="btn btn-primary" type="submit">
              {open ? 'Continue →' : 'Start the application →'}
            </button>
            <Link className="link-u" href="/partners/portal/sign-in">
              Already a partner? Sign in
            </Link>
          </div>
          <p className="hint span-2">Applying takes about ten minutes. Have the company’s registered address, year of incorporation and, if Indian, GSTIN and PAN to hand; both are optional.</p>
        </form>
        {open && (
          <form action={abandonDraft} className="actions" style={{ marginTop: 24 }}>
            <button className="link-u textbtn" type="submit">
              Start over with a new application
            </button>
          </form>
        )}
      </div>
    </section>
  )
}

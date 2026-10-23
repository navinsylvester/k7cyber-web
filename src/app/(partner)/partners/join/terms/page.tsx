import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import React from 'react'

import { ApplicationSummary, JoinSteps } from '@/components/partner/Join'
import { Flash } from '@/components/partner/Parts'
import { currentDraft } from '@/lib/partner/join'
import { clarificationNote, editable, JOIN } from '@/lib/partner/registration'
import { readyToSubmit } from '@/lib/partner/registration-model'
import { getPartnerSettings } from '@/lib/partner/settings'
import { dmyHm } from '@/lib/support/format'

import { submitApplicationAction } from '../actions'

export const metadata: Metadata = { title: 'Terms and submit' }

/* Step 4 (FR-REG-04): the application read back as filed, the terms with their version, and Submit. A resubmission after a
   clarification shows K7's note so the applicant can check they answered it. */
export default async function JoinTermsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const app = await currentDraft()
  if (!app) redirect(`${JOIN}?error=expired`)
  if (!editable(app)) redirect(`${JOIN}/status?a=${encodeURIComponent(app.number)}&k=${encodeURIComponent(app.resumeKey)}`)
  const settings = await getPartnerSettings()
  const missing = readyToSubmit(app, settings.regions)
  if (missing.emailVerified) redirect(`${JOIN}/verify`)
  const regions = settings.regions.filter((r) => app.regions.includes(r.code)).map((r) => r.name)
  const note = app.status === 'clarification' ? clarificationNote(app) : null
  const blocked = Object.keys(missing).length > 0
  return (
    <section className="sheet ws g-paper">
      <div className="form-sheet" style={{ maxWidth: 960 }}>
        <span className="label muted">Last step{app.number ? ` · ${app.number}` : ''}</span>
        <h1 className="h-util" style={{ margin: '10px 0 14px' }}>
          Check it, accept the terms, submit.
        </h1>
        <p className="form-intro">This is what K7’s channel team will read. The terms version and the time you accept them are stored with the application.</p>
        <JoinSteps current="terms" />
        {note && (
          <Flash>
            <strong>What K7 asked on {dmyHm(note.at)}:</strong> {note.comment}
          </Flash>
        )}
        {sp['e.accept'] && <Flash kind="error">{sp['e.accept']}</Flash>}
        {sp['e.status'] && <Flash kind="error">{sp['e.status']}</Flash>}
        {blocked && (
          <Flash kind="error">
            Something is missing: {Object.values(missing).join(' ')}{' '}
            <Link className="link-u" href={`${JOIN}/company`}>
              Go back and complete it
            </Link>
            .
          </Flash>
        )}
        <ApplicationSummary app={app} regions={regions} edit />
        <form action={submitApplicationAction} className="form-grid" style={{ marginTop: 32 }}>
          <div className="span-2 terms-box">
            <label className="check">
              <input type="checkbox" name="accept" value="1" required />
              <span>
                We accept the{' '}
                {settings.terms.url ? (
                  <a className="link-u" href={settings.terms.url} target="_blank" rel="noreferrer">
                    K7 Partner Programme terms
                  </a>
                ) : (
                  'K7 Partner Programme terms'
                )}{' '}
                (version {settings.terms.version}) on behalf of {app.company.legalName || 'the company'}, and confirm that the details above are true. K7 stores them to run the programme and to create the partner account in its CRM.
              </span>
            </label>
          </div>
          <div className="form-actions span-2">
            <button className="btn btn-primary" type="submit" disabled={blocked}>
              {app.status === 'clarification' ? 'Resubmit the application →' : 'Submit the application →'}
            </button>
            <Link className="link-u" href={`${JOIN}/company`}>
              Back to the details
            </Link>
          </div>
        </form>
      </div>
    </section>
  )
}

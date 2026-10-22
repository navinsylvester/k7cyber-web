import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { ApplicationSummary } from '@/components/partner/Join'
import { Aid, AppStateTag, Flash, Strip } from '@/components/partner/Parts'
import { clarificationNote, findByNumber, JOIN } from '@/lib/partner/registration'
import { rejectionNote } from '@/lib/partner/registration-model'
import { getPartnerSettings, PARTNER_TYPE_LABEL } from '@/lib/partner/settings'
import { APPLICATION_STATUS_HINT } from '@/lib/partner/status'
import { dmy, dmyHm } from '@/lib/support/format'

import { resumeApplication } from '../actions'

export const metadata: Metadata = { title: 'Application status' }

/* The applicant's view, reached from the emailed link (number + key): the state, K7's note when there is one, the record of
   decisions, and the way back into the steps after a clarification request. Nothing here needs a sign-in; the key is the proof. */
export default async function JoinStatusPage({ searchParams }: { searchParams: Promise<{ a?: string; k?: string; error?: string }> }) {
  const sp = await searchParams
  const app = sp.a ? await findByNumber(sp.a) : null
  const ok = app && sp.k && app.resumeKey === sp.k && app.status !== 'draft'
  if (!ok) {
    return (
      <section className="sheet ws g-paper">
        <div className="form-sheet">
          <span className="label muted">Application status</span>
          <h1 className="h-util" style={{ margin: '10px 0 14px' }}>
            We could not open that link.
          </h1>
          <p className="form-intro">The link in your email carries the application number and a key; both are needed. If you copied it by hand, check it is complete, or write to partners@k7computing.com with your application number.</p>
          <Link className="btn btn-line" href={JOIN}>
            Apply to the programme
          </Link>
        </div>
      </section>
    )
  }
  const settings = await getPartnerSettings()
  const regions = settings.regions.filter((r) => app.regions.includes(r.code)).map((r) => r.name)
  const note = app.status === 'clarification' ? clarificationNote(app) : app.status === 'rejected' ? rejectionNote(app) : null
  const shown = app.decisions.filter((d) => d.to !== 'underReview' || d.comment)
  return (
    <section className="sheet ws g-paper">
      <div className="ws-head">
        <div className="ws-head-main">
          <Aid number={app.number} display />
          <h1 className="h-util">{app.company.legalName}.</h1>
          <p className="lede">{APPLICATION_STATUS_HINT[app.status]}</p>
        </div>
        {app.status === 'clarification' && (
          <form action={resumeApplication} className="ws-actions">
            <input type="hidden" name="a" value={app.number} />
            <input type="hidden" name="k" value={app.resumeKey} />
            <button className="btn btn-primary" type="submit">
              Edit and resubmit →
            </button>
          </form>
        )}
        {app.status === 'approved' && (
          <div className="ws-actions">
            <Link className="btn btn-primary" href="/partners/portal/sign-in">
              Sign in to the portal →
            </Link>
          </div>
        )}
      </div>
      <Strip
        items={[
          { label: 'Status', value: <AppStateTag status={app.status} audience="applicant" /> },
          { label: 'Applying as', value: PARTNER_TYPE_LABEL[app.type] },
          { label: 'Submitted', value: app.submittedAt ? dmy(app.submittedAt) : '—' },
          { label: 'Decided', value: app.decidedAt ? dmy(app.decidedAt) : 'Not yet' },
        ]}
      />
      {note && (
        <Flash kind={app.status === 'rejected' ? 'error' : 'ok'}>
          <strong>{app.status === 'rejected' ? 'Reason' : 'What K7 needs'}, {dmyHm(note.at)}:</strong> {note.comment}
        </Flash>
      )}
      <div className="phome">
        <ApplicationSummary app={app} regions={regions} />
        <aside className="ws-side">
          <div>
            <h2>Record</h2>
            <ol className="ntf">
              {shown.map((d, i) => (
                <li key={i}>
                  <span className="ntf-when">{dmy(d.at)}</span>
                  <div className="ntf-body">
                    <strong>{d.to === 'submitted' ? (i === 0 ? 'Submitted' : 'Resubmitted') : d.to === 'underReview' ? 'Under review' : d.to === 'approved' ? 'Approved' : d.to === 'rejected' ? 'Not accepted' : 'Clarification requested'}</strong>
                    {d.comment && d.to !== 'underReview' && <p>{d.comment}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </section>
  )
}

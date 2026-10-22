import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import React from 'react'

import { JoinSteps } from '@/components/partner/Join'
import { Aid } from '@/components/partner/Parts'
import { findByNumber, JOIN } from '@/lib/partner/registration'
import { getPartnerSettings } from '@/lib/partner/settings'

export const metadata: Metadata = { title: 'Application submitted' }

/* The receipt: the number, what happens next, and the link to keep. */
export default async function JoinSubmittedPage({ searchParams }: { searchParams: Promise<{ a?: string; k?: string }> }) {
  const sp = await searchParams
  const app = sp.a ? await findByNumber(sp.a) : null
  if (!app || !sp.k || app.resumeKey !== sp.k) redirect(JOIN)
  const settings = await getPartnerSettings()
  const statusHref = `${JOIN}/status?a=${encodeURIComponent(app.number)}&k=${encodeURIComponent(app.resumeKey)}`
  return (
    <section className="sheet ws g-paper">
      <div className="form-sheet">
        <span className="label muted">Application received</span>
        <h1 className="h-util" style={{ margin: '10px 0 14px' }}>
          Thank you. It is with K7.
        </h1>
        <JoinSteps current="terms" done />
        <p className="lede" style={{ margin: '0 0 24px' }}>
          Your application number is <Aid number={app.number} display />
        </p>
        <ol className="steps">
          <li>A Channel Manager picks it up and reviews it; we aim to decide within {Math.max(1, Math.round(settings.deals.approvalSlaHours / 8))} working days.</li>
          <li>If something is unclear we email {app.contact.email} with the question; you edit the application from the link and resubmit.</li>
          <li>On approval, {app.contact.name || 'your primary contact'} becomes the organisation’s Partner Admin and signs in with a one-time code to this email; no password.</li>
        </ol>
        <p className="form-intro" style={{ marginTop: 28 }}>
          Keep the email we just sent: its link shows the status at any time.{' '}
          <Link className="link-u" href={statusHref}>
            Open the status page
          </Link>
          .
        </p>
      </div>
    </section>
  )
}

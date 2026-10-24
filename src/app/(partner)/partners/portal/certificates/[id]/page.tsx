import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { CertFacts, CertStateTag, QrSvg, RuleLines } from '@/components/partner/Certificates'
import { Pid, Strip } from '@/components/partner/Parts'
import { certificateHref, loadCertificateFor, orgStanding, PARTNER_CERTIFICATES, stateOf, verifyUrlFor } from '@/lib/partner/certificates'
import { CERT_KIND_LABEL } from '@/lib/partner/certificates-model'
import { requirePartner } from '@/lib/partner/session'
import { getPartnerSettings } from '@/lib/partner/settings'
import { PARTNER_TRAINING } from '@/lib/partner/training'
import { dmy } from '@/lib/support/format'

export const metadata: Metadata = { title: 'Certificate' }

/* One certificate for the partner (FR-TRN-08, FR-CRT-04): the number large, the state, the facts, the QR and the verification
   link, the PDF as the one action. The holder, the organisation's admins and, for the partner certificate, every user may read it;
   anything else is a 404 through the scope. */
export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = await requirePartner(`${PARTNER_CERTIFICATES}/${id}`)
  const c = await loadCertificateFor(me, id)
  if (!c) notFound()
  const [state, standing, settings] = await Promise.all([stateOf(c), c.kind === 'org' ? orgStanding(me.scope) : Promise.resolve(null), getPartnerSettings()])
  const verifyUrl = verifyUrlFor(c.number)
  const issued = c.status !== 'requested' && c.status !== 'declined' && Boolean(c.issuedAt)
  const canRecertify = c.kind === 'individual' && c.userId === me.user.id && (state === 'expiring' || state === 'expired' || state === 'revoked')
  return (
    <section className="sheet ws g-paper">
      <div className="ws-head">
        <div className="ws-head-main">
          <span className="label muted">
            <Link className="link-u" href={PARTNER_CERTIFICATES}>
              Certificates
            </Link>{' '}
            · {CERT_KIND_LABEL[c.kind]}
          </span>
          <Pid id={c.number} display />
          <h1 className="h-util">{c.kind === 'individual' ? `${c.userName} · ${c.courseTitle}.` : `${c.orgName}.`}</h1>
          <p className="lede">
            {c.kind === 'individual'
              ? `${c.userName} passed the ${c.trackName} course “${c.courseTitle}” with ${c.score ?? 0}% (${c.band || 'Pass'})${c.issuedAt ? ` on ${dmy(c.issuedAt)}` : ''}.${state === 'valid' || state === 'expiring' ? ` The certificate stands to ${dmy(c.expiresAt)}.` : state === 'expired' ? ' It has expired; the recertification test is open on the course page.' : state === 'revoked' ? ' It was revoked by K7.' : state === 'superseded' ? ` It was replaced by ${c.supersededBy}.` : ''}`
              : c.status === 'requested'
                ? 'The rule is met and K7 has been asked to issue the K7 Partner Certificate. It appears here once a Channel Manager issues it.'
                : c.status === 'declined'
                  ? `K7 did not issue the certificate for now.${c.declinedReason ? ` Reason: ${c.declinedReason}` : ''}`
                  : `${c.orgName} is a certified K7 partner${c.issuedAt ? `, certified on ${dmy(c.issuedAt)}` : ''}${state === 'valid' || state === 'expiring' ? ` and holds the certificate to ${dmy(c.expiresAt)}.` : state === 'expired' ? '; the certificate has expired.' : '; the certificate was revoked.'}`}
          </p>
        </div>
        <div className="ws-actions">
          {issued ? (
            <Link className="btn btn-primary" href={`${certificateHref(c)}/file`}>
              Download the PDF →
            </Link>
          ) : null}
          {canRecertify ? (
            <Link className="btn btn-line" href={`${PARTNER_TRAINING}/${c.courseId}`}>
              Recertify →
            </Link>
          ) : null}
        </div>
      </div>
      <Strip
        items={[
          { label: 'State', value: <CertStateTag state={state} /> },
          { label: c.kind === 'individual' ? 'Holder' : 'Organisation', value: c.kind === 'individual' ? c.userName : c.orgName },
          { label: 'Issued', value: c.issuedAt ? dmy(c.issuedAt) : '—' },
          { label: 'Valid to', value: c.expiresAt ? dmy(c.expiresAt) : '—' },
          { label: 'Number', value: <Pid id={c.number} /> },
        ]}
      />
      <div className="phome">
        <div>
          <div className="filed cert-card">
            <span className="ftab label">The certificate</span>
            <div className="cert-card-body cert-sheet">
              <CertFacts c={c} state={state} verifyUrl={verifyUrl} />
              {issued ? (
                <div className="cert-verify">
                  <QrSvg content={verifyUrl} size={132} title={`Verification QR for ${c.number}`} />
                  <p className="label muted">Scan, or open the link, to confirm this certificate is genuine. The page shows the name, the organisation, the course and the dates, nothing else.</p>
                </div>
              ) : null}
            </div>
          </div>
          {standing ? (
            <div style={{ marginTop: 'clamp(28px, 3cqw, 40px)' }}>
              <h2 className="sub-head">The rule today</h2>
              <p className="hint">How many of your people hold a current individual certificate on each track, against what your partner type needs.</p>
              <RuleLines rule={standing.rule} />
            </div>
          ) : null}
        </div>
        <aside className="ws-side">
          <div>
            <h2>What it means</h2>
            <p className="muted" style={{ margin: 0, fontSize: 15 }}>
              {c.kind === 'individual'
                ? `An individual certificate says its holder passed the course’s test. It stands for ${settings.certificates.validityMonths} months; the holder is reminded before it lapses and may take the test again, which issues a new certificate. The organisation’s standing is its partner certificate.`
                : 'The K7 Partner Certificate says the organisation meets K7’s training requirement for its partner type. It is renewed when it lapses, provided the rule still holds; a revoked certificate reads invalid on the verification page.'}
            </p>
          </div>
          {c.kind === 'individual' ? (
            <div>
              <h2>The course</h2>
              <p className="more" style={{ marginTop: 0 }}>
                <Link className="link-u" href={`${PARTNER_TRAINING}/${c.courseId}`}>
                  {c.courseTitle} →
                </Link>
              </p>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  )
}

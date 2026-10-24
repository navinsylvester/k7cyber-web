import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import React from 'react'

import { CertStateTag } from '@/components/partner/Certificates'
import { Pid } from '@/components/partner/Parts'
import { findForVerification } from '@/lib/partner/certificates'
import { CERT_KIND_LABEL, parseCertificateNumber } from '@/lib/partner/certificates-model'
import { dmy } from '@/lib/support/format'

export const metadata: Metadata = { title: 'Certificate verification', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

/* The public verification page (FR-TRN-09, FR-CRT-07): the number is genuine or not; when it is, the holder, the organisation,
   what it certifies, the issue date and whether it stands today, has expired or was revoked. No email, no score, no reason,
   no session: the number itself is the key, and it is not guessable. */
export default async function VerifyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const n = parseCertificateNumber(decodeURIComponent(id))
  if (!n) redirect('/partners/verify?error=shape')
  if (n !== decodeURIComponent(id)) redirect(`/partners/verify/${n}`)
  const v = await findForVerification(n)
  const standing = v ? (v.state === 'valid' || v.state === 'expiring' ? 'valid' : v.state) : 'unknown'
  const headline = !v ? 'Not a K7 certificate.' : standing === 'valid' ? 'Genuine and valid.' : standing === 'expired' ? 'Genuine, but expired.' : standing === 'revoked' ? 'Revoked.' : 'Genuine, but replaced.'
  return (
    <section className="sheet ws g-paper verify">
      <div className="ws-head">
        <div className="ws-head-main">
          <span className="label muted">K7 Partner Programme · verification</span>
          <Pid id={n} display />
          <h1 className="h-util">
            <i className={`pixel${standing === 'valid' ? ' is-on' : ''}`} aria-hidden="true" /> {headline}
          </h1>
          <p className="lede">
            {!v
              ? 'No certificate with this number was issued by K7. Check the number against the document; a certificate that was never issued, or whose request was not granted, does not verify.'
              : standing === 'valid'
                ? `This ${v.kind === 'org' ? 'K7 Partner Certificate' : 'individual certificate'} was issued by K7 and stands today.`
                : standing === 'expired'
                  ? `This ${v.kind === 'org' ? 'K7 Partner Certificate' : 'individual certificate'} was issued by K7 but its validity has ended.`
                  : standing === 'revoked'
                    ? `This ${v.kind === 'org' ? 'K7 Partner Certificate' : 'individual certificate'} was issued by K7 and has since been revoked. It is not valid.`
                    : 'This individual certificate was issued by K7 and has since been replaced by a newer one for the same course.'}
          </p>
        </div>
      </div>
      {v ? (
        <div className="verify-card filed">
          <span className="ftab label">{CERT_KIND_LABEL[v.kind]}</span>
          <dl className="meta-rows verify-facts">
            <dt>State</dt>
            <dd className="sans">
              <CertStateTag state={v.state} />
            </dd>
            <dt>{v.kind === 'org' ? 'Organisation' : 'Name'}</dt>
            <dd className="sans">{v.holder}</dd>
            {v.kind === 'individual' ? (
              <>
                <dt>Organisation</dt>
                <dd className="sans">{v.organisation}</dd>
              </>
            ) : null}
            <dt>Partner ID</dt>
            <dd>{v.partnerId || '—'}</dd>
            <dt>{v.kind === 'org' ? 'Programme' : 'Course'}</dt>
            <dd className="sans">{v.about}</dd>
            <dt>Issued</dt>
            <dd>{dmy(v.issuedAt)}</dd>
            <dt>{standing === 'revoked' ? 'Was valid to' : 'Valid to'}</dt>
            <dd>{dmy(v.expiresAt)}</dd>
            {v.revokedAt ? (
              <>
                <dt>Revoked</dt>
                <dd>{dmy(v.revokedAt)}</dd>
              </>
            ) : null}
          </dl>
        </div>
      ) : null}
      <p className="more">
        <Link className="link-u" href="/partners/verify">
          Verify another →
        </Link>
        {' · '}
        <Link className="link-u" href="/partners">
          The K7 Partner Programme
        </Link>
      </p>
    </section>
  )
}

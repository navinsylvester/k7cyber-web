import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { CertLedger, OrgCertCard } from '@/components/partner/Certificates'
import { Empty, Flash, Strip } from '@/components/partner/Parts'
import { certificateHref, certificatesOfUser, currentByCourse, orgPeopleCertificates, orgStanding, PARTNER_CERTIFICATES } from '@/lib/partner/certificates'
import { certificateState } from '@/lib/partner/certificates-model'
import { requirePartner } from '@/lib/partner/session'
import { getPartnerSettings, PARTNER_TYPE_LABEL } from '@/lib/partner/settings'
import { PARTNER_TRAINING } from '@/lib/partner/training'

export const metadata: Metadata = { title: 'Certificates' }

/* The partner's certificates (FR-TRN-08, FR-TRN-11, FR-CRT-04, 05): the organisation's partner certificate first (its state,
   the rule and where the organisation stands against it), then the user's own individual certificates, and for the Partner
   Admin every person's. Every read carries the scope. */
export default async function CertificatesPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams
  const me = await requirePartner(PARTNER_CERTIFICATES)
  const admin = me.roles.includes('admin')
  const [settings, standing, mine, people] = await Promise.all([getPartnerSettings(), orgStanding(me.scope), certificatesOfUser(me.scope, me.user.id), admin ? orgPeopleCertificates(me.scope) : Promise.resolve([])])
  const days = settings.certificates.reminderDays
  const myRows = mine.map((c) => ({ c, state: certificateState(c, days) }))
  const myCurrent = [...currentByCourse(mine).values()].map((c) => ({ c, state: certificateState(c, days) }))
  const held = myCurrent.filter((r) => r.state === 'valid' || r.state === 'expiring').length
  const orgRows = people.flatMap((p) => p.certs.map((c) => ({ c, state: certificateState(c, days) }))).sort((a, b) => (b.c.issuedAt ?? '').localeCompare(a.c.issuedAt ?? ''))
  const fileHref = standing.current ? `${certificateHref(standing.current)}/file` : undefined
  return (
    <section className="sheet ws g-paper">
      <div className="ws-head">
        <div className="ws-head-main">
          <span className="label muted">{me.org.tradeName || me.org.name} · certificates</span>
          <h1 className="h-util">Certificates.</h1>
          <p className="lede">Passing a course earns you an individual certificate, a PDF with a number anyone can verify. Once enough of your people hold one on each track, the organisation earns its K7 Partner Certificate. Both carry an expiry; the recertification test opens before it.</p>
        </div>
        <div className="ws-actions">
          <Link className="btn btn-line btn-sm" href={PARTNER_TRAINING}>
            Training →
          </Link>
        </div>
      </div>
      {sp.ok && <Flash>{sp.ok}</Flash>}
      {sp.error && <Flash kind="error">{sp.error}</Flash>}
      <Strip
        items={[
          { label: 'Partner certificate', value: standing.current && standing.state !== 'none' ? <Link href={certificateHref(standing.current)}>{standing.current.status === 'requested' ? 'Requested from K7' : `${standing.current.number}${standing.current.expiresAt ? ` · to ${standing.current.expiresAt.slice(0, 10).split('-').reverse().join('-')}` : ''}`}</Link> : 'None yet' },
          { label: 'The rule', value: standing.rule.configured ? standing.rule.lines.map((l) => `${l.have}/${l.need} ${l.trackName}`).join(' · ') : 'Not set' },
          { label: 'Your certificates', value: `${String(held).padStart(2, '0')} current` },
          ...(admin ? [{ label: 'People certified', value: String(people.filter((p) => p.certs.some((c) => ['valid', 'expiring'].includes(certificateState(c, days)))).length).padStart(2, '0') }] : []),
          { label: 'Validity', value: `${settings.certificates.validityMonths} months · reminders at ${days.join(' and ')} days` },
        ]}
      />
      <div className="cert-grid">
        <OrgCertCard current={standing.current} state={standing.state} rule={standing.rule} href={standing.current ? certificateHref(standing.current) : undefined} fileHref={fileHref} typeLabel={PARTNER_TYPE_LABEL[me.org.type]} />
        <div>
          <h2 className="sub-head">Your certificates</h2>
          {myRows.length === 0 ? (
            <Empty label="Yours">{me.roles.some((r) => r === 'sales' || r === 'technical') ? 'No certificate yet. Pass a course’s test in Training and it arrives here and by email.' : 'Certificates come from the Sales and Technical tracks; as Partner Admin you read the organisation’s below.'}</Empty>
          ) : (
            <CertLedger rows={myRows} href={certificateHref} label="Yours" who={false} />
          )}
        </div>
      </div>
      {admin ? (
        <div style={{ marginTop: 'clamp(32px, 4cqw, 48px)' }}>
          <h2 className="sub-head">Everyone’s current certificates</h2>
          <p className="hint">One row per person and course, the newest certificate for each. Expired ones count for nothing towards the rule; the person recertifies on the course page.</p>
          <CertLedger rows={orgRows} href={certificateHref} label="The organisation" empty="Nobody holds a certificate yet." />
        </div>
      ) : null}
    </section>
  )
}

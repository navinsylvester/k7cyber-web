import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { CertFacts, CertLedger, CertStateTag, QrSvg, RuleLines } from '@/components/partner/Certificates'
import { K7Nav } from '@/components/partner/K7Nav'
import { Field, Flash, Pid, Strip, TypeTag } from '@/components/partner/Parts'
import { Crumbs } from '@/components/support/Parts'
import { objectAudit } from '@/lib/partner/audit'
import { K7_CERTIFICATES, k7CertificateHref, loadCertificate, orgStanding, stateOf, verifyUrlFor } from '@/lib/partner/certificates'
import { CERT_KIND_LABEL, certificateState, ruleText } from '@/lib/partner/certificates-model'
import { K7_PARTNERS } from '@/lib/partner/organisation'
import { requireK7Role } from '@/lib/partner/session'
import { getPartnerSettings } from '@/lib/partner/settings'
import { dmy, dmyHm } from '@/lib/support/format'

import { declineRequestAction, issueOrgCertificateAction, revokeCertificateAction } from '../actions'

export const metadata: Metadata = { title: 'Certificate' }

/* One certificate for K7 (FR-CRT-02, 07): the facts, the organisation's standing against the rule now, the QR and the public
   link, the file; on the decision panel: issue (a waiting request, or a renewal for an organisation whose certificate lapsed
   while it meets the rule), decline with a reason, revoke with a reason. The trail at the foot. */
export default async function K7CertificatePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const me = await requireK7Role(['channelManager', 'trainingAdmin'], `${K7_CERTIFICATES}/${id}`)
  const c = await loadCertificate(id)
  if (!c) notFound()
  const [state, standing, trail, settings] = await Promise.all([stateOf(c), orgStanding({ orgId: c.orgId }), objectAudit('partner-certificates', c.id, 40), getPartnerSettings()])
  const cm = me.roles.includes('channelManager')
  const verifyUrl = verifyUrlFor(c.number)
  const issued = c.status !== 'requested' && c.status !== 'declined' && Boolean(c.issuedAt)
  const orgCurrent = standing.certs.find((x) => x.kind === 'org' && (x.status === 'valid') && !(x.expiresAt && new Date(x.expiresAt) < new Date()))
  const canIssue = cm && c.kind === 'org' && standing.rule.met && standing.org.status === 'approved' && !orgCurrent && (c.status === 'requested' || c.status === 'expired' || c.status === 'revoked')
  const canDecline = cm && c.kind === 'org' && c.status === 'requested'
  const canRevoke = (c.status === 'valid' || c.status === 'expired') && (c.kind === 'individual' ? cm || me.roles.includes('trainingAdmin') : cm)
  const people = standing.certs.filter((x) => x.kind === 'individual' && x.status !== 'superseded').map((x) => ({ c: x, state: certificateState(x, settings.certificates.reminderDays) }))
  return (
    <>
      <K7Nav active="certificates" roles={me.roles} />
      <section className="sheet ws g-paper">
        <Crumbs items={[{ label: 'Certificates', href: K7_CERTIFICATES }, { label: c.number }]} />
        <div className="ws-head" style={{ marginTop: 16 }}>
          <div className="ws-head-main">
            <span className="label muted">{CERT_KIND_LABEL[c.kind]}</span>
            <Pid id={c.number} display />
            <h1 className="h-util">{c.kind === 'individual' ? `${c.userName} · ${c.courseTitle}.` : `${c.orgName}.`}</h1>
            <p className="lede">
              {c.kind === 'individual'
                ? `${c.userName} of ${c.orgTradeName || c.orgName} (${c.orgPartnerId}) passed “${c.courseTitle}” on the ${c.trackName} track with ${c.score ?? 0}% (${c.band || 'Pass'})${c.issuedAt ? ` on ${dmy(c.issuedAt)}` : ''}; the certificate ${state === 'valid' || state === 'expiring' ? `stands to ${dmy(c.expiresAt)}` : `is ${state}`}.`
                : c.status === 'requested'
                  ? `${c.orgName} (${c.orgPartnerId}) met the rule for its type on ${dmyHm(c.requestedAt)}: ${c.ruleLines.map((l) => `${l.have} of ${l.need} on ${l.trackName}`).join(', ')}. Today: ${ruleText(standing.rule)}.`
                  : `${c.orgName} (${c.orgPartnerId})${c.issuedAt ? `, certified ${dmy(c.issuedAt)} by ${c.issuedBy || 'K7'}` : ''}; the certificate ${state === 'valid' || state === 'expiring' ? `stands to ${dmy(c.expiresAt)}` : `is ${state}`}. Today the organisation ${standing.rule.met ? 'meets' : 'does not meet'} the rule: ${ruleText(standing.rule)}.`}
            </p>
          </div>
          <div className="ws-actions">
            {issued ? (
              <Link className="btn btn-line" href={`${k7CertificateHref(c)}/file`}>
                The PDF →
              </Link>
            ) : null}
          </div>
        </div>
        {sp.ok && <Flash>{sp.ok}</Flash>}
        {sp.error && <Flash kind="error">{sp.error}</Flash>}
        <Strip
          items={[
            { label: 'State', value: <CertStateTag state={state} /> },
            { label: 'Organisation', value: <Link href={`${K7_PARTNERS}/${c.orgPartnerId}`}>{c.orgTradeName || c.orgName}</Link> },
            { label: 'Type', value: c.orgType ? <TypeTag type={c.orgType} /> : '—' },
            { label: 'Issued', value: c.issuedAt ? dmy(c.issuedAt) : c.requestedAt ? `asked ${dmy(c.requestedAt)}` : '—' },
            { label: 'Valid to', value: c.expiresAt ? dmy(c.expiresAt) : '—' },
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
                    <p className="label muted">The same code the PDF carries.</p>
                  </div>
                ) : null}
              </div>
            </div>
            <h2 className="sub-head" style={{ marginTop: 40 }}>
              The organisation against the rule
            </h2>
            <RuleLines rule={standing.rule} />
            <div style={{ marginTop: 24 }}>
              <CertLedger rows={people} href={k7CertificateHref} label="People’s certificates" empty="Nobody in the organisation holds a certificate." />
            </div>
            {trail.length > 0 ? (
              <>
                <h2 className="sub-head" style={{ marginTop: 40 }}>
                  Record
                </h2>
                <ol className="ntf">
                  {trail.map((t) => (
                    <li key={t.id}>
                      <span className="ntf-when" title={dmyHm(t.at)}>
                        {dmy(t.at)}
                      </span>
                      <div className="ntf-body">
                        <strong>{t.action.replace(/^certificate\./, '').replace(/[.-]/g, ' ')}</strong>
                        <p>
                          {t.actor.name || t.actor.email || 'Portal'}
                          {t.from || t.to ? ` · ${t.from ? `${t.from} → ` : ''}${t.to}` : ''}
                          {t.comment ? ` · ${t.comment}` : ''}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            ) : null}
          </div>
          <aside className="ws-side">
            {canIssue ? (
              <div className="decide is-ready">
                <h2>{c.status === 'requested' ? 'Issue the partner certificate' : 'Issue a renewal'}</h2>
                <p className="hint" style={{ margin: '0 0 16px' }}>
                  {c.status === 'requested' ? 'The organisation meets the rule. The certificate is drawn with today’s date, valid ' : 'The certificate lapsed and the organisation meets the rule again. A new certificate is drawn with today’s date, valid '}
                  {settings.certificates.orgValidityMonths} months, emailed to the Partner Admins with the PDF and shown on their organisation page; the deal gate reads it at once.
                </p>
                <form action={issueOrgCertificateAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="btn btn-primary" type="submit">
                    Issue →
                  </button>
                </form>
              </div>
            ) : c.kind === 'org' && cm && (c.status === 'requested' || c.status === 'expired') ? (
              <div className="decide">
                <h2>Not issuable now</h2>
                <p className="hint" style={{ margin: 0 }}>
                  {standing.org.status !== 'approved' ? 'The organisation is suspended.' : orgCurrent && orgCurrent.id !== c.id ? `${orgCurrent.number} is current until ${dmy(orgCurrent.expiresAt)}.` : !standing.rule.configured ? 'No rule is set for this partner type.' : `The organisation does not meet the rule today: ${ruleText(standing.rule)}.`}
                </p>
              </div>
            ) : null}
            {canDecline ? (
              <div>
                <h2>Decline the request</h2>
                <form action={declineRequestAction} className="form-grid" style={{ gap: 12 }}>
                  <input type="hidden" name="id" value={c.id} />
                  <Field id="reason" label="Reason, read by the Partner Admins" required span>
                    <textarea id="reason" name="reason" rows={3} required />
                  </Field>
                  <div className="form-actions span-2">
                    <button className="btn btn-line btn-sm" type="submit">
                      Decline
                    </button>
                  </div>
                </form>
                <p className="hint" style={{ margin: '8px 0 0' }}>
                  A declined request is raised again by the sweep when the rule is met after a change in the people’s certificates.
                </p>
              </div>
            ) : null}
            {canRevoke ? (
              <div>
                <h2>Revoke</h2>
                <p className="hint" style={{ margin: '0 0 12px' }}>
                  {c.kind === 'org' ? 'The organisation loses its certified standing at once: the public page reads revoked, the deal gate refuses without a waiver, the admins are told with your reason.' : 'The holder and the Partner Admins are told with your reason; the public page reads revoked; the course can be taken again.'}
                </p>
                <form action={revokeCertificateAction} className="form-grid" style={{ gap: 12 }}>
                  <input type="hidden" name="id" value={c.id} />
                  <Field id="revoke" label="Reason, recorded" required span>
                    <textarea id="revoke" name="reason" rows={3} required />
                  </Field>
                  <div className="form-actions span-2">
                    <button className="btn btn-line btn-sm" type="submit">
                      Revoke the certificate
                    </button>
                  </div>
                </form>
              </div>
            ) : null}
            <div>
              <h2>Links</h2>
              <p className="more" style={{ marginTop: 0 }}>
                <Link className="link-u" href={`${K7_PARTNERS}/${c.orgPartnerId}`}>
                  The organisation
                </Link>
                {' · '}
                <a className="link-u" href={verifyUrl} target="_blank" rel="noreferrer">
                  The public page
                </a>
                {' · '}
                <Link className="link-u" href={`/admin/collections/partner-certificates/${c.id}`}>
                  The raw row
                </Link>
              </p>
            </div>
          </aside>
        </div>
      </section>
    </>
  )
}

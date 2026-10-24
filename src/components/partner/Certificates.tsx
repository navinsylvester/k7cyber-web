import Link from 'next/link'
import QRCode from 'qrcode'
import React from 'react'

import { CERT_KIND_LABEL, CERT_STATE_LABEL, daysToExpiry, ruleText, type Certificate, type CertState, type RuleReading } from '@/lib/partner/certificates-model'
import { PARTNER_TYPE_LABEL } from '@/lib/partner/settings-model'
import { dmy, dmyHm } from '@/lib/support/format'

import { Pid } from './Parts'

/* Section 10 · Partners, the certificate parts (design-system/components/PartnerParts/README.md P33–P35): the state as a tag,
   the certificate as a filed card with its number, its facts and the QR, the rule lines (how many people the organisation
   needs per track against how many it has), the public verification sheet, the ledgers. Server components. */

/** P33 The certificate state: Valid solid, Expiring soon on signal (someone must act), Requested dashed (waiting for K7),
    Expired and Revoked closed (revoked struck through), Declined quiet, Superseded quiet. */
export const CertStateTag: React.FC<{ state: CertState | 'none'; big?: boolean }> = ({ state, big }) => {
  const cls = state === 'valid' ? 'tag tag-solid' : state === 'expiring' ? 'tag tag-signal' : state === 'requested' ? 'tag tag-dashed' : state === 'expired' ? 'tag tag-closed' : state === 'revoked' ? 'tag tag-closed is-struck' : state === 'none' ? 'tag tag-dashed' : 'tag tag-quiet'
  return <span className={`${cls}${big ? ' tag-big' : ''}`}>{state === 'none' ? 'No certificate' : CERT_STATE_LABEL[state]}</span>
}

/** The QR as inline SVG from the same modules the PDF draws, so the screen and the paper carry the same code. */
export const QrSvg: React.FC<{ content: string; size?: number; title?: string }> = ({ content, size = 120, title }) => {
  const code = QRCode.create(content, { errorCorrectionLevel: 'M' })
  const n = code.modules.size
  const cells: string[] = []
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (code.modules.data[r * n + c]) cells.push(`M${c} ${r}h1v1h-1z`)
  return (
    <svg className="cert-qr" viewBox={`0 0 ${n} ${n}`} width={size} height={size} role="img" aria-label={title ?? 'QR code'} shapeRendering="crispEdges">
      <path d={cells.join('')} fill="currentColor" />
    </svg>
  )
}

/** P33 The certificate's filed facts: who, what, when; the organisation's kind shows the rule as it stood at issue. */
export const CertFacts: React.FC<{ c: Certificate; state: CertState; verifyUrl: string }> = ({ c, state, verifyUrl }) => {
  const days = daysToExpiry(c)
  return (
    <dl className="meta-rows cert-facts">
      <dt>Status</dt>
      <dd className="sans">
        <CertStateTag state={state} />
        {state === 'expiring' && days !== null ? <span className="muted"> · {days} day{days === 1 ? '' : 's'} left</span> : null}
      </dd>
      {c.kind === 'individual' ? (
        <>
          <dt>Holder</dt>
          <dd className="sans">{c.userName}</dd>
          <dt>Organisation</dt>
          <dd className="sans">
            {c.orgTradeName || c.orgName} · <Pid id={c.orgPartnerId} />
          </dd>
          <dt>Course</dt>
          <dd className="sans">
            {c.courseTitle}
            {c.trackName ? <span className="muted"> · {c.trackName} track · v{c.courseVersion}</span> : null}
          </dd>
          <dt>Score</dt>
          <dd>
            {c.score ?? 0}% <span className="muted sans">· {c.band || 'Pass'}</span>
          </dd>
        </>
      ) : (
        <>
          <dt>Organisation</dt>
          <dd className="sans">
            {c.orgName} · <Pid id={c.orgPartnerId} />
          </dd>
          <dt>Partner type</dt>
          <dd className="sans">{c.orgType ? PARTNER_TYPE_LABEL[c.orgType] : '—'}</dd>
          {c.ruleLines.length ? (
            <>
              <dt>Rule at issue</dt>
              <dd className="sans">{c.ruleLines.map((l) => `${l.have} of ${l.need} on ${l.trackName}`).join(' · ')}</dd>
            </>
          ) : null}
          {c.issuedBy ? (
            <>
              <dt>Issued by</dt>
              <dd className="sans">{c.issuedBy}</dd>
            </>
          ) : null}
        </>
      )}
      {c.status === 'requested' ? (
        <>
          <dt>Requested</dt>
          <dd>{c.requestedAt ? dmyHm(c.requestedAt) : '—'}</dd>
        </>
      ) : (
        <>
          <dt>Issued</dt>
          <dd>{c.issuedAt ? dmy(c.issuedAt) : '—'}</dd>
          <dt>Valid to</dt>
          <dd>{c.expiresAt ? dmy(c.expiresAt) : '—'}</dd>
        </>
      )}
      {c.status === 'revoked' ? (
        <>
          <dt>Revoked</dt>
          <dd className="sans">
            {c.revokedAt ? dmyHm(c.revokedAt) : ''}
            {c.revokedReason ? ` · ${c.revokedReason}` : ''}
          </dd>
        </>
      ) : null}
      {c.status === 'declined' ? (
        <>
          <dt>Declined</dt>
          <dd className="sans">
            {c.declinedAt ? dmyHm(c.declinedAt) : ''}
            {c.declinedReason ? ` · ${c.declinedReason}` : ''}
          </dd>
        </>
      ) : null}
      {c.supersededBy ? (
        <>
          <dt>Replaced by</dt>
          <dd>{c.supersededBy}</dd>
        </>
      ) : null}
      {c.renewalOf ? (
        <>
          <dt>Renews</dt>
          <dd>{c.renewalOf}</dd>
        </>
      ) : null}
      <dt>Verify at</dt>
      <dd>
        <a className="link-u" href={verifyUrl}>
          {verifyUrl.replace(/^https?:\/\//, '')}
        </a>
      </dd>
    </dl>
  )
}

/** P35 The rule lines: per track, the people certified against the people needed, as cells on the track's bars (ink for
    each person held, line for each still needed) with the count in mono; signal on the line that is short. */
export const RuleLines: React.FC<{ rule: RuleReading; compact?: boolean }> = ({ rule, compact }) =>
  !rule.configured ? (
    <p className="muted" style={{ margin: 0, fontSize: 15 }}>
      No rule is set for this partner type; K7 sets one under Settings → Certificates.
    </p>
  ) : (
    <ul className={`rule-lines${compact ? ' is-compact' : ''}`} aria-label="The rule">
      {rule.lines.map((l) => {
        const cells = Math.max(l.need, Math.min(l.have, 12))
        return (
          <li key={l.track} className={l.have >= l.need ? 'is-met' : 'is-short'}>
            <span className="rule-track">{l.trackName}</span>
            <span className="mbar" title={`${l.have} of ${l.need} people certified on ${l.trackName}`}>
              <span className="mbar-cells" aria-hidden="true">
                {Array.from({ length: cells }, (_, i) => (
                  <i key={i} className={i < l.have ? 'is-done' : undefined} />
                ))}
              </span>
              <span className="mbar-n">
                {String(Math.min(l.have, 99)).padStart(2, '0')}/{String(l.need).padStart(2, '0')}
              </span>
            </span>
            <span className="rule-words label">{l.have >= l.need ? 'met' : `${l.need - l.have} more needed`}</span>
          </li>
        )
      })}
    </ul>
  )

export const ruleSentence = ruleText

/** P35 The certificates ledger: number, kind or course, holder, state, issued, valid to; one row per certificate. */
export const CertLedger: React.FC<{ rows: { c: Certificate; state: CertState }[]; href: (c: Certificate) => string; label: string; who?: boolean; org?: boolean; empty?: string }> = ({ rows, href, label, who = true, org, empty = 'No certificate yet.' }) => (
  <div className="filed ledger cert-ledger">
    <span className="ftab label">
      {label} <span className="muted">· {String(rows.length).padStart(2, '0')}</span>
    </span>
    <div className="table-wrap">
      <table className="dtable cert-table">
        <thead>
          <tr>
            <th scope="col">Certificate</th>
            {who ? <th scope="col">Holder</th> : null}
            {org ? <th scope="col">Organisation</th> : null}
            <th scope="col">For</th>
            <th scope="col">State</th>
            <th scope="col">Issued</th>
            <th scope="col">Valid to</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ c, state }) => (
            <tr className={`row${state === 'expired' || state === 'revoked' || state === 'superseded' || state === 'declined' ? ' is-off' : ''}`} key={c.id}>
              <td className="title">
                <Pid id={c.number} href={href(c)} />
                <div className="muted mono-note">{c.kind === 'org' ? 'Partner certificate' : 'Individual'}</div>
              </td>
              {who ? <td className="text">{c.kind === 'org' ? <span className="muted">The organisation</span> : c.userName}</td> : null}
              {org ? (
                <td className="text">
                  {c.orgTradeName || c.orgName}
                  <div className="muted mono-note">{c.orgPartnerId}</div>
                </td>
              ) : null}
              <td className="text">
                {c.kind === 'org' ? `K7 Partner Programme · ${c.orgType ? PARTNER_TYPE_LABEL[c.orgType] : ''}` : c.courseTitle}
                {c.kind === 'individual' && c.score !== null ? <div className="muted mono-note">{c.score}% · {c.band}</div> : null}
              </td>
              <td className="status">
                <CertStateTag state={state} />
              </td>
              <td className="num">{c.issuedAt ? dmy(c.issuedAt) : c.requestedAt ? <span className="muted">asked {dmy(c.requestedAt)}</span> : '—'}</td>
              <td className="num">{c.expiresAt ? dmy(c.expiresAt) : '—'}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr className="row">
              <td colSpan={5 + (who ? 1 : 0) + (org ? 1 : 0)} className="muted">
                {empty}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  </div>
)

/** P33 The organisation's certificate as the partner reads it on the certificates page and the home: one filed card with the
    state large, the number, the dates and the rule lines beneath; the one action is the PDF. */
export const OrgCertCard: React.FC<{ current: Certificate | null; state: CertState | 'none'; rule: RuleReading; href?: string; fileHref?: string; typeLabel: string }> = ({ current, state, rule, href, fileHref, typeLabel }) => (
  <section className="filed cert-card" aria-label="Partner certificate">
    <span className="ftab label">{CERT_KIND_LABEL.org}</span>
    <div className="cert-card-body">
      <div className="cert-card-head">
        <CertStateTag state={state} big />
        {current && current.status !== 'requested' && current.status !== 'declined' ? <Pid id={current.number} href={href} display /> : null}
      </div>
      <p className="cert-card-words">
        {state === 'none'
          ? `Your organisation (${typeLabel}) earns its K7 Partner Certificate once enough of your people hold a current individual certificate on each track below. K7 is asked to issue it the moment the rule is met.`
          : state === 'requested'
            ? `The rule is met; K7 has been asked to issue the certificate${current?.requestedAt ? ` (${dmy(current.requestedAt)})` : ''}. It arrives here and by email once a Channel Manager issues it.`
            : state === 'declined'
              ? `K7 did not issue the certificate for now${current?.declinedReason ? `: ${current.declinedReason}` : '.'} The request is raised again when the rule is met after a change.`
              : state === 'valid'
                ? `Issued ${dmy(current!.issuedAt)}, valid to ${dmy(current!.expiresAt)}. Keep your people certified: the renewal request goes to K7 by itself when it lapses, provided the rule still holds.`
                : state === 'expiring'
                  ? `Expires ${dmy(current!.expiresAt)}. ${rule.met ? 'Your organisation still meets the rule, so K7 will be asked to renew it when it lapses.' : 'Your organisation does not meet the rule at the moment; have your people recertify before then.'}`
                  : state === 'expired'
                    ? `Expired ${dmy(current!.expiresAt)}. ${rule.met ? 'The rule is met, so K7 has been asked to renew it.' : 'The rule is not met; once your people recertify, K7 is asked to renew it.'}`
                    : `Revoked${current?.revokedAt ? ` ${dmy(current.revokedAt)}` : ''}${current?.revokedReason ? `: ${current.revokedReason}` : '.'} Ask your Channel Manager what is needed.`}
      </p>
      <RuleLines rule={rule} />
      {fileHref && current && (state === 'valid' || state === 'expiring' || state === 'expired') ? (
        <p className="more" style={{ marginTop: 16 }}>
          <Link className="btn btn-line btn-sm" href={fileHref}>
            Download the PDF
          </Link>
          {href ? (
            <>
              {' '}
              <Link className="link-u" href={href} style={{ marginLeft: 12 }}>
                The certificate
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  </section>
)

import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { CertLedger } from '@/components/partner/Certificates'
import { K7Nav } from '@/components/partner/K7Nav'
import { Empty, Flash } from '@/components/partner/Parts'
import { certificateCounts, K7_CERTIFICATES, k7CertificateHref, k7CertificateLedger, type K7CertView } from '@/lib/partner/certificates'
import { jobLines } from '@/lib/partner/ops'
import { requireK7Role } from '@/lib/partner/session'
import { getPartnerSettings, PARTNER_TYPE_LABEL } from '@/lib/partner/settings'

import { runCertificateSweepAction } from './actions'

export const metadata: Metadata = { title: 'Certificates' }

type SP = { view?: string; ok?: string; error?: string }
const VIEWS: { key: K7CertView; label: string }[] = [
  { key: 'requests', label: 'To issue' },
  { key: 'expiring', label: 'Expiring' },
  { key: 'valid', label: 'Valid' },
  { key: 'org', label: 'Partner certificates' },
  { key: 'expired', label: 'Expired' },
  { key: 'revoked', label: 'Revoked · declined' },
  { key: 'all', label: 'All' },
]

/* The certificates desk (FR-CRT-02, 05, 07; FR-TRN-07): the requests to issue first, then every certificate by state; the rule
   per partner type as the settings hold it; the sweep's last run and its Run button. Channel Managers issue, decline and revoke;
   Training Admins read and may revoke an individual certificate. */
export default async function K7CertificatesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const me = await requireK7Role(['channelManager', 'trainingAdmin'], K7_CERTIFICATES)
  const view = (VIEWS.some((v) => v.key === sp.view) ? sp.view : 'requests') as K7CertView
  const [rows, counts, settings, jobs] = await Promise.all([k7CertificateLedger(view), certificateCounts(), getPartnerSettings(), jobLines()])
  const sweep = jobs.find((j) => j.key === 'certificatesSweep')
  const counter = (label: string, n: number, href: string, hot = false) => (
    <Link className={`kpi${hot && n > 0 ? ' is-signal' : ''}`} href={href} key={label}>
      <span className="n">{n}</span>
      <span className="label">{label}</span>
    </Link>
  )
  const types = settings.partnerTypes
  const tracks = [...new Set(settings.certificates.rules.map((r) => r.track))]
  return (
    <>
      <K7Nav active="certificates" roles={me.roles} counts={{ certificates: counts.requests }} />
      <section className="sheet ws g-paper">
        <div className="ws-head">
          <div className="ws-head-main">
            <span className="label muted">Partner desk · certificates</span>
            <h1 className="h-util">Certificates.</h1>
            <p className="lede">Individual certificates are issued by the portal when a test is passed. The K7 Partner Certificate is yours to issue: when an organisation meets the rule for its type, a request lands here; issue it, or decline with a reason. Either kind can be revoked with a reason, and the public page says so.</p>
          </div>
          <div className="ws-actions">
            {me.roles.includes('channelManager') ? (
              <form action={runCertificateSweepAction}>
                <button className="btn btn-line btn-sm" type="submit" title={sweep?.note}>
                  Run the sweep
                </button>
              </form>
            ) : null}
            <Link className="link-u" href="/partners/portal/k7/settings#certificates">
              The rules and validity
            </Link>
          </div>
        </div>
        {sp.ok && <Flash>{sp.ok}</Flash>}
        {sp.error && <Flash kind="error">{sp.error}</Flash>}

        <div className="kpis" style={{ marginBottom: 'clamp(32px, 4cqw, 48px)' }}>
          {counter('To issue', counts.requests, `${K7_CERTIFICATES}?view=requests`, true)}
          {counter('Expiring soon', counts.expiring, `${K7_CERTIFICATES}?view=expiring`)}
          {counter('Valid', counts.valid, `${K7_CERTIFICATES}?view=valid`)}
          {counter('Certified organisations', counts.orgsCertified, `${K7_CERTIFICATES}?view=org`)}
          {counter('Expired', counts.expired, `${K7_CERTIFICATES}?view=expired`)}
          {counter('Revoked', counts.revoked, `${K7_CERTIFICATES}?view=revoked`)}
        </div>

        <form className="views" action={K7_CERTIFICATES} method="get">
          <div className="seg-choice" role="group" aria-label="View">
            {VIEWS.map((v) => (
              <label key={v.key}>
                <input type="radio" name="view" value={v.key} defaultChecked={view === v.key} />
                {v.label}
              </label>
            ))}
          </div>
          <button className="btn btn-line btn-sm" type="submit">
            Show
          </button>
        </form>

        <div className="phome">
          <div>
            {rows.length === 0 ? (
              <Empty label={VIEWS.find((v) => v.key === view)?.label}>{view === 'requests' ? 'No request waits. One arrives when an organisation first meets the rule for its type, or meets it again after its certificate lapsed.' : 'Nothing in this view.'}</Empty>
            ) : (
              <CertLedger rows={rows} href={k7CertificateHref} label={VIEWS.find((v) => v.key === view)?.label ?? 'Certificates'} org />
            )}
          </div>
          <aside className="ws-side">
            <div>
              <h2>The rule per type</h2>
              <p className="muted" style={{ margin: '0 0 12px', fontSize: 15 }}>
                People who must hold a current individual certificate on each track before the organisation earns its partner certificate (FR-CRT-01).
              </p>
              <div className="table-wrap">
                <table className="dtable rule-table">
                  <thead>
                    <tr>
                      <th scope="col">Type</th>
                      {tracks.map((t) => (
                        <th scope="col" className="num" key={t}>
                          {t}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {types.map((ty) => (
                      <tr key={ty}>
                        <td className="title">{PARTNER_TYPE_LABEL[ty]}</td>
                        {tracks.map((t) => {
                          const r = settings.certificates.rules.find((x) => x.type === ty && x.track === t)
                          return (
                            <td className="num" key={t}>
                              {r && r.people > 0 ? String(r.people).padStart(2, '0') : <span className="muted">—</span>}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="more">
                Validity {settings.certificates.validityMonths} months (individual) · {settings.certificates.orgValidityMonths} months (organisation) · reminders at {settings.certificates.reminderDays.join(' and ')} days · Merit from {settings.certificates.meritFrom}%, Distinction from {settings.certificates.distinctionFrom}%.
              </p>
            </div>
            <div>
              <h2>The sweep</h2>
              <p className="muted" style={{ margin: 0, fontSize: 15 }}>
                Daily: expires certificates past their date, sends the reminders once each, issues certificates for passes that predate them, keeps every organisation’s standing true and raises the renewal request where the rule holds. {sweep ? (sweep.last ? `Last run ${sweep.note}` : sweep.note) : ''}
              </p>
            </div>
          </aside>
        </div>
      </section>
    </>
  )
}

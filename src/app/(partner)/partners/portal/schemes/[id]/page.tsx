import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { CountedLedger, PhaseTag, ProgressLine, RegistrationTag, SlabTable } from '@/components/partner/Schemes'
import { Synced } from '@/components/partner/Dashboard'
import { Flash, Strip } from '@/components/partner/Parts'
import { PARTNER_DEALS } from '@/lib/partner/deals'
import { loadSchemeFor, PARTNER_SCHEMES, progressOf } from '@/lib/partner/schemes'
import { applicabilityText, hasStarted, isOpenForRegistration, registerBlocked, schemePhase } from '@/lib/partner/schemes-model'
import { requirePartner } from '@/lib/partner/session'
import { getPartnerSettings, PARTNER_TYPE_LABEL } from '@/lib/partner/settings'
import { crmFeatureOn } from '@/lib/partner/settings-model'
import { lastUpdatedFor } from '@/lib/partner/sync'
import { dmy, dmyHm } from '@/lib/support/format'

import { registerSchemeAction } from '../actions'

export const metadata: Metadata = { title: 'Scheme' }

type SP = { ok?: string; error?: string }

/* One scheme for the partner (FR-SCH-01 … 05): what it rewards, when it runs, who it is for, the slabs, the document; the
   registration (the terms accepted by a Partner Admin) while it is open; the organisation's progress against the slabs while it
   runs, provisional, from the deals' CRM snapshots; and the way to the result once published. Reached only for a scheme the
   organisation may see; anything else is a 404. */
export default async function SchemePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const me = await requirePartner(`${PARTNER_SCHEMES}/${id}`)
  const view = await loadSchemeFor(me, id)
  if (!view) notFound()
  const { scheme: sc, registration: reg, result } = view
  const settings = await getPartnerSettings()
  const phase = schemePhase(sc)
  const registered = reg?.status === 'approved'
  const showProgress = registered && hasStarted(sc) && !result
  const [progress, synced] = showProgress ? await Promise.all([progressOf(me.scope, sc), lastUpdatedFor(me.scope)]) : [null, null]
  const admin = me.roles.includes('admin')
  const blocked = registerBlocked(sc, me.org, me.user, reg, true)
  const canRegister = admin && isOpenForRegistration(sc) && (!reg || reg.status === 'declined') && !blocked
  const regionName = (code: string) => settings.regions.find((r) => r.code === code)?.name ?? code
  return (
    <section className="sheet ws g-paper">
      <div className="ws-head">
        <div className="ws-head-main">
          <span className="label muted">
            <Link className="link-u" href={PARTNER_SCHEMES}>
              Schemes
            </Link>{' '}
            · {applicabilityText(sc, (t) => PARTNER_TYPE_LABEL[t], regionName)}
          </span>
          <h1 className="h-util">{sc.name}.</h1>
          {sc.description ? <p className="lede">{sc.description}</p> : null}
        </div>
        <div className="ws-actions">
          {result ? (
            <Link className="btn btn-primary" href={`${PARTNER_SCHEMES}/${sc.id}/eligibility`}>
              Check eligibility →
            </Link>
          ) : canRegister ? (
            <a className="btn btn-primary" href="#register">
              Register →
            </a>
          ) : null}
          {sc.attachment ? (
            <a className="link-u" href={`${PARTNER_SCHEMES}/${sc.id}/attachment`} target="_blank" rel="noopener">
              Scheme document (PDF)
            </a>
          ) : null}
        </div>
      </div>
      {sp.ok && <Flash>{sp.ok}</Flash>}
      {sp.error && <Flash kind="error">{sp.error}</Flash>}
      <Strip
        items={[
          { label: 'Phase', value: <PhaseTag phase={phase} /> },
          { label: 'Runs', value: `${dmy(sc.startDate)} – ${dmy(sc.endDate)}` },
          { label: 'Register by', value: dmy(sc.registrationDeadline) },
          { label: 'Your organisation', value: <RegistrationTag status={reg?.status ?? null} /> },
          { label: 'Target', value: sc.slabs[0] ? `₹${sc.slabs[0].threshold.toLocaleString('en-IN')} won` : '—' },
        ]}
      />
      {showProgress && progress ? (
        <>
          <Synced at={synced} minutes={settings.crm.syncMinutes} mirrorOn={crmFeatureOn(settings, 'sync')} />
          <ProgressLine slabs={sc.slabs} value={progress.achieved} provisional={progress.provisional} label="Your progress" />
        </>
      ) : null}
      <div className="phome">
        <div>
          {showProgress && progress ? (
            <>
              <h2>Deals counted so far</h2>
              <p className="muted sch-lede">
                Deals K7’s CRM records as won with a close date inside {dmy(sc.startDate)} – {dmy(sc.endDate)}{sc.productNames.length ? `, on ${sc.productNames.join(', ')}` : ''}, at their order value. Provisional until the scheme closes and K7 publishes the results.
              </p>
              <CountedLedger deals={progress.deals} href={(d) => `${PARTNER_DEALS}/${d}`} label={`${progress.deals.length} deal${progress.deals.length === 1 ? '' : 's'} · provisional`} />
              <h2 style={{ marginTop: 'clamp(28px, 3cqw, 40px)' }}>Slabs</h2>
              <SlabTable slabs={sc.slabs} reached={progress.standing.slabIndex} value={progress.achieved} />
            </>
          ) : (
            <>
              <h2>Slabs</h2>
              <SlabTable slabs={sc.slabs} />
            </>
          )}
          <h2 style={{ marginTop: 'clamp(28px, 3cqw, 40px)' }}>Terms and conditions</h2>
          <p className="terms-text">{sc.terms}</p>
          {canRegister ? (
            <form id="register" action={registerSchemeAction} className="terms-box" style={{ marginTop: 20 }}>
              <input type="hidden" name="schemeId" value={sc.id} />
              <label className="check">
                <input type="checkbox" name="accept" value="1" required /> I accept the terms of {sc.name} on behalf of {me.org.tradeName || me.org.name}; the acceptance is recorded with my name and the time.
              </label>
              <div className="form-actions" style={{ marginTop: 16 }}>
                <button className="btn btn-primary" type="submit">
                  {sc.approvalRequired ? 'Send the registration →' : 'Register the organisation →'}
                </button>
                <span className="hint">{sc.approvalRequired ? 'K7 approves each registration for this scheme.' : 'Registering is immediate.'}</span>
              </div>
            </form>
          ) : null}
        </div>
        <aside className="ws-side">
          <div>
            <h2>Registration</h2>
            {reg ? (
              <dl className="meta-rows">
                <dt>State</dt>
                <dd className="sans">
                  <RegistrationTag status={reg.status} />
                </dd>
                <dt>Terms accepted</dt>
                <dd className="sans">
                  {reg.acceptedAt ? dmyHm(reg.acceptedAt) : '—'} by {reg.acceptedBy.name || reg.acceptedBy.email}
                </dd>
                {reg.decision.at ? (
                  <>
                    <dt>K7’s decision</dt>
                    <dd className="sans">
                      {dmy(reg.decision.at)}
                      {reg.decision.note ? ` · ${reg.decision.note}` : ''}
                    </dd>
                  </>
                ) : null}
              </dl>
            ) : (
              <p className="muted" style={{ margin: 0, fontSize: 15 }}>
                {blocked && !admin ? 'A Partner Admin of your organisation registers it for a scheme.' : blocked ?? 'Accept the terms below to register.'}
              </p>
            )}
          </div>
          <div>
            <h2>How it is counted</h2>
            <p className="muted" style={{ margin: 0, fontSize: 15 }}>
              Deals registered here and recorded as won in K7’s CRM, with a close date inside the scheme’s dates{sc.productNames.length ? ` and ${sc.productNames.join(' or ')} among the products` : ''}, at their order value. After {dmy(sc.endDate)} K7 computes the results, reviews them and publishes them here; the dispute window is {sc.disputeDays ?? settings.schemes.disputeDays} days from publication.
            </p>
          </div>
        </aside>
      </div>
    </section>
  )
}

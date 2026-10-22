import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { ApplicationSummary } from '@/components/partner/Join'
import { K7Nav } from '@/components/partner/K7Nav'
import { Aid, AppStateTag, Field, Flash, Pid, Strip, TypeTag } from '@/components/partner/Parts'
import { Crumbs } from '@/components/support/Parts'
import { objectAudit } from '@/lib/partner/audit'
import { outboxOf } from '@/lib/partner/mirror'
import { findByNumber, K7_APPLICATIONS, orgOfApplication } from '@/lib/partner/registration'
import { requireK7Role } from '@/lib/partner/session'
import { getPartnerSettings } from '@/lib/partner/settings'
import { DECISION_LABEL, decisionPath, type Decision } from '@/lib/partner/status'
import { dmy, dmyHm, relative } from '@/lib/support/format'

import { assignAction, decideAction, runOutboxAction } from '../actions'

export const metadata: Metadata = { title: 'Application' }

/* One application for the Channel Manager (FR-REG-05, FR-REG-06): the filed facts, the decision panel (take it; approve, reject
   with a reason, send back with a note), the record of decisions, and after approval the organisation and the CRM job's state. */
export default async function K7ApplicationPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [{ number }, sp] = await Promise.all([params, searchParams])
  const me = await requireK7Role(['channelManager'], `${K7_APPLICATIONS}/${number}`)
  const app = await findByNumber(number)
  if (!app) notFound()
  const [settings, trail, org, jobs] = await Promise.all([getPartnerSettings(), objectAudit('partner-applications', app.id), orgOfApplication(app), app.orgId ? outboxOf('partner-orgs', app.orgId) : Promise.resolve([])])
  const regions = settings.regions.filter((r) => app.regions.includes(r.code)).map((r) => r.name)
  const decisions = (['approve', 'clarify', 'reject'] as Decision[]).filter((d) => decisionPath(app.status, d).length)
  const mineToTake = app.status === 'submitted' || (app.status === 'underReview' && app.assignee.email !== me.email)
  const job = jobs[0]
  return (
    <>
      <K7Nav active="applications" roles={me.roles} />
      <section className="sheet ws g-paper">
        <Crumbs items={[{ label: 'Applications', href: K7_APPLICATIONS }, { label: app.number }]} />
        <div className="ws-head" style={{ marginTop: 16 }}>
          <div className="ws-head-main">
            <Aid number={app.number} display />
            <h1 className="h-util">{app.company.legalName || 'Unnamed company'}.</h1>
            <p className="lede">
              {app.contact.name} ({app.contact.designation || 'no designation'}) applied on {app.submittedAt ? dmy(app.submittedAt) : '—'} for {app.company.tradeName && app.company.tradeName !== app.company.legalName ? `${app.company.tradeName}, ` : ''}
              {app.company.city}
              {app.company.city && app.company.country ? ', ' : ''}
              {app.company.country}.
            </p>
          </div>
          {mineToTake && (
            <form action={assignAction} className="ws-actions">
              <input type="hidden" name="number" value={app.number} />
              <button className="btn btn-line" type="submit">
                {app.status === 'submitted' ? 'Take this application →' : 'Reassign to me'}
              </button>
            </form>
          )}
        </div>
        {sp.ok && <Flash>{sp.ok}</Flash>}
        {sp.error && <Flash kind="error">{sp.error}</Flash>}
        <Strip
          items={[
            { label: 'Status', value: <AppStateTag status={app.status} /> },
            { label: 'Type', value: <TypeTag type={app.type} /> },
            { label: 'Assigned to', value: app.assignee.name || app.assignee.email || '—' },
            { label: 'Waiting', value: app.status === 'submitted' || app.status === 'underReview' ? relative(app.decisions[app.decisions.length - 1]?.at ?? app.submittedAt ?? app.createdAt) : app.status === 'clarification' ? 'On the partner' : app.decidedAt ? `Decided ${dmy(app.decidedAt)}` : '—' },
            ...(org ? [{ label: 'Organisation', value: <Pid id={org.partnerId} /> }] : []),
          ]}
        />
        <div className="phome">
          <div>
            <ApplicationSummary app={app} regions={regions} k7 />
            {trail.length > 0 && (
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
                        <strong>{t.action.replace(/^application\./, '').replace(/[.-]/g, ' ')}</strong>
                        <p>
                          {t.actor.name || t.actor.email || 'Portal'}
                          {t.from || t.to ? ` · ${t.from || '—'} → ${t.to || '—'}` : ''}
                          {t.comment ? ` · ${t.comment}` : ''}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>
          <aside className="ws-side">
            {decisions.length > 0 ? (
              <div className="decide">
                <h2>Decide</h2>
                <p className="hint" style={{ margin: '0 0 16px' }}>
                  {app.status === 'submitted' ? 'Deciding now assigns it to you first.' : 'The applicant reads your note by email.'} Approval creates the organisation, invites {app.contact.name || 'the contact'} as Partner Admin{settings.crm.enabled ? ' and writes the account to Dynamics' : ''}.
                </p>
                <form action={decideAction} className="form-grid" style={{ gap: 16 }}>
                  <input type="hidden" name="number" value={app.number} />
                  <fieldset className="field span-2" style={{ border: 0, padding: 0, margin: 0 }}>
                    <legend className="label" style={{ color: 'var(--mu)', marginBottom: 10 }}>
                      Decision
                    </legend>
                    <div className="choice" style={{ gridTemplateColumns: '1fr' }}>
                      {decisions.map((d, i) => (
                        <label key={d}>
                          <input type="radio" name="decision" value={d} defaultChecked={i === 0} required />
                          <span className="t">{DECISION_LABEL[d]}</span>
                          <span className="d">{d === 'approve' ? 'Creates the organisation and the Partner Admin.' : d === 'reject' ? 'Final. The reason goes to the applicant.' : 'The applicant edits and resubmits; it comes back as new.'}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <Field id="comment" label="Note to the applicant" span hint="Required for a rejection or a clarification; optional on approval.">
                    <textarea id="comment" name="comment" rows={4} placeholder="What you need, or why not." />
                  </Field>
                  <div className="form-actions span-2">
                    <button className="btn btn-primary" type="submit">
                      Record the decision →
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div>
                <h2>Decided</h2>
                <p className="hint" style={{ margin: 0 }}>
                  {app.status === 'approved' ? `Approved ${app.decidedAt ? dmyHm(app.decidedAt) : ''}${app.assignee.name ? ` by ${app.assignee.name}` : ''}.` : app.status === 'rejected' ? `Rejected ${app.decidedAt ? dmyHm(app.decidedAt) : ''}.` : 'Waiting on the applicant.'}
                </p>
              </div>
            )}
            {org && (
              <div>
                <h2>Organisation</h2>
                <dl className="meta-rows label">
                  <dt>Partner ID</dt>
                  <dd>
                    <Pid id={org.partnerId} />
                  </dd>
                  <dt>Partner Admin</dt>
                  <dd className="sans">{app.contact.email}</dd>
                  <dt>CRM account</dt>
                  <dd className="sans">
                    {job ? (
                      <>
                        {job.state === 'done' ? `Created${job.result.accountCode ? ` as ${String(job.result.accountCode)}` : ''}` : job.state === 'pending' ? (settings.crm.enabled ? 'Queued' : 'Queued; the mirror is off in settings') : job.state === 'skipped' ? `Skipped: ${job.lastError}` : `Failed: ${job.lastError}`}
                        {job.state !== 'done' && settings.crm.enabled && (
                          <form action={runOutboxAction} style={{ marginTop: 8 }}>
                            <input type="hidden" name="number" value={app.number} />
                            <input type="hidden" name="job" value={job.id} />
                            <button className="btn btn-line btn-sm" type="submit">
                              {job.state === 'pending' ? 'Run now' : 'Retry'}
                            </button>
                          </form>
                        )}
                      </>
                    ) : (
                      'No job'
                    )}
                  </dd>
                </dl>
                <p className="more">
                  <Link className="link-u" href={`/admin/collections/partner-orgs/${org.id}`}>
                    The raw row in the admin
                  </Link>
                </p>
              </div>
            )}
          </aside>
        </div>
      </section>
    </>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { ConflictBox, DealFacts, DealStateTag, DealThread, Did, Protection } from '@/components/partner/Deals'
import { K7Nav } from '@/components/partner/K7Nav'
import { Field, Flash, Pid, Strip } from '@/components/partner/Parts'
import { SlaValue } from '@/components/partner/Sla'
import { Crumbs } from '@/components/support/Parts'
import { objectAudit } from '@/lib/partner/audit'
import { findConflicts, findDealByNumber, K7_DEALS } from '@/lib/partner/deals'
import { formatInr, k7MayAmend, mayAddNote } from '@/lib/partner/deals-model'
import { CrmFacts } from '@/components/partner/Dashboard'
import { outboxOf } from '@/lib/partner/mirror'
import { requireK7Role } from '@/lib/partner/session'
import { getPartnerSettings } from '@/lib/partner/settings'
import { readingFor } from '@/lib/partner/sla'
import { dealClock } from '@/lib/partner/sla-model'
import { canDecideDeal, DEAL_DECISION_LABEL, type DealDecision } from '@/lib/partner/status'
import { dmy, dmyHm, relative } from '@/lib/support/format'

import { amendDealAction, decideDealAction, decideExtensionAction, k7NoteAction, runDealOutboxAction, syncNowAction } from '../actions'

export const metadata: Metadata = { title: 'Deal' }

/* One deal for the Deal Desk Approver (FR-DEAL-04 to 07, FR-DEAL-09): the conflicts live, the filed facts, the protection, the
   thread with K7's note form, the record; in the side column the decision panel (approve, approve with changes, request
   information, reject), the extension decision, the amendment form once approved, and the CRM job with Run / Retry. */
export default async function K7DealPage({ params, searchParams }: { params: Promise<{ dealId: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [{ dealId }, sp] = await Promise.all([params, searchParams])
  const me = await requireK7Role(['dealDeskApprover'], `${K7_DEALS}/${dealId}`)
  const deal = await findDealByNumber(dealId)
  if (!deal) notFound()
  const [settings, conflicts, trail, jobs] = await Promise.all([getPartnerSettings(), findConflicts({ id: deal.id, customerKey: deal.customerKey, emailDomain: deal.emailDomain, customer: { email: deal.customer.email } }), objectAudit('partner-deals', deal.id), outboxOf('partner-deals', deal.id)])
  const decisions = (['approve', 'approveWithChanges', 'requestInfo', 'reject'] as DealDecision[]).filter((d) => canDecideDeal(deal.status, d))
  const job = jobs[0]
  const clock = dealClock(deal)
  const base = `${K7_DEALS}/${deal.dealId}`
  const changeFields = (prefix: string) => (
    <>
      <Field id={`${prefix}-expectedValue`} label="Expected value (₹)">
        <input id={`${prefix}-expectedValue`} name="expectedValue" type="number" min={1} step={1} inputMode="numeric" defaultValue={deal.expectedValue} />
      </Field>
      <Field id={`${prefix}-closeDate`} label="Expected closure">
        <input id={`${prefix}-closeDate`} name="closeDate" type="date" defaultValue={deal.closeDate.slice(0, 10)} />
      </Field>
      <Field id={`${prefix}-customerName`} label="Customer name" span>
        <input id={`${prefix}-customerName`} name="customerName" type="text" defaultValue={deal.customer.name} />
      </Field>
    </>
  )
  return (
    <>
      <K7Nav active="deals" roles={me.roles} />
      <section className="sheet ws g-paper">
        <Crumbs items={[{ label: 'Deals', href: K7_DEALS }, { label: deal.dealId }]} />
        <div className="ws-head" style={{ marginTop: 16 }}>
          <div className="ws-head-main">
            <Did id={deal.dealId} display />
            <h1 className="h-util">{deal.customer.name}.</h1>
            <p className="lede">
              Registered by {deal.registeredBy.name || deal.registeredBy.email} of {deal.orgName} on {deal.submittedAt ? dmy(deal.submittedAt) : '—'}
              {deal.reseller.name ? `, for the reseller ${deal.reseller.name}` : ''}: {deal.products.map((l) => `${l.name} × ${l.quantity}`).join(', ') || 'no product line'}, {formatInr(deal.expectedValue)}, closing {deal.closeDate ? dmy(deal.closeDate) : '—'}.
            </p>
          </div>
        </div>
        {sp.ok && <Flash>{sp.ok}</Flash>}
        {sp.error && <Flash kind="error">{sp.error}</Flash>}
        <Strip
          items={[
            { label: 'Status', value: <DealStateTag status={deal.status} /> },
            { label: 'Partner', value: <Pid id={deal.orgPartnerId} href={`/partners/portal/k7/partners/${deal.orgPartnerId}`} /> },
            { label: 'Conflicts', value: conflicts.length ? <span className="tag tag-signal">{conflicts.length} possible</span> : 'None found' },
            { label: 'Waiting', value: clock ? relative(clock.startedAt) : deal.status === 'infoRequested' ? 'On the partner' : deal.decidedAt ? `Decided ${dmy(deal.decidedAt)}` : '—' },
            ...(clock ? [{ label: 'Decision due', value: <SlaValue reading={readingFor(clock, settings)} sla={settings.sla} hours={settings.deals.approvalSlaHours} /> }] : []),
            { label: 'Protected until', value: deal.protectionEnds ? dmy(deal.protectionEnds) : '—' },
            { label: 'CRM', value: deal.crm.opportunityNo || (job ? job.state : '—') },
          ]}
        />
        <Protection deal={deal} />
        <div className="phome">
          <div>
            <ConflictBox conflicts={conflicts} stored={deal.conflicts.length} />
            <div style={{ marginTop: 'clamp(28px, 3cqw, 40px)' }}>
              <DealFacts deal={deal} k7 />
            </div>
            <h2 className="sub-head" style={{ marginTop: 40 }}>
              Thread
            </h2>
            <DealThread deal={deal} you="k7" fileHref={(id) => `${base}/file/${id}`} />
            {mayAddNote(deal.status) && (
              <form action={k7NoteAction} className="form-grid" style={{ marginTop: 24 }}>
                <input type="hidden" name="dealId" value={deal.dealId} />
                <Field id="text" label="Add a note for the partner" span>
                  <textarea id="text" name="text" rows={3} />
                </Field>
                <Field id="files" label="Attach files" span>
                  <input id="files" name="files" type="file" multiple accept=".pdf,image/*,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" />
                </Field>
                <div className="form-actions span-2">
                  <button className="btn btn-line" type="submit">
                    Add to the thread →
                  </button>
                </div>
              </form>
            )}
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
                        <strong>{t.action.replace(/^deal\./, '').replace(/[.-]/g, ' ')}</strong>
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
            {decisions.length > 0 && (
              <div className="decide">
                <h2>Decide</h2>
                <p className="hint" style={{ margin: '0 0 16px' }}>
                  Approval protects the deal for {settings.deals.protectionDays} days{settings.crm.enabled ? ' and writes the opportunity to Dynamics' : ' and queues the opportunity job'}. The partner reads your note by email and in the portal.
                </p>
                <form action={decideDealAction} className="form-grid" style={{ gap: 16 }}>
                  <input type="hidden" name="dealId" value={deal.dealId} />
                  <fieldset className="field span-2" style={{ border: 0, padding: 0, margin: 0 }}>
                    <legend className="label" style={{ color: 'var(--mu)', marginBottom: 10 }}>
                      Decision
                    </legend>
                    <div className="choice" style={{ gridTemplateColumns: '1fr' }}>
                      {decisions.map((d, i) => (
                        <label key={d}>
                          <input type="radio" name="decision" value={d} defaultChecked={i === 0} required />
                          <span className="t">{DEAL_DECISION_LABEL[d]}</span>
                          <span className="d">{d === 'approve' ? 'As filed. Starts the protection and the CRM opportunity.' : d === 'approveWithChanges' ? 'Approve with the corrected value, closure date or customer below.' : d === 'requestInfo' ? 'The partner edits and resubmits; it comes back as new.' : 'Final. The reason goes to the partner.'}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  {changeFields('decide')}
                  <Field id="decide-note" label="Note to the partner" span hint="Required for a rejection or a request; optional on approval.">
                    <textarea id="decide-note" name="note" rows={4} placeholder="What you need, what you changed, or why not." />
                  </Field>
                  <div className="form-actions span-2">
                    <button className="btn btn-primary" type="submit">
                      Record the decision →
                    </button>
                  </div>
                </form>
              </div>
            )}
            {deal.status === 'extensionRequested' && (
              <div className="decide">
                <h2>Extension</h2>
                <p className="hint" style={{ margin: '0 0 16px' }}>
                  {deal.extension.requestedBy} asked on {deal.extension.requestedAt ? dmy(deal.extension.requestedAt) : '—'}: “{deal.extension.reason}”. Granting adds {settings.deals.extensionDays} days to the current end ({deal.protectionEnds ? dmy(deal.protectionEnds) : '—'}); one extension per deal.
                </p>
                <form action={decideExtensionAction} className="form-grid" style={{ gap: 16 }}>
                  <input type="hidden" name="dealId" value={deal.dealId} />
                  <fieldset className="field span-2" style={{ border: 0, padding: 0, margin: 0 }}>
                    <legend className="label" style={{ color: 'var(--mu)', marginBottom: 10 }}>
                      Decision
                    </legend>
                    <div className="choice">
                      <label>
                        <input type="radio" name="decision" value="grant" defaultChecked required />
                        <span className="t">Grant</span>
                        <span className="d">The window grows; the partner is told the new end.</span>
                      </label>
                      <label>
                        <input type="radio" name="decision" value="decline" required />
                        <span className="t">Decline</span>
                        <span className="d">The protection runs on as it was, then expires.</span>
                      </label>
                    </div>
                  </fieldset>
                  <Field id="ext-note" label="Note to the partner" span hint="Required to decline.">
                    <textarea id="ext-note" name="note" rows={3} />
                  </Field>
                  <div className="form-actions span-2">
                    <button className="btn btn-primary" type="submit">
                      Record the decision →
                    </button>
                  </div>
                </form>
              </div>
            )}
            {k7MayAmend(deal.status) && (
              <div>
                <h2>Amend</h2>
                <p className="hint" style={{ margin: '0 0 12px' }}>
                  After approval only K7 changes the value or the customer (FR-DEAL-09). The CRM keeps its own figures; this is the portal’s record and the partner is told.
                </p>
                <form action={amendDealAction} className="form-grid" style={{ gap: 12 }}>
                  <input type="hidden" name="dealId" value={deal.dealId} />
                  {changeFields('amend')}
                  <Field id="amend-note" label="Why" span>
                    <input id="amend-note" name="note" type="text" />
                  </Field>
                  <div className="form-actions span-2">
                    <button className="btn btn-line btn-sm" type="submit">
                      Amend
                    </button>
                  </div>
                </form>
              </div>
            )}
            <div>
              <h2>CRM</h2>
              <dl className="meta-rows label">
                <dt>Opportunity</dt>
                <dd className="sans">
                  {deal.crm.opportunityNo || (job ? (job.state === 'done' ? 'Created' : job.state === 'pending' ? (settings.crm.enabled ? 'Queued' : 'Queued; the mirror is off in settings') : job.state === 'skipped' ? `Skipped: ${job.lastError}` : `Failed: ${job.lastError}`) : deal.status === 'approved' || deal.status === 'extensionRequested' ? 'No job' : 'On approval')}
                  {job && job.state !== 'done' && settings.crm.enabled && (
                    <form action={runDealOutboxAction} style={{ marginTop: 8 }}>
                      <input type="hidden" name="dealId" value={deal.dealId} />
                      <input type="hidden" name="job" value={job.id} />
                      <button className="btn btn-line btn-sm" type="submit">
                        {job.state === 'pending' ? 'Run now' : 'Retry'}
                      </button>
                    </form>
                  )}
                </dd>
                {deal.crm.opportunityId && (
                  <>
                    <dt>Opportunity id</dt>
                    <dd>{deal.crm.opportunityId}</dd>
                  </>
                )}
                {deal.crm.customerAccountId && (
                  <>
                    <dt>Customer account</dt>
                    <dd>{deal.crm.customerAccountId}</dd>
                  </>
                )}
                {job?.result && Array.isArray(job.result.warnings) && job.result.warnings.length > 0 && (
                  <>
                    <dt>Warnings</dt>
                    <dd className="sans">{(job.result.warnings as string[]).join('; ')}</dd>
                  </>
                )}
              </dl>
              <CrmFacts deal={deal} />
              {deal.crm.opportunityId && (
                <form action={syncNowAction} style={{ marginTop: 10 }}>
                  <input type="hidden" name="dealId" value={deal.dealId} />
                  <button className="btn btn-line btn-sm" type="submit" title="Read every portal opportunity back from Dynamics now">
                    {deal.crm.snapshot.syncedAt ? 'Read back again' : 'Read back now'}
                  </button>
                </form>
              )}
              <p className="more">
                <Link className="link-u" href={`/admin/collections/partner-deals/${deal.id}`}>
                  The raw row in the admin
                </Link>
              </p>
            </div>
          </aside>
        </div>
      </section>
    </>
  )
}

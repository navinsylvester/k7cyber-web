import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { CrmFacts } from '@/components/partner/Dashboard'
import { DealFacts, DealStateTag, DealThread, Did, Protection } from '@/components/partner/Deals'
import { Field, Flash, Strip } from '@/components/partner/Parts'
import { Crumbs } from '@/components/support/Parts'
import { loadDeal, PARTNER_DEALS } from '@/lib/partner/deals'
import { canRequestExtension, formatInr, mayAddNote, partnerMayEdit, partnerMayWithdraw } from '@/lib/partner/deals-model'
import { requirePartner } from '@/lib/partner/session'
import { getPartnerSettings } from '@/lib/partner/settings'
import { DEAL_STATUS_HINT } from '@/lib/partner/status'
import { dmy } from '@/lib/support/format'

import { extensionAction, noteAction, withdrawAction } from '../actions'

export const metadata: Metadata = { title: 'Deal' }

/* One deal for the partner (FR-DEAL-07, FR-DEAL-08, FR-DEAL-09): the facts, the protection line, the thread with the note form,
   and in the side column the levers the state allows: edit and resubmit after a request, the one extension, withdrawal. Read
   through the scope by number; another organisation's number is a 404. */
export default async function DealPage({ params, searchParams }: { params: Promise<{ dealId: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [{ dealId }, sp] = await Promise.all([params, searchParams])
  const me = await requirePartner(`${PARTNER_DEALS}/${dealId}`)
  const [deal, settings] = await Promise.all([loadDeal(me.scope, dealId), getPartnerSettings()])
  if (!deal) notFound()
  const seller = me.roles.includes('admin') || me.roles.includes('sales')
  const base = `${PARTNER_DEALS}/${deal.dealId}`
  return (
    <section className="sheet ws g-paper">
      <Crumbs items={[{ label: 'Deals', href: PARTNER_DEALS }, { label: deal.dealId }]} />
      <div className="ws-head" style={{ marginTop: 16 }}>
        <div className="ws-head-main">
          <Did id={deal.dealId} display />
          <h1 className="h-util">{deal.customer.name}.</h1>
          <p className="lede">{DEAL_STATUS_HINT[deal.status]}</p>
        </div>
        {seller && partnerMayEdit(deal.status) && (
          <div className="ws-actions">
            <Link className="btn btn-primary" href={`${base}/edit`}>
              Edit and resubmit →
            </Link>
          </div>
        )}
      </div>
      {sp.ok && <Flash>{sp.ok}</Flash>}
      {sp.error && <Flash kind="error">{sp.error}</Flash>}
      <Strip
        items={[
          { label: 'Status', value: <DealStateTag status={deal.status} audience="partner" /> },
          { label: 'Expected value', value: formatInr(deal.expectedValue) },
          { label: 'Expected closure', value: deal.closeDate ? dmy(deal.closeDate) : '—' },
          { label: 'Protected until', value: deal.protectionEnds ? dmy(deal.protectionEnds) : 'Not yet' },
          ...(deal.crm.opportunityNo ? [{ label: 'K7 opportunity', value: deal.crm.opportunityNo }] : []),
        ]}
      />
      <Protection deal={deal} />
      <div className="phome">
        <div>
          <DealFacts deal={deal} />
          <h2 className="sub-head" style={{ marginTop: 40 }}>
            Thread
          </h2>
          <DealThread deal={deal} you="partner" fileHref={(id) => `${base}/file/${id}`} />
          {mayAddNote(deal.status) && (
            <form action={noteAction} className="form-grid" style={{ marginTop: 24 }}>
              <input type="hidden" name="dealId" value={deal.dealId} />
              <Field id="text" label="Add a note" span hint="Progress, a change on the customer's side, a question for K7. The approvers are told.">
                <textarea id="text" name="text" rows={3} />
              </Field>
              <Field id="files" label="Attach files" span hint="Up to 10 MB each.">
                <input id="files" name="files" type="file" multiple accept=".pdf,image/*,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" />
              </Field>
              <div className="form-actions span-2">
                <button className="btn btn-line" type="submit">
                  Add to the thread →
                </button>
              </div>
            </form>
          )}
        </div>
        <aside className="ws-side">
          {deal.crm.snapshot.syncedAt && (
            <div>
              <h2>In K7’s CRM</h2>
              <CrmFacts deal={deal} />
              <p className="more">
                <Link className="link-u" href="/partners/portal/dashboard">
                  The dashboard →
                </Link>
              </p>
            </div>
          )}
          {seller && canRequestExtension(deal) && (
            <div className="decide">
              <h2>Ask for an extension</h2>
              <p className="hint" style={{ margin: '0 0 16px' }}>
                One extension per deal, of {settings.deals.extensionDays} days from the current end ({deal.protectionEnds ? dmy(deal.protectionEnds) : '—'}). K7 approves or declines; the protection runs on while they decide.
              </p>
              <form action={extensionAction} className="form-grid" style={{ gap: 16 }}>
                <input type="hidden" name="dealId" value={deal.dealId} />
                <Field id="reason" label="Why the deal needs more time" required span>
                  <textarea id="reason" name="reason" rows={3} required />
                </Field>
                <div className="form-actions span-2">
                  <button className="btn btn-primary" type="submit">
                    Request the extension →
                  </button>
                </div>
              </form>
            </div>
          )}
          {deal.extension.requestedAt && (
            <div>
              <h2>Extension</h2>
              <dl className="meta-rows label">
                <dt>Asked</dt>
                <dd className="sans">
                  {dmy(deal.extension.requestedAt)} by {deal.extension.requestedBy}
                </dd>
                <dt>Reason</dt>
                <dd className="sans">{deal.extension.reason}</dd>
                <dt>Decision</dt>
                <dd className="sans">{deal.extension.decidedAt ? `${deal.extension.granted ? 'Granted' : 'Declined'} ${dmy(deal.extension.decidedAt)}${deal.extension.note ? ` · ${deal.extension.note}` : ''}` : 'Waiting for K7'}</dd>
              </dl>
            </div>
          )}
          {seller && partnerMayWithdraw(deal.status) && (
            <div>
              <h2>Withdraw</h2>
              <p className="hint" style={{ margin: '0 0 12px' }}>
                {deal.status === 'approved' || deal.status === 'extensionRequested' ? 'Gives up the protection. The opportunity stays in K7’s CRM for sales to close.' : 'Cancels the registration. You can register the customer again later.'}
              </p>
              <form action={withdrawAction} className="form-grid" style={{ gap: 12 }}>
                <input type="hidden" name="dealId" value={deal.dealId} />
                <Field id="wreason" label="Why" span>
                  <input id="wreason" name="reason" type="text" />
                </Field>
                <label className="check span-2">
                  <input type="checkbox" name="confirm" value="1" />
                  <span>I want to withdraw {deal.dealId}.</span>
                </label>
                <div className="form-actions span-2">
                  <button className="btn btn-line btn-sm" type="submit">
                    Withdraw the deal
                  </button>
                </div>
              </form>
            </div>
          )}
          <div>
            <h2>Registered by</h2>
            <dl className="meta-rows label">
              <dt>Who</dt>
              <dd className="sans">{deal.registeredBy.name || deal.registeredBy.email}</dd>
              <dt>When</dt>
              <dd className="sans">{deal.submittedAt ? dmy(deal.submittedAt) : '—'}</dd>
              <dt>Organisation</dt>
              <dd className="sans">{deal.orgName}</dd>
            </dl>
          </div>
        </aside>
      </div>
    </section>
  )
}

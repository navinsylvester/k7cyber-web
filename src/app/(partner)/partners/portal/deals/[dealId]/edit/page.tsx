import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import React from 'react'

import { DealForm } from '@/components/partner/DealForm.client'
import { Did } from '@/components/partner/Deals'
import { Crumbs } from '@/components/support/Parts'
import { listProducts, loadDeal, PARTNER_DEALS } from '@/lib/partner/deals'
import { infoRequestNote, partnerMayEdit, type DealInput } from '@/lib/partner/deals-model'
import { requirePartnerRole } from '@/lib/partner/session'
import { dmyHm } from '@/lib/support/format'

import { resubmitDealAction } from '../../actions'

export const metadata: Metadata = { title: 'Edit the deal' }

/* Editing after a request for information (FR-DEAL-09): the same form with the filed values, the approver's note above it, and
   the reply field; resubmission returns the deal to the queue with its number. */
export default async function EditDealPage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params
  const me = await requirePartnerRole(['admin', 'sales'], `${PARTNER_DEALS}/${dealId}/edit`)
  const deal = await loadDeal(me.scope, dealId)
  if (!deal) notFound()
  if (!partnerMayEdit(deal.status)) redirect(`${PARTNER_DEALS}/${deal.dealId}?error=${encodeURIComponent('This deal cannot be edited now.')}`)
  const products = await listProducts({ activeOnly: true })
  const ask = infoRequestNote(deal)
  const input: DealInput = {
    customer: { ...deal.customer },
    lines: deal.products.map((l) => ({ productId: l.productId, quantity: l.quantity })),
    expectedValue: deal.expectedValue,
    closeDate: deal.closeDate.slice(0, 10),
    source: deal.source,
    competitor: deal.competitor,
    notes: '',
    resellerName: deal.reseller.name,
  }
  return (
    <section className="sheet ws g-paper">
      <Crumbs items={[{ label: 'Deals', href: PARTNER_DEALS }, { label: deal.dealId, href: `${PARTNER_DEALS}/${deal.dealId}` }, { label: 'Edit' }]} />
      <div className="ws-head" style={{ marginTop: 16 }}>
        <div className="ws-head-main">
          <Did id={deal.dealId} display />
          <h1 className="h-util">{deal.customer.name}.</h1>
          <p className="lede">K7 asked for more information. Change what needs changing, answer in the reply field, and resubmit; the deal keeps its number.</p>
        </div>
      </div>
      {ask && (
        <div className="pending" style={{ marginBottom: 'clamp(28px, 3cqw, 40px)' }}>
          <h2>
            <i className="pixel" aria-hidden="true" /> What K7 asked
          </h2>
          <p className="hint" style={{ margin: '0 0 8px' }}>
            {ask.byName || 'K7'} on {dmyHm(ask.at)}
          </p>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{ask.text}</p>
        </div>
      )}
      <DealForm action={resubmitDealAction} initial={{ n: 0, input, errors: {} }} products={products} orgType={me.org.type} submitLabel="Resubmit the deal →" dealId={deal.dealId} reply cancelHref={`${PARTNER_DEALS}/${deal.dealId}`} />
    </section>
  )
}

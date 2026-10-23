import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { DealForm } from '@/components/partner/DealForm.client'
import { Crumbs } from '@/components/support/Parts'
import { listProducts, PARTNER_DEALS, registerGate } from '@/lib/partner/deals'
import { EMPTY_DEAL_INPUT } from '@/lib/partner/deals-model'
import { requirePartner } from '@/lib/partner/session'
import { getPartnerSettings } from '@/lib/partner/settings'

import { registerDealAction } from '../actions'

export const metadata: Metadata = { title: 'Register a deal' }

/* The registration (FR-DEAL-01 to 03): behind the gate of decision 8 (approved organisation, active Partner Admin or Sales user;
   the certificate once the switch is on), the form on the products of decision 19. */
export default async function NewDealPage() {
  const me = await requirePartner(`${PARTNER_DEALS}/new`)
  const [blocked, products, settings] = await Promise.all([registerGate(me), listProducts({ activeOnly: true }), getPartnerSettings()])
  return (
    <section className="sheet ws g-paper">
      <Crumbs items={[{ label: 'Deals', href: PARTNER_DEALS }, { label: 'Register' }]} />
      <div className="ws-head" style={{ marginTop: 16 }}>
        <div className="ws-head-main">
          <span className="label muted">Deal registration</span>
          <h1 className="h-util">Register a deal.</h1>
          <p className="lede">
            Tell K7 which end customer you are working with and what for. A Deal Desk Approver reviews it; once approved the deal is yours for {settings.deals.protectionDays} days and sales sees it in K7’s CRM.
          </p>
        </div>
      </div>
      {blocked ? (
        <div className="flash is-error" role="alert">
          <i className="pixel" aria-hidden="true" />
          <p>{blocked}</p>
        </div>
      ) : products.length === 0 ? (
        <div className="flash is-error" role="alert">
          <i className="pixel" aria-hidden="true" />
          <p>No product is on offer yet; K7 has not published the catalogue. Try again later or write to your Channel Manager.</p>
        </div>
      ) : (
        <DealForm action={registerDealAction} initial={{ n: 0, input: EMPTY_DEAL_INPUT, errors: {} }} products={products} orgType={me.org.type} submitLabel="Register the deal →" cancelHref={PARTNER_DEALS} />
      )}
      <p className="hint" style={{ marginTop: 32 }}>
        What happens next: K7 checks the registration against other partners’ live deals for the same customer (you are told only whether a conflict was found), then approves, asks for more information or rejects it. You are emailed at every step.{' '}
        <Link className="link-u" href={PARTNER_DEALS}>
          Your deals
        </Link>
      </p>
    </section>
  )
}

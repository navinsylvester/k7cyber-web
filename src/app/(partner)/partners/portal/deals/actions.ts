'use server'

import { redirect } from 'next/navigation'

import type { DealFormState } from '@/components/partner/DealForm.client'
import { addDealNote, filesFrom, loadDeal, PARTNER_DEALS, requestExtension, resubmitDeal, submitDeal, withdrawDeal } from '@/lib/partner/deals'
import { linesFrom, type DealInput } from '@/lib/partner/deals-model'
import { requirePartner, requirePartnerRole } from '@/lib/partner/session'

/* The partner's moves on a deal (01-requirements.md §7, M4): register, edit and resubmit after a request for information, add a
   note with files, ask for the one extension, withdraw. The role and the gate are re-checked on the server; the library writes
   the trail and tells the approvers. The two form actions return the typed input with the errors (the form keeps it); the others
   redirect with a flash. */

const f = (form: FormData, k: string): string => String(form.get(k) ?? '').trim()
const back = (dealId: string, q: Record<string, string>): never => redirect(`${PARTNER_DEALS}/${encodeURIComponent(dealId)}?${new URLSearchParams(q).toString()}`)

const inputFrom = (form: FormData): DealInput => ({
  customer: { name: f(form, 'customerName'), industry: f(form, 'industry'), city: f(form, 'city'), state: f(form, 'state'), contactName: f(form, 'contactName'), designation: f(form, 'designation'), email: f(form, 'email'), phone: f(form, 'phone') },
  lines: linesFrom((k) => f(form, k)),
  expectedValue: f(form, 'expectedValue') ? Number(f(form, 'expectedValue')) : null,
  closeDate: f(form, 'closeDate'),
  source: f(form, 'source'),
  competitor: f(form, 'competitor'),
  notes: f(form, 'notes'),
  resellerName: f(form, 'resellerName'),
})

export async function registerDealAction(prev: DealFormState, form: FormData): Promise<DealFormState> {
  const me = await requirePartnerRole(['admin', 'sales'], `${PARTNER_DEALS}/new`)
  const input = inputFrom(form)
  const files = await filesFrom(form, 'files')
  if (typeof files === 'string') return { n: prev.n + 1, input, errors: { files } }
  const r = await submitDeal(me, input, files)
  if (!r.ok) return { n: prev.n + 1, input, errors: r.errors }
  redirect(`${PARTNER_DEALS}/${r.deal.dealId}?ok=${encodeURIComponent(`Registered as ${r.deal.dealId}. A Deal Desk Approver will review it; you are told at every step.`)}`)
}

export async function resubmitDealAction(prev: DealFormState, form: FormData): Promise<DealFormState> {
  const dealId = f(form, 'dealId')
  const me = await requirePartnerRole(['admin', 'sales'], `${PARTNER_DEALS}/${dealId}/edit`)
  const deal = await loadDeal(me.scope, dealId)
  if (!deal) redirect(PARTNER_DEALS)
  const input = inputFrom(form)
  const files = await filesFrom(form, 'files')
  if (typeof files === 'string') return { n: prev.n + 1, input, errors: { files } }
  const r = await resubmitDeal(me, deal, { ...input, notes: deal.notes }, files, input.notes)
  if (!r.ok) return { n: prev.n + 1, input, errors: r.errors }
  redirect(`${PARTNER_DEALS}/${r.deal.dealId}?ok=${encodeURIComponent('Resubmitted; the approvers have your answer.')}`)
}

export async function noteAction(form: FormData): Promise<void> {
  const dealId = f(form, 'dealId')
  const me = await requirePartner(`${PARTNER_DEALS}/${dealId}`)
  const deal = await loadDeal(me.scope, dealId)
  if (!deal) redirect(PARTNER_DEALS)
  const files = await filesFrom(form, 'files')
  if (typeof files === 'string') return back(dealId, { error: files })
  const r = await addDealNote({ side: 'partner', actor: me.actor, name: me.user.name, email: me.user.email, orgId: me.scope.orgId }, deal, f(form, 'text'), files)
  if (!r.ok) return back(dealId, { error: r.error })
  back(dealId, { ok: 'Added to the thread; the approvers are told.' })
}

export async function extensionAction(form: FormData): Promise<void> {
  const dealId = f(form, 'dealId')
  const me = await requirePartnerRole(['admin', 'sales'], `${PARTNER_DEALS}/${dealId}`)
  const deal = await loadDeal(me.scope, dealId)
  if (!deal) redirect(PARTNER_DEALS)
  const r = await requestExtension(me, deal, f(form, 'reason'))
  if (!r.ok) return back(dealId, { error: r.error })
  back(dealId, { ok: 'Extension requested; K7 decides and you are told.' })
}

export async function withdrawAction(form: FormData): Promise<void> {
  const dealId = f(form, 'dealId')
  const me = await requirePartnerRole(['admin', 'sales'], `${PARTNER_DEALS}/${dealId}`)
  if (form.get('confirm') !== '1') return back(dealId, { error: 'Tick the box to confirm the withdrawal.' })
  const deal = await loadDeal(me.scope, dealId)
  if (!deal) redirect(PARTNER_DEALS)
  const r = await withdrawDeal(me, deal, f(form, 'reason'))
  if (!r.ok) return back(dealId, { error: r.error })
  back(dealId, { ok: 'Withdrawn.' })
}

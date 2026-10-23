'use server'

import { redirect } from 'next/navigation'

import { loadResultFor, loadSchemeFor, PARTNER_SCHEMES, raiseDispute, registerForScheme } from '@/lib/partner/schemes'
import { requirePartnerRole } from '@/lib/partner/session'

/* The partner's moves on a scheme (01-requirements.md §9, M7): register the organisation after accepting the terms
   (FR-SCH-03), raise a query or dispute on a published result (FR-ELG-05). Both are the Partner Admin's; the role, the rule
   and the window are re-checked on the server; the library writes the trail and tells K7. */

const f = (form: FormData, k: string): string => String(form.get(k) ?? '').trim()
const back = (path: string, q: Record<string, string>): never => redirect(`${path}?${new URLSearchParams(q).toString()}`)

export async function registerSchemeAction(form: FormData): Promise<void> {
  const id = f(form, 'schemeId')
  const path = `${PARTNER_SCHEMES}/${encodeURIComponent(id)}`
  const me = await requirePartnerRole(['admin'], path)
  const view = await loadSchemeFor(me, id)
  if (!view) redirect(PARTNER_SCHEMES)
  const r = await registerForScheme(me, view.scheme, form.get('accept') === '1')
  if (!r.ok) return back(path, { error: r.error })
  back(path, { ok: r.value.status === 'pending' ? 'Registration sent; K7 approves each registration for this scheme and you are told.' : 'Registered. Your progress shows here as deals are won.' })
}

export async function disputeAction(form: FormData): Promise<void> {
  const id = f(form, 'schemeId')
  const path = `${PARTNER_SCHEMES}/${encodeURIComponent(id)}/eligibility`
  const me = await requirePartnerRole(['admin'], path)
  const view = await loadSchemeFor(me, id)
  if (!view) redirect(PARTNER_SCHEMES)
  const result = await loadResultFor(me, view.scheme)
  if (!result) return back(path, { error: 'No published result to dispute.' })
  const r = await raiseDispute(me, view.scheme, result, f(form, 'text'))
  if (!r.ok) return back(path, { error: r.error })
  back(path, { ok: 'Your query is with the Scheme Admin; the answer comes here and by email.' })
}

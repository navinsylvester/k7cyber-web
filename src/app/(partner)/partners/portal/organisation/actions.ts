'use server'

import { redirect } from 'next/navigation'

import { PARTNER_ORG, proposeLegalEdit, saveOrgDetails, withdrawLegalEdit } from '@/lib/partner/organisation'
import { requirePartnerRole } from '@/lib/partner/session'

/* The Partner Admin's edits to the organisation (M3, FR-REG-07): the details save at once; the legal identity is proposed and
   waits for a Channel Manager; a waiting proposal can be withdrawn. The role is re-checked here, the rules live in the library. */

const f = (form: FormData, k: string): string => String(form.get(k) ?? '').trim()
const back = (q: Record<string, string>): never => redirect(`${PARTNER_ORG}?${new URLSearchParams(q).toString()}`)
const firstError = (errors: Record<string, string>): string => Object.values(errors)[0] ?? 'Check the form.'

export async function saveDetailsAction(form: FormData): Promise<void> {
  const me = await requirePartnerRole(['admin'], PARTNER_ORG)
  const r = await saveOrgDetails(me, {
    tradeName: f(form, 'tradeName'),
    address: f(form, 'address'),
    city: f(form, 'city'),
    state: f(form, 'state'),
    country: f(form, 'country'),
    pin: f(form, 'pin'),
    website: f(form, 'website'),
    regions: form.getAll('regions').map(String),
  })
  if (!r.ok) return back({ error: firstError(r.errors), tab: 'details' })
  back({ ok: 'Details saved.' })
}

export async function proposeLegalAction(form: FormData): Promise<void> {
  const me = await requirePartnerRole(['admin'], PARTNER_ORG)
  const r = await proposeLegalEdit(me, { name: f(form, 'name'), gstin: f(form, 'gstin'), pan: f(form, 'pan') }, f(form, 'reason'))
  if (!r.ok) return back({ error: firstError(r.errors), tab: 'legal' })
  back({ ok: 'Sent to K7. A Channel Manager will approve or decline the change; you are emailed either way.' })
}

export async function withdrawLegalAction(): Promise<void> {
  const me = await requirePartnerRole(['admin'], PARTNER_ORG)
  await withdrawLegalEdit(me)
  back({ ok: 'The proposed change is withdrawn.' })
}

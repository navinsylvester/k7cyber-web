'use server'

import { redirect } from 'next/navigation'

import { addMember, loadMember, PARTNER_USERS, removeMember, resendInvitation, setMemberStatus, updateMember } from '@/lib/partner/members'
import { normaliseRoles } from '@/lib/partner/organisation-model'
import { requirePartnerRole } from '@/lib/partner/session'

/* The Partner Admin's actions on the organisation's people (FR-ROLE-01, FR-ROLE-02, M3). The role is re-checked on every post;
   the target is read through the organisation scope, so an id from another organisation is simply not found. */

const f = (form: FormData, k: string): string => String(form.get(k) ?? '').trim()
const list = (q: Record<string, string>): never => redirect(`${PARTNER_USERS}?${new URLSearchParams(q).toString()}`)
const sheet = (id: string, q: Record<string, string>): never => redirect(`${PARTNER_USERS}/${encodeURIComponent(id)}?${new URLSearchParams(q).toString()}`)
const firstError = (errors: Record<string, string>): string => Object.values(errors)[0] ?? 'Check the form.'

export async function addMemberAction(form: FormData): Promise<void> {
  const me = await requirePartnerRole(['admin'], PARTNER_USERS)
  const r = await addMember(me, { name: f(form, 'name'), email: f(form, 'email'), designation: f(form, 'designation'), mobile: f(form, 'mobile'), roles: normaliseRoles(form.getAll('roles').map(String)) })
  if (!r.ok) return list({ error: firstError(r.errors), name: f(form, 'name'), email: f(form, 'email'), designation: f(form, 'designation'), mobile: f(form, 'mobile') })
  list({ ok: `${r.user.name} is invited; the invitation went to ${r.user.email}.` })
}

export async function updateMemberAction(form: FormData): Promise<void> {
  const id = f(form, 'id')
  const me = await requirePartnerRole(['admin'], `${PARTNER_USERS}/${id}`)
  const target = await loadMember(me.scope, id)
  if (!target) return list({ error: 'That user is not in your organisation.' })
  const r = await updateMember(me, target, { name: f(form, 'name'), designation: f(form, 'designation'), mobile: f(form, 'mobile'), roles: normaliseRoles(form.getAll('roles').map(String)) })
  if (!r.ok) return sheet(id, { error: firstError(r.errors) })
  sheet(id, { ok: 'Saved.' })
}

export async function setMemberStatusAction(form: FormData): Promise<void> {
  const id = f(form, 'id')
  const action = f(form, 'action') === 'enable' ? 'enable' : 'disable'
  const me = await requirePartnerRole(['admin'], `${PARTNER_USERS}/${id}`)
  const target = await loadMember(me.scope, id)
  if (!target) return list({ error: 'That user is not in your organisation.' })
  const r = await setMemberStatus(me, target, action)
  if (!r.ok) return sheet(id, { error: firstError(r.errors) })
  sheet(id, { ok: action === 'disable' ? `${target.name} is disabled and cannot sign in.` : `${target.name} can sign in again.` })
}

export async function removeMemberAction(form: FormData): Promise<void> {
  const id = f(form, 'id')
  const me = await requirePartnerRole(['admin'], `${PARTNER_USERS}/${id}`)
  if (form.get('confirm') !== '1') return sheet(id, { error: 'Tick the box to confirm the removal.' })
  const target = await loadMember(me.scope, id)
  if (!target) return list({ error: 'That user is not in your organisation.' })
  const r = await removeMember(me, target)
  if (!r.ok) return sheet(id, { error: r.error })
  list({ ok: `${target.name} (${target.email}) is removed.` })
}

export async function resendInvitationAction(form: FormData): Promise<void> {
  const id = f(form, 'id')
  const me = await requirePartnerRole(['admin'], `${PARTNER_USERS}/${id}`)
  const target = await loadMember(me.scope, id)
  if (!target) return list({ error: 'That user is not in your organisation.' })
  const r = await resendInvitation(me, target)
  if (!r.ok) return sheet(id, { error: r.error })
  sheet(id, { ok: `The invitation went to ${target.email} again.` })
}

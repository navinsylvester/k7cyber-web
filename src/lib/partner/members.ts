import 'server-only'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { getServerSideURL } from '@/utilities/getURL'

import { audit } from './audit'
import { notify } from './notify'
import { orgVars } from './notify-model'
import { canMoveUser, memberChangeError, memberRemoveError, reenabledStatus, validateMember, type MemberInput } from './organisation-model'
import { normaliseMobile, type FieldErrors } from './registration-model'
import { orgRel, orgWhere, type OrgScope } from './scope'
import type { PartnerContext } from './session'
import { PARTNER_ROLE_LABEL } from './settings'
import { findPartnerUserByEmail, toUser, type PartnerOrg, type PartnerUser } from './users'

/* The organisation's people (01-requirements.md §2, FR-ROLE-01, FR-ROLE-02; 02-build-plan.md M3): the Partner Admin adds a
   person with one or more roles, changes their roles, disables and re-enables them, removes them, resends the invitation. The
   rules are in organisation-model.ts: the organisation always keeps a standing Partner Admin, and nobody disables or demotes
   themselves. Every read carries the organisation scope (`orgWhere`); the K7 sheet reads with the organisation's own scope. */

const db = () => getPayload({ config: configPromise })
type Doc = Record<string, unknown>

export const PARTNER_USERS = '/partners/portal/organisation/users'

/** Everyone in the organisation, whatever their status: admins first, then by name. */
export const listMembers = async (scope: OrgScope): Promise<PartnerUser[]> => {
  const payload = await db()
  const r = await payload.find({ collection: 'partner-users', where: orgWhere(scope), depth: 0, limit: 200, sort: 'name', overrideAccess: true })
  const all = (r.docs as unknown as Doc[]).map(toUser)
  const rank = (u: PartnerUser) => (u.status === 'disabled' ? 2 : u.roles.includes('admin') ? 0 : 1)
  return all.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
}

/** One member by id, only when they belong to the scope; anything else is null, never another organisation's row. */
export const loadMember = async (scope: OrgScope, id: string): Promise<PartnerUser | null> => {
  if (!id || !scope.orgId) return null
  const payload = await db()
  const r = await payload.find({ collection: 'partner-users', where: orgWhere(scope, { id: { equals: id } }), depth: 0, limit: 1, overrideAccess: true })
  const doc = r.docs[0] as unknown as Doc | undefined
  return doc ? toUser(doc) : null
}

export type MemberResult = { ok: true; user: PartnerUser } | { ok: false; errors: FieldErrors }

const userVars = (org: PartnerOrg, user: PartnerUser): Record<string, string> => ({ ...orgVars(org), user: user.name || user.email, roles: user.roles.map((r) => PARTNER_ROLE_LABEL[r]).join(', ') })

const invitation = (org: PartnerOrg, user: PartnerUser, by: string) => ({
  event: 'user.invited',
  vars: userVars(org, user),
  subject: `You are invited to the K7 Partner Portal for ${org.tradeName || org.name}`,
  body: `${by} added you to ${org.name} (${org.partnerId}) as ${user.roles.map((r) => PARTNER_ROLE_LABEL[r]).join(', ')}. Sign in with this email address at ${getServerSideURL()}/partners/portal/sign-in: we send a one-time code, no password.`,
  href: '/partners/portal',
  to: { kind: 'user' as const, user },
})

/** A new person in the actor's organisation, invited; the address must be new to the portal (one person, one organisation). */
export const addMember = async (me: PartnerContext, input: MemberInput): Promise<MemberResult> => {
  const m: MemberInput = { ...input, name: input.name.trim(), email: input.email.trim().toLowerCase(), designation: input.designation.trim(), mobile: input.mobile.trim() }
  const errors = validateMember(m)
  if (Object.keys(errors).length) return { ok: false, errors }
  if (await findPartnerUserByEmail(m.email)) return { ok: false, errors: { email: 'That address is already a partner-portal user and cannot be added again.' } }
  const payload = await db()
  const now = new Date().toISOString()
  let doc: Doc
  try {
    doc = (await payload.create({ collection: 'partner-users', overrideAccess: true, depth: 0, data: { org: orgRel(me.scope), email: m.email, name: m.name, designation: m.designation, mobile: m.mobile ? normaliseMobile(m.mobile) : '', roles: m.roles, status: 'invited', invitedAt: now } as never })) as unknown as Doc
  } catch (e) {
    return { ok: false, errors: { email: /unique|duplicate/i.test((e as Error).message) ? 'That address is already a partner-portal user and cannot be added again.' : `Could not add them: ${(e as Error).message.slice(0, 120)}` } }
  }
  const user = toUser(doc)
  await audit({ actor: me.actor, object: 'partner-users', objectId: user.id, objectLabel: user.email, action: 'user.invited', to: 'invited', orgId: me.scope.orgId, comment: `${user.name} · ${user.roles.map((r) => PARTNER_ROLE_LABEL[r]).join(', ')}` })
  await notify(invitation(me.org, user, me.user.name || me.user.email))
  return { ok: true, user }
}

/** Name, designation, mobile and roles. The email is the sign-in identity and does not change here. */
export const updateMember = async (me: PartnerContext, target: PartnerUser, input: Omit<MemberInput, 'email'>): Promise<MemberResult> => {
  const m = { ...input, name: input.name.trim(), designation: input.designation.trim(), mobile: input.mobile.trim() }
  const errors = validateMember({ ...m, email: target.email }, { email: false })
  if (Object.keys(errors).length) return { ok: false, errors }
  const members = await listMembers(me.scope)
  const rule = memberChangeError(me.user, target, { roles: m.roles }, members)
  if (rule) return { ok: false, errors: { roles: rule } }
  const payload = await db()
  const doc = await payload.update({ collection: 'partner-users', id: target.id, overrideAccess: true, depth: 0, data: { name: m.name, designation: m.designation, mobile: m.mobile ? normaliseMobile(m.mobile) : '', roles: m.roles } as never })
  const user = toUser(doc as unknown as Doc)
  const rolesChanged = [...target.roles].sort().join(',') !== [...user.roles].sort().join(',')
  await audit({ actor: me.actor, object: 'partner-users', objectId: user.id, objectLabel: user.email, action: rolesChanged ? 'user.roles-changed' : 'user.updated', orgId: me.scope.orgId, from: rolesChanged ? target.roles.map((r) => PARTNER_ROLE_LABEL[r]).join(', ') : undefined, to: rolesChanged ? user.roles.map((r) => PARTNER_ROLE_LABEL[r]).join(', ') : undefined })
  if (rolesChanged && user.status !== 'disabled') {
    await notify({ event: 'user.roles-changed', vars: userVars(me.org, user), subject: `Your roles at ${me.org.tradeName || me.org.name} changed`, body: `${me.user.name || me.user.email} set your roles to ${user.roles.map((r) => PARTNER_ROLE_LABEL[r]).join(', ')}.`, href: '/partners/portal', to: { kind: 'user', user } })
  }
  return { ok: true, user }
}

/** Disable (the door refuses them, their session ends on its next request) or re-enable (back to active or invited). */
export const setMemberStatus = async (me: PartnerContext, target: PartnerUser, action: 'disable' | 'enable'): Promise<MemberResult> => {
  const to = action === 'disable' ? 'disabled' : reenabledStatus(target)
  if (!canMoveUser(target.status, to)) return { ok: false, errors: { status: action === 'disable' ? 'They are already disabled.' : 'They are not disabled.' } }
  const members = await listMembers(me.scope)
  const rule = memberChangeError(me.user, target, { status: to }, members)
  if (rule) return { ok: false, errors: { status: rule } }
  const payload = await db()
  const doc = await payload.update({ collection: 'partner-users', id: target.id, overrideAccess: true, depth: 0, data: { status: to } as never })
  const user = toUser(doc as unknown as Doc)
  await audit({ actor: me.actor, object: 'partner-users', objectId: user.id, objectLabel: user.email, action: action === 'disable' ? 'user.disabled' : 'user.enabled', from: target.status, to, orgId: me.scope.orgId })
  await notify({
    event: action === 'disable' ? 'user.disabled' : 'user.enabled',
    vars: userVars(me.org, user),
    subject: action === 'disable' ? `Your access to the K7 Partner Portal is disabled` : `Your access to the K7 Partner Portal is restored`,
    body: action === 'disable' ? `${me.user.name || me.user.email} disabled your user at ${me.org.name}. You can no longer sign in; ask your Partner Admin if that is wrong.` : `${me.user.name || me.user.email} re-enabled your user at ${me.org.name}. Sign in with this email address.`,
    href: '/partners/portal',
    to: { kind: 'user', user },
  })
  return { ok: true, user }
}

/** Removal deletes the row; the trail keeps the email. A standing admin is never the last to go. */
export const removeMember = async (me: PartnerContext, target: PartnerUser): Promise<{ ok: true } | { ok: false; error: string }> => {
  const members = await listMembers(me.scope)
  const rule = memberRemoveError(me.user, target, members)
  if (rule) return { ok: false, error: rule }
  const payload = await db()
  await payload.delete({ collection: 'partner-users', id: target.id, overrideAccess: true })
  await audit({ actor: me.actor, object: 'partner-users', objectId: target.id, objectLabel: target.email, action: 'user.removed', from: target.status, orgId: me.scope.orgId, comment: `${target.name} · ${target.roles.map((r) => PARTNER_ROLE_LABEL[r]).join(', ')}` })
  return { ok: true }
}

export const resendInvitation = async (me: PartnerContext, target: PartnerUser): Promise<{ ok: true } | { ok: false; error: string }> => {
  if (target.status !== 'invited') return { ok: false, error: 'Only an invited user who has not signed in yet gets the invitation again.' }
  const payload = await db()
  await payload.update({ collection: 'partner-users', id: target.id, overrideAccess: true, depth: 0, data: { invitedAt: new Date().toISOString() } as never })
  await audit({ actor: me.actor, object: 'partner-users', objectId: target.id, objectLabel: target.email, action: 'user.reinvited', orgId: me.scope.orgId })
  await notify(invitation(me.org, target, me.user.name || me.user.email))
  return { ok: true }
}

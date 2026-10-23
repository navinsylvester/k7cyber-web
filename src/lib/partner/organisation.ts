import 'server-only'
import configPromise from '@payload-config'
import { getPayload, type Where } from 'payload'

import { audit } from './audit'
import { notify } from './notify'
import { legalChanges, normaliseLegal, validateDetails, validateLegal, type LegalEdit, type LegalIdentity, type OrgDetails } from './organisation-model'
import { normaliseWebsite, type FieldErrors } from './registration-model'
import type { OrgScope } from './scope'
import type { K7Context, PartnerContext } from './session'
import { getPartnerSettings } from './settings'
import { canMoveOrg, ORG_STATUS_LABEL, type OrgStatus } from './status'
import { toOrg, type PartnerOrg } from './users'

/* The organisation after approval (02-build-plan.md M3, 01-requirements.md §2 and FR-REG-07): what the Partner Admin may change
   at once (the details), what goes through K7 (the legal identity, as one pending edit the Channel Manager approves or
   declines), and the Channel Manager's own levers: suspension with a reason (every sign-in refused, every session ended on its
   next request), reinstatement, and the certificate waiver of decision 8. Every move writes one audit row; the people concerned
   are told through `notify`. Nothing here touches Dynamics: the account was created once by the outbox (decision 2) and an
   approved legal-name change is for the CRM admin to carry over by hand until an `account.update` job exists. */

const db = () => getPayload({ config: configPromise })
type Doc = Record<string, unknown>

export const PARTNER_ORG = '/partners/portal/organisation'
export const K7_PARTNERS = '/partners/portal/k7/partners'

const update = async (id: string, data: Record<string, unknown>): Promise<PartnerOrg> => {
  const payload = await db()
  const doc = await payload.update({ collection: 'partner-orgs', id, data: data as never, depth: 0, overrideAccess: true })
  return toOrg(doc as unknown as Doc)
}

/* ---------- Reads ---------- */

export const loadOrg = async (id: string): Promise<PartnerOrg | null> => {
  if (!id) return null
  try {
    const payload = await db()
    return toOrg((await payload.findByID({ collection: 'partner-orgs', id, depth: 0, overrideAccess: true })) as unknown as Doc)
  } catch {
    return null
  }
}

/** The organisation of a partner scope, re-read (the session's copy is the request's; a form posts against the latest row). */
export const scopedOrg = (scope: OrgScope): Promise<PartnerOrg | null> => loadOrg(scope.orgId)

export const findOrgByPartnerId = async (partnerId: string): Promise<PartnerOrg | null> => {
  const n = partnerId.trim().toUpperCase()
  if (!/^K7P-\d{5}$/.test(n)) return null
  const payload = await db()
  const r = await payload.find({ collection: 'partner-orgs', where: { partnerId: { equals: n } }, limit: 1, depth: 0, overrideAccess: true })
  const doc = r.docs[0] as unknown as Doc | undefined
  return doc ? toOrg(doc) : null
}

export type OrgFilter = { status?: OrgStatus | 'edits' | 'all'; q?: string; page?: number; limit?: number }
export type OrgPage = { rows: PartnerOrg[]; total: number; page: number; totalPages: number }

/** The K7 ledger of every organisation: newest first; `edits` lists the ones with a legal edit waiting. */
export const listOrgs = async (f: OrgFilter = {}): Promise<OrgPage> => {
  const payload = await db()
  const status = f.status ?? 'all'
  const parts: Where[] = []
  if (status === 'edits') parts.push({ pendingLegalEdit: { exists: true } })
  else if (status !== 'all') parts.push({ status: { equals: status } })
  const q = f.q?.trim()
  if (q) parts.push({ or: [{ partnerId: { like: q } }, { name: { like: q } }, { tradeName: { like: q } }, { city: { like: q } }, { gstin: { like: q } }, { 'crm.accountCode': { like: q } }] })
  const limit = f.limit ?? 25
  const page = Math.max(1, f.page ?? 1)
  const r = await payload.find({ collection: 'partner-orgs', where: parts.length ? { and: parts } : {}, sort: '-createdAt', limit, page, depth: 0, overrideAccess: true })
  const rows = (r.docs as unknown as Doc[]).map(toOrg).filter((o) => status !== 'edits' || o.pendingLegalEdit)
  return { rows, total: r.totalDocs, page: r.page ?? page, totalPages: r.totalPages }
}

export const orgCounts = async (): Promise<{ approved: number; suspended: number; edits: number }> => {
  const payload = await db()
  const [a, s, e] = await Promise.all([
    payload.count({ collection: 'partner-orgs', where: { status: { equals: 'approved' } }, overrideAccess: true }),
    payload.count({ collection: 'partner-orgs', where: { status: { equals: 'suspended' } }, overrideAccess: true }),
    payload.count({ collection: 'partner-orgs', where: { pendingLegalEdit: { exists: true } }, overrideAccess: true }),
  ])
  return { approved: a.totalDocs, suspended: s.totalDocs, edits: e.totalDocs }
}

/* ---------- The Partner Admin's edits ---------- */

export type SaveResult<T = PartnerOrg> = { ok: true; org: T } | { ok: false; errors: FieldErrors }

/** The details change at once: trade name, address, website, regions. Not the legal identity. */
export const saveOrgDetails = async (me: PartnerContext, d: OrgDetails): Promise<SaveResult> => {
  const settings = await getPartnerSettings()
  const regions = d.regions.filter((r) => settings.regions.some((a) => a.code === r))
  const errors = validateDetails({ ...d, regions }, settings.regions)
  if (Object.keys(errors).length) return { ok: false, errors }
  const before = (await loadOrg(me.scope.orgId)) ?? me.org
  const data = { tradeName: d.tradeName.trim(), address: d.address.trim(), city: d.city.trim(), state: d.state.trim(), country: d.country.trim(), pin: d.pin.trim(), website: normaliseWebsite(d.website), regions }
  const org = await update(me.scope.orgId, data)
  const changed = (Object.keys(data) as (keyof typeof data)[]).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(data[k]))
  if (changed.length) await audit({ actor: me.actor, object: 'partner-orgs', objectId: org.id, objectLabel: org.partnerId, action: 'org.details-updated', orgId: org.id, comment: `Changed: ${changed.join(', ')}`, meta: { before: Object.fromEntries(changed.map((k) => [k, before[k]])), after: Object.fromEntries(changed.map((k) => [k, data[k]])) } })
  return { ok: true, org }
}

/** A change to the legal name, GSTIN or PAN is proposed, not made: it waits for a Channel Manager (FR-REG-07). One at a time. */
export const proposeLegalEdit = async (me: PartnerContext, l: LegalIdentity, reason: string): Promise<SaveResult> => {
  const current = (await loadOrg(me.scope.orgId)) ?? me.org
  if (current.pendingLegalEdit) return { ok: false, errors: { pending: 'An edit is already waiting for K7. Withdraw it to propose another.' } }
  const errors = validateLegal(l)
  if (Object.keys(errors).length) return { ok: false, errors }
  const next = normaliseLegal(l)
  const changes = legalChanges(current, next)
  if (!changes.length) return { ok: false, errors: { none: 'Nothing changed.' } }
  if (reason.trim().length < 3) return { ok: false, errors: { reason: 'Tell K7 why the identity changes.' } }
  const edit: LegalEdit = { ...next, proposedAt: new Date().toISOString(), proposedBy: { id: me.user.id, name: me.user.name, email: me.user.email }, reason: reason.trim() }
  const org = await update(current.id, { pendingLegalEdit: edit })
  const summary = changes.map((c) => `${c.label}: ${c.from || '—'} → ${c.to || '—'}`).join('; ')
  await audit({ actor: me.actor, object: 'partner-orgs', objectId: org.id, objectLabel: org.partnerId, action: 'org.legal-edit-proposed', orgId: org.id, comment: `${summary}. Reason: ${edit.reason}` })
  await notify({
    event: 'org.legal-edit-proposed',
    subject: `${org.partnerId} asks to change its legal identity`,
    body: `${org.name}: ${summary}. Reason: ${edit.reason}. Approve or decline it on the partner's sheet.`,
    href: `${K7_PARTNERS}/${org.partnerId}`,
    to: { kind: 'staff', role: 'channelManager' },
  })
  return { ok: true, org }
}

export const withdrawLegalEdit = async (me: PartnerContext): Promise<PartnerOrg> => {
  const current = (await loadOrg(me.scope.orgId)) ?? me.org
  if (!current.pendingLegalEdit) return current
  const org = await update(current.id, { pendingLegalEdit: null })
  await audit({ actor: me.actor, object: 'partner-orgs', objectId: org.id, objectLabel: org.partnerId, action: 'org.legal-edit-withdrawn', orgId: org.id })
  return org
}

/* ---------- The Channel Manager's decisions ---------- */

export type LegalDecision = 'approve' | 'decline'

/** Approve applies the proposed identity and clears the edit; decline clears it with a note the organisation's admins read. */
export const decideLegalEdit = async (o: PartnerOrg, decision: LegalDecision, note: string, me: K7Context): Promise<{ ok: true; org: PartnerOrg } | { ok: false; error: string }> => {
  const org = (await loadOrg(o.id)) ?? o
  const edit = org.pendingLegalEdit
  if (!edit) return { ok: false, error: 'No legal-identity edit is waiting.' }
  const comment = note.trim()
  if (decision === 'decline' && comment.length < 3) return { ok: false, error: 'Tell the partner why not.' }
  const changes = legalChanges(org, edit)
  const summary = changes.map((c) => `${c.label}: ${c.from || '—'} → ${c.to || '—'}`).join('; ') || 'no change'
  const data: Record<string, unknown> = { pendingLegalEdit: null }
  if (decision === 'approve') Object.assign(data, { name: edit.name, gstin: edit.gstin, pan: edit.pan })
  const saved = await update(org.id, data)
  await audit({ actor: me.actor, object: 'partner-orgs', objectId: saved.id, objectLabel: saved.partnerId, action: decision === 'approve' ? 'org.legal-edit-approved' : 'org.legal-edit-declined', orgId: saved.id, comment: `${summary}${comment ? `. ${comment}` : ''}`, meta: { edit } })
  await notify({
    event: decision === 'approve' ? 'org.legal-edit-approved' : 'org.legal-edit-declined',
    subject: decision === 'approve' ? `Your legal identity change is approved` : `Your legal identity change was not accepted`,
    body: decision === 'approve' ? `K7 has approved the change: ${summary}.${comment ? ` ${comment}` : ''}${changes.some((c) => c.field === 'name') ? ' Your partner ID is unchanged.' : ''}` : `K7 did not accept the change (${summary}). Reason: ${comment}. Your organisation keeps its current identity; you may propose another edit.`,
    href: PARTNER_ORG,
    to: { kind: 'org', orgId: saved.id, roles: ['admin'] },
  })
  return { ok: true, org: saved }
}

/** Suspend (with the reason every user reads) or reinstate. Sessions end on their next request; the door refuses codes. */
export const setOrgStatus = async (o: PartnerOrg, to: OrgStatus, reason: string, me: K7Context): Promise<{ ok: true; org: PartnerOrg } | { ok: false; error: string }> => {
  const org = (await loadOrg(o.id)) ?? o
  if (!canMoveOrg(org.status, to)) return { ok: false, error: `The organisation is already ${ORG_STATUS_LABEL[org.status].toLowerCase()}.` }
  const comment = reason.trim()
  if (to === 'suspended' && comment.length < 3) return { ok: false, error: 'Give the reason; every user of the organisation reads it.' }
  const now = new Date().toISOString()
  const saved = await update(org.id, to === 'suspended' ? { status: 'suspended', suspendedAt: now, suspendedReason: comment } : { status: 'approved', suspendedAt: null, suspendedReason: '' })
  await audit({ actor: me.actor, object: 'partner-orgs', objectId: saved.id, objectLabel: saved.partnerId, action: to === 'suspended' ? 'org.suspended' : 'org.reinstated', from: org.status, to, orgId: saved.id, comment })
  await notify({
    event: to === 'suspended' ? 'org.suspended' : 'org.reinstated',
    subject: to === 'suspended' ? `${saved.name}: access to the K7 Partner Portal is suspended` : `${saved.name}: access to the K7 Partner Portal is restored`,
    body: to === 'suspended' ? `K7 has suspended your organisation's access. Reason: ${comment}. No one from ${saved.name} can sign in until a Channel Manager reinstates it.` : `Your organisation's access is restored. You can sign in again.${comment ? ` ${comment}` : ''}`,
    href: '/partners/portal',
    to: { kind: 'org', orgId: saved.id },
  })
  return { ok: true, org: saved }
}

/** The certificate waiver (decision 8): until this date the organisation may register deals without a certificate. */
export const setWaiver = async (o: PartnerOrg, until: string | null, me: K7Context): Promise<{ ok: true; org: PartnerOrg } | { ok: false; error: string }> => {
  if (until && !/^\d{4}-\d{2}-\d{2}$/.test(until)) return { ok: false, error: 'A date, like 2027-03-31.' }
  if (until && until < new Date().toISOString().slice(0, 10)) return { ok: false, error: 'The waiver must end in the future.' }
  const saved = await update(o.id, { waiverUntil: until })
  await audit({ actor: me.actor, object: 'partner-orgs', objectId: saved.id, objectLabel: saved.partnerId, action: until ? 'org.waiver-set' : 'org.waiver-cleared', from: o.waiverUntil ?? '', to: until ?? '', orgId: saved.id })
  return { ok: true, org: saved }
}

import 'server-only'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { toLegalEdit, type LegalEdit } from './organisation-model'
import { PARTNER_ROLES, PARTNER_TYPES, type PartnerRole, type PartnerType } from './settings-model'

/* Partner users and their organisations, read for sign-in and for every request's context. Nothing here is cached: a
   suspension or a role change takes effect on the next request (M3). */

export type PartnerOrg = {
  id: string
  partnerId: string
  name: string
  tradeName: string
  type: PartnerType
  status: 'approved' | 'suspended'
  gstin: string
  pan: string
  address: string
  city: string
  state: string
  country: string
  pin: string
  website: string
  regions: string[]
  crm: { accountId: string; accountCode: string; contactId: string }
  certificate: { status: string; until: string | null }
  waiverUntil: string | null
  suspendedAt: string | null
  suspendedReason: string
  pendingLegalEdit: LegalEdit | null
  applicationId: string
  createdAt: string
  updatedAt: string
}
export type PartnerUser = { id: string; orgId: string; email: string; name: string; designation: string; mobile: string; roles: PartnerRole[]; status: 'invited' | 'active' | 'disabled'; invitedAt: string | null; lastSignInAt: string | null; createdAt: string }

const db = () => getPayload({ config: configPromise })
type Doc = Record<string, unknown>
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v))
const d = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

export const toOrg = (x: Doc): PartnerOrg => {
  const cert = (x.certificate ?? {}) as Doc
  const crm = (x.crm ?? {}) as Doc
  return {
    id: s(x.id),
    partnerId: s(x.partnerId),
    name: s(x.name),
    tradeName: s(x.tradeName),
    type: (PARTNER_TYPES as readonly string[]).includes(s(x.type)) ? (s(x.type) as PartnerType) : 'var',
    status: x.status === 'suspended' ? 'suspended' : 'approved',
    gstin: s(x.gstin),
    pan: s(x.pan),
    address: s(x.address),
    city: s(x.city),
    state: s(x.state),
    country: s(x.country),
    pin: s(x.pin),
    website: s(x.website),
    regions: Array.isArray(x.regions) ? x.regions.map(String) : [],
    crm: { accountId: s(crm.accountId), accountCode: s(crm.accountCode), contactId: s(crm.contactId) },
    certificate: { status: s(cert.status) || 'none', until: d(cert.until) },
    waiverUntil: d(x.waiverUntil),
    suspendedAt: d(x.suspendedAt),
    suspendedReason: s(x.suspendedReason),
    pendingLegalEdit: toLegalEdit(x.pendingLegalEdit),
    applicationId: s(x.applicationId),
    createdAt: s(x.createdAt),
    updatedAt: s(x.updatedAt),
  }
}

export const toUser = (x: Doc): PartnerUser => {
  const org = x.org
  return {
    id: s(x.id),
    orgId: s(typeof org === 'object' && org !== null ? (org as Doc).id : org),
    email: s(x.email).toLowerCase(),
    name: s(x.name),
    designation: s(x.designation),
    mobile: s(x.mobile),
    roles: Array.isArray(x.roles) ? (x.roles.filter((r) => (PARTNER_ROLES as readonly string[]).includes(String(r))) as PartnerRole[]) : [],
    status: x.status === 'active' ? 'active' : x.status === 'disabled' ? 'disabled' : 'invited',
    invitedAt: d(x.invitedAt),
    lastSignInAt: d(x.lastSignInAt),
    createdAt: s(x.createdAt),
  }
}

/** The user with this email, whatever their status, with the organisation. Null when unknown. */
export const findPartnerUserByEmail = async (email: string): Promise<{ user: PartnerUser; org: PartnerOrg } | null> => {
  const payload = await db()
  const r = await payload.find({ collection: 'partner-users', where: { email: { equals: email.trim().toLowerCase() } }, depth: 1, limit: 1, overrideAccess: true })
  const doc = r.docs[0] as unknown as Doc | undefined
  if (!doc) return null
  const org = doc.org
  if (!org || typeof org !== 'object') return null
  return { user: toUser(doc), org: toOrg(org as Doc) }
}

export const loadPartnerUser = async (id: string): Promise<{ user: PartnerUser; org: PartnerOrg } | null> => {
  if (!id) return null
  const payload = await db()
  try {
    const doc = (await payload.findByID({ collection: 'partner-users', id, depth: 1, overrideAccess: true })) as unknown as Doc
    const org = doc.org
    if (!org || typeof org !== 'object') return null
    return { user: toUser(doc), org: toOrg(org as Doc) }
  } catch {
    return null
  }
}

/** Whether this pair may sign in: a user who is not disabled, in an organisation that is not suspended (M3). */
export const canSignIn = (u: PartnerUser, o: PartnerOrg): { ok: true } | { ok: false; reason: 'user' | 'org' } => {
  if (o.status !== 'approved') return { ok: false, reason: 'org' }
  if (u.status === 'disabled') return { ok: false, reason: 'user' }
  return { ok: true }
}

/** The first sign-in activates an invited user and every sign-in stamps the time. */
export const touchSignIn = async (u: PartnerUser): Promise<void> => {
  const payload = await db()
  await payload.update({ collection: 'partner-users', id: u.id, data: { lastSignInAt: new Date().toISOString(), ...(u.status === 'invited' ? { status: 'active' } : {}) }, overrideAccess: true })
}

/** Every active user of an organisation, optionally only those holding one of the roles (for notifications). */
export const orgUsers = async (orgId: string, roles?: PartnerRole[]): Promise<PartnerUser[]> => {
  const payload = await db()
  const r = await payload.find({ collection: 'partner-users', where: { and: [{ org: { equals: orgId } }, { status: { not_equals: 'disabled' } }] }, depth: 0, limit: 200, overrideAccess: true })
  const all = (r.docs as unknown as Doc[]).map(toUser)
  return roles?.length ? all.filter((u) => u.roles.some((x) => roles.includes(x))) : all
}

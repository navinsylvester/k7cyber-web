import { isEmailAddress, isMobile, normaliseWebsite, validateCompany, type FieldErrors } from './registration-model'
import { PARTNER_ROLES, type PartnerRole } from './settings-model'

/* The organisation and its people as the code reads them (01-requirements.md §2, FR-REG-07; 02-build-plan.md M3), pure and tested
   without a tenant. The writers are organisation.ts and members.ts.

   Two kinds of edit to a profile: the details (trade name, address, website, regions) the Partner Admin changes at once, and the
   legal identity (legal name, GSTIN, PAN), which goes to a pending edit the Channel Manager approves or declines (FR-REG-07).
   One pending edit at a time; the organisation keeps its current identity until K7 agrees. */

/* ---------- The profile ---------- */

export type OrgDetails = { tradeName: string; address: string; city: string; state: string; country: string; pin: string; website: string; regions: string[] }
export type LegalIdentity = { name: string; gstin: string; pan: string }
export const LEGAL_FIELDS: readonly (keyof LegalIdentity)[] = ['name', 'gstin', 'pan']
export const LEGAL_FIELD_LABEL: Record<keyof LegalIdentity, string> = { name: 'Legal name', gstin: 'GSTIN', pan: 'PAN' }

/** A legal-identity edit waiting for K7 (`partner-orgs.pendingLegalEdit`): the proposed values, who asked, why. */
export type LegalEdit = LegalIdentity & { proposedAt: string; proposedBy: { id: string; name: string; email: string }; reason: string }

export const normaliseLegal = (l: LegalIdentity): LegalIdentity => ({ name: l.name.trim(), gstin: l.gstin.trim().toUpperCase(), pan: l.pan.trim().toUpperCase() })

export const validateDetails = (d: OrgDetails, allowedRegions: { code: string }[]): FieldErrors => {
  const e: FieldErrors = {}
  if (d.address.trim().length < 4) e.address = 'Give the registered address.'
  if (!d.city.trim()) e.city = 'City is needed.'
  if (!d.state.trim()) e.state = 'State is needed.'
  if (!d.country.trim()) e.country = 'Country is needed.'
  if (!d.pin.trim()) e.pin = 'PIN or postal code is needed.'
  if (d.website && !/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(normaliseWebsite(d.website))) e.website = 'That does not look like a web address.'
  if (allowedRegions.length && !d.regions.some((r) => allowedRegions.some((a) => a.code === r))) e.regions = 'Pick at least one region you operate in.'
  return e
}

/** The legal fields validate like the application's (the same GSTIN and PAN shapes); the name may not be blank. */
export const validateLegal = (l: LegalIdentity): FieldErrors => {
  const n = normaliseLegal(l)
  const all = validateCompany({ legalName: n.name, tradeName: '', address: 'x'.repeat(4), city: 'x', state: 'x', country: 'x', pin: 'x', website: '', yearOfIncorporation: 2000, size: '1-10', turnover: 'lt1', gstin: n.gstin, pan: n.pan })
  const e: FieldErrors = {}
  if (all.legalName) e.name = all.legalName
  if (all.gstin) e.gstin = all.gstin
  if (all.pan) e.pan = all.pan
  return e
}

export type LegalChange = { field: keyof LegalIdentity; label: string; from: string; to: string }

/** What a proposed identity changes against the current one; an edit that changes nothing is not an edit. */
export const legalChanges = (current: LegalIdentity, proposed: LegalIdentity): LegalChange[] => {
  const cur = normaliseLegal(current)
  const next = normaliseLegal(proposed)
  return LEGAL_FIELDS.filter((f) => cur[f] !== next[f]).map((f) => ({ field: f, label: LEGAL_FIELD_LABEL[f], from: cur[f], to: next[f] }))
}

type Raw = Record<string, unknown>
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

/** The stored pending edit, or null when the JSON is absent or not an edit. */
export const toLegalEdit = (v: unknown): LegalEdit | null => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const r = v as Raw
  if (!s(r.proposedAt)) return null
  const by = (r.proposedBy ?? {}) as Raw
  return { name: s(r.name), gstin: s(r.gstin), pan: s(r.pan), proposedAt: s(r.proposedAt), proposedBy: { id: s(by.id), name: s(by.name), email: s(by.email) }, reason: s(r.reason) }
}

/* ---------- The people (FR-ROLE-01, FR-ROLE-02) ---------- */

export const USER_STATUSES = ['invited', 'active', 'disabled'] as const
export type UserStatus = (typeof USER_STATUSES)[number]
export const USER_STATUS_LABEL: Record<UserStatus, string> = { invited: 'Invited', active: 'Active', disabled: 'Disabled' }

const USER_NEXT: Record<UserStatus, readonly UserStatus[]> = {
  invited: ['active', 'disabled'], // active by the first sign-in
  active: ['disabled'],
  disabled: ['active', 'invited'], // re-enabled: back to where they were (invited if they never signed in)
}
export const canMoveUser = (from: UserStatus, to: UserStatus): boolean => USER_NEXT[from]?.includes(to) ?? false

/** Where a re-enabled user returns to: active if they ever signed in, else invited (the next code activates them). */
export const reenabledStatus = (u: { lastSignInAt: string | null }): UserStatus => (u.lastSignInAt ? 'active' : 'invited')

export type MemberInput = { name: string; email: string; designation: string; mobile: string; roles: PartnerRole[] }

export const normaliseRoles = (v: unknown): PartnerRole[] => (Array.isArray(v) ? (PARTNER_ROLES.filter((r) => v.includes(r)) as PartnerRole[]) : [])

export const validateMember = (m: MemberInput, o: { email?: boolean } = { email: true }): FieldErrors => {
  const e: FieldErrors = {}
  if (m.name.trim().length < 2) e.name = 'Their name.'
  if (o.email !== false && !isEmailAddress(m.email.trim())) e.email = 'A valid work email; their sign-in code goes there.'
  if (m.mobile.trim() && !isMobile(m.mobile)) e.mobile = 'A mobile number with 10 to 15 digits, or blank.'
  if (!m.roles.length) e.roles = 'Give them at least one role.'
  return e
}

type Member = { id: string; roles: PartnerRole[]; status: UserStatus }

/** Who counts as an admin the organisation can rely on: not disabled, holding the admin role. */
export const isStandingAdmin = (u: Member): boolean => u.status !== 'disabled' && u.roles.includes('admin')

/** Whether the organisation still has an admin after `target` is given `next` (status and roles). The actor may not lock the
    organisation out: at least one standing Partner Admin remains, and the actor keeps their own admin role and their own access. */
export const memberChangeError = (actor: Member, target: Member, next: Partial<Member>, members: Member[]): string | null => {
  const after: Member = { ...target, ...next }
  if (actor.id === target.id) {
    if (after.status === 'disabled') return 'You cannot disable yourself. Ask another Partner Admin.'
    if (!after.roles.includes('admin')) return 'You cannot take the Partner Admin role from yourself. Give it to someone else first, and ask them to change yours.'
  }
  const others = members.filter((m) => m.id !== target.id)
  if (!isStandingAdmin(after) && !others.some(isStandingAdmin)) return 'The organisation needs at least one Partner Admin who is not disabled.'
  return null
}

/** Removing a member is the same test with the member gone. */
export const memberRemoveError = (actor: Member, target: Member, members: Member[]): string | null => {
  if (actor.id === target.id) return 'You cannot remove yourself.'
  const others = members.filter((m) => m.id !== target.id)
  if (isStandingAdmin(target) && !others.some(isStandingAdmin)) return 'The organisation needs at least one Partner Admin who is not disabled.'
  return null
}

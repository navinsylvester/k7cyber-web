/* The partner portal's settings as the code reads them (02-build-plan.md §5, global `partner-settings`): a pure model with
   defaults and a normaliser over the raw Payload document, so pages never see a half-saved global. Tested without a tenant. */

export const STAFF_ROLES = ['channelManager', 'dealDeskApprover', 'trainingAdmin', 'marketingAdmin', 'schemeAdmin'] as const
export type StaffRole = (typeof STAFF_ROLES)[number]
export const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  channelManager: 'Channel Manager',
  dealDeskApprover: 'Deal Desk Approver',
  trainingAdmin: 'Training Admin',
  marketingAdmin: 'Marketing Admin',
  schemeAdmin: 'Scheme Admin',
}

export const PARTNER_TYPES = ['distributor', 'integrationPartner', 'var', 'msp'] as const
export type PartnerType = (typeof PARTNER_TYPES)[number]
export const PARTNER_TYPE_LABEL: Record<PartnerType, string> = {
  distributor: 'Distributor',
  integrationPartner: 'Integration Partner',
  var: 'Value Added Reseller',
  msp: 'Managed Service Provider',
}

export const PARTNER_ROLES = ['admin', 'sales', 'technical'] as const
export type PartnerRole = (typeof PARTNER_ROLES)[number]
export const PARTNER_ROLE_LABEL: Record<PartnerRole, string> = { admin: 'Partner Admin', sales: 'Sales', technical: 'Technical' }

export type StaffEntry = { email: string; name: string; roles: StaffRole[] }

export type PartnerSettings = {
  staff: StaffEntry[]
  channelManagersApproveDeals: boolean
  marketingAdminsRunSchemes: boolean
  devStaffPass: boolean
  partnerTypes: PartnerType[]
  regions: { code: string; name: string }[]
  terms: { version: string; url: string }
  deals: { protectionDays: number; extensionDays: number; approvalSlaHours: number; requireCertificate: boolean; conflictCheckCrm: boolean }
  crm: { enabled: boolean; ownerRule: 'approver' | 'fixed'; ownerId: string; enquirySource: number; productCategory: number; accountNamePattern: string }
  notify: { emailEnabled: boolean; mailFrom: string; bellRetentionDays: number }
}

export const DEFAULT_PARTNER_SETTINGS: PartnerSettings = {
  staff: [],
  channelManagersApproveDeals: true,
  marketingAdminsRunSchemes: true,
  devStaffPass: true,
  partnerTypes: ['distributor', 'integrationPartner', 'var'],
  regions: [],
  terms: { version: '2026-10', url: '' },
  deals: { protectionDays: 90, extensionDays: 90, approvalSlaHours: 48, requireCertificate: false, conflictCheckCrm: false },
  crm: { enabled: false, ownerRule: 'approver', ownerId: '', enquirySource: 1, productCategory: 36, accountNamePattern: '{customer}-Fresh-{product}' },
  notify: { emailEnabled: true, mailFrom: 'K7 Partner Programme <partners@k7computing.com>', bellRetentionDays: 180 },
}

type Raw = Record<string, unknown>
const obj = (v: unknown): Raw => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : {})
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object').map((x) => x as Raw) : [])
const str = (v: unknown, d: string): string => (typeof v === 'string' ? v : d)
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d)
const num = (v: unknown, d: number, min = 0): number => (typeof v === 'number' && Number.isFinite(v) && v >= min ? v : d)
const email = (v: unknown): string => str(v, '').trim().toLowerCase()
const pick = <T extends string>(v: unknown, all: readonly T[]): T[] => (Array.isArray(v) ? (v.filter((x) => typeof x === 'string' && (all as readonly string[]).includes(x)) as T[]) : [])

export const normalisePartnerSettings = (g: Raw | null | undefined): PartnerSettings => {
  const r = g ?? {}
  const D = DEFAULT_PARTNER_SETTINGS
  const deals = obj(r.deals)
  const crm = obj(r.crm)
  const notify = obj(r.notify)
  const terms = obj(r.terms)
  const staff = arr(r.staff)
    .map((s) => ({ email: email(s.email), name: str(s.name, ''), roles: pick(s.roles, STAFF_ROLES) }))
    .filter((s) => s.email.includes('@') && s.roles.length)
  const types = pick(r.partnerTypes, PARTNER_TYPES)
  return {
    staff,
    channelManagersApproveDeals: bool(r.channelManagersApproveDeals, D.channelManagersApproveDeals),
    marketingAdminsRunSchemes: bool(r.marketingAdminsRunSchemes, D.marketingAdminsRunSchemes),
    devStaffPass: bool(r.devStaffPass, D.devStaffPass),
    partnerTypes: types.length ? types : D.partnerTypes,
    regions: arr(r.regions)
      .map((x) => ({ code: str(x.code, '').trim(), name: str(x.name, '').trim() }))
      .filter((x) => x.code && x.name),
    terms: { version: str(terms.version, D.terms.version) || D.terms.version, url: str(terms.url, '') },
    deals: {
      protectionDays: num(deals.protectionDays, D.deals.protectionDays, 1),
      extensionDays: num(deals.extensionDays, D.deals.extensionDays, 1),
      approvalSlaHours: num(deals.approvalSlaHours, D.deals.approvalSlaHours, 1),
      requireCertificate: bool(deals.requireCertificate, D.deals.requireCertificate),
      conflictCheckCrm: bool(deals.conflictCheckCrm, D.deals.conflictCheckCrm),
    },
    crm: {
      enabled: bool(crm.enabled, D.crm.enabled),
      ownerRule: crm.ownerRule === 'fixed' ? 'fixed' : 'approver',
      ownerId: str(crm.ownerId, ''),
      enquirySource: num(crm.enquirySource, D.crm.enquirySource),
      productCategory: num(crm.productCategory, D.crm.productCategory),
      accountNamePattern: str(crm.accountNamePattern, D.crm.accountNamePattern) || D.crm.accountNamePattern,
    },
    notify: {
      emailEnabled: bool(notify.emailEnabled, D.notify.emailEnabled),
      mailFrom: str(notify.mailFrom, D.notify.mailFrom) || D.notify.mailFrom,
      bellRetentionDays: num(notify.bellRetentionDays, D.notify.bellRetentionDays, 7),
    },
  }
}

/** The roles a K7 person holds, with the two default-on fallbacks (decision 5, appendix 3): Channel Managers approve deals and
    Marketing Admins run schemes unless the flags say otherwise. Development sign-ins hold every role when `devStaffPass` is on. */
export const staffRolesFor = (emailAddress: string, s: PartnerSettings, o: { dev?: boolean; production?: boolean } = {}): StaffRole[] => {
  if (o.dev && !o.production && s.devStaffPass) return [...STAFF_ROLES]
  const e = emailAddress.trim().toLowerCase()
  if (!e) return []
  const held = new Set<StaffRole>()
  for (const p of s.staff) if (p.email === e) for (const r of p.roles) held.add(r)
  if (s.channelManagersApproveDeals && held.has('channelManager')) held.add('dealDeskApprover')
  if (s.marketingAdminsRunSchemes && held.has('marketingAdmin')) held.add('schemeAdmin')
  return STAFF_ROLES.filter((r) => held.has(r))
}

/** Who holds a role, for notifications to K7 staff: each person once, with every role they hold across their rows and the fallbacks. */
export const staffWithRole = (role: StaffRole, s: PartnerSettings): StaffEntry[] => {
  const seen = new Map<string, StaffEntry>()
  for (const p of s.staff) {
    const roles = staffRolesFor(p.email, s)
    if (!roles.includes(role) || seen.has(p.email)) continue
    seen.set(p.email, { email: p.email, name: p.name, roles })
  }
  return [...seen.values()]
}

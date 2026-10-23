import { DEFAULT_SLA_SETTINGS, type SlaSettings } from './sla-model'

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

export type StaffEntry = { email: string; name: string; roles: StaffRole[]; /** Their manager's work email, told when an approval SLA is breached (FR-NTF-01). */ manager: string }

export type PartnerSettings = {
  staff: StaffEntry[]
  channelManagersApproveDeals: boolean
  marketingAdminsRunSchemes: boolean
  devStaffPass: boolean
  partnerTypes: PartnerType[]
  regions: { code: string; name: string }[]
  terms: { version: string; url: string }
  deals: { protectionDays: number; extensionDays: number; approvalSlaHours: number; endingNoticeDays: number; requireCertificate: boolean; conflictCheckCrm: boolean }
  crm: {
    enabled: boolean
    ownerRule: 'approver' | 'fixed'
    ownerId: string
    enquirySource: number
    productCategory: number
    accountNamePattern: string
    syncMinutes: number
    /** M9, the go-live gate (docs/partner-portal/05-staging-and-go-live.md §5): each CRM feature behind its own switch under the
        master `enabled`, so writes are turned on one at a time and turned off again without touching the others. */
    features: CrmFeatures
  }
  notify: { emailEnabled: boolean; mailFrom: string; bellRetentionDays: number; /** The closing line of every email. */ signature: string }
  /** M8: the approval SLA's working hours, the warning share and the extra addresses told on a breach. */
  sla: SlaSettings
  /** FR-MKT-02: the collateral file cap in MB, at most the server's 200. */
  collateral: { maxMb: number }
  /** FR-ELG-05: the days after publication in which a partner may dispute a result (a scheme may override). */
  schemes: { disputeDays: number }
}

export const CRM_FEATURES = ['accountCreate', 'opportunityCreate', 'sync'] as const
export type CrmFeature = (typeof CRM_FEATURES)[number]
export type CrmFeatures = Record<CrmFeature, boolean>
export const CRM_FEATURE_LABEL: Record<CrmFeature, string> = {
  accountCreate: 'Partner account and contact on approval',
  opportunityCreate: 'End customer and opportunity on deal approval',
  sync: 'Dashboard read-back of the opportunities',
}
export const DEFAULT_CRM_FEATURES: CrmFeatures = { accountCreate: true, opportunityCreate: true, sync: true }

/** Whether a CRM feature may run: the master switch and the feature's own. */
export const crmFeatureOn = (s: Pick<PartnerSettings, 'crm'>, f: CrmFeature): boolean => s.crm.enabled && s.crm.features[f]

export const COLLATERAL_MAX_MB_CEILING = 200

export const DEFAULT_PARTNER_SETTINGS: PartnerSettings = {
  staff: [],
  channelManagersApproveDeals: true,
  marketingAdminsRunSchemes: true,
  devStaffPass: true,
  partnerTypes: ['distributor', 'integrationPartner', 'var'],
  regions: [],
  terms: { version: '2026-10', url: '' },
  deals: { protectionDays: 90, extensionDays: 90, approvalSlaHours: 48, endingNoticeDays: 14, requireCertificate: false, conflictCheckCrm: false },
  crm: { enabled: false, ownerRule: 'approver', ownerId: '', enquirySource: 1, productCategory: 36, accountNamePattern: '{customer}-Fresh-{product}', syncMinutes: 60, features: { ...DEFAULT_CRM_FEATURES } },
  notify: { emailEnabled: true, mailFrom: 'K7 Partner Programme <partners@k7computing.com>', bellRetentionDays: 180, signature: 'K7 Partner Programme\nK7 Computing Pvt Ltd' },
  sla: DEFAULT_SLA_SETTINGS,
  collateral: { maxMb: 200 },
  schemes: { disputeDays: 14 },
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
    .map((s) => ({ email: email(s.email), name: str(s.name, ''), roles: pick(s.roles, STAFF_ROLES), manager: email(s.manager) }))
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
      endingNoticeDays: num(deals.endingNoticeDays, D.deals.endingNoticeDays, 1),
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
      syncMinutes: num(crm.syncMinutes, D.crm.syncMinutes, 5),
      features: Object.fromEntries(CRM_FEATURES.map((f) => [f, bool(obj(crm.features)[f], DEFAULT_CRM_FEATURES[f])])) as CrmFeatures,
    },
    notify: {
      emailEnabled: bool(notify.emailEnabled, D.notify.emailEnabled),
      mailFrom: str(notify.mailFrom, D.notify.mailFrom) || D.notify.mailFrom,
      bellRetentionDays: num(notify.bellRetentionDays, D.notify.bellRetentionDays, 7),
      signature: str(notify.signature, D.notify.signature) || D.notify.signature,
    },
    sla: normaliseSla(obj(r.sla)),
    collateral: { maxMb: Math.min(num(obj(r.collateral).maxMb, D.collateral.maxMb, 1), COLLATERAL_MAX_MB_CEILING) },
    schemes: { disputeDays: num(obj(r.schemes).disputeDays, D.schemes.disputeDays, 0) },
  }
}

const HM = /^\d{1,2}:\d{2}$/
const normaliseSla = (r: Raw): SlaSettings => {
  const D = DEFAULT_SLA_SETTINGS
  const days = Array.isArray(r.days) ? r.days.map((d) => Number(d)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : D.hours.days
  return {
    hours: {
      mode: r.mode === 'always' ? 'always' : 'business',
      start: HM.test(str(r.start, '')) ? str(r.start, '') : D.hours.start,
      end: HM.test(str(r.end, '')) ? str(r.end, '') : D.hours.end,
      days: days.length ? [...new Set(days)].sort() : D.hours.days,
      timeZone: str(r.timeZone, '').trim() || D.hours.timeZone,
    },
    warnShare: typeof r.warnShare === 'number' && r.warnShare > 0 && r.warnShare < 1 ? r.warnShare : D.warnShare,
    escalateTo: Array.isArray(r.escalateTo) ? r.escalateTo.map((x) => (typeof x === 'string' ? x : email(obj(x).email))).map((x) => x.trim().toLowerCase()).filter((x) => x.includes('@')) : [],
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
    seen.set(p.email, { email: p.email, name: p.name, roles, manager: p.manager })
  }
  return [...seen.values()]
}

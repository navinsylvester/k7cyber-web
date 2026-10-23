import { PARTNER_TYPES, type PartnerType } from './settings-model'
import type { ApplicationStatus } from './status'

/* The application as the code reads it (01-requirements.md §3, FR-REG-02), the bands the form offers, the validation of the join
   steps and the mapping of an approved application onto a Dynamics account and contact (03-dynamics-exploration.md §6). Pure:
   tested without a tenant; the storage and the writers are in registration.ts and mirror.ts. */

/* ---------- Bands (the CRM's own option sets, by value, never by label) ---------- */

/** Annual turnover: `alletec_approxlyturnover` 0–7. */
export const TURNOVER_BANDS = [
  { key: 'lt1', label: 'Under ₹1 crore', crm: 0 },
  { key: '1-5', label: '₹1–5 crore', crm: 1 },
  { key: '6-10', label: '₹6–10 crore', crm: 2 },
  { key: '11-20', label: '₹11–20 crore', crm: 3 },
  { key: '21-40', label: '₹21–40 crore', crm: 4 },
  { key: '41-60', label: '₹41–60 crore', crm: 5 },
  { key: '61-100', label: '₹61–100 crore', crm: 6 },
  { key: 'gt100', label: 'Over ₹100 crore', crm: 7 },
] as const
export type TurnoverBand = (typeof TURNOVER_BANDS)[number]['key']

/** Company size by people; the CRM only has a sales-force count (`alletec_salesforcecount`), so the mapping is the nearest band up. */
export const SIZE_BANDS = [
  { key: '1-10', label: '1–10 people', crm: 4 },
  { key: '11-50', label: '11–50 people', crm: 5 },
  { key: '51-200', label: '51–200 people', crm: 6 },
  { key: '201-500', label: '201–500 people', crm: 6 },
  { key: 'gt500', label: 'More than 500 people', crm: 6 },
] as const
export type SizeBand = (typeof SIZE_BANDS)[number]['key']

/** Years in business from the year of incorporation → `alletec_noofyearsinitbusiness` 0–7. */
export const yearsInBusinessBand = (yearOfIncorporation: number, now = new Date().getFullYear()): number => {
  const y = now - yearOfIncorporation
  if (y < 1) return 0
  if (y <= 5) return 1
  if (y <= 10) return 2
  if (y <= 15) return 3
  if (y <= 20) return 4
  if (y <= 25) return 5
  if (y <= 30) return 6
  return 7
}

/** `alletec_accounttype` by partner type (decision 6): VAR and Integration Partner are plain partner accounts, Distributor and MSP have their own. */
export const ACCOUNT_TYPE_BY_PARTNER_TYPE: Record<PartnerType, number> = { var: 0, integrationPartner: 0, distributor: 2, msp: 4 }
export const ACCOUNT_SUBTYPE_PARTNER = 3

/* ---------- The application ---------- */

export type Company = {
  legalName: string
  tradeName: string
  address: string
  city: string
  state: string
  country: string
  pin: string
  website: string
  yearOfIncorporation: number | null
  size: SizeBand | ''
  turnover: TurnoverBand | ''
  gstin: string
  pan: string
}

export type Contact = { name: string; designation: string; email: string; mobile: string; emailVerifiedAt: string | null; mobileVerifiedAt: string | null; mobileVerification: 'none' | 'sms' | 'skipped' }

export type DecisionRow = { to: ApplicationStatus; byName: string; byEmail: string; at: string; comment: string }

export type Application = {
  id: string
  number: string
  type: PartnerType
  status: ApplicationStatus
  company: Company
  contact: Contact
  regions: string[]
  terms: { version: string; acceptedAt: string | null }
  assignee: { email: string; name: string }
  decisions: DecisionRow[]
  resumeKey: string
  orgId: string
  submittedAt: string | null
  decidedAt: string | null
  createdAt: string
  updatedAt: string
}

export const EMPTY_COMPANY: Company = { legalName: '', tradeName: '', address: '', city: '', state: '', country: 'India', pin: '', website: '', yearOfIncorporation: null, size: '', turnover: '', gstin: '', pan: '' }
export const EMPTY_CONTACT: Contact = { name: '', designation: '', email: '', mobile: '', emailVerifiedAt: null, mobileVerifiedAt: null, mobileVerification: 'none' }

/** The latest note K7 sent back with a clarification request, for the applicant to read. */
export const clarificationNote = (a: Pick<Application, 'decisions'>): DecisionRow | null => [...a.decisions].reverse().find((d) => d.to === 'clarification') ?? null
export const rejectionNote = (a: Pick<Application, 'decisions'>): DecisionRow | null => [...a.decisions].reverse().find((d) => d.to === 'rejected') ?? null

/* ---------- Validation of the join steps ---------- */

export type FieldErrors = Record<string, string>

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/
export const isEmailAddress = (e: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)
export const normaliseMobile = (m: string): string => m.replace(/[\s().-]/g, '')
export const isMobile = (m: string): boolean => /^\+?[0-9]{10,15}$/.test(normaliseMobile(m))
export const normaliseWebsite = (w: string): string => {
  const t = w.trim()
  if (!t) return ''
  return /^https?:\/\//i.test(t) ? t : `https://${t}`
}

export const validateCompany = (c: Company, now = new Date().getFullYear()): FieldErrors => {
  const e: FieldErrors = {}
  if (c.legalName.trim().length < 2) e.legalName = 'Give the registered legal name.'
  if (c.address.trim().length < 4) e.address = 'Give the registered address.'
  if (!c.city.trim()) e.city = 'City is needed.'
  if (!c.state.trim()) e.state = 'State is needed.'
  if (!c.country.trim()) e.country = 'Country is needed.'
  if (!c.pin.trim()) e.pin = 'PIN or postal code is needed.'
  if (c.website && !/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(normaliseWebsite(c.website))) e.website = 'That does not look like a web address.'
  if (c.yearOfIncorporation === null || !Number.isInteger(c.yearOfIncorporation) || c.yearOfIncorporation < 1900 || c.yearOfIncorporation > now) e.yearOfIncorporation = `A year between 1900 and ${now}.`
  if (!SIZE_BANDS.some((b) => b.key === c.size)) e.size = 'Pick the company size.'
  if (!TURNOVER_BANDS.some((b) => b.key === c.turnover)) e.turnover = 'Pick the turnover band.'
  if (c.gstin && !GSTIN.test(c.gstin.trim().toUpperCase())) e.gstin = '15 characters, like 33ABCDE1234F1Z5.'
  if (c.pan && !PAN.test(c.pan.trim().toUpperCase())) e.pan = '10 characters, like ABCDE1234F.'
  return e
}

export const validateContact = (c: Pick<Contact, 'name' | 'designation' | 'email' | 'mobile'>): FieldErrors => {
  const e: FieldErrors = {}
  if (c.name.trim().length < 2) e.contactName = 'The primary contact’s name.'
  if (!c.designation.trim()) e.contactDesignation = 'Their designation.'
  if (!isEmailAddress(c.email.trim())) e.contactEmail = 'A valid work email; the code goes there.'
  if (!isMobile(c.mobile)) e.contactMobile = 'A mobile number with 10 to 15 digits.'
  return e
}

export const validateRegions = (regions: string[], allowed: { code: string }[]): FieldErrors => {
  if (!allowed.length) return {}
  const ok = regions.filter((r) => allowed.some((a) => a.code === r))
  return ok.length ? {} : { regions: 'Pick at least one region you operate in.' }
}

export const isPartnerType = (v: unknown): v is PartnerType => typeof v === 'string' && (PARTNER_TYPES as readonly string[]).includes(v)

/** Whether an application may be submitted: every step complete and the email verified (FR-REG-03). */
export const readyToSubmit = (a: Pick<Application, 'company' | 'contact' | 'regions'>, allowedRegions: { code: string }[]): FieldErrors => ({
  ...validateCompany(a.company),
  ...validateContact(a.contact),
  ...validateRegions(a.regions, allowedRegions),
  ...(a.contact.emailVerifiedAt ? {} : { emailVerified: 'The contact email has not been verified yet.' }),
})

/* ---------- The CRM mirror body (03-dynamics-exploration.md §6) ---------- */

export type AccountBody = Record<string, unknown>

/** The account row the outbox creates on approval. Lookups by name (region, state, city, country) are resolved by the runner;
    here they are returned as names for it. Nothing in it is the portal's partner ID, GSTIN, PAN or terms (no columns). */
export const accountBody = (o: { name: string; type: PartnerType; website: string; email: string; phone: string; address: string; city: string; state: string; country: string; pin: string; turnover: TurnoverBand | ''; size: SizeBand | ''; yearOfIncorporation: number | null; approvedAt: string }, now = new Date().getFullYear()): { body: AccountBody; lookups: { region?: string; state: string; city: string; country: string } } => {
  const body: AccountBody = {
    name: o.name.trim().slice(0, 160),
    alletec_accounttype: ACCOUNT_TYPE_BY_PARTNER_TYPE[o.type],
    alletec_accountsubtype: ACCOUNT_SUBTYPE_PARTNER,
    alletec_associatedwithk7on: o.approvedAt.slice(0, 10),
  }
  if (o.website) body.websiteurl = o.website.slice(0, 200)
  if (o.email) body.emailaddress1 = o.email.slice(0, 100)
  if (o.phone) body.telephone1 = o.phone.slice(0, 50)
  if (o.address) body.address1_line1 = o.address.slice(0, 250)
  if (o.city) body.address1_city = o.city.slice(0, 80)
  if (o.state) body.address1_stateorprovince = o.state.slice(0, 50)
  if (o.country) body.address1_country = o.country.slice(0, 80)
  if (o.pin) body.address1_postalcode = o.pin.slice(0, 20)
  const t = TURNOVER_BANDS.find((b) => b.key === o.turnover)
  if (t) body.alletec_approxlyturnover = t.crm
  const s = SIZE_BANDS.find((b) => b.key === o.size)
  if (s) body.alletec_salesforcecount = s.crm
  if (o.yearOfIncorporation) body.alletec_noofyearsinitbusiness = yearsInBusinessBand(o.yearOfIncorporation, now)
  return { body, lookups: { state: o.state, city: o.city, country: o.country } }
}

/** The primary contact row, parented to the account; the runner adds the binding. The partner relationship is the account's type and subtype, not a contact column. */
export const contactBody = (c: { name: string; designation: string; email: string; mobile: string }): AccountBody => {
  const parts = c.name.trim().split(/\s+/)
  const firstname = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0] ?? ''
  const lastname = parts.length > 1 ? parts[parts.length - 1]! : '.'
  // No customer type: the contact has only the stock `customertypecode` (one value, Default) on UAT; `new_customertype` is the incident's column and `k7_customertype` the RFE's.
  const body: AccountBody = { firstname: firstname.slice(0, 50), lastname: lastname.slice(0, 50) }
  if (c.designation) body.jobtitle = c.designation.slice(0, 100)
  if (c.email) body.emailaddress1 = c.email.slice(0, 100)
  if (c.mobile) body.mobilephone = normaliseMobile(c.mobile).slice(0, 50)
  return body
}

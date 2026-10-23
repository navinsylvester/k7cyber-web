import { isEmailAddress, isMobile, normaliseMobile, type FieldErrors } from './registration-model'
import type { PartnerType } from './settings-model'
import { DEAL_STATUSES, LIVE_DEAL_STATUSES, type DealStatus } from './status'

/* The deal registration as the code reads it (01-requirements.md §7, 02-build-plan.md M4), pure and tested without a tenant:
   the form's validation (FR-DEAL-02, FR-DEAL-03), the gate (decision 8), the protection maths (FR-DEAL-06, FR-DEAL-07, decision
   15), the conflict matcher over the portal's own deals (FR-DEAL-04) and the mapping of an approved deal onto a Dynamics
   opportunity with its end-customer account (03-dynamics-exploration.md §7). The storage and the writers are in deals.ts and
   the opportunity job in mirror.ts. */

/* ---------- The deal ---------- */

export const DEAL_SOURCES = [
  { key: 'prospecting', label: 'Own prospecting' },
  { key: 'enquiry', label: 'Customer enquiry' },
  { key: 'existing', label: 'Existing customer' },
  { key: 'k7Referral', label: 'K7 referral' },
  { key: 'event', label: 'Event or campaign' },
  { key: 'tender', label: 'Tender' },
  { key: 'other', label: 'Other' },
] as const
export type DealSource = (typeof DEAL_SOURCES)[number]['key']
export const dealSourceLabel = (k: string): string => DEAL_SOURCES.find((s) => s.key === k)?.label ?? (k || '—')

export type Product = { id: string; name: string; sku: string; family: string; active: boolean; crmProductId: string; description: string; order: number }

export type DealLine = { productId: string; name: string; sku: string; quantity: number }
export type DealCustomer = { name: string; industry: string; city: string; state: string; contactName: string; designation: string; email: string; phone: string }
export type Person = { userId: string; name: string; email: string }

export type ThreadKind = 'submitted' | 'decision' | 'note' | 'extension' | 'amendment' | 'system'
export type DealFile = { id: string; name: string; mime: string; size: number }
export type ThreadEntry = { kind: ThreadKind; side: 'partner' | 'k7' | 'system'; byName: string; byEmail: string; at: string; to: DealStatus | ''; title: string; text: string; files: DealFile[] }

export type Extension = { requestedAt: string | null; requestedBy: string; reason: string; decidedAt: string | null; decidedBy: string; granted: boolean; note: string }
export const EMPTY_EXTENSION: Extension = { requestedAt: null, requestedBy: '', reason: '', decidedAt: null, decidedBy: '', granted: false, note: '' }

/** A possible conflict with another portal deal: what matched, and whose it is (shown to the approver only, FR-DEAL-04). */
export type Conflict = { dealId: string; rowId: string; orgPartnerId: string; orgName: string; status: DealStatus; customerName: string; protectionEnds: string | null; matchedOn: ('name' | 'domain' | 'email')[] }

export type Deal = {
  id: string
  dealId: string
  status: DealStatus
  orgId: string
  orgPartnerId: string
  orgName: string
  orgType: PartnerType | ''
  registeredBy: Person
  reseller: { name: string; orgId: string; orgPartnerId: string }
  customer: DealCustomer
  customerKey: string
  emailDomain: string
  products: DealLine[]
  expectedValue: number
  closeDate: string
  source: DealSource | ''
  competitor: string
  notes: string
  thread: ThreadEntry[]
  submittedAt: string | null
  decidedAt: string | null
  protectionEnds: string | null
  endingNoticeAt: string | null
  extension: Extension
  conflicts: Conflict[]
  crm: { opportunityId: string; opportunityNo: string; customerAccountId: string; customerContactId: string; noteId: string }
  createdAt: string
  updatedAt: string
}

export const isDealStatus = (v: unknown): v is DealStatus => typeof v === 'string' && (DEAL_STATUSES as readonly string[]).includes(v)

/* ---------- The form (FR-DEAL-02, FR-DEAL-03) ---------- */

export type DealInput = {
  customer: DealCustomer
  lines: { productId: string; quantity: number }[]
  expectedValue: number | null
  closeDate: string
  source: string
  competitor: string
  notes: string
  resellerName: string
}

export const EMPTY_CUSTOMER: DealCustomer = { name: '', industry: '', city: '', state: '', contactName: '', designation: '', email: '', phone: '' }
export const EMPTY_DEAL_INPUT: DealInput = { customer: EMPTY_CUSTOMER, lines: [], expectedValue: null, closeDate: '', source: '', competitor: '', notes: '', resellerName: '' }

const isoDate = (v: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))

/** Everything FR-DEAL-02 asks for; a Distributor names the reseller (FR-DEAL-03). `today` is YYYY-MM-DD. */
export const validateDeal = (d: DealInput, products: Product[], orgType: PartnerType | '', today = new Date().toISOString().slice(0, 10)): FieldErrors => {
  const e: FieldErrors = {}
  const c = d.customer
  if (c.name.trim().length < 2) e.customerName = 'The end customer’s name.'
  if (!c.industry.trim()) e.industry = 'Their industry.'
  if (!c.city.trim()) e.city = 'Their city.'
  if (c.contactName.trim().length < 2) e.contactName = 'Who you are dealing with there.'
  if (!c.designation.trim()) e.designation = 'Their designation.'
  if (!isEmailAddress(c.email.trim())) e.email = 'A valid email for the contact; it is part of the conflict check.'
  if (!isMobile(c.phone)) e.phone = 'A phone number with 10 to 15 digits.'
  const lines = d.lines.filter((l) => l.productId)
  if (!lines.length) e.products = 'Pick at least one product and its quantity.'
  for (const l of lines) {
    const p = products.find((x) => x.id === l.productId)
    if (!p || !p.active) e.products = 'One of the products is not offered.'
    else if (!Number.isInteger(l.quantity) || l.quantity < 1) e.products = `Give the quantity for ${p.name}.`
  }
  if (new Set(lines.map((l) => l.productId)).size !== lines.length) e.products = 'A product is listed twice; put the whole quantity on one line.'
  if (d.expectedValue === null || !Number.isFinite(d.expectedValue) || d.expectedValue <= 0) e.expectedValue = 'The expected deal value in rupees.'
  else if (d.expectedValue > 1_000_000_000_000) e.expectedValue = 'That value is too large.'
  if (!isoDate(d.closeDate)) e.closeDate = 'The expected closure date.'
  else if (d.closeDate < today) e.closeDate = 'The closure date must be today or later.'
  if (!DEAL_SOURCES.some((s) => s.key === d.source)) e.source = 'Where the lead came from.'
  if (orgType === 'distributor' && d.resellerName.trim().length < 2) e.resellerName = 'A Distributor registers a deal for a reseller: name it.'
  return e
}

/** The form's product lines from indexed fields (product_0, qty_0 …): blank rows are dropped, a product without a quantity keeps 0 so validation names it. */
export const linesFrom = (get: (k: string) => string, rows = 8): { productId: string; quantity: number }[] => {
  const out: { productId: string; quantity: number }[] = []
  for (let i = 0; i < rows; i++) {
    const productId = get(`product_${i}`).trim()
    const qty = get(`qty_${i}`).trim()
    if (!productId && !qty) continue
    const quantity = /^\d+$/.test(qty) ? Number(qty) : 0
    out.push({ productId, quantity })
  }
  return out
}

/* ---------- The gate (FR-DEAL-01, decision 8) ---------- */

export type GateOrg = { status: 'approved' | 'suspended'; certificate: { status: string; until: string | null }; waiverUntil: string | null }
export type GateUser = { status: 'invited' | 'active' | 'disabled'; roles: string[] }

/** Why this person may not register a deal now, or null. The organisation must be approved and the user active with the admin or
    sales role (§2: Technical views deals); with the certificate gate on, the organisation holds a valid certificate or a waiver. */
export const registerBlocked = (org: GateOrg, user: GateUser, requireCertificate: boolean, today = new Date().toISOString().slice(0, 10)): string | null => {
  if (org.status !== 'approved') return 'The organisation is suspended.'
  if (user.status !== 'active') return 'Your user is not active.'
  if (!user.roles.includes('admin') && !user.roles.includes('sales')) return 'Deals are registered by Partner Admins and Sales users.'
  if (requireCertificate) {
    const certified = org.certificate.status === 'valid' && (!org.certificate.until || org.certificate.until.slice(0, 10) >= today)
    const waived = Boolean(org.waiverUntil && org.waiverUntil.slice(0, 10) >= today)
    if (!certified && !waived) return 'Deal registration needs a valid partner certificate. Ask your Channel Manager about a waiver until your organisation is certified.'
  }
  return null
}

/* ---------- Protection (FR-DEAL-06, FR-DEAL-07, decision 15) ---------- */

const DAY = 24 * 60 * 60 * 1000

/** The protection end from the approval, as an ISO instant at the end of that day (UTC). */
export const protectionEnd = (approvedAt: string, days: number): string => {
  const d = new Date(approvedAt)
  d.setUTCHours(23, 59, 59, 0)
  return new Date(d.getTime() + Math.max(1, Math.round(days)) * DAY).toISOString()
}

export const daysLeft = (ends: string | null, now = new Date()): number | null => (ends ? Math.ceil((new Date(ends).getTime() - now.getTime()) / DAY) : null)

/** How much of the window has run, 0–1, for the protection bar; null when not approved. */
export const protectionShare = (approvedAt: string | null, ends: string | null, now = new Date()): number | null => {
  if (!approvedAt || !ends) return null
  const a = new Date(approvedAt).getTime()
  const e = new Date(ends).getTime()
  if (e <= a) return 1
  return Math.min(1, Math.max(0, (now.getTime() - a) / (e - a)))
}

/** Whether the partner may ask for the extension now: approved, inside the window, none asked before (one per deal). */
export const canRequestExtension = (d: Pick<Deal, 'status' | 'protectionEnds' | 'extension'>, now = new Date()): boolean =>
  d.status === 'approved' && Boolean(d.protectionEnds) && new Date(d.protectionEnds!).getTime() > now.getTime() && !d.extension.requestedAt

export const isProtected = (d: Pick<Deal, 'status' | 'protectionEnds'>, now = new Date()): boolean => (d.status === 'approved' || d.status === 'extensionRequested') && Boolean(d.protectionEnds) && new Date(d.protectionEnds!).getTime() > now.getTime()

/** The partner may edit the registration only while K7 has asked for information (FR-DEAL-09). */
export const partnerMayEdit = (status: DealStatus): boolean => status === 'infoRequested'
/** Notes and attachments may be added while the deal is live (FR-DEAL-09: after approval too). */
export const mayAddNote = (status: DealStatus): boolean => (LIVE_DEAL_STATUSES as readonly string[]).includes(status)
/** The partner may withdraw anything that is not already closed. */
export const partnerMayWithdraw = (status: DealStatus): boolean => (LIVE_DEAL_STATUSES as readonly string[]).includes(status)
/** K7 may amend the value, the close date or the customer name while the deal is approved (FR-DEAL-09). */
export const k7MayAmend = (status: DealStatus): boolean => status === 'approved' || status === 'extensionRequested'

/* ---------- The conflict check (FR-DEAL-04) ---------- */

const LEGAL_SUFFIX = /\b(private|pvt|limited|ltd|llp|llc|inc|incorporated|corporation|corp|co|company|plc|gmbh|sa|ag|bv|the)\b/g

/** A customer name reduced to what identifies it: lower case, ASCII letters and digits, no legal suffixes, single spaces. */
export const customerKey = (name: string): string =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\x20-\x7e]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(LEGAL_SUFFIX, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const PUBLIC_DOMAINS = new Set(['gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'yahoo.in', 'hotmail.com', 'outlook.com', 'live.com', 'msn.com', 'rediffmail.com', 'rediff.com', 'icloud.com', 'me.com', 'aol.com', 'protonmail.com', 'proton.me', 'zoho.com', 'ymail.com', 'mail.com', 'gmx.com'])

/** The domain of a work email, or '' for a public mail service (a shared domain matches nothing). */
export const emailDomain = (email: string): string => {
  const d = email.trim().toLowerCase().split('@')[1] ?? ''
  return !d || PUBLIC_DOMAINS.has(d) ? '' : d
}

export type ConflictSubject = { id?: string; customerKey: string; emailDomain: string; customer: { email: string } }
export type ConflictCandidate = Pick<Deal, 'id' | 'dealId' | 'status' | 'orgPartnerId' | 'orgName' | 'customerKey' | 'emailDomain' | 'protectionEnds'> & { customer: { name: string; email: string } }

/** What a candidate shares with the subject: the normalised name, the work-email domain, the contact email. A closed deal or
    one whose protection has run out is no conflict; the subject itself never is. */
export const conflictWith = (subject: ConflictSubject, c: ConflictCandidate, now = new Date()): Conflict | null => {
  if (subject.id && c.id === subject.id) return null
  if (!(LIVE_DEAL_STATUSES as readonly string[]).includes(c.status)) return null
  if ((c.status === 'approved' || c.status === 'extensionRequested') && c.protectionEnds && new Date(c.protectionEnds).getTime() <= now.getTime()) return null
  const matchedOn: Conflict['matchedOn'] = []
  if (subject.customerKey && c.customerKey === subject.customerKey) matchedOn.push('name')
  if (subject.emailDomain && c.emailDomain === subject.emailDomain) matchedOn.push('domain')
  const e = subject.customer.email.trim().toLowerCase()
  if (e && c.customer.email.trim().toLowerCase() === e) matchedOn.push('email')
  if (!matchedOn.length) return null
  return { dealId: c.dealId, rowId: c.id, orgPartnerId: c.orgPartnerId, orgName: c.orgName, status: c.status, customerName: c.customer.name, protectionEnds: c.protectionEnds, matchedOn }
}

export const conflictsAmong = (subject: ConflictSubject, candidates: ConflictCandidate[], now = new Date()): Conflict[] => candidates.map((c) => conflictWith(subject, c, now)).filter((x): x is Conflict => x !== null)

export const CONFLICT_MATCH_LABEL: Record<Conflict['matchedOn'][number], string> = { name: 'same customer name', domain: 'same email domain', email: 'same contact email' }

/* ---------- The CRM mapping (03-dynamics-exploration.md §7) ---------- */

export const ACCOUNT_TYPE_CUSTOMER = 1
/** `alletec_saleschannel` by the partner's type: 2 Distributor, 4 MSP, else 0 B2B. */
export const SALES_CHANNEL_BY_PARTNER_TYPE: Record<PartnerType, number> = { distributor: 2, msp: 4, var: 0, integrationPartner: 0 }
/** `alletec_casetypelicensetype` ("Case Type/ License Type"): 0 Fresh, 1 Renewals, 2 Additional Purchase; a UAT plugin refuses an opportunity without it. Portal deals are new business. */
export const CASE_TYPE_FRESH = 0
export const SALES_VERTICAL_ENTERPRISE = 1 // `alletec_salesvertical`: 0 SOHO, 1 Enterprise (UAT metadata, 2026-10-23)

export type OpportunityBodies = { customerAccount: Record<string, unknown>; customerContact: Record<string, unknown>; opportunity: Record<string, unknown>; noteSubject: string; noteText: string; name: string }

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
export const formatInr = (v: number | null | undefined): string => (typeof v === 'number' && Number.isFinite(v) ? inr.format(v) : '—')

/** The CRM account's `alletec_verticalbusiness` picklist (05-metadata-full.md), label → value, shortest labels first so a
    partner's free-text industry lands on the plainest choice that mentions it. */
export const ACCOUNT_VERTICALS: readonly [number, string][] = [
  [696720093, "B2B"],
  [5, "FMCG"],
  [696720037, "Cloud"],
  [696720001, "Energy"],
  [696720006, "Others"],
  [1, "Banking"],
  [696720059, "Cements"],
  [696720068, "Defense"],
  [4, "Finance"],
  [696720060, "Leather"],
  [696720074, "Telecom"],
  [696720079, "Tourism"],
  [696720000, "Consumer"],
  [696720099, "Fin Tech"],
  [696720085, "Sea Port"],
  [696720101, "Security"],
  [696720067, "Textiles"],
  [696720064, "Aerospace"],
  [696720057, "Chemicals"],
  [696720070, "Insurance"],
  [12, "Logistics"],
  [696720003, "Marketing"],
  [696720058, "Oil & Gas"],
  [696720096, "State PSU"],
  [696720105, "Transport"],
  [696720055, "Automotive"],
  [696720004, "Healthcare"],
  [696720082, "Agriculture"],
  [696720097, "Central PSU"],
  [696720027, "Consultancy"],
  [3, "Electronics"],
  [696720002, "Engineering"],
  [8, "Hospitality"],
  [696720043, "ePublishing"],
  [2, "Construction"],
  [696720090, "Hydrocarbons"],
  [696720073, "BioTechnology"],
  [696720061, "Capital Goods"],
  [696720075, "Life Sciences"],
  [13, "Manufacturing"],
  [696720092, "Brick & Mortar"],
  [696720048, "Contact Center"],
  [696720062, "Gems & Jewelry"],
  [10, "ITES/Corporate"],
  [696720047, "Legal Services"],
  [696720008, "Non Profit Org"],
  [696720088, "Petrochemicals"],
  [696720083, "Food Processing"],
  [696720045, "Loan Processing"],
  [696720081, "Food & Beverages"],
  [696720031, "Software Quality"],
  [696720094, "State Government"],
  [696720100, "Health & Wellness"],
  [696720052, "Procurement & SCM"],
  [696720095, "Central Government"],
  [696720042, "System Integration"],
  [696720007, "Automotive Industry"],
  [696720065, "ICT, Semi-Conductor"],
  [696720091, "Online / e-Commerce"],
  [696720029, "Product Engineering"],
  [696720078, "Education & Training"],
  [696720049, "Research & Analytics"],
  [696720080, "Science & Technology"],
  [696720005, "Education/Institution"],
  [696720089, "Housing / Real Estate"],
  [696720071, "Media & Entertainment"],
  [696720051, "Medical Transcription"],
  [696720050, "Back-Office Processing"],
  [696720103, "Entertainment & Gaming"],
  [696720063, "Drugs & Pharmaceuticals"],
  [696720030, "Remote Infra management"],
  [696720098, "Web / Mobile Technology"],
  [696720086, "Airport / Civil Aviation"],
  [696720039, "Internet of Things (IOT)"],
  [696720056, "Metals, Steel, Aluminium"],
  [696720087, "Power Energy & Utilities"],
  [696720053, "Revenue Cycle Management"],
  [696720038, "Social Mobility Analytics"],
  [696720036, "Engineering Design and R&D"],
  [696720054, "Robotic Process Automation"],
  [696720044, "Technical Support Services"],
  [696720032, "Software product development"],
  [696720106, "Enterprise Infra, Applications"],
  [696720033, "Global in-house(Captive) Center"],
  [696720040, "Digital Transformation offerings"],
  [696720028, "Application Development & Maintenance"],
]

const plain = (v: string): string => v.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** The picklist value for a free-text industry: the label that equals it, else the first label that contains it or that it contains; null when nothing fits (the text still travels in the note). */
export const accountVertical = (industry: string): number | null => {
  const q = plain(industry)
  if (!q) return null
  const exact = ACCOUNT_VERTICALS.find(([, l]) => plain(l) === q)
  if (exact) return exact[0]
  const loose = ACCOUNT_VERTICALS.find(([, l]) => plain(l).includes(q) || q.includes(plain(l)))
  return loose ? loose[0] : null
}

/** The three rows the opportunity job creates and the note it attaches. Lookups (partner account, owner, state, region, product
    lines, competitor) are bound by the runner; here are the plain columns. No new CRM columns: the deal ID and the protection end
    travel in the description and the note. */
/** `alletec_competitoradded` on the opportunity is a Yes/No picklist, not a boolean (UAT metadata, 2026-10-23): 260760000 = Yes, 260760001 = No. */
export const COMPETITOR_ADDED_YES = 260760000

export const opportunityBodies = (d: Deal, o: { partnerName: string; namePattern: string; enquirySource: number; productCategory: number; partnerType: PartnerType | '' }): OpportunityBodies => {
  const c = d.customer
  const product = d.products[0]?.name ?? 'K7'
  const name = o.namePattern.replace('{customer}', c.name.trim()).replace('{product}', product).slice(0, 300)
  const licences = d.products.reduce((n, l) => n + l.quantity, 0)
  const customerAccount: Record<string, unknown> = { name: c.name.trim().slice(0, 160), alletec_accounttype: ACCOUNT_TYPE_CUSTOMER }
  if (c.city) customerAccount.address1_city = c.city.slice(0, 80)
  if (c.state) customerAccount.address1_stateorprovince = c.state.slice(0, 50)
  if (c.email) customerAccount.emailaddress1 = c.email.slice(0, 100)
  if (c.phone) customerAccount.telephone1 = normaliseMobile(c.phone).slice(0, 50)
  const vertical = accountVertical(c.industry)
  if (vertical !== null) customerAccount.alletec_verticalbusiness = vertical
  const parts = c.contactName.trim().split(/\s+/)
  const customerContact: Record<string, unknown> = { firstname: (parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0] ?? '').slice(0, 50), lastname: (parts.length > 1 ? parts[parts.length - 1]! : '.').slice(0, 50) }
  if (c.designation) customerContact.jobtitle = c.designation.slice(0, 100)
  if (c.email) customerContact.emailaddress1 = c.email.slice(0, 100)
  if (c.phone) customerContact.mobilephone = normaliseMobile(c.phone).slice(0, 50)
  const lines = d.products.map((l) => `${l.name} (${l.sku}) × ${l.quantity}`).join('; ')
  const description = [`Registered through the K7 Partner Portal · ${d.dealId} · protected until ${d.protectionEnds ? d.protectionEnds.slice(0, 10) : '—'}`, `Partner: ${o.partnerName} (${d.orgPartnerId})`, d.reseller.name ? `Reseller: ${d.reseller.name}${d.reseller.orgPartnerId ? ` (${d.reseller.orgPartnerId})` : ''}` : '', `Products: ${lines}`, d.competitor ? `Competitor: ${d.competitor}` : ''].filter(Boolean).join('\n')
  const opportunity: Record<string, unknown> = {
    name,
    description: description.slice(0, 2000),
    estimatedvalue: d.expectedValue,
    estimatedclosedate: d.closeDate.slice(0, 10),
    alletec_saleschannel: o.partnerType ? SALES_CHANNEL_BY_PARTNER_TYPE[o.partnerType] : 0,
    alletec_enquirysource: o.enquirySource,
    alletec_productcategory: o.productCategory,
    alletec_salesvertical: SALES_VERTICAL_ENTERPRISE,
    alletec_casetypelicensetype: CASE_TYPE_FRESH,
    alletec_nooflicenses: licences,
  }
  if (c.industry) opportunity.k7_industry = c.industry.slice(0, 100)
  if (d.competitor) opportunity.alletec_competitoradded = COMPETITOR_ADDED_YES
  const noteText = [`Deal registration ${d.dealId} from the K7 Partner Portal`, `Partner: ${o.partnerName} (${d.orgPartnerId}); registered by ${d.registeredBy.name} <${d.registeredBy.email}>`, d.reseller.name ? `Reseller: ${d.reseller.name}` : '', `End customer: ${c.name}, ${c.industry}, ${c.city}${c.state ? `, ${c.state}` : ''}`, `Contact: ${c.contactName}, ${c.designation}, ${c.email}, ${c.phone}`, `Products: ${lines}`, `Expected value: ${formatInr(d.expectedValue)}; expected close ${d.closeDate.slice(0, 10)}`, `Source: ${dealSourceLabel(d.source)}${d.competitor ? `; competitor: ${d.competitor}` : ''}`, `Protected until ${d.protectionEnds ? d.protectionEnds.slice(0, 10) : '—'}`, d.notes ? `\nPartner's notes:\n${d.notes}` : ''].filter(Boolean).join('\n')
  return { customerAccount, customerContact, opportunity, noteSubject: `Partner portal deal ${d.dealId}`, noteText: noteText.slice(0, 100000), name }
}

/* ---------- Reading rows ---------- */

type Raw = Record<string, unknown>
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v))
const d = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)
const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const relId = (v: unknown): string => s(typeof v === 'object' && v !== null ? (v as Raw).id : v)

export const toProduct = (x: Raw): Product => ({ id: s(x.id), name: s(x.name), sku: s(x.sku), family: s(x.family), active: x.active !== false, crmProductId: s(x.crmProductId), description: s(x.description), order: typeof x.order === 'number' ? x.order : 100 })

export const toDealFile = (x: Raw): DealFile => ({ id: s(x.id), name: s(x.filename), mime: s(x.mimeType), size: n(x.filesize) })

export const toConflict = (v: unknown): Conflict | null => {
  if (!v || typeof v !== 'object') return null
  const r = v as Raw
  if (!s(r.dealId)) return null
  return { dealId: s(r.dealId), rowId: s(r.rowId), orgPartnerId: s(r.orgPartnerId), orgName: s(r.orgName), status: isDealStatus(r.status) ? r.status : 'submitted', customerName: s(r.customerName), protectionEnds: d(r.protectionEnds), matchedOn: Array.isArray(r.matchedOn) ? (r.matchedOn.filter((m) => m === 'name' || m === 'domain' || m === 'email') as Conflict['matchedOn']) : [] }
}

export const toDeal = (x: Raw): Deal => {
  const c = (x.customer ?? {}) as Raw
  const rb = (x.registeredBy ?? {}) as Raw
  const rs = (x.reseller ?? {}) as Raw
  const ex = (x.extension ?? {}) as Raw
  const crm = (x.crm ?? {}) as Raw
  return {
    id: s(x.id),
    dealId: s(x.dealId),
    status: isDealStatus(x.status) ? x.status : 'submitted',
    orgId: relId(x.org),
    orgPartnerId: s(x.orgPartnerId),
    orgName: s(x.orgName),
    orgType: s(x.orgType) as PartnerType | '',
    registeredBy: { userId: s(rb.userId), name: s(rb.name), email: s(rb.email) },
    reseller: { name: s(rs.name), orgId: s(rs.orgId), orgPartnerId: s(rs.orgPartnerId) },
    customer: { name: s(x.customerName), industry: s(c.industry), city: s(c.city), state: s(c.state), contactName: s(c.contactName), designation: s(c.designation), email: s(c.email).toLowerCase(), phone: s(c.phone) },
    customerKey: s(x.customerKey),
    emailDomain: s(c.emailDomain),
    products: Array.isArray(x.products) ? (x.products as Raw[]).map((l) => ({ productId: relId(l.product), name: typeof l.product === 'object' && l.product !== null ? s((l.product as Raw).name) : s(l.name), sku: s(l.sku), quantity: n(l.quantity) })) : [],
    expectedValue: n(x.expectedValue),
    closeDate: s(x.closeDate),
    source: s(x.source) as DealSource | '',
    competitor: s(x.competitor),
    notes: s(x.notes),
    thread: Array.isArray(x.thread)
      ? (x.thread as Raw[]).map((t) => ({
          kind: (['submitted', 'decision', 'note', 'extension', 'amendment', 'system'] as ThreadKind[]).includes(t.kind as ThreadKind) ? (t.kind as ThreadKind) : 'note',
          side: t.side === 'k7' ? 'k7' : t.side === 'system' ? 'system' : 'partner',
          byName: s(t.byName),
          byEmail: s(t.byEmail),
          at: s(t.at),
          to: isDealStatus(t.to) ? t.to : '',
          title: s(t.title),
          text: s(t.text),
          files: Array.isArray(t.files) ? (t.files as unknown[]).filter((f) => f && typeof f === 'object').map((f) => toDealFile(f as Raw)) : [],
        }))
      : [],
    submittedAt: d(x.submittedAt),
    decidedAt: d(x.decidedAt),
    protectionEnds: d(x.protectionEnds),
    endingNoticeAt: d(x.endingNoticeAt),
    extension: { requestedAt: d(ex.requestedAt), requestedBy: s(ex.requestedBy), reason: s(ex.reason), decidedAt: d(ex.decidedAt), decidedBy: s(ex.decidedBy), granted: ex.granted === true, note: s(ex.note) },
    conflicts: Array.isArray(x.conflicts) ? x.conflicts.map(toConflict).filter((v): v is Conflict => v !== null) : [],
    crm: { opportunityId: s(crm.opportunityId), opportunityNo: s(crm.opportunityNo), customerAccountId: s(crm.customerAccountId), customerContactId: s(crm.customerContactId), noteId: s(crm.noteId) },
    createdAt: s(x.createdAt),
    updatedAt: s(x.updatedAt),
  }
}

/** The approval moment: the thread entry that moved the deal to approved, for the protection bar. */
export const approvedAt = (dl: Pick<Deal, 'thread' | 'decidedAt'>): string | null => dl.thread.find((t) => t.kind === 'decision' && t.to === 'approved')?.at ?? dl.decidedAt

/** The latest note K7 sent with a request for information, for the partner to read. */
export const infoRequestNote = (dl: Pick<Deal, 'thread'>): ThreadEntry | null => [...dl.thread].reverse().find((t) => t.kind === 'decision' && t.to === 'infoRequested') ?? null
export const rejectionEntry = (dl: Pick<Deal, 'thread'>): ThreadEntry | null => [...dl.thread].reverse().find((t) => t.kind === 'decision' && t.to === 'rejected') ?? null

import { dealOutcome, orderValue } from './dashboard-model'
import type { Deal } from './deals-model'
import { PARTNER_TYPES, type PartnerType } from './settings-model'

/* Schemes and eligibility as the code reads them (01-requirements.md §9, 02-build-plan.md M7, decision 16, appendix 15): a
   scheme is a window of dates with slabs (threshold value → benefit); a partner organisation registers for it, and after it
   closes its won deals inside the window are summed and set against the slabs. Everything here is pure (the phase from the
   dates, who a scheme applies to, which deals count, the maths, the registration and result machines, the dispute window, the
   Finance CSV) and tested without a tenant; `schemes.ts` reads and writes. The deals come from the dashboard's snapshot
   (`partner-deals.crm.snapshot`): a deal counts when the CRM says it is won and its actual close date is inside the scheme's
   dates (FR-ELG-01); its value is the order value the dashboard shows (`actualvalue`, else the invoice amount, else the
   estimate, FR-DASH-02). */

export const SCHEME_STATUSES = ['draft', 'published', 'archived'] as const
export type SchemeStatus = (typeof SCHEME_STATUSES)[number]
export const SCHEME_STATUS_LABEL: Record<SchemeStatus, string> = { draft: 'Draft', published: 'Published', archived: 'Archived' }

/** FR-SCH-02: a published scheme is open for registration until its deadline, running from its start to its end, closed after.
    `upcoming` is the gap between a deadline that has passed and a start still to come. */
export type SchemePhase = 'open' | 'upcoming' | 'running' | 'closed'
export const PHASE_LABEL: Record<SchemePhase, string> = { open: 'Open for registration', upcoming: 'Starts soon', running: 'Running', closed: 'Closed' }

export type Slab = { threshold: number; benefit: string; amount: number | null }

export type SchemeResults = { computedAt: string | null; computedBy: string; publishedAt: string | null; publishedBy: string }

export type Scheme = {
  id: string
  name: string
  description: string
  terms: string
  status: SchemeStatus
  startDate: string
  endDate: string
  registrationDeadline: string
  types: PartnerType[]
  regions: string[]
  productIds: string[]
  productNames: string[]
  approvalRequired: boolean
  /** Blank: the setting `schemes.disputeDays`. */
  disputeDays: number | null
  slabs: Slab[]
  attachment: SchemeFile | null
  results: SchemeResults
  createdAt: string
  updatedAt: string
}

export type SchemeFile = { id: string; name: string; mime: string; size: number }

export const REGISTRATION_STATUSES = ['pending', 'approved', 'declined'] as const
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number]
export const REGISTRATION_STATUS_LABEL: Record<RegistrationStatus, string> = { pending: 'Awaiting K7', approved: 'Registered', declined: 'Declined' }

export type Registration = {
  id: string
  schemeId: string
  orgId: string
  orgPartnerId: string
  orgName: string
  orgType: PartnerType | ''
  status: RegistrationStatus
  acceptedBy: { userId: string; name: string; email: string }
  acceptedAt: string | null
  decision: { by: string; at: string | null; note: string }
  createdAt: string
}

export type CountedDeal = { dealId: string; rowId: string; customer: string; closedOn: string; value: number; opportunityNo: string; products: string[] }

export type Adjustment = { amount: number; reason: string; by: string; at: string | null }
export const NO_ADJUSTMENT: Adjustment = { amount: 0, reason: '', by: '', at: null }

export type DisputeStatus = 'none' | 'open' | 'resolved'
export type Dispute = { status: DisputeStatus; text: string; raisedBy: string; raisedAt: string | null; resolution: string; resolvedBy: string; resolvedAt: string | null }
export const NO_DISPUTE: Dispute = { status: 'none', text: '', raisedBy: '', raisedAt: null, resolution: '', resolvedBy: '', resolvedAt: null }

export const PAYOUT_STATUSES = ['pending', 'processed', 'paid'] as const
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number]
export const PAYOUT_STATUS_LABEL: Record<PayoutStatus, string> = { pending: 'Pending', processed: 'Processed', paid: 'Paid' }
export type Payout = { status: PayoutStatus; reference: string; note: string; by: string; at: string | null }
export const NO_PAYOUT: Payout = { status: 'pending', reference: '', note: '', by: '', at: null }

/** One organisation's result on one scheme (FR-ELG-01 … 06). `achieved` is the computed sum, `final` the sum after the
    adjustment, the slab and the gap follow from `final`. */
export type EligibilityResult = {
  id: string
  schemeId: string
  orgId: string
  orgPartnerId: string
  orgName: string
  orgType: PartnerType | ''
  achieved: number
  dealsCounted: CountedDeal[]
  adjustment: Adjustment
  final: number
  eligible: boolean
  slabIndex: number
  target: number
  gap: number
  computedAt: string | null
  dispute: Dispute
  payout: Payout
  createdAt: string
  updatedAt: string
}

/** What the partner sees (FR-ELG-03): the result only once published, "Under review" before that and while a dispute is open. */
export type ResultStatus = 'review' | 'eligible' | 'notEligible'
export const RESULT_STATUS_LABEL: Record<ResultStatus, string> = { review: 'Under review', eligible: 'Eligible', notEligible: 'Not eligible' }

type Raw = Record<string, unknown>
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v))
const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0)
const nOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null)
const d = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)
const day = (v: unknown): string => s(v).slice(0, 10)
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => s(x).trim()).filter(Boolean) : [])
const relId = (v: unknown): string => s(typeof v === 'object' && v !== null ? (v as Raw).id : v)
const relName = (v: unknown, key = 'name'): string => (typeof v === 'object' && v !== null ? s((v as Raw)[key]) : '')

/** Slabs in ascending order of threshold, blanks dropped; the first is the target (decision 16, appendix 15). */
export const normaliseSlabs = (v: unknown): Slab[] =>
  (Array.isArray(v) ? v : [])
    .map((x) => (x && typeof x === 'object' ? (x as Raw) : {}))
    .map((x) => ({ threshold: n(x.threshold), benefit: s(x.benefit).trim(), amount: nOrNull(x.amount) }))
    .filter((x) => x.threshold > 0)
    .sort((a, b) => a.threshold - b.threshold)

export const toSchemeFile = (x: unknown): SchemeFile | null => {
  if (!x || typeof x !== 'object') return null
  const f = x as Raw
  const name = s(f.filename)
  return name ? { id: s(f.id), name, mime: s(f.mimeType), size: n(f.filesize) } : null
}

export const toScheme = (x: Raw): Scheme => {
  const products = Array.isArray(x.products) ? x.products : []
  const r = (x.results && typeof x.results === 'object' ? x.results : {}) as Raw
  return {
    id: s(x.id),
    name: s(x.name),
    description: s(x.description),
    terms: s(x.terms),
    status: (SCHEME_STATUSES as readonly string[]).includes(s(x.status)) ? (s(x.status) as SchemeStatus) : 'draft',
    startDate: day(x.startDate),
    endDate: day(x.endDate),
    registrationDeadline: day(x.registrationDeadline) || day(x.endDate),
    types: strs(x.types).filter((t): t is PartnerType => (PARTNER_TYPES as readonly string[]).includes(t)),
    regions: strs(x.regions),
    productIds: products.map(relId).filter(Boolean),
    productNames: products.map((p) => relName(p)).filter(Boolean),
    approvalRequired: x.approvalRequired === true,
    disputeDays: nOrNull(x.disputeDays),
    slabs: normaliseSlabs(x.slabs),
    attachment: toSchemeFile(x.attachment),
    results: { computedAt: d(r.computedAt), computedBy: s(r.computedBy), publishedAt: d(r.publishedAt), publishedBy: s(r.publishedBy) },
    createdAt: s(x.createdAt),
    updatedAt: s(x.updatedAt),
  }
}

export const toRegistration = (x: Raw): Registration => {
  const by = (x.acceptedBy && typeof x.acceptedBy === 'object' ? x.acceptedBy : {}) as Raw
  const dec = (x.decision && typeof x.decision === 'object' ? x.decision : {}) as Raw
  return {
    id: s(x.id),
    schemeId: relId(x.scheme),
    orgId: relId(x.org),
    orgPartnerId: s(x.orgPartnerId),
    orgName: s(x.orgName),
    orgType: (PARTNER_TYPES as readonly string[]).includes(s(x.orgType)) ? (s(x.orgType) as PartnerType) : '',
    status: (REGISTRATION_STATUSES as readonly string[]).includes(s(x.status)) ? (s(x.status) as RegistrationStatus) : 'pending',
    acceptedBy: { userId: s(by.userId), name: s(by.name), email: s(by.email) },
    acceptedAt: d(x.acceptedAt),
    decision: { by: s(dec.by), at: d(dec.at), note: s(dec.note) },
    createdAt: s(x.createdAt),
  }
}

const toCounted = (v: unknown): CountedDeal | null => {
  if (!v || typeof v !== 'object') return null
  const x = v as Raw
  return { dealId: s(x.dealId), rowId: s(x.rowId), customer: s(x.customer), closedOn: day(x.closedOn), value: n(x.value), opportunityNo: s(x.opportunityNo), products: strs(x.products) }
}

export const toResult = (x: Raw): EligibilityResult => {
  const adj = (x.adjustment && typeof x.adjustment === 'object' ? x.adjustment : {}) as Raw
  const disp = (x.dispute && typeof x.dispute === 'object' ? x.dispute : {}) as Raw
  const pay = (x.payout && typeof x.payout === 'object' ? x.payout : {}) as Raw
  return {
    id: s(x.id),
    schemeId: relId(x.scheme),
    orgId: relId(x.org),
    orgPartnerId: s(x.orgPartnerId),
    orgName: s(x.orgName),
    orgType: (PARTNER_TYPES as readonly string[]).includes(s(x.orgType)) ? (s(x.orgType) as PartnerType) : '',
    achieved: n(x.achieved),
    dealsCounted: (Array.isArray(x.dealsCounted) ? x.dealsCounted : []).map(toCounted).filter((c): c is CountedDeal => c !== null),
    adjustment: { amount: n(adj.amount), reason: s(adj.reason), by: s(adj.by), at: d(adj.at) },
    final: n(x.final),
    eligible: x.eligible === true,
    slabIndex: typeof x.slabIndex === 'number' ? x.slabIndex : -1,
    target: n(x.target),
    gap: n(x.gap),
    computedAt: d(x.computedAt),
    dispute: { status: disp.status === 'open' || disp.status === 'resolved' ? disp.status : 'none', text: s(disp.text), raisedBy: s(disp.raisedBy), raisedAt: d(disp.raisedAt), resolution: s(disp.resolution), resolvedBy: s(disp.resolvedBy), resolvedAt: d(disp.resolvedAt) },
    payout: { status: (PAYOUT_STATUSES as readonly string[]).includes(s(pay.status)) ? (s(pay.status) as PayoutStatus) : 'pending', reference: s(pay.reference), note: s(pay.note), by: s(pay.by), at: d(pay.at) },
    createdAt: s(x.createdAt),
    updatedAt: s(x.updatedAt),
  }
}

/* ---------- The phase (FR-SCH-02) ---------- */

export const today = (now = new Date()): string => now.toISOString().slice(0, 10)

/** Where a scheme stands on a day. Dates are inclusive: the deadline's day still registers, the end date's day still counts. */
export const schemePhase = (sc: Pick<Scheme, 'startDate' | 'endDate' | 'registrationDeadline'>, now = new Date()): SchemePhase => {
  const t = today(now)
  if (sc.endDate && t > sc.endDate) return 'closed'
  if (!sc.registrationDeadline || t <= sc.registrationDeadline) return 'open'
  if (sc.startDate && t < sc.startDate) return 'upcoming'
  return 'running'
}

export const isOpenForRegistration = (sc: Pick<Scheme, 'startDate' | 'endDate' | 'registrationDeadline'>, now = new Date()): boolean => schemePhase(sc, now) === 'open'
export const hasStarted = (sc: Pick<Scheme, 'startDate'>, now = new Date()): boolean => !sc.startDate || today(now) >= sc.startDate
export const isClosed = (sc: Pick<Scheme, 'startDate' | 'endDate' | 'registrationDeadline'>, now = new Date()): boolean => schemePhase(sc, now) === 'closed'

/** The listing's three groups (FR-SCH-02): Open for registration · Running (with the ones about to start) · Closed. */
export type SchemeGroup = 'open' | 'running' | 'closed'
export const GROUP_LABEL: Record<SchemeGroup, string> = { open: 'Open for registration', running: 'Running', closed: 'Closed' }
export const schemeGroup = (sc: Scheme, now = new Date()): SchemeGroup => {
  const p = schemePhase(sc, now)
  return p === 'open' ? 'open' : p === 'closed' ? 'closed' : 'running'
}

/* ---------- Who it applies to (FR-SCH-02: type and region) ---------- */

export type SchemeReader = { type: PartnerType; regions: string[] }
const norm = (v: string): string => v.trim().toLowerCase()

export const appliesTo = (sc: Pick<Scheme, 'types' | 'regions'>, org: SchemeReader): boolean => {
  if (sc.types.length && !sc.types.includes(org.type)) return false
  if (sc.regions.length) {
    const mine = new Set(org.regions.map(norm))
    if (!sc.regions.some((r) => mine.has(norm(r)))) return false
  }
  return true
}

/** The scheme as a partner may see it: published and applying to the organisation (FR-SCH-02). */
export const visibleScheme = (sc: Scheme, org: SchemeReader): boolean => sc.status === 'published' && appliesTo(sc, org)

export const applicabilityText = (sc: Pick<Scheme, 'types' | 'regions' | 'productNames'>, typeLabel: (t: PartnerType) => string, regionName: (code: string) => string): string => {
  const parts: string[] = []
  if (sc.types.length) parts.push(sc.types.map(typeLabel).join(', '))
  if (sc.regions.length) parts.push(sc.regions.map(regionName).join(', '))
  const who = parts.length ? parts.join(' · ') : 'Every partner'
  return sc.productNames.length ? `${who} · on ${sc.productNames.join(', ')}` : who
}

/* ---------- Which deals count (FR-ELG-01, decision 16) ---------- */

/** A deal counts when the CRM says it is won, its actual close date falls inside the scheme's dates, and (when the scheme names
    products) at least one of its lines is one of them. The value is the dashboard's order value. */
export const countedDeal = (sc: Pick<Scheme, 'startDate' | 'endDate' | 'productIds'>, dl: Deal): CountedDeal | null => {
  if (dealOutcome(dl) !== 'won') return null
  const closedOn = (dl.crm.snapshot.actualCloseDate ?? '').slice(0, 10)
  if (!closedOn) return null
  if (sc.startDate && closedOn < sc.startDate) return null
  if (sc.endDate && closedOn > sc.endDate) return null
  if (sc.productIds.length && !dl.products.some((l) => sc.productIds.includes(l.productId))) return null
  const value = orderValue(dl) ?? 0
  return { dealId: dl.dealId, rowId: dl.id, customer: dl.customer.name, closedOn, value, opportunityNo: dl.crm.opportunityNo, products: dl.products.map((l) => l.name) }
}

export const countDeals = (sc: Pick<Scheme, 'startDate' | 'endDate' | 'productIds'>, deals: Deal[]): CountedDeal[] =>
  deals
    .map((dl) => countedDeal(sc, dl))
    .filter((c): c is CountedDeal => c !== null)
    .sort((a, b) => (a.closedOn < b.closedOn ? -1 : a.closedOn > b.closedOn ? 1 : a.dealId.localeCompare(b.dealId)))

export const sumValue = (deals: CountedDeal[]): number => deals.reduce((t, c) => t + c.value, 0)

/* ---------- The maths against the slabs (FR-ELG-03, 04) ---------- */

export type Standing = { final: number; eligible: boolean; slabIndex: number; slab: Slab | null; target: number; gap: number; next: Slab | null; share: number }

/** Where a value stands against the slabs: the slab reached (the highest threshold at or under the value), the target (the
    first slab), the gap to the target when not eligible or to the next slab when eligible, and the share of the top slab
    for the progress line. No slabs: nothing is eligible and the target is 0. */
export const standing = (slabs: Slab[], value: number): Standing => {
  const sorted = [...slabs].sort((a, b) => a.threshold - b.threshold)
  const target = sorted[0]?.threshold ?? 0
  let slabIndex = -1
  for (let i = 0; i < sorted.length; i++) if (value >= sorted[i]!.threshold) slabIndex = i
  const eligible = slabIndex >= 0
  const next = sorted[slabIndex + 1] ?? null
  const gap = eligible ? (next ? Math.max(0, next.threshold - value) : 0) : Math.max(0, target - value)
  const top = sorted[sorted.length - 1]?.threshold ?? 0
  const share = top > 0 ? Math.max(0, Math.min(1, value / top)) : 0
  return { final: value, eligible, slabIndex, slab: eligible ? sorted[slabIndex]! : null, target, gap, next, share }
}

/** The result after an adjustment (FR-ELG-02): the final value never goes below zero. */
export const finalValue = (achieved: number, adjustment: number): number => Math.max(0, achieved + (Number.isFinite(adjustment) ? adjustment : 0))

/** What the partner is told (FR-ELG-03): the result only after publication, and "Under review" again while a dispute is open. */
export const resultStatus = (r: Pick<EligibilityResult, 'eligible' | 'dispute'>, published: boolean): ResultStatus => (!published || r.dispute.status === 'open' ? 'review' : r.eligible ? 'eligible' : 'notEligible')

/* ---------- Registration (FR-SCH-03, 04) ---------- */

export type RegisterOrg = { status: 'approved' | 'suspended'; type: PartnerType; regions: string[] }
export type RegisterUser = { status: 'invited' | 'active' | 'disabled'; roles: string[] }

/** Why an organisation cannot register now, or null. A Partner Admin of an approved organisation the scheme applies to, while
    registration is open, with the terms accepted, and not already registered. */
export const registerBlocked = (sc: Scheme, org: RegisterOrg, user: RegisterUser, existing: Registration | null, accepted: boolean, now = new Date()): string | null => {
  if (sc.status !== 'published') return 'This scheme is not open.'
  if (!appliesTo(sc, org)) return 'This scheme does not apply to your organisation.'
  if (org.status !== 'approved') return 'Your organisation is suspended; it cannot register for schemes.'
  if (user.status !== 'active') return 'Your account is not active.'
  if (!user.roles.includes('admin')) return 'Only a Partner Admin registers the organisation for a scheme.'
  if (existing && existing.status !== 'declined') return existing.status === 'pending' ? 'Your registration is with K7.' : 'Your organisation is already registered.'
  if (existing && existing.status === 'declined') return 'K7 declined your registration for this scheme.'
  if (!isOpenForRegistration(sc, now)) return schemePhase(sc, now) === 'closed' ? 'This scheme has closed.' : `Registration closed on ${sc.registrationDeadline}.`
  if (!accepted) return 'Accept the scheme terms to register.'
  return null
}

/** The registration's first state: approved at once, or pending when the scheme wants K7's approval (FR-SCH-04). */
export const initialRegistrationStatus = (sc: Pick<Scheme, 'approvalRequired'>): RegistrationStatus => (sc.approvalRequired ? 'pending' : 'approved')

export const canDecideRegistration = (r: Pick<Registration, 'status'>): boolean => r.status === 'pending'

/* ---------- The run, the review, the dispute (FR-ELG-01, 02, 05) ---------- */

export const canCompute = (sc: Scheme, now = new Date()): string | null => {
  if (sc.status !== 'published') return 'Only a published scheme has results.'
  if (!isClosed(sc, now)) return `The scheme runs until ${sc.endDate}; results are computed after it closes.`
  if (sc.results.publishedAt) return 'The results are published; they are not recomputed. Adjust a result with a reason instead.'
  if (!sc.slabs.length) return 'The scheme has no slabs; add at least one threshold in the admin first.'
  return null
}

export const canPublish = (sc: Scheme): string | null => {
  if (!sc.results.computedAt) return 'Compute the results first.'
  if (sc.results.publishedAt) return 'Already published.'
  return null
}

/** The dispute window (FR-ELG-05): the scheme's own days, else the setting, from the publication. */
export const disputeUntil = (sc: Pick<Scheme, 'disputeDays' | 'results'>, settingDays: number): string | null => {
  if (!sc.results.publishedAt) return null
  const days = sc.disputeDays ?? settingDays
  const t = new Date(sc.results.publishedAt)
  t.setUTCDate(t.getUTCDate() + days)
  return t.toISOString()
}

export const canDispute = (sc: Pick<Scheme, 'disputeDays' | 'results'>, r: Pick<EligibilityResult, 'dispute'>, settingDays: number, now = new Date()): string | null => {
  if (!sc.results.publishedAt) return 'The results are not published yet.'
  if (r.dispute.status === 'open') return 'A dispute is already open.'
  if (r.dispute.status === 'resolved') return 'The dispute on this result was resolved.'
  const until = disputeUntil(sc, settingDays)
  if (until && now.toISOString() > until) return `The window to dispute closed on ${until.slice(0, 10)}.`
  return null
}

/* ---------- Progress (FR-SCH-05) ---------- */

export type Progress = { provisional: boolean; achieved: number; deals: CountedDeal[]; standing: Standing }

/** The organisation's standing on a scheme today, from the deals' snapshots: provisional until the scheme closes. */
export const progressFor = (sc: Scheme, deals: Deal[], now = new Date()): Progress => {
  const counted = countDeals(sc, deals)
  const achieved = sumValue(counted)
  return { provisional: !isClosed(sc, now), achieved, deals: counted, standing: standing(sc.slabs, achieved) }
}

/* ---------- The Finance export (FR-ELG-07) ---------- */

export type FinanceRow = {
  scheme: Scheme
  result: EligibilityResult
  org: { partnerId: string; name: string; type: string; gstin: string; pan: string; country: string; state: string; city: string; email: string }
}

const csvCell = (v: unknown): string => {
  const t = v === null || v === undefined ? '' : String(v)
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

export const FINANCE_COLUMNS = ['Scheme', 'Scheme start', 'Scheme end', 'Results published', 'Partner ID', 'Partner', 'Partner type', 'GSTIN', 'PAN', 'Country', 'State', 'City', 'Admin email', 'Deals counted', 'Achieved value', 'Adjustment', 'Adjustment reason', 'Final value', 'Target', 'Eligible', 'Slab reached', 'Benefit', 'Benefit amount', 'Gap', 'Dispute', 'Payout status', 'Payout reference', 'Payout updated'] as const

export const financeCsv = (rows: FinanceRow[]): string => {
  const lines = [FINANCE_COLUMNS.join(',')]
  for (const { scheme, result: r, org } of rows) {
    const slab = r.slabIndex >= 0 ? scheme.slabs[r.slabIndex] : null
    lines.push(
      [
        scheme.name,
        scheme.startDate,
        scheme.endDate,
        scheme.results.publishedAt?.slice(0, 10) ?? '',
        org.partnerId,
        org.name,
        org.type,
        org.gstin,
        org.pan,
        org.country,
        org.state,
        org.city,
        org.email,
        r.dealsCounted.length,
        r.achieved,
        r.adjustment.amount,
        r.adjustment.reason,
        r.final,
        r.target,
        r.eligible ? 'Yes' : 'No',
        slab ? `${r.slabIndex + 1} (${slab.threshold})` : '',
        slab?.benefit ?? '',
        slab?.amount ?? '',
        r.gap,
        r.dispute.status === 'none' ? '' : r.dispute.status,
        r.eligible ? PAYOUT_STATUS_LABEL[r.payout.status] : '',
        r.eligible ? r.payout.reference : '',
        r.eligible && r.payout.at ? r.payout.at.slice(0, 10) : '',
      ]
        .map(csvCell)
        .join(','),
    )
  }
  return `${lines.join('\r\n')}\r\n`
}

/* ---------- Listing helpers ---------- */

/** A partner's view of a scheme row: its registration and, once published, its result status. */
export type SchemeRow = { scheme: Scheme; phase: SchemePhase; group: SchemeGroup; registration: Registration | null; result: EligibilityResult | null }

export const groupSchemes = (rows: SchemeRow[]): { group: SchemeGroup; rows: SchemeRow[] }[] => {
  const order: SchemeGroup[] = ['open', 'running', 'closed']
  return order.map((group) => ({ group, rows: rows.filter((r) => r.group === group).sort((a, b) => (group === 'closed' ? (a.scheme.endDate < b.scheme.endDate ? 1 : -1) : a.scheme.endDate < b.scheme.endDate ? -1 : 1)) })).filter((g) => g.rows.length)
}

export const searchSchemes = (rows: Scheme[], q: string): Scheme[] => {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return rows
  return rows.filter((sc) => {
    const hay = [sc.name, sc.description, ...sc.productNames, ...sc.regions].join(' ').toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}

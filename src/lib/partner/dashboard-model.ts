import { FV, raw, type Row } from '@/lib/dataverse/types'

import { EMPTY_SNAPSHOT, type Deal, type Snapshot } from './deals-model'

/* The deal dashboard as the code reads it (01-requirements.md §8, 02-build-plan.md M5), pure and tested without a tenant: the
   mapping of a Dynamics opportunity row onto the deal's snapshot (03-dynamics-exploration.md §8), the deal's outcome as the
   partner reads it (open · on hold · won · lost, FR-DASH-02), the reconciliation diff that goes to the audit when the CRM and
   the portal disagree (FR-DASH-11), the period, the summary cards (FR-DASH-01) and the three charts (FR-DASH-08). The read-back
   itself and the storage are in sync.ts; the page in app/(partner)/partners/portal/dashboard. */

/* ---------- The CRM's values (03-dynamics-exploration.md §2) ---------- */

export const STATE_LABEL: Record<number, string> = { 0: 'Open', 1: 'Won', 2: 'Lost' }

/** `alletec_stage`: the sales process mirrored in a pick-list. The formatted value from the CRM is preferred; this is the fallback and the order. */
export const STAGE_LABEL: Record<number, string> = { 260760000: 'Pre Sales', 260760001: 'Proposal', 260760002: 'Negotiation', 260760003: 'Order', 260760004: 'Invoice', 260760005: 'Closure' }
export const STAGE_ORDER: readonly number[] = [260760000, 260760001, 260760002, 260760003, 260760004, 260760005]

/** `statuscode`: open 1 In Progress, 2 On Hold; won 3; the lost reasons. The CRM's formatted value is preferred; this is the fallback. */
export const STATUS_LABEL: Record<number, string> = { 1: 'In Progress', 2: 'On Hold', 3: 'Won', 4: 'Others', 5: 'Budget', 260760001: 'Additional Feature Requirement', 260760002: 'K7 Brand Awareness', 260760003: 'Price', 696720000: 'Merged', 696720001: 'Issued Fresh Key', 696720002: 'Duplicate', 696720003: 'K7 Brand Confidence' }
export const STATUS_ON_HOLD = 2

/** The formatted value the CRM sent with a column, or blank: never the raw value. */
const label = (row: Row, field: string): string => (typeof row[`${field}${FV}`] === 'string' ? (row[`${field}${FV}`] as string) : '')

const dateOnly = (v: unknown): string | null => (typeof v === 'string' && v ? v.slice(0, 10) : null)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null)

/** One opportunity row from the sync's `$select` → the snapshot stored on the deal. Labels come from the CRM's formatted values, the
    tables above standing in when a row has none (a mock, an unlabelled value). */
export const snapshotFromRow = (row: Row, syncedAt: string): Snapshot => {
  const statecode = num(raw(row, 'statecode'))
  const statuscode = num(raw(row, 'statuscode'))
  const stage = num(raw(row, 'alletec_stage'))
  return {
    syncedAt,
    modifiedOn: typeof row.modifiedon === 'string' ? row.modifiedon : null,
    name: typeof row.name === 'string' ? row.name : '',
    statecode,
    statuscode,
    statusLabel: label(row, 'statuscode') || (statuscode !== null ? STATUS_LABEL[statuscode] ?? '' : statecode !== null ? STATE_LABEL[statecode] ?? '' : ''),
    stage,
    stageLabel: label(row, 'alletec_stage') || (stage !== null ? STAGE_LABEL[stage] ?? '' : ''),
    stepName: typeof row.stepname === 'string' ? row.stepname : '',
    estimatedValue: num(raw(row, 'estimatedvalue')),
    actualValue: num(raw(row, 'actualvalue')),
    invoiceAmount: num(raw(row, 'alletec_nvoiceamount')),
    estimatedCloseDate: dateOnly(row.estimatedclosedate),
    actualCloseDate: dateOnly(row.actualclosedate),
    error: '',
  }
}

/** The snapshot for an opportunity the CRM no longer returns: the last values stay, the error says so. */
export const missingSnapshot = (prev: Snapshot, syncedAt: string): Snapshot => ({ ...prev, syncedAt, error: 'Not found in the CRM' })

/** The fields in the sync's `$select` (03-dynamics-exploration.md §8). */
export const SYNC_SELECT = ['opportunityid', 'alletec_opportunityno', 'name', 'statecode', 'statuscode', 'alletec_stage', 'stepname', 'estimatedvalue', 'actualvalue', 'alletec_nvoiceamount', 'estimatedclosedate', 'actualclosedate', 'modifiedon'] as const

/* ---------- Reconciliation (FR-DASH-11) ---------- */

export type SnapshotChange = { field: 'state' | 'status' | 'stage' | 'estimatedValue' | 'actualValue' | 'estimatedCloseDate' | 'actualCloseDate' | 'error'; from: string; to: string }

const same = (a: unknown, b: unknown): boolean => (a === null || a === undefined || a === '' ? b === null || b === undefined || b === '' : a === b)
const show = (v: unknown): string => (v === null || v === undefined || v === '' ? '—' : String(v))

/** What changed between two read-backs, in the words the audit row carries. The first read-back is one change from nothing. */
export const snapshotChanges = (prev: Snapshot, next: Snapshot): SnapshotChange[] => {
  const out: SnapshotChange[] = []
  const stateOf = (sn: Snapshot) => (sn.statecode === null ? '' : STATE_LABEL[sn.statecode] ?? String(sn.statecode))
  if (!same(stateOf(prev), stateOf(next))) out.push({ field: 'state', from: show(stateOf(prev)), to: show(stateOf(next)) })
  if (!same(prev.statuscode, next.statuscode)) out.push({ field: 'status', from: show(prev.statusLabel || prev.statuscode), to: show(next.statusLabel || next.statuscode) })
  if (!same(prev.stage, next.stage)) out.push({ field: 'stage', from: show(prev.stageLabel || prev.stage), to: show(next.stageLabel || next.stage) })
  if (!same(prev.estimatedValue, next.estimatedValue)) out.push({ field: 'estimatedValue', from: show(prev.estimatedValue), to: show(next.estimatedValue) })
  if (!same(prev.actualValue, next.actualValue)) out.push({ field: 'actualValue', from: show(prev.actualValue), to: show(next.actualValue) })
  if (!same(prev.estimatedCloseDate, next.estimatedCloseDate)) out.push({ field: 'estimatedCloseDate', from: show(prev.estimatedCloseDate), to: show(next.estimatedCloseDate) })
  if (!same(prev.actualCloseDate, next.actualCloseDate)) out.push({ field: 'actualCloseDate', from: show(prev.actualCloseDate), to: show(next.actualCloseDate) })
  if (!same(prev.error, next.error)) out.push({ field: 'error', from: show(prev.error), to: show(next.error) })
  return out
}

export const CHANGE_LABEL: Record<SnapshotChange['field'], string> = { state: 'state', status: 'status reason', stage: 'stage', estimatedValue: 'estimated value', actualValue: 'actual value', estimatedCloseDate: 'expected closure', actualCloseDate: 'actual closure', error: 'read-back' }

/** Where the CRM and the portal's own record disagree on what FR-DASH-11 names: stage (the portal has none before the CRM) and
    value (the partner's expected value against the CRM's estimate; the actual against it once won). The CRM wins; this is what the
    audit row says. */
export const portalDisagreements = (deal: Pick<Deal, 'expectedValue' | 'closeDate'>, sn: Snapshot): string[] => {
  const out: string[] = []
  if (sn.estimatedValue !== null && sn.estimatedValue !== deal.expectedValue) out.push(`value: portal ${formatInrPlain(deal.expectedValue)}, CRM ${formatInrPlain(sn.estimatedValue)}`)
  if (sn.estimatedCloseDate && deal.closeDate && sn.estimatedCloseDate !== deal.closeDate.slice(0, 10)) out.push(`closure: portal ${deal.closeDate.slice(0, 10)}, CRM ${sn.estimatedCloseDate}`)
  return out
}

/** Whether a run is due: never run, or the last one older than the configured minutes (FR-DASH-05 "configurable"). */
export const syncDue = (lastRunAt: string | null, minutes: number, now = new Date()): boolean => !lastRunAt || now.getTime() - new Date(lastRunAt).getTime() >= Math.max(1, minutes) * 60_000

/* ---------- The outcome (FR-DASH-02) ---------- */

export type Outcome = 'awaiting' | 'notInCrm' | 'open' | 'onHold' | 'won' | 'lost' | 'closed'
export const OUTCOME_LABEL: Record<Outcome, string> = { awaiting: 'Awaiting approval', notInCrm: 'Not yet in CRM', open: 'Open', onHold: 'On hold', won: 'Won', lost: 'Lost', closed: 'Closed' }

/** The deal as the dashboard states it: the CRM's state once there is a snapshot (CRM wins), the portal's own state before that. */
export const dealOutcome = (d: Pick<Deal, 'status' | 'crm'>): Outcome => {
  const sn = d.crm.snapshot
  if (sn.statecode === 1) return 'won'
  if (sn.statecode === 2) return 'lost'
  if (sn.statecode === 0) return sn.statuscode === STATUS_ON_HOLD ? 'onHold' : 'open'
  if (d.status === 'submitted' || d.status === 'infoRequested') return 'awaiting'
  if (d.status === 'approved' || d.status === 'extensionRequested') return 'notInCrm'
  return 'closed'
}

export const isOpenOutcome = (o: Outcome): boolean => o === 'awaiting' || o === 'notInCrm' || o === 'open' || o === 'onHold'

/** The value the dashboard counts for a deal: the CRM's estimate when it has one, else the partner's expected value. */
export const pipelineValue = (d: Pick<Deal, 'expectedValue' | 'crm'>): number => d.crm.snapshot.estimatedValue ?? d.expectedValue

/** The actual order value of a won deal (FR-DASH-02): `actualvalue`, else the invoice amount, else the estimate. Null unless won. */
export const orderValue = (d: Pick<Deal, 'status' | 'expectedValue' | 'crm'>): number | null => {
  if (dealOutcome(d) !== 'won') return null
  const sn = d.crm.snapshot
  return sn.actualValue ?? sn.invoiceAmount ?? sn.estimatedValue ?? d.expectedValue
}

/** The stage as the ledger shows it: the CRM's stage label, else what the portal knows. */
export const stageText = (d: Pick<Deal, 'status' | 'crm'>): string => {
  const sn = d.crm.snapshot
  if (sn.stageLabel) return sn.stageLabel
  if (sn.stage !== null) return STAGE_LABEL[sn.stage] ?? String(sn.stage)
  const o = dealOutcome(d)
  return o === 'awaiting' ? 'With K7' : o === 'notInCrm' ? 'Approved' : '—'
}

/* ---------- The period (FR-DASH-01 "for the selected period") ---------- */

export const PERIODS = [
  { key: 'month', label: 'This month' },
  { key: 'quarter', label: 'This quarter' },
  { key: 'fy', label: 'This financial year' },
  { key: '12m', label: 'Last 12 months' },
  { key: 'all', label: 'All time' },
] as const
export type PeriodKey = (typeof PERIODS)[number]['key']
export const isPeriodKey = (v: unknown): v is PeriodKey => PERIODS.some((p) => p.key === v)
export const periodLabel = (k: PeriodKey): string => PERIODS.find((p) => p.key === k)?.label ?? k

export type Period = { key: PeriodKey; from: string | null; to: string | null }

const ymd = (d: Date): string => d.toISOString().slice(0, 10)
const utc = (y: number, m: number, d: number): Date => new Date(Date.UTC(y, m, d))

/** The period's bounds as dates (inclusive, on the registration date). The financial year runs April to March; a quarter is a
    quarter of it. Computed in UTC on the calendar day. */
export const periodBounds = (key: PeriodKey, now = new Date()): Period => {
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  if (key === 'all') return { key, from: null, to: null }
  if (key === 'month') return { key, from: ymd(utc(y, m, 1)), to: ymd(utc(y, m + 1, 0)) }
  if (key === '12m') return { key, from: ymd(utc(y, m - 11, 1)), to: ymd(utc(y, m + 1, 0)) }
  const fyStart = m >= 3 ? y : y - 1
  if (key === 'fy') return { key, from: ymd(utc(fyStart, 3, 1)), to: ymd(utc(fyStart + 1, 2, 31)) }
  const qIndex = Math.floor(((m - 3 + 12) % 12) / 3)
  const qStartMonth = 3 + qIndex * 3
  return { key, from: ymd(utc(fyStart, qStartMonth, 1)), to: ymd(utc(fyStart, qStartMonth + 3, 0)) }
}

/** The registration date against the period, for a list already in hand. */
export const inPeriod = (d: Pick<Deal, 'submittedAt'>, p: Period): boolean => {
  const day = d.submittedAt?.slice(0, 10) ?? ''
  if (!day) return p.from === null
  if (p.from && day < p.from) return false
  if (p.to && day > p.to) return false
  return true
}

/* ---------- The cards (FR-DASH-01) ---------- */

export type Summary = { total: number; open: number; won: number; lost: number; pipelineValue: number; wonValue: number; winRate: number | null }

export const summarise = (deals: Deal[]): Summary => {
  const out: Summary = { total: deals.length, open: 0, won: 0, lost: 0, pipelineValue: 0, wonValue: 0, winRate: null }
  for (const d of deals) {
    const o = dealOutcome(d)
    if (o === 'won') {
      out.won += 1
      out.wonValue += orderValue(d) ?? 0
    } else if (o === 'lost') out.lost += 1
    else if (isOpenOutcome(o)) {
      out.open += 1
      out.pipelineValue += pipelineValue(d)
    }
  }
  out.winRate = out.won + out.lost > 0 ? Math.round((out.won / (out.won + out.lost)) * 100) : null
  return out
}

/* ---------- The charts (FR-DASH-08) ---------- */

export type Series = { label: string; value: number; critical?: boolean }

/** Open deals by the CRM's stage, in the sales process's order, with the portal's two pre-CRM states first and on hold last. */
export const pipelineByStage = (deals: Deal[]): Series[] => {
  const buckets = new Map<string, number>()
  const order: string[] = ['Awaiting approval', 'Not yet in CRM', ...STAGE_ORDER.map((k) => STAGE_LABEL[k]!), 'On hold']
  for (const d of deals) {
    const o = dealOutcome(d)
    if (!isOpenOutcome(o)) continue
    const key = o === 'awaiting' ? 'Awaiting approval' : o === 'notInCrm' ? 'Not yet in CRM' : o === 'onHold' ? 'On hold' : d.crm.snapshot.stageLabel || (d.crm.snapshot.stage !== null ? STAGE_LABEL[d.crm.snapshot.stage] ?? 'Other' : 'Other')
    if (!order.includes(key)) order.splice(order.length - 1, 0, key)
    buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }
  return order.filter((k) => buckets.has(k)).map((label) => ({ label, value: buckets.get(label)! }))
}

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthKey = (day: string): string => day.slice(0, 7)
const monthLabel = (key: string): string => {
  const [y, m] = key.split('-')
  return `${MONTH[Number(m) - 1] ?? m} ${String(y).slice(2)}`
}

/** The value registered per month across the period (every month shown, empty ones at zero), at most the last `max` months. */
export const valueByMonth = (deals: Deal[], p: Period, now = new Date(), max = 12): Series[] => {
  const sums = new Map<string, number>()
  for (const d of deals) {
    const day = d.submittedAt?.slice(0, 10)
    if (!day) continue
    sums.set(monthKey(day), (sums.get(monthKey(day)) ?? 0) + pipelineValue(d))
  }
  const keys = [...sums.keys()].sort()
  const first = p.from ? monthKey(p.from) : keys[0]
  const last = p.to ? monthKey(p.to) : monthKey(ymd(now))
  if (!first) return []
  const months: string[] = []
  const cur = new Date(`${first}-01T00:00:00Z`)
  const end = new Date(`${(last && last >= first ? last : first)}-01T00:00:00Z`)
  while (cur.getTime() <= end.getTime() && months.length < 240) {
    months.push(cur.toISOString().slice(0, 7))
    cur.setUTCMonth(cur.getUTCMonth() + 1)
  }
  return months.slice(-max).map((k) => ({ label: monthLabel(k), value: Math.round(sums.get(k) ?? 0) }))
}

/** The value by product: a deal's value split evenly over its product lines; sorted by size, the smallest beyond twelve as Other. */
export const valueByProduct = (deals: Deal[]): Series[] => {
  const sums = new Map<string, number>()
  for (const d of deals) {
    const v = pipelineValue(d)
    if (d.products.length === 0) {
      sums.set('No product', (sums.get('No product') ?? 0) + v)
      continue
    }
    const share = v / d.products.length
    for (const l of d.products) sums.set(l.name || l.sku || 'Product', (sums.get(l.name || l.sku || 'Product') ?? 0) + share)
  }
  const all = [...sums.entries()].map(([label, value]) => ({ label, value: Math.round(value) })).sort((a, b) => b.value - a.value)
  if (all.length <= 12) return all
  const head = all.slice(0, 11)
  const rest = all.slice(11).reduce((n, s) => n + s.value, 0)
  return [...head, { label: 'Other', value: rest }]
}

/* ---------- Money ---------- */

const inrPlain = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
export const formatInrPlain = (v: number | null | undefined): string => (typeof v === 'number' && Number.isFinite(v) ? inrPlain.format(v) : '—')

/** ₹ in the Indian short forms for a figure that must fit a card or a column: 12,500 · 1.25 L · 2.4 Cr. */
export const shortInr = (v: number | null | undefined): string => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—'
  const a = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (a >= 1e7) return `${sign}₹${trim(a / 1e7)} Cr`
  if (a >= 1e5) return `${sign}₹${trim(a / 1e5)} L`
  return `${sign}₹${Math.round(a).toLocaleString('en-IN')}`
}
const trim = (n: number): string => (n >= 100 ? String(Math.round(n)) : n >= 10 ? n.toFixed(1).replace(/\.0$/, '') : n.toFixed(2).replace(/\.?0+$/, ''))

export { EMPTY_SNAPSHOT }

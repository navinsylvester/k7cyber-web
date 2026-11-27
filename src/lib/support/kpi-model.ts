import { DEFAULT_CSAT, normaliseCsat, type CsatSettings } from './csat-model'
import { DEFAULT_NOTIFY, normaliseNotify, type NotifySettings } from './notify-model'
import { DEFAULT_HOURS, DEFAULT_SHIFT, type BusinessHours, type Shift } from './sla'

/* The support KPI model (09-portal-guide.md §4c): the SLA targets of the five clocks, the shifts they count, the KPI cards,
   the notifications (notify-model.ts) and who counts as a manager. Pure types, defaults and resolution rules; kpi-config.ts
   loads and saves them through Payload. */

export type Any = 'any'
/** One row of the target matrix: working minutes for each SLA clock (notify-model.ts CLOCKS). */
export type TargetRule = {
  vertical: number | Any
  priority: number | Any
  origin: number | Any
  responseMinutes: number
  resolveMinutes: number
  followUpMinutes: number
  pickupMinutes: number
  labMinutes: number
}
/** The clocks added on 2026-11-27 start from what the desk asked for: a customer's follow-up answered in 30 minutes, a case
    picked from the bin in 5, a Lab sample closed in 3 hours. */
export const NEW_CLOCK_DEFAULTS = { followUpMinutes: 30, pickupMinutes: 5, labMinutes: 180 } as const

export type KpiKey = 'resolution-sla' | 'response-sla' | 'followup-sla' | 'pickup-sla' | 'lab-sla' | 'median-resolution' | 'median-response' | 'fcr' | 'throughput' | 'backlog' | 'breached-open' | 'at-risk' | 'reopen-rate' | 'oldest-open' | 'csat' | 'csat-average' | 'csat-response-rate' | 'csat-unhappy' | 'csat-followup'
export type KpiUnit = '%' | 'h' | 'min' | 'n' | 'per-day' | 'score'
export type KpiDef = { key: KpiKey; label: string; short: string; unit: KpiUnit; /** 'up': higher is better. */ direction: 'up' | 'down'; defaultTarget: number | null; what: string }

export const KPI_DEFS: KpiDef[] = [
  { key: 'resolution-sla', label: 'Resolved within target', short: 'Resolution SLA', unit: '%', direction: 'up', defaultTarget: 90, what: 'Share of cases resolved in the period whose working time from creation to resolution stayed within their target.' },
  { key: 'response-sla', label: 'First response within target', short: 'Response SLA', unit: '%', direction: 'up', defaultTarget: 90, what: 'Share of cases created in the period whose first outgoing email or desk note came within the response target. Phone cases count as answered on the call when that option is on.' },
  { key: 'followup-sla', label: 'Follow-ups answered within target', short: 'Reply SLA', unit: '%', direction: 'up', defaultTarget: 90, what: 'Share of the customer’s follow-ups (an email or portal reply after the case was first answered) answered in the period within the follow-up target. Automatic emails do not count as an answer.' },
  { key: 'pickup-sla', label: 'Picked up from the bin within target', short: 'Pick-up SLA', unit: '%', direction: 'up', defaultTarget: 90, what: 'Share of cases taken from a bin (a shared account, a team or nobody) by an engineer in the period within the pick-up target. Counted from what the portal’s watch saw, so from the day it was switched on.' },
  { key: 'lab-sla', label: 'Lab samples closed within target', short: 'Lab SLA', unit: '%', direction: 'up', defaultTarget: 90, what: 'Share of cases sent to the Lab (In Progress-Lab) and resolved in the period within the Lab target. Counted from what the portal’s watch saw.' },
  { key: 'median-resolution', label: 'Median resolution time', short: 'Median resolve', unit: 'h', direction: 'down', defaultTarget: 4, what: 'Median working hours from creation to resolution for cases resolved in the period.' },
  { key: 'median-response', label: 'Median first response', short: 'Median response', unit: 'min', direction: 'down', defaultTarget: 60, what: 'Median working minutes to the first outgoing email or desk note, over cases created in the period that have one. Phone cases counted as answered on the call are left out of the median.' },
  { key: 'fcr', label: 'First-contact resolution', short: 'FCR', unit: '%', direction: 'up', defaultTarget: 70, what: 'Share of resolved cases marked "Case considered as: FCR".' },
  { key: 'throughput', label: 'Resolved per engineer per day', short: 'Throughput', unit: 'per-day', direction: 'up', defaultTarget: 8, what: 'Cases resolved in the period, per engineer who resolved at least one, per working day.' },
  { key: 'backlog', label: 'Active backlog', short: 'Backlog', unit: 'n', direction: 'down', defaultTarget: null, what: 'Active cases right now, excluding those paused while waiting on the customer.' },
  { key: 'breached-open', label: 'Active cases past target', short: 'Past target', unit: 'n', direction: 'down', defaultTarget: 0, what: 'Active cases whose resolution clock has run past the target.' },
  { key: 'at-risk', label: 'Active cases at risk', short: 'At risk', unit: 'n', direction: 'down', defaultTarget: 0, what: 'Active cases past the warning share of their target and not yet past it.' },
  { key: 'reopen-rate', label: 'Reopened', short: 'Reopened', unit: '%', direction: 'down', defaultTarget: 5, what: 'Share of cases resolved in the period that carry more than one resolution, plus active cases that were resolved before.' },
  { key: 'oldest-open', label: 'Oldest active case', short: 'Oldest', unit: 'h', direction: 'down', defaultTarget: null, what: 'Working hours since the oldest active, unpaused case was created.' },
  { key: 'csat', label: 'Customer satisfaction', short: 'CSAT', unit: '%', direction: 'up', defaultTarget: 85, what: 'Share of survey responses in the period at or above the "satisfied" score (4 of 5 by default).' },
  { key: 'csat-average', label: 'Average rating', short: 'Avg rating', unit: 'score', direction: 'up', defaultTarget: 4.2, what: 'Mean of the 1–5 scores customers gave in the period.' },
  { key: 'csat-response-rate', label: 'Survey response rate', short: 'Survey replies', unit: '%', direction: 'up', defaultTarget: 25, what: 'Share of emailed surveys in the period that were answered. Ratings given on the portal without an invitation are not in the base.' },
  { key: 'csat-unhappy', label: 'Unhappy customers awaiting follow-up', short: 'To call back', unit: 'n', direction: 'down', defaultTarget: 0, what: 'Low scores whose follow-up a manager has not closed yet, whatever the period.' },
  { key: 'csat-followup', label: 'Unhappy customers contacted within target', short: 'Follow-up SLA', unit: '%', direction: 'up', defaultTarget: 90, what: 'Share of closed follow-ups in the period where the customer was contacted within the follow-up target (working minutes).' },
]
export const kpiDef = (key: KpiKey): KpiDef => KPI_DEFS.find((k) => k.key === key)!

export const fmtKpi = (v: KpiDef, value: number | null): string => {
  if (value === null) return '—'
  switch (v.unit) {
    case '%':
      return `${value.toLocaleString('en-IN', { maximumFractionDigits: 1 })}%`
    case 'h':
      return `${value.toLocaleString('en-IN', { maximumFractionDigits: 1 })} h`
    case 'min':
      return `${Math.round(value).toLocaleString('en-IN')} min`
    case 'per-day':
      return value.toLocaleString('en-IN', { maximumFractionDigits: 1 })
    case 'score':
      return `${value.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / 5`
    default:
      return Math.round(value).toLocaleString('en-IN')
  }
}

/** The figures that miss their card's target, as lines for a notification: "Resolution SLA 72% · target ≥ 90%". Cards that are
    off, have no target or no value are left out. */
export const offTargetLines = (values: { key: KpiKey; value: number | null }[], kpis: KpiSetting[]): string[] =>
  values.flatMap(({ key, value }) => {
    const k = kpis.find((x) => x.key === key)
    if (!k?.enabled || k.target === null || value === null) return []
    const d = kpiDef(key)
    const met = d.direction === 'up' ? value >= k.target : value <= k.target
    return met ? [] : [`${d.short} ${fmtKpi(d, value)} · target ${d.direction === 'up' ? '≥' : '≤'} ${fmtKpi(d, k.target)}`]
  })

export type KpiSetting = { key: KpiKey; enabled: boolean; target: number | null }

export type Period = '7d' | '30d' | '90d' | 'mtd'
export const PERIODS: { key: Period; label: string }[] = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: 'mtd', label: 'Month to date' },
]
export const asPeriod = (s: string | undefined, fallback: Period): Period => (PERIODS.some((p) => p.key === s) ? (s as Period) : fallback)

export type Settings = {
  targets: TargetRule[]
  warnAtPercent: number
  phoneCountsAsResponded: boolean
  pauseWhileWaiting: boolean
  subtractOnHold: boolean
  hours: BusinessHours
  kpis: KpiSetting[]
  defaultPeriod: Period
  /** Outgoing emails whose subject starts with one of these are the CRM's automatic mail (acknowledgements, reminders,
      closure notices): they never answer the customer for the follow-up clock. */
  automatedSubjects: string[]
  notify: NotifySettings
  /** The CSAT pass of the scheduled sweep (surveys and reminders); `live` lets it email customers. */
  sweep: { enabled: boolean; live: boolean }
  managerRoles: string[]
  managers: string[]
  csat: CsatSettings
  updatedAt: string | null
}

/* Defaults mirror what the CRM already encodes: VOICE SLA L1 and EMAIL SLA resolve in 240 working minutes (warn at 120),
   and the "Daily Resolved Cases <2 h Consumer / <4 h Enterprise" views (03-metadata-summary.md). */
export const DEFAULT_TARGETS: TargetRule[] = [
  { vertical: 'any', priority: 'any', origin: 'any', responseMinutes: 60, resolveMinutes: 240, ...NEW_CLOCK_DEFAULTS },
  { vertical: 100000000, priority: 'any', origin: 'any', responseMinutes: 60, resolveMinutes: 120, ...NEW_CLOCK_DEFAULTS },
  { vertical: 100000002, priority: 'any', origin: 'any', responseMinutes: 60, resolveMinutes: 240, ...NEW_CLOCK_DEFAULTS },
  { vertical: 'any', priority: 1, origin: 'any', responseMinutes: 45, resolveMinutes: 180, ...NEW_CLOCK_DEFAULTS },
  { vertical: 'any', priority: 696720000, origin: 'any', responseMinutes: 30, resolveMinutes: 120, ...NEW_CLOCK_DEFAULTS },
]
/** The CRM's automatic case mail on this org (seen on UAT 2026-11-27): acknowledgement, assignment and escalation notices,
    the pending reminder, the closure notice and the feedback reminder. */
export const DEFAULT_AUTOMATED_SUBJECTS = ['Acknowledgement For New Ticket', 'Case Assigned', 'Case No:', 'Reminder : Case pending', 'K7 Ticket Closure', 'Quick Reminder']
export const DEFAULT_MANAGER_ROLES = ['System Administrator', 'K7 - System Admin', 'CSR Manager', 'Customer Service Manager', 'Service Manager']

export const DEFAULT_SETTINGS: Settings = {
  targets: DEFAULT_TARGETS,
  warnAtPercent: 75,
  phoneCountsAsResponded: true,
  pauseWhileWaiting: true,
  subtractOnHold: true,
  hours: DEFAULT_HOURS,
  kpis: KPI_DEFS.map((k) => ({ key: k.key, enabled: true, target: k.defaultTarget })),
  defaultPeriod: '30d',
  automatedSubjects: DEFAULT_AUTOMATED_SUBJECTS,
  notify: DEFAULT_NOTIFY,
  sweep: { enabled: true, live: false },
  managerRoles: DEFAULT_MANAGER_ROLES,
  managers: [],
  csat: DEFAULT_CSAT,
  updatedAt: null,
}

/* ---------- Target resolution ---------- */

export type CaseFacets = { vertical: number | null | undefined; priority: number | null | undefined; origin: number | null | undefined }

const matches = (v: number | Any, x: number | null | undefined) => v === 'any' || (x !== null && x !== undefined && Number(v) === Number(x))
const specificity = (t: TargetRule) => (t.vertical !== 'any' ? 4 : 0) + (t.priority !== 'any' ? 2 : 0) + (t.origin !== 'any' ? 1 : 0)

/** The most specific target row that matches the case; the catch-all when nothing else does. */
export const resolveTarget = (targets: TargetRule[], c: CaseFacets): TargetRule => {
  let best: TargetRule | null = null
  for (const t of targets) {
    if (!matches(t.vertical, c.vertical) || !matches(t.priority, c.priority) || !matches(t.origin, c.origin)) continue
    if (!best || specificity(t) > specificity(best)) best = t
  }
  return best ?? targets.find((t) => t.vertical === 'any' && t.priority === 'any' && t.origin === 'any') ?? DEFAULT_TARGETS[0]!
}

/* ---------- Normalising a stored document ---------- */

type Raw = Record<string, unknown>
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : [])
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d)
const anyOrNum = (v: unknown): number | Any => (v === 'any' || v === undefined || v === null || v === '' ? 'any' : Number(v))
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : typeof v === 'string' && v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [])
const positive = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : d)
/** One entry per line (a textarea) or an array; blanks dropped. */
const lines = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : typeof v === 'string' ? v.split(/\r?\n/) : []).map((x) => x.trim()).filter(Boolean)
const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/

/** The stored shifts, or the old single business-hours window as one shift "Day" (settings saved before 2026-11-27). */
export const normaliseShifts = (hours: Raw): Shift[] => {
  const shifts = arr(hours.shifts)
    .map((x, i) => {
      const days = strs(x.days).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
      const start = typeof x.start === 'string' && HHMM.test(x.start) ? x.start.padStart(5, '0') : ''
      const end = typeof x.end === 'string' && HHMM.test(x.end) ? x.end.padStart(5, '0') : ''
      const name = String(x.name ?? '').trim() || `Shift ${i + 1}`
      const key = String(x.key ?? '').trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `shift-${i + 1}`
      const members = lines(x.members).flatMap((m) => m.split(/[\s,;]+/)).map((m) => m.toLowerCase()).filter((m) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m))
      return start && end && start !== end && days.length ? { key, name, start, end, days: [...new Set(days)].sort(), members: [...new Set(members)] } : null
    })
    .filter((x): x is Shift => x !== null)
  // Keys stay unique: a renamed copy of a shift gets a suffix.
  const used = new Set<string>()
  for (const sh of shifts) {
    let k = sh.key
    for (let n = 2; used.has(k); n++) k = `${sh.key}-${n}`
    sh.key = k
    used.add(k)
  }
  if (shifts.length) return shifts
  const days = strs(hours.days).map(Number).filter((d) => d >= 0 && d <= 6)
  const start = typeof hours.start === 'string' && HHMM.test(hours.start) ? hours.start.padStart(5, '0') : DEFAULT_SHIFT.start
  const end = typeof hours.end === 'string' && HHMM.test(hours.end) ? hours.end.padStart(5, '0') : DEFAULT_SHIFT.end
  return [{ ...DEFAULT_SHIFT, start, end, days: days.length ? days : DEFAULT_SHIFT.days }]
}

export const normaliseSettings = (g: Raw | null): Settings => {
  if (!g) return DEFAULT_SETTINGS
  const targets = arr(g.targets).map((t) => ({
    vertical: anyOrNum(t.vertical),
    priority: anyOrNum(t.priority),
    origin: anyOrNum(t.origin),
    responseMinutes: num(t.responseMinutes, 60),
    resolveMinutes: num(t.resolveMinutes, 240),
    followUpMinutes: positive(t.followUpMinutes, NEW_CLOCK_DEFAULTS.followUpMinutes),
    pickupMinutes: positive(t.pickupMinutes, NEW_CLOCK_DEFAULTS.pickupMinutes),
    labMinutes: positive(t.labMinutes, NEW_CLOCK_DEFAULTS.labMinutes),
  }))
  const hours = (g.hours as Raw | undefined) ?? {}
  const kpis = arr(g.kpis).map((k) => ({ key: String(k.key) as KpiKey, enabled: bool(k.enabled, true), target: numOrNull(k.target) })).filter((k) => KPI_DEFS.some((d) => d.key === k.key))
  // Cards added after the settings were first saved (the CSAT set) appear with their defaults until a manager decides otherwise.
  if (kpis.length) for (const d of KPI_DEFS) if (!kpis.some((k) => k.key === d.key)) kpis.push({ key: d.key, enabled: true, target: d.defaultTarget })
  const sweep = (g.sweep as Raw | undefined) ?? {}
  return {
    targets: targets.length ? targets : DEFAULT_TARGETS,
    warnAtPercent: Math.min(99, Math.max(10, num(g.warnAtPercent, 75))),
    phoneCountsAsResponded: bool(g.phoneCountsAsResponded, true),
    pauseWhileWaiting: bool(g.pauseWhileWaiting, true),
    subtractOnHold: bool(g.subtractOnHold, true),
    hours: { mode: hours.mode === 'always' ? 'always' : 'business', timeZone: typeof hours.timeZone === 'string' && hours.timeZone ? hours.timeZone : DEFAULT_HOURS.timeZone, shifts: normaliseShifts(hours) },
    kpis: kpis.length ? kpis : DEFAULT_SETTINGS.kpis,
    defaultPeriod: asPeriod(typeof g.defaultPeriod === 'string' ? g.defaultPeriod : undefined, '30d'),
    automatedSubjects: Array.isArray(g.automatedSubjects) || typeof g.automatedSubjects === 'string' ? lines(g.automatedSubjects) : DEFAULT_AUTOMATED_SUBJECTS,
    notify: normaliseNotify(g.notify as Raw | undefined, strs(sweep.managerEmails)),
    sweep: { enabled: bool(sweep.enabled, true), live: bool(sweep.live, false) },
    managerRoles: arr(g.managerRoles).map((r) => String(r.name ?? '')).filter(Boolean).length ? arr(g.managerRoles).map((r) => String(r.name ?? '')).filter(Boolean) : DEFAULT_MANAGER_ROLES,
    managers: arr(g.managers).map((m) => String(m.email ?? '').toLowerCase()).filter(Boolean),
    csat: normaliseCsat(g.csat as Raw | undefined),
    updatedAt: typeof g.updatedAt === 'string' ? g.updatedAt : null,
  }
}

/* ---------- Period boundaries (desk clock: the configured zone) ---------- */

export const periodBounds = (p: Period, now: Date, timeZone: string): { from: Date; to: Date; days: number; label: string } => {
  const to = now
  if (p === 'mtd') {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
    const g = (t: string) => Number(parts.find((x) => x.type === t)?.value ?? 0)
    // Local midnight on the 1st: build it in UTC, then shift by the zone offset at that instant.
    const guess = Date.UTC(g('year'), g('month') - 1, 1)
    const offset = offsetAt(guess, timeZone)
    const from = new Date(guess - offset * 60_000)
    return { from, to, days: Math.max(1, (to.getTime() - from.getTime()) / 864e5), label: 'this month' }
  }
  const days = p === '7d' ? 7 : p === '90d' ? 90 : 30
  return { from: new Date(to.getTime() - days * 864e5), to, days, label: `last ${days} days` }
}

const offsetAt = (t: number, tz: string): number => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(t))
  const g = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return Math.round((Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute')) - Math.floor(t / 60_000) * 60_000) / 60_000)
}

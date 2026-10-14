import { DEFAULT_HOURS, type BusinessHours } from './sla'

/* The support KPI model (09-portal-guide.md §4c): targets, business hours, the KPI cards, the prevention rules and who counts as a
   manager. Pure types, defaults and resolution rules; kpi-config.ts loads and saves them through Payload. */

export type Any = 'any'
export type TargetRule = { vertical: number | Any; priority: number | Any; origin: number | Any; responseMinutes: number; resolveMinutes: number }

export type KpiKey = 'resolution-sla' | 'response-sla' | 'median-resolution' | 'median-response' | 'fcr' | 'throughput' | 'backlog' | 'breached-open' | 'at-risk' | 'reopen-rate' | 'oldest-open'
export type KpiUnit = '%' | 'h' | 'min' | 'n' | 'per-day'
export type KpiDef = { key: KpiKey; label: string; short: string; unit: KpiUnit; /** 'up': higher is better. */ direction: 'up' | 'down'; defaultTarget: number | null; what: string }

export const KPI_DEFS: KpiDef[] = [
  { key: 'resolution-sla', label: 'Resolved within target', short: 'Resolution SLA', unit: '%', direction: 'up', defaultTarget: 90, what: 'Share of cases resolved in the period whose working time from creation to resolution stayed within their target.' },
  { key: 'response-sla', label: 'First response within target', short: 'Response SLA', unit: '%', direction: 'up', defaultTarget: 90, what: 'Share of cases created in the period whose first outgoing email or desk note came within the response target. Phone cases count as answered on the call when that option is on.' },
  { key: 'median-resolution', label: 'Median resolution time', short: 'Median resolve', unit: 'h', direction: 'down', defaultTarget: 4, what: 'Median working hours from creation to resolution for cases resolved in the period.' },
  { key: 'median-response', label: 'Median first response', short: 'Median response', unit: 'min', direction: 'down', defaultTarget: 60, what: 'Median working minutes to the first outgoing email or desk note, over cases created in the period that have one. Phone cases counted as answered on the call are left out of the median.' },
  { key: 'fcr', label: 'First-contact resolution', short: 'FCR', unit: '%', direction: 'up', defaultTarget: 70, what: 'Share of resolved cases marked "Case considered as: FCR".' },
  { key: 'throughput', label: 'Resolved per engineer per day', short: 'Throughput', unit: 'per-day', direction: 'up', defaultTarget: 8, what: 'Cases resolved in the period, per engineer who resolved at least one, per working day.' },
  { key: 'backlog', label: 'Active backlog', short: 'Backlog', unit: 'n', direction: 'down', defaultTarget: null, what: 'Active cases right now, excluding those paused while waiting on the customer.' },
  { key: 'breached-open', label: 'Active cases past target', short: 'Past target', unit: 'n', direction: 'down', defaultTarget: 0, what: 'Active cases whose resolution clock has run past the target.' },
  { key: 'at-risk', label: 'Active cases at risk', short: 'At risk', unit: 'n', direction: 'down', defaultTarget: 0, what: 'Active cases past the warning share of their target and not yet past it.' },
  { key: 'reopen-rate', label: 'Reopened', short: 'Reopened', unit: '%', direction: 'down', defaultTarget: 5, what: 'Share of cases resolved in the period that carry more than one resolution, plus active cases that were resolved before.' },
  { key: 'oldest-open', label: 'Oldest active case', short: 'Oldest', unit: 'h', direction: 'down', defaultTarget: null, what: 'Working hours since the oldest active, unpaused case was created.' },
]
export const kpiDef = (key: KpiKey): KpiDef => KPI_DEFS.find((k) => k.key === key)!

export type KpiSetting = { key: KpiKey; enabled: boolean; target: number | null }

export type RuleKey = 'unowned-at-risk' | 'nudge-at-risk' | 'escalate-breach' | 'stale' | 'waiting-followup'
export type RuleAction = 'flag' | 'note' | 'queue' | 'email-owner' | 'email-managers'
export type RuleDef = { key: RuleKey; label: string; what: string; thresholdLabel: string | null; defaultThreshold: number | null; defaultActions: RuleAction[] }
export const RULE_DEFS: RuleDef[] = [
  { key: 'unowned-at-risk', label: 'At risk and not owned by an engineer', what: 'The case is at risk or past target and its owner is a team, a queue user or the system account. Someone has to pick it up.', thresholdLabel: null, defaultThreshold: null, defaultActions: ['flag', 'email-managers'] },
  { key: 'nudge-at-risk', label: 'At risk: remind the owner', what: 'The resolution clock has fewer working minutes left than the threshold. The owner is reminded on the case.', thresholdLabel: 'Minutes left', defaultThreshold: 60, defaultActions: ['flag', 'note'] },
  { key: 'escalate-breach', label: 'Past target: escalate', what: 'The resolution clock has run out and the case is still active.', thresholdLabel: null, defaultThreshold: null, defaultActions: ['flag', 'note', 'email-managers'] },
  { key: 'stale', label: 'No activity for too long', what: 'An active case that is not waiting on the customer and has not been modified for longer than the threshold.', thresholdLabel: 'Minutes since last change', defaultThreshold: 480, defaultActions: ['flag', 'note'] },
  { key: 'waiting-followup', label: 'Waiting on the customer for too long', what: 'In Progress-Customer and untouched for longer than the threshold: time to follow up or close.', thresholdLabel: 'Minutes since last change', defaultThreshold: 2880, defaultActions: ['flag'] },
]
export const ruleDef = (key: RuleKey): RuleDef => RULE_DEFS.find((r) => r.key === key)!
export const ACTION_LABEL: Record<RuleAction, string> = { flag: 'Flag on the board', note: 'Internal note on the case', queue: 'Add to a queue', 'email-owner': 'Email the owner', 'email-managers': 'Email the managers' }

export type RuleSetting = { key: RuleKey; enabled: boolean; thresholdMinutes: number | null; cooldownHours: number; actions: RuleAction[]; queueId: string | null }

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
  rules: RuleSetting[]
  sweep: { enabled: boolean; live: boolean; managerEmails: string[] }
  managerRoles: string[]
  managers: string[]
  updatedAt: string | null
}

/* Defaults mirror what the CRM already encodes: VOICE SLA L1 and EMAIL SLA resolve in 240 working minutes (warn at 120),
   and the "Daily Resolved Cases <2 h Consumer / <4 h Enterprise" views (03-metadata-summary.md). */
export const DEFAULT_TARGETS: TargetRule[] = [
  { vertical: 'any', priority: 'any', origin: 'any', responseMinutes: 60, resolveMinutes: 240 },
  { vertical: 100000000, priority: 'any', origin: 'any', responseMinutes: 60, resolveMinutes: 120 },
  { vertical: 100000002, priority: 'any', origin: 'any', responseMinutes: 60, resolveMinutes: 240 },
  { vertical: 'any', priority: 1, origin: 'any', responseMinutes: 45, resolveMinutes: 180 },
  { vertical: 'any', priority: 696720000, origin: 'any', responseMinutes: 30, resolveMinutes: 120 },
]
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
  rules: RULE_DEFS.map((r) => ({ key: r.key, enabled: true, thresholdMinutes: r.defaultThreshold, cooldownHours: 8, actions: r.defaultActions, queueId: null })),
  sweep: { enabled: true, live: false, managerEmails: [] },
  managerRoles: DEFAULT_MANAGER_ROLES,
  managers: [],
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

export const normaliseSettings = (g: Raw | null): Settings => {
  if (!g) return DEFAULT_SETTINGS
  const targets = arr(g.targets).map((t) => ({ vertical: anyOrNum(t.vertical), priority: anyOrNum(t.priority), origin: anyOrNum(t.origin), responseMinutes: num(t.responseMinutes, 60), resolveMinutes: num(t.resolveMinutes, 240) }))
  const hours = (g.hours as Raw | undefined) ?? {}
  const days = strs(hours.days).map(Number).filter((d) => d >= 0 && d <= 6)
  const kpis = arr(g.kpis).map((k) => ({ key: String(k.key) as KpiKey, enabled: bool(k.enabled, true), target: numOrNull(k.target) })).filter((k) => KPI_DEFS.some((d) => d.key === k.key))
  const rules = arr(g.rules).map((r) => ({ key: String(r.key) as RuleKey, enabled: bool(r.enabled, true), thresholdMinutes: numOrNull(r.thresholdMinutes), cooldownHours: num(r.cooldownHours, 8), actions: strs(r.actions).filter((a): a is RuleAction => a in ACTION_LABEL), queueId: typeof r.queueId === 'string' && r.queueId ? r.queueId : null })).filter((r) => RULE_DEFS.some((d) => d.key === r.key))
  const sweep = (g.sweep as Raw | undefined) ?? {}
  return {
    targets: targets.length ? targets : DEFAULT_TARGETS,
    warnAtPercent: Math.min(99, Math.max(10, num(g.warnAtPercent, 75))),
    phoneCountsAsResponded: bool(g.phoneCountsAsResponded, true),
    pauseWhileWaiting: bool(g.pauseWhileWaiting, true),
    subtractOnHold: bool(g.subtractOnHold, true),
    hours: { mode: hours.mode === 'always' ? 'always' : 'business', start: typeof hours.start === 'string' && hours.start ? hours.start : DEFAULT_HOURS.start, end: typeof hours.end === 'string' && hours.end ? hours.end : DEFAULT_HOURS.end, days: days.length ? days : DEFAULT_HOURS.days, timeZone: typeof hours.timeZone === 'string' && hours.timeZone ? hours.timeZone : DEFAULT_HOURS.timeZone },
    kpis: kpis.length ? kpis : DEFAULT_SETTINGS.kpis,
    defaultPeriod: asPeriod(typeof g.defaultPeriod === 'string' ? g.defaultPeriod : undefined, '30d'),
    rules: rules.length ? rules : DEFAULT_SETTINGS.rules,
    sweep: { enabled: bool(sweep.enabled, true), live: bool(sweep.live, false), managerEmails: strs(sweep.managerEmails) },
    managerRoles: arr(g.managerRoles).map((r) => String(r.name ?? '')).filter(Boolean).length ? arr(g.managerRoles).map((r) => String(r.name ?? '')).filter(Boolean) : DEFAULT_MANAGER_ROLES,
    managers: arr(g.managers).map((m) => String(m.email ?? '').toLowerCase()).filter(Boolean),
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

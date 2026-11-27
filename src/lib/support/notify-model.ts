import type { Period } from './kpi-model'

/* The support notification catalogue (09-portal-guide.md §4g): what the workspace tells people, who reads it and how it is
   delivered. Two kinds of thing notify. The SLA clocks and the KPI targets the manager configures (the only rules: a clock at
   risk or past its target, a KPI off its target at the end of a shift), and the important events of a case (assigned to you, the
   customer wrote, escalated to an internal team, a low rating). Every entry's audience and delivery is set from the portal
   (/support/workspace/manage/notifications). Pure; tested without a tenant. */

export type Audience = 'owner' | 'shift' | 'managers'
export const AUDIENCES: readonly Audience[] = ['owner', 'shift', 'managers']
export const AUDIENCE_LABEL: Record<Audience, string> = { owner: 'Case owner', shift: 'Engineers on shift', managers: 'Managers' }

export type Delivery = 'immediate' | 'digest' | 'bell' | 'off'
export const DELIVERIES: readonly Delivery[] = ['immediate', 'digest', 'bell', 'off']
export const DELIVERY_LABEL: Record<Delivery, string> = { immediate: 'Bell and email at once', digest: 'Bell; email at the end of the shift', bell: 'Bell only', off: 'Off' }

/* ---------- The SLA clocks ---------- */

export type ClockKey = 'response' | 'follow-up' | 'pickup' | 'lab' | 'resolution'
export type ClockDef = { key: ClockKey; label: string; what: string }
export const CLOCKS: readonly ClockDef[] = [
  { key: 'response', label: 'First response', what: 'From the case’s creation to the first answer: an email sent from the case or a desk note. Phone cases count as answered on the call when that option is on.' },
  { key: 'follow-up', label: 'Follow-up reply', what: 'From the customer’s email or portal reply on a case that was already answered, to the next answer. Automatic emails do not count as an answer.' },
  { key: 'pickup', label: 'Pick-up from the bin', what: 'From a case landing on a bin (a shared account such as Support #, a team, or nobody) to an engineer owning it.' },
  { key: 'lab', label: 'Lab sample', what: 'From the case moving to In Progress-Lab (the sample submitted) to the case being resolved. Moving the case back to support does not stop it.' },
  { key: 'resolution', label: 'Resolution', what: 'From creation to resolution, paused while the case waits on the customer when that option is on.' },
]
export const clockDef = (key: ClockKey): ClockDef => CLOCKS.find((c) => c.key === key)!
export const isClockKey = (v: unknown): v is ClockKey => typeof v === 'string' && CLOCKS.some((c) => c.key === v)

/* ---------- The catalogue ---------- */

export type NotifyGroup = 'sla' | 'kpi' | 'case' | 'csat'
export const GROUP_LABEL: Record<NotifyGroup, string> = { sla: 'SLA clocks', kpi: 'KPI targets', case: 'Case events', csat: 'Customer satisfaction' }
export const GROUPS: readonly NotifyGroup[] = ['sla', 'kpi', 'case', 'csat']

export type NotifyKey =
  | `sla.${ClockKey}.at-risk`
  | `sla.${ClockKey}.breached`
  | 'kpi.desk'
  | 'kpi.engineer'
  | 'case.assigned'
  | 'case.customer-replied'
  | 'case.escalated'
  | 'csat.low'
  | 'csat.followup-overdue'

export type NotifyDef = {
  key: NotifyKey
  group: NotifyGroup
  label: string
  what: string
  /** The audiences this entry can go to; a single one is fixed and the page shows it as text. */
  allowed: Audience[]
  audiences: Audience[]
  delivery: Delivery
}

const def = (key: NotifyKey, group: NotifyGroup, label: string, what: string, allowed: Audience[], audiences: Audience[], delivery: Delivery): NotifyDef => ({ key, group, label, what, allowed, audiences, delivery })

const slaDefs = (c: ClockDef): NotifyDef[] => {
  // A case in the bin has no engineer: the bin's at-risk goes to whoever is on shift, its breach to them and the managers.
  const bin = c.key === 'pickup'
  return [
    def(`sla.${c.key}.at-risk`, 'sla', `${c.label}: at risk`, `The ${c.label.toLowerCase()} clock has used the warning share of its target.`, ['owner', 'shift', 'managers'], bin ? ['shift'] : ['owner'], 'bell'),
    def(`sla.${c.key}.breached`, 'sla', `${c.label}: past target`, `The ${c.label.toLowerCase()} clock has run past its target.`, ['owner', 'shift', 'managers'], bin ? ['shift', 'managers'] : ['owner', 'managers'], 'immediate'),
  ]
}

/** Every notification the workspace sends, in the order the settings page lists them. */
export const NOTIFY_DEFS: readonly NotifyDef[] = [
  ...CLOCKS.flatMap(slaDefs),
  def('kpi.desk', 'kpi', 'Desk KPIs off target', 'At the end of the day’s last shift: the KPI cards whose value misses its target over the KPI period.', ['managers'], ['managers'], 'immediate'),
  def('kpi.engineer', 'kpi', 'Your KPIs off target', 'At the end of each shift, to each engineer on it: their own figures that miss the desk’s targets over the KPI period.', ['shift'], ['shift'], 'bell'),
  def('case.assigned', 'case', 'Case assigned to you', 'Someone else made you the owner of a case, in the portal or in Dynamics.', ['owner'], ['owner'], 'bell'),
  def('case.customer-replied', 'case', 'The customer wrote', 'An email or a portal reply from the customer arrived on the case. A case in the bin tells the engineers on shift.', ['owner', 'shift'], ['owner'], 'bell'),
  def('case.escalated', 'case', 'Escalated to an internal team', 'The case moved to principal support or the Lab, or was escalated to product.', ['owner', 'managers'], ['managers'], 'immediate'),
  def('csat.low', 'csat', 'Low rating', 'A customer rated a case at or below the unhappy score.', ['owner', 'managers'], ['owner', 'managers'], 'immediate'),
  def('csat.followup-overdue', 'csat', 'Unhappy customer past the follow-up target', 'A low score’s follow-up has waited past its target (CSAT settings).', ['managers'], ['managers'], 'immediate'),
]
export const NOTIFY_KEYS: readonly NotifyKey[] = NOTIFY_DEFS.map((d) => d.key)
export const notifyDef = (key: string): NotifyDef | null => NOTIFY_DEFS.find((d) => d.key === key) ?? null
export const isNotifyKey = (v: unknown): v is NotifyKey => typeof v === 'string' && NOTIFY_KEYS.includes(v as NotifyKey)

/* ---------- Settings ---------- */

export type NotifyRule = { key: NotifyKey; audiences: Audience[]; delivery: Delivery }

export type NotifySettings = {
  /** Off: nothing is written or sent; the clocks and the board still read. */
  enabled: boolean
  rules: NotifyRule[]
  /** Who "Managers" means here: work emails. An agent's address gets the bell and the email; any other address the email
      only. Empty: the manager view's own list of managers (KPI settings, "Who is a manager"). */
  managers: string[]
  /** The window the KPI notifications measure. */
  kpiPeriod: Period
  /** Read notifications are removed after this many days. */
  retentionDays: number
}

export const DEFAULT_RULES: NotifyRule[] = NOTIFY_DEFS.map((d) => ({ key: d.key, audiences: d.audiences, delivery: d.delivery }))
export const DEFAULT_NOTIFY: NotifySettings = { enabled: true, rules: DEFAULT_RULES, managers: [], kpiPeriod: '7d', retentionDays: 30 }

type Raw = Record<string, unknown>
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : typeof v === 'string' && v ? v.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean) : [])
const isDelivery = (v: unknown): v is Delivery => typeof v === 'string' && (DELIVERIES as readonly string[]).includes(v)
export const isEmail = (v: string): boolean => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v)

/** A rule's audiences kept to what its entry allows; a fixed entry always has its one audience. */
export const allowedAudiences = (key: NotifyKey, audiences: Audience[]): Audience[] => {
  const d = notifyDef(key)!
  if (d.allowed.length === 1) return [...d.allowed]
  return AUDIENCES.filter((a) => audiences.includes(a) && d.allowed.includes(a))
}

/** The stored settings, completed: an entry added to the catalogue after the settings were saved arrives with its defaults.
    `legacyManagerEmails` carries the old "Email the managers" list over (the sweep's, before 2026-11-27). */
export const normaliseNotify = (g: Raw | null | undefined, legacyManagerEmails: string[] = []): NotifySettings => {
  if (!g) return { ...DEFAULT_NOTIFY, managers: legacyManagerEmails.map((e) => e.toLowerCase()).filter(isEmail) }
  const stored = new Map<string, Raw>()
  for (const r of Array.isArray(g.rules) ? (g.rules as Raw[]) : []) if (isNotifyKey(r.key)) stored.set(String(r.key), r)
  const rules = NOTIFY_DEFS.map((d) => {
    const r = stored.get(d.key)
    if (!r) return { key: d.key, audiences: [...d.audiences], delivery: d.delivery }
    return { key: d.key, audiences: allowedAudiences(d.key, strs(r.audiences).filter((a): a is Audience => (AUDIENCES as readonly string[]).includes(a))), delivery: isDelivery(r.delivery) ? r.delivery : d.delivery }
  })
  const period = typeof g.kpiPeriod === 'string' && ['7d', '30d', '90d', 'mtd'].includes(g.kpiPeriod) ? (g.kpiPeriod as Period) : '7d'
  const days = typeof g.retentionDays === 'number' && Number.isFinite(g.retentionDays) ? Math.min(365, Math.max(1, Math.round(g.retentionDays))) : 30
  const managers = strs(g.managers).map((e) => e.toLowerCase()).filter(isEmail)
  return { enabled: g.enabled !== false, rules, managers: managers.length ? managers : legacyManagerEmails.map((e) => e.toLowerCase()).filter(isEmail), kpiPeriod: period, retentionDays: days }
}

/** The rule in force for an entry: off when notifications are off, the entry is off or it has nobody to go to. */
export const ruleFor = (n: NotifySettings, key: NotifyKey): NotifyRule & { on: boolean } => {
  const r = n.rules.find((x) => x.key === key) ?? DEFAULT_RULES.find((x) => x.key === key)!
  return { ...r, on: n.enabled && r.delivery !== 'off' && r.audiences.length > 0 }
}

/* ---------- Recipients ---------- */

export type Person = { id: string; name: string; email: string }

/** Who an audience names for one notification: the owner when an engineer owns the case, the members of the shifts on now,
    the managers. One row per person; a manager address that is not an agent's gets the email only (`managerEmailsOnly`). */
export const resolveAudience = (
  audiences: Audience[],
  ctx: { owner?: Person | null; shift: Person[]; managers: Person[]; managerEmailsOnly?: string[]; exclude?: string },
): { people: Person[]; emailOnly: string[] } => {
  const seen = new Set<string>()
  const people: Person[] = []
  const add = (p: Person | null | undefined) => {
    if (!p?.id || seen.has(p.id.toLowerCase()) || (ctx.exclude && p.id.toLowerCase() === ctx.exclude.toLowerCase())) return
    seen.add(p.id.toLowerCase())
    people.push(p)
  }
  if (audiences.includes('owner')) add(ctx.owner)
  if (audiences.includes('shift')) ctx.shift.forEach(add)
  if (audiences.includes('managers')) ctx.managers.forEach(add)
  const mailed = new Set(people.map((p) => p.email.toLowerCase()).filter(Boolean))
  const emailOnly = audiences.includes('managers') ? [...new Set((ctx.managerEmailsOnly ?? []).map((e) => e.toLowerCase()))].filter((e) => isEmail(e) && !mailed.has(e)) : []
  return { people, emailOnly }
}

/** Work emails → the agents they name, case-insensitive; unknown addresses are dropped. */
export const peopleByEmail = (emails: string[], agents: Person[]): Person[] => {
  const want = new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))
  return agents.filter((a) => a.email && want.has(a.email.toLowerCase()))
}

/* ---------- The email ---------- */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** One notification as an email: the body, the link, the line that says where it came from. */
export const notificationMail = (n: { subject: string; body: string; link: string }): { subject: string; text: string; html: string } => ({
  subject: n.subject,
  text: `${n.body}\n\n${n.link}\n\nK7 Support portal · notification settings are on the manager view`,
  html: `<div style="font:15px/1.55 Arial,sans-serif;color:#111">${n.body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px">${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('')}<p style="margin:16px 0"><a href="${esc(n.link)}" style="color:#111">Open in the workspace →</a></p><p style="margin:0;font-size:12px;color:#666">K7 Support portal</p></div>`,
})

/** The shift-end digest: one message per person with everything that waited for it, oldest first. */
export const digestMail = (rows: { subject: string; body: string; link: string; at: string }[], portal: string): { subject: string; text: string; html: string } => {
  const n = rows.length
  return {
    subject: `[K7 Support] ${n} notification${n === 1 ? '' : 's'} from your shift`,
    text: `${rows.map((r) => `${r.subject}\n${r.body}\n${r.link}`).join('\n\n')}\n\n${portal}\n\nK7 Support portal`,
    html: `<div style="font:15px/1.55 Arial,sans-serif;color:#111">${rows
      .map((r) => `<p style="margin:0 0 14px"><a href="${esc(r.link)}" style="color:#111;font-weight:600">${esc(r.subject)}</a><br><span style="color:#555">${esc(r.body).replace(/\n/g, '<br>')}</span></p>`)
      .join('')}<p style="margin:0;font-size:12px;color:#666">K7 Support portal · <a href="${esc(portal)}" style="color:#666">${esc(portal)}</a></p></div>`,
  }
}

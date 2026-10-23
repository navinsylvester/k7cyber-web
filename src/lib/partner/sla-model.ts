import { addWorkingMinutes, DEFAULT_HOURS, workingMinutesBetween, type BusinessHours } from '@/lib/support/sla'

import type { Application } from './registration-model'
import type { Deal } from './deals-model'

/* The approval SLA (FR-NTF-01 "Approval SLA breached", 02-build-plan.md M8): a clock starts when a deal or an application
   lands on K7's queue and runs in the programme's working hours (the support engine's business-hours maths, its own
   settings) against `deals.approvalSlaHours`. The clock restarts when the item comes back after a request for information,
   so a partner's delay is never K7's breach. Pure; the sweep in `sla.ts` sends the notice once per clock. */

export type SlaSettings = { hours: BusinessHours; warnShare: number; escalateTo: string[] }

export const DEFAULT_SLA_SETTINGS: SlaSettings = { hours: { ...DEFAULT_HOURS }, warnShare: 0.75, escalateTo: [] }

export type SlaClock = { kind: 'deal' | 'application'; id: string; number: string; label: string; orgId: string; orgName: string; orgPartnerId: string; startedAt: string; href: string }

/** A deal's clock: from its latest submission while it waits for a decision, from the request while an extension waits. */
export const dealClock = (d: Pick<Deal, 'id' | 'dealId' | 'status' | 'thread' | 'submittedAt' | 'extension' | 'orgId' | 'orgName' | 'orgPartnerId' | 'customer'>): SlaClock | null => {
  let startedAt: string | null = null
  if (d.status === 'submitted') startedAt = [...d.thread].reverse().find((t) => t.to === 'submitted')?.at ?? d.submittedAt
  else if (d.status === 'extensionRequested') startedAt = d.extension.requestedAt ?? [...d.thread].reverse().find((t) => t.to === 'extensionRequested')?.at ?? null
  if (!startedAt) return null
  return { kind: 'deal', id: d.id, number: d.dealId, label: `${d.dealId} · ${d.customer.name}`, orgId: d.orgId, orgName: d.orgName, orgPartnerId: d.orgPartnerId, startedAt, href: `/partners/portal/k7/deals/${d.dealId}` }
}

/** An application's clock: from its latest submission while it is submitted or under review (assignment does not stop it). */
export const applicationClock = (a: Pick<Application, 'id' | 'number' | 'status' | 'decisions' | 'submittedAt' | 'company' | 'createdAt'>): SlaClock | null => {
  if (a.status !== 'submitted' && a.status !== 'underReview') return null
  const startedAt = [...a.decisions].reverse().find((x) => x.to === 'submitted')?.at ?? a.submittedAt ?? a.createdAt
  if (!startedAt) return null
  return { kind: 'application', id: a.id, number: a.number, label: `${a.number} · ${a.company.legalName}`, orgId: '', orgName: a.company.legalName, orgPartnerId: '', startedAt, href: `/partners/portal/k7/applications/${a.number}` }
}

export type SlaState = 'ok' | 'at-risk' | 'breached'
export type SlaReading = { startedAt: string; dueAt: string; targetMinutes: number; elapsedMinutes: number; leftMinutes: number; share: number; state: SlaState }

/** Where a clock stands now: the due instant, the working minutes used and left, and the state against the warning share. */
export const readClock = (startedAt: string, hours: number, sla: SlaSettings, now: Date = new Date()): SlaReading => {
  const targetMinutes = Math.max(1, Math.round(hours * 60))
  const dueAt = addWorkingMinutes(startedAt, targetMinutes, sla.hours).toISOString()
  const elapsedMinutes = Math.round(workingMinutesBetween(startedAt, now, sla.hours))
  const leftMinutes = targetMinutes - elapsedMinutes
  const share = Math.min(1, elapsedMinutes / targetMinutes)
  const state: SlaState = leftMinutes < 0 ? 'breached' : share >= sla.warnShare ? 'at-risk' : 'ok'
  return { startedAt, dueAt, targetMinutes, elapsedMinutes, leftMinutes, share, state }
}

/** Working minutes as "45 min", "6 h", "2 d 3 h" on a 9-hour working day. */
export const workingText = (minutes: number, sla: SlaSettings): string => {
  const m = Math.abs(Math.round(minutes))
  if (m < 60) return `${m} min`
  const dayMin = sla.hours.mode === 'always' ? 24 * 60 : Math.max(60, hmMinutes(sla.hours.end) - hmMinutes(sla.hours.start))
  if (m < dayMin) return `${Math.round(m / 60)} h`
  const d = Math.floor(m / dayMin)
  const h = Math.round((m - d * dayMin) / 60)
  return h ? `${d} d ${h} h` : `${d} d`
}

const hmMinutes = (s: string): number => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim())
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0
}

/** The reading in words for a queue row: "due in 6 h", "due in 45 min · at risk", "overdue by 2 d". */
export const slaText = (r: SlaReading, sla: SlaSettings): string => (r.state === 'breached' ? `overdue by ${workingText(-r.leftMinutes, sla)}` : `due in ${workingText(r.leftMinutes, sla)}${r.state === 'at-risk' ? ' · at risk' : ''}`)

/* ---------- Business hours as the settings page edits them ---------- */

export const WEEKDAYS = [
  { n: 1, label: 'Mon' },
  { n: 2, label: 'Tue' },
  { n: 3, label: 'Wed' },
  { n: 4, label: 'Thu' },
  { n: 5, label: 'Fri' },
  { n: 6, label: 'Sat' },
  { n: 0, label: 'Sun' },
] as const

export const hoursText = (h: BusinessHours): string => (h.mode === 'always' ? 'around the clock' : `${h.start}–${h.end} ${h.days.map((d) => WEEKDAYS.find((w) => w.n === d)?.label ?? d).join(' ')} (${h.timeZone})`)

/* ---------- Decision times, for the report ---------- */

/** Working minutes a decided deal waited on K7: from the submission that led to the decision to the decision. */
export const dealDecisionMinutes = (d: Pick<Deal, 'thread' | 'status' | 'decidedAt'>, sla: SlaSettings): number | null => {
  const decision = [...d.thread].reverse().find((t) => t.kind === 'decision' && (t.to === 'approved' || t.to === 'rejected' || t.to === 'infoRequested'))
  if (!decision) return null
  const before = d.thread.filter((t) => t.to === 'submitted' && t.at <= decision.at)
  const start = before[before.length - 1]?.at
  if (!start) return null
  return Math.round(workingMinutesBetween(start, decision.at, sla.hours))
}

export const applicationDecisionMinutes = (a: Pick<Application, 'decisions'>, sla: SlaSettings): number | null => {
  const decision = [...a.decisions].reverse().find((x) => x.to === 'approved' || x.to === 'rejected' || x.to === 'clarification')
  if (!decision) return null
  const before = a.decisions.filter((x) => x.to === 'submitted' && x.at <= decision.at)
  const start = before[before.length - 1]?.at
  if (!start) return null
  return Math.round(workingMinutesBetween(start, decision.at, sla.hours))
}

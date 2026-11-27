import type { ClockKey } from './notify-model'
import { STATUS } from './options'
import type { SlaReading } from './sla'

/* The notification watch's decisions (09-portal-guide.md §4g), pure: given what the watch saw of a case last time and what
   the desk reads now, which events happened (assigned, the customer wrote, escalated), which clock runs finished (pick-up,
   Lab) and which SLA states are new. watch.ts does the reading, the writing and the telling. Tested without a tenant. */

export type OwnerKind = 'user' | 'team' | 'shared' | 'none'

/** The parts of a desk case (metrics.ts CaseLite) the watch needs. */
export type LiveCase = {
  id: string
  ticket: string
  title: string
  createdon: Date
  statuscode: number
  owner: { id: string; name: string; kind: OwnerKind }
  /** Who last changed the case: an owner who assigned it to themselves picked it, nobody needs telling. */
  modifiedById: string
  lastInAt: Date | null
  firstResponseAt: Date | null
  followUpSince: Date | null
  binSince: Date | null
  labSince: Date | null
  response: SlaReading
  followUp: SlaReading
  pickup: SlaReading
  lab: SlaReading
  resolve: SlaReading
}

/** What the watch keeps per case (watch-store.ts). */
export type Seen = {
  ownerId: string
  ownerName: string
  ownerKind: string
  statuscode: number
  binSince: Date | null
  labSince: Date | null
  lastInAt: Date | null
  notified: string[]
}

export type CaseEvent =
  | { key: 'case.assigned'; dedupe: string }
  | { key: 'case.customer-replied'; dedupe: string }
  | { key: 'case.escalated'; dedupe: string; to: 'lab' | 'principal' }

export type FinishedRun = { clock: 'pickup' | 'lab'; start: Date; end: Date; ownerId: string; ownerName: string }

export type SlaStateNow = { clock: ClockKey; state: 'at-risk' | 'breached'; start: Date; key: string; reading: SlaReading }

const inBin = (kind: string) => kind !== 'user'

/** Each clock with the start of its current run, null when it is not running on this case. */
export const clockRuns = (c: LiveCase): { clock: ClockKey; start: Date | null; reading: SlaReading }[] => [
  { clock: 'response', start: c.firstResponseAt ? null : c.createdon, reading: c.response },
  { clock: 'follow-up', start: c.followUpSince, reading: c.followUp },
  { clock: 'pickup', start: c.binSince, reading: c.pickup },
  { clock: 'lab', start: c.labSince, reading: c.lab },
  { clock: 'resolution', start: c.createdon, reading: c.resolve },
]

export const slaKey = (clock: ClockKey, state: string, start: Date): string => `${clock}:${state}:${start.toISOString()}`

/** The SLA states the case is in now: one per running clock at risk or past its target. */
export const slaStates = (c: LiveCase): SlaStateNow[] =>
  clockRuns(c).flatMap((x) => (x.start && (x.reading.state === 'at-risk' || x.reading.state === 'breached') ? [{ clock: x.clock, state: x.reading.state, start: x.start, key: slaKey(x.clock, x.reading.state, x.start), reading: x.reading }] : []))

/** The states to tell: not told before for this run of the clock. A run seen for the first time already past its target is told
    once, as past target, not as at risk too. */
export const slaToTell = (states: SlaStateNow[], notified: string[]): SlaStateNow[] => {
  const told = new Set(notified)
  const fresh = states.filter((s) => !told.has(s.key))
  return fresh.filter((s) => !(s.state === 'at-risk' && states.some((o) => o.clock === s.clock && o.state === 'breached' && o.start.getTime() === s.start.getTime())))
}

/** The told list kept to the runs still going (a new run of a clock starts a new list), plus what is in state now. */
export const keepNotified = (notified: string[], c: LiveCase, states: SlaStateNow[]): string[] => {
  const runs = clockRuns(c).filter((x) => x.start)
  const live = (k: string) => runs.some((x) => k.startsWith(`${x.clock}:`) && k.endsWith(`:${x.start!.toISOString()}`))
  return [...new Set([...notified.filter(live), ...states.map((s) => s.key)])]
}

export type Diff = { events: CaseEvent[]; runs: FinishedRun[]; tell: SlaStateNow[]; seen: Seen }

/** One pass for one active case. The first sight records the case as it is and tells nothing: a watch switched on does not
    replay the desk's past. */
export const diffCase = (prev: Seen | null, c: LiveCase, now: Date): Diff => {
  const states = slaStates(c)
  if (!prev) {
    return {
      events: [],
      runs: [],
      tell: [],
      seen: { ownerId: c.owner.id, ownerName: c.owner.name, ownerKind: c.owner.kind, statuscode: c.statuscode, binSince: c.binSince, labSince: c.labSince, lastInAt: c.lastInAt, notified: states.map((s) => s.key) },
    }
  }
  const events: CaseEvent[] = []
  const runs: FinishedRun[] = []
  const ownerChanged = prev.ownerId.toLowerCase() !== c.owner.id.toLowerCase()
  if (ownerChanged && c.owner.kind === 'user' && c.modifiedById.toLowerCase() !== c.owner.id.toLowerCase()) events.push({ key: 'case.assigned', dedupe: `assigned:${c.id}:${c.owner.id}`.toLowerCase() })
  if (ownerChanged && inBin(prev.ownerKind) && !inBin(c.owner.kind) && prev.binSince) runs.push({ clock: 'pickup', start: prev.binSince, end: now, ownerId: c.owner.id, ownerName: c.owner.name })
  // Into a bin now: from this pass (the watch saw it within a minute); still in one: since it landed; out: no bin.
  const binSince = !inBin(c.owner.kind) ? null : ownerChanged ? now : (prev.binSince ?? c.binSince)
  let labSince = prev.labSince
  if (c.statuscode !== prev.statuscode) {
    if (c.statuscode === STATUS.IN_PROGRESS_LAB) {
      events.push({ key: 'case.escalated', to: 'lab', dedupe: `escalated:${c.id}:lab`.toLowerCase() })
      labSince = labSince ?? now
    } else if (c.statuscode === STATUS.IN_PROGRESS_PRINCIPLE) {
      events.push({ key: 'case.escalated', to: 'principal', dedupe: `escalated:${c.id}:principal`.toLowerCase() })
    }
  }
  if (c.lastInAt && (!prev.lastInAt || c.lastInAt.getTime() > prev.lastInAt.getTime())) events.push({ key: 'case.customer-replied', dedupe: `replied:${c.id.toLowerCase()}` })
  // A clock whose start moved on this pass was read against the old start: it is told from the next pass.
  const moved = (clock: ClockKey) => (clock === 'pickup' ? (binSince?.getTime() ?? 0) !== (c.binSince?.getTime() ?? 0) : clock === 'lab' ? (labSince?.getTime() ?? 0) !== (c.labSince?.getTime() ?? 0) : false)
  const steady = states.filter((s) => !moved(s.clock))
  const tell = slaToTell(steady, prev.notified)
  return {
    events,
    runs,
    tell,
    seen: { ownerId: c.owner.id, ownerName: c.owner.name, ownerKind: c.owner.kind, statuscode: c.statuscode, binSince, labSince, lastInAt: c.lastInAt ?? prev.lastInAt, notified: keepNotified(prev.notified, c, steady) },
  }
}

/** A case that left the active desk (resolved, cancelled, merged): its Lab run ends with it. */
export const closeCase = (prev: Seen, end: Date): FinishedRun[] => (prev.labSince ? [{ clock: 'lab', start: prev.labSince, end, ownerId: prev.ownerId, ownerName: prev.ownerName }] : [])

import 'server-only'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

/* The notification watch's memory in Payload (09-portal-guide.md §4g): one `support-case-watch` row per case it has seen and
   one `support-clock-runs` row per finished pick-up or Lab run. The manager's numbers read both (metrics.ts); the watch writes
   them (watch.ts). Reads never throw: without the tables the clocks fall back to what Dynamics says. */

export type WatchRow = {
  id: string
  caseId: string
  ticket: string
  ownerId: string
  ownerName: string
  ownerKind: string
  statecode: number
  statuscode: number
  binSince: Date | null
  labSince: Date | null
  lastInAt: Date | null
  notified: string[]
  active: boolean
  seenAt: Date | null
}

export type ClockRun = { caseId: string; ticket: string; clock: 'pickup' | 'lab'; ownerId: string; ownerName: string; startedAt: Date; endedAt: Date; minutes: number; target: number; met: boolean }

type Doc = Record<string, unknown>
const db = () => getPayload({ config: configPromise })
const dateOf = (v: unknown): Date | null => {
  if (typeof v !== 'string' || !v) return null
  const d = new Date(v)
  return Number.isFinite(d.getTime()) ? d : null
}
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

const toWatch = (d: Doc): WatchRow => ({
  id: s(d.id),
  caseId: s(d.caseId),
  ticket: s(d.ticket),
  ownerId: s(d.ownerId),
  ownerName: s(d.ownerName),
  ownerKind: s(d.ownerKind),
  statecode: Number(d.statecode ?? 0),
  statuscode: Number(d.statuscode ?? 0),
  binSince: dateOf(d.binSince),
  labSince: dateOf(d.labSince),
  lastInAt: dateOf(d.lastInAt),
  notified: Array.isArray(d.notified) ? d.notified.map(String) : [],
  active: d.active !== false,
  seenAt: dateOf(d.seenAt),
})

/** Every row the watch keeps for a case still active, by case id. */
export const activeWatchRows = async (): Promise<Map<string, WatchRow>> => {
  const m = new Map<string, WatchRow>()
  try {
    const payload = await db()
    const r = await payload.find({ collection: 'support-case-watch', where: { active: { equals: true } }, limit: 5000, depth: 0, overrideAccess: true, pagination: false })
    for (const d of r.docs as unknown as Doc[]) m.set(s(d.caseId).toLowerCase(), toWatch(d))
  } catch (e) {
    console.error(`[case watch] read failed: ${(e as Error).message}`)
  }
  return m
}

/** Rows for these cases whatever their state (a case resolved and reopened comes back to its row). */
export const watchRowsFor = async (caseIds: string[]): Promise<Map<string, WatchRow>> => {
  const m = new Map<string, WatchRow>()
  if (!caseIds.length) return m
  try {
    const payload = await db()
    for (let i = 0; i < caseIds.length; i += 200) {
      const r = await payload.find({ collection: 'support-case-watch', where: { caseId: { in: caseIds.slice(i, i + 200) } }, limit: 200, depth: 0, overrideAccess: true, pagination: false })
      for (const d of r.docs as unknown as Doc[]) m.set(s(d.caseId).toLowerCase(), toWatch(d))
    }
  } catch (e) {
    console.error(`[case watch] read failed: ${(e as Error).message}`)
  }
  return m
}

export type WatchPatch = Partial<Omit<WatchRow, 'id' | 'binSince' | 'labSince' | 'lastInAt' | 'seenAt'>> & { binSince?: Date | null; labSince?: Date | null; lastInAt?: Date | null; seenAt?: Date | null }

const toData = (p: WatchPatch): Doc => {
  const out: Doc = {}
  for (const [k, v] of Object.entries(p)) out[k] = v instanceof Date ? v.toISOString() : v
  return out
}

export const writeWatch = async (row: WatchRow | null, patch: WatchPatch & { caseId: string }): Promise<void> => {
  const payload = await db()
  if (row) await payload.update({ collection: 'support-case-watch', id: row.id, data: toData(patch) as never, overrideAccess: true })
  else await payload.create({ collection: 'support-case-watch', data: toData(patch) as never, overrideAccess: true })
}

export const recordClockRun = async (r: ClockRun): Promise<void> => {
  const payload = await db()
  await payload.create({ collection: 'support-clock-runs', data: { ...r, startedAt: r.startedAt.toISOString(), endedAt: r.endedAt.toISOString() } as never, overrideAccess: true })
}

/** Runs that finished in [from, to). */
export const clockRunsEnded = async (from: Date, to: Date): Promise<ClockRun[]> => {
  try {
    const payload = await db()
    const r = await payload.find({ collection: 'support-clock-runs', where: { and: [{ endedAt: { greater_than_equal: from.toISOString() } }, { endedAt: { less_than: to.toISOString() } }] }, limit: 10000, depth: 0, overrideAccess: true, pagination: false })
    return (r.docs as unknown as Doc[]).map((d) => ({
      caseId: s(d.caseId),
      ticket: s(d.ticket),
      clock: d.clock === 'lab' ? 'lab' : 'pickup',
      ownerId: s(d.ownerId),
      ownerName: s(d.ownerName),
      startedAt: dateOf(d.startedAt) ?? new Date(0),
      endedAt: dateOf(d.endedAt) ?? new Date(0),
      minutes: Number(d.minutes ?? 0),
      target: Number(d.target ?? 0),
      met: d.met === true,
    }))
  } catch (e) {
    console.error(`[clock runs] read failed: ${(e as Error).message}`)
    return []
  }
}

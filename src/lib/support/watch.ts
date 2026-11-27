import 'server-only'

import { buildQuery, fv, list, type DataverseAuth, type Row } from '@/lib/dataverse'

import { getSettings, type Settings } from './kpi-config'
import { offTargetLines, PERIODS, type KpiKey } from './kpi-model'
import { engineerStats, followUpsAnswered, kpiValues, loadDesk, SHARED_OWNER, type CaseLite, type Desk } from './metrics'
import { clockDef, type Person } from './notify-model'
import { digestDoneSince, digestPass, notify, retentionPass, toldAlready, type DigestResult } from './notify'
import { getAgents } from './reference'
import { fmtLeft, fmtMinutes, pct, shiftEndsBetween, workingMinutesBetween } from './sla'
import { closeCase, diffCase, type CaseEvent, type FinishedRun, type Seen, type SlaStateNow } from './watch-model'
import { activeWatchRows, recordClockRun, watchRowsFor, writeWatch, type WatchRow } from './watch-store'

/* The notification watch (09-portal-guide.md §4g): once a minute (POST /api/support/notify/watch, or "Check now" on the at-risk
   board) it reads the live desk, compares every active case with what it saw last time (watch-model.ts) and tells people:
   events that happened in Dynamics or the portal, SLA clocks that went at risk or past target. At the end of each shift it sends
   the KPI reports and the digest emails, and clears old rows. It writes only Payload rows and mail; never Dynamics. */

export type WatchResult = {
  at: string
  enabled: boolean
  cases: number
  firstSeen: number
  events: number
  told: number
  runs: number
  closed: number
  kpi: number
  digest: DigestResult | null
  removed: number
  warnings: string[]
  ms: number
}

const caseHref = (id: string) => `/support/workspace/cases/${id}`
const MANAGE = '/support/workspace/manage'

const ownerText = (c: CaseLite) => (c.owner.kind === 'user' ? c.owner.name : c.owner.kind === 'none' ? 'nobody (in the bin)' : `${c.owner.name} (the bin)`)

/** Who changed the case lately: the newest audit entry by a person. Dynamics' own accounts (K7 Computing, SYSTEM) touch a case
    after an assignment, so the case's "modified by" names them, not the agent. Null when the audit cannot be read. */
const humanActor = async (auth: DataverseAuth, c: CaseLite, now: Date): Promise<string | null> => {
  try {
    const r = await list<Row>(auth, buildQuery('audits', { select: ['createdon', '_userid_value'], filter: `_objectid_value eq ${c.id} and createdon ge ${new Date(now.getTime() - 15 * 60_000).toISOString()}`, orderby: 'createdon desc', top: 20 }), 20)
    for (const a of r.value) if (a._userid_value && !SHARED_OWNER.test(fv(a, '_userid_value'))) return String(a._userid_value).toLowerCase()
  } catch {
    /* no audit rights: fall back below */
  }
  return null
}

const tellEvent = (auth: DataverseAuth, ev: CaseEvent, c: CaseLite, owner: Person | null, at: Date, actorId: string | null) => {
  const base = { caseId: c.id, ticket: c.ticket, href: caseHref(c.id), owner, dedupe: ev.dedupe, at, actorId: actorId ?? undefined }
  const about = `"${c.title || 'no title'}"${c.customer ? `, ${c.customer}` : ''}`
  switch (ev.key) {
    case 'case.assigned':
      return notify(auth, { ...base, key: ev.key, subject: `${c.ticket} is yours: ${c.title || 'no title'}`, body: `You are now the owner of case ${c.ticket} ${about}. Status ${c.status}.` })
    case 'case.customer-replied':
      // A burst of messages within half an hour is one notification (case-notify.ts tells portal replies the same way).
      return notify(auth, { ...base, key: ev.key, dedupeHours: 0.5, subject: `${c.ticket}: the customer wrote`, body: `A new message from the customer on case ${c.ticket} ${about}. Owner: ${ownerText(c)}.` })
    case 'case.escalated':
      return notify(auth, { ...base, key: ev.key, subject: `${c.ticket} escalated to ${ev.to === 'lab' ? 'the Lab' : 'principal support'}`, body: `Case ${c.ticket} ${about} moved to ${c.status}. Owner: ${ownerText(c)}.` })
  }
}

const tellSla = (auth: DataverseAuth, st: SlaStateNow, c: CaseLite, owner: Person | null, at: Date) => {
  const def = clockDef(st.clock)
  const target = st.reading.target
  return notify(auth, {
    key: `sla.${st.clock}.${st.state}`,
    caseId: c.id,
    ticket: c.ticket,
    href: caseHref(c.id),
    owner,
    at,
    dedupe: `sla:${c.id}:${st.key}`.toLowerCase(),
    dedupeHours: 24 * 30,
    subject: `${c.ticket}: ${def.label.toLowerCase()} ${st.state === 'breached' ? 'past target' : 'at risk'}`,
    body: `${def.label}: target ${fmtMinutes(target)} in working time, ${fmtLeft(st.reading)}. Case "${c.title || 'no title'}"${c.customer ? `, ${c.customer}` : ''}; owner ${ownerText(c)}; ${c.status}.`,
  })
}

const sameSeen = (row: WatchRow, s: Seen): boolean => {
  const t = (d: Date | null) => d?.getTime() ?? 0
  return (
    row.ownerId === s.ownerId &&
    row.ownerKind === s.ownerKind &&
    row.statuscode === s.statuscode &&
    t(row.binSince) === t(s.binSince) &&
    t(row.labSince) === t(s.labSince) &&
    t(row.lastInAt) === t(s.lastInAt) &&
    row.notified.length === s.notified.length &&
    row.notified.every((k) => s.notified.includes(k))
  )
}

const toSeen = (r: WatchRow): Seen => ({ ownerId: r.ownerId, ownerName: r.ownerName, ownerKind: r.ownerKind, statuscode: r.statuscode, binSince: r.binSince, labSince: r.labSince, lastInAt: r.lastInAt, notified: r.notified })

const saveRun = async (r: FinishedRun, c: { id: string; ticket: string }, targetMinutes: number, settings: Settings) => {
  const minutes = Math.round(workingMinutesBetween(r.start, r.end, settings.hours))
  await recordClockRun({ caseId: c.id, ticket: c.ticket, clock: r.clock, ownerId: r.ownerId, ownerName: r.ownerName, startedAt: r.start, endedAt: r.end, minutes, target: targetMinutes, met: minutes <= targetMinutes })
}

/* ---------- KPI reports at the end of a shift ---------- */

const ENGINEER_KPIS: KpiKey[] = ['resolution-sla', 'response-sla', 'followup-sla', 'median-resolution', 'median-response', 'fcr', 'csat']

const deskReport = async (auth: DataverseAuth, d: Desk, settings: Settings, date: string): Promise<number> => {
  const dedupe = `kpi.desk:${date}`
  if (await toldAlready(dedupe)) return 0
  const lines = offTargetLines(kpiValues(d).map((k) => ({ key: k.def.key, value: k.value })), settings.kpis)
  if (!lines.length) return 0
  const period = PERIODS.find((p) => p.key === d.period)?.label.toLowerCase() ?? d.period
  const r = await notify(auth, { key: 'kpi.desk', dedupe, dedupeHours: 48, href: `${MANAGE}?period=${d.period}`, subject: `Desk KPIs: ${lines.length} off target (${period})`, body: `${date}, ${period}:\n${lines.join('\n')}` })
  return r.bell
}

const engineerReports = async (auth: DataverseAuth, d: Desk, settings: Settings, members: string[], date: string, shiftKey: string): Promise<number> => {
  if (!members.length) return 0
  const agents = await getAgents(auth).catch(() => [])
  const stats = engineerStats(d)
  const period = PERIODS.find((p) => p.key === d.period)?.label.toLowerCase() ?? d.period
  let n = 0
  for (const email of members) {
    const a = agents.find((x) => (x.email ?? '').toLowerCase() === email)
    if (!a) continue
    const e = stats.find((x) => x.owner.id.toLowerCase() === a.id.toLowerCase())
    if (!e) continue
    const f = followUpsAnswered(d, e.owner.id)
    const values: Record<string, number | null> = {
      'resolution-sla': e.resolvePct,
      'response-sla': e.responsePct,
      'followup-sla': pct(f.filter((x) => x.met).length, f.length),
      'median-resolution': e.medianResolveHours,
      'median-response': e.medianResponseMin,
      fcr: e.fcrPct,
      csat: e.csatPct,
    }
    const lines = offTargetLines(ENGINEER_KPIS.map((key) => ({ key, value: values[key] ?? null })), settings.kpis)
    if (!lines.length) continue
    const r = await notify(auth, {
      key: 'kpi.engineer',
      people: [{ id: a.id, name: a.name, email: (a.email ?? '').toLowerCase() }],
      dedupe: `kpi.engineer:${date}:${shiftKey}`,
      dedupeHours: 48,
      href: `${MANAGE}/engineers/${a.id}?period=${d.period}`,
      subject: `Your figures: ${lines.length} off target (${period})`,
      body: `${date}, ${period}, your cases:\n${lines.join('\n')}`,
    })
    n += r.bell
  }
  return n
}

/* ---------- The pass ---------- */

export const runWatch = async (auth: DataverseAuth, o: { now?: Date } = {}): Promise<WatchResult> => {
  const t0 = Date.now()
  const now = o.now ?? new Date()
  const settings = await getSettings()
  const out: WatchResult = { at: now.toISOString(), enabled: settings.notify.enabled, cases: 0, firstSeen: 0, events: 0, told: 0, runs: 0, closed: 0, kpi: 0, digest: null, removed: 0, warnings: [], ms: 0 }
  if (!settings.notify.enabled) return { ...out, ms: Date.now() - t0 }
  const desk = await loadDesk(auth, settings, '7d', { fresh: true, now })
  out.warnings.push(...desk.warnings)
  out.cases = desk.activeCases.length
  const [rows, agents] = await Promise.all([activeWatchRows(), getAgents(auth).catch(() => [])])
  const older = await watchRowsFor(desk.activeCases.filter((c) => !rows.has(c.id.toLowerCase())).map((c) => c.id))
  const people = new Map(agents.map((a) => [a.id.toLowerCase(), { id: a.id, name: a.name, email: (a.email ?? '').toLowerCase() }]))

  for (const c of desk.activeCases) {
    const key = c.id.toLowerCase()
    const row = rows.get(key) ?? older.get(key) ?? null
    const diff = diffCase(row ? toSeen(row) : null, c, now)
    if (!row) out.firstSeen++
    const owner = c.owner.kind === 'user' ? (people.get(c.owner.id.toLowerCase()) ?? { id: c.owner.id, name: c.owner.name, email: '' }) : null
    try {
      // An assignment or an escalation: whoever did it is not told, and an engineer who took the case themselves is not told it is theirs.
      const needsActor = diff.events.some((e) => e.key === 'case.assigned' || e.key === 'case.escalated')
      const fallback = c.modifiedById && !SHARED_OWNER.test(people.get(c.modifiedById.toLowerCase())?.name ?? 'system') ? c.modifiedById.toLowerCase() : null
      const actor = needsActor ? ((await humanActor(auth, c, now)) ?? fallback) : null
      for (const ev of diff.events) {
        if (ev.key === 'case.assigned' && actor && actor === c.owner.id.toLowerCase()) continue
        await tellEvent(auth, ev, c, owner, now, ev.key === 'case.customer-replied' ? null : actor)
        out.events++
      }
      for (const r of diff.runs) {
        await saveRun(r, c, r.clock === 'pickup' ? c.target.pickupMinutes : c.target.labMinutes, settings)
        out.runs++
      }
      for (const st of diff.tell) {
        await tellSla(auth, st, c, owner, now)
        out.told++
      }
      if (!row || !row.active || !sameSeen(row, diff.seen)) await writeWatch(row, { caseId: c.id, ticket: c.ticket, ...diff.seen, active: true, seenAt: now })
    } catch (e) {
      out.warnings.push(`${c.ticket}: ${(e as Error).message.slice(0, 160)}`)
    }
  }

  // Cases that left the desk: resolved, cancelled or merged. A Lab run ends with the case.
  const activeIds = new Set(desk.activeCases.map((c) => c.id.toLowerCase()))
  const catchAll = settings.targets.find((t) => t.vertical === 'any' && t.priority === 'any' && t.origin === 'any') ?? settings.targets[0]
  for (const [id, row] of rows) {
    if (activeIds.has(id)) continue
    const resolved = desk.resolvedCases.find((c) => c.id.toLowerCase() === id)
    try {
      for (const r of closeCase(toSeen(row), resolved?.resolvedAt ?? now)) {
        await saveRun(r, { id: row.caseId, ticket: row.ticket }, resolved?.target.labMinutes ?? catchAll?.labMinutes ?? 180, settings)
        out.runs++
      }
      await writeWatch(row, { caseId: row.caseId, active: false, labSince: null, binSince: null, seenAt: now })
      out.closed++
    } catch (e) {
      out.warnings.push(`${row.ticket}: ${(e as Error).message.slice(0, 160)}`)
    }
  }

  // The end of a shift: KPI reports, the digest, the retention sweep. A shift that closed in the last two hours and was not
  // handled yet (the watch was down at the time) is handled now; the dedupe keys make the pass idempotent.
  const ends = shiftEndsBetween(new Date(now.getTime() - 2 * 3600_000), now, settings.hours)
  if (ends.length) {
    try {
      const kd = await loadDesk(auth, settings, settings.notify.kpiPeriod, { now })
      for (const e of ends) {
        if (e.lastOfDay) out.kpi += await deskReport(auth, kd, settings, e.date)
        out.kpi += await engineerReports(auth, kd, settings, e.shift.members, e.date, e.shift.key)
      }
    } catch (err) {
      out.warnings.push(`KPI reports: ${(err as Error).message.slice(0, 160)}`)
    }
    const last = ends[ends.length - 1]!
    try {
      if (!(await digestDoneSince(last.close))) out.digest = await digestPass(last.close, now)
      out.removed = await retentionPass(settings.notify.retentionDays, now)
    } catch (err) {
      out.warnings.push(`Digest: ${(err as Error).message.slice(0, 160)}`)
    }
  }
  return { ...out, ms: Date.now() - t0 }
}

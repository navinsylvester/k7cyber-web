import { describe, expect, it } from 'vitest'

import { followUps, isAutomated, openFollowUp } from '@/lib/support/clocks'
import { DEFAULT_SETTINGS, offTargetLines } from '@/lib/support/kpi-model'
import { allowedAudiences, DEFAULT_NOTIFY, NOTIFY_DEFS, normaliseNotify, peopleByEmail, resolveAudience, ruleFor } from '@/lib/support/notify-model'
import { STATUS } from '@/lib/support/options'
import { NO_READING, type SlaReading } from '@/lib/support/sla'
import { closeCase, diffCase, keepNotified, slaStates, slaToTell, type LiveCase, type Seen } from '@/lib/support/watch-model'

/* The support notifications (09-portal-guide.md §4g) without a tenant: the catalogue and its settings, who an audience names,
   the follow-up, pick-up and Lab clocks, and the watch's decisions. */

const t = (iso: string) => new Date(iso)
const reading = (state: SlaReading['state'], left = 10, target = 60): SlaReading => ({ state, elapsed: target - left, target, left, ratio: (target - left) / target, deadline: null })

describe('catalogue and settings', () => {
  it('has one entry per clock state, the KPI reports and the case events', () => {
    const keys = NOTIFY_DEFS.map((d) => d.key)
    expect(keys).toContain('sla.follow-up.breached')
    expect(keys).toContain('sla.pickup.at-risk')
    expect(keys).toContain('kpi.desk')
    expect(keys).toContain('case.escalated')
    expect(new Set(keys).size).toBe(keys.length)
    // A case in the bin has no owner: its pick-up clock goes to the shift by default.
    expect(ruleFor(DEFAULT_NOTIFY, 'sla.pickup.at-risk').audiences).toEqual(['shift'])
    expect(ruleFor(DEFAULT_NOTIFY, 'sla.resolution.breached')).toMatchObject({ audiences: ['owner', 'managers'], delivery: 'immediate', on: true })
  })
  it('completes stored settings and keeps audiences to what an entry allows', () => {
    const n = normaliseNotify({ enabled: true, rules: [{ key: 'case.escalated', audiences: 'owner,shift,managers', delivery: 'digest' }, { key: 'bogus', audiences: 'owner' }], managers: 'Lead@K7.com\nnope', kpiPeriod: '30d', retentionDays: 900 })
    expect(ruleFor(n, 'case.escalated')).toMatchObject({ audiences: ['owner', 'managers'], delivery: 'digest' })
    expect(ruleFor(n, 'kpi.engineer').audiences).toEqual(['shift'])
    expect(n.managers).toEqual(['lead@k7.com'])
    expect(n.kpiPeriod).toBe('30d')
    expect(n.retentionDays).toBe(365)
    expect(allowedAudiences('kpi.desk', ['owner'])).toEqual(['managers'])
    expect(normaliseNotify(null, ['Old@K7.com']).managers).toEqual(['old@k7.com'])
  })
  it('is off when switched off, when the entry is off or names nobody', () => {
    expect(ruleFor({ ...DEFAULT_NOTIFY, enabled: false }, 'case.assigned').on).toBe(false)
    expect(ruleFor({ ...DEFAULT_NOTIFY, rules: [{ key: 'case.assigned', audiences: ['owner'], delivery: 'off' }] }, 'case.assigned').on).toBe(false)
    expect(ruleFor({ ...DEFAULT_NOTIFY, rules: [{ key: 'case.escalated', audiences: [], delivery: 'bell' }] }, 'case.escalated').on).toBe(false)
  })
})

describe('audiences', () => {
  const owner = { id: 'U1', name: 'Priya', email: 'priya@k7.com' }
  const lead = { id: 'u2', name: 'Lead', email: 'lead@k7.com' }
  const night = { id: 'u3', name: 'Ravi', email: 'ravi@k7.com' }
  it('names each person once, never the one who acted, and mails other manager addresses', () => {
    const r = resolveAudience(['owner', 'shift', 'managers'], { owner, shift: [night, { ...owner, id: 'u1' }], managers: [lead], managerEmailsOnly: ['boss@k7.com', 'LEAD@k7.com'], exclude: 'u3' })
    expect(r.people.map((p) => p.name)).toEqual(['Priya', 'Lead'])
    expect(r.emailOnly).toEqual(['boss@k7.com'])
    expect(resolveAudience(['owner'], { owner: null, shift: [night], managers: [lead], managerEmailsOnly: ['boss@k7.com'] })).toEqual({ people: [], emailOnly: [] })
  })
  it('maps work emails to agents', () => {
    expect(peopleByEmail(['PRIYA@k7.com', 'gone@k7.com'], [owner, lead]).map((p) => p.id)).toEqual(['U1'])
  })
})

describe('clocks', () => {
  it('finds the follow-ups after the first answer, one per run of customer messages', () => {
    const msgs = [
      { at: t('2026-10-13T04:00:00Z'), dir: 'in' as const }, // the case's own first email: the response clock's
      { at: t('2026-10-13T05:00:00Z'), dir: 'out' as const },
      { at: t('2026-10-13T06:00:00Z'), dir: 'in' as const },
      { at: t('2026-10-13T06:10:00Z'), dir: 'in' as const }, // same follow-up
      { at: t('2026-10-13T06:40:00Z'), dir: 'out' as const },
      { at: t('2026-10-13T08:00:00Z'), dir: 'in' as const }, // still waiting
    ]
    expect(followUps(msgs, null)).toEqual([
      { start: t('2026-10-13T06:00:00Z'), end: t('2026-10-13T06:40:00Z') },
      { start: t('2026-10-13T08:00:00Z'), end: null },
    ])
    // A phone case answered on the call: the first email after it is already a follow-up.
    expect(followUps([{ at: t('2026-10-13T04:30:00Z'), dir: 'in' }], t('2026-10-13T04:00:00Z'))).toEqual([{ start: t('2026-10-13T04:30:00Z'), end: null }])
  })
  it('reads the follow-up running now from the last message each way', () => {
    const first = t('2026-10-13T05:00:00Z')
    expect(openFollowUp({ lastIn: t('2026-10-13T06:00:00Z'), lastOut: first, firstAnswer: first })).toEqual(t('2026-10-13T06:00:00Z'))
    expect(openFollowUp({ lastIn: t('2026-10-13T06:00:00Z'), lastOut: t('2026-10-13T06:30:00Z'), firstAnswer: first })).toBeNull()
    expect(openFollowUp({ lastIn: t('2026-10-13T04:00:00Z'), lastOut: null, firstAnswer: null })).toBeNull() // the first response's
  })
  it('recognises the CRM’s automatic mail by its subject', () => {
    const auto = DEFAULT_SETTINGS.automatedSubjects
    expect(isAutomated('Acknowledgement For New Ticket: CS-01195-B0Q3', auto)).toBe(true)
    expect(isAutomated('case no:CS-01195-B0Q3 is Escalated', auto)).toBe(true)
    expect(isAutomated('RE: Combine license terms', auto)).toBe(false)
    expect(isAutomated('', auto)).toBe(false)
  })
})

describe('KPI lines', () => {
  it('lists the figures off their targets', () => {
    const lines = offTargetLines(
      [
        { key: 'resolution-sla', value: 72 },
        { key: 'median-response', value: 30 },
        { key: 'followup-sla', value: null },
      ],
      DEFAULT_SETTINGS.kpis,
    )
    expect(lines).toEqual(['Resolution SLA 72% · target ≥ 90%'])
  })
})

describe('the watch', () => {
  const now = t('2026-10-13T08:00:00Z')
  const base: LiveCase = {
    id: 'c1',
    ticket: 'CS-1',
    title: 'Scan fails',
    createdon: t('2026-10-13T04:00:00Z'),
    statuscode: STATUS.IN_PROGRESS_SUPPORT,
    owner: { id: 'u1', name: 'Priya', kind: 'user' },
    modifiedById: 'u9',
    lastInAt: t('2026-10-13T04:00:00Z'),
    firstResponseAt: t('2026-10-13T05:00:00Z'),
    followUpSince: null,
    binSince: null,
    labSince: null,
    response: reading('met'),
    followUp: NO_READING,
    pickup: NO_READING,
    lab: NO_READING,
    resolve: reading('ok', 100, 240),
  }
  const seen = (c: LiveCase, over: Partial<Seen> = {}): Seen => ({ ownerId: c.owner.id, ownerName: c.owner.name, ownerKind: c.owner.kind, statuscode: c.statuscode, binSince: c.binSince, labSince: c.labSince, lastInAt: c.lastInAt, notified: [], ...over })

  it('records a case seen for the first time and tells nothing, even past target', () => {
    const c = { ...base, resolve: reading('breached', -30, 240) }
    const d = diffCase(null, c, now)
    expect(d.events).toEqual([])
    expect(d.tell).toEqual([])
    expect(d.seen.notified).toEqual([`resolution:breached:${c.createdon.toISOString()}`])
  })
  it('tells an assignment by someone else, not a case taken by its new owner', () => {
    const was = seen({ ...base, owner: { id: 'u5', name: 'Other', kind: 'user' } })
    expect(diffCase(was, base, now).events).toEqual([{ key: 'case.assigned', dedupe: 'assigned:c1:u1' }])
    expect(diffCase(was, { ...base, modifiedById: 'U1' }, now).events).toEqual([])
  })
  it('finishes a pick-up run when an engineer takes a case from the bin', () => {
    const inBin = { ...base, owner: { id: 'q1', name: 'Support #', kind: 'shared' as const }, binSince: t('2026-10-13T07:50:00Z') }
    const d = diffCase(seen(inBin), { ...base, modifiedById: 'u1' }, now)
    expect(d.runs).toEqual([{ clock: 'pickup', start: t('2026-10-13T07:50:00Z'), end: now, ownerId: 'u1', ownerName: 'Priya' }])
    expect(d.seen.binSince).toBeNull()
    // Into a bin: the bin clock starts at this pass.
    const back = diffCase(seen(base), { ...inBin, binSince: t('2026-10-13T04:00:00Z'), pickup: reading('breached', -200, 5) }, now)
    expect(back.seen.binSince).toEqual(now)
    expect(back.tell).toEqual([]) // read against the old start: told from the next pass
  })
  it('tells an escalation to the Lab and starts the Lab clock; resolution ends it', () => {
    const d = diffCase(seen(base), { ...base, statuscode: STATUS.IN_PROGRESS_LAB }, now)
    expect(d.events).toEqual([{ key: 'case.escalated', to: 'lab', dedupe: 'escalated:c1:lab' }])
    expect(d.seen.labSince).toEqual(now)
    // Back to support: the sample is not closed yet.
    const back = diffCase(d.seen, { ...base, labSince: now }, t('2026-10-13T09:00:00Z'))
    expect(back.seen.labSince).toEqual(now)
    expect(closeCase(back.seen, t('2026-10-13T10:00:00Z'))).toEqual([{ clock: 'lab', start: now, end: t('2026-10-13T10:00:00Z'), ownerId: 'u1', ownerName: 'Priya' }])
  })
  it('tells a new customer message once', () => {
    const c = { ...base, lastInAt: t('2026-10-13T07:30:00Z') }
    expect(diffCase(seen(base), c, now).events).toEqual([{ key: 'case.customer-replied', dedupe: 'replied:c1' }])
    expect(diffCase(seen(c), c, now).events).toEqual([])
  })
  it('tells each clock state once per run, past target without the at risk before it', () => {
    const start = t('2026-10-13T07:30:00Z')
    const c = { ...base, followUpSince: start, followUp: reading('at-risk', 5, 30) }
    const d1 = diffCase(seen(base), c, now)
    expect(d1.tell.map((x) => x.key)).toEqual([`follow-up:at-risk:${start.toISOString()}`])
    const c2 = { ...c, followUp: reading('breached', -5, 30) }
    const d2 = diffCase(d1.seen, c2, now)
    expect(d2.tell.map((x) => x.key)).toEqual([`follow-up:breached:${start.toISOString()}`])
    expect(diffCase(d2.seen, c2, now).tell).toEqual([])
    // Straight past target: one notification, not two.
    expect(slaToTell(slaStates(c2), []).map((x) => x.state)).toEqual(['breached'])
    // A new follow-up later is a new run: told again; the old run's keys drop out.
    const later = t('2026-10-13T09:00:00Z')
    const c3 = { ...base, followUpSince: later, followUp: reading('breached', -1, 30) }
    const d3 = diffCase(d2.seen, c3, now)
    expect(d3.tell.map((x) => x.key)).toEqual([`follow-up:breached:${later.toISOString()}`])
    expect(keepNotified(d2.seen.notified, c3, []).some((k) => k.includes(start.toISOString()))).toBe(false)
  })
})

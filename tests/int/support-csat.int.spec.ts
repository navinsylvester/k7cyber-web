import { describe, expect, it } from 'vitest'

import { careFrom, DEFAULT_CSAT, emptyDistribution, facetLines, flagActive, normaliseCsat, readFollowUp, summarise, type CareFlag, type CsatRow, type CsatScore } from '@/lib/support/csat-model'
import { DEFAULT_SETTINGS, KPI_DEFS, normaliseSettings } from '@/lib/support/kpi-model'
import { DEFAULT_HOURS } from '@/lib/support/sla'

/* Customer satisfaction, without a tenant (09-portal-guide.md §4d): the summary numbers, the follow-up clock, the care band rules
   and the settings block. IST business hours; 2026-10-13 is a Tuesday. */

const now = new Date('2026-10-13T06:30:00Z') // Tue 12:00 IST
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString()
const daysAgo = (d: number) => new Date(now.getTime() - d * 864e5).toISOString()

let seq = 0
const row = (p: Partial<CsatRow> & { score?: CsatScore | null }): CsatRow => ({
  id: String(++seq),
  caseId: `case-${seq}`,
  ticket: `CS-${1000 + seq}-TEST`,
  title: 'A case',
  customerId: 'cust-1',
  customerName: 'Acme',
  customerKind: 'account',
  contactId: 'contact-1',
  email: 'a@acme.example',
  ownerId: 'eng-1',
  ownerName: 'Priya',
  product: 'K7 Total Security',
  issue: 'Activation',
  vertical: 100000000,
  priority: 2,
  origin: 3,
  status: 'responded',
  source: 'portal',
  score: 5,
  comment: '',
  resolvedAt: daysAgo(2),
  invitedAt: daysAgo(2),
  remindedAt: null,
  respondedAt: daysAgo(1),
  followUp: 'none',
  followUpOwnerId: '',
  followUpOwnerName: '',
  followUpAt: null,
  followUpNote: '',
  createdAt: daysAgo(2),
  ...p,
})

describe('summary', () => {
  it('counts satisfied, neutral and low scores, the mean and the response rate', () => {
    const rows = [row({ score: 5 }), row({ score: 4 }), row({ score: 3 }), row({ score: 1, followUp: 'pending' }), row({ status: 'invited', score: null, respondedAt: null }), row({ score: 4, invitedAt: null })]
    const s = summarise(rows, DEFAULT_CSAT, DEFAULT_HOURS, now)
    expect(s.responses).toBe(5)
    expect(s.satisfied).toBe(3)
    expect(s.csat).toBe(60)
    expect(s.average).toBe(3.4)
    expect(s.unhappy).toBe(1)
    expect(s.neutral).toBe(1)
    expect(s.distribution).toEqual({ ...emptyDistribution(), 1: 1, 3: 1, 4: 2, 5: 1 })
    expect(s.invited).toBe(5)
    expect(s.responseRate).toBe(80) // four of the five invitations were answered
    expect(s.followUpsOpen).toBe(1)
  })
  it('is empty-safe', () => {
    const s = summarise([], DEFAULT_CSAT, DEFAULT_HOURS, now)
    expect(s.csat).toBeNull()
    expect(s.average).toBeNull()
    expect(s.responseRate).toBeNull()
  })
  it('breaks down per facet, biggest first', () => {
    const rows = [row({ score: 5, ownerName: 'Priya' }), row({ score: 1, ownerName: 'Priya' }), row({ score: 4, ownerId: 'eng-2', ownerName: 'Arun' })]
    const lines = facetLines(rows, DEFAULT_CSAT, (r) => ({ key: r.ownerId, label: r.ownerName }))
    expect(lines.map((l) => l.label)).toEqual(['Priya', 'Arun'])
    expect(lines[0]).toMatchObject({ responses: 2, average: 3, csat: 50, unhappy: 1 })
  })
})

describe('follow-up clock', () => {
  it('runs on business hours from the rating until the manager closes it', () => {
    // Rated Tuesday 09:00 IST; now 12:00: 180 working minutes of a 240 target.
    const open = readFollowUp({ followUp: 'pending', respondedAt: '2026-10-13T03:30:00Z', followUpAt: null }, DEFAULT_CSAT, DEFAULT_HOURS, now)
    expect(open.state).toBe('open')
    expect(open.minutes).toBe(180)
    expect(open.left).toBe(60)
    // Rated Monday 09:00 IST: a full working day and more has passed.
    expect(readFollowUp({ followUp: 'pending', respondedAt: '2026-10-12T03:30:00Z', followUpAt: null }, DEFAULT_CSAT, DEFAULT_HOURS, now).state).toBe('overdue')
    expect(readFollowUp({ followUp: 'done', respondedAt: '2026-10-13T03:30:00Z', followUpAt: '2026-10-13T05:30:00Z' }, DEFAULT_CSAT, DEFAULT_HOURS, now)).toMatchObject({ state: 'within', minutes: 120 })
    expect(readFollowUp({ followUp: 'done', respondedAt: '2026-10-12T03:30:00Z', followUpAt: '2026-10-13T05:30:00Z' }, DEFAULT_CSAT, DEFAULT_HOURS, now).state).toBe('late')
    expect(readFollowUp({ followUp: 'none', respondedAt: '2026-10-13T03:30:00Z', followUpAt: null }, DEFAULT_CSAT, DEFAULT_HOURS, now).state).toBe('none')
  })
  it('feeds the summary: open, overdue, closed within target', () => {
    const rows = [
      row({ score: 2, followUp: 'pending', respondedAt: hoursAgo(1) }),
      row({ score: 1, followUp: 'in-progress', respondedAt: daysAgo(3) }),
      row({ score: 2, followUp: 'done', respondedAt: '2026-10-13T03:30:00Z', followUpAt: '2026-10-13T04:30:00Z' }),
    ]
    const s = summarise(rows, DEFAULT_CSAT, DEFAULT_HOURS, now)
    expect(s.followUpsOpen).toBe(2)
    expect(s.followUpsOverdue).toBe(1)
    expect(s.followUpsClosed).toBe(1)
    expect(s.followUpsWithin).toBe(1)
    expect(s.followUpPct).toBe(100)
  })
})

describe('care band', () => {
  const r = (score: CsatScore, days: number, followUp: CsatRow['followUp'] = 'none') => ({ score, respondedAt: daysAgo(days), followUp, ticket: `CS-${days}` })
  it('is high after a low last score or an open follow-up, watch after an older low score, good when satisfied', () => {
    expect(careFrom([], null, DEFAULT_CSAT, now).level).toBe('none')
    expect(careFrom([r(5, 1)], null, DEFAULT_CSAT, now)).toMatchObject({ level: 'good', lastScore: 5, n: 1 })
    expect(careFrom([r(2, 1), r(5, 10)], null, DEFAULT_CSAT, now)).toMatchObject({ level: 'high', lastScore: 2 })
    const c = careFrom([r(5, 1), r(1, 20)], null, DEFAULT_CSAT, now)
    expect(c.level).toBe('watch')
    expect(c.reason).toContain('CS-20')
    expect(careFrom([r(5, 1), r(1, 20, 'pending')], null, DEFAULT_CSAT, now).level).toBe('high')
    expect(careFrom([r(3, 1), r(3, 2), r(3, 3)], null, DEFAULT_CSAT, now)).toMatchObject({ level: 'watch', average: 3 })
    expect(careFrom([r(3, 1), r(2, 2), r(3, 3), r(5, 4)], null, DEFAULT_CSAT, now).level).toBe('high') // average of the latest three is 2.7
  })
  it('only looks at the window and the latest few ratings', () => {
    expect(careFrom([r(5, 1), r(1, 200)], null, DEFAULT_CSAT, now).level).toBe('good')
    expect(careFrom([r(5, 1), r(5, 2), r(5, 3), r(1, 4)], null, DEFAULT_CSAT, now).level).toBe('good')
    const two = careFrom([r(5, 1), r(5, 2), r(1, 3)], null, { ...DEFAULT_CSAT, careRecent: 2 }, now)
    expect(two).toMatchObject({ level: 'good', n: 2, total: 3 }) // the low score is older than the latest two
  })
  it('a manager flag wins, until it expires', () => {
    const flag: CareFlag = { id: 'f', customerId: 'cust-1', customerName: 'Acme', level: 'watch', reason: 'Escalated to the CEO', setBy: 'Navin', setById: 'u', setAt: daysAgo(1), until: null, active: true }
    expect(careFrom([r(5, 1)], flag, DEFAULT_CSAT, now)).toMatchObject({ level: 'watch', reason: 'Flagged by Navin: Escalated to the CEO' })
    expect(careFrom([r(5, 1)], { ...flag, until: daysAgo(1) }, DEFAULT_CSAT, now).level).toBe('good')
    expect(careFrom([r(5, 1)], { ...flag, active: false }, DEFAULT_CSAT, now).level).toBe('good')
    expect(flagActive({ ...flag, until: hoursAgo(-24) }, now)).toBe(true)
  })
})

describe('settings', () => {
  it('normalises the CSAT block and keeps unhappy below satisfied', () => {
    expect(normaliseCsat(null)).toBe(DEFAULT_CSAT)
    const c = normaliseCsat({ satisfiedFrom: 3, unhappyAtOrBelow: 4, inviteMode: 'all', reminderAfterHours: 0, surveyDays: 400, followUpMinutes: 5, careRecent: 99 })
    expect(c.satisfiedFrom).toBe(3)
    expect(c.unhappyAtOrBelow).toBe(2)
    expect(c.inviteMode).toBe('all')
    expect(c.reminderAfterHours).toBeNull()
    expect(c.surveyDays).toBe(90)
    expect(c.followUpMinutes).toBe(15)
    expect(c.careRecent).toBe(10)
    expect(normaliseCsat({ inviteMode: 'bogus' }).inviteMode).toBe('portal')
  })
  it('adds the CSAT cards to settings saved before they existed', () => {
    const s = normaliseSettings({ kpis: [{ key: 'fcr', enabled: true, target: 80 }] })
    expect(s.kpis[0]).toEqual({ key: 'fcr', enabled: true, target: 80 })
    expect(s.kpis.length).toBe(KPI_DEFS.length)
    expect(s.kpis.find((k) => k.key === 'csat')).toEqual({ key: 'csat', enabled: true, target: 85 })
    expect(s.csat).toEqual(DEFAULT_CSAT)
    expect(DEFAULT_SETTINGS.csat).toBe(DEFAULT_CSAT)
  })
})

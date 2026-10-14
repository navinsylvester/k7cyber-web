import { describe, expect, it } from 'vitest'

import { areaCounts, asReason, careFrom, causeBuckets, causeLines, causeOf, DEFAULT_CSAT, emptyDistribution, facetLines, flagActive, normaliseCsat, productLines, readFollowUp, REASONS, repeatCustomers, summarise, unhappyRows, type CareFlag, type CsatRow, type CsatScore } from '@/lib/support/csat-model'
import { productFamily } from '@/lib/support/reference'
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
  customerReason: '',
  reason: '',
  reasonBy: '',
  reasonAt: null,
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

describe('why they are unhappy', () => {
  it('has every reason under one of the four areas and rejects anything else', () => {
    expect(new Set(REASONS.map((r) => r.area))).toEqual(new Set(['product', 'support', 'commercial', 'other']))
    expect(new Set(REASONS.map((r) => r.key)).size).toBe(REASONS.length)
    expect(asReason('support-slow')).toBe('support-slow')
    expect(asReason('made-up')).toBe('')
    expect(asReason(null)).toBe('')
  })
  it("the desk's call wins over the customer's pick, which wins over nothing", () => {
    expect(causeOf({ reason: '', customerReason: '', reasonBy: '' })).toMatchObject({ key: '', area: '', by: '' })
    expect(causeOf({ reason: '', customerReason: 'product-defect', reasonBy: '' })).toMatchObject({ key: 'product-defect', area: 'product', by: 'customer' })
    expect(causeOf({ reason: 'support-long', customerReason: 'product-defect', reasonBy: 'Meera' })).toMatchObject({ key: 'support-long', area: 'support', by: 'desk', who: 'Meera' })
    expect(causeOf({ reason: 'bogus', customerReason: 'bogus', reasonBy: '' }).key).toBe('')
  })
  it('counts low scores per area and ranks the reasons, with the previous period beside', () => {
    const rows = [
      row({ score: 1, reason: 'support-slow' }),
      row({ score: 2, reason: 'support-slow' }),
      row({ score: 2, customerReason: 'product-install' }),
      row({ score: 1, reason: 'licence-billing', customerReason: 'other' }),
      row({ score: 2 }),
      row({ score: 5, reason: 'support-slow' }), // not low: never counted
      row({ status: 'invited', score: null, respondedAt: null }),
    ]
    expect(unhappyRows(rows, DEFAULT_CSAT)).toHaveLength(5)
    expect(areaCounts(rows, DEFAULT_CSAT)).toEqual({ product: 1, support: 2, commercial: 1, other: 0, none: 1 })
    const prev = [row({ score: 1, reason: 'product-defect' }), row({ score: 2, reason: 'support-slow' })]
    const lines = causeLines(rows, DEFAULT_CSAT, prev)
    expect(lines[0]).toMatchObject({ key: 'support-slow', area: 'support', n: 2, share: 40, prev: 1 })
    expect(lines.find((l) => l.key === '')).toMatchObject({ label: 'Not classified yet', n: 1 })
    expect(lines.find((l) => l.key === 'product-defect')).toMatchObject({ n: 0, prev: 1 }) // gone this period, still listed
    expect(causeLines(rows, DEFAULT_CSAT).every((l) => l.prev === null)).toBe(true)
  })
  it('ranks products by low scores, folding SKUs to their family', () => {
    const rows = [
      row({ score: 1, product: 'K7 Total Security - 5U3Y', reason: 'product-defect' }),
      row({ score: 2, product: 'K7 Total Security - 1U1Y', reason: 'support-slow' }),
      row({ score: 5, product: 'K7 Total Security - 1U1Y' }),
      row({ score: 2, product: '', customerReason: 'licence-billing' }),
      row({ score: 4, product: 'K7 Antivirus Premium - 3U1Y' }),
    ]
    const lines = productLines(rows, DEFAULT_CSAT, productFamily)
    expect(lines.map((l) => l.label)).toEqual(['K7 Total Security', 'No product on the case', 'K7 Antivirus Premium'])
    expect(lines[0]).toMatchObject({ responses: 3, low: 2, lowShare: 66.7, csat: 33.3 })
    expect(lines[0]!.areas).toEqual({ product: 1, support: 1, commercial: 0, other: 0, none: 0 })
    expect(lines[2]).toMatchObject({ responses: 1, low: 0, csat: 100 })
  })
  it('finds the customers who rated low more than once, newest last rating first', () => {
    const rows = [
      row({ score: 1, customerId: 'acme', customerName: 'Acme', respondedAt: daysAgo(30), reason: 'support-unresolved', product: 'K7 Endpoint Security' }),
      row({ score: 2, customerId: 'acme', customerName: 'Acme', respondedAt: daysAgo(3), followUp: 'pending', product: 'K7 Endpoint Security' }),
      row({ score: 5, customerId: 'acme', customerName: 'Acme', respondedAt: daysAgo(10) }),
      row({ score: 1, customerId: 'beta', customerName: 'Beta', respondedAt: daysAgo(5) }),
      row({ score: 2, customerId: '', contactId: 'c-1', customerName: 'Solo', respondedAt: daysAgo(6) }),
      row({ score: 1, customerId: '', contactId: 'c-1', customerName: 'Solo', respondedAt: daysAgo(1) }),
    ]
    const reps = repeatCustomers(rows, DEFAULT_CSAT)
    expect(reps.map((c) => c.customerName)).toEqual(['Solo', 'Acme'])
    const acme = reps.find((c) => c.customerName === 'Acme')!
    expect(acme).toMatchObject({ low: 2, total: 3, openFollowUp: true, products: ['K7 Endpoint Security'] })
    expect(acme.last.respondedAt).toBe(daysAgo(3))
    expect(acme.areas).toEqual({ product: 0, support: 1, commercial: 0, other: 0, none: 1 })
  })
  it('buckets low scores by week, oldest first, each with its area split', () => {
    const to = now
    const from = new Date(now.getTime() - 21 * 864e5)
    const rows = [
      row({ score: 1, respondedAt: daysAgo(1), reason: 'product-defect' }),
      row({ score: 2, respondedAt: daysAgo(6), customerReason: 'support-slow' }),
      row({ score: 2, respondedAt: daysAgo(8) }),
      row({ score: 4, respondedAt: daysAgo(8) }),
      row({ score: 1, respondedAt: daysAgo(40), reason: 'other' }), // outside
    ]
    const b = causeBuckets(rows, DEFAULT_CSAT, from, to, 7)
    expect(b).toHaveLength(3)
    expect(b[0]!.from.getTime()).toBe(from.getTime())
    expect(b.map((x) => x.low)).toEqual([0, 1, 2])
    expect(b.map((x) => x.responses)).toEqual([0, 2, 2])
    expect(b[2]!.areas).toEqual({ product: 1, support: 1, commercial: 0, other: 0, none: 0 })
    expect(b[1]!.areas.none).toBe(1)
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

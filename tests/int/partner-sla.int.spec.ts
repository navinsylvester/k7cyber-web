import { describe, expect, it } from 'vitest'

import { EMPTY_SNAPSHOT, type Deal } from '@/lib/partner/deals-model'
import type { Application } from '@/lib/partner/registration-model'
import { normalisePartnerSettings } from '@/lib/partner/settings-model'
import { applicationClock, applicationDecisionMinutes, dealClock, dealDecisionMinutes, DEFAULT_SLA_SETTINGS, hoursText, readClock, slaText, workingText, type SlaSettings } from '@/lib/partner/sla-model'

/* The approval SLA without a tenant (FR-NTF-01 "Approval SLA breached", M8): when a clock starts and restarts, the reading
   in working hours (09:00–18:00 Mon–Sat IST by default), the states, the words, the decision times for the report, and the
   settings as the global stores them. */

const SLA: SlaSettings = DEFAULT_SLA_SETTINGS
const T = (s: string) => new Date(s)

const deal = (o: Partial<Deal>): Deal =>
  ({
    id: '1',
    dealId: 'K7D-00001',
    status: 'submitted',
    orgId: '9',
    orgPartnerId: 'K7P-00009',
    orgName: 'Ex',
    orgType: 'var',
    registeredBy: { id: '', name: '', email: '' },
    reseller: { name: '', orgId: '', orgPartnerId: '' },
    customer: { name: 'ACME', industry: '', city: '', state: '', contact: '', designation: '', email: '', emailDomain: '', phone: '' },
    customerKey: 'acme',
    emailDomain: '',
    products: [],
    expectedValue: 100,
    closeDate: '2027-01-01',
    source: '',
    competitor: '',
    notes: '',
    thread: [],
    submittedAt: null,
    decidedAt: null,
    protectionEnds: null,
    endingNoticeAt: null,
    extension: { requestedAt: null, requestedBy: '', reason: '', decidedAt: null, decidedBy: '', granted: false, note: '' },
    conflicts: [],
    crm: { opportunityId: '', opportunityNo: '', customerAccountId: '', customerContactId: '', noteId: '', snapshot: EMPTY_SNAPSHOT },
    createdAt: '',
    updatedAt: '',
    ...o,
  }) as Deal

const entry = (to: string, at: string, kind: 'submitted' | 'decision' | 'extension' = to === 'submitted' ? 'submitted' : 'decision'): Deal['thread'][number] => ({ kind, side: 'partner', byName: '', byEmail: '', at, to, title: '', text: '', files: [] }) as unknown as Deal['thread'][number]

describe('the clock', () => {
  it('starts at the latest submission and restarts after a request for information', () => {
    const first = '2026-10-19T04:30:00.000Z' // Mon 10:00 IST
    const d = deal({ submittedAt: first, thread: [entry('submitted', first)] })
    expect(dealClock(d)?.startedAt).toBe(first)
    const again = '2026-10-21T04:30:00.000Z'
    const d2 = deal({ submittedAt: first, thread: [entry('submitted', first), entry('infoRequested', '2026-10-19T09:00:00.000Z'), entry('submitted', again)] })
    expect(dealClock(d2)?.startedAt).toBe(again)
    expect(dealClock(deal({ status: 'approved', submittedAt: first }))).toBeNull()
    expect(dealClock(deal({ status: 'infoRequested', submittedAt: first }))).toBeNull()
  })

  it('runs from the request while an extension waits', () => {
    const d = deal({ status: 'extensionRequested', submittedAt: '2026-09-01T04:30:00.000Z', extension: { requestedAt: '2026-10-20T04:30:00.000Z', requestedBy: 'x', reason: 'r', decidedAt: null, decidedBy: '', granted: false, note: '' } })
    expect(dealClock(d)).toMatchObject({ kind: 'deal', startedAt: '2026-10-20T04:30:00.000Z', href: '/partners/portal/k7/deals/K7D-00001' })
  })

  it('counts an application from its latest submission, through assignment, not while it waits on the applicant', () => {
    const a = { id: '2', number: 'K7A-00002', status: 'underReview', company: { legalName: 'Ex Ltd' }, submittedAt: '2026-10-19T04:30:00.000Z', createdAt: '2026-10-18T00:00:00.000Z', decisions: [{ to: 'submitted', at: '2026-10-19T04:30:00.000Z' }, { to: 'underReview', at: '2026-10-19T06:00:00.000Z' }] } as unknown as Application
    expect(applicationClock(a)).toMatchObject({ kind: 'application', startedAt: '2026-10-19T04:30:00.000Z', label: 'K7A-00002 · Ex Ltd' })
    expect(applicationClock({ ...a, status: 'clarification' } as Application)).toBeNull()
    expect(applicationClock({ ...a, status: 'approved' } as Application)).toBeNull()
  })
})

describe('the reading', () => {
  it('counts working hours only: 48 h from Friday noon falls on the Wednesday after', () => {
    // Fri 2026-10-23 12:00 IST = 06:30Z. 6 h left Fri, 9 Sat, Sunday off, 9 Mon, 9 Tue → 33; 15 more on Wed → 09:00 + 15 h? no: Wed 09:00 + (48-33=15 h) exceeds the day; Thu 09:00 + 6 h = 15:00.
    const r = readClock('2026-10-23T06:30:00.000Z', 48, SLA, T('2026-10-23T07:30:00.000Z'))
    expect(r.dueAt).toBe('2026-10-29T09:30:00.000Z') // Thu 15:00 IST
    expect(r.elapsedMinutes).toBe(60)
    expect(r.state).toBe('ok')
  })

  it('goes at risk at the warning share and breaches past the target; Sunday adds nothing', () => {
    const start = '2026-10-23T06:30:00.000Z' // Fri 12:00 IST
    expect(readClock(start, 8, SLA, T('2026-10-23T12:31:00.000Z')).state).toBe('at-risk') // 6 h of 8 h = 75 %
    // Saturday works (9 h), Sunday does not: Sat close and Sun afternoon read the same 15 h.
    expect(readClock(start, 24, SLA, T('2026-10-24T12:30:00.000Z')).elapsedMinutes).toBe(15 * 60)
    expect(readClock(start, 24, SLA, T('2026-10-25T10:00:00.000Z'))).toMatchObject({ elapsedMinutes: 15 * 60, state: 'ok' })
    const b = readClock(start, 16, SLA, T('2026-10-26T06:00:00.000Z')) // Mon 11:30 IST: 15 h + 2.5 h
    expect(b.state).toBe('breached')
    expect(b.leftMinutes).toBe(-90)
    expect(slaText(b, SLA)).toBe('overdue by 2 h')
    expect(slaText(readClock(start, 48, SLA, T('2026-10-23T07:30:00.000Z')), SLA)).toBe('due in 5 d 2 h') // 47 working hours on a 9-hour day
  })

  it('runs around the clock when the mode says so', () => {
    const always: SlaSettings = { ...SLA, hours: { ...SLA.hours, mode: 'always' } }
    const r = readClock('2026-10-24T18:00:00.000Z', 24, always, T('2026-10-25T18:30:00.000Z')) // Sat evening → Sun evening
    expect(r.state).toBe('breached')
    expect(r.elapsedMinutes).toBe(24 * 60 + 30)
  })

  it('writes working time in days of the working day', () => {
    expect(workingText(45, SLA)).toBe('45 min')
    expect(workingText(6 * 60, SLA)).toBe('6 h')
    expect(workingText(9 * 60 + 120, SLA)).toBe('1 d 2 h')
    expect(workingText(18 * 60, SLA)).toBe('2 d')
    expect(hoursText(SLA.hours)).toBe('09:00–18:00 Mon Tue Wed Thu Fri Sat (Asia/Kolkata)')
  })
})

describe('decision times and the settings', () => {
  it('measures a decision from the submission that led to it', () => {
    const d = deal({ status: 'approved', decidedAt: '2026-10-21T06:30:00.000Z', thread: [entry('submitted', '2026-10-19T04:30:00.000Z'), entry('infoRequested', '2026-10-19T06:30:00.000Z'), entry('submitted', '2026-10-21T04:30:00.000Z'), entry('approved', '2026-10-21T06:30:00.000Z')] })
    expect(dealDecisionMinutes(d, SLA)).toBe(120)
    expect(dealDecisionMinutes(deal({ status: 'submitted', thread: [entry('submitted', '2026-10-19T04:30:00.000Z')] }), SLA)).toBeNull()
    const a = { decisions: [{ to: 'submitted', at: '2026-10-19T04:30:00.000Z' }, { to: 'underReview', at: '2026-10-19T05:00:00.000Z' }, { to: 'approved', at: '2026-10-19T07:30:00.000Z' }] } as unknown as Application
    expect(applicationDecisionMinutes(a, SLA)).toBe(180)
  })

  it('reads the SLA tab of the global: days as strings, addresses as rows, bad hours back to the defaults', () => {
    const s = normalisePartnerSettings({ sla: { mode: 'business', start: '10:00', end: '19:00', days: ['1', '2', '3', '4', '5'], timeZone: 'Asia/Kolkata', warnShare: 0.5, escalateTo: [{ email: 'Head@K7computing.com' }, { email: 'nope' }] } })
    expect(s.sla).toEqual({ hours: { mode: 'business', start: '10:00', end: '19:00', days: [1, 2, 3, 4, 5], timeZone: 'Asia/Kolkata' }, warnShare: 0.5, escalateTo: ['head@k7computing.com'] })
    expect(normalisePartnerSettings({ sla: { start: '25', warnShare: 2, days: [] } }).sla).toEqual(DEFAULT_SLA_SETTINGS)
    expect(normalisePartnerSettings({}).notify.signature).toBe('K7 Partner Programme\nK7 Computing Pvt Ltd')
    const staff = normalisePartnerSettings({ staff: [{ email: 'a@k7computing.com', roles: ['channelManager'], manager: 'Boss@K7computing.com' }] }).staff
    expect(staff[0]?.manager).toBe('boss@k7computing.com')
  })
})

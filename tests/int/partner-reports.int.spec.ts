import { describe, expect, it } from 'vitest'

import { periodBounds } from '@/lib/partner/dashboard-model'
import { EMPTY_SNAPSHOT, type Deal } from '@/lib/partner/deals-model'
import type { Application } from '@/lib/partner/registration-model'
import { applicationsByState, applicationsCsv, benefitOf, median, percentile, pipelineByPartner, pipelineTotals, PIPELINE_COLUMNS, schemeResults, slaReport, toCsv, type SlaQueueRow } from '@/lib/partner/reports-model'
import type { EligibilityResult, Registration, Scheme } from '@/lib/partner/schemes-model'
import { DEFAULT_SLA_SETTINGS } from '@/lib/partner/sla-model'

/* The K7 reports without a tenant (M8): the pipeline by partner from the CRM snapshots, applications by state and type,
   the schemes' benefit and payout sums, the SLA report's maths, and the CSV shape. */

const NOW = new Date('2026-10-23T09:00:00.000Z')
const SLA = DEFAULT_SLA_SETTINGS

const deal = (o: Partial<Deal> & { won?: boolean; lost?: boolean; actual?: number }): Deal => {
  const snapshot = o.won ? { ...EMPTY_SNAPSHOT, syncedAt: '2026-10-01T00:00:00.000Z', statecode: 1, actualValue: o.actual ?? null } : o.lost ? { ...EMPTY_SNAPSHOT, syncedAt: '2026-10-01T00:00:00.000Z', statecode: 2 } : EMPTY_SNAPSHOT
  return {
    id: o.id ?? '1',
    dealId: o.dealId ?? 'K7D-00001',
    status: o.status ?? 'approved',
    orgId: o.orgId ?? 'A',
    orgPartnerId: o.orgPartnerId ?? 'K7P-A',
    orgName: o.orgName ?? 'Alpha',
    orgType: o.orgType ?? 'var',
    registeredBy: { id: '', name: '', email: '' },
    reseller: { name: '', orgId: '', orgPartnerId: '' },
    customer: { name: 'C', industry: '', city: '', state: '', contact: '', designation: '', email: '', emailDomain: '', phone: '' },
    customerKey: 'c',
    emailDomain: '',
    products: [],
    expectedValue: o.expectedValue ?? 100000,
    closeDate: '2027-01-01',
    source: '',
    competitor: '',
    notes: '',
    thread: o.thread ?? [],
    submittedAt: o.submittedAt ?? '2026-10-10T04:30:00.000Z',
    decidedAt: o.decidedAt ?? null,
    protectionEnds: null,
    endingNoticeAt: null,
    extension: { requestedAt: null, requestedBy: '', reason: '', decidedAt: null, decidedBy: '', granted: false, note: '' },
    conflicts: [],
    crm: { opportunityId: o.won || o.lost ? 'x' : '', opportunityNo: '', customerAccountId: '', customerContactId: '', noteId: '', snapshot },
    createdAt: '',
    updatedAt: '',
  } as unknown as Deal
}

describe('pipeline by partner', () => {
  const deals = [
    deal({ id: '1', dealId: 'K7D-1', won: true, actual: 700000 }),
    deal({ id: '2', dealId: 'K7D-2', expectedValue: 300000 }), // approved, snapshot empty → not yet in CRM → open
    deal({ id: '3', dealId: 'K7D-3', lost: true }),
    deal({ id: '4', dealId: 'K7D-4', orgId: 'B', orgPartnerId: 'K7P-B', orgName: 'Beta', orgType: 'distributor', status: 'submitted', expectedValue: 50000 }),
    deal({ id: '5', dealId: 'K7D-5', orgId: 'B', orgPartnerId: 'K7P-B', orgName: 'Beta', orgType: 'distributor', submittedAt: '2024-01-01T00:00:00.000Z', won: true, actual: 100 }),
  ]

  it('sums each organisation from the CRM’s word and sorts by won value', () => {
    const rows = pipelineByPartner(deals)
    expect(rows.map((r) => r.partner)).toEqual(['Alpha', 'Beta'])
    expect(rows[0]).toMatchObject({ partnerId: 'K7P-A', type: 'Value Added Reseller', deals: 3, open: 1, won: 1, lost: 1, pipelineValue: 300000, wonValue: 700000, winRate: 50 })
    expect(rows[1]).toMatchObject({ deals: 2, open: 1, won: 1, lost: 0, pipelineValue: 50000, wonValue: 100, winRate: 100 })
    const t = pipelineTotals(rows)
    expect(t).toMatchObject({ deals: 5, open: 2, won: 2, lost: 1, pipelineValue: 350000, wonValue: 700100, winRate: 66.7 })
  })

  it('keeps to the period on the registration date', () => {
    const rows = pipelineByPartner(deals, periodBounds('fy', NOW))
    expect(rows.find((r) => r.partner === 'Beta')?.deals).toBe(1)
    expect(pipelineByPartner([], periodBounds('month', NOW))).toEqual([])
  })

  it('writes the CSV with a header, quoted commas and a totals row', () => {
    const rows = pipelineByPartner([deal({ orgName: 'Alpha, Inc "A"', won: true, actual: 10 })])
    const csv = toCsv(PIPELINE_COLUMNS, [...rows, pipelineTotals(rows)])
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('Partner ID,Partner,Type,Deals,Open,Won,Lost,Pipeline value (INR),Won value (INR),Win rate (%)')
    expect(lines[1]).toBe('K7P-A,"Alpha, Inc ""A""",Value Added Reseller,1,0,1,0,0,10,100')
    expect(lines[2]).toMatch(/^,Every partner,,1,0,1,0,0,10,100$/)
    expect(csv.endsWith('\r\n')).toBe(true)
  })
})

describe('applications by state', () => {
  const app = (status: string, type: string, submittedAt: string, decisions: { to: string; at: string }[] = []): Application => ({ id: '', number: '', status, type, company: { legalName: 'x' }, contact: {}, regions: [], terms: {}, assignee: {}, decisions, resumeKey: '', orgId: '', submittedAt, decidedAt: null, createdAt: submittedAt, updatedAt: '' }) as unknown as Application
  const apps = [
    app('submitted', 'var', '2026-10-20T04:30:00.000Z'),
    app('approved', 'var', '2026-10-19T04:30:00.000Z', [{ to: 'submitted', at: '2026-10-19T04:30:00.000Z' }, { to: 'approved', at: '2026-10-19T06:30:00.000Z' }]),
    app('approved', 'distributor', '2026-10-12T04:30:00.000Z', [{ to: 'submitted', at: '2026-10-12T04:30:00.000Z' }, { to: 'approved', at: '2026-10-16T04:30:00.000Z' }]), // 4 working days = 36 h
    app('rejected', 'var', '2024-01-01T00:00:00.000Z', [{ to: 'submitted', at: '2024-01-01T00:00:00.000Z' }, { to: 'rejected', at: '2024-01-02T00:00:00.000Z' }]),
    app('draft', 'var', '2026-10-21T00:00:00.000Z'),
  ]

  it('counts by state and type in the period, with the decision time against the target', () => {
    const r = applicationsByState(apps, SLA, 48, periodBounds('fy', NOW))
    expect(r.total).toBe(3)
    expect(r.types).toEqual(['Distributor', 'Value Added Reseller'])
    expect(r.rows.find((x) => x.status === 'approved')).toMatchObject({ total: 2, byType: { Distributor: 1, 'Value Added Reseller': 1 } })
    expect(r.rows.find((x) => x.status === 'submitted')?.total).toBe(1)
    expect(r.rows.some((x) => x.status === 'rejected')).toBe(false)
    expect(r.decided).toBe(2)
    expect(r.medianDecisionMinutes).toBe(Math.round((120 + 36 * 60) / 2))
    expect(r.withinTarget).toBe(100)
    const csv = applicationsCsv(r).split('\r\n')
    expect(csv[0]).toBe('State,Applications,Distributor,Value Added Reseller')
    expect(csv.find((l) => l.startsWith('Approved'))).toBe('Approved,2,1,1')
  })
})

describe('scheme results', () => {
  const sc = { id: 's1', name: 'Q2', status: 'published', startDate: '2026-04-01', endDate: '2026-06-30', registrationDeadline: '2026-04-15', slabs: [{ threshold: 500000, benefit: '2%', amount: 10000 }, { threshold: 1000000, benefit: '4%', amount: 40000 }], results: { computedAt: '2026-07-01', publishedAt: '2026-07-02T00:00:00.000Z', computedBy: '', publishedBy: '' } } as unknown as Scheme
  const regs = [{ schemeId: 's1', status: 'approved' }, { schemeId: 's1', status: 'approved' }, { schemeId: 's1', status: 'pending' }, { schemeId: 'other', status: 'approved' }] as Registration[]
  const res = [
    { schemeId: 's1', eligible: true, slabIndex: 1, payout: { status: 'paid' }, dispute: { status: 'none' } },
    { schemeId: 's1', eligible: true, slabIndex: 0, payout: { status: 'pending' }, dispute: { status: 'open' } },
    { schemeId: 's1', eligible: false, slabIndex: -1, payout: { status: 'pending' }, dispute: { status: 'none' } },
  ] as EligibilityResult[]

  it('sums the benefit due and paid per scheme and leaves drafts out', () => {
    const rows = schemeResults([sc, { ...sc, id: 'd', status: 'draft' } as Scheme], regs, res, NOW)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ scheme: 'Q2', phase: 'Closed', registered: 2, pending: 1, results: 3, eligible: 2, benefitDue: 50000, paid: 1, paidAmount: 40000, disputesOpen: 1, published: '2026-07-02' })
    expect(benefitOf(sc, { eligible: false, slabIndex: 1 })).toBe(0)
  })
})

describe('the SLA report', () => {
  it('counts the queue and the decision times of the period', () => {
    const queue: SlaQueueRow[] = [
      { kind: 'deal', number: 'K7D-1', label: 'K7D-1 · C', partner: 'A', startedAt: '', dueAt: '', state: 'breached', leftMinutes: -120, href: '' },
      { kind: 'application', number: 'K7A-1', label: 'K7A-1 · X', partner: 'X', startedAt: '', dueAt: '', state: 'ok', leftMinutes: 600, href: '' },
      { kind: 'deal', number: 'K7D-2', label: 'K7D-2 · D', partner: 'B', startedAt: '', dueAt: '', state: 'at-risk', leftMinutes: 60, href: '' },
    ]
    const decided = [
      deal({ status: 'approved', decidedAt: '2026-10-19T06:30:00.000Z', thread: [{ kind: 'submitted', side: 'partner', byName: '', byEmail: '', at: '2026-10-19T04:30:00.000Z', to: 'submitted', title: '', text: '', files: [] }, { kind: 'decision', side: 'k7', byName: '', byEmail: '', at: '2026-10-19T06:30:00.000Z', to: 'approved', title: '', text: '', files: [] }] }),
      deal({ status: 'rejected', decidedAt: '2026-10-26T06:30:00.000Z', thread: [{ kind: 'submitted', side: 'partner', byName: '', byEmail: '', at: '2026-10-19T04:30:00.000Z', to: 'submitted', title: '', text: '', files: [] }, { kind: 'decision', side: 'k7', byName: '', byEmail: '', at: '2026-10-26T06:30:00.000Z', to: 'rejected', title: '', text: '', files: [] }] }), // Mon 10:00 → next Mon 12:00 IST: 8 + 5 × 9 + 3 = 56 working hours
    ]
    const r = slaReport(queue, decided, [], SLA, 48)
    expect(r).toMatchObject({ open: 3, atRisk: 1, breached: 1, decided: 2, targetMinutes: 2880, withinTarget: 50 })
    expect(r.queue.map((q) => q.number)).toEqual(['K7D-1', 'K7D-2', 'K7A-1'])
    expect(r.medianMinutes).toBe(Math.round((120 + 56 * 60) / 2))
    expect(r.p90Minutes).toBe(56 * 60)
    expect(median([])).toBeNull()
    expect(median([3, 1, 2])).toBe(2)
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90)).toBe(9)
  })
})

import { describe, expect, it } from 'vitest'

import { dealOutcome, inPeriod, isOpenOutcome, missingSnapshot, orderValue, periodBounds, pipelineByStage, pipelineValue, portalDisagreements, shortInr, snapshotChanges, snapshotFromRow, stageText, summarise, SYNC_SELECT, syncDue, valueByMonth, valueByProduct } from '@/lib/partner/dashboard-model'
import { EMPTY_SNAPSHOT, toDeal, toSnapshot, type Deal, type Snapshot } from '@/lib/partner/deals-model'

/* The deal dashboard without a tenant (docs/partner-portal/04-portal-guide.md M5): the mapping of a Dynamics opportunity row onto
   the snapshot, the outcome the partner reads, the reconciliation diff (FR-DASH-11), the period on the Indian financial year, the
   cards (FR-DASH-01) and the three charts (FR-DASH-08). */

const FV = '@OData.Community.Display.V1.FormattedValue'
const row = (o: Record<string, unknown> = {}) => ({
  opportunityid: 'aaaaaaaa-0000-0000-0000-000000000001',
  alletec_opportunityno: 'OPP-2610-00268',
  name: 'Acme-Fresh-Others',
  statecode: 0,
  [`statecode${FV}`]: 'Open',
  statuscode: 1,
  [`statuscode${FV}`]: 'In Progress',
  alletec_stage: 260760001,
  [`alletec_stage${FV}`]: 'Proposal',
  stepname: 'Proposal',
  estimatedvalue: 1200000,
  actualvalue: null,
  alletec_nvoiceamount: null,
  estimatedclosedate: '2027-01-21',
  actualclosedate: null,
  modifiedon: '2026-10-23T08:00:00Z',
  ...o,
})

const deal = (o: Partial<Deal> & { snapshot?: Partial<Snapshot> } = {}): Deal => {
  const { snapshot, ...rest } = o
  const base = toDeal({ id: '1', dealId: 'K7D-00030', status: 'approved', org: 7, orgPartnerId: 'K7P-00000', customerName: 'Acme', expectedValue: 1250000, closeDate: '2027-01-21', submittedAt: '2026-10-23T05:00:00.000Z', products: [{ product: { id: 1, name: 'EPS' }, sku: 'EPS-1', quantity: 100 }], crm: { opportunityId: 'aaaaaaaa-0000-0000-0000-000000000001', opportunityNo: 'OPP-2610-00268' } })
  return { ...base, ...rest, crm: { ...base.crm, ...(rest.crm ?? {}), snapshot: { ...EMPTY_SNAPSHOT, ...(snapshot ?? {}) } } }
}

describe('the snapshot from a CRM row', () => {
  it('maps the sync select onto the deal', () => {
    const sn = snapshotFromRow(row(), '2026-10-23T09:00:00.000Z')
    expect(sn.syncedAt).toBe('2026-10-23T09:00:00.000Z')
    expect(sn.statecode).toBe(0)
    expect(sn.statusLabel).toBe('In Progress')
    expect(sn.stage).toBe(260760001)
    expect(sn.stageLabel).toBe('Proposal')
    expect(sn.estimatedValue).toBe(1200000)
    expect(sn.actualValue).toBeNull()
    expect(sn.estimatedCloseDate).toBe('2027-01-21')
    expect(sn.error).toBe('')
    expect(SYNC_SELECT).toContain('alletec_nvoiceamount')
  })
  it('falls back to the known labels when the CRM sends none', () => {
    const sn = snapshotFromRow({ opportunityid: 'x', statecode: 1, statuscode: 3, alletec_stage: 260760005, estimatedvalue: '5000' }, 'now')
    expect(sn.statusLabel).toBe('Won')
    expect(sn.stageLabel).toBe('Closure')
    expect(sn.estimatedValue).toBe(5000)
  })
  it('keeps the last values and says so when the CRM no longer returns the row', () => {
    const prev = snapshotFromRow(row(), 't1')
    const sn = missingSnapshot(prev, 't2')
    expect(sn.stageLabel).toBe('Proposal')
    expect(sn.syncedAt).toBe('t2')
    expect(sn.error).toBe('Not found in the CRM')
  })
  it('reads a stored snapshot back with nulls where nothing was written', () => {
    expect(toSnapshot(null)).toEqual(EMPTY_SNAPSHOT)
    expect(toSnapshot({ statecode: 1, actualValue: 99, syncedAt: 't' }).actualValue).toBe(99)
    expect(toSnapshot({ statecode: 'x' }).statecode).toBeNull()
  })
})

describe('reconciliation (FR-DASH-11)', () => {
  it('names what changed between two reads, and nothing when nothing did', () => {
    const a = snapshotFromRow(row(), 't1')
    const b = snapshotFromRow(row({ statecode: 1, [`statecode${FV}`]: 'Won', statuscode: 3, [`statuscode${FV}`]: 'Won', alletec_stage: 260760005, [`alletec_stage${FV}`]: 'Closure', actualvalue: 1150000, actualclosedate: '2026-12-01' }), 't2')
    const ch = snapshotChanges(a, b)
    expect(ch.map((c) => c.field)).toEqual(['state', 'status', 'stage', 'actualValue', 'actualCloseDate'])
    expect(ch[0]).toEqual({ field: 'state', from: 'Open', to: 'Won' })
    expect(snapshotChanges(a, { ...a, syncedAt: 't3', modifiedOn: 'later' })).toEqual([])
  })
  it('the first read is a change from nothing', () => {
    expect(snapshotChanges(EMPTY_SNAPSHOT, snapshotFromRow(row(), 't')).length).toBeGreaterThan(0)
  })
  it('says where the CRM differs from the registration, the CRM winning', () => {
    const d = deal()
    expect(portalDisagreements(d, snapshotFromRow(row(), 't'))).toEqual(['value: portal ₹12,50,000, CRM ₹12,00,000'])
    expect(portalDisagreements(d, snapshotFromRow(row({ estimatedvalue: 1250000, estimatedclosedate: '2027-02-01' }), 't'))).toEqual(['closure: portal 2027-01-21, CRM 2027-02-01'])
    expect(portalDisagreements(d, snapshotFromRow(row({ estimatedvalue: 1250000 }), 't'))).toEqual([])
  })
  it('runs when due and not before', () => {
    const now = new Date('2026-10-23T10:00:00Z')
    expect(syncDue(null, 60, now)).toBe(true)
    expect(syncDue('2026-10-23T09:30:00Z', 60, now)).toBe(false)
    expect(syncDue('2026-10-23T09:00:00Z', 60, now)).toBe(true)
    expect(syncDue('2026-10-23T09:50:00Z', 5, now)).toBe(true)
  })
})

describe('the outcome and the values (FR-DASH-02)', () => {
  it('reads the CRM state first, the portal state before any snapshot', () => {
    expect(dealOutcome(deal({ status: 'submitted' }))).toBe('awaiting')
    expect(dealOutcome(deal({ status: 'infoRequested' }))).toBe('awaiting')
    expect(dealOutcome(deal({ status: 'approved' }))).toBe('notInCrm')
    expect(dealOutcome(deal({ status: 'rejected' }))).toBe('closed')
    expect(dealOutcome(deal({ snapshot: { statecode: 0, statuscode: 1 } }))).toBe('open')
    expect(dealOutcome(deal({ snapshot: { statecode: 0, statuscode: 2 } }))).toBe('onHold')
    expect(dealOutcome(deal({ snapshot: { statecode: 1 } }))).toBe('won')
    expect(dealOutcome(deal({ status: 'withdrawn', snapshot: { statecode: 2 } }))).toBe('lost')
    expect(isOpenOutcome('onHold')).toBe(true)
    expect(isOpenOutcome('won')).toBe(false)
  })
  it('counts the CRM estimate when there is one, the registration otherwise; the order value only once won', () => {
    expect(pipelineValue(deal())).toBe(1250000)
    expect(pipelineValue(deal({ snapshot: { estimatedValue: 1200000 } }))).toBe(1200000)
    expect(orderValue(deal({ snapshot: { statecode: 0 } }))).toBeNull()
    expect(orderValue(deal({ snapshot: { statecode: 1, actualValue: 1150000, invoiceAmount: 1100000 } }))).toBe(1150000)
    expect(orderValue(deal({ snapshot: { statecode: 1, actualValue: null, invoiceAmount: 1100000 } }))).toBe(1100000)
    expect(orderValue(deal({ snapshot: { statecode: 1 } }))).toBe(1250000)
  })
  it('names the stage from the CRM, or the portal state', () => {
    expect(stageText(deal({ snapshot: { statecode: 0, stage: 260760002, stageLabel: 'Negotiation' } }))).toBe('Negotiation')
    expect(stageText(deal({ status: 'submitted' }))).toBe('With K7')
    expect(stageText(deal({ status: 'approved' }))).toBe('Approved')
    expect(stageText(deal({ status: 'expired' }))).toBe('—')
  })
})

describe('the period on the financial year', () => {
  const now = new Date('2026-10-23T12:00:00Z')
  it('bounds month, quarter, FY and the last 12 months', () => {
    expect(periodBounds('month', now)).toEqual({ key: 'month', from: '2026-10-01', to: '2026-10-31' })
    expect(periodBounds('quarter', now)).toEqual({ key: 'quarter', from: '2026-10-01', to: '2026-12-31' })
    expect(periodBounds('fy', now)).toEqual({ key: 'fy', from: '2026-04-01', to: '2027-03-31' })
    expect(periodBounds('12m', now)).toEqual({ key: '12m', from: '2025-11-01', to: '2026-10-31' })
    expect(periodBounds('all', now)).toEqual({ key: 'all', from: null, to: null })
  })
  it('puts January and February in the earlier financial year and its last quarter', () => {
    const feb = new Date('2027-02-10T00:00:00Z')
    expect(periodBounds('fy', feb)).toEqual({ key: 'fy', from: '2026-04-01', to: '2027-03-31' })
    expect(periodBounds('quarter', feb)).toEqual({ key: 'quarter', from: '2027-01-01', to: '2027-03-31' })
  })
  it('filters by the registration date', () => {
    const p = periodBounds('fy', now)
    expect(inPeriod(deal({ submittedAt: '2026-04-01T00:00:00Z' }), p)).toBe(true)
    expect(inPeriod(deal({ submittedAt: '2026-03-31T23:00:00Z' }), p)).toBe(false)
    expect(inPeriod(deal({ submittedAt: null }), p)).toBe(false)
    expect(inPeriod(deal({ submittedAt: null }), periodBounds('all', now))).toBe(true)
  })
})

describe('the cards and the charts (FR-DASH-01, FR-DASH-08)', () => {
  const deals = [
    deal({ id: '1', dealId: 'K7D-1', status: 'submitted', expectedValue: 100000, submittedAt: '2026-08-05T00:00:00Z' }),
    deal({ id: '2', dealId: 'K7D-2', status: 'approved', expectedValue: 200000, submittedAt: '2026-09-05T00:00:00Z' }),
    deal({ id: '3', dealId: 'K7D-3', expectedValue: 300000, submittedAt: '2026-09-15T00:00:00Z', snapshot: { statecode: 0, statuscode: 1, stage: 260760001, stageLabel: 'Proposal', estimatedValue: 350000 } }),
    deal({ id: '4', dealId: 'K7D-4', expectedValue: 400000, submittedAt: '2026-10-01T00:00:00Z', snapshot: { statecode: 0, statuscode: 2, stage: 260760000, stageLabel: 'Pre Sales' } }),
    deal({ id: '5', dealId: 'K7D-5', expectedValue: 500000, submittedAt: '2026-10-02T00:00:00Z', snapshot: { statecode: 1, statuscode: 3, stage: 260760005, stageLabel: 'Closure', actualValue: 480000, actualCloseDate: '2026-10-20' } }),
    deal({ id: '6', dealId: 'K7D-6', expectedValue: 600000, submittedAt: '2026-10-03T00:00:00Z', snapshot: { statecode: 2, statuscode: 5, stage: 260760002, stageLabel: 'Negotiation' } }),
    deal({ id: '7', dealId: 'K7D-7', status: 'withdrawn', expectedValue: 700000, submittedAt: '2026-10-04T00:00:00Z' }),
  ]
  it('sums the cards for the period', () => {
    const sm = summarise(deals)
    expect(sm.total).toBe(7)
    expect(sm.open).toBe(4)
    expect(sm.won).toBe(1)
    expect(sm.lost).toBe(1)
    expect(sm.pipelineValue).toBe(100000 + 200000 + 350000 + 400000)
    expect(sm.wonValue).toBe(480000)
    expect(sm.winRate).toBe(50)
    expect(summarise([]).winRate).toBeNull()
  })
  it('counts the open deals by stage in the sales order, the portal states first and on hold last', () => {
    expect(pipelineByStage(deals)).toEqual([
      { label: 'Awaiting approval', value: 1 },
      { label: 'Not yet in CRM', value: 1 },
      { label: 'Proposal', value: 1 },
      { label: 'On hold', value: 1 },
    ])
  })
  it('sums the value by month across the period, empty months at zero', () => {
    const p = periodBounds('fy', new Date('2026-10-23T12:00:00Z'))
    const m = valueByMonth(deals, p, new Date('2026-10-23T12:00:00Z'))
    expect(m.map((s) => s.label)).toEqual(['Apr 26', 'May 26', 'Jun 26', 'Jul 26', 'Aug 26', 'Sep 26', 'Oct 26', 'Nov 26', 'Dec 26', 'Jan 27', 'Feb 27', 'Mar 27'])
    expect(m[4]!.value).toBe(100000)
    expect(m[5]!.value).toBe(200000 + 350000)
    expect(m[6]!.value).toBe(400000 + 500000 + 600000 + 700000)
    expect(m[0]!.value).toBe(0)
    expect(valueByMonth([], periodBounds('all'), new Date())).toEqual([])
  })
  it('splits a deal’s value over its lines and sorts products by value', () => {
    const two = deal({ expectedValue: 1000, products: [{ productId: '1', name: 'A', sku: 'A', quantity: 1 }, { productId: '2', name: 'B', sku: 'B', quantity: 1 }] })
    const one = deal({ expectedValue: 700, products: [{ productId: '2', name: 'B', sku: 'B', quantity: 1 }] })
    expect(valueByProduct([two, one])).toEqual([
      { label: 'B', value: 1200 },
      { label: 'A', value: 500 },
    ])
    expect(valueByProduct([deal({ expectedValue: 5, products: [] })])).toEqual([{ label: 'No product', value: 5 }])
  })
  it('writes rupees short', () => {
    expect(shortInr(12500)).toBe('₹12,500')
    expect(shortInr(125000)).toBe('₹1.25 L')
    expect(shortInr(1250000)).toBe('₹12.5 L')
    expect(shortInr(24000000)).toBe('₹2.4 Cr')
    expect(shortInr(0)).toBe('₹0')
    expect(shortInr(null)).toBe('—')
  })
})

import { describe, expect, it } from 'vitest'

import { EMPTY_SNAPSHOT, type Deal } from '@/lib/partner/deals-model'
import { appliesTo, applicabilityText, canCompute, canDispute, canPublish, countDeals, countedDeal, disputeUntil, financeCsv, FINANCE_COLUMNS, finalValue, groupSchemes, initialRegistrationStatus, isOpenForRegistration, normaliseSlabs, progressFor, registerBlocked, resultStatus, schemeGroup, schemePhase, searchSchemes, standing, sumValue, toRegistration, toResult, toScheme, visibleScheme, type EligibilityResult, type Registration, type Scheme } from '@/lib/partner/schemes-model'
import { DEFAULT_PARTNER_SETTINGS, normalisePartnerSettings } from '@/lib/partner/settings-model'

/* Schemes and eligibility without a tenant (docs/partner-portal/04-portal-guide.md M7): the phase from the dates (FR-SCH-02),
   who a scheme applies to, the registration rules (FR-SCH-03, 04), which deals count and at what value (FR-ELG-01, decision
   16), the slabs, the gap and the adjustment (FR-ELG-02 … 04), the dispute window (FR-ELG-05), the Finance CSV (FR-ELG-07),
   and the setting. */

const NOW = new Date('2026-10-23T09:00:00.000Z')

const scheme = (over: Partial<Scheme> = {}): Scheme => ({
  id: '7',
  name: 'Festive Push',
  description: '',
  terms: 'Terms.',
  status: 'published',
  startDate: '2026-10-01',
  endDate: '2026-12-31',
  registrationDeadline: '2026-10-31',
  types: [],
  regions: [],
  productIds: [],
  productNames: [],
  approvalRequired: false,
  disputeDays: null,
  slabs: [
    { threshold: 500000, benefit: '2% rebate', amount: 10000 },
    { threshold: 1500000, benefit: '4% rebate', amount: 60000 },
    { threshold: 3000000, benefit: '6% rebate', amount: 180000 },
  ],
  attachment: null,
  results: { computedAt: null, computedBy: '', publishedAt: null, publishedBy: '' },
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...over,
})

const deal = (over: Partial<Deal> & { dealId: string; won?: boolean; closedOn?: string; actual?: number | null; invoice?: number | null; estimate?: number | null }): Deal => {
  const { won = true, closedOn = '2026-11-15', actual = 600000, invoice = null, estimate = null, ...rest } = over
  return {
    id: rest.dealId.replace(/\D/g, ''),
    status: 'approved',
    orgId: '1',
    orgPartnerId: 'K7P-00001',
    orgName: 'Org',
    orgType: 'var',
    registeredBy: { userId: 'u', name: 'U', email: 'u@x.in' },
    reseller: { name: '', orgId: '', orgPartnerId: '' },
    customer: { name: `Customer ${rest.dealId}`, industry: '', city: '', state: '', contactName: '', designation: '', email: '', phone: '' },
    customerKey: '',
    emailDomain: '',
    products: [{ productId: 'p1', name: 'Endpoint', sku: 'EPS', quantity: 10 }],
    expectedValue: 400000,
    closeDate: '2026-11-30',
    source: '',
    competitor: '',
    notes: '',
    thread: [],
    submittedAt: '2026-10-02T00:00:00.000Z',
    decidedAt: null,
    protectionEnds: null,
    endingNoticeAt: null,
    extension: { requestedAt: null, requestedBy: '', reason: '', decidedAt: null, decidedBy: '', granted: false, note: '' },
    conflicts: [],
    crm: { opportunityId: 'opp', opportunityNo: `OPP-${rest.dealId}`, customerAccountId: '', customerContactId: '', noteId: '', snapshot: { ...EMPTY_SNAPSHOT, syncedAt: '2026-10-23T00:00:00.000Z', statecode: won ? 1 : 0, actualCloseDate: closedOn, actualValue: actual, invoiceAmount: invoice, estimatedValue: estimate } },
    createdAt: '',
    updatedAt: '',
    ...rest,
  } as Deal
}

const result = (over: Partial<EligibilityResult> = {}): EligibilityResult => ({
  id: '1',
  schemeId: '7',
  orgId: '1',
  orgPartnerId: 'K7P-00001',
  orgName: 'Org',
  orgType: 'var',
  achieved: 600000,
  dealsCounted: [],
  adjustment: { amount: 0, reason: '', by: '', at: null },
  final: 600000,
  eligible: true,
  slabIndex: 0,
  target: 500000,
  gap: 900000,
  computedAt: '2027-01-02T00:00:00.000Z',
  dispute: { status: 'none', text: '', raisedBy: '', raisedAt: null, resolution: '', resolvedBy: '', resolvedAt: null },
  payout: { status: 'pending', reference: '', note: '', by: '', at: null },
  createdAt: '',
  updatedAt: '',
  ...over,
})

describe('the phase (FR-SCH-02)', () => {
  it('open until the deadline, running to the end, closed after; dates inclusive', () => {
    const sc = scheme()
    expect(schemePhase(sc, new Date('2026-10-31T23:00:00Z'))).toBe('open')
    expect(schemePhase(sc, new Date('2026-11-01T00:00:00Z'))).toBe('running')
    expect(schemePhase(sc, new Date('2026-12-31T12:00:00Z'))).toBe('running')
    expect(schemePhase(sc, new Date('2027-01-01T00:00:00Z'))).toBe('closed')
    expect(schemeGroup(sc, NOW)).toBe('open')
  })
  it('a deadline before the start gives "starts soon" between them', () => {
    const sc = scheme({ registrationDeadline: '2026-10-10', startDate: '2026-11-01' })
    expect(schemePhase(sc, new Date('2026-10-20T00:00:00Z'))).toBe('upcoming')
    expect(schemeGroup(sc, new Date('2026-10-20T00:00:00Z'))).toBe('running')
    expect(isOpenForRegistration(sc, new Date('2026-10-20T00:00:00Z'))).toBe(false)
  })
  it('groups the listing open · running · closed, soonest end first and latest closed first', () => {
    const rows = [scheme({ id: '1', endDate: '2026-12-31' }), scheme({ id: '2', registrationDeadline: '2026-10-01', endDate: '2026-11-30' }), scheme({ id: '3', startDate: '2026-01-01', registrationDeadline: '2026-01-01', endDate: '2026-03-31' }), scheme({ id: '4', startDate: '2026-04-01', registrationDeadline: '2026-04-01', endDate: '2026-06-30' })].map((sc) => ({ scheme: sc, phase: schemePhase(sc, NOW), group: schemeGroup(sc, NOW), registration: null, result: null }))
    const g = groupSchemes(rows)
    expect(g.map((x) => x.group)).toEqual(['open', 'running', 'closed'])
    expect(g[2]!.rows.map((r) => r.scheme.id)).toEqual(['4', '3'])
  })
})

describe('who a scheme applies to (FR-SCH-02)', () => {
  it('empty rules are everyone; types and regions narrow, ANDed; only published shows', () => {
    expect(appliesTo(scheme(), { type: 'var', regions: ['S'] })).toBe(true)
    expect(appliesTo(scheme({ types: ['distributor'] }), { type: 'var', regions: ['S'] })).toBe(false)
    expect(appliesTo(scheme({ regions: ['N', 'WCE'] }), { type: 'var', regions: ['s'] })).toBe(false)
    expect(appliesTo(scheme({ regions: ['N', 'WCE'] }), { type: 'var', regions: ['s', 'wce'] })).toBe(true)
    expect(appliesTo(scheme({ types: ['var'], regions: ['S'] }), { type: 'var', regions: ['N'] })).toBe(false)
    expect(visibleScheme(scheme({ status: 'draft' }), { type: 'var', regions: ['S'] })).toBe(false)
    expect(applicabilityText(scheme({ types: ['var'], regions: ['S'], productNames: ['Endpoint'] }), (t) => t.toUpperCase(), (c) => `South(${c})`)).toBe('VAR · South(S) · on Endpoint')
    expect(applicabilityText(scheme(), (t) => t, (c) => c)).toBe('Every partner')
  })
  it('searches name, description, products and regions', () => {
    const rows = [scheme({ id: '1', name: 'Festive Push' }), scheme({ id: '2', name: 'Growth', productNames: ['Endpoint'] })]
    expect(searchSchemes(rows, 'endpoint').map((s) => s.id)).toEqual(['2'])
    expect(searchSchemes(rows, 'festive push').map((s) => s.id)).toEqual(['1'])
    expect(searchSchemes(rows, '').length).toBe(2)
  })
})

describe('registration (FR-SCH-03, 04)', () => {
  const org = { status: 'approved' as const, type: 'var' as const, regions: ['S'] }
  const admin = { status: 'active' as const, roles: ['admin'] }
  const reg = (status: Registration['status']): Registration => ({ id: 'r', schemeId: '7', orgId: '1', orgPartnerId: 'K7P-00001', orgName: 'Org', orgType: 'var', status, acceptedBy: { userId: 'u', name: 'U', email: 'u@x.in' }, acceptedAt: '2026-10-05T00:00:00.000Z', decision: { by: '', at: null, note: '' }, createdAt: '' })
  it('a Partner Admin of an approved, applicable organisation registers once, in the window, with the terms accepted', () => {
    expect(registerBlocked(scheme(), org, admin, null, true, NOW)).toBeNull()
    expect(registerBlocked(scheme(), org, admin, null, false, NOW)).toMatch(/Accept the scheme terms/)
    expect(registerBlocked(scheme(), org, { status: 'active', roles: ['sales'] }, null, true, NOW)).toMatch(/Only a Partner Admin/)
    expect(registerBlocked(scheme(), { ...org, status: 'suspended' }, admin, null, true, NOW)).toMatch(/suspended/)
    expect(registerBlocked(scheme({ types: ['distributor'] }), org, admin, null, true, NOW)).toMatch(/does not apply/)
    expect(registerBlocked(scheme(), org, admin, reg('approved'), true, NOW)).toMatch(/already registered/)
    expect(registerBlocked(scheme(), org, admin, reg('pending'), true, NOW)).toMatch(/with K7/)
    expect(registerBlocked(scheme(), org, admin, reg('declined'), true, NOW)).toMatch(/declined/)
    expect(registerBlocked(scheme(), org, admin, null, true, new Date('2026-11-05T00:00:00Z'))).toMatch(/Registration closed on 2026-10-31/)
    expect(registerBlocked(scheme(), org, admin, null, true, new Date('2027-02-01T00:00:00Z'))).toMatch(/has closed/)
    expect(registerBlocked(scheme({ status: 'draft' }), org, admin, null, true, NOW)).toMatch(/not open/)
  })
  it('the first state follows the scheme', () => {
    expect(initialRegistrationStatus(scheme())).toBe('approved')
    expect(initialRegistrationStatus(scheme({ approvalRequired: true }))).toBe('pending')
  })
})

describe('which deals count (FR-ELG-01, decision 16)', () => {
  it('won in the CRM, closed inside the dates, on a named product when the scheme names any', () => {
    const sc = scheme()
    expect(countedDeal(sc, deal({ dealId: 'K7D-00001' }))?.value).toBe(600000)
    expect(countedDeal(sc, deal({ dealId: 'K7D-00002', won: false }))).toBeNull()
    expect(countedDeal(sc, deal({ dealId: 'K7D-00003', closedOn: '2026-09-30' }))).toBeNull()
    expect(countedDeal(sc, deal({ dealId: 'K7D-00004', closedOn: '2026-12-31' }))).not.toBeNull()
    expect(countedDeal(sc, deal({ dealId: 'K7D-00005', closedOn: '2027-01-01' }))).toBeNull()
    expect(countedDeal(scheme({ productIds: ['p9'] }), deal({ dealId: 'K7D-00006' }))).toBeNull()
    expect(countedDeal(scheme({ productIds: ['p1', 'p9'] }), deal({ dealId: 'K7D-00007' }))).not.toBeNull()
  })
  it('the value is the order value: actual, else invoice, else estimate, else the registration', () => {
    const sc = scheme()
    expect(countedDeal(sc, deal({ dealId: 'K7D-00001', actual: null, invoice: 550000 }))?.value).toBe(550000)
    expect(countedDeal(sc, deal({ dealId: 'K7D-00002', actual: null, invoice: null, estimate: 500000 }))?.value).toBe(500000)
    expect(countedDeal(sc, deal({ dealId: 'K7D-00003', actual: null, invoice: null, estimate: null }))?.value).toBe(400000)
  })
  it('sorts by close date and sums', () => {
    const counted = countDeals(scheme(), [deal({ dealId: 'K7D-00002', closedOn: '2026-12-01' }), deal({ dealId: 'K7D-00001', closedOn: '2026-10-05', actual: 200000 }), deal({ dealId: 'K7D-00003', won: false })])
    expect(counted.map((c) => c.dealId)).toEqual(['K7D-00001', 'K7D-00002'])
    expect(sumValue(counted)).toBe(800000)
  })
})

describe('the slabs, the gap and the adjustment (FR-ELG-02 … 04)', () => {
  const slabs = scheme().slabs
  it('sorts and drops blank slabs', () => {
    expect(normaliseSlabs([{ threshold: 1500000, benefit: 'b' }, { threshold: 0, benefit: 'x' }, { threshold: 500000, benefit: 'a', amount: '10' }]).map((s) => s.threshold)).toEqual([500000, 1500000])
  })
  it('under the target: not eligible, the gap to the target', () => {
    const st = standing(slabs, 300000)
    expect(st.eligible).toBe(false)
    expect(st.slabIndex).toBe(-1)
    expect(st.target).toBe(500000)
    expect(st.gap).toBe(200000)
    expect(st.share).toBe(0.1)
  })
  it('on a slab: eligible, the slab reached, the gap to the next', () => {
    const st = standing(slabs, 1500000)
    expect(st.eligible).toBe(true)
    expect(st.slabIndex).toBe(1)
    expect(st.slab?.benefit).toBe('4% rebate')
    expect(st.gap).toBe(1500000)
    expect(standing(slabs, 5000000).next).toBeNull()
    expect(standing(slabs, 5000000).gap).toBe(0)
    expect(standing(slabs, 5000000).share).toBe(1)
  })
  it('no slabs: nothing is eligible', () => {
    expect(standing([], 1000000).eligible).toBe(false)
    expect(standing([], 1000000).target).toBe(0)
  })
  it('the adjustment moves the final value and never below zero', () => {
    expect(finalValue(600000, -100000)).toBe(500000)
    expect(finalValue(600000, -900000)).toBe(0)
    expect(finalValue(600000, Number.NaN)).toBe(600000)
    expect(standing(slabs, finalValue(450000, 60000)).eligible).toBe(true)
  })
  it('the partner reads the status only once published, and "under review" while a dispute is open', () => {
    expect(resultStatus(result(), false)).toBe('review')
    expect(resultStatus(result(), true)).toBe('eligible')
    expect(resultStatus(result({ eligible: false }), true)).toBe('notEligible')
    expect(resultStatus(result({ dispute: { status: 'open', text: 'x', raisedBy: 'u', raisedAt: '2027-01-05T00:00:00Z', resolution: '', resolvedBy: '', resolvedAt: null } }), true)).toBe('review')
  })
  it('progress is provisional until the close', () => {
    const p = progressFor(scheme(), [deal({ dealId: 'K7D-00001' })], NOW)
    expect(p.provisional).toBe(true)
    expect(p.achieved).toBe(600000)
    expect(p.standing.slabIndex).toBe(0)
    expect(progressFor(scheme(), [], new Date('2027-01-10T00:00:00Z')).provisional).toBe(false)
  })
})

describe('the run, the publication, the dispute window (FR-ELG-01, 02, 05)', () => {
  it('computes only a published scheme after its close, with slabs, until published', () => {
    expect(canCompute(scheme(), NOW)).toMatch(/runs until 2026-12-31/)
    expect(canCompute(scheme(), new Date('2027-01-02T00:00:00Z'))).toBeNull()
    expect(canCompute(scheme({ status: 'draft' }), new Date('2027-01-02T00:00:00Z'))).toMatch(/published scheme/)
    expect(canCompute(scheme({ slabs: [] }), new Date('2027-01-02T00:00:00Z'))).toMatch(/no slabs/)
    expect(canCompute(scheme({ results: { computedAt: '2027-01-02T00:00:00Z', computedBy: 'x', publishedAt: '2027-01-03T00:00:00Z', publishedBy: 'x' } }), new Date('2027-01-05T00:00:00Z'))).toMatch(/not recomputed/)
  })
  it('publishes once, after a run', () => {
    expect(canPublish(scheme())).toMatch(/Compute/)
    expect(canPublish(scheme({ results: { computedAt: '2027-01-02T00:00:00Z', computedBy: 'x', publishedAt: null, publishedBy: '' } }))).toBeNull()
    expect(canPublish(scheme({ results: { computedAt: '2027-01-02T00:00:00Z', computedBy: 'x', publishedAt: '2027-01-03T00:00:00Z', publishedBy: 'x' } }))).toMatch(/Already/)
  })
  it('the dispute window runs from the publication, the scheme’s days or the setting', () => {
    const published = scheme({ results: { computedAt: '2027-01-02T00:00:00Z', computedBy: 'x', publishedAt: '2027-01-03T00:00:00.000Z', publishedBy: 'x' } })
    expect(disputeUntil(scheme(), 14)).toBeNull()
    expect(disputeUntil(published, 14)).toBe('2027-01-17T00:00:00.000Z')
    expect(disputeUntil({ ...published, disputeDays: 3 }, 14)).toBe('2027-01-06T00:00:00.000Z')
    expect(canDispute(published, result(), 14, new Date('2027-01-10T00:00:00Z'))).toBeNull()
    expect(canDispute(published, result(), 14, new Date('2027-01-18T00:00:00Z'))).toMatch(/closed on 2027-01-17/)
    expect(canDispute(scheme(), result(), 14, NOW)).toMatch(/not published/)
    expect(canDispute(published, result({ dispute: { status: 'open', text: 'x', raisedBy: 'u', raisedAt: null, resolution: '', resolvedBy: '', resolvedAt: null } }), 14, new Date('2027-01-10T00:00:00Z'))).toMatch(/already open/)
    expect(canDispute(published, result({ dispute: { status: 'resolved', text: 'x', raisedBy: 'u', raisedAt: null, resolution: 'ok', resolvedBy: 'k', resolvedAt: null } }), 14, new Date('2027-01-10T00:00:00Z'))).toMatch(/was resolved/)
  })
})

describe('the Finance export (FR-ELG-07)', () => {
  it('one row per result with the partner, scheme and benefit fields, quoted where needed', () => {
    const sc = scheme({ name: 'Festive, Push', results: { computedAt: '2027-01-02T00:00:00Z', computedBy: 'x', publishedAt: '2027-01-03T00:00:00.000Z', publishedBy: 'x' } })
    const csv = financeCsv([{ scheme: sc, result: result({ adjustment: { amount: -50000, reason: 'Credit note "CN-9"', by: 'k', at: '2027-01-04T00:00:00Z' }, final: 550000, payout: { status: 'paid', reference: 'UTR123', note: '', by: 'k', at: '2027-02-01T00:00:00Z' } }), org: { partnerId: 'K7P-00001', name: 'Org Pvt Ltd', type: 'var', gstin: '33AAAAA0000A1Z5', pan: 'AAAAA0000A', country: 'India', state: 'Tamil Nadu', city: 'Chennai', email: 'admin@org.in' } }])
    const lines = csv.trim().split('\r\n')
    expect(lines[0]).toBe(FINANCE_COLUMNS.join(','))
    expect(lines[1]).toContain('"Festive, Push",2026-10-01,2026-12-31,2027-01-03,K7P-00001,Org Pvt Ltd,var,33AAAAA0000A1Z5,AAAAA0000A,India,Tamil Nadu,Chennai,admin@org.in,0,600000,-50000,"Credit note ""CN-9""",550000,500000,Yes,1 (500000),2% rebate,10000,900000,,Paid,UTR123,2027-02-01')
  })
})

describe('the rows as Payload returns them', () => {
  it('a scheme with products as relations, slabs sorted, dates cut to the day', () => {
    const sc = toScheme({ id: 3, name: 'S', status: 'published', startDate: '2026-10-01T00:00:00.000Z', endDate: '2026-12-31T00:00:00.000Z', registrationDeadline: '2026-10-31T00:00:00.000Z', types: ['var', 'bogus'], regions: ['S'], products: [{ id: 5, name: 'Endpoint' }, 6], slabs: [{ threshold: 20, benefit: 'b' }, { threshold: 10, benefit: 'a' }], attachment: { id: 9, filename: 'terms.pdf', mimeType: 'application/pdf', filesize: 100 }, results: { publishedAt: '2027-01-03T00:00:00.000Z' } })
    expect(sc.types).toEqual(['var'])
    expect(sc.productIds).toEqual(['5', '6'])
    expect(sc.productNames).toEqual(['Endpoint'])
    expect(sc.slabs.map((s) => s.threshold)).toEqual([10, 20])
    expect(sc.startDate).toBe('2026-10-01')
    expect(sc.attachment?.name).toBe('terms.pdf')
    expect(sc.results.publishedAt).toBe('2027-01-03T00:00:00.000Z')
    expect(sc.disputeDays).toBeNull()
  })
  it('a registration and a result read back', () => {
    const r = toRegistration({ id: 1, scheme: { id: 3 }, org: 2, orgPartnerId: 'K7P-00002', orgName: 'Org', orgType: 'var', status: 'pending', acceptedBy: { userId: 'u', name: 'U', email: 'u@x.in' }, acceptedAt: '2026-10-05T00:00:00.000Z' })
    expect(r.schemeId).toBe('3')
    expect(r.orgId).toBe('2')
    expect(r.status).toBe('pending')
    const e = toResult({ id: 4, scheme: 3, org: 2, orgPartnerId: 'K7P-00002', achieved: 600000, final: 550000, eligible: true, slabIndex: 0, target: 500000, gap: 950000, dealsCounted: [{ dealId: 'K7D-00001', rowId: '1', customer: 'C', closedOn: '2026-11-15T00:00:00.000Z', value: 600000, opportunityNo: 'OPP-1', products: ['Endpoint'] }], adjustment: { amount: -50000, reason: 'r' }, dispute: { status: 'open', text: 't' }, payout: { status: 'bogus' } })
    expect(e.dealsCounted[0]?.closedOn).toBe('2026-11-15')
    expect(e.adjustment.amount).toBe(-50000)
    expect(e.dispute.status).toBe('open')
    expect(e.payout.status).toBe('pending')
  })
})

describe('the setting', () => {
  it('schemes.disputeDays defaults to 14 and accepts 0', () => {
    expect(DEFAULT_PARTNER_SETTINGS.schemes.disputeDays).toBe(14)
    expect(normalisePartnerSettings({ schemes: { disputeDays: 0 } }).schemes.disputeDays).toBe(0)
    expect(normalisePartnerSettings({ schemes: { disputeDays: -3 } }).schemes.disputeDays).toBe(14)
    expect(normalisePartnerSettings({}).schemes.disputeDays).toBe(14)
  })
})

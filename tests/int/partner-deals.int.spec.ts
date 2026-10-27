import { describe, expect, it } from 'vitest'

import { accountVertical, canRequestExtension, conflictsAmong, conflictWith, customerKey, daysLeft, emailDomain, EMPTY_DEAL_INPUT, linesFrom, opportunityBodies, protectionEnd, protectionShare, registerBlocked, toDeal, validateDeal, type ConflictCandidate, type Deal, type Product } from '@/lib/partner/deals-model'
import { alreadyLine, canDecideDeal, canMoveDeal, DEAL_DECISION_TO, dealDecisionNeedsComment, isRepeatedDealDecision, isRepeatedExtension } from '@/lib/partner/status'

/* Deal registration without a tenant (docs/partner-portal/04-portal-guide.md M4): the status machine of 01-requirements §7.2, the
   form's validation and the gate, the protection maths, the conflict matcher over portal deals and the opportunity mapping. */

const products: Product[] = [
  { id: '1', name: 'Endpoint Security', sku: 'EPS-1', family: 'Endpoint', active: true, crmProductId: '', description: '', order: 1 },
  { id: '2', name: 'EDR', sku: 'EDR-1', family: 'Endpoint', active: false, crmProductId: '', description: '', order: 2 },
]
const good = { ...EMPTY_DEAL_INPUT, customer: { name: 'Acme Industries Pvt Ltd', industry: 'Manufacturing', city: 'Chennai', state: 'Tamil Nadu', contactName: 'Priya Raman', designation: 'CIO', email: 'priya@acme.in', phone: '9840000000' }, lines: [{ productId: '1', quantity: 250 }], expectedValue: 1250000, closeDate: '2027-01-31', source: 'prospecting', resellerName: '' }

describe('the deal machine', () => {
  it('moves only along §7.2', () => {
    expect(canMoveDeal('submitted', 'approved')).toBe(true)
    expect(canMoveDeal('submitted', 'infoRequested')).toBe(true)
    expect(canMoveDeal('infoRequested', 'submitted')).toBe(true)
    expect(canMoveDeal('infoRequested', 'approved')).toBe(false)
    expect(canMoveDeal('approved', 'extensionRequested')).toBe(true)
    expect(canMoveDeal('extensionRequested', 'approved')).toBe(true)
    expect(canMoveDeal('approved', 'expired')).toBe(true)
    expect(canMoveDeal('rejected', 'submitted')).toBe(false)
    expect(canMoveDeal('expired', 'approved')).toBe(false)
  })
  it('maps the four decisions', () => {
    expect(DEAL_DECISION_TO.approveWithChanges).toBe('approved')
    expect(canDecideDeal('submitted', 'reject')).toBe(true)
    expect(canDecideDeal('approved', 'reject')).toBe(false)
    expect(canDecideDeal('extensionRequested', 'approve')).toBe(false) // the extension decision, not an approval (found in the browser, 2026-10-23)
    expect(canDecideDeal('infoRequested', 'approve')).toBe(false)
    expect(dealDecisionNeedsComment('approve')).toBe(false)
    expect(dealDecisionNeedsComment('requestInfo')).toBe(true)
  })
})

describe('the form and the gate', () => {
  it('accepts a complete registration and names what is missing', () => {
    expect(validateDeal(good, products, 'var', '2026-10-22')).toEqual({})
    const e = validateDeal({ ...good, customer: { ...good.customer, email: 'nope', phone: '12' }, lines: [], expectedValue: 0, closeDate: '2020-01-01', source: '' }, products, 'var', '2026-10-22')
    expect(Object.keys(e).sort()).toEqual(['closeDate', 'email', 'expectedValue', 'phone', 'products', 'source'])
  })
  it('refuses an inactive product, a duplicate line and a missing quantity', () => {
    expect(validateDeal({ ...good, lines: [{ productId: '2', quantity: 1 }] }, products, 'var', '2026-10-22').products).toMatch(/not offered/)
    expect(validateDeal({ ...good, lines: [{ productId: '1', quantity: 1 }, { productId: '1', quantity: 2 }] }, products, 'var', '2026-10-22').products).toMatch(/twice/)
    expect(validateDeal({ ...good, lines: [{ productId: '1', quantity: 0 }] }, products, 'var', '2026-10-22').products).toMatch(/quantity/)
  })
  it('makes a Distributor name the reseller', () => {
    expect(validateDeal(good, products, 'distributor', '2026-10-22')).toHaveProperty('resellerName')
    expect(validateDeal({ ...good, resellerName: 'Reseller Co' }, products, 'distributor', '2026-10-22')).toEqual({})
  })
  it('reads the product lines from indexed fields, dropping blank rows', () => {
    const form: Record<string, string> = { product_0: '1', qty_0: '10', product_1: '', qty_1: '', product_2: '1', qty_2: 'x' }
    expect(linesFrom((k) => form[k] ?? '')).toEqual([{ productId: '1', quantity: 10 }, { productId: '1', quantity: 0 }])
  })
  it('gates on the organisation, the user and, when switched on, the certificate or the waiver', () => {
    const org = { status: 'approved' as const, certificate: { status: 'none', until: null }, waiverUntil: null }
    const admin = { status: 'active' as const, roles: ['admin'] }
    expect(registerBlocked(org, admin, false)).toBeNull()
    expect(registerBlocked({ ...org, status: 'suspended' }, admin, false)).toMatch(/suspended/)
    expect(registerBlocked(org, { ...admin, status: 'invited' }, false)).toMatch(/not active/)
    expect(registerBlocked(org, { status: 'active', roles: ['technical'] }, false)).toMatch(/Sales/)
    expect(registerBlocked(org, admin, true)).toMatch(/certificate/)
    expect(registerBlocked({ ...org, waiverUntil: '2027-03-31' }, admin, true, '2026-10-22')).toBeNull()
    expect(registerBlocked({ ...org, waiverUntil: '2026-01-01' }, admin, true, '2026-10-22')).toMatch(/certificate/)
    expect(registerBlocked({ ...org, certificate: { status: 'valid', until: '2027-10-22' } }, admin, true, '2026-10-22')).toBeNull()
  })
})

describe('protection', () => {
  it('runs the configured days from approval, to the end of that day', () => {
    const end = protectionEnd('2026-10-22T10:00:00.000Z', 90)
    expect(end.slice(0, 10)).toBe('2027-01-20')
    expect(end.slice(11, 19)).toBe('23:59:59')
    expect(daysLeft(end, new Date('2026-10-22T12:00:00.000Z'))).toBe(91)
    expect(protectionShare('2026-10-22T00:00:00.000Z', '2026-11-21T00:00:00.000Z', new Date('2026-11-06T00:00:00.000Z'))).toBeCloseTo(0.5, 2)
    expect(protectionShare(null, null)).toBeNull()
  })
  it('allows one extension while approved and inside the window', () => {
    const base = { status: 'approved' as const, protectionEnds: '2099-01-01T00:00:00.000Z', extension: { requestedAt: null, requestedBy: '', reason: '', decidedAt: null, decidedBy: '', granted: false, note: '' } }
    expect(canRequestExtension(base)).toBe(true)
    expect(canRequestExtension({ ...base, extension: { ...base.extension, requestedAt: '2026-10-22T00:00:00.000Z' } })).toBe(false)
    expect(canRequestExtension({ ...base, protectionEnds: '2020-01-01T00:00:00.000Z' })).toBe(false)
    expect(canRequestExtension({ ...base, status: 'submitted' })).toBe(false)
  })
})

describe('the conflict check', () => {
  it('normalises customer names and ignores public mail domains', () => {
    expect(customerKey('Acme Industries Pvt. Ltd.')).toBe('acme industries')
    expect(customerKey('ACME INDUSTRIES PRIVATE LIMITED')).toBe('acme industries')
    expect(customerKey('The Acme & Sons, LLP')).toBe('acme and sons')
    expect(emailDomain('Priya@Acme.in')).toBe('acme.in')
    expect(emailDomain('priya@gmail.com')).toBe('')
  })
  const cand = (over: Partial<ConflictCandidate>): ConflictCandidate => ({ id: 'c1', dealId: 'K7D-00001', status: 'approved', orgPartnerId: 'K7P-00002', orgName: 'Other Partner', customerKey: 'acme industries', emailDomain: 'acme.in', protectionEnds: '2099-01-01T00:00:00.000Z', customer: { name: 'Acme Industries', email: 'priya@acme.in' }, ...over })
  const subject = { id: 's1', customerKey: 'acme industries', emailDomain: 'acme.in', customer: { email: 'priya@acme.in' } }
  it('matches on name, domain and email, and says which', () => {
    expect(conflictWith(subject, cand({}))?.matchedOn).toEqual(['name', 'domain', 'email'])
    expect(conflictWith(subject, cand({ customerKey: 'other co', customer: { name: 'Other', email: 'x@acme.in' } }))?.matchedOn).toEqual(['domain'])
    expect(conflictWith(subject, cand({ customerKey: 'other co', emailDomain: 'other.in', customer: { name: 'Other', email: 'priya@acme.in' } }))?.matchedOn).toEqual(['email'])
    expect(conflictWith(subject, cand({ customerKey: 'other co', emailDomain: 'other.in', customer: { name: 'Other', email: 'z@other.in' } }))).toBeNull()
  })
  it('ignores itself, closed deals and protection that has run out', () => {
    expect(conflictWith(subject, cand({ id: 's1' }))).toBeNull()
    expect(conflictWith(subject, cand({ status: 'rejected' }))).toBeNull()
    expect(conflictWith(subject, cand({ status: 'expired' }))).toBeNull()
    expect(conflictWith(subject, cand({ protectionEnds: '2020-01-01T00:00:00.000Z' }))).toBeNull()
    expect(conflictWith(subject, cand({ status: 'submitted', protectionEnds: null }))?.dealId).toBe('K7D-00001')
    expect(conflictsAmong(subject, [cand({}), cand({ id: 'c2', status: 'withdrawn' })])).toHaveLength(1)
  })
})

describe('the opportunity mapping', () => {
  const deal: Deal = toDeal({
    id: '9',
    dealId: 'K7D-00042',
    status: 'approved',
    org: 3,
    orgPartnerId: 'K7P-00003',
    orgName: 'Partner Co',
    orgType: 'distributor',
    registeredBy: { userId: 'u', name: 'Sales Person', email: 's@partner.in' },
    reseller: { name: 'Reseller Co', orgId: '', orgPartnerId: '' },
    customerName: 'Acme Industries',
    customerKey: 'acme industries',
    customer: { industry: 'Manufacturing', city: 'Chennai', state: 'Tamil Nadu', contactName: 'Priya Raman', designation: 'CIO', email: 'priya@acme.in', emailDomain: 'acme.in', phone: '+91 98400 00000' },
    products: [{ product: { id: 1, name: 'Endpoint Security' }, sku: 'EPS-1', quantity: 250 }, { product: { id: 2, name: 'EDR' }, sku: 'EDR-1', quantity: 50 }],
    expectedValue: 1250000,
    closeDate: '2027-01-31T00:00:00.000Z',
    source: 'prospecting',
    competitor: 'Quickheal',
    notes: 'Renewal due in March.',
    thread: [{ kind: 'decision', side: 'k7', byName: 'CM', byEmail: 'cm@k7', at: '2026-10-22T10:00:00.000Z', to: 'approved', title: 'Approve', text: '', files: [] }],
    protectionEnds: '2027-01-20T23:59:59.000Z',
  })
  it('reads the row back, products populated', () => {
    expect(deal.products.map((l) => l.name)).toEqual(['Endpoint Security', 'EDR'])
    expect(deal.orgId).toBe('3')
    expect(deal.thread[0]!.to).toBe('approved')
  })
  it('shapes the three rows and the note on the sales convention', () => {
    const b = opportunityBodies(deal, { partnerName: 'Partner Co', namePattern: '{customer}-Fresh-{product}', enquirySource: 1, productCategory: 36, partnerType: 'distributor' })
    expect(b.name).toBe('Acme Industries-Fresh-Endpoint Security')
    expect(b.opportunity).toMatchObject({ estimatedvalue: 1250000, estimatedclosedate: '2027-01-31', alletec_saleschannel: 2, alletec_enquirysource: 1, alletec_productcategory: 36, alletec_casetypelicensetype: 0, alletec_nooflicenses: 300, k7_industry: 'Manufacturing', alletec_competitoradded: 260760000 })
    expect(String(b.opportunity.description)).toContain('K7D-00042 · protected until 2027-01-20')
    expect(String(b.opportunity.description)).toContain('Reseller: Reseller Co')
    expect(b.customerAccount).toMatchObject({ name: 'Acme Industries', alletec_accounttype: 1, address1_city: 'Chennai', telephone1: '+919840000000', alletec_verticalbusiness: 13 })
    expect(b.customerContact).toMatchObject({ firstname: 'Priya', lastname: 'Raman', jobtitle: 'CIO', emailaddress1: 'priya@acme.in' })
    expect(b.noteText).toContain('EDR (EDR-1) × 50')
    expect(b.noteText).toContain('Renewal due in March.')
  })
  it('lands the free-text industry on the account vertical picklist, or leaves the column out', () => {
    expect(accountVertical('Manufacturing')).toBe(13)
    expect(accountVertical('banking')).toBe(1)
    expect(accountVertical('Oil & Gas')).toBe(696720058)
    expect(accountVertical('Pharma')).toBe(696720063)
    expect(accountVertical('Quantum knitting')).toBeNull()
    expect(accountVertical('')).toBeNull()
    const b = opportunityBodies({ ...deal, customer: { ...deal.customer, industry: 'Quantum knitting' } }, { partnerName: 'P', namePattern: '{customer}', enquirySource: 1, productCategory: 36, partnerType: 'var' })
    expect(b.customerAccount).not.toHaveProperty('alletec_verticalbusiness')
    expect(b.opportunity.k7_industry).toBe('Quantum knitting')
  })
})

describe('the same K7 decision twice (B-03)', () => {
  it('reads a second approval or extension decision as done', () => {
    expect(isRepeatedDealDecision('approved', 'approve')).toBe(true)
    expect(isRepeatedDealDecision('approved', 'approveWithChanges')).toBe(true)
    expect(isRepeatedDealDecision('rejected', 'reject')).toBe(true)
    expect(isRepeatedDealDecision('infoRequested', 'requestInfo')).toBe(true)
    expect(isRepeatedDealDecision('submitted', 'approve')).toBe(false)
    expect(isRepeatedDealDecision('approved', 'reject')).toBe(false) // a different decision: the machine refuses it
    expect(canDecideDeal('approved', 'reject')).toBe(false)
    expect(isRepeatedDealDecision('extensionRequested', 'approve')).toBe(false)
    const decided = { decidedAt: '2026-10-27T10:00:00.000Z', granted: true }
    expect(isRepeatedExtension('approved', decided, true)).toBe(true)
    expect(isRepeatedExtension('approved', decided, false)).toBe(false)
    expect(isRepeatedExtension('extensionRequested', decided, true)).toBe(false) // a new request waits
    expect(isRepeatedExtension('approved', { decidedAt: null, granted: false }, false)).toBe(false)
    expect(isRepeatedExtension('expired', { decidedAt: '2026-10-27T10:00:00.000Z', granted: false }, false)).toBe(true)
    expect(alreadyLine('approveWithChanges', 'Ravi')).toBe('Already approved by Ravi.')
    expect(alreadyLine('grant')).toBe('Already extended.')
  })
})

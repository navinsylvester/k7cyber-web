import configPromise from '@payload-config'
import { getPayload, type Payload, type Where } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { addDealNote, decideDeal, decideExtension, findConflicts, findDealByNumber, listDeals, listDealsK7, loadDeal, requestExtension, resubmitDeal, submitDeal, sweepDeals, withdrawDeal } from '@/lib/partner/deals'
import { EMPTY_DEAL_INPUT } from '@/lib/partner/deals-model'
import { orgRel } from '@/lib/partner/scope'
import type { K7Context, PartnerContext } from '@/lib/partner/session'
import { toOrg, toUser } from '@/lib/partner/users'

/* Deals against the local Postgres (docs/partner-portal/04-portal-guide.md M4): two organisations; A registers a deal with a
   number, K7 asks for information, A resubmits, K7 approves with a changed value (protection set, the opportunity job queued
   but never run: Dataverse writes are off for the run), B's registration for the same customer shows A's as a conflict that B
   never reads, A asks for the extension and K7 grants it, the sweep expires a window that has run out, B never reads A's deal
   by number. Both organisations carry a certificate waiver, so the run does not depend on deals.requireCertificate (the gate
   itself is tested in partner-deals and partner-certificates-db). Runs only with PARTNER_DB_TESTS=1; rows are removed again. No
   mail leaves: no SMTP_URL in tests. */

const enabled = process.env.PARTNER_DB_TESTS === '1' && Boolean(process.env.DATABASE_URL)
const stamp = Date.now()
const k7: K7Context = { kind: 'k7', email: 'dda@k7computing.com', name: 'Test Approver', userId: '', dev: true, roles: ['channelManager', 'dealDeskApprover'], actor: { kind: 'k7', id: 'dda', name: 'Test Approver', email: 'dda@k7computing.com' } }

describe.skipIf(!enabled)('deal registration (database)', () => {
  let payload: Payload
  const orgIds: string[] = []
  const userIds: string[] = []
  const productIds: string[] = []
  let A: PartnerContext
  let B: PartnerContext
  let writesBefore: string | undefined

  const makeOrg = async (tag: string, n: number, type: 'var' | 'distributor') => {
    const doc = await payload.create({ collection: 'partner-orgs', overrideAccess: true, depth: 0, data: { partnerId: `K7P-8${String(stamp % 1000).padStart(3, '0')}${n}`, type, status: 'approved', waiverUntil: '2099-12-31', name: `PP-TEST Deals ${tag} ${stamp}`, country: 'India', city: 'Chennai', state: 'Tamil Nadu', address: '1 Test Road', pin: '600001', regions: [] } as never })
    orgIds.push(String(doc.id))
    return toOrg(doc as unknown as Record<string, unknown>)
  }
  const makeUser = async (orgId: string, tag: string, roles: ('admin' | 'sales' | 'technical')[]) => {
    const doc = await payload.create({ collection: 'partner-users', overrideAccess: true, depth: 0, data: { org: orgRel({ orgId }), email: `pp-test-deals-${tag}-${stamp}@k7computing.com`, name: `Deals ${tag}`, roles, status: 'active', lastSignInAt: new Date().toISOString() } as never })
    userIds.push(String(doc.id))
    return toUser(doc as unknown as Record<string, unknown>)
  }
  const ctx = (org: ReturnType<typeof toOrg>, user: ReturnType<typeof toUser>): PartnerContext => ({ kind: 'partner', user, org, scope: { orgId: org.id }, roles: user.roles, actor: { kind: 'partner', id: user.id, name: user.name, email: user.email } })
  const input = (customer: string, email: string) => ({ ...EMPTY_DEAL_INPUT, customer: { name: customer, industry: 'Manufacturing', city: 'Chennai', state: 'Tamil Nadu', contactName: 'Priya Raman', designation: 'CIO', email, phone: '9840000000' }, lines: [{ productId: productIds[0]!, quantity: 100 }], expectedValue: 500000, closeDate: '2099-01-31', source: 'prospecting', notes: 'Test', resellerName: 'Reseller Co' })

  beforeAll(async () => {
    payload = await getPayload({ config: configPromise })
    writesBefore = process.env.DATAVERSE_WRITES_ENABLED
    process.env.DATAVERSE_WRITES_ENABLED = '0'
    const p = await payload.create({ collection: 'partner-products', overrideAccess: true, depth: 0, data: { name: `PP-TEST Product ${stamp}`, sku: `PPT-${stamp}`, family: 'Test', active: true, order: 999 } as never })
    productIds.push(String(p.id))
    const [oa, ob] = await Promise.all([makeOrg('A', 1, 'distributor'), makeOrg('B', 2, 'var')])
    const [ua, ub] = await Promise.all([makeUser(oa.id, 'a-sales', ['sales']), makeUser(ob.id, 'b-admin', ['admin'])])
    A = ctx(oa, ua)
    B = ctx(ob, ub)
  })

  afterAll(async () => {
    if (writesBefore === undefined) delete process.env.DATAVERSE_WRITES_ENABLED
    else process.env.DATAVERSE_WRITES_ENABLED = writesBefore
    for (const c of ['partner-deals', 'partner-deal-files', 'partner-users', 'partner-outbox', 'partner-audit', 'partner-notifications'] as const) {
      for (const orgId of orgIds) {
        const where: Where = c === 'partner-users' || c === 'partner-deals' ? { org: { equals: orgId } } : { orgId: { equals: orgId } }
        const r = await payload.find({ collection: c, where, limit: 200, depth: 0, overrideAccess: true })
        for (const d of r.docs) await payload.delete({ collection: c, id: d.id, overrideAccess: true }).catch(() => null)
      }
    }
    for (const id of productIds) await payload.delete({ collection: 'partner-products', id, overrideAccess: true }).catch(() => null)
    for (const id of orgIds) await payload.delete({ collection: 'partner-orgs', id, overrideAccess: true }).catch(() => null)
    const staff = await payload.find({ collection: 'partner-notifications', where: { subject: { contains: `K7P-8${String(stamp % 1000).padStart(3, '0')}` } }, limit: 100, depth: 0, overrideAccess: true })
    for (const d of staff.docs) await payload.delete({ collection: 'partner-notifications', id: d.id, overrideAccess: true })
  })

  it('registers, answers a request, is approved with changes, conflicts for the other partner, extends and expires', async () => {
    // A technical user is refused at the gate; the sales user registers and gets a number.
    const refused = await submitDeal({ ...A, user: { ...A.user, roles: ['technical'] }, roles: ['technical'] }, input(`PP-TEST Customer ${stamp} Pvt Ltd`, `cio@customer-${stamp}.in`))
    expect(refused.ok).toBe(false)
    const r1 = await submitDeal(A, input(`PP-TEST Customer ${stamp} Pvt Ltd`, `cio@customer-${stamp}.in`))
    expect(r1.ok).toBe(true)
    if (!r1.ok) return
    const a1 = r1.deal
    expect(a1.dealId).toMatch(/^K7D-\d{5}$/)
    expect(a1.status).toBe('submitted')
    expect(a1.customerKey).toBe(`pp test customer ${stamp}`)
    expect(a1.reseller.name).toBe('Reseller Co')
    expect(a1.conflicts).toEqual([])
    expect(a1.thread.map((t) => t.kind)).toEqual(['submitted'])

    // The scope: A reads it by number, B gets nothing; the K7 side reads any.
    expect((await loadDeal(A.scope, a1.dealId))?.id).toBe(a1.id)
    expect(await loadDeal(B.scope, a1.dealId)).toBeNull()
    expect((await listDeals(B.scope)).rows.map((d) => d.id)).not.toContain(a1.id)
    expect((await listDeals(A.scope, { view: 'live' })).rows.map((d) => d.id)).toContain(a1.id)
    expect((await findDealByNumber(a1.dealId))?.id).toBe(a1.id)
    expect((await listDealsK7({ view: 'submitted', q: a1.dealId })).rows.map((d) => d.id)).toEqual([a1.id])

    // Request information needs a note; the partner edits and resubmits; a rejection from infoRequested is refused.
    expect((await decideDeal(a1, 'requestInfo', '', {}, k7)).ok).toBe(false)
    const asked = await decideDeal(a1, 'requestInfo', 'Which sites?', {}, k7)
    expect(asked.ok).toBe(true)
    if (!asked.ok) return
    expect(asked.deal.status).toBe('infoRequested')
    expect((await decideDeal(asked.deal, 'reject', 'no', {}, k7)).ok).toBe(false)
    const again = await resubmitDeal(A, asked.deal, { ...input(`PP-TEST Customer ${stamp} Pvt Ltd`, `cio@customer-${stamp}.in`), expectedValue: 600000 }, [], 'Three sites.')
    expect(again.ok).toBe(true)
    if (!again.ok) return
    expect(again.deal.dealId).toBe(a1.dealId)
    expect(again.deal.status).toBe('submitted')
    expect(again.deal.expectedValue).toBe(600000)
    expect(again.deal.thread.map((t) => t.kind)).toEqual(['submitted', 'decision', 'submitted'])

    // Approve with changes needs a change; then the protection is set and the opportunity job is queued, never run.
    expect((await decideDeal(again.deal, 'approveWithChanges', '', {}, k7)).ok).toBe(false)
    const approved = await decideDeal(again.deal, 'approveWithChanges', 'Rounded', { expectedValue: 550000 }, k7)
    expect(approved.ok).toBe(true)
    if (!approved.ok) return
    const a2 = approved.deal
    expect(a2.status).toBe('approved')
    expect(a2.expectedValue).toBe(550000)
    expect(a2.protectionEnds && new Date(a2.protectionEnds).getTime()).toBeGreaterThan(Date.now())
    const jobs = await payload.find({ collection: 'partner-outbox', where: { objectId: { equals: a2.id } }, depth: 0, overrideAccess: true })
    expect(jobs.docs.map((j) => j.kind)).toEqual(['opportunity.create'])
    // Mirror off: pending. Mirror on in the local global: the test organisation has no CRM account, so the job fails with that code
    // before any CRM call (and the writes switch would stop it at the client anyway); never done.
    const job = jobs.docs[0]!
    expect(['pending', 'skipped', 'failed']).toContain(job.state)
    if (job.state === 'failed') expect(String(job.lastError)).toMatch(/partner account/)

    // B registers the same customer: the conflict names A's deal for the approver; B's own row never says whose.
    const r2 = await submitDeal(B, { ...input(`PP-TEST CUSTOMER ${stamp} Private Limited`, `someone@customer-${stamp}.in`), resellerName: '' })
    expect(r2.ok).toBe(true)
    if (!r2.ok) return
    expect(r2.deal.conflicts.map((c) => [c.dealId, c.orgPartnerId, c.matchedOn])).toEqual([[a2.dealId, A.org.partnerId, ['name', 'domain']]])
    expect((await findConflicts({ id: r2.deal.id, customerKey: r2.deal.customerKey, emailDomain: r2.deal.emailDomain, customer: { email: r2.deal.customer.email } })).map((c) => c.dealId)).toEqual([a2.dealId])

    // Notes go on while live; a withdrawal closes B's; the extension is one per deal.
    expect((await addDealNote({ side: 'partner', actor: A.actor, name: A.user.name, email: A.user.email, orgId: A.scope.orgId }, a2, 'PO expected.')).ok).toBe(true)
    const gone = await withdrawDeal(B, r2.deal, 'Lost it')
    expect(gone.ok && gone.deal.status).toBe('withdrawn')
    expect((await requestExtension(A, a2, 'x')).ok).toBe(false)
    const ext = await requestExtension(A, a2, 'Customer budget slips to the next quarter.')
    expect(ext.ok).toBe(true)
    if (!ext.ok) return
    expect(ext.deal.status).toBe('extensionRequested')
    expect((await requestExtension(A, ext.deal, 'again')).ok).toBe(false)
    const granted = await decideExtension(ext.deal, true, '', k7)
    expect(granted.ok).toBe(true)
    if (!granted.ok) return
    expect(granted.deal.status).toBe('approved')
    expect(new Date(granted.deal.protectionEnds!).getTime()).toBeGreaterThan(new Date(a2.protectionEnds!).getTime())
    expect(granted.deal.extension.granted).toBe(true)
    expect((await requestExtension(A, granted.deal, 'once more')).ok).toBe(false)

    // The sweep: a window that has run out expires the deal.
    await payload.update({ collection: 'partner-deals', id: granted.deal.id, overrideAccess: true, data: { protectionEnds: '2020-01-01T00:00:00.000Z' } as never })
    const swept = await sweepDeals()
    expect(swept.expired).toContain(a2.dealId)
    expect((await findDealByNumber(a2.dealId))?.status).toBe('expired')
  })
})

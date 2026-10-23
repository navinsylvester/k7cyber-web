// @vitest-environment node
import configPromise from '@payload-config'
import { getPayload, type Payload, type Where } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { orgRel } from '@/lib/partner/scope'
import { adjustResult, decideRegistration, financeRows, listRegistrations, listResults, loadResultK7, loadSchemeFor, progressOf, publishResults, raiseDispute, registerForScheme, resultFor, runDueSchemes, runEligibility, schemeCountFor, schemesFor, setPayout } from '@/lib/partner/schemes'
import { financeCsv, toScheme } from '@/lib/partner/schemes-model'
import type { K7Context, PartnerContext } from '@/lib/partner/session'
import { toOrg, toUser } from '@/lib/partner/users'

/* Schemes and eligibility against the local Postgres (docs/partner-portal/04-portal-guide.md M7): two organisations (a VAR in
   the South, a Distributor in the North) against a scheme for VARs that asks for K7's approval and one that is closed; the
   listing and the scope (B never sees A's registration or result), registering with and without approval, the decision, the
   provisional progress from won deals, the eligibility run over the closed scheme, the adjustment with its reason, the
   publication (the result reaches the partner only then), the dispute inside the window, the payout, the Finance rows. Runs
   only with PARTNER_DB_TESTS=1; rows are removed again. */

const enabled = process.env.PARTNER_DB_TESTS === '1' && Boolean(process.env.DATABASE_URL)
const stamp = Date.now()
const day = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)

describe.skipIf(!enabled)('schemes and eligibility (database)', () => {
  let payload: Payload
  const orgIds: string[] = []
  const userIds: string[] = []
  const schemeIds: string[] = []
  let A: PartnerContext
  let B: PartnerContext
  let openId = ''
  let closedId = ''
  const k7: K7Context = { kind: 'k7', email: 'scheme.admin@k7computing.com', name: 'Scheme Admin', userId: 'k7-1', dev: true, roles: ['schemeAdmin'], actor: { kind: 'k7', id: 'k7-1', name: 'Scheme Admin', email: 'scheme.admin@k7computing.com' } }

  const makeOrg = async (tag: string, n: number, type: 'var' | 'distributor', regions: string[]) => {
    const doc = await payload.create({ collection: 'partner-orgs', overrideAccess: true, depth: 0, data: { partnerId: `K7P-8${String(stamp % 1000).padStart(3, '0')}${n}`, type, status: 'approved', name: `PP-TEST Scheme ${tag} ${stamp}`, country: 'India', city: 'City', state: 'State', address: '1 Test Road', pin: '600001', regions, gstin: '33AAAAA0000A1Z5' } as never })
    orgIds.push(String(doc.id))
    return toOrg(doc as unknown as Record<string, unknown>)
  }
  const makeUser = async (orgId: string, tag: string, roles: string[]) => {
    const doc = await payload.create({ collection: 'partner-users', overrideAccess: true, depth: 0, data: { org: orgRel({ orgId }), email: `pp-test-scheme-${tag}-${stamp}@k7computing.com`, name: `Scheme ${tag}`, roles, status: 'active', lastSignInAt: new Date().toISOString() } as never })
    userIds.push(String(doc.id))
    return toUser(doc as unknown as Record<string, unknown>)
  }
  const ctx = (org: ReturnType<typeof toOrg>, user: ReturnType<typeof toUser>): PartnerContext => ({ kind: 'partner', user, org, scope: { orgId: org.id }, roles: user.roles, actor: { kind: 'partner', id: user.id, name: user.name, email: user.email } })
  const makeScheme = async (data: Record<string, unknown>) => {
    const doc = await payload.create({ collection: 'partner-schemes', overrideAccess: true, depth: 0, data: { status: 'published', terms: 'Terms.', slabs: [{ threshold: 500000, benefit: '2% rebate', amount: 10000 }, { threshold: 1500000, benefit: '4% rebate', amount: 60000 }], ...data } as never })
    schemeIds.push(String(doc.id))
    return String(doc.id)
  }
  const makeDeal = async (orgId: string, n: number, won: boolean, closedOn: string, actual: number) => {
    await payload.create({
      collection: 'partner-deals',
      overrideAccess: true,
      depth: 0,
      data: { dealId: `K7D-8${String(stamp % 1000).padStart(3, '0')}${n}`, status: 'approved', org: orgRel({ orgId }), orgPartnerId: 'K7P-X', orgName: 'X', orgType: 'var', customerName: `PP-TEST Scheme Customer ${n}`, customerKey: `pp test scheme customer ${n}`, expectedValue: 400000, closeDate: closedOn, submittedAt: new Date().toISOString(), protectionEnds: day(60), products: [], crm: { opportunityId: `opp-${stamp}-${n}`, opportunityNo: `OPP-T${n}`, snapshot: { syncedAt: new Date().toISOString(), statecode: won ? 1 : 0, actualCloseDate: closedOn, actualValue: actual } } } as never,
    })
  }
  const reload = async (id: string) => toScheme((await payload.findByID({ collection: 'partner-schemes', id: Number(id), depth: 1, overrideAccess: true })) as unknown as Record<string, unknown>)

  beforeAll(async () => {
    payload = await getPayload({ config: configPromise })
    const [oa, ob] = await Promise.all([makeOrg('A', 1, 'var', ['S']), makeOrg('B', 2, 'distributor', ['N'])])
    const [ua, ub] = await Promise.all([makeUser(oa.id, 'a', ['admin', 'sales']), makeUser(ob.id, 'b', ['admin'])])
    A = ctx(oa, ua)
    B = ctx(ob, ub)
    openId = await makeScheme({ name: `PP-TEST Open ${stamp}`, startDate: day(-10), endDate: day(60), registrationDeadline: day(10), types: ['var'], approvalRequired: true })
    closedId = await makeScheme({ name: `PP-TEST Closed ${stamp}`, startDate: day(-100), endDate: day(-10), registrationDeadline: day(-80), disputeDays: 7 })
    await makeScheme({ name: `PP-TEST Draft ${stamp}`, status: 'draft', startDate: day(-10), endDate: day(60), registrationDeadline: day(10) })
    // A's deals: two won inside the closed scheme's window, one won outside it, one open; one inside the open scheme's window.
    await makeDeal(oa.id, 1, true, day(-50), 400000)
    await makeDeal(oa.id, 2, true, day(-20), 300000)
    await makeDeal(oa.id, 3, true, day(-200), 900000)
    await makeDeal(oa.id, 4, false, day(-30), 900000)
    await makeDeal(oa.id, 5, true, day(-3), 650000)
    // B registered for the closed scheme directly (the seed's way), nothing won.
    await payload.create({ collection: 'partner-scheme-registrations', overrideAccess: true, depth: 0, data: { scheme: Number(closedId), org: Number(ob.id), orgPartnerId: ob.partnerId, orgName: ob.name, orgType: 'distributor', status: 'approved', acceptedBy: { userId: ub.id, name: ub.name, email: ub.email }, acceptedAt: new Date().toISOString() } as never })
    await payload.create({ collection: 'partner-scheme-registrations', overrideAccess: true, depth: 0, data: { scheme: Number(closedId), org: Number(oa.id), orgPartnerId: oa.partnerId, orgName: oa.name, orgType: 'var', status: 'approved', acceptedBy: { userId: ua.id, name: ua.name, email: ua.email }, acceptedAt: new Date().toISOString() } as never })
  })

  afterAll(async () => {
    for (const c of ['partner-eligibility', 'partner-scheme-registrations'] as const) {
      const r = await payload.find({ collection: c, where: { scheme: { in: schemeIds.map(Number) } }, limit: 200, depth: 0, overrideAccess: true })
      for (const d of r.docs) await payload.delete({ collection: c, id: d.id, overrideAccess: true }).catch(() => null)
    }
    for (const id of schemeIds) await payload.delete({ collection: 'partner-schemes', id, overrideAccess: true }).catch(() => null)
    for (const c of ['partner-deals', 'partner-users', 'partner-audit', 'partner-notifications'] as const) {
      for (const orgId of orgIds) {
        const where: Where = c === 'partner-deals' || c === 'partner-users' ? { org: { equals: orgId } } : { orgId: { equals: orgId } }
        const r = await payload.find({ collection: c, where, limit: 200, depth: 0, overrideAccess: true })
        for (const d of r.docs) await payload.delete({ collection: c, id: d.id, overrideAccess: true }).catch(() => null)
      }
    }
    for (const id of orgIds) await payload.delete({ collection: 'partner-orgs', id, overrideAccess: true }).catch(() => null)
  })

  it('lists only published schemes that apply, with the organisation’s own standing', async () => {
    const a = await schemesFor(A)
    const ids = a.map((r) => r.scheme.id)
    expect(ids).toContain(openId)
    expect(ids).toContain(closedId)
    expect(ids.some((id) => schemeIds[2] === id)).toBe(false) // the draft
    expect(a.find((r) => r.scheme.id === closedId)?.registration?.status).toBe('approved')
    expect(a.find((r) => r.scheme.id === closedId)?.result).toBeNull() // not published yet
    const b = await schemesFor(B)
    expect(b.map((r) => r.scheme.id)).not.toContain(openId) // VARs only
    expect(await loadSchemeFor(B, openId)).toBeNull()
    const counts = await schemeCountFor(A)
    expect(counts.open).toBe(1)
    expect(counts.registered).toBe(0)
  })

  it('registers with K7’s approval, the admin decides, and progress is provisional from the won deals', async () => {
    const refused = await registerForScheme({ ...A, roles: ['sales'], user: { ...A.user, roles: ['sales'] } }, (await loadSchemeFor(A, openId))!.scheme, true)
    expect(refused.ok).toBe(false)
    const r = await registerForScheme(A, (await loadSchemeFor(A, openId))!.scheme, true)
    expect(r.ok && r.value.status).toBe('pending')
    const again = await registerForScheme(A, (await loadSchemeFor(A, openId))!.scheme, true)
    expect(again.ok).toBe(false)
    const regs = await listRegistrations(openId)
    expect(regs.length).toBe(1)
    const declined = await decideRegistration((await reload(openId))!, regs[0]!, false, '', k7)
    expect(declined.ok).toBe(false)
    const approved = await decideRegistration((await reload(openId))!, regs[0]!, true, 'Welcome', k7)
    expect(approved.ok && approved.value.status).toBe('approved')
    const view = await loadSchemeFor(A, openId)
    expect(view?.registration?.status).toBe('approved')
    const p = await progressOf(A.scope, view!.scheme)
    expect(p.provisional).toBe(true)
    expect(p.deals.map((d) => d.value)).toEqual([650000])
    expect(p.standing.slabIndex).toBe(0)
    // B never reads A's registration through its scope.
    const bView = await loadSchemeFor(B, closedId)
    expect(bView?.registration?.orgId).toBe(B.org.id)
  })

  it('computes the closed scheme, adjusts with a reason, publishes, and the partner reads the result only then', async () => {
    const notYet = await runEligibility((await reload(openId))!, k7.actor)
    expect(notYet.ok).toBe(false)
    const due = await runDueSchemes(k7.actor)
    expect(due.schemes.some((n) => n.includes('Closed'))).toBe(true)
    let results = await listResults(closedId)
    expect(results.length).toBe(2)
    const a = results.find((r) => r.orgId === A.org.id)!
    const b = results.find((r) => r.orgId === B.org.id)!
    expect(a.achieved).toBe(700000)
    expect(a.dealsCounted.length).toBe(2)
    expect(a.eligible).toBe(true)
    expect(a.slabIndex).toBe(0)
    expect(b.achieved).toBe(0)
    expect(b.eligible).toBe(false)
    expect(b.gap).toBe(500000)
    // Not published: the partner sees nothing yet.
    expect(await resultFor(A.scope, (await reload(closedId))!)).toBeNull()
    // Adjust A down below the target with a reason; a second run keeps the adjustment.
    const noReason = await adjustResult((await reload(closedId))!, a, -300000, '', k7)
    expect(noReason.ok).toBe(false)
    const adj = await adjustResult((await reload(closedId))!, a, -300000, 'Credit note on K7D-2', k7)
    expect(adj.ok && adj.value.final).toBe(400000)
    expect(adj.ok && adj.value.eligible).toBe(false)
    const rerun = await runEligibility((await reload(closedId))!, k7.actor)
    expect(rerun.ok && rerun.computed).toBe(2)
    const a2 = (await loadResultK7(closedId, A.org.partnerId))!
    expect(a2.adjustment.amount).toBe(-300000)
    expect(a2.final).toBe(400000)
    const back = await adjustResult((await reload(closedId))!, a2, 0, 'Credit note withdrawn', k7)
    expect(back.ok && back.value.eligible).toBe(true)
    // Publish: the partner reads it, the dispute window is the scheme's 7 days, the payout can be recorded.
    const early = await setPayout((await reload(closedId))!, (await loadResultK7(closedId, A.org.partnerId))!, 'paid', 'UTR1', '', k7)
    expect(early.ok).toBe(false)
    const pub = await publishResults((await reload(closedId))!, k7)
    expect(pub.ok).toBe(true)
    const sc = (await reload(closedId))!
    expect(sc.results.publishedAt).toBeTruthy()
    expect(await publishResults(sc, k7).then((r) => r.ok)).toBe(false)
    const mine = await resultFor(A.scope, sc)
    expect(mine?.eligible).toBe(true)
    expect(mine?.dealsCounted.map((d) => d.value)).toEqual([400000, 300000])
    const theirs = await resultFor(B.scope, sc)
    expect(theirs?.orgId).toBe(B.org.id)
    expect(theirs?.eligible).toBe(false)
    const rows = await schemesFor(A)
    expect(rows.find((r) => r.scheme.id === closedId)?.result?.eligible).toBe(true)
    // Dispute by B's admin, inside the window; A's sales user cannot dispute.
    const dispute = await raiseDispute(B, sc, theirs!, 'Our deal with Customer 9 was won in the window and is missing.')
    expect(dispute.ok && dispute.value.dispute.status).toBe('open')
    const twice = await raiseDispute(B, sc, dispute.ok ? dispute.value : theirs!, 'Again, please.')
    expect(twice.ok).toBe(false)
    const notAdmin = await raiseDispute({ ...A, roles: ['sales'] }, sc, mine!, 'A sales user tries to dispute this.')
    expect(notAdmin.ok).toBe(false)
    results = await listResults(closedId)
    expect(results.find((r) => r.orgId === B.org.id)?.dispute.status).toBe('open')
    // Payout for A: a processed payout needs a reference.
    const noRef = await setPayout(sc, mine!, 'processed', '', '', k7)
    expect(noRef.ok).toBe(false)
    const paid = await setPayout(sc, mine!, 'paid', 'UTR-123', 'Against invoice 118', k7)
    expect(paid.ok && paid.value.payout.status).toBe('paid')
    const forB = await setPayout(sc, theirs!, 'paid', 'UTR-9', '', k7)
    expect(forB.ok).toBe(false) // not eligible
    // The Finance rows carry the partner's facts.
    const fin = await financeRows(sc)
    expect(fin.length).toBe(2)
    const csv = financeCsv(fin)
    expect(csv).toContain(A.org.partnerId)
    expect(csv).toContain('33AAAAA0000A1Z5')
    expect(csv).toContain('UTR-123')
    expect(csv).toContain(A.user.email)
    // The trail: rows on both organisations.
    const trail = await payload.find({ collection: 'partner-audit', where: { and: [{ object: { equals: 'partner-eligibility' } }, { orgId: { equals: A.org.id } }] }, limit: 50, depth: 0, overrideAccess: true })
    expect(trail.docs.map((d) => (d as { action: string }).action)).toEqual(expect.arrayContaining(['scheme.result.computed', 'scheme.result.adjusted', 'scheme.payout']))
    const bell = await payload.find({ collection: 'partner-notifications', where: { and: [{ orgId: { equals: B.org.id } }, { event: { equals: 'scheme.results.published' } }] }, limit: 5, depth: 0, overrideAccess: true })
    expect(bell.totalDocs).toBe(1)
  })
})

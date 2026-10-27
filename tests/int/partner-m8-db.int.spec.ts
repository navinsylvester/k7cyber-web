import configPromise from '@payload-config'
import { getPayload, type Payload, type Where } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { submitDeal } from '@/lib/partner/deals'
import { EMPTY_DEAL_INPUT } from '@/lib/partner/deals-model'
import { digestPass, listNotifications, resetTemplate, saveTemplate, templateFor } from '@/lib/partner/notify'
import { orgRel } from '@/lib/partner/scope'
import type { PartnerContext } from '@/lib/partner/session'
import { openClocks, sweepSla } from '@/lib/partner/sla'
import { toOrg, toUser } from '@/lib/partner/users'

/* M8 against the local Postgres (docs/partner-portal/04-portal-guide.md): a template changes what the bell row says and how it
   is delivered; the digest pass mails (or, without SMTP, marks) the rows that waited and removes old read rows; the SLA
   sweep notices a deal and an application that waited past the target, once per clock. Runs only with PARTNER_DB_TESTS=1;
   rows are removed again and the template put back as it was. No mail leaves: no SMTP_URL in tests. */

const enabled = process.env.PARTNER_DB_TESTS === '1' && Boolean(process.env.DATABASE_URL)
const stamp = Date.now()
const EVENT = 'deal.received'

describe.skipIf(!enabled)('templates, the digest and the SLA sweep (database)', () => {
  let payload: Payload
  let orgId = ''
  let appId = ''
  let A: PartnerContext
  let productId = ''
  let before: Awaited<ReturnType<typeof templateFor>> = null
  let writesBefore: string | undefined
  const partnerId = `K7P-7${String(stamp % 1000).padStart(3, '0')}1`
  const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString()

  beforeAll(async () => {
    payload = await getPayload({ config: configPromise })
    writesBefore = process.env.DATAVERSE_WRITES_ENABLED
    process.env.DATAVERSE_WRITES_ENABLED = '0'
    before = await templateFor(EVENT)
    // The waiver keeps the deal clear of deals.requireCertificate (on in the development settings since M11).
    const org = await payload.create({ collection: 'partner-orgs', overrideAccess: true, depth: 0, data: { partnerId, type: 'var', status: 'approved', waiverUntil: '2099-12-31', name: `PP-TEST M8 ${stamp}`, country: 'India', city: 'Chennai', state: 'Tamil Nadu', address: '1 Test Road', pin: '600001', regions: [] } as never })
    orgId = String(org.id)
    const user = await payload.create({ collection: 'partner-users', overrideAccess: true, depth: 0, data: { org: orgRel({ orgId }), email: `pp-test-m8-${stamp}@k7computing.com`, name: 'M8 Admin', roles: ['admin'], status: 'active', lastSignInAt: new Date().toISOString() } as never })
    const p = await payload.create({ collection: 'partner-products', overrideAccess: true, depth: 0, data: { name: `PP-TEST M8 Product ${stamp}`, sku: `PPM8-${stamp}`, family: 'Test', active: true, order: 999 } as never })
    productId = String(p.id)
    const o = toOrg(org as unknown as Record<string, unknown>)
    const u = toUser(user as unknown as Record<string, unknown>)
    A = { kind: 'partner', user: u, org: o, scope: { orgId }, roles: u.roles, actor: { kind: 'partner', id: u.id, name: u.name, email: u.email } }
  })

  afterAll(async () => {
    if (writesBefore === undefined) delete process.env.DATAVERSE_WRITES_ENABLED
    else process.env.DATAVERSE_WRITES_ENABLED = writesBefore
    if (before) await saveTemplate(EVENT, before, before.updatedBy)
    else await resetTemplate(EVENT)
    for (const c of ['partner-deals', 'partner-users', 'partner-outbox', 'partner-audit', 'partner-notifications'] as const) {
      const where: Where = c === 'partner-users' || c === 'partner-deals' ? { org: { equals: orgId } } : { orgId: { equals: orgId } }
      const r = await payload.find({ collection: c, where, limit: 200, depth: 0, overrideAccess: true })
      for (const d of r.docs) await payload.delete({ collection: c, id: d.id, overrideAccess: true }).catch(() => null)
    }
    if (appId) await payload.delete({ collection: 'partner-applications', id: appId, overrideAccess: true }).catch(() => null)
    if (productId) await payload.delete({ collection: 'partner-products', id: productId, overrideAccess: true }).catch(() => null)
    if (orgId) await payload.delete({ collection: 'partner-orgs', id: orgId, overrideAccess: true }).catch(() => null)
    const staff = await payload.find({ collection: 'partner-notifications', where: { or: [{ subject: { contains: partnerId } }, { subject: { contains: `M8 ${stamp}` } }, { subject: { contains: `M8 Customer ${stamp}` } }, { subject: { contains: `K7A-T${String(stamp).slice(-4)}` } }] }, limit: 100, depth: 0, overrideAccess: true })
    for (const d of staff.docs) await payload.delete({ collection: 'partner-notifications', id: d.id, overrideAccess: true })
    const trail = await payload.find({ collection: 'partner-audit', where: { objectLabel: { contains: `K7A-T${String(stamp).slice(-4)}` } }, limit: 100, depth: 0, overrideAccess: true })
    for (const d of trail.docs) await payload.delete({ collection: 'partner-audit', id: d.id, overrideAccess: true })
  })

  it('renders the bell row from the template and holds the email for the digest', async () => {
    await saveTemplate(EVENT, { enabled: true, delivery: 'digest', subject: 'Got {{dealId}} for {{customer}} · {{partnerId}}', body: 'Dear {{recipient}}, {{body}}' }, 'test@k7computing.com')
    expect((await templateFor(EVENT))?.delivery).toBe('digest')
    const r = await submitDeal(A, { ...EMPTY_DEAL_INPUT, customer: { name: `M8 Customer ${stamp}`, industry: 'Manufacturing', city: 'Chennai', state: 'Tamil Nadu', contactName: 'Priya Raman', designation: 'CIO', email: `cio@m8-${stamp}.in`, phone: '9840000000' }, lines: [{ productId, quantity: 10 }], expectedValue: 250000, closeDate: '2099-01-31', source: 'prospecting', notes: 'Test', resellerName: '' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const rows = await listNotifications({ kind: 'user', userId: A.user.id, scope: A.scope })
    const row = rows.find((x) => x.event === EVENT)
    expect(row).toBeTruthy()
    expect(row!.subject).toBe(`Got ${r.deal.dealId} for M8 Customer ${stamp} · ${partnerId}`)
    expect(row!.body.startsWith('Dear M8 Admin, ')).toBe(true)
    expect(row!.delivery).toBe('digest')
    expect(row!.emailedAt).toBeNull()
    // The staff row for the same submission keeps the code's text: no template for deal.submitted.
    const staff = await payload.find({ collection: 'partner-notifications', where: { and: [{ event: { equals: 'deal.submitted' } }, { subject: { contains: r.deal.dealId } }] }, limit: 1, depth: 0, overrideAccess: true })
    expect(staff.docs[0]?.subject).toMatch(/^New deal K7D-/)
    expect((staff.docs[0] as { delivery?: string } | undefined)?.delivery).toBe('immediate')
  })

  it('digests the rows that waited and removes old read rows', async () => {
    const waiting = await payload.find({ collection: 'partner-notifications', where: { and: [{ orgId: { equals: orgId } }, { delivery: { equals: 'digest' } }] }, limit: 10, depth: 0, overrideAccess: true })
    expect(waiting.docs.length).toBeGreaterThan(0)
    // A row younger than two minutes waits; back-dated, it goes with this pass.
    const first = await digestPass()
    const stillWaiting = await payload.findByID({ collection: 'partner-notifications', id: waiting.docs[0]!.id, depth: 0, overrideAccess: true })
    expect(stillWaiting.digestAt ?? null).toBeNull()
    for (const d of waiting.docs) await payload.update({ collection: 'partner-notifications', id: d.id, data: { createdAt: new Date(Date.now() - 5 * 60_000).toISOString() } as never, overrideAccess: true })
    const old = await payload.create({ collection: 'partner-notifications', overrideAccess: true, data: { audience: 'user', userId: A.user.id, orgId, event: 'test.old', subject: `M8 ${stamp} old`, body: '', href: '', delivery: 'bell', readAt: new Date(Date.now() - 400 * 86_400_000).toISOString() } as never })
    const second = await digestPass()
    expect(second.rows).toBeGreaterThanOrEqual(waiting.docs.length)
    expect(second.mails).toBe(0) // no SMTP_URL in tests
    const after = await payload.findByID({ collection: 'partner-notifications', id: waiting.docs[0]!.id, depth: 0, overrideAccess: true })
    expect(after.digestAt).toBeTruthy()
    expect(after.emailError).toBe('no SMTP_URL')
    expect(first.removed + second.removed).toBeGreaterThanOrEqual(1)
    await expect(payload.findByID({ collection: 'partner-notifications', id: old.id, depth: 0, overrideAccess: true })).rejects.toThrow()
  })

  it('notices a deal and an application past the target once per clock', async () => {
    const deals = await payload.find({ collection: 'partner-deals', where: { org: { equals: orgId } }, limit: 1, depth: 0, overrideAccess: true })
    const deal = deals.docs[0]!
    const thread = (deal.thread as { at: string }[]).map((t) => ({ ...t, at: tenDaysAgo }))
    await payload.update({ collection: 'partner-deals', id: deal.id, data: { submittedAt: tenDaysAgo, thread } as never, overrideAccess: true })
    const app = await payload.create({ collection: 'partner-applications', overrideAccess: true, depth: 0, data: { number: `K7A-T${String(stamp).slice(-4)}`, type: 'var', status: 'submitted', legalName: `PP-TEST M8 Applicant ${stamp}`, country: 'India', contact: { name: 'Asha', email: `asha-${stamp}@k7computing.com`, emailVerifiedAt: tenDaysAgo }, submittedAt: tenDaysAgo, decisions: [{ to: 'submitted', byName: 'Asha', byEmail: 'a@b.c', at: tenDaysAgo }], resumeKey: `k${stamp}` } as never })
    appId = String(app.id)
    const clocks = await openClocks()
    const mine = clocks.filter((c) => c.clock.id === String(deal.id) || c.clock.id === appId)
    expect(mine).toHaveLength(2)
    for (const c of mine) expect(c.reading.state).toBe('breached')
    const r1 = await sweepSla()
    expect(r1.noticed).toContain(String(deal.dealId))
    expect(r1.noticed).toContain(`K7A-T${String(stamp).slice(-4)}`)
    const noticed = await payload.findByID({ collection: 'partner-deals', id: deal.id, depth: 0, overrideAccess: true })
    expect((noticed.sla as { noticedFor?: string })?.noticedFor).toBe(tenDaysAgo)
    const bell = await payload.find({ collection: 'partner-notifications', where: { and: [{ event: { equals: 'sla.breached' } }, { subject: { contains: String(deal.dealId) } }] }, limit: 5, depth: 0, overrideAccess: true })
    expect(bell.docs.length).toBe(1)
    expect(bell.docs[0]?.staffRole).toBe('dealDeskApprover')
    expect(String(bell.docs[0]?.body)).toMatch(/past the \d+ working-hour target/)
    const r2 = await sweepSla()
    expect(r2.noticed).not.toContain(String(deal.dealId))
    expect(r2.noticed).not.toContain(`K7A-T${String(stamp).slice(-4)}`)
  })
})

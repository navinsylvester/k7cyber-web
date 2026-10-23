import configPromise from '@payload-config'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { audit, orgAudit } from '@/lib/partner/audit'
import { listNotifications, markAllRead, notify, unreadCount } from '@/lib/partner/notify'
import { toOrg, toUser } from '@/lib/partner/users'

/* The notification spine and the audit trail against the local Postgres (docs/partner-portal/04-portal-guide.md §4): one bell row
   per partner recipient, one shared row per staff role, read and marked through the organisation scope. Runs only with
   PARTNER_DB_TESTS=1 (it needs the database and writes rows it removes again); no mail leaves because the test turns email off. */

const enabled = process.env.PARTNER_DB_TESTS === '1' && Boolean(process.env.DATABASE_URL)

describe.skipIf(!enabled)('partner notify and audit (database)', () => {
  let payload: Payload
  let orgId = ''
  let userId = ''
  const made: { collection: 'partner-orgs' | 'partner-users' | 'partner-notifications' | 'partner-audit'; id: string | number }[] = []
  const tag = `PP-TEST notify ${Date.now()}`

  beforeAll(async () => {
    payload = await getPayload({ config: configPromise })
    const org = await payload.create({ collection: 'partner-orgs', data: { partnerId: `K7P-T${String(Date.now()).slice(-5)}`, type: 'var', status: 'approved', name: tag, country: 'India' } })
    made.push({ collection: 'partner-orgs', id: org.id })
    orgId = String(org.id)
    const user = await payload.create({ collection: 'partner-users', data: { org: org.id, email: `notify-${Date.now()}@k7computing.com`, name: 'Notify Test', roles: ['admin'], status: 'active' } })
    made.push({ collection: 'partner-users', id: user.id })
    userId = String(user.id)
  })

  afterAll(async () => {
    for (const c of ['partner-notifications', 'partner-audit'] as const) {
      const r = await payload.find({ collection: c, where: { orgId: { equals: orgId } }, limit: 100, depth: 0 })
      for (const d of r.docs) await payload.delete({ collection: c, id: d.id })
    }
    const staff = await payload.find({ collection: 'partner-notifications', where: { subject: { equals: tag } }, limit: 100, depth: 0 })
    for (const d of staff.docs) await payload.delete({ collection: 'partner-notifications', id: d.id })
    for (const m of made.reverse()) await payload.delete({ collection: m.collection, id: m.id })
  })

  it('writes one bell row per partner recipient, scoped to the organisation, and the reader can clear it', async () => {
    const user = toUser((await payload.findByID({ collection: 'partner-users', id: userId, depth: 0 })) as unknown as Record<string, unknown>)
    const org = toOrg((await payload.findByID({ collection: 'partner-orgs', id: orgId, depth: 0 })) as unknown as Record<string, unknown>)
    expect(org.status).toBe('approved')
    const scope = { kind: 'user' as const, userId, scope: { orgId } }
    expect(await unreadCount(scope)).toBe(0)
    const r = await notify({ event: 'test.event', subject: tag, body: 'A test notification.', href: '/partners/portal', to: [{ kind: 'user', user }, { kind: 'org', orgId, roles: ['sales'] }], email: false })
    // The user once; the org recipient asked for sales users and the only user is an admin.
    expect(r).toEqual({ bell: 1, emailed: 0, queued: 0, suppressed: [] })
    expect(await unreadCount(scope)).toBe(1)
    const rows = await listNotifications(scope)
    expect(rows.map((x) => x.subject)).toEqual([tag])
    // Another organisation's scope sees nothing of it.
    expect(await listNotifications({ kind: 'user', userId, scope: { orgId: '0' } })).toEqual([])
    expect(await markAllRead(scope)).toBe(1)
    expect(await unreadCount(scope)).toBe(0)
  })

  it('writes one shared row per staff role that the holders read together', async () => {
    const r = await notify({ event: 'test.staff', subject: tag, body: 'For the channel managers.', to: { kind: 'staff', role: 'channelManager' }, email: false })
    expect(r.bell).toBe(1)
    const rows = await listNotifications({ kind: 'staff', roles: ['channelManager', 'schemeAdmin'] })
    expect(rows.some((x) => x.subject === tag)).toBe(true)
    expect((await listNotifications({ kind: 'staff', roles: ['trainingAdmin'] })).some((x) => x.subject === tag)).toBe(false)
    expect((await listNotifications({ kind: 'staff', roles: [] })).some((x) => x.subject === tag)).toBe(false)
  })

  it('records the trail and lists it under the organisation', async () => {
    await audit({ actor: { kind: 'k7', id: 'x', name: 'Tester', email: 'tester@k7computing.com' }, object: 'partner-orgs', objectId: orgId, objectLabel: 'K7P-TEST', action: 'org.test', from: 'a', to: 'b', orgId, comment: tag })
    const rows = await orgAudit({ orgId })
    expect(rows[0]).toMatchObject({ action: 'org.test', from: 'a', to: 'b', objectLabel: 'K7P-TEST', comment: tag, actor: { kind: 'k7', name: 'Tester' } })
    expect(await orgAudit({ orgId: '0' })).toEqual([])
  })
})

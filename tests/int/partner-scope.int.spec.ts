import configPromise from '@payload-config'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { orgAudit } from '@/lib/partner/audit'
import { addMember, listMembers, loadMember, removeMember, setMemberStatus, updateMember } from '@/lib/partner/members'
import { decideLegalEdit, proposeLegalEdit, saveOrgDetails, scopedOrg, setOrgStatus, withdrawLegalEdit } from '@/lib/partner/organisation'
import type { K7Context, PartnerContext } from '@/lib/partner/session'
import { getPartnerSettings } from '@/lib/partner/settings'
import { orgRel } from '@/lib/partner/scope'
import { canSignIn, findPartnerUserByEmail, toOrg, toUser } from '@/lib/partner/users'

/* The organisation scope, pinned against the local Postgres (FR-ROLE-01, docs/partner-portal/04-portal-guide.md §7): two
   organisations with their people; every read a partner page makes with organisation A's scope returns nothing of B's, by
   list or by id. Then M3's moves through the libraries: the details save at once, a legal edit waits and is decided, the
   member rules hold, suspension stops the door. Runs only with PARTNER_DB_TESTS=1; rows are removed again. No mail leaves. */

const enabled = process.env.PARTNER_DB_TESTS === '1' && Boolean(process.env.DATABASE_URL)
const stamp = Date.now()
const k7: K7Context = { kind: 'k7', email: 'cm@k7computing.com', name: 'Test CM', userId: '', dev: true, roles: ['channelManager'], actor: { kind: 'k7', id: 'cm', name: 'Test CM', email: 'cm@k7computing.com' } }

describe.skipIf(!enabled)('organisation scope and M3 moves (database)', () => {
  let payload: Payload
  const orgIds: string[] = []
  const userIds: string[] = []
  let A: PartnerContext
  let B: PartnerContext

  const makeOrg = async (tag: string, n: number) => {
    const doc = await payload.create({ collection: 'partner-orgs', overrideAccess: true, depth: 0, data: { partnerId: `K7P-9${String(stamp % 1000).padStart(3, '0')}${n}`, type: 'var', status: 'approved', name: `PP-TEST Scope ${tag} ${stamp}`, country: 'India', city: 'Chennai', state: 'Tamil Nadu', address: '1 Test Road', pin: '600001', regions: [] } as never })
    orgIds.push(String(doc.id))
    return toOrg(doc as unknown as Record<string, unknown>)
  }
  const makeUser = async (orgId: string, tag: string, roles: ('admin' | 'sales' | 'technical')[]) => {
    const doc = await payload.create({ collection: 'partner-users', overrideAccess: true, depth: 0, data: { org: orgRel({ orgId }), email: `pp-test-scope-${tag}-${stamp}@k7computing.com`, name: `Scope ${tag}`, roles, status: 'active', lastSignInAt: new Date().toISOString() } as never })
    userIds.push(String(doc.id))
    return toUser(doc as unknown as Record<string, unknown>)
  }
  const ctx = (org: ReturnType<typeof toOrg>, user: ReturnType<typeof toUser>): PartnerContext => ({ kind: 'partner', user, org, scope: { orgId: org.id }, roles: user.roles, actor: { kind: 'partner', id: user.id, name: user.name, email: user.email } })

  beforeAll(async () => {
    payload = await getPayload({ config: configPromise })
    const [oa, ob] = await Promise.all([makeOrg('A', 1), makeOrg('B', 2)])
    const [ua, ub] = await Promise.all([makeUser(oa.id, 'a-admin', ['admin']), makeUser(ob.id, 'b-admin', ['admin'])])
    await makeUser(ob.id, 'b-sales', ['sales'])
    A = ctx(oa, ua)
    B = ctx(ob, ub)
  })

  afterAll(async () => {
    for (const c of ['partner-users', 'partner-audit', 'partner-notifications'] as const) {
      for (const orgId of orgIds) {
        const r = await payload.find({ collection: c, where: c === 'partner-users' ? { org: { equals: orgId } } : { orgId: { equals: orgId } }, limit: 200, depth: 0, overrideAccess: true })
        for (const d of r.docs) await payload.delete({ collection: c, id: d.id, overrideAccess: true }).catch(() => null)
      }
    }
    for (const id of orgIds) await payload.delete({ collection: 'partner-orgs', id, overrideAccess: true }).catch(() => null)
    const staff = await payload.find({ collection: 'partner-notifications', where: { subject: { contains: `K7P-9${String(stamp % 1000).padStart(3, '0')}` } }, limit: 100, depth: 0, overrideAccess: true })
    for (const d of staff.docs) await payload.delete({ collection: 'partner-notifications', id: d.id, overrideAccess: true })
  })

  it('never lets organisation A read organisation B, by list or by id', async () => {
    const a = await listMembers(A.scope)
    const b = await listMembers(B.scope)
    expect(a.map((u) => u.orgId)).toEqual([A.org.id])
    expect(b).toHaveLength(2)
    expect(b.every((u) => u.orgId === B.org.id)).toBe(true)
    // B's admin by id through A's scope: nothing.
    expect(await loadMember(A.scope, B.user.id)).toBeNull()
    expect(await loadMember(B.scope, B.user.id)).toMatchObject({ id: B.user.id })
    // The trail is scoped the same way.
    const regions = (await getPartnerSettings()).regions.slice(0, 1).map((r) => r.code)
    const saved = await saveOrgDetails(B, { tradeName: 'B Trading', address: '2 Test Road', city: 'Chennai', state: 'Tamil Nadu', country: 'India', pin: '600002', website: 'example.com', regions })
    expect(saved.ok).toBe(true)
    expect(saved.ok && saved.org.website).toBe('https://example.com')
    const trailA = await orgAudit(A.scope)
    expect(trailA.every((t) => t.orgId === A.org.id)).toBe(true)
    expect((await orgAudit(B.scope)).some((t) => t.action === 'org.details-updated')).toBe(true)
    expect((await scopedOrg(B.scope))?.tradeName).toBe('B Trading')
    expect((await scopedOrg(A.scope))?.tradeName).toBe('')
  })

  it('keeps the organisation from locking itself out and keeps one email to one organisation', async () => {
    // The only admin cannot demote or disable themselves, nor be removed.
    expect(await updateMember(A, A.user, { name: A.user.name, designation: '', mobile: '', roles: ['sales'] })).toMatchObject({ ok: false })
    expect(await setMemberStatus(A, A.user, 'disable')).toMatchObject({ ok: false })
    expect(await removeMember(A, A.user)).toMatchObject({ ok: false })
    // B's admin email cannot be added to A.
    const dup = await addMember(A, { name: 'Dup', email: B.user.email, designation: '', mobile: '', roles: ['sales'] })
    expect(dup.ok).toBe(false)
    // A new person is invited with several roles, then disabled, re-enabled as invited, and removed.
    const added = await addMember(A, { name: 'Second Admin', email: `pp-test-scope-a-second-${stamp}@k7computing.com`, designation: 'Director', mobile: '98400 00000', roles: ['admin', 'technical'] })
    expect(added.ok).toBe(true)
    if (!added.ok) return
    userIds.push(added.user.id)
    expect(added.user).toMatchObject({ status: 'invited', roles: ['admin', 'technical'], mobile: '9840000000', orgId: A.org.id })
    // With a second standing admin the first may step down.
    const stepped = await updateMember(A, A.user, { name: A.user.name, designation: '', mobile: '', roles: ['admin', 'sales'] })
    expect(stepped.ok).toBe(true)
    const off = await setMemberStatus(A, added.user, 'disable')
    expect(off.ok && off.user.status).toBe('disabled')
    expect(canSignIn(off.ok ? off.user : added.user, A.org).ok).toBe(false)
    const on = await setMemberStatus(A, off.ok ? off.user : added.user, 'enable')
    expect(on.ok && on.user.status).toBe('invited')
    expect(await removeMember(A, on.ok ? on.user : added.user)).toEqual({ ok: true })
    expect(await findPartnerUserByEmail(added.user.email)).toBeNull()
  })

  it('proposes a legal-identity edit that waits for K7, and applies it on approval', async () => {
    const none = await proposeLegalEdit(A, { name: A.org.name, gstin: '', pan: '' }, 'nothing')
    expect(none.ok).toBe(false)
    const bad = await proposeLegalEdit(A, { name: 'New Name', gstin: 'nope', pan: '' }, 'typo')
    expect(bad.ok).toBe(false)
    const proposed = await proposeLegalEdit(A, { name: `PP-TEST Scope A Renamed ${stamp}`, gstin: '33ABCDE1234F1Z5', pan: 'ABCDE1234F' }, 'Re-registered after a merger')
    expect(proposed.ok).toBe(true)
    if (!proposed.ok) return
    expect(proposed.org.name).toBe(A.org.name) // unchanged until K7 agrees
    expect(proposed.org.pendingLegalEdit).toMatchObject({ name: `PP-TEST Scope A Renamed ${stamp}`, proposedBy: { email: A.user.email } })
    expect((await proposeLegalEdit(A, { name: 'Another', gstin: '', pan: '' }, 'again')).ok).toBe(false) // one at a time
    const withdrawn = await withdrawLegalEdit(A)
    expect(withdrawn.pendingLegalEdit).toBeNull()
    const again = await proposeLegalEdit(A, { name: `PP-TEST Scope A Renamed ${stamp}`, gstin: '', pan: '' }, 'Re-registered after a merger')
    expect(again.ok).toBe(true)
    expect((await decideLegalEdit(A.org, 'decline', '', k7)).ok).toBe(false) // a decline needs a note
    const approved = await decideLegalEdit(A.org, 'approve', 'Checked against the certificate', k7)
    expect(approved.ok).toBe(true)
    if (!approved.ok) return
    expect(approved.org.name).toBe(`PP-TEST Scope A Renamed ${stamp}`)
    expect(approved.org.pendingLegalEdit).toBeNull()
    expect((await decideLegalEdit(approved.org, 'approve', '', k7)).ok).toBe(false)
    expect((await orgAudit(A.scope)).map((t) => t.action)).toEqual(expect.arrayContaining(['org.legal-edit-proposed', 'org.legal-edit-withdrawn', 'org.legal-edit-approved']))
  })

  it('suspends with a reason, which stops the door, and reinstates', async () => {
    expect((await setOrgStatus(B.org, 'suspended', '', k7)).ok).toBe(false)
    const off = await setOrgStatus(B.org, 'suspended', 'Unpaid dues', k7)
    expect(off.ok).toBe(true)
    if (!off.ok) return
    expect(off.org).toMatchObject({ status: 'suspended', suspendedReason: 'Unpaid dues' })
    expect(canSignIn(B.user, off.org)).toEqual({ ok: false, reason: 'org' })
    expect((await findPartnerUserByEmail(B.user.email))?.org.status).toBe('suspended')
    expect((await setOrgStatus(off.org, 'suspended', 'again', k7)).ok).toBe(false)
    const on = await setOrgStatus(off.org, 'approved', '', k7)
    expect(on.ok && on.org.status).toBe('approved')
    expect(on.ok && on.org.suspendedReason).toBe('')
    expect(canSignIn(B.user, on.ok ? on.org : off.org).ok).toBe(true)
  })
})

// @vitest-environment node
import configPromise from '@payload-config'
import { existsSync } from 'fs'
import path from 'path'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { CERTIFICATE_DIR } from '@/collections/partner/PartnerCertificates'
import { certificateBytes, certificatesOfOrg, certificatesOfUser, findForVerification, issueOrgCertificate, k7CertificateLedger, loadCertificate, loadCertificateFor, orgStanding, revokeCertificate, sweepCertificates } from '@/lib/partner/certificates'
import { CERT_NUMBER } from '@/lib/partner/certificates-model'
import { registerBlocked } from '@/lib/partner/deals-model'
import { orgRel } from '@/lib/partner/scope'
import type { K7Context, PartnerContext } from '@/lib/partner/session'
import { getPartnerSettings } from '@/lib/partner/settings'
import { loadCourseFor, recordProgress, startAttempt, submitAttempt, trainingFor } from '@/lib/partner/training'
import { toOrg, toUser } from '@/lib/partner/users'

/* Certificates against the local Postgres (docs/partner-portal/04-portal-guide.md M11): a Sales and a Technical course under
   their tracks; a Sales user of organisation A passes and gets an individual certificate (the row, the PDF on disk, the bell
   row), a second pass at once earns nothing new; the Technical user passes and the organisation meets the default rule, so a
   request goes to the Channel Managers; K7 issues the partner certificate (the mirror on the organisation turns valid and the
   deal gate opens with the switch on); the public lookup reads the minimum; organisation B and a non-holder read nothing; K7
   revokes (the mirror and the gate follow, the waiver reopens it); the sweep reminds once per threshold, expires a backdated
   certificate (the standing reads recertify) and, after a recertification, raises the renewal request. Runs only with
   PARTNER_DB_TESTS=1; every row and file is removed again. */

const enabled = process.env.PARTNER_DB_TESTS === '1' && Boolean(process.env.DATABASE_URL)
const stamp = Date.now()
type Doc = Record<string, unknown>

describe.skipIf(!enabled)('certificates (database)', () => {
  let payload: Payload
  const made: { collection: string; id: string }[] = []
  const remember = (collection: string, id: unknown) => made.push({ collection, id: String(id) })
  let A: PartnerContext
  let Atech: PartnerContext
  let Aadmin: PartnerContext
  let B: PartnerContext
  const K7: K7Context = { kind: 'k7', email: 'pp-test-cm@k7computing.com', name: 'PP-TEST Channel Manager', userId: 'pp-test-cm', dev: true, roles: ['channelManager', 'trainingAdmin'], actor: { kind: 'k7', id: 'pp-test-cm', name: 'PP-TEST Channel Manager', email: 'pp-test-cm@k7computing.com' } }
  let salesCourse = ''
  let techCourse = ''
  let salesModule = ''
  let techModule = ''
  let salesCertId = ''
  let salesCertNumber = ''
  let orgCertId = ''
  let orgCertNumber = ''

  const makeOrg = async (tag: string, n: number) => {
    const doc = await payload.create({ collection: 'partner-orgs', overrideAccess: true, depth: 0, data: { partnerId: `K7P-7${String(stamp % 1000).padStart(3, '0')}${n}`, type: 'var', status: 'approved', name: `PP-TEST Certs ${tag} ${stamp}`, tradeName: `Certs ${tag}`, country: 'India', city: 'Chennai', state: 'TN', address: '1 Road', pin: '600001', regions: ['S'] } as never })
    remember('partner-orgs', doc.id)
    return toOrg(doc as unknown as Doc)
  }
  const makeUser = async (orgId: string, tag: string, roles: string[]) => {
    const doc = await payload.create({ collection: 'partner-users', overrideAccess: true, depth: 0, data: { org: orgRel({ orgId }), email: `pp-test-certs-${tag}-${stamp}@k7computing.com`, name: `Certs ${tag}`, roles, status: 'active', lastSignInAt: new Date().toISOString() } as never })
    remember('partner-users', doc.id)
    return toUser(doc as unknown as Doc)
  }
  const ctx = (org: ReturnType<typeof toOrg>, user: ReturnType<typeof toUser>): PartnerContext => ({ kind: 'partner', user, org, scope: { orgId: org.id }, roles: user.roles, actor: { kind: 'partner', id: user.id, name: user.name, email: user.email } })
  const fresh = async (me: PartnerContext): Promise<PartnerContext> => ({ ...me, org: toOrg((await payload.findByID({ collection: 'partner-orgs', id: Number(me.scope.orgId), depth: 0, overrideAccess: true })) as unknown as Doc) })
  const makeCourse = async (trackKey: string, trackName: string, role: string) => {
    const track = await payload.create({ collection: 'partner-tracks', overrideAccess: true, depth: 0, data: { key: `${trackKey}`, name: trackName, roles: [role], status: 'published', order: 900 } as never }).catch(async () => (await payload.find({ collection: 'partner-tracks', where: { key: { equals: trackKey } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]!)
    if (String((track as unknown as Doc).name) === trackName) remember('partner-tracks', track.id)
    const course = await payload.create({ collection: 'partner-courses', overrideAccess: true, depth: 0, data: { title: `PP-TEST Cert course ${trackKey} ${stamp}`, track: track.id, status: 'published', version: 1, order: 900, questionsPerTest: 2, passMark: 50, timeLimitMinutes: 10 } as never })
    remember('partner-courses', course.id)
    const mod = await payload.create({ collection: 'partner-modules', overrideAccess: true, depth: 0, data: { course: course.id, title: 'One', order: 10, status: 'published', video: 'https://example.com/one.mp4', durationSeconds: 100 } as never })
    remember('partner-modules', mod.id)
    for (const q of [
      { type: 'single', text: 'One?', options: [{ text: 'A', correct: true }, { text: 'B', correct: false }] },
      { type: 'trueFalse', text: 'Two?', options: [{ text: 'True', correct: true }, { text: 'False', correct: false }] },
    ]) {
      const doc = await payload.create({ collection: 'partner-questions', overrideAccess: true, depth: 0, data: { course: course.id, active: true, ...q } as never })
      remember('partner-questions', doc.id)
    }
    return { courseId: String(course.id), moduleId: String(mod.id) }
  }
  /** Watches the one module whole and passes the test with the paper's own correct keys. */
  const pass = async (me: PartnerContext, courseId: string, moduleId: string) => {
    await recordProgress(me, courseId, moduleId, { ranges: [[0, 100]], duration: 100, position: 100 })
    const view = (await loadCourseFor(me, courseId))!
    const started = await startAttempt(me, view)
    if (!started.ok) throw new Error(started.error)
    const right = (name: string): string[] => started.attempt.paper.find((q) => `q_${q.qid}` === name)?.correct ?? []
    const done = await submitAttempt(me, { view, attempt: started.attempt }, right)
    if (!done.ok) throw new Error(done.error)
    expect(done.attempt.passed).toBe(true)
    return done.attempt
  }

  beforeAll(async () => {
    payload = await getPayload({ config: configPromise })
    const orgA = await makeOrg('A', 1)
    const orgB = await makeOrg('B', 2)
    A = ctx(orgA, await makeUser(orgA.id, 'sales', ['sales']))
    Atech = ctx(orgA, await makeUser(orgA.id, 'tech', ['technical']))
    Aadmin = ctx(orgA, await makeUser(orgA.id, 'admin', ['admin']))
    B = ctx(orgB, await makeUser(orgB.id, 'badmin', ['admin']))
    // The rule keys on the track key: the test's tracks must be `sales` and `technical`. The seed may already hold them.
    const s = await makeCourse('sales', `PP-TEST Sales ${stamp}`, 'sales')
    const t = await makeCourse('technical', `PP-TEST Technical ${stamp}`, 'technical')
    salesCourse = s.courseId
    salesModule = s.moduleId
    techCourse = t.courseId
    techModule = t.moduleId
  })

  afterAll(async () => {
    const orgIds = [A.scope.orgId, B.scope.orgId]
    const certs = await payload.find({ collection: 'partner-certificates', where: { org: { in: orgIds.map(Number) } }, limit: 200, depth: 0, overrideAccess: true })
    for (const d of certs.docs as unknown as Doc[]) {
      const fileId = typeof d.file === 'object' && d.file ? (d.file as Doc).id : d.file
      await payload.delete({ collection: 'partner-certificates', id: d.id as number, overrideAccess: true }).catch(() => null)
      if (fileId) await payload.delete({ collection: 'partner-certificate-files', id: fileId as number, overrideAccess: true }).catch(() => null)
    }
    for (const c of ['partner-attempts', 'partner-progress'] as const) {
      const r = await payload.find({ collection: c, where: { course: { in: [Number(salesCourse), Number(techCourse)] } }, limit: 200, depth: 0, overrideAccess: true })
      for (const d of r.docs) await payload.delete({ collection: c, id: d.id, overrideAccess: true }).catch(() => null)
    }
    for (const c of ['partner-notifications', 'partner-audit'] as const) {
      const r = await payload.find({ collection: c, where: { orgId: { in: orgIds } }, limit: 500, depth: 0, overrideAccess: true }).catch(() => ({ docs: [] as { id: string | number }[] }))
      for (const d of r.docs) await payload.delete({ collection: c, id: d.id, overrideAccess: true }).catch(() => null)
    }
    const staffRows = await payload.find({ collection: 'partner-notifications', where: { and: [{ audience: { equals: 'staff' } }, { event: { like: 'org.certificate' } }, { body: { like: `Certs ${stamp}` } }] }, limit: 50, depth: 0, overrideAccess: true }).catch(() => ({ docs: [] as { id: string | number }[] }))
    for (const d of staffRows.docs) await payload.delete({ collection: 'partner-notifications', id: d.id, overrideAccess: true }).catch(() => null)
    for (const m of [...made].reverse()) await payload.delete({ collection: m.collection as 'partner-orgs', id: m.id, overrideAccess: true }).catch(() => null)
  })

  it('a pass issues an individual certificate with its PDF and tells the holder; a second pass at once earns nothing new', async () => {
    await pass(A, salesCourse, salesModule)
    const mine = await certificatesOfUser(A.scope, A.user.id)
    expect(mine).toHaveLength(1)
    const c = mine[0]!
    salesCertId = c.id
    salesCertNumber = c.number
    expect(c.number).toMatch(CERT_NUMBER)
    expect(c.number.startsWith('K7P-C-')).toBe(true)
    expect(c).toMatchObject({ kind: 'individual', status: 'valid', trackKey: 'sales', courseVersion: 1, score: 100, band: 'Distinction', userName: 'Certs sales', orgPartnerId: A.org.partnerId })
    expect(c.expiresAt && c.issuedAt && c.expiresAt > c.issuedAt).toBe(true)
    expect(c.fileId).toBeTruthy()
    const file = (await payload.findByID({ collection: 'partner-certificate-files', id: Number(c.fileId), depth: 0, overrideAccess: true })) as unknown as Doc
    expect(existsSync(path.join(CERTIFICATE_DIR, String(file.filename)))).toBe(true)
    const bytes = await certificateBytes(c)
    expect(bytes?.name).toBe(`${c.number}.pdf`)
    expect(Buffer.from(bytes!.bytes.slice(0, 5)).toString()).toBe('%PDF-')
    const bell = await payload.find({ collection: 'partner-notifications', where: { and: [{ userId: { equals: A.user.id } }, { event: { equals: 'training.certificate.issued' } }] }, limit: 5, depth: 0, overrideAccess: true })
    expect(bell.totalDocs).toBe(1)
    expect(String((bell.docs[0] as unknown as Doc).subject)).toContain(c.number)
    // The course view carries it and the standing stays passed.
    const view = (await loadCourseFor(A, salesCourse))!
    expect(view.certificates.map((x) => x.id)).toEqual([c.id])
    expect(view.standing.test).toBe('passed')
    expect(view.standing.certificate).toMatchObject({ state: 'valid', number: c.number })
    // A retake while the certificate stands outside the reminder window prints no second certificate.
    await pass(A, salesCourse, salesModule)
    expect(await certificatesOfUser(A.scope, A.user.id)).toHaveLength(1)
    // One Sales person does not meet the default rule (Sales 1 and Technical 1): no request yet.
    const standing = await orgStanding(A.scope)
    expect(standing.rule.configured).toBe(true)
    expect(standing.rule.met).toBe(false)
    expect(standing.current).toBeNull()
  })

  it('the Technical pass meets the rule and raises the request to the Channel Managers; K7 issues, the mirror and the deal gate follow', async () => {
    await pass(Atech, techCourse, techModule)
    const standing = await orgStanding(A.scope)
    expect(standing.rule.met).toBe(true)
    expect(standing.current?.status).toBe('requested')
    expect(standing.current?.number.startsWith('K7P-O-')).toBe(true)
    expect(standing.current?.ruleLines.map((l) => `${l.track}:${l.have}/${l.need}`)).toEqual(['sales:1/1', 'technical:1/1'])
    const staffBell = await payload.find({ collection: 'partner-notifications', where: { and: [{ staffRole: { equals: 'channelManager' } }, { event: { equals: 'org.certificate.requested' } }, { body: { like: `Certs A ${stamp}` } }] }, limit: 5, depth: 0, overrideAccess: true })
    expect(staffBell.totalDocs).toBe(1)
    // The request itself does not verify, and the organisation is not yet certified for the gate.
    expect(await findForVerification(standing.current!.number)).toBeNull()
    expect(registerBlocked((await fresh(A)).org, A.user, true)).toMatch(/needs a valid partner certificate/)
    // K7 issues.
    const issued = await issueOrgCertificate({ orgId: A.scope.orgId, requestId: standing.current!.id }, K7)
    expect(issued.ok).toBe(true)
    if (!issued.ok) return
    orgCertId = issued.certificate.id
    orgCertNumber = issued.certificate.number
    expect(issued.certificate).toMatchObject({ id: standing.current!.id, status: 'valid', issuedBy: 'PP-TEST Channel Manager', orgType: 'var' })
    expect(issued.certificate.fileId).toBeTruthy()
    const org = (await fresh(A)).org
    expect(org.certificate.status).toBe('valid')
    expect(org.certificate.until).toBe(issued.certificate.expiresAt)
    expect(registerBlocked(org, A.user, true)).toBeNull()
    // A second issue is refused while one is current.
    const again = await issueOrgCertificate({ orgId: A.scope.orgId }, K7)
    expect(again.ok).toBe(false)
    const adminBell = await payload.find({ collection: 'partner-notifications', where: { and: [{ userId: { equals: Aadmin.user.id } }, { event: { equals: 'org.certificate.issued' } }] }, limit: 5, depth: 0, overrideAccess: true })
    expect(adminBell.totalDocs).toBe(1)
  })

  it('the public page reads the minimum; organisation B and a non-holder read nothing; the admin and K7 read it', async () => {
    const v = await findForVerification(orgCertNumber)
    expect(v).toMatchObject({ kind: 'org', state: 'valid', genuine: true, holder: `PP-TEST Certs A ${stamp}`, partnerId: A.org.partnerId, about: 'K7 Partner Programme' })
    const vi = await findForVerification(salesCertNumber)
    expect(vi).toMatchObject({ kind: 'individual', state: 'valid', holder: 'Certs sales', organisation: 'Certs A' })
    expect(JSON.stringify(vi)).not.toMatch(/k7computing\.com|100|Distinction/)
    expect(await findForVerification('K7P-C-ZZZZZZ')).toBeNull()
    expect(await loadCertificateFor(B, salesCertId)).toBeNull()
    expect(await loadCertificateFor(B, orgCertId)).toBeNull()
    expect(await loadCertificateFor(Atech, salesCertId)).toBeNull()
    expect((await loadCertificateFor(Atech, orgCertId))?.id).toBe(orgCertId)
    expect((await loadCertificateFor(Aadmin, salesCertId))?.id).toBe(salesCertId)
    expect((await loadCertificateFor(A, salesCertId))?.id).toBe(salesCertId)
    expect((await loadCertificate(orgCertId))?.number).toBe(orgCertNumber)
    expect((await certificatesOfOrg(B.scope)).length).toBe(0)
    const ledger = await k7CertificateLedger('all')
    expect(ledger.map((r) => r.c.number)).toEqual(expect.arrayContaining([salesCertNumber, orgCertNumber]))
    expect((await k7CertificateLedger('org')).some((r) => r.c.number === orgCertNumber)).toBe(true)
  })

  it('K7 revokes with a reason: the public page says so, the mirror turns revoked, the gate closes and the waiver reopens it', async () => {
    const c = (await loadCertificate(orgCertId))!
    expect((await revokeCertificate(c, 'x', K7)).ok).toBe(false)
    const r = await revokeCertificate(c, 'Resold outside the agreed territory.', K7)
    expect(r.ok).toBe(true)
    expect(await findForVerification(orgCertNumber)).toMatchObject({ state: 'revoked' })
    expect(JSON.stringify(await findForVerification(orgCertNumber))).not.toMatch(/territory/)
    const org = (await fresh(A)).org
    expect(org.certificate.status).toBe('revoked')
    expect(registerBlocked(org, A.user, true)).toMatch(/certificate/)
    expect(registerBlocked({ ...org, waiverUntil: '2099-01-01' }, A.user, true)).toBeNull()
    expect(registerBlocked(org, A.user, false)).toBeNull()
    // Issuing again after a revocation is a fresh certificate, renewing the revoked one.
    const renewed = await issueOrgCertificate({ orgId: A.scope.orgId }, K7)
    expect(renewed.ok).toBe(true)
    if (!renewed.ok) return
    expect(renewed.certificate.id).not.toBe(orgCertId)
    expect(renewed.certificate.renewalOf).toBe(orgCertNumber)
    expect((await fresh(A)).org.certificate.status).toBe('valid')
  })

  it('the sweep reminds once per threshold, expires a backdated certificate (the standing reads recertify), and the recertification renews the request', async () => {
    const settings = await getPartnerSettings()
    const soon = new Date(Date.now() + 10 * 86400000).toISOString()
    await payload.update({ collection: 'partner-certificates', id: Number(salesCertId), overrideAccess: true, depth: 0, data: { expiresAt: soon } as never })
    const first = await sweepCertificates()
    expect(first.errors).toEqual([])
    let c = (await loadCertificate(salesCertId))!
    const nearest = String(Math.min(...settings.certificates.reminderDays))
    expect(c.reminded[nearest]).toBeTruthy()
    const reminders = await payload.find({ collection: 'partner-notifications', where: { and: [{ userId: { equals: A.user.id } }, { event: { equals: 'training.certificate.expiring' } }] }, limit: 5, depth: 0, overrideAccess: true })
    expect(reminders.totalDocs).toBe(1)
    const second = await sweepCertificates()
    expect(second.errors).toEqual([])
    c = (await loadCertificate(salesCertId))!
    expect(Object.keys(c.reminded).sort()).toEqual([...new Set([nearest, ...settings.certificates.reminderDays.filter((d) => d >= 10).map(String)])].sort())
    expect((await payload.find({ collection: 'partner-notifications', where: { and: [{ userId: { equals: A.user.id } }, { event: { equals: 'training.certificate.expiring' } }] }, limit: 5, depth: 0, overrideAccess: true })).totalDocs).toBe(Object.keys(c.reminded).length)
    // The standing reads recertify while the certificate is expiring.
    let row = (await trainingFor(A)).flatMap((g) => g.courses).find((x) => x.course.id === salesCourse)!
    expect(row.standing.test).toBe('recertify')
    // Backdate past the day: the sweep expires it and tells the holder; the organisation no longer meets the rule.
    await payload.update({ collection: 'partner-certificates', id: Number(salesCertId), overrideAccess: true, depth: 0, data: { expiresAt: new Date(Date.now() - 86400000).toISOString() } as never })
    const third = await sweepCertificates()
    expect(third.errors).toEqual([])
    c = (await loadCertificate(salesCertId))!
    expect(c.status).toBe('expired')
    expect((await payload.find({ collection: 'partner-notifications', where: { and: [{ userId: { equals: A.user.id } }, { event: { equals: 'training.certificate.expired' } }] }, limit: 5, depth: 0, overrideAccess: true })).totalDocs).toBe(1)
    expect((await orgStanding(A.scope)).rule.met).toBe(false)
    row = (await trainingFor(A)).flatMap((g) => g.courses).find((x) => x.course.id === salesCourse)!
    expect(row.standing.test).toBe('recertify')
    // Recertify: a new certificate, the old one left expired (not superseded), the rule met again.
    await pass(A, salesCourse, salesModule)
    const mine = await certificatesOfUser(A.scope, A.user.id)
    expect(mine).toHaveLength(2)
    const fresh2 = mine.find((x) => x.id !== salesCertId)!
    expect(fresh2.status).toBe('valid')
    expect((await loadCertificate(salesCertId))!.status).toBe('expired')
    expect((await orgStanding(A.scope)).rule.met).toBe(true)
    row = (await trainingFor(A)).flatMap((g) => g.courses).find((x) => x.course.id === salesCourse)!
    expect(row.standing.test).toBe('passed')
    // The organisation's certificate is current, so no renewal request; backdate it and the sweep expires it and asks K7 again.
    const orgCur = (await orgStanding(A.scope)).current!
    expect(orgCur.status).toBe('valid')
    await payload.update({ collection: 'partner-certificates', id: Number(orgCur.id), overrideAccess: true, depth: 0, data: { expiresAt: new Date(Date.now() - 86400000).toISOString() } as never })
    const fourth = await sweepCertificates()
    expect(fourth.errors).toEqual([])
    expect(fourth.requested).toBeGreaterThanOrEqual(1)
    const after = await orgStanding(A.scope)
    expect(after.current?.status).toBe('requested')
    expect(after.current?.renewalOf).toBe(orgCur.number)
    expect((await fresh(A)).org.certificate.status).toBe('expired')
  })
})

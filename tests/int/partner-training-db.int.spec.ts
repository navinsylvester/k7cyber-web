// @vitest-environment node
import configPromise from '@payload-config'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { orgRel } from '@/lib/partner/scope'
import type { PartnerContext } from '@/lib/partner/session'
import { importQuestions, k7CourseLedger, k7CourseView, loadAttemptFor, loadCourseFor, loadModuleFor, orgTrainingFor, recordProgress, startAttempt, submitAttempt, trainingFileFor, trainingFor } from '@/lib/partner/training'
import { toOrg, toUser } from '@/lib/partner/users'

/* Training against the local Postgres (docs/partner-portal/04-portal-guide.md M10): a Sales track with one course of two
   modules and a bank; a Sales user of organisation A watches with gaps (no completion), then enough (completion, the duration
   learnt onto the module), the test unlocks only after the second module, an attempt is drawn with the course's rule, graded
   and stored, the pass is read back in the standing and the organisation's view; a Technical user sees no Sales course; the
   Partner Admin of organisation B sees nothing of A; the K7 ledger counts the learner; a CSV import appends to the bank.
   Runs only with PARTNER_DB_TESTS=1; every row is removed again. */

const enabled = process.env.PARTNER_DB_TESTS === '1' && Boolean(process.env.DATABASE_URL)
const stamp = Date.now()

describe.skipIf(!enabled)('training (database)', () => {
  let payload: Payload
  const made: { collection: string; id: string }[] = []
  const remember = (collection: string, id: unknown) => made.push({ collection, id: String(id) })
  let A: PartnerContext
  let Atech: PartnerContext
  let B: PartnerContext
  let courseId = ''
  let m1 = ''
  let m2 = ''
  let bankAttemptId = ''

  const makeOrg = async (tag: string, n: number) => {
    const doc = await payload.create({ collection: 'partner-orgs', overrideAccess: true, depth: 0, data: { partnerId: `K7P-8${String(stamp % 1000).padStart(3, '0')}${n}`, type: 'var', status: 'approved', name: `PP-TEST Training ${tag} ${stamp}`, country: 'India', city: 'Chennai', state: 'TN', address: '1 Road', pin: '600001', regions: ['S'] } as never })
    remember('partner-orgs', doc.id)
    return toOrg(doc as unknown as Record<string, unknown>)
  }
  const makeUser = async (orgId: string, tag: string, roles: string[]) => {
    const doc = await payload.create({ collection: 'partner-users', overrideAccess: true, depth: 0, data: { org: orgRel({ orgId }), email: `pp-test-training-${tag}-${stamp}@k7computing.com`, name: `Training ${tag}`, roles, status: 'active', lastSignInAt: new Date().toISOString() } as never })
    remember('partner-users', doc.id)
    return toUser(doc as unknown as Record<string, unknown>)
  }
  const ctx = (org: ReturnType<typeof toOrg>, user: ReturnType<typeof toUser>): PartnerContext => ({ kind: 'partner', user, org, scope: { orgId: org.id }, roles: user.roles, actor: { kind: 'partner', id: user.id, name: user.name, email: user.email } })

  beforeAll(async () => {
    payload = await getPayload({ config: configPromise })
    const orgA = await makeOrg('A', 1)
    const orgB = await makeOrg('B', 2)
    A = ctx(orgA, await makeUser(orgA.id, 'sales', ['sales']))
    Atech = ctx(orgA, await makeUser(orgA.id, 'tech', ['technical']))
    B = ctx(orgB, await makeUser(orgB.id, 'admin', ['admin']))
    const track = await payload.create({ collection: 'partner-tracks', overrideAccess: true, depth: 0, data: { key: `pp-test-sales-${stamp}`, name: `PP-TEST Sales ${stamp}`, roles: ['sales'], status: 'published', order: 900 } as never })
    remember('partner-tracks', track.id)
    const course = await payload.create({ collection: 'partner-courses', overrideAccess: true, depth: 0, data: { title: `PP-TEST Course ${stamp}`, track: track.id, status: 'published', version: 1, order: 900, questionsPerTest: 3, passMark: 60, timeLimitMinutes: 10 } as never })
    remember('partner-courses', course.id)
    courseId = String(course.id)
    const mod1 = await payload.create({ collection: 'partner-modules', overrideAccess: true, depth: 0, data: { course: course.id, title: 'One', order: 10, status: 'published', video: 'https://example.com/one.mp4' } as never })
    const mod2 = await payload.create({ collection: 'partner-modules', overrideAccess: true, depth: 0, data: { course: course.id, title: 'Two', order: 20, status: 'published', video: 'vimeo:123456789', durationSeconds: 60 } as never })
    const draft = await payload.create({ collection: 'partner-modules', overrideAccess: true, depth: 0, data: { course: course.id, title: 'Draft', order: 30, status: 'draft' } as never })
    for (const m of [mod1, mod2, draft]) remember('partner-modules', m.id)
    m1 = String(mod1.id)
    m2 = String(mod2.id)
    const qs = [
      { type: 'single', text: 'One?', options: [{ text: 'A', correct: true }, { text: 'B', correct: false }] },
      { type: 'single', text: 'Two?', options: [{ text: 'A', correct: false }, { text: 'B', correct: true }] },
      { type: 'multiple', text: 'Three?', options: [{ text: 'A', correct: true }, { text: 'B', correct: true }, { text: 'C', correct: false }] },
      { type: 'trueFalse', text: 'Four?', options: [{ text: 'True', correct: true }, { text: 'False', correct: false }] },
      { type: 'single', text: 'Inactive?', options: [{ text: 'A', correct: true }, { text: 'B', correct: false }], active: false },
    ]
    for (const q of qs) {
      const doc = await payload.create({ collection: 'partner-questions', overrideAccess: true, depth: 0, data: { course: course.id, active: true, ...q } as never })
      remember('partner-questions', doc.id)
    }
  })

  afterAll(async () => {
    for (const c of ['partner-attempts', 'partner-progress'] as const) {
      const r = await payload.find({ collection: c, where: { course: { equals: Number(courseId) } }, limit: 200, depth: 0, overrideAccess: true })
      for (const d of r.docs) await payload.delete({ collection: c, id: d.id, overrideAccess: true }).catch(() => null)
    }
    const imported = await payload.find({ collection: 'partner-questions', where: { course: { equals: Number(courseId) } }, limit: 200, depth: 0, overrideAccess: true })
    for (const d of imported.docs) await payload.delete({ collection: 'partner-questions', id: d.id, overrideAccess: true }).catch(() => null)
    // M11: the certificate sweep may have issued certificates for this test's passes (the backfill) before the rows are removed.
    const certs = await payload.find({ collection: 'partner-certificates', where: { org: { in: [Number(A.scope.orgId), Number(B.scope.orgId)] } }, limit: 200, depth: 0, overrideAccess: true }).catch(() => ({ docs: [] as Record<string, unknown>[] }))
    for (const d of certs.docs as Record<string, unknown>[]) {
      await payload.delete({ collection: 'partner-certificates', id: d.id as number, overrideAccess: true }).catch(() => null)
      if (d.file) await payload.delete({ collection: 'partner-certificate-files', id: d.file as number, overrideAccess: true }).catch(() => null)
    }
    for (const c of ['partner-notifications', 'partner-audit'] as const) {
      const r = await payload.find({ collection: c, where: { orgId: { in: [A.scope.orgId, B.scope.orgId] } }, limit: 200, depth: 0, overrideAccess: true }).catch(() => ({ docs: [] as { id: string | number }[] }))
      for (const d of r.docs) await payload.delete({ collection: c, id: d.id, overrideAccess: true }).catch(() => null)
    }
    for (const m of [...made].reverse()) await payload.delete({ collection: m.collection as 'partner-orgs', id: m.id, overrideAccess: true }).catch(() => null)
  })

  it('the Sales user sees the course, the Technical user does not, and organisation B sees nothing of A', async () => {
    // The development seed may hold other published Sales courses; the test reads its own.
    const mine = (await trainingFor(A)).flatMap((g) => g.courses).find((c) => c.course.id === courseId)
    expect(mine?.standing).toMatchObject({ modulesTotal: 2, modulesDone: 0, test: 'locked' })
    expect((await trainingFor(Atech)).flatMap((g) => g.courses).map((c) => c.course.id)).not.toContain(courseId)
    expect(await loadCourseFor(Atech, courseId)).toBeNull()
    expect(await loadCourseFor(B, courseId)).toBeNull()
    expect(await loadModuleFor(B, courseId, m1)).toBeNull()
  })

  it('watching with gaps does not complete; watching enough does, learns the duration and unlocks the test after the second module', async () => {
    const gaps = await recordProgress(A, courseId, m1, { ranges: [[0, 30], [60, 80]], duration: 100, position: 80 })
    expect(gaps).toMatchObject({ ok: true, share: 0.5, complete: false })
    let view = (await loadCourseFor(A, courseId))!
    expect(view.standing.modulesDone).toBe(0)
    expect(view.standing.unlock.ok).toBe(false)
    const more = await recordProgress(A, courseId, m1, { ranges: [[29, 61], [79, 100]], position: 100 })
    expect(more).toMatchObject({ ok: true, share: 1, complete: true })
    const modDoc = await payload.findByID({ collection: 'partner-modules', id: Number(m1), depth: 0, overrideAccess: true })
    expect(modDoc.durationSeconds).toBe(100)
    view = (await loadCourseFor(A, courseId))!
    expect(view.standing.modulesDone).toBe(1)
    expect(view.progress.get(m1)?.completedAt).toBeTruthy()
    expect(view.progress.get(m1)?.lastPosition).toBe(100)
    const locked = await startAttempt(A, view)
    expect(locked.ok).toBe(false)
    const second = await recordProgress(A, courseId, m2, { ranges: [[0, 55]], duration: 60, position: 55 })
    expect(second).toMatchObject({ ok: true, complete: true })
    view = (await loadCourseFor(A, courseId))!
    expect(view.standing.test).toBe('ready')
    // The other organisation's admin cannot credit a module of A's course.
    expect((await recordProgress(B, courseId, m1, { ranges: [[0, 100]], duration: 100 })).ok).toBe(false)
  })

  it('draws the paper by the course’s rule, resumes the open attempt, grades the submission and reads the pass back', async () => {
    const view = (await loadCourseFor(A, courseId))!
    const started = await startAttempt(A, view)
    expect(started.ok).toBe(true)
    if (!started.ok) return
    const a = started.attempt
    bankAttemptId = a.id
    expect(a.paper).toHaveLength(3)
    expect(a.paper.map((q) => q.text)).not.toContain('Inactive?')
    expect(a.passMark).toBe(60)
    expect(a.expiresAt).toBeTruthy()
    const again = await startAttempt(A, (await loadCourseFor(A, courseId))!)
    expect(again.ok && again.attempt.id).toBe(a.id)
    const found = (await loadAttemptFor(A, courseId, a.id))!
    expect(found.attempt.status).toBe('open')
    expect(await loadAttemptFor(B, courseId, a.id)).toBeNull()
    // Answer every question right but one.
    const wrong = found.attempt.paper[0]!
    const answers = (name: string): string[] => {
      const q = found.attempt.paper.find((x) => `q_${x.qid}` === name)
      if (!q) return []
      if (q.qid === wrong.qid) return [q.options.find((o) => !q.correct.includes(o.key))!.key]
      return q.correct
    }
    const done = await submitAttempt(A, found, answers)
    expect(done.ok).toBe(true)
    if (!done.ok) return
    expect(done.attempt).toMatchObject({ status: 'submitted', correct: 2, total: 3, score: 67, passed: true, courseVersion: 1 })
    expect(done.attempt.answers[wrong.qid]).toHaveLength(1)
    const twice = await submitAttempt(A, { view, attempt: done.attempt }, answers)
    expect(twice.ok).toBe(false)
    const after = (await loadCourseFor(A, courseId))!
    expect(after.standing.test).toBe('passed')
    expect(after.standing.pass?.id).toBe(a.id)
    const bell = await payload.find({ collection: 'partner-notifications', where: { and: [{ event: { equals: 'training.course.passed' } }, { orgId: { equals: A.scope.orgId } }] }, limit: 5, depth: 0, overrideAccess: true })
    expect(bell.totalDocs).toBeGreaterThanOrEqual(1)
  })

  it('the organisation view and the K7 ledgers read the same learner; a training file is only reachable through a module', async () => {
    const org = await orgTrainingFor(A)
    const sales = org.find((r) => r.user.id === A.user.id)!
    expect(sales.groups.flatMap((g) => g.courses).find((c) => c.course.id === courseId)?.standing.test).toBe('passed')
    const tech = org.find((r) => r.user.id === Atech.user.id)!
    expect(tech.groups.flatMap((g) => g.courses).map((c) => c.course.id)).not.toContain(courseId)
    const ledger = await k7CourseLedger()
    const row = ledger.find((r) => r.course.id === courseId)!
    expect(row).toMatchObject({ modules: 2, modulesDraft: 1, bank: 4, bankTotal: 5, learners: 1, completed: 1, passed: 1, attempts: 1, passRate: 100 })
    const k7 = (await k7CourseView(courseId))!
    expect(k7.learners[0]).toMatchObject({ userId: A.user.id, modulesDone: 2, modulesTotal: 2, attempts: 1 })
    expect(k7.learners[0]!.pass?.id).toBe(bankAttemptId)
    expect(k7.invalid.map((x) => x.why)).toEqual(['Inactive'])
    expect(await trainingFileFor(A, '999999999')).toBeNull()
  })

  it('a CSV import appends to the bank and reports the refused rows', async () => {
    const course = (await loadCourseFor(A, courseId))!.course
    const csv = ['type,question,option1,option2,option3,correct', 'single,Imported one?,A,B,,2', 'trueFalse,Imported two?,,,,false', 'single,Broken,A,B,,9'].join('\n')
    const r = await importQuestions(course, csv, { kind: 'k7', email: 'trainer@k7computing.com', name: 'Trainer', userId: 't', dev: true, roles: ['trainingAdmin'], actor: { kind: 'k7', id: 't', name: 'Trainer', email: 'trainer@k7computing.com' } })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.imported).toBe(2)
    expect(r.errors.map((e) => e.line)).toEqual([4])
    const k7 = (await k7CourseView(courseId))!
    expect(k7.bank.filter((q) => q.text.startsWith('Imported'))).toHaveLength(2)
    expect(k7.askable).toBe(6)
  })
})

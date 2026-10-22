import configPromise from '@payload-config'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { nextId } from '@/lib/partner/ids'
import { approveApplication, assignApplication, createDraft, decideApplication, findByNumber, listApplications, loadByKey, markVerified, saveDetails, submitApplication } from '@/lib/partner/registration'
import type { K7Context } from '@/lib/partner/session'
import { getPartnerSettings } from '@/lib/partner/settings'
import { findPartnerUserByEmail } from '@/lib/partner/users'

/* Onboarding against the local Postgres (docs/partner-portal/04-portal-guide.md M2): a draft becomes a submitted application with a
   number, a clarification sends it back and a resubmission returns it, approval creates the organisation with the next partner ID
   and the Partner Admin, and the CRM job is queued (the mirror stays off here, so nothing reaches Dynamics). Runs only with
   PARTNER_DB_TESTS=1; rows are removed again. No mail leaves: no SMTP_URL in tests. Dataverse writes are switched off for the
   run, so a local global with the mirror on cannot push the test organisation to UAT (the job ends `skipped`, not `done`). */

const enabled = process.env.PARTNER_DB_TESTS === '1' && Boolean(process.env.DATABASE_URL)
const stamp = Date.now()
const email = `pp-test-onboarding-${stamp}@k7computing.com`
const me: K7Context = { kind: 'k7', email: 'cm@k7computing.com', name: 'Test CM', userId: '', dev: true, roles: ['channelManager'], actor: { kind: 'k7', id: 'cm', name: 'Test CM', email: 'cm@k7computing.com' } }

describe.skipIf(!enabled)('partner onboarding (database)', () => {
  let payload: Payload
  let appId = ''
  let orgId = ''
  let userId = ''

  let writesBefore: string | undefined
  beforeAll(async () => {
    payload = await getPayload({ config: configPromise })
    writesBefore = process.env.DATAVERSE_WRITES_ENABLED
    process.env.DATAVERSE_WRITES_ENABLED = '0'
  })

  afterAll(async () => {
    if (writesBefore === undefined) delete process.env.DATAVERSE_WRITES_ENABLED
    else process.env.DATAVERSE_WRITES_ENABLED = writesBefore
    if (userId) await payload.delete({ collection: 'partner-users', id: userId }).catch(() => null)
    for (const c of ['partner-outbox', 'partner-audit', 'partner-notifications'] as const) {
      if (!orgId) break
      const r = await payload.find({ collection: c, where: { orgId: { equals: orgId } }, limit: 100, depth: 0 })
      for (const d of r.docs) await payload.delete({ collection: c, id: d.id })
    }
    if (appId) {
      const r = await payload.find({ collection: 'partner-audit', where: { objectId: { equals: appId } }, limit: 100, depth: 0 })
      for (const d of r.docs) await payload.delete({ collection: 'partner-audit', id: d.id })
      await payload.delete({ collection: 'partner-applications', id: appId }).catch(() => null)
    }
    if (orgId) await payload.delete({ collection: 'partner-orgs', id: orgId }).catch(() => null)
    const staff = await payload.find({ collection: 'partner-notifications', where: { subject: { contains: `PP-TEST Onboarding ${stamp}` } }, limit: 100, depth: 0 })
    for (const d of staff.docs) await payload.delete({ collection: 'partner-notifications', id: d.id })
  })

  it('takes a draft through submission, clarification, resubmission and approval', async () => {
    const settings = await getPartnerSettings()
    const regions = settings.regions.slice(0, 1).map((r) => r.code)
    const draft = await createDraft('var')
    appId = draft.id
    expect(draft.status).toBe('draft')
    expect(draft.resumeKey.length).toBeGreaterThan(20)
    expect(await loadByKey(draft.resumeKey)).toMatchObject({ id: draft.id })

    const withDetails = await saveDetails(
      draft,
      { legalName: `PP-TEST Onboarding ${stamp} Private Limited`, tradeName: 'PP-TEST', address: '1 Test Road', city: 'Chennai', state: 'Tamil Nadu', country: 'India', pin: '600001', website: 'example.com', yearOfIncorporation: 2015, size: '11-50', turnover: '1-5', gstin: '', pan: '' },
      { name: 'Test Admin', designation: 'Director', email, mobile: '9840000000' },
      regions,
    )
    expect(withDetails.company.website).toBe('https://example.com')
    // Not verified yet: submission refuses.
    const refused = await submitApplication(withDetails, '2026-10')
    expect(refused.ok).toBe(false)

    const verified = await markVerified(withDetails, { email: true, mobile: 'skipped' })
    expect(verified.contact.emailVerifiedAt).toBeTruthy()
    expect(verified.contact.mobileVerification).toBe('skipped')
    const submitted = await submitApplication(verified, '2026-10')
    expect(submitted.ok).toBe(true)
    if (!submitted.ok) return
    expect(submitted.app.number).toMatch(/^K7A-\d{5}$/)
    expect(submitted.app.status).toBe('submitted')
    expect(submitted.app.terms).toMatchObject({ version: '2026-10' })
    expect((await findByNumber(submitted.app.number))?.id).toBe(draft.id)
    expect((await listApplications({ status: 'open', q: `Onboarding ${stamp}` })).rows.map((a) => a.id)).toEqual([draft.id])

    // Send it back; the number stays; resubmission returns it to the queue.
    const back = await decideApplication(submitted.app, 'clarify', 'Which regions?', me)
    expect(back.ok).toBe(true)
    if (!back.ok) return
    expect(back.app.status).toBe('clarification')
    expect(back.app.assignee.email).toBe(me.email)
    expect(back.app.decisions.map((d) => d.to)).toEqual(['submitted', 'underReview', 'clarification'])
    const again = await submitApplication(back.app, '2026-10')
    expect(again.ok).toBe(true)
    if (!again.ok) return
    expect(again.app.number).toBe(submitted.app.number)
    expect(again.app.status).toBe('submitted')

    // A rejection needs a reason; approval from Submitted assigns first.
    expect((await decideApplication(again.app, 'reject', '', me)).ok).toBe(false)
    const taken = await assignApplication(again.app, me)
    expect(taken.status).toBe('underReview')
    const approved = await approveApplication(taken, 'Welcome', me)
    expect(approved.ok).toBe(true)
    if (!approved.ok) return
    orgId = approved.org!.id
    expect(approved.org!.partnerId).toMatch(/^K7P-\d{5}$/)
    expect(approved.app.status).toBe('approved')
    expect(approved.app.orgId).toBe(orgId)

    const found = await findPartnerUserByEmail(email)
    expect(found).not.toBeNull()
    userId = found!.user.id
    expect(found!.user.roles).toEqual(['admin'])
    expect(found!.user.status).toBe('invited')
    expect(found!.org.partnerId).toBe(approved.org!.partnerId)
    expect(found!.org.status).toBe('approved')

    const jobs = await payload.find({ collection: 'partner-outbox', where: { orgId: { equals: orgId } }, depth: 0 })
    expect(jobs.docs.map((j) => j.kind)).toEqual(['account.create'])
    // Mirror off: pending. Mirror on in the local global: the writes switch stops it at the client, so skipped; never done.
    expect(['pending', 'skipped']).toContain(jobs.docs[0]!.state)

    // The same email cannot become the Partner Admin of a second organisation.
    const second = await approveApplication({ ...taken, id: taken.id }, '', me)
    expect(second.ok).toBe(false)
  })

  it('hands out consecutive numbers', async () => {
    const a = await nextId('deal')
    const b = await nextId('deal')
    expect(Number(b.slice(4)) - Number(a.slice(4))).toBe(1)
  })
})

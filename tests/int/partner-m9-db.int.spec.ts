// @vitest-environment node
import configPromise from '@payload-config'
import { sql } from '@payloadcms/db-postgres/drizzle'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { drainOutbox, enqueueOutbox, loadJob, runJob } from '@/lib/partner/mirror'
import { housekeeping, lastJobRuns, recordJobRun, recentJobRuns } from '@/lib/partner/ops'
import { getPartnerSettings, savePartnerSettings, type PartnerSettings } from '@/lib/partner/settings'
import { syncDeals } from '@/lib/partner/sync'

/* M9 against the local Postgres: the go-live switches hold a job as pending with no attempt counted while its feature is off,
   and let it run once the feature is on (where the writes flag then skips it, no CRM is reached); the read-back refuses when
   its switch is off even when forced; a scheduled run is recorded and read back as the job's newest; housekeeping removes a
   join draft nobody touched for a month and keeps a fresh one. Runs only with PARTNER_DB_TESTS=1; the settings are put back
   as they were and every row removed. */

const enabled = process.env.PARTNER_DB_TESTS === '1' && Boolean(process.env.DATABASE_URL)
const stamp = Date.now()

describe.skipIf(!enabled)('the go-live switches, job runs and housekeeping (database)', () => {
  let payload: Payload
  let before: PartnerSettings
  let writesBefore: string | undefined
  const jobIds: string[] = []
  const draftIds: string[] = []
  const runIds: string[] = []

  const withSettings = async (patch: (s: PartnerSettings) => PartnerSettings) => {
    await savePartnerSettings(patch(structuredClone(before)))
    return getPartnerSettings()
  }

  beforeAll(async () => {
    payload = await getPayload({ config: configPromise })
    before = await getPartnerSettings()
    writesBefore = process.env.DATAVERSE_WRITES_ENABLED
    process.env.DATAVERSE_WRITES_ENABLED = '0'
  })

  afterAll(async () => {
    process.env.DATAVERSE_WRITES_ENABLED = writesBefore
    await savePartnerSettings(before)
    for (const id of jobIds) await payload.delete({ collection: 'partner-outbox', id, overrideAccess: true }).catch(() => null)
    for (const id of draftIds) await payload.delete({ collection: 'partner-applications', id, overrideAccess: true }).catch(() => null)
    for (const id of runIds) await payload.delete({ collection: 'partner-job-runs', id, overrideAccess: true }).catch(() => null)
    const mine = await payload.find({ collection: 'partner-job-runs', where: { summary: { contains: `m9-${stamp}` } }, limit: 50, depth: 0, overrideAccess: true })
    for (const d of mine.docs) await payload.delete({ collection: 'partner-job-runs', id: d.id, overrideAccess: true }).catch(() => null)
  })

  it('a job whose feature is off waits as pending with no attempt, through enqueue and through the drain; on, it runs', async () => {
    await withSettings((s) => ({ ...s, crm: { ...s.crm, enabled: true, features: { ...s.crm.features, opportunityCreate: false } } }))
    const job = await enqueueOutbox({ kind: 'opportunity.create', orgId: '0', object: 'partner-deals', objectId: `m9-${stamp}`, objectLabel: `K7D-M9-${stamp}`, actor: 'test' })
    expect(job).not.toBeNull()
    jobIds.push(job!.id)
    expect(job!.state).toBe('pending')
    expect(job!.attempts).toBe(0)
    const drained = await drainOutbox(200)
    const line = drained.lines.find((l) => l.includes(`K7D-M9-${stamp}`))
    expect(line).toMatch(/waiting, the opportunityCreate feature is off/)
    const after = await loadJob(job!.id)
    expect(after?.state).toBe('pending')
    expect(after?.attempts).toBe(0)
    const held = await runJob(after!)
    expect(held.state).toBe('pending')
    expect(held.lastError).toMatch(/feature is off/)
    // The switch turns: the job runs and the writes flag (off in tests) skips it, one attempt counted, no CRM touched.
    await withSettings((s) => ({ ...s, crm: { ...s.crm, enabled: true, features: { ...s.crm.features, opportunityCreate: true } } }))
    const ran = await runJob(held)
    // The made-up deal fails before any CRM call; a real one would be skipped by the writes flag. Either way it ran: one attempt.
    expect(['skipped', 'failed']).toContain(ran.state)
    expect(ran.attempts).toBe(1)
    expect(ran.lastError).not.toMatch(/feature is off/)
  })

  it('the read-back refuses, forced or not, while its switch is off, and names the reason', async () => {
    await withSettings((s) => ({ ...s, crm: { ...s.crm, enabled: true, features: { ...s.crm.features, sync: false } } }))
    const r = await syncDeals({ trigger: 'test', force: true, fetch: async () => [] })
    expect(r.ran).toBe(false)
    expect(r.skipped).toMatch(/read-back is off/)
    await withSettings((s) => ({ ...s, crm: { ...s.crm, enabled: false } }))
    const r2 = await syncDeals({ trigger: 'test', force: true, fetch: async () => [] })
    expect(r2.ran).toBe(false)
    expect(r2.skipped).toMatch(/mirror is off/)
  })

  it('a run is recorded with its summary and read back as the job’s newest; a throw is recorded too and rethrown', async () => {
    const result = await recordJobRun('housekeeping', async () => ({ drafts: 0, jobRuns: 0, errors: [`m9-${stamp}`] }), { trigger: 'manual', actor: { kind: 'k7', id: 'cm', name: 'Test CM', email: 'cm@k7computing.com' } })
    expect(result.errors).toEqual([`m9-${stamp}`])
    const last = await lastJobRuns()
    expect(last.housekeeping?.ok).toBe(true)
    expect(last.housekeeping?.trigger).toBe('manual')
    expect(last.housekeeping?.actor).toBe('cm@k7computing.com')
    expect(last.housekeeping?.summary).toBe('0 drafts removed · 0 old job runs removed · 1 errors')
    runIds.push(last.housekeeping!.id)
    await expect(
      recordJobRun('dealsSweep', async () => {
        throw new Error(`boom m9-${stamp}`)
      }),
    ).rejects.toThrow(/boom/)
    const recent = await recentJobRuns(5)
    const failed = recent.find((r) => r.summary.includes(`boom m9-${stamp}`))
    expect(failed?.ok).toBe(false)
    expect(failed?.job).toBe('dealsSweep')
    runIds.push(failed!.id)
  })

  it('housekeeping removes a join draft untouched for a month and keeps a fresh one', async () => {
    const old = await payload.create({ collection: 'partner-applications', overrideAccess: true, depth: 0, data: { type: 'var', status: 'draft', resumeKey: `m9old${stamp}`, country: 'India' } as never })
    const fresh = await payload.create({ collection: 'partner-applications', overrideAccess: true, depth: 0, data: { type: 'var', status: 'draft', resumeKey: `m9new${stamp}`, country: 'India' } as never })
    draftIds.push(String(old.id), String(fresh.id))
    const aged = new Date(Date.now() - 40 * 86_400_000).toISOString()
    await (payload.db as unknown as { drizzle: { execute(q: unknown): Promise<unknown> } }).drizzle.execute(sql`update partner_applications set updated_at = ${aged} where id = ${Number(old.id)}`)
    const r = await housekeeping()
    expect(r.errors).toEqual([])
    expect(r.drafts).toBeGreaterThanOrEqual(1)
    await expect(payload.findByID({ collection: 'partner-applications', id: old.id, overrideAccess: true, depth: 0 })).rejects.toThrow()
    const kept = await payload.findByID({ collection: 'partner-applications', id: fresh.id, overrideAccess: true, depth: 0 })
    expect(kept.id).toBe(fresh.id)
  })
})

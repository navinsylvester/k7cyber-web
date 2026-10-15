import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { probeToken } from '@/lib/dataverse/auth'
import { buildQuery, list, whoAmI, type DataverseAuth } from '@/lib/dataverse'
import { cancelCase, createCase, getCase, reopenCase, resolveCase, updateCase } from '@/lib/support/cases'
import { STATE, STATUS } from '@/lib/support/options'
import { myQueueItems, pickFromQueue, releaseToQueue } from '@/lib/support/queues'
import { createRfe, rfesOfCase } from '@/lib/support/rfe'
import { addPhoneCall, addTask, getTimeline } from '@/lib/support/timeline'

/* Writes against UAT with the developer's probe token, on rows the test creates itself (07-production-safety.md §6).
   Runs only when SUPPORT_UAT_WRITE_TESTS=1 and the probe cache exists; never against production (the client refuses). */

const enabled = process.env.SUPPORT_UAT_WRITE_TESTS === '1' && (process.env.SUPPORT_DEV_AGENT === 'probe' || process.env.SUPPORT_DEV_SERVICE === 'probe') && existsSync('scripts/.token_cache.json') && /k7crmuat/.test(process.env.DATAVERSE_URL ?? '')

// The portal's own test customer (registered through the portal on 2026-10-13).
const TEST_CONTACT = '0874323f-bec6-f111-a05c-7ced8daf5902'
const DEFAULT_QUEUE = '5a4b76b0-dab5-4717-9743-9490f2f822c6'

describe.skipIf(!enabled)('UAT: the agent actions behind the case panels', () => {
  it('runs every write action the workspace offers, on a case it created', async () => {
    const auth: DataverseAuth = { kind: 'agent', token: (await probeToken()).accessToken }
    const me = await whoAmI(auth)

    const created = await createCase(auth, { title: 'Portal integration test (safe to delete)', description: 'Created by tests/int/support-uat.int.spec.ts', customer: { kind: 'contact', id: TEST_CONTACT }, origin: 3, status: STATUS.OPEN, createdBy: 'tests' })
    expect(created.ticket).toMatch(/^CS-/)
    const id = created.id

    // Queue: add, pick, release.
    const { addCaseToQueue } = await import('@/lib/support/cases')
    await addCaseToQueue(auth, id, DEFAULT_QUEUE)
    const items = await list(auth, buildQuery('queueitems', { select: ['queueitemid', '_workerid_value'], filter: `_objectid_value eq ${id} and _queueid_value eq ${DEFAULT_QUEUE}` }), 5)
    const qi = String(items.value[0]?.queueitemid)
    expect(qi).toMatch(/^[0-9a-f-]{36}$/)
    await pickFromQueue(auth, qi, me.UserId)
    expect((await myQueueItems(auth, me.UserId)).some((q) => String(q.queueitemid) === qi)).toBe(true)
    await releaseToQueue(auth, qi)
    expect((await myQueueItems(auth, me.UserId)).some((q) => String(q.queueitemid) === qi)).toBe(false)

    // Timeline activities and a field edit.
    await addPhoneCall(auth, id, { subject: 'Integration test call', description: 'noted', outgoing: true, minutes: 2 })
    await addTask(auth, id, { subject: 'Integration test task' })
    await updateCase(auth, id, { productVersion: 'test-1.0', module: 'Portal' })
    const edited = await getCase(auth, id)
    expect(edited?.k7_productversion).toBe('test-1.0')
    const tl = await getTimeline(auth, id, 'agent')
    expect(tl.some((e) => e.kind === 'phonecall')).toBe(true)
    expect(tl.some((e) => e.kind === 'task')).toBe(true)

    // RFE linked to the case.
    const rfeId = await createRfe(auth, { title: 'Portal integration test RFE', type: 100000001, caseId: id })
    expect((await rfesOfCase(auth, id)).some((r) => r.k7_rfeid === rfeId)).toBe(true)

    // Resolve through CloseIncident, reopen, then cancel to leave the case closed.
    await resolveCase(auth, id, { status: STATUS.CLOSED_CALL, subject: 'Integration test resolved', remarks: 'ok', minutes: 1 })
    expect((await getCase(auth, id))?.statecode).toBe(STATE.RESOLVED)
    await reopenCase(auth, id)
    const reopened = await getCase(auth, id)
    expect(reopened?.statecode).toBe(STATE.ACTIVE)
    expect(reopened?.statuscode).toBe(STATUS.OPEN)
    await cancelCase(auth, id)
    expect((await getCase(auth, id))?.statecode).toBe(STATE.CANCELED)
  }, 180_000)
})

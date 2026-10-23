import configPromise from '@payload-config'
import { getPayload, type Payload, type Where } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Row } from '@/lib/dataverse/types'
import { listDeals, loadDealById } from '@/lib/partner/deals'
import { orgRel } from '@/lib/partner/scope'
import { dealsWithSyncErrors, lastSyncRun, lastUpdatedFor, syncDeals, unreadOpportunityCount } from '@/lib/partner/sync'

/* The dashboard read-back against the local Postgres (docs/partner-portal/04-portal-guide.md M5), with the CRM stood in for by a
   fetcher: a deal with an opportunity id gets its first snapshot and one audit row; a changed state gets a second row naming the
   change with the CRM's figures winning; an opportunity the CRM stops returning keeps its values and carries the error; the run
   rows give the "Last updated"; the interval is honoured unless forced. Runs only with PARTNER_DB_TESTS=1; rows are removed again. */

const enabled = process.env.PARTNER_DB_TESTS === '1' && Boolean(process.env.DATABASE_URL)
const stamp = Date.now()
const FV = '@OData.Community.Display.V1.FormattedValue'
const OPP = `bbbbbbbb-0000-4000-8000-${String(stamp).slice(-12).padStart(12, '0')}`

const crmRow = (o: Record<string, unknown> = {}): Row => ({
  opportunityid: OPP,
  alletec_opportunityno: 'OPP-TEST-00001',
  name: 'PP-TEST Sync-Fresh-Others',
  statecode: 0,
  [`statecode${FV}`]: 'Open',
  statuscode: 1,
  [`statuscode${FV}`]: 'In Progress',
  alletec_stage: 260760001,
  [`alletec_stage${FV}`]: 'Proposal',
  stepname: 'Proposal',
  estimatedvalue: 450000,
  actualvalue: null,
  alletec_nvoiceamount: null,
  estimatedclosedate: '2027-03-01',
  actualclosedate: null,
  modifiedon: new Date().toISOString(),
  ...o,
})

describe.skipIf(!enabled)('the dashboard read-back (database)', () => {
  let payload: Payload
  let orgId = ''
  let dealRowId = ''

  beforeAll(async () => {
    payload = await getPayload({ config: configPromise })
    const org = await payload.create({ collection: 'partner-orgs', overrideAccess: true, depth: 0, data: { partnerId: `K7P-7${String(stamp % 10000).padStart(4, '0')}`, type: 'var', status: 'approved', name: `PP-TEST Sync ${stamp}`, country: 'India', city: 'Chennai', state: 'Tamil Nadu', address: '1 Test Road', pin: '600001', regions: [] } as never })
    orgId = String(org.id)
    const deal = await payload.create({
      collection: 'partner-deals',
      overrideAccess: true,
      depth: 0,
      data: { dealId: `K7D-7${String(stamp % 10000).padStart(4, '0')}`, status: 'approved', org: orgRel({ orgId }), orgPartnerId: `K7P-7${String(stamp % 10000).padStart(4, '0')}`, orgName: `PP-TEST Sync ${stamp}`, orgType: 'var', customerName: `PP-TEST Sync Customer ${stamp}`, customerKey: `pp test sync customer ${stamp}`, expectedValue: 500000, closeDate: '2027-02-01', submittedAt: new Date().toISOString(), protectionEnds: '2027-01-21', products: [], crm: { opportunityId: OPP, opportunityNo: '', customerAccountId: '', customerContactId: '', noteId: '' } } as never,
    })
    dealRowId = String(deal.id)
  })

  afterAll(async () => {
    for (const c of ['partner-deals', 'partner-audit', 'partner-sync-runs'] as const) {
      const where: Where = c === 'partner-deals' ? { org: { equals: orgId } } : { orgId: { equals: orgId } }
      const r = await payload.find({ collection: c, where, limit: 200, depth: 0, overrideAccess: true })
      for (const d of r.docs) await payload.delete({ collection: c, id: d.id, overrideAccess: true }).catch(() => null)
    }
    await payload.delete({ collection: 'partner-orgs', id: orgId, overrideAccess: true }).catch(() => null)
  })

  it('reads the snapshot in, records the changes, keeps the last values when the CRM goes quiet', async () => {
    const scope = { orgId }
    expect(await unreadOpportunityCount()).toBeGreaterThanOrEqual(1)

    // First read: the snapshot lands, the OPP number is read back, one audit row says it was the first read and that the CRM differs.
    const r1 = await syncDeals({ trigger: 'test', orgId, force: true, fetch: async (ids) => (ids.includes(OPP) ? [crmRow()] : []) })
    expect(r1.ran).toBe(true)
    expect(r1.scanned).toBe(1)
    expect(r1.fetched).toBe(1)
    expect(r1.changed).toBe(1)
    expect(r1.missing).toBe(0)
    expect(r1.errors).toEqual([])
    expect(r1.runId).not.toBe('')
    let d = await loadDealById(dealRowId)
    expect(d?.crm.opportunityNo).toBe('OPP-TEST-00001')
    expect(d?.crm.snapshot.statecode).toBe(0)
    expect(d?.crm.snapshot.stageLabel).toBe('Proposal')
    expect(d?.crm.snapshot.estimatedValue).toBe(450000)
    expect(d?.crm.snapshot.syncedAt).toBeTruthy()
    let trail = await payload.find({ collection: 'partner-audit', where: { and: [{ objectId: { equals: dealRowId } }, { action: { equals: 'deal.crm-read' } }] }, depth: 0, overrideAccess: true })
    expect(trail.totalDocs).toBe(1)
    expect(String(trail.docs[0]!.comment)).toContain('figures differ')

    // The organisation's list and the dashboard's "Last updated" see it; the scope still holds.
    const list = await listDeals(scope, {})
    expect(list.rows.find((x) => x.id === dealRowId)?.crm.snapshot.stageLabel).toBe('Proposal')
    expect(await lastUpdatedFor(scope)).toBeTruthy()
    const other = await listDeals({ orgId: '1' }, {})
    expect(other.rows.some((x) => x.id === dealRowId)).toBe(false)

    // Nothing changed: no new audit row.
    const r2 = await syncDeals({ trigger: 'test', orgId, force: true, fetch: async () => [crmRow()] })
    expect(r2.changed).toBe(0)
    expect(r2.unchanged).toBe(1)

    // Won in the CRM: the change is one audit row from → to, the actual value in the snapshot, the order value for the dashboard.
    const r3 = await syncDeals({ trigger: 'test', orgId, force: true, fetch: async () => [crmRow({ statecode: 1, [`statecode${FV}`]: 'Won', statuscode: 3, [`statuscode${FV}`]: 'Won', alletec_stage: 260760005, [`alletec_stage${FV}`]: 'Closure', actualvalue: 440000, actualclosedate: '2026-12-15' })] })
    expect(r3.changed).toBe(1)
    d = await loadDealById(dealRowId)
    expect(d?.crm.snapshot.statecode).toBe(1)
    expect(d?.crm.snapshot.actualValue).toBe(440000)
    expect(d?.crm.snapshot.actualCloseDate).toBe('2026-12-15')
    trail = await payload.find({ collection: 'partner-audit', where: { and: [{ objectId: { equals: dealRowId } }, { action: { equals: 'deal.crm-changed' } }] }, depth: 0, overrideAccess: true })
    expect(trail.totalDocs).toBe(1)
    expect(String(trail.docs[0]!.from)).toContain('state Open')
    expect(String(trail.docs[0]!.to)).toContain('state Won')

    // The CRM stops returning it: the values stay, the error is set, the deal is on the K7 log's list.
    const r4 = await syncDeals({ trigger: 'test', orgId, force: true, fetch: async () => [] })
    expect(r4.missing).toBe(1)
    expect(r4.changed).toBe(1)
    d = await loadDealById(dealRowId)
    expect(d?.crm.snapshot.statecode).toBe(1)
    expect(d?.crm.snapshot.error).toBe('Not found in the CRM')
    expect((await dealsWithSyncErrors()).some((x) => x.id === dealRowId)).toBe(true)

    // A CRM that cannot be read is a failed run with nothing written.
    const r5 = await syncDeals({ trigger: 'test', orgId, force: true, fetch: async () => Promise.reject(new Error('401 from the tenant')) })
    expect(r5.ran).toBe(true)
    expect(r5.errors[0]).toContain('401 from the tenant')
    expect(r5.fetched).toBe(0)

    // The interval is honoured for the scheduler's portal-wide runs (pure `syncDue` covers the maths); this test never runs portal-wide,
    // because such a run touches every deal in the database, not only this organisation's.
    const forced = await syncDeals({ trigger: 'test', orgId, force: true, fetch: async () => [] })
    expect(forced.ran).toBe(true)
    expect((await lastSyncRun())?.orgId ?? '').toBe('')
  })
})

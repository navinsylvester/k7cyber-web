import 'server-only'
import configPromise from '@payload-config'
import { getPayload, type Where } from 'payload'

import { buildQuery, isGuid, list, nextPage, or, type DataverseAuth, type Row } from '@/lib/dataverse'

import { audit, SYSTEM, type Actor } from './audit'
import { CHANGE_LABEL, missingSnapshot, portalDisagreements, snapshotChanges, snapshotFromRow, SYNC_SELECT, syncDue } from './dashboard-model'
import { toDeal, type Deal, type Snapshot } from './deals-model'
import type { OrgScope } from './scope'
import { orgWhere } from './scope'
import { getPartnerSettings } from './settings'

/* The dashboard's read-back (01-requirements.md FR-DASH-04, 05, 11; 02-build-plan.md decision 14; 03-dynamics-exploration.md §8):
   the portal's own opportunities, by the ids stored on the deals and never by a CRM-wide filter, read in batches as the service
   identity and written onto each deal as `crm.snapshot`. Pages read the snapshot only: the browser never meets the CRM. A change
   of state, stage or value since the last read is one audit row with the CRM's value winning (FR-DASH-11); an opportunity the CRM
   no longer returns keeps its last values and carries the error. Every run is a `partner-sync-runs` row, which gives the
   partner's "Last updated" and the K7 reconciliation log. GET only: the production guard never fires here, but DATAVERSE_URL points
   at UAT in development all the same. */

type Doc = Record<string, unknown>
const db = () => getPayload({ config: configPromise })
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

export const BATCH = 25
const MAX_DEALS = 2000

export type RowFetcher = (ids: string[]) => Promise<Row[]>

/** The opportunities with these ids, one `$filter` of `or`s per batch, following the page links. */
export const fetchOpportunities = async (auth: DataverseAuth, ids: string[]): Promise<Row[]> => {
  const out: Row[] = []
  for (let i = 0; i < ids.length; i += BATCH) {
    const slice = ids.slice(i, i + BATCH).filter(isGuid)
    if (!slice.length) continue
    let page = await list(auth, buildQuery('opportunities', { select: [...SYNC_SELECT], filter: or(...slice.map((id) => `opportunityid eq ${id}`)) }), BATCH)
    out.push(...page.value)
    while (page.nextLink) {
      page = await nextPage(auth, page.nextLink, BATCH)
      out.push(...page.value)
    }
  }
  return out
}

export type SyncTrigger = 'cron' | 'manual' | 'test'
export type SyncResult = { ran: boolean; skipped: string; at: string; scanned: number; fetched: number; changed: number; unchanged: number; missing: number; errors: string[]; lines: string[]; durationMs: number; runId: string }
export type SyncOptions = { trigger?: SyncTrigger; actor?: Actor; orgId?: string; force?: boolean; fetch?: RowFetcher; auth?: DataverseAuth; now?: Date }

const withOpportunity: Where = { and: [{ 'crm.opportunityId': { exists: true } }, { 'crm.opportunityId': { not_equals: '' } }] }

/** The audit row for one deal whose read-back changed: what moved, and where the CRM's figures differ from the portal's record. */
const recordChange = async (deal: Deal, prev: Snapshot, next: Snapshot, first: boolean): Promise<string> => {
  const changes = snapshotChanges(prev, next)
  const summary = changes.map((c) => `${CHANGE_LABEL[c.field]} ${c.from} → ${c.to}`).join('; ')
  const disagree = portalDisagreements(deal, next)
  const comment = first ? `First read-back from Dynamics${disagree.length ? `; the CRM's figures differ from the registration (${disagree.join('; ')}) and win` : ''}` : `Read back from Dynamics: ${summary}${disagree.length ? `. The CRM's figures differ from the registration (${disagree.join('; ')}) and win` : ''}`
  await audit({ actor: SYSTEM, object: 'partner-deals', objectId: deal.id, objectLabel: deal.dealId, action: first ? 'deal.crm-read' : 'deal.crm-changed', from: first ? '' : changes.map((c) => `${CHANGE_LABEL[c.field]} ${c.from}`).join('; '), to: changes.map((c) => `${CHANGE_LABEL[c.field]} ${c.to}`).join('; '), orgId: deal.orgId, comment, meta: { changes, disagreements: disagree, opportunityId: deal.crm.opportunityId, opportunityNo: deal.crm.opportunityNo } })
  return `${deal.dealId} ${deal.crm.opportunityNo || deal.crm.opportunityId}: ${first ? 'first read' : summary}${next.error ? ` (${next.error})` : ''}`
}

/** One run. Returns without a run row when the interval has not passed (`skipped`), unless forced. */
export const syncDeals = async (o: SyncOptions = {}): Promise<SyncResult> => {
  const started = Date.now()
  const now = o.now ?? new Date()
  const at = now.toISOString()
  const trigger = o.trigger ?? 'cron'
  const r: SyncResult = { ran: false, skipped: '', at, scanned: 0, fetched: 0, changed: 0, unchanged: 0, missing: 0, errors: [], lines: [], durationMs: 0, runId: '' }
  const settings = await getPartnerSettings()
  if (!o.force) {
    const last = await lastSyncRun()
    if (last && !syncDue(last.at, settings.crm.syncMinutes, now)) {
      r.skipped = `Last run ${last.at}; the next is due ${settings.crm.syncMinutes} minutes after it.`
      r.durationMs = Date.now() - started
      return r
    }
  }
  const payload = await db()
  const where: Where = o.orgId ? orgWhere({ orgId: o.orgId }, withOpportunity) : withOpportunity
  const q = await payload.find({ collection: 'partner-deals', where, limit: MAX_DEALS, depth: 0, overrideAccess: true, sort: 'createdAt' })
  const deals = (q.docs as unknown as Doc[]).map(toDeal)
  r.scanned = deals.length
  let ok = true
  if (deals.length) {
    const ids = [...new Set(deals.map((d) => d.crm.opportunityId.toLowerCase()).filter(isGuid))]
    let rows: Row[] = []
    try {
      rows = o.fetch ? await o.fetch(ids) : await fetchOpportunities(o.auth ?? { kind: 'service' }, ids)
    } catch (e) {
      ok = false
      const msg = (e as Error).message.slice(0, 300)
      r.errors.push(`The CRM could not be read: ${msg}`)
      r.lines.push(`The CRM could not be read: ${msg}`)
    }
    if (ok) {
      r.fetched = rows.length
      const byId = new Map<string, Row>()
      for (const row of rows) byId.set(s(row.opportunityid).toLowerCase(), row)
      for (const deal of deals) {
        const prev = deal.crm.snapshot
        const row = byId.get(deal.crm.opportunityId.toLowerCase())
        const next = row ? snapshotFromRow(row, at) : missingSnapshot(prev, at)
        if (!row) r.missing += 1
        const first = prev.syncedAt === null
        const changes = snapshotChanges(prev, next)
        try {
          const opportunityNo = row && typeof row.alletec_opportunityno === 'string' && row.alletec_opportunityno ? row.alletec_opportunityno : deal.crm.opportunityNo
          await payload.update({ collection: 'partner-deals', id: deal.id, overrideAccess: true, depth: 0, data: { crm: { ...deal.crm, opportunityNo, snapshot: next } } as never })
          if (changes.length) {
            r.changed += 1
            r.lines.push(await recordChange(deal, prev, next, first))
          } else r.unchanged += 1
        } catch (e) {
          const msg = (e as Error).message.slice(0, 200)
          r.errors.push(`${deal.dealId}: ${msg}`)
          r.lines.push(`${deal.dealId}: could not be written (${msg})`)
        }
      }
    }
  }
  r.ran = true
  r.durationMs = Date.now() - started
  try {
    const run = await payload.create({ collection: 'partner-sync-runs', overrideAccess: true, depth: 0, data: { trigger, actor: o.actor ? o.actor.name || o.actor.email || o.actor.kind : '', ok, durationMs: r.durationMs, orgId: o.orgId ?? '', scanned: r.scanned, fetched: r.fetched, changed: r.changed, missing: r.missing, errors: r.errors.length, lines: r.lines } as never })
    r.runId = s(run.id)
  } catch (e) {
    console.error(`[partner sync] the run row could not be written: ${(e as Error).message}`)
  }
  return r
}

/* ---------- Reading the runs ---------- */

export type SyncRun = { id: string; at: string; trigger: SyncTrigger; actor: string; ok: boolean; durationMs: number; orgId: string; scanned: number; fetched: number; changed: number; missing: number; errors: number; lines: string[] }

const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const toRun = (x: Doc): SyncRun => ({ id: s(x.id), at: s(x.createdAt), trigger: (x.trigger === 'manual' || x.trigger === 'test' ? x.trigger : 'cron') as SyncTrigger, actor: s(x.actor), ok: x.ok !== false, durationMs: n(x.durationMs), orgId: s(x.orgId), scanned: n(x.scanned), fetched: n(x.fetched), changed: n(x.changed), missing: n(x.missing), errors: n(x.errors), lines: Array.isArray(x.lines) ? x.lines.map(String) : [] })

/** The newest run that read the whole portal (not one organisation's), or null before the first. */
export const lastSyncRun = async (): Promise<SyncRun | null> => {
  try {
    const payload = await db()
    const r = await payload.find({ collection: 'partner-sync-runs', where: { or: [{ orgId: { equals: '' } }, { orgId: { exists: false } }] }, sort: '-createdAt', limit: 1, depth: 0, overrideAccess: true })
    return r.docs.length ? toRun(r.docs[0] as unknown as Doc) : null
  } catch {
    return null
  }
}

export const listSyncRuns = async (limit = 30): Promise<SyncRun[]> => {
  try {
    const payload = await db()
    const r = await payload.find({ collection: 'partner-sync-runs', sort: '-createdAt', limit, depth: 0, overrideAccess: true })
    return (r.docs as unknown as Doc[]).map(toRun)
  } catch {
    return []
  }
}

/** The organisation's "Last updated": the newest portal-wide run, or failing that the newest snapshot among its own deals. */
export const lastUpdatedFor = async (scope: OrgScope): Promise<string | null> => {
  const run = await lastSyncRun()
  if (run) return run.at
  try {
    const payload = await db()
    const r = await payload.find({ collection: 'partner-deals', where: orgWhere(scope, { 'crm.snapshot.syncedAt': { exists: true } }), sort: '-crm.snapshot.syncedAt', limit: 1, depth: 0, overrideAccess: true })
    const d = r.docs[0] as unknown as Doc | undefined
    return d ? toDeal(d).crm.snapshot.syncedAt : null
  } catch {
    return null
  }
}

/** Deals whose last read-back carried an error (not found, refused), for the K7 log. */
export const dealsWithSyncErrors = async (limit = 50): Promise<Deal[]> => {
  try {
    const payload = await db()
    const r = await payload.find({ collection: 'partner-deals', where: { and: [withOpportunity, { 'crm.snapshot.error': { exists: true } }, { 'crm.snapshot.error': { not_equals: '' } }] }, sort: '-updatedAt', limit, depth: 0, overrideAccess: true })
    return (r.docs as unknown as Doc[]).map(toDeal)
  } catch {
    return []
  }
}

/** How many deals wait for their first read-back (an opportunity id, no snapshot yet). */
export const unreadOpportunityCount = async (): Promise<number> => {
  try {
    const payload = await db()
    return (await payload.count({ collection: 'partner-deals', where: { and: [withOpportunity, { 'crm.snapshot.syncedAt': { exists: false } }] }, overrideAccess: true })).totalDocs
  } catch {
    return 0
  }
}

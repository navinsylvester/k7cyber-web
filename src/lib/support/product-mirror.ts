import 'server-only'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { ProductionWriteRefused, WritesDisabled, type DataverseAuth } from '@/lib/dataverse'

import { getCase, setStatusReason } from './cases'
import { STATE } from './options'
import type { MirrorOp, ProductSettings } from './product-model'
import { createDefect, createRfe, updateDefect, updateRfe, type NewDefect, type NewRfe } from './rfe'
import { addNote, addTask } from './timeline'

/* The CRM mirror's outbox (docs/support-portal/10-product-desk.md §6). Every operation the model produces is recorded; those that can
   run now (an agent's token, mirror enabled) run at once through the guarded client; the rest wait as `pending`. The production guard
   turns a write into `skipped`, never into an error the product side sees. A write that fails for another reason is `failed` and can
   be retried from the item page (and by the sweep's drain in phase B). */

const db = () => getPayload({ config: configPromise })

export type MirrorOutcome = 'done' | 'pending' | 'skipped' | 'failed'
export type MirrorResult = { done: number; pending: number; skipped: number; failed: number; lines: string[]; /** Rows created in this run. */ created: { rfeId?: string; defectId?: string } }

export type MirrorRow = { id: string; itemId: string; caseId: string; ticket: string; op: MirrorOp['op']; state: MirrorOutcome; attempts: number; body: MirrorOp; actor: string; lastError: string; doneAt: string | null; createdAt: string }

type Doc = Record<string, unknown>
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

const toRow = (x: Doc): MirrorRow => ({
  id: s(x.id),
  itemId: s(x.itemId),
  caseId: s(x.caseId),
  ticket: s(x.ticket),
  op: s(x.op) as MirrorOp['op'],
  state: (['done', 'pending', 'skipped', 'failed'] as MirrorOutcome[]).includes(x.state as MirrorOutcome) ? (x.state as MirrorOutcome) : 'pending',
  attempts: typeof x.attempts === 'number' ? x.attempts : 0,
  body: (x.body ?? {}) as MirrorOp,
  actor: s(x.actor),
  lastError: s(x.lastError),
  doneAt: typeof x.doneAt === 'string' ? x.doneAt : null,
  createdAt: s(x.createdAt),
})

const errorCode = (e: unknown): string => {
  const x = e as { code?: string; status?: number; message?: string }
  return x.code ?? (x.status ? `HTTP ${x.status}` : (x.message ?? 'error').slice(0, 80))
}

/** Runs one operation as the given identity. Returns the outcome, a short line for the activity, and the id of a row it created. */
const runOp = async (auth: DataverseAuth, op: MirrorOp): Promise<{ outcome: MirrorOutcome; line: string; createdId?: string }> => {
  try {
    switch (op.op) {
      case 'rfe': {
        if (op.action === 'create') {
          const id = await createRfe(auth, op.body as NewRfe)
          return { outcome: 'done', line: `${op.ticket}: RFE row created`, createdId: id }
        }
        await updateRfe(auth, op.rowId, op.body as Partial<NewRfe>)
        return { outcome: 'done', line: `${op.ticket}: RFE row updated` }
      }
      case 'defect': {
        if (op.action === 'create') {
          const id = await createDefect(auth, op.body as NewDefect)
          return { outcome: 'done', line: `${op.ticket}: defect row created`, createdId: id }
        }
        await updateDefect(auth, op.rowId, op.body as Partial<NewDefect>)
        return { outcome: 'done', line: `${op.ticket}: defect row updated` }
      }
      case 'status': {
        const c = await getCase(auth, op.caseId)
        if (!c) return { outcome: 'skipped', line: `${op.ticket}: case not found` }
        if (c.statecode !== STATE.ACTIVE) return { outcome: 'skipped', line: `${op.ticket}: case is not active, status left alone` }
        if (op.onlyFrom && !op.onlyFrom.includes(c.statuscode)) return { outcome: 'skipped', line: `${op.ticket}: the desk moved the case on, status left alone` }
        if (c.statuscode === op.statuscode) return { outcome: 'done', line: `${op.ticket}: status already set` }
        await setStatusReason(auth, op.caseId, op.statuscode)
        return { outcome: 'done', line: `${op.ticket}: status reason updated` }
      }
      case 'note':
        await addNote(auth, op.caseId, { subject: op.subject, text: op.text })
        return { outcome: 'done', line: `${op.ticket}: note written` }
      case 'task':
        await addTask(auth, op.caseId, { subject: op.subject, description: op.description })
        return { outcome: 'done', line: `${op.ticket}: task created` }
    }
  } catch (e) {
    if (e instanceof ProductionWriteRefused || e instanceof WritesDisabled) return { outcome: 'skipped', line: `${op.ticket}: ${e instanceof ProductionWriteRefused ? 'production is read-only' : 'writes are disabled here'}` }
    return { outcome: 'failed', line: `${op.ticket}: ${errorCode(e)}` }
  }
}

/** Records every op; runs those it can. `auth` is the acting agent's (or the service identity's); null defers everything. */
export const applyMirror = async (item: { id: string; number: string }, ops: MirrorOp[], auth: DataverseAuth | null, actor: string, settings: ProductSettings): Promise<MirrorResult> => {
  const r: MirrorResult = { done: 0, pending: 0, skipped: 0, failed: 0, lines: [], created: {} }
  if (!ops.length) return r
  const payload = await db()
  for (const op of ops) {
    let outcome: MirrorOutcome = 'pending'
    let line = `${op.ticket}: ${op.op} queued`
    let attempts = 0
    let lastError = ''
    if (!settings.mirror.enabled) line = `${op.ticket}: ${op.op} queued (mirror off)`
    else if (auth) {
      attempts = 1
      const x = await runOp(auth, op)
      outcome = x.outcome
      line = x.line
      if (outcome === 'failed') lastError = x.line.split(': ').slice(1).join(': ')
      if (x.createdId) r.created[op.op === 'rfe' ? 'rfeId' : 'defectId'] = x.createdId
    }
    r[outcome]++
    r.lines.push(line)
    await payload
      .create({
        collection: 'product-mirror',
        data: { itemId: item.id, itemNumber: item.number, caseId: op.caseId, ticket: op.ticket, op: op.op, state: outcome, attempts, body: op as never, actor: outcome === 'pending' ? '' : actor, lastError: lastError || undefined, doneAt: outcome === 'done' ? new Date().toISOString() : undefined } as never,
        overrideAccess: true,
      })
      .catch((e) => console.error(`[product mirror] record failed: ${(e as Error).message}`))
  }
  return r
}

export const mirrorsOfItem = async (itemId: string): Promise<MirrorRow[]> => {
  try {
    const payload = await db()
    const r = await payload.find({ collection: 'product-mirror', where: { itemId: { equals: itemId } }, sort: '-createdAt', limit: 200, depth: 0, overrideAccess: true })
    return r.docs.map((x) => toRow(x as unknown as Doc))
  } catch {
    return []
  }
}

/** Re-runs the pending and failed writes of one item as the given identity (the Retry button; the sweep in phase B). */
export const retryMirror = async (itemId: string, auth: DataverseAuth, actor: string, settings: ProductSettings): Promise<MirrorResult> => {
  const r: MirrorResult = { done: 0, pending: 0, skipped: 0, failed: 0, lines: [], created: {} }
  if (!settings.mirror.enabled) {
    r.lines.push('The mirror is off in settings; nothing was written.')
    return r
  }
  const payload = await db()
  const rows = (await mirrorsOfItem(itemId)).filter((x) => x.state === 'pending' || x.state === 'failed').sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  for (const row of rows) {
    const x = await runOp(auth, row.body)
    r[x.outcome]++
    r.lines.push(x.line)
    if (x.createdId) {
      // A row created late still has to be known to its item, so later moves update it.
      r.created[row.op === 'rfe' ? 'rfeId' : 'defectId'] = x.createdId
      await payload.update({ collection: 'product-items', id: row.itemId, data: (row.op === 'rfe' ? { crmRfeId: x.createdId } : { crmDefectId: x.createdId }) as never, overrideAccess: true }).catch(() => null)
    }
    await payload
      .update({ collection: 'product-mirror', id: row.id, data: { state: x.outcome, attempts: row.attempts + 1, actor, lastError: x.outcome === 'failed' ? x.line.split(': ').slice(1).join(': ') : '', doneAt: x.outcome === 'done' ? new Date().toISOString() : undefined } as never, overrideAccess: true })
      .catch((e) => console.error(`[product mirror] update failed: ${(e as Error).message}`))
  }
  return r
}

/** Items with writes still owed to the CRM, for the inbox counter. */
export const pendingMirrorCount = async (): Promise<number> => {
  try {
    const payload = await db()
    const r = await payload.count({ collection: 'product-mirror', where: { state: { in: ['pending', 'failed'] } }, overrideAccess: true })
    return r.totalDocs
  } catch {
    return 0
  }
}

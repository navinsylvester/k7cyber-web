import 'server-only'
import configPromise from '@payload-config'
import { getPayload, type Where } from 'payload'

import type { DataverseAuth, Row } from '@/lib/dataverse'
import { fv, lookup } from '@/lib/dataverse/types'

import type { CaseRow } from './cases'
import { getSettings } from './kpi-config'
import { productAcceptedMail, productChangeMail, productRaisedMail, sendMail } from './mail'
import { forget, memo } from './memo'
import { label as optLabel, VERTICAL } from './options'
import { getProductSettings } from './product-config'
import { applyMirror, type MirrorResult } from './product-mirror'
import {
  asCaseChoice,
  asDeclineReason,
  asKind,
  asPriority,
  asSeverity,
  asState,
  asTeam,
  canMove,
  CRM_DEFECT_PRIORITY,
  CRM_DEFECT_STATUS,
  CRM_RFE_FROM_CUSTOMER,
  CRM_RFE_STATUS,
  CRM_RFE_TYPE_CUSTOMER,
  crmRowKind,
  crmRowOpsFor,
  defaultTeam,
  inboxOrder,
  itemNumber,
  KIND_LABEL,
  linkOpsFor,
  mirrorOpsFor,
  NOBODY,
  parseItemNumber,
  provisionalPriority,
  similarity,
  STATE_LABEL,
  teamOf,
  type CaseChoice,
  type DeclineReason,
  type Evidence,
  type EventKind,
  type ItemCase,
  type ItemEvent,
  type ItemKind,
  type ItemRow,
  type ItemState,
  type MirrorOp,
  type Person,
  type Priority,
  type ProductSettings,
  type SeverityHint,
  type Side,
  type Team,
  type TrackerKind,
} from './product-model'
import { productFamily, getAgents } from './reference'
import { getDefect, getRfe } from './rfe'
import { trackerFor } from './tracker/registry'

export * from './product-model'

/* The product desk, server side (docs/support-portal/10-product-desk.md). Items, their case links, their thread and their evidence live
   in Payload; every state change runs the model's transition rules, writes an event, applies the CRM mirror as the acting agent (or
   queues it) and notifies the people the settings name. Nothing here holds a tracker secret: the adapter does. */

const db = () => getPayload({ config: configPromise })

type Doc = Record<string, unknown>
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v))
const n = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const d = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)
const person = (x: Doc, prefix: string): Person => ({ id: s(x[`${prefix}Id`]), name: s(x[`${prefix}Name`]), email: s(x[`${prefix}Email`]) })
const personData = (prefix: string, p: Person) => ({ [`${prefix}Id`]: p.id, [`${prefix}Name`]: p.name, [`${prefix}Email`]: p.email })

export const base = () => (process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000').replace(/\/$/, '')
export const itemUrl = (number: string) => `${base()}/support/product/items/${number}`
export const itemPath = (number: string) => `/support/product/items/${number}`

const toItem = (x: Doc): ItemRow => {
  const t = (x.tracker ?? {}) as Doc
  return {
    id: s(x.id),
    seq: n(x.seq) ?? 0,
    number: s(x.number),
    kind: asKind(x.kind) ?? 'defect',
    team: asTeam(x.team) ?? 'engineering',
    state: asState(x.state) ?? 'raised',
    askedFrom: asState(x.askedFrom),
    priority: asPriority(x.priority) ?? 'P3',
    title: s(x.title),
    summary: s(x.summary),
    severityHint: asSeverity(x.severityHint),
    customerImpact: s(x.customerImpact),
    productId: s(x.productId),
    productName: s(x.productName),
    productFamily: s(x.productFamily),
    affectedVersion: s(x.affectedVersion),
    platform: s(x.platform),
    issueCategory: s(x.issueCategory),
    subCategory: s(x.subCategory),
    vertical: n(x.vertical),
    casePriority: n(x.casePriority),
    tracker: { kind: (t.kind === 'yodiz' ? 'yodiz' : 'none') as TrackerKind, projectId: s(t.projectId), id: s(t.id), key: s(t.key), url: s(t.url), status: s(t.status), category: s(t.category), syncedAt: d(t.syncedAt) },
    fixedVersion: s(x.fixedVersion),
    releasedVersion: s(x.releasedVersion),
    releaseNote: s(x.releaseNote),
    showReleaseToCustomer: x.showReleaseToCustomer === true,
    declineReason: asDeclineReason(x.declineReason) ?? '',
    declineNote: s(x.declineNote),
    raisedBy: person(x, 'raisedBy'),
    raisedAt: s(x.raisedAt),
    triagedBy: person(x, 'triagedBy'),
    triagedAt: d(x.triagedAt),
    supportOwner: person(x, 'supportOwner'),
    productOwner: s(x.productOwner),
    fixedAt: d(x.fixedAt),
    releasedAt: d(x.releasedAt),
    closedAt: d(x.closedAt),
    lastActivityAt: s(x.lastActivityAt) || s(x.updatedAt),
    caseCount: n(x.caseCount) ?? 0,
    crmRfeId: s(x.crmRfeId),
    crmDefectId: s(x.crmDefectId),
    crmRef: s(x.crmRef),
    createdAt: s(x.createdAt),
  }
}

const toCase = (x: Doc): ItemCase => ({
  id: s(x.id),
  itemId: s(x.itemId),
  caseId: s(x.caseId),
  ticket: s(x.ticket),
  title: s(x.title),
  productName: s(x.productName),
  vertical: n(x.vertical),
  casePriority: n(x.casePriority),
  customerKind: x.customerKind === 'account' || x.customerKind === 'contact' ? x.customerKind : '',
  accountName: s(x.accountName),
  supportOwner: person(x, 'supportOwner'),
  caseChoice: asCaseChoice(x.caseChoice),
  toldAt: d(x.toldAt),
  linkedBy: { id: s(x.linkedById), name: s(x.linkedByName), email: '' },
  linkedAt: s(x.linkedAt),
  unlinkedAt: d(x.unlinkedAt),
})

const toEvidence = (x: Doc): Evidence => ({ id: s(x.id), name: s(x.filename), mime: s(x.mimeType), size: n(x.filesize) ?? 0, url: `/support/product/evidence/${s(x.id)}` })

const toEvent = (x: Doc): ItemEvent => ({
  id: s(x.id),
  itemId: s(x.itemId),
  kind: s(x.kind) as EventKind,
  side: (['support', 'principal', 'engineering', 'lab', 'system'].includes(s(x.side)) ? s(x.side) : 'system') as Side,
  by: person(x, 'by'),
  text: s(x.text),
  from: (asState(x.from) ?? '') as ItemState | '',
  to: (asState(x.to) ?? '') as ItemState | '',
  caseTicket: s(x.caseTicket),
  evidence: Array.isArray(x.evidence) ? (x.evidence as unknown[]).filter((e) => e && typeof e === 'object').map((e) => toEvidence(e as Doc)) : [],
  at: s(x.createdAt),
})

/* ---------- Reads ---------- */

const findItems = async (where: Where, o: { limit?: number; sort?: string } = {}): Promise<ItemRow[]> => {
  try {
    const payload = await db()
    const r = await payload.find({ collection: 'product-items', where, sort: o.sort ?? '-lastActivityAt', limit: o.limit ?? 500, depth: 0, overrideAccess: true })
    return r.docs.map((x) => toItem(x as unknown as Doc))
  } catch (e) {
    console.error(`[product] read failed: ${(e as Error).message}`)
    return []
  }
}

export const getItem = async (number: string): Promise<ItemRow | null> => {
  const seq = parseItemNumber(number)
  if (seq === null) return null
  return (await findItems({ seq: { equals: seq } }, { limit: 1 }))[0] ?? null
}

export const getItemById = async (id: string): Promise<ItemRow | null> => (/^\d+$/.test(id) ? ((await findItems({ id: { equals: Number(id) } }, { limit: 1 }))[0] ?? null) : null)

export type ItemFilter = { states?: ItemState[]; open?: boolean; team?: Team | ''; kind?: ItemKind | ''; priority?: Priority | ''; productFamily?: string; q?: string; supportOwnerId?: string; raisedById?: string }

export const listItems = async (f: ItemFilter = {}, o: { limit?: number; sort?: string } = {}): Promise<ItemRow[]> => {
  const and: Where[] = []
  if (f.states?.length) and.push({ state: { in: f.states } })
  else if (f.open) and.push({ state: { not_in: ['closed', 'declined'] } })
  if (f.team) and.push({ team: { equals: f.team } })
  if (f.kind) and.push({ kind: { equals: f.kind } })
  if (f.priority) and.push({ priority: { equals: f.priority } })
  if (f.productFamily) and.push({ productFamily: { equals: f.productFamily } })
  if (f.supportOwnerId) and.push({ supportOwnerId: { equals: f.supportOwnerId } })
  if (f.raisedById) and.push({ raisedById: { equals: f.raisedById } })
  if (f.q) {
    const q = f.q.trim()
    const seq = parseItemNumber(q)
    and.push(seq !== null ? { seq: { equals: seq } } : { or: [{ title: { like: q } }, { productName: { like: q } }, { 'tracker.key': { like: q } }] })
  }
  return findItems(and.length ? { and } : {}, o)
}

/** Everything open, in inbox order: needs-info first, then raised oldest first, then the rest. */
export const openItems = async (): Promise<ItemRow[]> => (await listItems({ open: true }, { limit: 1000 })).sort(inboxOrder)

export type DeskCounts = Record<ItemState, number> & { open: number }
export const deskCounts = async (): Promise<DeskCounts> => {
  const items = await findItems({}, { limit: 5000 })
  const c: DeskCounts = { raised: 0, tracked: 0, 'needs-info': 0, fixed: 0, released: 0, declined: 0, closed: 0, open: 0 }
  for (const i of items) {
    c[i.state]++
    if (i.state !== 'closed' && i.state !== 'declined') c.open++
  }
  return c
}

export const casesOfItem = async (itemId: string, o: { includeUnlinked?: boolean } = {}): Promise<ItemCase[]> => {
  try {
    const payload = await db()
    const where: Where = o.includeUnlinked ? { itemId: { equals: itemId } } : { itemId: { equals: itemId }, unlinkedAt: { exists: false } }
    const r = await payload.find({ collection: 'product-item-cases', where, sort: 'linkedAt', limit: 500, depth: 0, overrideAccess: true })
    return r.docs.map((x) => toCase(x as unknown as Doc))
  } catch {
    return []
  }
}

/** The active items a case is linked to, with the link row. Memoised a few seconds so the case page and the band agree. */
export const itemsForCase = (caseId: string): Promise<{ item: ItemRow; link: ItemCase }[]> =>
  memo(`product:case:${caseId}`, 5_000, async () => {
    try {
      const payload = await db()
      const r = await payload.find({ collection: 'product-item-cases', where: { caseId: { equals: caseId }, unlinkedAt: { exists: false } }, sort: '-linkedAt', limit: 20, depth: 0, overrideAccess: true })
      const links = r.docs.map((x) => toCase(x as unknown as Doc))
      if (!links.length) return []
      const items = await findItems({ id: { in: links.map((l) => Number(l.itemId)) } }, { limit: links.length })
      return links.map((link) => ({ link, item: items.find((i) => i.id === link.itemId)! })).filter((x) => x.item)
    } catch {
      return []
    }
  })

export const casesForItems = async (itemIds: string[]): Promise<Map<string, ItemCase[]>> => {
  const out = new Map<string, ItemCase[]>()
  if (!itemIds.length) return out
  try {
    const payload = await db()
    const r = await payload.find({ collection: 'product-item-cases', where: { itemId: { in: itemIds }, unlinkedAt: { exists: false } }, sort: 'linkedAt', limit: 2000, depth: 0, overrideAccess: true })
    for (const x of r.docs) {
      const c = toCase(x as unknown as Doc)
      out.set(c.itemId, [...(out.get(c.itemId) ?? []), c])
    }
  } catch {
    /* empty map */
  }
  return out
}

export const eventsOfItem = async (itemId: string): Promise<ItemEvent[]> => {
  try {
    const payload = await db()
    const r = await payload.find({ collection: 'product-item-events', where: { itemId: { equals: itemId } }, sort: '-createdAt', limit: 500, depth: 1, overrideAccess: true })
    return r.docs.map((x) => toEvent(x as unknown as Doc))
  } catch {
    return []
  }
}

/** Open items on the same product family, most similar title first: the escalate panel's "is it one of these?". */
export const suggestItems = async (family: string, title: string, limit = 6): Promise<ItemRow[]> => {
  const items = await listItems({ open: true, productFamily: family || undefined }, { limit: 200 })
  const pool = items.length ? items : family ? await listItems({ open: true }, { limit: 200 }) : []
  return pool
    .map((i) => ({ i, score: similarity(title, i.title) + (i.productFamily && i.productFamily === family ? 1 : 0) }))
    .sort((a, b) => b.score - a.score || b.i.caseCount - a.i.caseCount)
    .slice(0, limit)
    .map((x) => x.i)
}

/* ---------- The case snapshot an item or a link is built from ---------- */

export type CaseFacts = { caseId: string; ticket: string; title: string; productId: string; productName: string; productFamily: string; affectedVersion: string; platform: string; issueCategory: string; subCategory: string; vertical: number | null; casePriority: number | null; customerKind: 'account' | 'contact' | ''; accountName: string; owner: Person }

/** From a Dataverse case row read with CASE_SELECT. No contact details: the account name only when the customer is an account. */
export const caseFacts = (c: CaseRow | Row, ownerEmail = ''): CaseFacts => {
  const customer = lookup(c, 'customerid')
  const owner = lookup(c, 'ownerid')
  const productName = fv(c, '_productid_value')
  return {
    caseId: s(c.incidentid),
    ticket: s(c.ticketnumber),
    title: s(c.title),
    productId: s(c._productid_value),
    productName,
    productFamily: productName ? productFamily(productName) : '',
    affectedVersion: s(c.k7_productversion),
    platform: [s(c.k7_module), s(c.k7_submodule)].filter(Boolean).join(' / '),
    issueCategory: fv(c, '_new_issue_value'),
    subCategory: fv(c, '_new_subcategory_value'),
    vertical: n(c.new_verticaltype),
    casePriority: n(c.prioritycode),
    customerKind: customer?.logicalName === 'account' ? 'account' : customer?.logicalName === 'contact' ? 'contact' : '',
    accountName: customer?.logicalName === 'account' ? customer.name : '',
    owner: { id: owner?.id ?? '', name: owner?.name ?? '', email: ownerEmail },
  }
}

const ownerEmailOf = async (auth: DataverseAuth | null, ownerId: string): Promise<string> => {
  if (!auth || !ownerId) return ''
  try {
    return (await getAgents(auth)).find((a) => a.id === ownerId)?.email ?? ''
  } catch {
    return ''
  }
}

/* ---------- Events, evidence, notifications ---------- */

export type Actor = { id: string; name: string; email: string; auth: DataverseAuth | null }
const who = (a: Actor): Person => ({ id: a.id, name: a.name, email: a.email })

export type EvidenceFile = { name: string; mime: string; bytes: Buffer }

const addEvidence = async (itemId: string, files: EvidenceFile[], by: Actor): Promise<number[]> => {
  const payload = await db()
  const ids: number[] = []
  for (const f of files) {
    try {
      const doc = await payload.create({ collection: 'product-evidence', data: { itemId, uploadedBy: by.name || by.email }, file: { data: f.bytes, mimetype: f.mime || 'application/octet-stream', name: f.name.replace(/[^\w.\- ]+/g, '_').slice(0, 120), size: f.bytes.length }, overrideAccess: true })
      ids.push(Number(doc.id))
    } catch (e) {
      console.error(`[product] evidence upload failed: ${(e as Error).message}`)
    }
  }
  return ids
}

export const evidenceById = async (id: string): Promise<(Evidence & { itemId: string }) | null> => {
  if (!/^\d+$/.test(id)) return null
  try {
    const payload = await db()
    const doc = (await payload.findByID({ collection: 'product-evidence', id: Number(id), depth: 0, overrideAccess: true })) as unknown as Doc
    return { ...toEvidence(doc), itemId: s(doc.itemId) }
  } catch {
    return null
  }
}

const addEvent = async (item: { id: string; number: string }, e: { kind: EventKind; side: Side; by: Person; text?: string; from?: ItemState | null; to?: ItemState | null; caseTicket?: string; evidence?: number[] }): Promise<void> => {
  const payload = await db()
  await payload
    .create({
      collection: 'product-item-events',
      data: { itemId: item.id, itemNumber: item.number, kind: e.kind, side: e.side, ...personData('by', e.by), text: e.text ?? '', from: e.from ?? undefined, to: e.to ?? undefined, caseTicket: e.caseTicket ?? '', evidence: e.evidence?.length ? e.evidence : undefined } as never,
      overrideAccess: true,
    })
    .catch((err) => console.error(`[product] event write failed: ${(err as Error).message}`))
}

const touch = async (item: ItemRow, data: Doc): Promise<ItemRow> => {
  const payload = await db()
  const u = await payload.update({ collection: 'product-items', id: item.id, data: { ...data, lastActivityAt: new Date().toISOString() } as never, overrideAccess: true })
  forget('product:case:')
  return toItem(u as unknown as Doc)
}

const mail = async (to: string[], m: Omit<Parameters<typeof sendMail>[0], 'to'>): Promise<void> => {
  const list = [...new Set(to.map((x) => x.trim().toLowerCase()).filter(Boolean))]
  if (!list.length) return
  await sendMail({ to: list.join(', '), ...m }).catch((e) => console.error(`[product] mail failed: ${(e as Error).message}`))
}

const principalsOf = (settings: ProductSettings): string[] => [...settings.principals.emails, ...settings.teams.flatMap((t) => t.leads)]

const mirrorEvent = async (item: ItemRow, r: MirrorResult): Promise<void> => {
  if (!r.lines.length) return
  const sum = [r.done && `${r.done} written`, r.pending && `${r.pending} queued`, r.skipped && `${r.skipped} skipped`, r.failed && `${r.failed} failed`].filter(Boolean).join(', ')
  await addEvent(item, { kind: 'mirror', side: 'system', by: NOBODY, text: `CRM mirror: ${sum}.\n${r.lines.join('\n')}` })
}

const contextOf = (item: ItemRow, cases: ItemCase[], by: Actor, settings: ProductSettings) => ({ item, cases, by: who(by), settings, teamName: teamOf(settings, item.team).name })

/* ---------- Raise and link ---------- */

export type RaiseInput = { kind: ItemKind; title: string; summary: string; severityHint: SeverityHint | null; customerImpact: string; caseChoice: CaseChoice; evidence: EvidenceFile[] }

const nextSeq = async (): Promise<number> => {
  const payload = await db()
  const r = await payload.find({ collection: 'product-items', sort: '-seq', limit: 1, depth: 0, overrideAccess: true })
  return (n((r.docs[0] as unknown as Doc | undefined)?.seq) ?? 0) + 1
}

/** An agent raises an item from a case: the bridge record, the first link, the hand-off, the CRM writes as that agent, the mail. */
export const raiseItem = async (me: Actor, c: CaseRow, input: RaiseInput): Promise<{ item: ItemRow; mirror: MirrorResult }> => {
  const settings = await getProductSettings()
  const payload = await db()
  const facts = caseFacts(c, await ownerEmailOf(me.auth, lookup(c, 'ownerid')?.id ?? ''))
  const now = new Date().toISOString()
  const team = defaultTeam(input.kind)
  let created: Doc | null = null
  for (let attempt = 0; attempt < 3 && !created; attempt++) {
    const seq = await nextSeq()
    try {
      created = (await payload.create({
        collection: 'product-items',
        data: {
          seq,
          number: itemNumber(seq),
          kind: input.kind,
          team,
          state: 'raised',
          priority: provisionalPriority(input.severityHint),
          title: input.title.trim().slice(0, 200),
          summary: input.summary.trim().slice(0, 8000),
          severityHint: input.severityHint ?? undefined,
          customerImpact: input.customerImpact.trim().slice(0, 300),
          productId: facts.productId,
          productName: facts.productName,
          productFamily: facts.productFamily,
          affectedVersion: facts.affectedVersion,
          platform: facts.platform,
          issueCategory: facts.issueCategory,
          subCategory: facts.subCategory,
          vertical: facts.vertical,
          casePriority: facts.casePriority,
          tracker: { kind: 'none' },
          ...personData('raisedBy', who(me)),
          raisedAt: now,
          ...personData('supportOwner', facts.owner),
          lastActivityAt: now,
          caseCount: 1,
        } as never,
        overrideAccess: true,
      })) as unknown as Doc
    } catch (e) {
      if (attempt === 2) throw e
    }
  }
  const item = toItem(created!)
  await payload.create({
    collection: 'product-item-cases',
    data: { itemId: item.id, itemNumber: item.number, caseId: facts.caseId, ticket: facts.ticket, title: facts.title.slice(0, 200), productName: facts.productName, vertical: facts.vertical, casePriority: facts.casePriority, customerKind: facts.customerKind || undefined, accountName: facts.accountName, ...personData('supportOwner', facts.owner), caseChoice: input.caseChoice, linkedById: me.id, linkedByName: me.name, linkedAt: now } as never,
    overrideAccess: true,
  })
  forget('product:case:')
  const evidence = input.evidence.length ? await addEvidence(item.id, input.evidence, me) : []
  await addEvent(item, { kind: 'handoff', side: 'support', by: who(me), text: input.summary.trim(), to: 'raised', caseTicket: facts.ticket, evidence })
  const cases = await casesOfItem(item.id)
  const ops = [...mirrorOpsFor(contextOf(item, cases, me, settings), null, 'raised'), ...(settings.mirror.createCrmRows ? [crmRowCreateOp(item, c, facts)] : [])]
  const mirror = await applyMirror(item, ops, me.auth, me.name || me.email, settings)
  const withRow = await rememberCrmRow(item, mirror, me.auth)
  await mirrorEvent(withRow, mirror)
  if (settings.notify.principalsOnRaise) await mail(principalsOf(settings), productRaisedMail({ number: item.number, title: item.title, kind: KIND_LABEL[item.kind].toLowerCase(), ticket: facts.ticket, by: me.name, url: itemUrl(item.number) }))
  return { item: withRow, mirror }
}

/** The CRM's own row for a new item (10-product-desk.md §6 rule 8): an RFE for an enhancement, a defect otherwise, linked to the first case. */
const crmRowCreateOp = (item: ItemRow, c: CaseRow, facts: CaseFacts): MirrorOp => {
  const customer = lookup(c, 'customerid')
  if (crmRowKind(item.kind) === 'rfe') {
    const body = { title: item.title, type: CRM_RFE_TYPE_CUSTOMER, status: CRM_RFE_STATUS.OPEN, receivedFrom: CRM_RFE_FROM_CUSTOMER, caseId: facts.caseId, productId: item.productId || undefined, accountId: facts.customerKind === 'account' && customer ? customer.id : undefined, vertical: item.vertical ?? undefined, serial: s(c.k7_2ndserialnumber) || undefined }
    return { op: 'rfe', caseId: facts.caseId, ticket: facts.ticket, action: 'create', rowId: '', body }
  }
  const body = { title: item.title, status: CRM_DEFECT_STATUS.SUPPORT, priority: CRM_DEFECT_PRIORITY[item.priority], caseId: facts.caseId, incidentNo: facts.ticket, customer: customer && (facts.customerKind === 'account' || facts.customerKind === 'contact') ? { kind: facts.customerKind, id: customer.id } : undefined }
  return { op: 'defect', caseId: facts.caseId, ticket: facts.ticket, action: 'create', rowId: '', body }
}

/** Stores the id and number of a row the mirror just created. */
const rememberCrmRow = async (item: ItemRow, mirror: { created: { rfeId?: string; defectId?: string } }, auth: DataverseAuth | null): Promise<ItemRow> => {
  const { rfeId, defectId } = mirror.created
  if (!rfeId && !defectId) return item
  let crmRef = ''
  try {
    if (rfeId && auth) crmRef = s((await getRfe(auth, rfeId))?.k7_rfeno)
    if (defectId && auth) crmRef = s((await getDefect(auth, defectId))?.k7_defectno)
  } catch {
    /* the number can be read later */
  }
  const payload = await db()
  const u = await payload.update({ collection: 'product-items', id: item.id, data: { ...(rfeId ? { crmRfeId: rfeId } : {}), ...(defectId ? { crmDefectId: defectId } : {}), crmRef } as never, overrideAccess: true })
  return toItem(u as unknown as Doc)
}

/** One more case joins an existing item: the demand count goes up and the case gets the loop's note and status. */
export const linkCase = async (me: Actor, item: ItemRow, c: CaseRow, caseChoice: CaseChoice): Promise<{ item: ItemRow; mirror: MirrorResult } | { error: string }> => {
  if (item.state === 'closed') return { error: 'That item is closed. Reopen it first, or raise a new one.' }
  const settings = await getProductSettings()
  const existing = await casesOfItem(item.id, { includeUnlinked: true })
  if (existing.some((x) => x.caseId === s(c.incidentid) && !x.unlinkedAt)) return { error: 'This case is already linked to that item.' }
  const facts = caseFacts(c, await ownerEmailOf(me.auth, lookup(c, 'ownerid')?.id ?? ''))
  const payload = await db()
  const now = new Date().toISOString()
  await payload.create({
    collection: 'product-item-cases',
    data: { itemId: item.id, itemNumber: item.number, caseId: facts.caseId, ticket: facts.ticket, title: facts.title.slice(0, 200), productName: facts.productName, vertical: facts.vertical, casePriority: facts.casePriority, customerKind: facts.customerKind || undefined, accountName: facts.accountName, ...personData('supportOwner', facts.owner), caseChoice, linkedById: me.id, linkedByName: me.name, linkedAt: now } as never,
    overrideAccess: true,
  })
  const updated = await touch(item, { caseCount: existing.filter((x) => !x.unlinkedAt).length + 1 })
  await addEvent(updated, { kind: 'link', side: 'support', by: who(me), text: `${facts.ticket} "${facts.title}"${facts.accountName ? ` · ${facts.accountName}` : ''}`, caseTicket: facts.ticket })
  const mirror = await applyMirror(updated, linkOpsFor(contextOf(updated, [], me, settings), { caseId: facts.caseId, ticket: facts.ticket, caseChoice }, updated.state), me.auth, me.name || me.email, settings)
  await mirrorEvent(updated, mirror)
  if (settings.notify.ownerOnChange && updated.productOwner) await mail([updated.productOwner], productChangeMail({ number: updated.number, title: updated.title, what: 'Demand grew', by: me.name, detail: `${facts.ticket} was linked; ${updated.caseCount} cases now.`, url: itemUrl(updated.number) }))
  return { item: updated, mirror }
}

export const unlinkCase = async (me: Actor, item: ItemRow, caseId: string): Promise<ItemRow> => {
  const payload = await db()
  const links = await casesOfItem(item.id)
  const link = links.find((x) => x.caseId === caseId)
  if (!link) return item
  await payload.update({ collection: 'product-item-cases', id: link.id, data: { unlinkedAt: new Date().toISOString() } as never, overrideAccess: true })
  const updated = await touch(item, { caseCount: Math.max(0, links.length - 1) })
  await addEvent(updated, { kind: 'unlink', side: 'support', by: who(me), text: link.ticket, caseTicket: link.ticket })
  return updated
}

/* ---------- Moves ---------- */

export type MoveResult = { item: ItemRow; mirror: MirrorResult } | { error: string }

const notifyOwner = async (settings: ProductSettings, item: ItemRow, cases: ItemCase[], what: string, by: Actor, detail = ''): Promise<void> => {
  if (!settings.notify.ownerOnChange) return
  const to = [item.supportOwner.email, ...cases.map((c) => c.supportOwner.email)].filter(Boolean)
  await mail(to, productChangeMail({ number: item.number, title: item.title, what, by: by.name, detail, url: itemUrl(item.number) }))
}

/** The one place a bridge state changes: the rule, the fields, the event, the mirror, the mail. `patch` carries the fields the move sets. */
const move = async (me: Actor, side: Side, item: ItemRow, to: ItemState, patch: Doc, e: { kind?: EventKind; text?: string; question?: string; what: string; detail?: string }): Promise<MoveResult> => {
  if (!canMove(side, item.state, to)) return { error: `${STATE_LABEL[item.state]} → ${STATE_LABEL[to]} is not a move ${side === 'support' ? 'the desk' : side} can make.` }
  const settings = await getProductSettings()
  const from = item.state
  const now = new Date().toISOString()
  const data: Doc = { ...patch, state: to }
  if (to === 'needs-info') data.askedFrom = from === 'raised' || from === 'tracked' ? from : 'tracked'
  if (from === 'needs-info') data.askedFrom = null
  if (to === 'tracked' && from === 'raised') Object.assign(data, { ...personData('triagedBy', who(me)), triagedAt: now })
  if (to === 'declined' && from === 'raised') Object.assign(data, { ...personData('triagedBy', who(me)), triagedAt: now })
  if (to === 'fixed') data.fixedAt = now
  if (to === 'released') data.releasedAt = now
  if (to === 'closed' || to === 'declined') data.closedAt = now
  if (to === 'raised') Object.assign(data, { closedAt: null, releasedAt: null, fixedAt: null, triagedAt: null, declineReason: null, declineNote: '' })
  const updated = await touch(item, data)
  const cases = await casesOfItem(updated.id)
  await addEvent(updated, { kind: e.kind ?? 'state', side, by: who(me), text: e.text ?? '', from, to })
  const mirror = await applyMirror(updated, mirrorOpsFor(contextOf(updated, cases, me, settings), from, to, { question: e.question }), me.auth, me.name || me.email, settings)
  await mirrorEvent(updated, mirror)
  if (side !== 'support') await notifyOwner(settings, updated, cases, e.what, me, e.detail)
  return { item: updated, mirror }
}

export type AcceptInput = { team: Team; priority: Priority; trackerKey: string; productOwner: string; text: string }

/** Principal support accepts an item into the loop: team, priority, the tracker issue (typed or created), then raised → tracked. */
export const acceptItem = async (me: Actor, item: ItemRow, input: AcceptInput): Promise<MoveResult> => {
  const settings = await getProductSettings()
  const tracker = trackerFor(settings)
  const team = teamOf(settings, input.team)
  const patch: Doc = { team: input.team, priority: input.priority, productOwner: input.productOwner.trim().toLowerCase().slice(0, 200) }
  if (input.trackerKey.trim()) {
    const ref = await tracker.resolve(team.trackerProject, input.trackerKey)
    if (!ref) return { error: 'That does not look like a tracker key (BG-3301, US-1234).' }
    patch.tracker = { kind: ref.kind, projectId: ref.projectId, id: ref.id, key: ref.key, url: ref.url, status: '', category: '', syncedAt: null }
  }
  const r = await move(me, 'principal', item, 'tracked', patch, { what: `Accepted for ${team.name} at ${input.priority}`, text: input.text, detail: input.text })
  if ('error' in r) return r
  if (settings.notify.inboxOnAccept) await mail([team.inboxEmail, ...team.leads, r.item.productOwner], productAcceptedMail({ number: r.item.number, title: r.item.title, team: team.name, priority: r.item.priority, by: me.name, trackerKey: r.item.tracker.key, url: itemUrl(r.item.number) }))
  return r
}

export const askSupport = (me: Actor, side: Side, item: ItemRow, question: string): Promise<MoveResult> => move(me, side, item, 'needs-info', {}, { kind: 'ask', text: question, question, what: 'Needs information from support', detail: question })

/** The desk answers: the item returns to the state the question was asked from. */
export const answerQuestion = (me: Actor, side: Side, item: ItemRow, answer: string): Promise<MoveResult> => move(me, side, item, item.askedFrom ?? 'tracked', {}, { kind: 'answer', text: answer, what: 'Answered', detail: answer })

export const declineItem = (me: Actor, side: Side, item: ItemRow, reason: DeclineReason, note: string): Promise<MoveResult> => move(me, side, item, 'declined', { declineReason: reason, declineNote: note.trim().slice(0, 500) }, { what: 'Declined', text: note, detail: note })

export const markFixed = (me: Actor, side: Side, item: ItemRow, version: string, text: string): Promise<MoveResult> => move(me, side, item, 'fixed', { fixedVersion: version.trim().slice(0, 80) }, { what: `Fixed${version ? ` in ${version}` : ''}`, text, detail: text })

export const markReleased = (me: Actor, side: Side, item: ItemRow, version: string, note: string, showToCustomer: boolean): Promise<MoveResult> => move(me, side, item, 'released', { releasedVersion: version.trim().slice(0, 80), releaseNote: note.trim().slice(0, 1000), showReleaseToCustomer: showToCustomer }, { what: `Released${version ? ` in ${version}` : ''}`, text: note, detail: note })

export const backToTracked = (me: Actor, side: Side, item: ItemRow, text: string): Promise<MoveResult> => move(me, side, item, 'tracked', {}, { what: 'Back in progress', text, detail: text })

export const closeItem = (me: Actor, side: Side, item: ItemRow, text = ''): Promise<MoveResult> => move(me, side, item, 'closed', {}, { what: 'Closed', text })

export const reopenItem = (me: Actor, side: Side, item: ItemRow, text: string): Promise<MoveResult> => move(me, side, item, 'raised', {}, { what: 'Reopened', text, detail: text })

/* ---------- Edits that are not moves ---------- */

export const commentOn = async (me: Actor, side: Side, item: ItemRow, text: string, files: EvidenceFile[] = []): Promise<ItemRow> => {
  const evidence = files.length ? await addEvidence(item.id, files, me) : []
  const updated = await touch(item, {})
  await addEvent(updated, { kind: 'comment', side, by: who(me), text: text.trim(), evidence })
  const settings = await getProductSettings()
  if (side !== 'support') await notifyOwner(settings, updated, await casesOfItem(updated.id), 'New comment', me, text.trim().slice(0, 500))
  return updated
}

export const setPriority = async (me: Actor, item: ItemRow, priority: Priority): Promise<ItemRow> => {
  if (priority === item.priority) return item
  const settings = await getProductSettings()
  const updated = await touch(item, { priority })
  await addEvent(updated, { kind: 'priority', side: 'principal', by: who(me), text: `${item.priority} → ${priority}` })
  await mirrorEvent(updated, await applyMirror(updated, crmRowOpsFor({ item: updated, settings }, updated.state), me.auth, me.name || me.email, settings))
  return updated
}

export const rerouteItem = async (me: Actor, item: ItemRow, team: Team): Promise<ItemRow> => {
  if (team === item.team) return item
  const settings = await getProductSettings()
  const updated = await touch(item, { team })
  await addEvent(updated, { kind: 'route', side: 'principal', by: who(me), text: `${teamOf(settings, item.team).name} → ${teamOf(settings, team).name}` })
  return updated
}

/** Links an issue engineering already has, or changes the typed key. */
export const setTrackerKey = async (me: Actor, item: ItemRow, key: string): Promise<ItemRow | { error: string }> => {
  const settings = await getProductSettings()
  const tracker = trackerFor(settings)
  if (!key.trim()) {
    const cleared = await touch(item, { tracker: { kind: 'none', projectId: '', id: '', key: '', url: '', status: '', category: '', syncedAt: null } })
    await addEvent(cleared, { kind: 'tracker-status', side: 'principal', by: who(me), text: 'Tracker reference cleared' })
    return cleared
  }
  const ref = await tracker.resolve(teamOf(settings, item.team).trackerProject, key)
  if (!ref) return { error: 'That does not look like a tracker key (BG-3301, US-1234).' }
  const updated = await touch(item, { tracker: { kind: ref.kind, projectId: ref.projectId, id: ref.id, key: ref.key, url: ref.url, status: item.tracker.status, category: item.tracker.category, syncedAt: item.tracker.syncedAt } })
  await addEvent(updated, { kind: 'tracker-status', side: 'principal', by: who(me), text: `Tracker reference ${item.tracker.key ? `${item.tracker.key} → ` : ''}${ref.key}` })
  await mirrorEvent(updated, await applyMirror(updated, crmRowOpsFor({ item: updated, settings }, updated.state), me.auth, me.name || me.email, settings))
  return updated
}

/** The agent told the customer about the release: the link records it; the caller posts the reply on the case if asked. */
export const markTold = async (me: Actor, item: ItemRow, caseId: string): Promise<ItemCase | null> => {
  const links = await casesOfItem(item.id)
  const link = links.find((x) => x.caseId === caseId)
  if (!link) return null
  const payload = await db()
  const u = await payload.update({ collection: 'product-item-cases', id: link.id, data: { toldAt: new Date().toISOString() } as never, overrideAccess: true })
  forget('product:case:')
  await addEvent(item, { kind: 'told', side: 'support', by: who(me), text: `${link.ticket}: customer told`, caseTicket: link.ticket })
  return toCase(u as unknown as Doc)
}

/* ---------- The desk's view ---------- */

export type DeskView = { needsInfo: ItemRow[]; toTell: { item: ItemRow; cases: ItemCase[] }[]; mine: ItemRow[]; open: ItemRow[] }

/** For /support/workspace/product: what waits on the desk first, then what shipped (with the cases whose customer has not heard yet,
    empty once everyone is told, so the item can be closed from there), then mine, then all. */
export const deskView = async (me: { userId: string }): Promise<DeskView> => {
  const open = await openItems()
  const released = open.filter((i) => i.state === 'released')
  const cases = await casesForItems(released.map((i) => i.id))
  const toTell = released.map((item) => ({ item, cases: (cases.get(item.id) ?? []).filter((c) => !c.toldAt) }))
  return {
    needsInfo: open.filter((i) => i.state === 'needs-info'),
    toTell,
    mine: open.filter((i) => i.raisedBy.id === me.userId || i.supportOwner.id === me.userId),
    open,
  }
}

export const verticalLabel = (v: number | null): string => (v === null ? '' : optLabel(VERTICAL, v))

/** The settings a page needs together: the desk's business hours and the product desk's own. */
export const productContext = async () => {
  const [kpi, product] = await Promise.all([getSettings(), getProductSettings()])
  return { hours: kpi.hours, settings: product, now: new Date() }
}

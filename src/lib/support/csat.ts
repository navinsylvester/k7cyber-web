import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

import configPromise from '@payload-config'
import { getPayload, type Where } from 'payload'

import type { DataverseAuth, Row } from '@/lib/dataverse'
import { fv, lookup } from '@/lib/dataverse/types'

import { asReason, careFrom, causeOf, flagActive, isUnhappy, NO_CARE, readFollowUp, type Care, type CareFlag, type CsatRow, type CsatScore, type CsatSettings, type CsatSource, type FollowUpStatus } from './csat-model'
import { getSettings } from './kpi-config'
import type { Settings } from './kpi-model'
import { csatInviteMail, csatLowScoreMail, csatOverdueMail, sendMail } from './mail'
import { forget, memo } from './memo'
import type { Desk } from './metrics'
import { ORIGIN_WEB } from './options'
import { fmtMinutes } from './sla'
import { addNote } from './timeline'

export * from './csat-model'

/* Customer satisfaction, the server side (09-portal-guide.md §4d). Responses, invitations, follow-ups and care flags live in Payload
   (`support-csat`, `support-care-flags`): the CRM records none of this and production is read-only. The only Dataverse write is an
   internal note on the case when a low score arrives, through the normal guarded client. Survey links are stateless signed tokens. */

const db = () => getPayload({ config: configPromise })

type Doc = Record<string, unknown>
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v))
const n = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const d = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

const toRow = (x: Doc): CsatRow => ({
  id: s(x.id),
  caseId: s(x.caseId),
  ticket: s(x.ticket),
  title: s(x.title),
  customerId: s(x.customerId),
  customerName: s(x.customerName),
  customerKind: x.customerKind === 'account' || x.customerKind === 'contact' ? x.customerKind : '',
  contactId: s(x.contactId),
  email: s(x.email),
  ownerId: s(x.ownerId),
  ownerName: s(x.ownerName),
  product: s(x.product),
  issue: s(x.issue),
  vertical: n(x.vertical),
  priority: n(x.priority),
  origin: n(x.origin),
  status: x.status === 'responded' ? 'responded' : 'invited',
  source: x.source === 'portal' || x.source === 'email' || x.source === 'agent' ? x.source : '',
  score: (n(x.score) as CsatScore | null) ?? null,
  comment: s(x.comment),
  resolvedAt: d(x.resolvedAt),
  invitedAt: d(x.invitedAt),
  remindedAt: d(x.remindedAt),
  respondedAt: d(x.respondedAt),
  followUp: (['none', 'pending', 'in-progress', 'done'] as FollowUpStatus[]).includes(x.followUp as FollowUpStatus) ? (x.followUp as FollowUpStatus) : 'none',
  followUpOwnerId: s(x.followUpOwnerId),
  followUpOwnerName: s(x.followUpOwnerName),
  followUpAt: d(x.followUpAt),
  followUpNote: s(x.followUpNote),
  customerReason: asReason(x.customerReason),
  reason: asReason(x.reason),
  reasonBy: s(x.reasonBy),
  reasonAt: d(x.reasonAt),
  createdAt: s(x.createdAt),
})

const toFlag = (x: Doc): CareFlag => ({ id: s(x.id), customerId: s(x.customerId), customerName: s(x.customerName), level: x.level === 'watch' ? 'watch' : 'high', reason: s(x.reason), setBy: s(x.setBy), setById: s(x.setById), setAt: s(x.createdAt), until: d(x.until), active: x.active !== false })

const find = async (where: Where, o: { limit?: number; sort?: string } = {}): Promise<CsatRow[]> => {
  try {
    const payload = await db()
    const r = await payload.find({ collection: 'support-csat', where, sort: o.sort ?? '-respondedAt', limit: o.limit ?? 1000, depth: 0, overrideAccess: true })
    return r.docs.map((x) => toRow(x as unknown as Doc))
  } catch (e) {
    console.error(`[csat] read failed: ${(e as Error).message}`)
    return []
  }
}

/* ---------- Reads ---------- */

export const csatForCase = async (caseId: string): Promise<CsatRow | null> => (await find({ caseId: { equals: caseId } }, { limit: 1 }))[0] ?? null

export const csatForCases = async (caseIds: string[]): Promise<Map<string, CsatRow>> => {
  const ids = [...new Set(caseIds.filter(Boolean))]
  if (!ids.length) return new Map()
  const rows = await find({ caseId: { in: ids } }, { limit: ids.length })
  return new Map(rows.map((r) => [r.caseId, r]))
}

export const csatById = async (id: string): Promise<CsatRow | null> => {
  if (!/^\d+$/.test(id)) return null
  return (await find({ id: { equals: Number(id) } }, { limit: 1 }))[0] ?? null
}

/** A customer's ratings, newest first (account or contact id). */
export const csatForCustomer = (customerId: string, limit = 20): Promise<CsatRow[]> => (customerId ? find({ or: [{ customerId: { equals: customerId } }, { contactId: { equals: customerId } }], status: { equals: 'responded' } }, { limit }) : Promise.resolve([]))

/** Responses and invitations that fall in the period (answered in it, or invited in it and still unanswered). */
export const csatInPeriod = (from: Date, to: Date): Promise<CsatRow[]> =>
  find({ or: [{ respondedAt: { greater_than_equal: from.toISOString(), less_than: to.toISOString() } }, { and: [{ status: { equals: 'invited' } }, { invitedAt: { greater_than_equal: from.toISOString(), less_than: to.toISOString() } }] }] }, { limit: 5000 })

/** Every rating answered since `since`, newest first: the repeat-customer view looks further back than the period. */
export const respondedSince = (since: Date): Promise<CsatRow[]> => find({ status: { equals: 'responded' }, respondedAt: { greater_than_equal: since.toISOString() } }, { limit: 5000 })

/** Every low score whose follow-up is not closed, oldest first. */
export const openFollowUps = (): Promise<CsatRow[]> => find({ followUp: { in: ['pending', 'in-progress'] } }, { sort: 'respondedAt', limit: 500 })

/** Surveys sent in the last `days` days that were never answered (for reminders). */
const unansweredInvites = (days: number): Promise<CsatRow[]> => find({ status: { equals: 'invited' }, invitedAt: { greater_than: new Date(Date.now() - days * 864e5).toISOString() } }, { sort: 'invitedAt', limit: 2000 })

/* ---------- Care flags and bands ---------- */

export const activeFlags = async (customerIds: string[]): Promise<Map<string, CareFlag>> => {
  const ids = [...new Set(customerIds.filter(Boolean))]
  if (!ids.length) return new Map()
  try {
    const payload = await db()
    const r = await payload.find({ collection: 'support-care-flags', where: { customerId: { in: ids }, active: { equals: true } }, sort: '-createdAt', limit: ids.length * 2, depth: 0, overrideAccess: true })
    const m = new Map<string, CareFlag>()
    for (const x of r.docs) {
      const f = toFlag(x as unknown as Doc)
      if (flagActive(f) && !m.has(f.customerId)) m.set(f.customerId, f)
    }
    return m
  } catch (e) {
    console.error(`[csat] flags read failed: ${(e as Error).message}`)
    return new Map()
  }
}

export const flagHistory = async (customerId: string): Promise<CareFlag[]> => {
  try {
    const payload = await db()
    const r = await payload.find({ collection: 'support-care-flags', where: { customerId: { equals: customerId } }, sort: '-createdAt', limit: 20, depth: 0, overrideAccess: true })
    return r.docs.map((x) => toFlag(x as unknown as Doc))
  } catch {
    return []
  }
}

export const setCareFlag = async (f: { customerId: string; customerName: string; customerKind: 'account' | 'contact' | ''; level: 'high' | 'watch'; reason: string; until: Date | null }, by: { id: string; name: string }): Promise<void> => {
  const payload = await db()
  // One active flag per customer: clearing the old one keeps the history readable.
  await payload.update({ collection: 'support-care-flags', where: { customerId: { equals: f.customerId }, active: { equals: true } }, data: { active: false, clearedBy: by.name, clearedAt: new Date().toISOString() }, overrideAccess: true })
  await payload.create({ collection: 'support-care-flags', data: { customerId: f.customerId, customerName: f.customerName, customerKind: f.customerKind || undefined, level: f.level, reason: f.reason, setBy: by.name, setById: by.id, until: f.until?.toISOString() ?? null, active: true }, overrideAccess: true })
  forget(`care:${f.customerId}`)
}

export const clearCareFlag = async (customerId: string, by: { id: string; name: string }): Promise<void> => {
  const payload = await db()
  await payload.update({ collection: 'support-care-flags', where: { customerId: { equals: customerId }, active: { equals: true } }, data: { active: false, clearedBy: by.name, clearedAt: new Date().toISOString() }, overrideAccess: true })
  forget(`care:${customerId}`)
}

/** The care band for one customer: a few seconds of memo so a case page and its list agree. */
export const careForCustomer = (customerId: string, settings: Settings): Promise<Care> =>
  customerId
    ? memo(`care:${customerId}`, 15_000, async () => {
        const [ratings, flags] = await Promise.all([csatForCustomer(customerId, 20), activeFlags([customerId])])
        return careFrom(ratings, flags.get(customerId) ?? null, settings.csat)
      })
    : Promise.resolve(NO_CARE)

/** Care bands for a list of customers in two queries, for ledgers and boards. */
export const careForCustomers = async (customerIds: string[], settings: Settings): Promise<Map<string, Care>> => {
  const ids = [...new Set(customerIds.filter(Boolean))]
  const out = new Map<string, Care>()
  if (!ids.length) return out
  const since = new Date(Date.now() - settings.csat.careWindowDays * 864e5).toISOString()
  const [rows, flags] = await Promise.all([find({ or: [{ customerId: { in: ids } }, { contactId: { in: ids } }], status: { equals: 'responded' }, respondedAt: { greater_than: since } }, { limit: 5000 }), activeFlags(ids)])
  const by = new Map<string, CsatRow[]>()
  for (const r of rows) {
    for (const k of [r.customerId, r.contactId]) if (k && ids.includes(k)) by.set(k, [...(by.get(k) ?? []), r])
  }
  for (const id of ids) out.set(id, careFrom(by.get(id) ?? [], flags.get(id) ?? null, settings.csat))
  return out
}

/* ---------- The case snapshot a row is built from ---------- */

export type CaseSnapshot = {
  caseId: string
  ticket: string
  title: string
  customerId: string
  customerName: string
  customerKind: 'account' | 'contact' | ''
  contactId: string
  email: string
  ownerId: string
  ownerName: string
  product: string
  issue: string
  vertical: number | null
  priority: number | null
  origin: number | null
  resolvedAt: string | null
  /** Raised through the portal (origin Web, or the portal's attribution field set). */
  portal: boolean
}

/** From a Dataverse case row read with CASE_SELECT. */
export const snapshotOf = (c: Row, resolvedAt?: Date | string | null): CaseSnapshot => {
  const customer = lookup(c, 'customerid')
  const primary = lookup(c, 'primarycontactid')
  const owner = lookup(c, 'ownerid')
  const num = (k: string) => (typeof c[k] === 'number' ? (c[k] as number) : null)
  return {
    caseId: s(c.incidentid),
    ticket: s(c.ticketnumber),
    title: s(c.title),
    customerId: customer?.id ?? '',
    customerName: customer?.name ?? '',
    customerKind: customer?.logicalName === 'account' ? 'account' : customer?.logicalName === 'contact' ? 'contact' : '',
    contactId: primary?.id ?? (customer?.logicalName === 'contact' ? customer.id : ''),
    email: s(c.k7_customeremail).trim().toLowerCase(),
    ownerId: owner?.id ?? '',
    ownerName: owner?.name ?? '',
    product: fv(c, '_productid_value'),
    issue: fv(c, '_new_issue_value'),
    vertical: num('new_verticaltype'),
    priority: num('prioritycode'),
    origin: num('caseorigincode'),
    resolvedAt: resolvedAt ? new Date(resolvedAt).toISOString() : c.statecode === 1 ? s(c.modifiedon) || null : null,
    portal: num('caseorigincode') === ORIGIN_WEB || Boolean(s(c.adx_createdbyusername)),
  }
}

const snapshotData = (c: CaseSnapshot) => ({
  caseId: c.caseId,
  ticket: c.ticket,
  title: c.title.slice(0, 200),
  customerId: c.customerId,
  customerName: c.customerName,
  customerKind: c.customerKind || undefined,
  contactId: c.contactId,
  email: c.email,
  ownerId: c.ownerId,
  ownerName: c.ownerName,
  product: c.product,
  issue: c.issue,
  vertical: c.vertical,
  priority: c.priority,
  origin: c.origin,
  resolvedAt: c.resolvedAt,
})

/* ---------- Survey links ---------- */

export type SurveyToken = { caseId: string; ticket: string; email: string; exp: number }

const secret = (): string => {
  const x = process.env.AUTH_SECRET
  if (!x) throw new Error('AUTH_SECRET is not set')
  return x
}
const hmac = (data: string) => createHmac('sha256', secret()).update(`csat.${data}`).digest('base64url')

export const surveyToken = (p: Omit<SurveyToken, 'exp'>, days: number): string => {
  const body = Buffer.from(JSON.stringify({ ...p, exp: Math.floor(Date.now() / 1000) + days * 86400 })).toString('base64url')
  return `${body}.${hmac(body)}`
}

export const readSurveyToken = (t: string | undefined | null): SurveyToken | null => {
  if (!t) return null
  const [body, sig] = t.split('.')
  if (!body || !sig) return null
  const expect = hmac(body)
  if (expect.length !== sig.length || !timingSafeEqual(Buffer.from(expect), Buffer.from(sig))) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SurveyToken
    if (!p.caseId || !p.ticket || typeof p.exp !== 'number' || p.exp < Date.now() / 1000) return null
    return p
  } catch {
    return null
  }
}

const base = () => (process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000').replace(/\/$/, '')
export const surveyUrl = (token: string) => `${base()}/support/csat/${encodeURIComponent(token)}`
const manageUrl = () => `${base()}/support/workspace/manage/csat`

/* ---------- Invitations ---------- */

export type InviteResult = { row: CsatRow; sent: boolean; skipped?: 'no-email' | 'answered' | 'disabled' }

/** Creates (or finds) the survey row for a resolved case and emails the link. `reminder` re-sends on an unanswered invitation. */
export const inviteSurvey = async (c: CaseSnapshot, o: { settings?: Settings; reminder?: boolean } = {}): Promise<InviteResult> => {
  const settings = o.settings ?? (await getSettings())
  const existing = await csatForCase(c.caseId)
  if (existing?.status === 'responded') return { row: existing, sent: false, skipped: 'answered' }
  const payload = await db()
  const now = new Date().toISOString()
  let row = existing
  if (!row) {
    const created = await payload.create({ collection: 'support-csat', data: { ...snapshotData(c), status: 'invited', followUp: 'none', invitedAt: c.email ? now : null }, overrideAccess: true })
    row = toRow(created as unknown as Doc)
  }
  if (!settings.csat.enabled) return { row, sent: false, skipped: 'disabled' }
  if (!c.email) return { row, sent: false, skipped: 'no-email' }
  const url = surveyUrl(surveyToken({ caseId: c.caseId, ticket: c.ticket, email: c.email }, settings.csat.surveyDays))
  const r = await sendMail({ to: c.email, ...csatInviteMail(c.ticket, c.title, url, { reminder: o.reminder }) })
  const patch: Doc = o.reminder ? { remindedAt: now } : { invitedAt: now }
  const updated = await payload.update({ collection: 'support-csat', id: row.id, data: patch as never, overrideAccess: true })
  return { row: toRow(updated as unknown as Doc), sent: r.sent }
}

/* ---------- Responses ---------- */

export type ResponseInput = { score: CsatScore; comment: string; source: CsatSource; contactId?: string; email?: string; /** A reason key: the customer's own pick on the survey, or the agent's classification when the source is `agent`. */ reason?: string }

/** Records the customer's answer (first or changed). A low score opens the follow-up, tells the managers and leaves an internal
   note on the case; a later higher score does not close an open follow-up (a manager does). */
export const recordResponse = async (c: CaseSnapshot, input: ResponseInput, o: { settings?: Settings; auth?: DataverseAuth | null; /** The agent recording a phone rating, credited with its classification. */ by?: { id: string; name: string } } = {}): Promise<CsatRow> => {
  const settings = o.settings ?? (await getSettings())
  const payload = await db()
  const now = new Date().toISOString()
  const existing = await csatForCase(c.caseId)
  const low = isUnhappy(input.score, settings.csat)
  const followUp: FollowUpStatus = low ? (existing && existing.followUp !== 'none' && existing.followUp !== 'done' ? existing.followUp : 'pending') : (existing?.followUp ?? 'none')
  const data: Doc = {
    ...snapshotData(c),
    contactId: input.contactId || c.contactId,
    email: input.email || c.email,
    status: 'responded',
    source: input.source || undefined,
    score: input.score,
    comment: input.comment.trim().slice(0, 2000),
    respondedAt: now,
    followUp,
  }
  const reason = asReason(input.reason)
  if (input.source === 'agent') {
    if (reason) Object.assign(data, { reason, reasonBy: o.by?.name ?? 'an agent', reasonAt: now })
  } else data.customerReason = reason
  // A low score after a closed follow-up reopens it; the first time, the follow-up owner is nobody yet.
  if (low && existing?.followUp === 'done') Object.assign(data, { followUp: 'pending', followUpOwnerId: '', followUpOwnerName: '', followUpAt: null, followUpNote: '' })
  const saved = existing ? await payload.update({ collection: 'support-csat', id: existing.id, data: data as never, overrideAccess: true }) : await payload.create({ collection: 'support-csat', data: { ...data, invitedAt: null } as never, overrideAccess: true })
  const row = toRow(saved as unknown as Doc)
  forget(`care:${c.customerId}`)
  if (c.contactId) forget(`care:${c.contactId}`)
  if (low && (!existing || existing.score === null || !isUnhappy(existing.score, settings.csat) || existing.followUp === 'done')) {
    if (settings.csat.notifyManagersOnLow && settings.sweep.managerEmails.length) {
      const cause = causeOf(row)
      await sendMail({ to: settings.sweep.managerEmails.join(', '), ...csatLowScoreMail({ ticket: c.ticket, title: c.title, score: input.score, comment: row.comment, customer: c.customerName, owner: c.ownerName, product: c.product, reason: cause.key ? cause.label : '', url: manageUrl() }) }).catch((e) => console.error(`[csat] manager mail failed: ${(e as Error).message}`))
    }
    if (o.auth) {
      const cause = causeOf(row)
      await addNote(o.auth, c.caseId, { subject: `CSAT ${input.score}/5: follow-up needed`, text: `The customer rated this case ${input.score} of 5${row.comment ? `: "${row.comment}"` : ''}.${cause.key ? ` They say it was about: ${cause.label.toLowerCase()}.` : ''} A manager follows up from the portal (${manageUrl()}).` }).catch((e) => console.error(`[csat] note on case failed: ${(e as Error).message}`))
    }
  }
  return row
}

/* ---------- Follow-ups ---------- */

export const takeFollowUp = async (id: string, me: { id: string; name: string }): Promise<CsatRow | null> => {
  const row = await csatById(id)
  if (!row || row.followUp === 'none') return null
  const payload = await db()
  const data: Doc = { followUpOwnerId: me.id, followUpOwnerName: me.name }
  if (row.followUp === 'pending') data.followUp = 'in-progress'
  const u = await payload.update({ collection: 'support-csat', id: row.id, data, overrideAccess: true })
  return toRow(u as unknown as Doc)
}

/** Closes the follow-up with what was agreed; `reason` is what the call found it was about (a reason key), which the report groups by. */
export const closeFollowUp = async (id: string, me: { id: string; name: string }, note: string, reason = ''): Promise<CsatRow | null> => {
  const row = await csatById(id)
  if (!row || row.followUp === 'none') return null
  const payload = await db()
  const now = new Date().toISOString()
  const data: Doc = { followUp: 'done', followUpOwnerId: row.followUpOwnerId || me.id, followUpOwnerName: row.followUpOwnerName || me.name, followUpAt: now, followUpNote: note.trim().slice(0, 2000) }
  const r = asReason(reason)
  if (r) Object.assign(data, { reason: r, reasonBy: me.name, reasonAt: now })
  const u = await payload.update({ collection: 'support-csat', id: row.id, data, overrideAccess: true })
  forget(`care:${row.customerId}`)
  if (row.contactId) forget(`care:${row.contactId}`)
  return toRow(u as unknown as Doc)
}

/** A manager (or agent) says what a rating was about without touching the follow-up; an empty reason clears the desk's call. */
export const classifyResponse = async (id: string, reason: string, me: { id: string; name: string }): Promise<CsatRow | null> => {
  const row = await csatById(id)
  if (!row || row.score === null) return null
  const payload = await db()
  const r = asReason(reason)
  const u = await payload.update({ collection: 'support-csat', id: row.id, data: r ? { reason: r, reasonBy: me.name, reasonAt: new Date().toISOString() } : { reason: '', reasonBy: '', reasonAt: null }, overrideAccess: true })
  return toRow(u as unknown as Doc)
}

export const reopenFollowUp = async (id: string): Promise<CsatRow | null> => {
  const row = await csatById(id)
  if (!row || row.score === null) return null
  const payload = await db()
  const u = await payload.update({ collection: 'support-csat', id: row.id, data: { followUp: 'pending', followUpAt: null }, overrideAccess: true })
  forget(`care:${row.customerId}`)
  return toRow(u as unknown as Doc)
}

/* ---------- The sweep's CSAT pass ---------- */

export type CsatSweepResult = { invited: number; reminded: number; overdue: number; notes: string[] }

/** Runs with the prevention sweep: invite the period's resolved cases the mode allows, remind once, and tell the managers about
   follow-ups past target. A dry run only counts. Mail reaches customers only through SMTP_URL; without it the invitation is logged. */
export const csatSweep = async (desk: Desk, o: { live: boolean; settings?: Settings }): Promise<CsatSweepResult> => {
  const settings = o.settings ?? desk.settings
  const cs = settings.csat
  const out: CsatSweepResult = { invited: 0, reminded: 0, overdue: 0, notes: [] }
  if (!cs.enabled) return out
  if (cs.inviteMode !== 'off') {
    const candidates = desk.resolvedCases.filter((c) => c.customerEmail && (cs.inviteMode === 'all' || c.portal))
    const have = await csatForCases(candidates.map((c) => c.id))
    for (const c of candidates) {
      if (have.has(c.id)) continue
      out.invited++
      if (!o.live) continue
      try {
        await inviteSurvey({ caseId: c.id, ticket: c.ticket, title: c.title, customerId: c.customerId, customerName: c.customer, customerKind: c.customerKind, contactId: c.contactId, email: c.customerEmail, ownerId: c.owner.kind === 'user' ? c.owner.id : '', ownerName: c.owner.name, product: c.product, issue: c.issue, vertical: c.vertical, priority: c.priority, origin: c.origin, resolvedAt: c.resolvedAt?.toISOString() ?? null, portal: c.portal }, { settings })
      } catch (e) {
        out.notes.push(`${c.ticket}: invite failed: ${(e as Error).message.slice(0, 100)}`)
      }
    }
  }
  if (cs.reminderAfterHours) {
    const due = (await unansweredInvites(cs.surveyDays)).filter((r) => r.invitedAt && !r.remindedAt && desk.now.getTime() - new Date(r.invitedAt).getTime() >= cs.reminderAfterHours! * 3600_000 && r.email)
    out.reminded = due.length
    if (o.live) {
      for (const r of due) {
        try {
          await inviteSurvey({ caseId: r.caseId, ticket: r.ticket, title: r.title, customerId: r.customerId, customerName: r.customerName, customerKind: r.customerKind, contactId: r.contactId, email: r.email, ownerId: r.ownerId, ownerName: r.ownerName, product: r.product, issue: r.issue, vertical: r.vertical, priority: r.priority, origin: r.origin, resolvedAt: r.resolvedAt, portal: true }, { settings, reminder: true })
        } catch (e) {
          out.notes.push(`${r.ticket}: reminder failed: ${(e as Error).message.slice(0, 100)}`)
        }
      }
    }
  }
  const open = await openFollowUps()
  const overdue = open.filter((r) => readFollowUp(r, cs, settings.hours, desk.now).state === 'overdue')
  out.overdue = overdue.length
  if (o.live && overdue.length && settings.sweep.managerEmails.length) {
    await sendMail({ to: settings.sweep.managerEmails.join(', '), ...csatOverdueMail(overdue.map((r) => ({ ticket: r.ticket, customer: r.customerName, score: r.score ?? 0, waited: fmtMinutes(readFollowUp(r, cs, settings.hours, desk.now).minutes) })), manageUrl()) }).catch((e) => out.notes.push(`overdue mail failed: ${(e as Error).message.slice(0, 100)}`))
  }
  return out
}

/* ---------- Helpers for pages ---------- */

export const followUpState = (r: CsatRow, settings: Settings, now = new Date()) => readFollowUp(r, settings.csat, settings.hours, now)

/** The customer's own view: their ratings, to show "rate this" markers on the closed list. */
export const ratedCases = async (caseIds: string[]): Promise<Map<string, CsatRow>> => csatForCases(caseIds)

export type { CsatSettings }

/** A snapshot rebuilt from a stored row, for the public survey page that never touches Dataverse. */
export const snapshotFromRow = (r: CsatRow): CaseSnapshot => ({ caseId: r.caseId, ticket: r.ticket, title: r.title, customerId: r.customerId, customerName: r.customerName, customerKind: r.customerKind, contactId: r.contactId, email: r.email, ownerId: r.ownerId, ownerName: r.ownerName, product: r.product, issue: r.issue, vertical: r.vertical, priority: r.priority, origin: r.origin, resolvedAt: r.resolvedAt, portal: r.origin === ORIGIN_WEB })

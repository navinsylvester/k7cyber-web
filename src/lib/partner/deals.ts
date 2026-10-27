import 'server-only'
import configPromise from '@payload-config'
import { getPayload, type Where } from 'payload'

import { DEAL_FILE_MAX, DEAL_FILE_MIME } from '@/collections/partner/PartnerDealFiles'

import { audit, SYSTEM, type Actor } from './audit'
import { canRequestExtension, conflictsAmong, customerKey, emailDomain, formatInr, isProtected, k7MayAmend, mayAddNote, partnerMayEdit, partnerMayWithdraw, protectionEnd, registerBlocked, toDeal, toDealFile, toProduct, validateDeal, type Conflict, type Deal, type DealFile, type DealInput, type DealLine, type Product, type ThreadEntry } from './deals-model'
import { nextId } from './ids'
import { enqueueOutbox } from './mirror'
import { notify, type Recipient } from './notify'
import { dealVars } from './notify-model'
import { normaliseMobile, type FieldErrors } from './registration-model'
import { orgRel, orgWhere, type OrgScope } from './scope'
import type { K7Context, PartnerContext } from './session'
import { getPartnerSettings } from './settings'
import { alreadyLine, canDecideDeal, canMoveDeal, DEAL_DECISION_LABEL, DEAL_DECISION_TO, DEAL_STATUS_LABEL, dealDecisionNeedsComment, isRepeatedDealDecision, isRepeatedExtension, LIVE_DEAL_STATUSES, OPEN_DEAL_STATUSES, type DealDecision, type DealStatus } from './status'
import { loadPartnerUser, orgUsers, type PartnerUser } from './users'

/* Deal registrations (01-requirements.md §7, 02-build-plan.md M4): the partner's submission with its number and attachments, the
   conflict check at submission (FR-DEAL-04), the approver's decisions (FR-DEAL-05) and what approval starts (the protection
   window and the opportunity job, FR-DEAL-06), the one extension (FR-DEAL-07), the partner's list (FR-DEAL-08), the edit rules
   (FR-DEAL-09), and the sweep that expires protection and sends the ending notice. Every partner read carries `me.scope`; the K7
   side reads by number. Every move writes one audit row and tells the people concerned through `notify`. */

const db = () => getPayload({ config: configPromise })
type Doc = Record<string, unknown>
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

export const PARTNER_DEALS = '/partners/portal/deals'
export const PARTNER_DASHBOARD = '/partners/portal/dashboard'
export const K7_DEALS = '/partners/portal/k7/deals'

/* ---------- Products (decision 19) ---------- */

export const listProducts = async (o: { activeOnly?: boolean } = {}): Promise<Product[]> => {
  const payload = await db()
  const r = await payload.find({ collection: 'partner-products', where: o.activeOnly ? { active: { equals: true } } : {}, sort: 'order', limit: 200, depth: 0, overrideAccess: true })
  return (r.docs as unknown as Doc[]).map(toProduct).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
}

/* ---------- Reads ---------- */

const read = async (where: Where): Promise<Deal | null> => {
  const payload = await db()
  const r = await payload.find({ collection: 'partner-deals', where, limit: 1, depth: 1, overrideAccess: true })
  const doc = r.docs[0] as unknown as Doc | undefined
  return doc ? toDeal(doc) : null
}

const isDealNumber = (n: string): boolean => /^K7D-\d{5}$/.test(n)

/** One deal of the scope by its number; another organisation's number is null, never its row. */
export const loadDeal = async (scope: OrgScope, dealId: string): Promise<Deal | null> => {
  const n = dealId.trim().toUpperCase()
  if (!isDealNumber(n)) return null
  return read(orgWhere(scope, { dealId: { equals: n } }))
}

/** For the K7 side: any deal by number. */
export const findDealByNumber = async (dealId: string): Promise<Deal | null> => {
  const n = dealId.trim().toUpperCase()
  if (!isDealNumber(n)) return null
  return read({ dealId: { equals: n } })
}

export const loadDealById = async (id: string): Promise<Deal | null> => {
  if (!id) return null
  try {
    const payload = await db()
    return toDeal((await payload.findByID({ collection: 'partner-deals', id, depth: 1, overrideAccess: true })) as unknown as Doc)
  } catch {
    return null
  }
}

export type DealView = 'live' | 'approved' | 'submitted' | 'infoRequested' | 'extensionRequested' | 'closed' | 'rejected' | 'expired' | 'withdrawn' | 'all'
export type DealFilter = { view?: DealView; q?: string; productId?: string; from?: string; to?: string; min?: number; max?: number; orgId?: string; page?: number; limit?: number }
export type DealPage = { rows: Deal[]; total: number; page: number; totalPages: number }

const viewWhere = (view: DealView): Where | null => {
  if (view === 'all') return null
  if (view === 'live') return { status: { in: [...LIVE_DEAL_STATUSES] } }
  if (view === 'closed') return { status: { in: ['rejected', 'expired', 'withdrawn'] } }
  return { status: { equals: view } }
}

const filterParts = (f: DealFilter): Where[] => {
  const parts: Where[] = []
  const v = viewWhere(f.view ?? 'all')
  if (v) parts.push(v)
  if (f.productId) parts.push({ 'products.product': { equals: f.productId } })
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) parts.push({ submittedAt: { greater_than_equal: `${f.from}T00:00:00.000Z` } })
  if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) parts.push({ submittedAt: { less_than_equal: `${f.to}T23:59:59.999Z` } })
  if (typeof f.min === 'number' && f.min > 0) parts.push({ expectedValue: { greater_than_equal: f.min } })
  if (typeof f.max === 'number' && f.max > 0) parts.push({ expectedValue: { less_than_equal: f.max } })
  if (f.orgId) parts.push({ org: { equals: f.orgId } })
  const q = f.q?.trim()
  if (q) parts.push({ or: [{ dealId: { like: q } }, { customerName: { like: q } }, { 'customer.email': { like: q } }, { 'customer.city': { like: q } }, { orgPartnerId: { like: q } }, { orgName: { like: q } }, { 'reseller.name': { like: q } }, { 'crm.opportunityNo': { like: q } }] })
  return parts
}

const page = async (where: Where, f: DealFilter, sort: string): Promise<DealPage> => {
  const payload = await db()
  const limit = f.limit ?? 25
  const p = Math.max(1, f.page ?? 1)
  const r = await payload.find({ collection: 'partner-deals', where, sort, limit, page: p, depth: 1, overrideAccess: true })
  return { rows: (r.docs as unknown as Doc[]).map(toDeal), total: r.totalDocs, page: r.page ?? p, totalPages: r.totalPages }
}

/** The organisation's deals (FR-DEAL-08), newest first, filtered by status, product, date and value. */
export const listDeals = (scope: OrgScope, f: DealFilter = {}): Promise<DealPage> => {
  const parts = filterParts(f)
  return page(orgWhere(scope, parts.length ? { and: parts } : undefined), f, '-submittedAt')
}

/** The approver's ledger: what waits oldest first, everything else newest first. */
export const listDealsK7 = (f: DealFilter = {}): Promise<DealPage> => {
  const parts = filterParts(f)
  const waiting = f.view === 'submitted' || f.view === 'extensionRequested' || f.view === 'live'
  return page(parts.length ? { and: parts } : {}, f, waiting ? 'submittedAt' : '-updatedAt')
}

export type DealCounts = Record<DealStatus, number> & { open: number; endingSoon: number }

const countWhere = async (where: Where): Promise<number> => {
  const payload = await db()
  return (await payload.count({ collection: 'partner-deals', where, overrideAccess: true })).totalDocs
}

/** Counts by status, for the queue and the homes; with a scope, the organisation's own. */
export const dealCounts = async (scope?: OrgScope): Promise<DealCounts> => {
  const settings = await getPartnerSettings()
  const own = (w: Where): Where => (scope ? orgWhere(scope, w) : w)
  const statuses: DealStatus[] = ['submitted', 'infoRequested', 'approved', 'rejected', 'extensionRequested', 'expired', 'withdrawn']
  const out = { submitted: 0, infoRequested: 0, approved: 0, rejected: 0, extensionRequested: 0, expired: 0, withdrawn: 0, open: 0, endingSoon: 0 }
  const soon = new Date(Date.now() + settings.deals.endingNoticeDays * 86400000).toISOString()
  const [counts, ending] = await Promise.all([Promise.all(statuses.map((st) => countWhere(own({ status: { equals: st } })))), countWhere(own({ and: [{ status: { equals: 'approved' } }, { protectionEnds: { less_than_equal: soon } }, { protectionEnds: { greater_than: new Date().toISOString() } }] }))])
  statuses.forEach((st, i) => (out[st] = counts[i]!))
  out.open = out.submitted + out.extensionRequested
  out.endingSoon = ending
  return out
}

/* ---------- Files ---------- */

export type DealFileInput = { name: string; mime: string; bytes: Buffer }

/** The files of a multipart form field: the limits of the collection, or the reason one was refused. */
export const filesFrom = async (form: FormData, key: string): Promise<DealFileInput[] | string> => {
  const out: DealFileInput[] = []
  for (const f of form.getAll(key)) {
    if (!(f instanceof File) || f.size === 0) continue
    if (f.size > DEAL_FILE_MAX) return `${f.name} is over 10 MB.`
    const mime = f.type || 'application/octet-stream'
    if (!DEAL_FILE_MIME.includes(mime) && !/\.(pdf|png|jpe?g|gif|webp|docx?|xlsx?|txt|csv|zip)$/i.test(f.name)) return `${f.name}: a quote, an RFP or a purchase intent as PDF, an image, a Word or Excel file, text or zip.`
    out.push({ name: f.name, mime, bytes: Buffer.from(await f.arrayBuffer()) })
  }
  return out
}

const addFiles = async (dealRowId: string, orgId: string, files: DealFileInput[], by: string): Promise<number[]> => {
  const payload = await db()
  const ids: number[] = []
  for (const f of files) {
    try {
      const doc = await payload.create({ collection: 'partner-deal-files', data: { dealId: dealRowId, orgId, uploadedBy: by }, file: { data: f.bytes, mimetype: f.mime || 'application/octet-stream', name: f.name.replace(/[^\w.\- ()]+/g, '_').slice(0, 120), size: f.bytes.length }, overrideAccess: true })
      ids.push(Number(doc.id))
    } catch (e) {
      console.error(`[partner deals] file upload failed: ${(e as Error).message}`)
    }
  }
  return ids
}

/** A file row with the deal and organisation it belongs to, for the download routes' checks. */
export const dealFileById = async (id: string): Promise<(DealFile & { dealRowId: string; orgId: string }) | null> => {
  if (!/^\d+$/.test(id)) return null
  try {
    const payload = await db()
    const doc = (await payload.findByID({ collection: 'partner-deal-files', id: Number(id), depth: 0, overrideAccess: true })) as unknown as Doc
    return { ...toDealFile(doc), dealRowId: s(doc.dealId), orgId: s(doc.orgId) }
  } catch {
    return null
  }
}

/* ---------- Writing ---------- */

const update = async (id: string, data: Record<string, unknown>): Promise<Deal> => {
  const payload = await db()
  const doc = await payload.update({ collection: 'partner-deals', id, data: data as never, depth: 1, overrideAccess: true })
  return toDeal(doc as unknown as Doc)
}

const entryData = (e: Omit<ThreadEntry, 'files'> & { fileIds?: number[] }): Record<string, unknown> => ({ kind: e.kind, side: e.side, byName: e.byName, byEmail: e.byEmail, at: e.at, to: e.to || '', title: e.title, text: e.text, files: e.fileIds?.length ? e.fileIds : undefined })

/** The stored thread as data again, so an update appends without losing the earlier entries' files. */
const threadData = (dl: Deal): Record<string, unknown>[] => dl.thread.map((t) => ({ kind: t.kind, side: t.side, byName: t.byName, byEmail: t.byEmail, at: t.at, to: t.to || '', title: t.title, text: t.text, files: t.files.length ? t.files.map((f) => Number(f.id)) : undefined }))

const linesData = (lines: { productId: string; quantity: number }[], products: Product[]): { product: number | string; sku: string; quantity: number }[] =>
  lines
    .filter((l) => l.productId)
    .map((l) => {
      const p = products.find((x) => x.id === l.productId)
      return { product: /^\d+$/.test(l.productId) ? Number(l.productId) : l.productId, sku: p?.sku ?? '', quantity: l.quantity }
    })

const customerData = (d: DealInput) => {
  const c = d.customer
  const email = c.email.trim().toLowerCase()
  return {
    customerName: c.name.trim(),
    customerKey: customerKey(c.name),
    customer: { industry: c.industry.trim(), city: c.city.trim(), state: c.state.trim(), contactName: c.contactName.trim(), designation: c.designation.trim(), email, emailDomain: emailDomain(email), phone: normaliseMobile(c.phone) },
    expectedValue: d.expectedValue,
    closeDate: d.closeDate,
    source: d.source,
    competitor: d.competitor.trim(),
    notes: d.notes.trim(),
  }
}

/** The reseller a Distributor names, linked to an organisation when the name matches one (appendix 14). */
const resolveReseller = async (name: string): Promise<{ name: string; orgId: string; orgPartnerId: string }> => {
  const n = name.trim()
  if (!n) return { name: '', orgId: '', orgPartnerId: '' }
  const key = customerKey(n)
  try {
    const payload = await db()
    const r = await payload.find({ collection: 'partner-orgs', where: { or: [{ name: { like: n }, }, { tradeName: { like: n } }] }, limit: 10, depth: 0, overrideAccess: true })
    const hit = (r.docs as unknown as Doc[]).find((o) => customerKey(s(o.name)) === key || customerKey(s(o.tradeName)) === key)
    return { name: n, orgId: hit ? s(hit.id) : '', orgPartnerId: hit ? s(hit.partnerId) : '' }
  } catch {
    return { name: n, orgId: '', orgPartnerId: '' }
  }
}

/** The conflict check over the portal's own deals (FR-DEAL-04): candidates share the customer key, the work domain or the
    contact email; the matcher then keeps the live ones. Other organisations' deals are read here on purpose, for the approver. */
export const findConflicts = async (subject: { id?: string; customerKey: string; emailDomain: string; customer: { email: string } }): Promise<Conflict[]> => {
  const or: Where[] = []
  if (subject.customerKey) or.push({ customerKey: { equals: subject.customerKey } })
  if (subject.emailDomain) or.push({ 'customer.emailDomain': { equals: subject.emailDomain } })
  const email = subject.customer.email.trim().toLowerCase()
  if (email) or.push({ 'customer.email': { equals: email } })
  if (!or.length) return []
  const payload = await db()
  const r = await payload.find({ collection: 'partner-deals', where: { and: [{ status: { in: [...LIVE_DEAL_STATUSES] } }, { or }] }, limit: 50, depth: 0, overrideAccess: true })
  return conflictsAmong(subject, (r.docs as unknown as Doc[]).map(toDeal))
}

/** Who on the partner side hears about a deal: the person who registered it and the organisation's admins, each once. */
const partnerRecipients = async (dl: Deal): Promise<Recipient[]> => {
  const seen = new Set<string>()
  const out: Recipient[] = []
  const add = (u: PartnerUser | null | undefined) => {
    if (!u || seen.has(u.id) || u.status === 'disabled') return
    seen.add(u.id)
    out.push({ kind: 'user', user: u })
  }
  add((await loadPartnerUser(dl.registeredBy.userId))?.user)
  for (const a of await orgUsers(dl.orgId, ['admin'])) add(a)
  return out
}

export type DealResult = { ok: true; deal: Deal } | { ok: false; errors: FieldErrors }
/** `already` is set when the same K7 decision had been made (a second click, B-03): nothing changed, the line says so. */
export type DealMove = { ok: true; deal: Deal; already?: string } | { ok: false; error: string }

/** Why this person may not register now, or null (decision 8). */
export const registerGate = async (me: PartnerContext): Promise<string | null> => {
  const settings = await getPartnerSettings()
  return registerBlocked(me.org, me.user, settings.deals.requireCertificate)
}

const summary = (dl: Deal): string => `${dl.customer.name} · ${dl.products.map((l) => `${l.name} × ${l.quantity}`).join(', ')} · ${formatInr(dl.expectedValue)}`

/** Submission (FR-DEAL-02 to 04): the row with its number, the conflicts found, the attachments, the staff bell and the receipt. */
export const submitDeal = async (me: PartnerContext, input: DealInput, files: DealFileInput[] = []): Promise<DealResult> => {
  const blocked = await registerGate(me)
  if (blocked) return { ok: false, errors: { gate: blocked } }
  const products = await listProducts({ activeOnly: true })
  const errors = validateDeal(input, products, me.org.type)
  if (Object.keys(errors).length) return { ok: false, errors }
  const payload = await db()
  const now = new Date().toISOString()
  const dealId = await nextId('deal')
  const cd = customerData(input)
  const reseller = me.org.type === 'distributor' ? await resolveReseller(input.resellerName) : { name: '', orgId: '', orgPartnerId: '' }
  const conflicts = await findConflicts({ customerKey: cd.customerKey, emailDomain: cd.customer.emailDomain, customer: { email: cd.customer.email } })
  const doc = await payload.create({
    collection: 'partner-deals',
    overrideAccess: true,
    depth: 1,
    data: {
      dealId,
      status: 'submitted',
      org: orgRel(me.scope),
      orgPartnerId: me.org.partnerId,
      orgName: me.org.name,
      orgType: me.org.type,
      registeredBy: { userId: me.user.id, name: me.user.name, email: me.user.email },
      reseller,
      ...cd,
      products: linesData(input.lines, products),
      submittedAt: now,
      conflicts,
      thread: [entryData({ kind: 'submitted', side: 'partner', byName: me.user.name, byEmail: me.user.email, at: now, to: 'submitted', title: 'Registered', text: cd.notes })],
    } as never,
  })
  let deal = toDeal(doc as unknown as Doc)
  if (files.length) {
    const ids = await addFiles(deal.id, me.scope.orgId, files, me.user.name || me.user.email)
    if (ids.length) deal = await update(deal.id, { thread: [{ ...threadData(deal)[0], files: ids }] })
  }
  await audit({ actor: me.actor, object: 'partner-deals', objectId: deal.id, objectLabel: deal.dealId, action: 'deal.submitted', to: 'submitted', orgId: me.scope.orgId, comment: summary(deal), meta: { conflicts: conflicts.length } })
  await notify({
    event: 'deal.submitted', vars: dealVars(deal),
    subject: `New deal ${deal.dealId}: ${deal.customer.name} (${me.org.partnerId})`,
    body: `${me.org.name} registered ${summary(deal)}, closing ${deal.closeDate.slice(0, 10)}.${conflicts.length ? ` ${conflicts.length} possible conflict${conflicts.length === 1 ? '' : 's'} with other registrations.` : ' No conflict found among portal deals.'}`,
    href: `${K7_DEALS}/${deal.dealId}`,
    to: { kind: 'staff', role: 'dealDeskApprover' },
  })
  await notify({
    event: 'deal.received', vars: dealVars(deal),
    subject: `Deal ${deal.dealId} registered: ${deal.customer.name}`,
    body: `We have your registration for ${deal.customer.name} (${formatInr(deal.expectedValue)}, closing ${deal.closeDate.slice(0, 10)}). A Deal Desk Approver will review it; you are told at every step.`,
    href: `${PARTNER_DEALS}/${deal.dealId}`,
    to: { kind: 'user', user: me.user },
  })
  return { ok: true, deal }
}

/** After a request for information (FR-DEAL-09): the partner edits and resubmits; the number stays, the conflicts are run again. */
export const resubmitDeal = async (me: PartnerContext, dl: Deal, input: DealInput, files: DealFileInput[] = [], reply = ''): Promise<DealResult> => {
  if (!partnerMayEdit(dl.status) || !canMoveDeal(dl.status, 'submitted')) return { ok: false, errors: { status: `A deal that is ${DEAL_STATUS_LABEL[dl.status].toLowerCase()} cannot be edited.` } }
  const products = await listProducts({ activeOnly: true })
  const errors = validateDeal(input, products, me.org.type)
  if (Object.keys(errors).length) return { ok: false, errors }
  const now = new Date().toISOString()
  const cd = customerData(input)
  const reseller = me.org.type === 'distributor' ? await resolveReseller(input.resellerName) : dl.reseller
  const conflicts = await findConflicts({ id: dl.id, customerKey: cd.customerKey, emailDomain: cd.customer.emailDomain, customer: { email: cd.customer.email } })
  const fileIds = files.length ? await addFiles(dl.id, me.scope.orgId, files, me.user.name || me.user.email) : []
  const deal = await update(dl.id, {
    status: 'submitted',
    reseller,
    ...cd,
    products: linesData(input.lines, products),
    conflicts,
    thread: [...threadData(dl), entryData({ kind: 'submitted', side: 'partner', byName: me.user.name, byEmail: me.user.email, at: now, to: 'submitted', title: 'Resubmitted', text: reply.trim(), fileIds })],
  })
  await audit({ actor: me.actor, object: 'partner-deals', objectId: deal.id, objectLabel: deal.dealId, action: 'deal.resubmitted', from: dl.status, to: 'submitted', orgId: me.scope.orgId, comment: reply.trim() || summary(deal) })
  await notify({
    event: 'deal.resubmitted', vars: dealVars(deal),
    subject: `Deal ${deal.dealId} resubmitted: ${deal.customer.name} (${me.org.partnerId})`,
    body: `${me.org.name} answered your request.${reply.trim() ? ` "${reply.trim().slice(0, 300)}"` : ''} ${summary(deal)}.`,
    href: `${K7_DEALS}/${deal.dealId}`,
    to: { kind: 'staff', role: 'dealDeskApprover' },
  })
  return { ok: true, deal }
}

/** A note with attachments from either side, while the deal is live (FR-DEAL-09). The other side is told. */
export const addDealNote = async (who: { side: 'partner' | 'k7'; actor: Actor; name: string; email: string; orgId: string }, dl: Deal, text: string, files: DealFileInput[] = []): Promise<DealMove> => {
  if (!mayAddNote(dl.status)) return { ok: false, error: `Notes cannot be added to a deal that is ${DEAL_STATUS_LABEL[dl.status].toLowerCase()}.` }
  const t = text.trim()
  if (!t && !files.length) return { ok: false, error: 'Write a note or attach a file.' }
  const now = new Date().toISOString()
  const fileIds = files.length ? await addFiles(dl.id, dl.orgId, files, who.name || who.email) : []
  const deal = await update(dl.id, { thread: [...threadData(dl), entryData({ kind: 'note', side: who.side, byName: who.name, byEmail: who.email, at: now, to: '', title: '', text: t, fileIds })] })
  await audit({ actor: who.actor, object: 'partner-deals', objectId: deal.id, objectLabel: deal.dealId, action: 'deal.note', orgId: deal.orgId, comment: `${t.slice(0, 200)}${fileIds.length ? ` (+${fileIds.length} file${fileIds.length === 1 ? '' : 's'})` : ''}` })
  if (who.side === 'partner') {
    await notify({ event: 'deal.note', vars: dealVars(deal), subject: `Note on deal ${deal.dealId} from ${deal.orgName}`, body: t.slice(0, 500) || `${fileIds.length} file(s) attached.`, href: `${K7_DEALS}/${deal.dealId}`, to: { kind: 'staff', role: 'dealDeskApprover' } })
  } else {
    await notify({ event: 'deal.note', vars: dealVars(deal), subject: `K7 added a note on deal ${deal.dealId}`, body: t.slice(0, 500) || `${fileIds.length} file(s) attached.`, href: `${PARTNER_DEALS}/${deal.dealId}`, to: await partnerRecipients(deal) })
  }
  return { ok: true, deal }
}

/** The partner withdraws (§7.2 Withdrawn): anything live; an approved deal gives up its protection and the approvers are told. */
export const withdrawDeal = async (me: PartnerContext, dl: Deal, reason: string): Promise<DealMove> => {
  if (!partnerMayWithdraw(dl.status) || !canMoveDeal(dl.status, 'withdrawn')) return { ok: false, error: `A deal that is ${DEAL_STATUS_LABEL[dl.status].toLowerCase()} cannot be withdrawn.` }
  const now = new Date().toISOString()
  const wasProtected = isProtected(dl)
  const deal = await update(dl.id, { status: 'withdrawn', decidedAt: now, thread: [...threadData(dl), entryData({ kind: 'decision', side: 'partner', byName: me.user.name, byEmail: me.user.email, at: now, to: 'withdrawn', title: 'Withdrawn', text: reason.trim() })] })
  await audit({ actor: me.actor, object: 'partner-deals', objectId: deal.id, objectLabel: deal.dealId, action: 'deal.withdrawn', from: dl.status, to: 'withdrawn', orgId: deal.orgId, comment: reason.trim() })
  await notify({
    event: 'deal.withdrawn', vars: dealVars(deal),
    subject: `Deal ${deal.dealId} withdrawn by ${deal.orgName}`,
    body: `${deal.customer.name}: ${reason.trim() || 'no reason given'}.${wasProtected ? ' The protection is released; the opportunity in the CRM is for sales to close.' : ''}`,
    href: `${K7_DEALS}/${deal.dealId}`,
    to: { kind: 'staff', role: 'dealDeskApprover' },
  })
  return { ok: true, deal }
}

/** The one extension request (FR-DEAL-07, decision 15), before the protection ends. */
export const requestExtension = async (me: PartnerContext, dl: Deal, reason: string): Promise<DealMove> => {
  if (!canRequestExtension(dl)) return { ok: false, error: dl.extension.requestedAt ? 'One extension per deal; it has been asked for already.' : 'An extension can be asked for while the deal is approved and protected.' }
  if (reason.trim().length < 3) return { ok: false, error: 'Tell K7 why the deal needs more time.' }
  const now = new Date().toISOString()
  const deal = await update(dl.id, {
    status: 'extensionRequested',
    extension: { requestedAt: now, requestedBy: me.user.name || me.user.email, reason: reason.trim(), decidedAt: null, decidedBy: '', granted: false, note: '' },
    thread: [...threadData(dl), entryData({ kind: 'extension', side: 'partner', byName: me.user.name, byEmail: me.user.email, at: now, to: 'extensionRequested', title: 'Extension requested', text: reason.trim() })],
  })
  await audit({ actor: me.actor, object: 'partner-deals', objectId: deal.id, objectLabel: deal.dealId, action: 'deal.extension-requested', from: 'approved', to: 'extensionRequested', orgId: deal.orgId, comment: reason.trim() })
  await notify({
    event: 'deal.extension-requested', vars: dealVars(deal),
    subject: `Extension asked on deal ${deal.dealId} (${deal.orgPartnerId})`,
    body: `${deal.orgName} asks to extend the protection on ${deal.customer.name}, which ends ${deal.protectionEnds ? deal.protectionEnds.slice(0, 10) : '—'}. Reason: ${reason.trim()}`,
    href: `${K7_DEALS}/${deal.dealId}`,
    to: { kind: 'staff', role: 'dealDeskApprover' },
  })
  return { ok: true, deal }
}

/* ---------- The approver (FR-DEAL-05, FR-DEAL-06) ---------- */

export type DealChanges = { expectedValue?: number | null; closeDate?: string; customerName?: string }

const changeLines = (dl: Deal, ch: DealChanges): { field: string; from: string; to: string; data: Record<string, unknown> }[] => {
  const out: { field: string; from: string; to: string; data: Record<string, unknown> }[] = []
  if (typeof ch.expectedValue === 'number' && Number.isFinite(ch.expectedValue) && ch.expectedValue > 0 && ch.expectedValue !== dl.expectedValue) out.push({ field: 'Expected value', from: formatInr(dl.expectedValue), to: formatInr(ch.expectedValue), data: { expectedValue: ch.expectedValue } })
  if (ch.closeDate && /^\d{4}-\d{2}-\d{2}$/.test(ch.closeDate) && ch.closeDate !== dl.closeDate.slice(0, 10)) out.push({ field: 'Expected closure', from: dl.closeDate.slice(0, 10), to: ch.closeDate, data: { closeDate: ch.closeDate } })
  const name = ch.customerName?.trim() ?? ''
  if (name && name !== dl.customer.name) out.push({ field: 'Customer', from: dl.customer.name, to: name, data: { customerName: name, customerKey: customerKey(name) } })
  return out
}

/** Approve (plain or with changes), request information, or reject. Approval sets the protection window and queues the
    opportunity job; the partner is told by bell and mail (FR-DEAL-05). */
export const decideDeal = async (dl: Deal, decision: DealDecision, note: string, changes: DealChanges, me: K7Context): Promise<DealMove> => {
  if (isRepeatedDealDecision(dl.status, decision)) return { ok: true, deal: dl, already: alreadyLine(decision, [...dl.thread].reverse().find((e) => e.kind === 'decision' && e.to === DEAL_DECISION_TO[decision])?.byName) }
  if (!canDecideDeal(dl.status, decision)) return { ok: false, error: `${DEAL_STATUS_LABEL[dl.status]} deals cannot be ${decision === 'reject' ? 'rejected' : decision === 'requestInfo' ? 'sent back' : 'approved'}.` }
  const text = note.trim()
  const lines = decision === 'approveWithChanges' ? changeLines(dl, changes) : []
  if (decision === 'approveWithChanges' && !lines.length) return { ok: false, error: 'Approve with changes needs a changed value, closure date or customer name; otherwise approve as filed.' }
  if (dealDecisionNeedsComment(decision) && text.length < 3 && decision !== 'approveWithChanges') return { ok: false, error: decision === 'reject' ? 'Give the partner the reason.' : 'Tell the partner what you need.' }
  const settings = await getPartnerSettings()
  const now = new Date().toISOString()
  const to = DEAL_DECISION_TO[decision]
  const approving = to === 'approved'
  const protectionEnds = approving ? protectionEnd(now, settings.deals.protectionDays) : dl.protectionEnds
  const changed = lines.map((l) => `${l.field}: ${l.from} → ${l.to}`).join('; ')
  const entryText = [changed, text].filter(Boolean).join('\n')
  const data: Record<string, unknown> = {
    status: to,
    decidedAt: approving || to === 'rejected' ? now : dl.decidedAt,
    protectionEnds,
    thread: [...threadData(dl), entryData({ kind: 'decision', side: 'k7', byName: me.name, byEmail: me.email, at: now, to, title: DEAL_DECISION_LABEL[decision], text: entryText })],
  }
  for (const l of lines) Object.assign(data, l.data)
  const deal = await update(dl.id, data)
  const action = decision === 'reject' ? 'deal.rejected' : decision === 'requestInfo' ? 'deal.info-requested' : decision === 'approveWithChanges' ? 'deal.approved-with-changes' : 'deal.approved'
  await audit({ actor: me.actor, object: 'partner-deals', objectId: deal.id, objectLabel: deal.dealId, action, from: dl.status, to, orgId: deal.orgId, comment: entryText, meta: lines.length ? { changes: lines.map(({ data: _d, ...rest }) => rest) } : undefined })
  const to_ = await partnerRecipients(deal)
  if (approving) {
    await notify({
      event: 'deal.approved', vars: dealVars(deal),
      subject: `Deal ${deal.dealId} approved: ${deal.customer.name}`,
      body: `Your registration for ${deal.customer.name} is approved${lines.length ? ' with changes' : ''} and protected until ${protectionEnds!.slice(0, 10)} (${settings.deals.protectionDays} days).${changed ? ` Changed by K7: ${changed}.` : ''}${text ? ` ${text}` : ''} The deal is being created in K7's CRM; its sales stage will show on your dashboard.`,
      href: `${PARTNER_DEALS}/${deal.dealId}`,
      to: to_,
    })
    const job = await enqueueOutbox({ kind: 'opportunity.create', orgId: deal.orgId, object: 'partner-deals', objectId: deal.id, objectLabel: deal.dealId, payload: { approverUserId: me.userId, approverEmail: me.email, approvedAt: now, ownerRule: settings.crm.ownerRule, ownerId: settings.crm.ownerId }, actor: me.email || me.name })
    if (!job) console.error(`[partner deals] the CRM job for ${deal.dealId} could not be queued`)
  } else if (to === 'rejected') {
    await notify({ event: 'deal.rejected', vars: dealVars(deal), subject: `Deal ${deal.dealId} not accepted: ${deal.customer.name}`, body: `K7 did not accept the registration for ${deal.customer.name}. Reason: ${text}`, href: `${PARTNER_DEALS}/${deal.dealId}`, to: to_ })
  } else {
    await notify({ event: 'deal.info-requested', vars: dealVars(deal), subject: `Deal ${deal.dealId}: K7 needs something from you`, body: `About ${deal.customer.name}: ${text}\n\nOpen the deal, edit the registration and resubmit it.`, href: `${PARTNER_DEALS}/${deal.dealId}`, to: to_ })
  }
  return { ok: true, deal }
}

/** After approval only K7 changes the value or the customer (FR-DEAL-09); the partner is told what changed. */
export const amendDeal = async (dl: Deal, changes: DealChanges, note: string, me: K7Context): Promise<DealMove> => {
  if (!k7MayAmend(dl.status)) return { ok: false, error: `An amendment is for an approved deal; this one is ${DEAL_STATUS_LABEL[dl.status].toLowerCase()}.` }
  const lines = changeLines(dl, changes)
  // The form carries the deal's figures, so a second click (B-03) or an untouched form finds nothing to change: harmless.
  if (!lines.length) return { ok: true, deal: dl, already: 'Nothing to change: the deal already has these figures.' }
  const now = new Date().toISOString()
  const changed = lines.map((l) => `${l.field}: ${l.from} → ${l.to}`).join('; ')
  const text = [changed, note.trim()].filter(Boolean).join('\n')
  const data: Record<string, unknown> = { thread: [...threadData(dl), entryData({ kind: 'amendment', side: 'k7', byName: me.name, byEmail: me.email, at: now, to: '', title: 'Amended by K7', text })] }
  for (const l of lines) Object.assign(data, l.data)
  const deal = await update(dl.id, data)
  await audit({ actor: me.actor, object: 'partner-deals', objectId: deal.id, objectLabel: deal.dealId, action: 'deal.amended', orgId: deal.orgId, comment: text, meta: { changes: lines.map(({ data: _d, ...rest }) => rest) } })
  await notify({ event: 'deal.amended', vars: dealVars(deal), subject: `Deal ${deal.dealId} amended by K7`, body: `${changed}.${note.trim() ? ` ${note.trim()}` : ''} The CRM keeps its own figures; the dashboard shows them.`, href: `${PARTNER_DEALS}/${deal.dealId}`, to: await partnerRecipients(deal) })
  return { ok: true, deal }
}

/** Grant the extension (the window grows by the settings' extension days from its current end) or decline it (the protection
    runs on as before; if it has already run out the deal expires now). */
export const decideExtension = async (dl: Deal, grant: boolean, note: string, me: K7Context): Promise<DealMove> => {
  if (isRepeatedExtension(dl.status, dl.extension, grant)) return { ok: true, deal: dl, already: alreadyLine(grant ? 'grant' : 'decline', dl.extension.decidedBy) }
  if (dl.status !== 'extensionRequested') return { ok: false, error: 'No extension request is waiting.' }
  const text = note.trim()
  if (!grant && text.length < 3) return { ok: false, error: 'Tell the partner why not.' }
  const settings = await getPartnerSettings()
  const now = new Date().toISOString()
  const expiredAlready = !grant && Boolean(dl.protectionEnds) && new Date(dl.protectionEnds!).getTime() <= Date.now()
  const protectionEnds = grant && dl.protectionEnds ? protectionEnd(dl.protectionEnds, settings.deals.extensionDays) : dl.protectionEnds
  const to: DealStatus = expiredAlready ? 'expired' : 'approved'
  const deal = await update(dl.id, {
    status: to,
    protectionEnds,
    endingNoticeAt: grant ? null : dl.endingNoticeAt,
    extension: { ...dl.extension, decidedAt: now, decidedBy: me.name || me.email, granted: grant, note: text },
    thread: [...threadData(dl), entryData({ kind: 'extension', side: 'k7', byName: me.name, byEmail: me.email, at: now, to, title: grant ? 'Extension granted' : 'Extension declined', text: grant ? `Protected until ${protectionEnds!.slice(0, 10)}.${text ? ` ${text}` : ''}` : text })],
  })
  await audit({ actor: me.actor, object: 'partner-deals', objectId: deal.id, objectLabel: deal.dealId, action: grant ? 'deal.extension-granted' : 'deal.extension-declined', from: 'extensionRequested', to, orgId: deal.orgId, comment: grant ? `Until ${protectionEnds!.slice(0, 10)}${text ? `. ${text}` : ''}` : text })
  await notify({
    event: grant ? 'deal.extension-granted' : 'deal.extension-declined', vars: dealVars(deal),
    subject: grant ? `Deal ${deal.dealId}: protection extended` : `Deal ${deal.dealId}: extension not granted`,
    body: grant ? `${deal.customer.name} is now protected until ${protectionEnds!.slice(0, 10)}.${text ? ` ${text}` : ''}` : `K7 did not extend the protection on ${deal.customer.name}. Reason: ${text}${expiredAlready ? ' The protection period has ended.' : ` It ends ${deal.protectionEnds ? deal.protectionEnds.slice(0, 10) : '—'}.`}`,
    href: `${PARTNER_DEALS}/${deal.dealId}`,
    to: await partnerRecipients(deal),
  })
  return { ok: true, deal }
}

/* ---------- The sweep (§7.2 Expired; FR-NTF-01 "protection ending") ---------- */

export type SweepResult = { expired: string[]; noticed: string[]; errors: string[] }

/** Approved deals past their protection end expire; approved deals inside the notice window are told once. An extension that
    is still waiting keeps the deal where it is for the approver. */
export const sweepDeals = async (now = new Date()): Promise<SweepResult> => {
  const r: SweepResult = { expired: [], noticed: [], errors: [] }
  const settings = await getPartnerSettings()
  const payload = await db()
  const iso = now.toISOString()
  const past = await payload.find({ collection: 'partner-deals', where: { and: [{ status: { equals: 'approved' } }, { protectionEnds: { less_than_equal: iso } }] }, limit: 200, depth: 1, overrideAccess: true })
  for (const doc of past.docs as unknown as Doc[]) {
    const dl = toDeal(doc)
    try {
      const deal = await update(dl.id, { status: 'expired', thread: [...threadData(dl), entryData({ kind: 'system', side: 'system', byName: 'Portal', byEmail: '', at: iso, to: 'expired', title: 'Protection ended', text: `The protection period ended on ${dl.protectionEnds!.slice(0, 10)} without an extension.` })] })
      await audit({ actor: SYSTEM, object: 'partner-deals', objectId: deal.id, objectLabel: deal.dealId, action: 'deal.expired', from: 'approved', to: 'expired', orgId: deal.orgId })
      await notify({ event: 'deal.expired', vars: dealVars(deal), subject: `Deal ${deal.dealId}: protection ended`, body: `The protection on ${deal.customer.name} ended on ${dl.protectionEnds!.slice(0, 10)}. If the deal is still live, register it again.`, href: `${PARTNER_DEALS}/${deal.dealId}`, to: await partnerRecipients(deal) })
      r.expired.push(deal.dealId)
    } catch (e) {
      r.errors.push(`${dl.dealId}: ${(e as Error).message}`)
    }
  }
  const soon = new Date(now.getTime() + settings.deals.endingNoticeDays * 86400000).toISOString()
  const ending = await payload.find({ collection: 'partner-deals', where: { and: [{ status: { equals: 'approved' } }, { protectionEnds: { greater_than: iso } }, { protectionEnds: { less_than_equal: soon } }, { endingNoticeAt: { exists: false } }] }, limit: 200, depth: 1, overrideAccess: true })
  for (const doc of ending.docs as unknown as Doc[]) {
    const dl = toDeal(doc)
    try {
      const deal = await update(dl.id, { endingNoticeAt: iso })
      const when = dl.protectionEnds!.slice(0, 10)
      await notify({ event: 'deal.protection-ending', vars: dealVars(deal), subject: `Deal ${deal.dealId}: protection ends ${when}`, body: `The protection on ${deal.customer.name} ends on ${when}.${dl.extension.requestedAt ? '' : ' You may ask for one extension before then.'}`, href: `${PARTNER_DEALS}/${deal.dealId}`, to: await partnerRecipients(deal) })
      await notify({ event: 'deal.protection-ending', vars: dealVars(deal), subject: `Deal ${deal.dealId} (${deal.orgPartnerId}): protection ends ${when}`, body: `${deal.orgName}'s registration for ${deal.customer.name} ends its protection on ${when}.`, href: `${K7_DEALS}/${deal.dealId}`, to: { kind: 'staff', role: 'dealDeskApprover' } })
      r.noticed.push(deal.dealId)
    } catch (e) {
      r.errors.push(`${dl.dealId}: ${(e as Error).message}`)
    }
  }
  return r
}

export { OPEN_DEAL_STATUSES }
export type { DealLine }
